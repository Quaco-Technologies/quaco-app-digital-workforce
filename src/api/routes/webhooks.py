from __future__ import annotations

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

    try:
        msg = parse_inbound_sms(payload)
    except Exception as exc:
        logger.error("webhook.sms.parse_error", error=str(exc))
        return {"ok": True}

    from_number = msg.get("from_number", "")
    text = msg.get("body", "").strip()

    if not from_number or not text:
        return {"ok": True}

    # Handle STOP / opt-out
    if text.upper() in {"STOP", "UNSUBSCRIBE", "CANCEL", "QUIT", "END"}:
        repos = Repositories(__import__("src.core.database", fromlist=["get_db"]).get_db())
        contact = repos.contacts.find_by_phone(from_number)
        if contact:
            repos.leads.update_status(contact.lead_id, __import__("src.models.lead", fromlist=["LeadStatus"]).LeadStatus.DEAD)
        return {"ok": True}

    repos = Repositories(__import__("src.core.database", fromlist=["get_db"]).get_db())
    contact = repos.contacts.find_by_phone(from_number)
    if not contact:
        logger.warning("webhook.sms.unknown_number", from_number=from_number)
        return {"ok": True}

    # Enqueue so webhook returns in <200ms
    redis: ArqRedis = request.app.state.redis
    await redis.enqueue_job("task_handle_sms_reply", lead_id=str(contact.lead_id), body=text)

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
