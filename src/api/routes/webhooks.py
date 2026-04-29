from __future__ import annotations

import asyncio
import hashlib
import hmac
from uuid import UUID

from arq import ArqRedis
from fastapi import APIRouter, Header, HTTPException, Request, status

from src.api.deps import get_repos
from src.core.config import settings
from src.core.logging import get_logger
from src.repositories import Repositories
from src.services.pipeline import handle_signature_complete, handle_sms_reply
from src.tools.telenyx_tools import parse_inbound_sms

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = get_logger(__name__)


def _verify_telenyx_signature(payload: bytes, signature: str) -> bool:
    if not settings.telenyx_webhook_secret:
        return True  # skip in dev
    expected = hmac.new(
        settings.telenyx_webhook_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/sms")
async def telenyx_sms(
    request: Request,
    telnyx_signature_ed25519: str = Header(None, alias="telnyx-signature-ed25519"),
) -> dict:
    """Telenyx inbound SMS webhook — routes reply to negotiation agent."""
    body = await request.body()
    payload = await request.json()

    # Telnyx fires the SAME webhook URL for both inbound messages AND delivery
    # receipts for our outbound. Skip everything that isn't an actual inbound.
    event_type = (
        payload.get("data", {}).get("event_type", "")
        or payload.get("event_type", "")
    )
    if event_type and event_type != "message.received":
        return {"ok": True}

    try:
        msg = parse_inbound_sms(payload)
    except Exception as exc:
        logger.error("webhook.sms.parse_error", error=str(exc))
        return {"ok": True}

    from_number = msg.get("from_number", "")
    text = msg.get("body", "").strip()

    if not from_number or not text:
        return {"ok": True}

    # Ignore loopbacks: if "from" is our own Telnyx number, this is a
    # delivery receipt impersonating an inbound (Telnyx event_type quirk).
    our_number = settings.telenyx_from_number.strip()
    if our_number and from_number.strip() == our_number:
        return {"ok": True}

    # Handle STOP / opt-out
    if text.upper() in {"STOP", "UNSUBSCRIBE", "CANCEL", "QUIT", "END"}:
        repos = Repositories(__import__("src.core.database", fromlist=["get_db"]).get_db())
        contact = repos.contacts.find_by_phone(from_number)
        if contact:
            repos.leads.update_status(contact.lead_id, __import__("src.models.lead", fromlist=["LeadStatus"]).LeadStatus.DEAD)
        return {"ok": True}

    repos = Repositories(__import__("src.core.database", fromlist=["get_db"]).get_db())
    contact = None
    try:
        contact = repos.contacts.find_by_phone(from_number)
    except Exception:
        # find_by_phone uses a Postgres JSON contains query that chokes on
        # the leading "+" — fall through to fuzzy digit match below.
        contact = None
    if not contact:
        # Order by created_at DESC and take the FIRST matching — phone is
        # often shared across many demo leads, we want the most recent one.
        digits = "".join(ch for ch in from_number if ch.isdigit())
        last10 = digits[-10:] if len(digits) >= 10 else digits
        all_recent = (
            repos.db.table("contacts")
            .select("lead_id,phones,owner_name,emails,confidence,created_at")
            .order("created_at", desc=True)
            .limit(200)
            .execute().data or []
        )
        for row in all_recent:
            for p in (row.get("phones") or []):
                p_digits = "".join(ch for ch in str(p) if ch.isdigit())
                if p_digits.endswith(last10):
                    from src.models.contact import Contact
                    contact = Contact(
                        lead_id=row["lead_id"],
                        owner_name=row.get("owner_name"),
                        phones=row.get("phones") or [],
                        emails=row.get("emails") or [],
                        confidence=row.get("confidence") or 0,
                    )
                    break
            if contact:
                break
        if not contact:
            logger.warning("webhook.sms.unknown_number", from_number=from_number)
            return {"ok": True}

    # Process inline — Redis worker may not be running locally. Fall back to
    # enqueue if redis is wired up (faster webhook ack), otherwise run in-thread.
    redis: ArqRedis | None = getattr(request.app.state, "redis", None)
    if redis is not None:
        try:
            await redis.enqueue_job("task_handle_sms_reply", lead_id=str(contact.lead_id), body=text)
            return {"ok": True}
        except Exception as exc:
            logger.warning("webhook.sms.enqueue_failed", error=str(exc)[:200])
            # fall through to inline

    # Fire-and-forget: return 200 to Telnyx immediately, run the AI in the
    # background so the dashboard's next poll picks up the new messages.
    # Telnyx retries if we take >10s — this avoids that.
    lead_id = contact.lead_id
    body = text

    def _process() -> None:
        try:
            local_repos = Repositories(__import__("src.core.database", fromlist=["get_db"]).get_db())
            result = handle_sms_reply(lead_id, body, local_repos)
            logger.info("webhook.sms.handled_async", lead_id=str(lead_id), status=result.get("status"))
        except Exception as exc:
            logger.warning("webhook.sms.async_failed", error=str(exc)[:200])

    asyncio.get_event_loop().run_in_executor(None, _process)
    return {"ok": True}


@router.post("/lumin")
async def lumin_signature(request: Request) -> dict:
    """Lumin signature-complete webhook — finalizes lead status."""
    payload = await request.json()
    event_type = payload.get("event") or payload.get("data", {}).get("event_type", "")

    if "completed" not in str(event_type).lower():
        return {"ok": True}

    envelope_id = (
        payload.get("envelope_id")
        or payload.get("data", {}).get("id", "")
    )
    if not envelope_id:
        return {"ok": True}

    redis: ArqRedis = request.app.state.redis
    await redis.enqueue_job("task_handle_signature_complete", envelope_id=envelope_id)

    return {"ok": True}
