from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.deps import get_repos
from src.api.middleware.auth import get_investor_id
from src.core.exceptions import NotFoundError
from src.core.logging import get_logger
from src.models.message import MessageRole
from src.repositories import Repositories
from src.tools.telenyx_tools import send_sms

logger = get_logger(__name__)

router = APIRouter(prefix="/inbox", tags=["inbox"])


class InboxThread(BaseModel):
    lead_id: str
    address: str
    city: Optional[str]
    state: Optional[str]
    owner_name: Optional[str]
    last_body: str
    last_role: str
    last_sent_at: str
    message_count: int
    has_unread_reply: bool
    lead_status: str


class ReplyRequest(BaseModel):
    body: str


@router.get("", response_model=List[InboxThread])
def list_threads(
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> List[InboxThread]:
    """Threads for the investor's leads, sorted by most recent activity.
    A thread only appears once at least one SMS exists in either direction."""
    leads = repos.leads.list(investor_id=investor_id, limit=1000)
    if not leads:
        return []

    lead_ids = [str(l.id) for l in leads]
    summaries = repos.messages.summarize_threads(lead_ids)
    if not summaries:
        return []

    contact_map = {
        str(c.lead_id): c
        for c in repos.contacts.get_by_lead_ids(lead_ids)
    }
    lead_map = {str(l.id): l for l in leads}

    threads: List[InboxThread] = []
    for lid, s in summaries.items():
        lead = lead_map.get(lid)
        if not lead:
            continue
        contact = contact_map.get(lid)
        threads.append(InboxThread(
            lead_id=lid,
            address=lead.address,
            city=lead.city,
            state=lead.state,
            owner_name=contact.owner_name if contact else None,
            last_body=s["last_body"],
            last_role=s["last_role"],
            last_sent_at=s["last_sent_at"],
            message_count=s["count"],
            has_unread_reply=s["last_role"] == "owner",
            lead_status=lead.status,
        ))

    threads.sort(key=lambda t: t.last_sent_at, reverse=True)
    return threads


@router.post("/{lead_id}/reply")
def send_manual_reply(
    lead_id: UUID,
    req: ReplyRequest,
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> dict:
    """Investor sends a manual SMS reply, bypassing the AI negotiation agent."""
    body = req.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Message body is empty")

    lead = repos.leads.get(lead_id)
    if not lead:
        raise NotFoundError("Lead", str(lead_id))

    contact = repos.contacts.get(lead_id)
    if not contact or not contact.phones:
        raise HTTPException(status_code=400, detail="No phone number on file for owner")

    try:
        result = send_sms(to=contact.phones[0], body=body)
    except Exception as exc:
        logger.warning("inbox.manual_reply_failed", lead_id=str(lead_id), error=str(exc)[:200])
        raise HTTPException(status_code=502, detail=f"SMS send failed: {exc}")

    msg = repos.messages.append(lead_id, MessageRole.AGENT, body)
    repos.db.table("leads").update({
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", str(lead_id)).execute()

    return {
        "message_id": result.get("message_id", ""),
        "message": msg.model_dump(mode="json"),
    }
