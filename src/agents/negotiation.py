from __future__ import annotations

from typing import Any, Dict, List, Optional
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
on behalf of a local investor. Your goal: build rapport, understand the seller's situation,
and reach a purchase price at or below max_offer.

Rules:
- Keep messages 2-4 sentences max. This is SMS — not email, not a letter.
- Never reveal you are an AI.
- Warm, direct, professional tone. Use the seller's first name.
- Never go above max_offer under any circumstances.

Strategy:
1. Opening: introduce yourself as a local investor, express genuine interest, ask if they'd
   consider a cash offer.
2. Discovery: ask about their timeline, reason for selling, any repairs needed.
3. Offer: present initial_offer as a cash, as-is, quick-close number.
4. Counter: if rejected, ask what works for them. Move in 5-10% increments.
5. Agreement: once seller accepts, confirm the price clearly and say you'll send paperwork.
6. If uninterested after 2 follow-up attempts: signal DEAD_LEAD.

When the negotiation concludes include ONE of these signals on its own line at the end:
  DEAL_AGREED:$<price>
  DEAD_LEAD

Output ONLY the SMS text (and the signal line if applicable). No preamble, no commentary."""


def _build_context(lead: Any, contact: Any) -> str:
    arv = lead.arv or 0
    offer = lead.offer_price or 0
    # Max offer: up to 80% of ARV, always at least 15% above initial offer
    max_offer = max(int(arv * 0.80), int(offer * 1.15)) if arv else int(offer * 1.15)
    return (
        f"Property: {lead.address}, {lead.city}, {lead.state}\n"
        f"ARV: ${arv:,} | Initial offer: ${offer:,} | Max offer: ${max_offer:,}\n"
        f"Owner name: {contact.owner_name or 'the owner'}\n"
        f"Condition: {getattr(lead, 'photo_condition', None) or 'unknown'}\n"
    )


def _build_messages(lead: Any, contact: Any, history: List[Any]) -> List[Dict[str, Any]]:
    context = _build_context(lead, contact)
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


def _call_claude(messages: List[Dict[str, Any]]) -> str:
    response = _client.messages.create(
        model=settings.model,
        max_tokens=256,
        system=_SYSTEM,
        messages=messages,
    )
    return next((b.text for b in response.content if hasattr(b, "text")), "")


def start_outreach(lead_id: UUID, repos: Repositories) -> Dict[str, Any]:
    lead = repos.leads.get(lead_id)
    contact = repos.contacts.get(lead_id)

    if not lead or not contact:
        return {"error": "missing lead or contact"}
    if not contact.phones:
        return {"error": "no phone number for owner"}

    messages = _build_messages(lead, contact, [])
    raw = _call_claude(messages)
    parsed = _parse_response(raw)
    sms_text = parsed["sms"]

    repos.messages.append(lead_id, MessageRole.AGENT, sms_text)
    result = send_sms(to=contact.phones[0], body=sms_text)
    repos.leads.update_status(lead_id, LeadStatus.OUTREACH)

    logger.info("outreach_sent", lead_id=str(lead_id), message_id=result.get("message_id"))
    return {"sent": True, "message_id": result.get("message_id"), "sms": sms_text}


def handle_reply(lead_id: UUID, inbound_body: str, repos: Repositories) -> Dict[str, Any]:
    lead = repos.leads.get(lead_id)
    contact = repos.contacts.get(lead_id)

    if not lead or not contact:
        return {"error": "missing lead or contact"}

    repos.messages.append(lead_id, MessageRole.OWNER, inbound_body)
    history = repos.messages.get_conversation(lead_id)
    messages = _build_messages(lead, contact, history)

    raw = _call_claude(messages)
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
