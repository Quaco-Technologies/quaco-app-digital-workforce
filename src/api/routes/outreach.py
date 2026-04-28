from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.deps import get_repos
from src.api.middleware.auth import get_investor_id
from src.models.message import MessageRole
from src.repositories import Repositories
from src.tools.telenyx_tools import send_sms
from src.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/outreach", tags=["outreach"])


class LaunchOutreachRequest(BaseModel):
    campaign_id: str
    lead_ids: List[str]
    message_template: str  # supports {owner_name}, {address}, {offer_price}


class OutreachResult(BaseModel):
    lead_id: str
    phone: str
    status: str
    error: Optional[str] = None


def _render(template: str, owner_name: Optional[str], address: str, offer_price: Optional[int]) -> str:
    offer = f"${offer_price:,}" if offer_price else "a competitive offer"
    name = owner_name.split()[0] if owner_name else "there"
    return (
        template
        .replace("{owner_name}", name)
        .replace("{address}", address)
        .replace("{offer_price}", offer)
    )


@router.post("/launch")
def launch_outreach(
    req: LaunchOutreachRequest,
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> dict:
    """Send SMS to selected leads. Skips leads already contacted."""
    results = []
    sent = 0
    skipped = 0

    for lead_id in req.lead_ids:
        # Fetch lead
        lead_rows = (
            repos.db.table("leads").select("id,address,owner_name,offer_price,outreach_status")
            .eq("id", lead_id).eq("investor_id", str(investor_id)).limit(1).execute().data or []
        )
        if not lead_rows:
            skipped += 1
            continue

        lead = lead_rows[0]
        if lead.get("outreach_status") == "contacted":
            results.append({"lead_id": lead_id, "phone": "", "status": "skipped", "error": "already contacted"})
            skipped += 1
            continue

        # Get contact phones
        contact_rows = (
            repos.db.table("contacts").select("phones")
            .eq("lead_id", lead_id).limit(1).execute().data or []
        )
        phones = contact_rows[0].get("phones", []) if contact_rows else []
        if not phones:
            results.append({"lead_id": lead_id, "phone": "", "status": "skipped", "error": "no phone"})
            skipped += 1
            continue

        phone = phones[0]
        body = _render(req.message_template, lead.get("owner_name"), lead["address"], lead.get("offer_price"))

        # Send SMS
        try:
            sms_result = send_sms(to=phone, body=body)
            message_id = sms_result.get("message_id", "")
            status = "sent"
            error = None
            sent += 1
        except Exception as exc:
            message_id = ""
            status = "failed"
            error = str(exc)[:200]
            logger.warning("outreach.sms_failed", lead_id=lead_id, phone=phone, error=error)

        # Record in outreach_messages
        now = datetime.now(timezone.utc).isoformat()
        repos.db.table("outreach_messages").insert({
            "lead_id": lead_id,
            "campaign_id": req.campaign_id,
            "investor_id": str(investor_id),
            "phone": phone,
            "body": body,
            "message_id": message_id,
            "status": status,
            "error": error,
            "sent_at": now,
        }).execute()

        # Mark lead as contacted if sent — and mirror into the conversation log
        # so the lead detail page shows the outbound SMS, not just owner replies.
        if status == "sent":
            repos.db.table("leads").update({
                "outreach_status": "contacted",
                "updated_at": now,
            }).eq("id", lead_id).execute()
            try:
                repos.messages.append(UUID(lead_id), MessageRole.AGENT, body)
            except Exception as exc:
                logger.warning("outreach.message_log_failed", lead_id=lead_id, error=str(exc)[:200])

        results.append({"lead_id": lead_id, "phone": phone, "status": status, "error": error})

    logger.info("outreach.complete", sent=sent, skipped=skipped, campaign_id=req.campaign_id)
    return {"sent": sent, "skipped": skipped, "results": results}


@router.get("/campaign/{campaign_id}/stats")
def campaign_outreach_stats(
    campaign_id: str,
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> dict:
    rows = (
        repos.db.table("outreach_messages")
        .select("status")
        .eq("campaign_id", campaign_id)
        .eq("investor_id", str(investor_id))
        .execute().data or []
    )
    total = len(rows)
    sent = sum(1 for r in rows if r["status"] == "sent")
    failed = sum(1 for r in rows if r["status"] == "failed")
    return {"total": total, "sent": sent, "failed": failed}
