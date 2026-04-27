from __future__ import annotations

from typing import Any, Dict, List
from uuid import UUID

from anthropic import Anthropic

from src.core.config import settings
from src.core.logging import get_logger
from src.models.lead import LeadStatus
from src.models.message import MessageRole
from src.repositories import Repositories
from src.tools.telenyx_tools import send_sms

logger = get_logger(__name__)
_client = Anthropic()

_SYSTEM = """You are an expert real estate acquisitions specialist conducting SMS negotiation
on behalf of an investor. Your goal: build rapport, understand seller's situation, and
reach a price at or below max_offer.

Rules:
- Keep messages 2-4 sentences max. This is SMS, not email.
- Never reveal you are an AI.
- Warm, direct, professional tone.

Strategy:
1. Opening: introduce yourself, express genuine interest.
2. Discovery: ask about timeline, reason for selling, property condition.
3. Offer: start at initial_offer. If rejected, ask what number works for them.
4. Counter: move in 5-10% increments, never exceed max_offer.
5. Agreement: once seller agrees, confirm the price clearly.
6. If uninterested after 2 attempts: signal DEAD_LEAD.

When done negotiating include ONE of these signals on its own line:
  DEAL_AGREED:$<price>
  DEAD_LEAD

Output only the SMS text (and signal if applicable). Nothing else."""


def _build_messages(lead: Any, deal: Any, contact: Any, history: List[Any]) -> List[Dict[str, Any]]:
    context = (
        f"Property: {lead.address}, {lead.city}, {lead.state}\n"
        f"Asking: ${(lead.price or 0):,}\n"
        f"ARV: ${(deal.arv or 0):,} | Initial offer: ${(deal.initial_offer or 0):,} | Max: ${(deal.max_offer or 0):,}\n"
        f"Owner: {contact.owner_name or 'Owner'}\n"
    )
    messages: List[Dict[str, Any]] = [
        {"role": "user", "content": f"Context:\n{context}\n\nBegin negotiation."}
    ]
    for turn in history:
        role = "assistant" if turn.role == MessageRole.AGENT else "user"
        messages.append({"role": role, "content": turn.body})
    return messages


def _parse_response(text: str) -> Dict[str, Any]:
    agreed_price = None
    is_dead = False
    sms_lines = []

    for line in text.splitlines():
        s = line.strip()
        if s.startswith("DEAL_AGREED:"):
            try:
                agreed_price = int(s.split("$")[1].replace(",", ""))
            except (IndexError, ValueError):
                pass
        elif s == "DEAD_LEAD":
            is_dead = True
        else:
            sms_lines.append(line)

    return {
        "sms": "\n".join(sms_lines).strip(),
        "agreed_price": agreed_price,
        "is_dead": is_dead,
    }


def start_outreach(lead_id: UUID, repos: Repositories) -> Dict[str, Any]:
    lead = repos.leads.get(lead_id)
    deal = repos.deals.get(lead_id)
    contact = repos.contacts.get(lead_id)

    if not lead or not deal or not contact:
        return {"error": "missing lead, deal, or contact"}
    if not contact.phones:
        return {"error": "no phone number for owner"}

    messages = _build_messages(lead, deal, contact, [])
    response = _client.messages.create(
        model=settings.model,
        max_tokens=512,
        thinking={"type": "adaptive"},
        system=_SYSTEM,
        messages=messages,
    )

    raw = next((b.text for b in response.content if hasattr(b, "text")), "")
    parsed = _parse_response(raw)
    sms_text = parsed["sms"]

    repos.messages.append(lead_id, MessageRole.AGENT, sms_text)
    result = send_sms(to=contact.phones[0], body=sms_text)
    repos.leads.update_status(lead_id, LeadStatus.OUTREACH)

    logger.info("outreach_sent", lead_id=str(lead_id), message_id=result.get("message_id"))
    return {"sent": True, "message_id": result.get("message_id"), "sms": sms_text}


def handle_reply(lead_id: UUID, inbound_body: str, repos: Repositories) -> Dict[str, Any]:
    lead = repos.leads.get(lead_id)
    deal = repos.deals.get(lead_id)
    contact = repos.contacts.get(lead_id)

    if not lead or not deal or not contact:
        return {"error": "missing data for lead"}

    repos.messages.append(lead_id, MessageRole.OWNER, inbound_body)
    history = repos.messages.get_conversation(lead_id)
    messages = _build_messages(lead, deal, contact, history)

    response = _client.messages.create(
        model=settings.model,
        max_tokens=512,
        thinking={"type": "adaptive"},
        system=_SYSTEM,
        messages=messages,
    )

    raw = next((b.text for b in response.content if hasattr(b, "text")), "")
    parsed = _parse_response(raw)
    sms_text = parsed["sms"]

    if sms_text and contact.phones:
        repos.messages.append(lead_id, MessageRole.AGENT, sms_text)
        send_sms(to=contact.phones[0], body=sms_text)

    if parsed["agreed_price"]:
        repos.leads.update_status(lead_id, LeadStatus.NEGOTIATING, agreed_price=parsed["agreed_price"])
        return {"sms_sent": sms_text, "status": "deal_agreed", "agreed_price": parsed["agreed_price"]}

    if parsed["is_dead"]:
        repos.leads.update_status(lead_id, LeadStatus.DEAD)
        return {"sms_sent": sms_text, "status": "dead_lead"}

    repos.leads.update_status(lead_id, LeadStatus.NEGOTIATING)
    return {"sms_sent": sms_text, "status": "negotiating"}
