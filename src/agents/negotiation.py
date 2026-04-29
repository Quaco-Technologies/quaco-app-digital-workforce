from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

import os
import re

from openai import OpenAI

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

from src.core.config import settings
from src.core.logging import get_logger
from src.models.lead import LeadStatus
from src.models.message import MessageRole
from src.repositories import Repositories
from src.tools.email_tools import render_contract_email, send_email
from src.tools.sms_router import send_sms

logger = get_logger(__name__)

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.openai_api_key)
    return _client

_SYSTEM = """You are an expert real estate acquisitions specialist conducting SMS negotiation
on behalf of a local investor. Your goal: build rapport, understand the seller's situation,
reach a purchase price at or below max_offer, and collect the seller's email so we can send
the contract.

CRITICAL — opening message rules (US carriers block lead-gen spam):
- Opening text MUST be under 80 characters total
- Opening text must NOT include the property address, price, ARV, or business name
- Opening text should sound like a real human friend reaching out — casual, not corporate
- Examples of good openings:
  * "Hey {name}, this is Alex — got a sec? Quick question about your place."
  * "Hi {name}! Are you open to a cash offer on your home?"
- Examples of BAD openings (carrier-blocked):
  * "Hi Maria, I'm a local real estate investor interested in 3857 N High St..."
  * "Hi! I'm a cash buyer looking at properties in Atlanta GA, your address came up..."

After they reply ONCE, you can mention specifics (address, offer, terms).

Rules:
- Keep all messages under 240 characters (one SMS segment)
- Never reveal you are an AI
- Warm, direct tone. Use the seller's first name
- Never go above max_offer

Strategy:
1. Opening (under 80 chars, no address): hi, casual, ask if they're open to chat
2. After their reply: mention property + ask about timeline/situation
3. Offer: present initial_offer as cash, as-is, quick-close
4. Counter: if rejected, move in 5-10% increments toward max_offer
5. Agreement: once seller accepts, confirm price AND ask for their email
6. Email collected: thank them, confirm contract is being sent
7. Dead lead after 2 follow-ups: signal DEAD_LEAD

Signals (each on its own line, AT THE END):
  EMAIL_COLLECTED:<email>
  DEAL_AGREED:$<price>
  DEAD_LEAD

Output ONLY the SMS text plus any signal line(s). No preamble, no commentary."""


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
    email = None
    sms_lines = []

    for line in text.splitlines():
        s = line.strip()
        if s.startswith("DEAL_AGREED:"):
            try:
                agreed_price = int(s.split("$")[1].replace(",", ""))
            except (IndexError, ValueError):
                pass
        elif s.startswith("EMAIL_COLLECTED:"):
            email = s.split(":", 1)[1].strip()
        elif s == "DEAD_LEAD":
            is_dead = True
        else:
            sms_lines.append(line)

    return {
        "sms": "\n".join(sms_lines).strip(),
        "agreed_price": agreed_price,
        "is_dead": is_dead,
        "email": email,
    }


def _call_claude(messages: List[Dict[str, Any]]) -> str:
    """Despite the name, this now calls OpenAI — kept for caller compatibility.
    gpt-4o-mini is ~3-5x faster than gpt-4o for short SMS replies and still
    plenty smart for a conversational negotiator. max_tokens is small so
    OpenAI returns quickly."""
    full = [{"role": "system", "content": _SYSTEM}, *messages]
    response = _get_client().chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=140,
        messages=full,
    )
    return (response.choices[0].message.content or "").strip()


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
    repos.leads.update_status(lead_id, LeadStatus.OUTREACH)

    message_id = ""
    try:
        result = send_sms(to=contact.phones[0], body=sms_text)
        message_id = result.get("message_id", "")
        logger.info("outreach_sent", lead_id=str(lead_id), message_id=message_id)
        return {"sent": True, "message_id": message_id, "sms": sms_text}
    except Exception as exc:
        logger.warning("outreach.sms_failed", lead_id=str(lead_id), error=str(exc)[:200])
        # Conversation still recorded — investor can use Simulate Reply to drive the demo
        return {"sent": False, "sms": sms_text, "sms_error": str(exc)[:200]}


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
        try:
            send_sms(to=contact.phones[0], body=sms_text)
        except Exception as exc:
            logger.warning("reply.sms_failed", lead_id=str(lead_id), error=str(exc)[:200])

    # Side effect: if the AI signaled a collected email AND we already know
    # the agreed price, fire off the contract email immediately so the demo
    # closes the loop for investors watching.
    email_status = None
    contract_url = None
    target_email = parsed["email"]
    if not target_email:
        # Heuristic: pull email from the inbound text if AI missed it
        m = _EMAIL_RE.search(inbound_body or "")
        if m:
            target_email = m.group(0)

    if target_email and (parsed["agreed_price"] or lead.agreed_price):
        agreed = parsed["agreed_price"] or lead.agreed_price or 0
        # Public sign URL on the deployed Vercel app — works from email on any device
        sign_base = os.getenv("PUBLIC_WEB_URL", "https://web-rho-six-94.vercel.app").rstrip("/")
        contract_url = f"{sign_base}/sign/{lead_id}"
        subject, html = render_contract_email(
            owner_name=contact.owner_name or "there",
            address=lead.address,
            agreed_price=agreed,
            contract_url=contract_url,
        )
        email_status = send_email(target_email, subject, html)
        logger.info("contract.email_sent",
                    lead_id=str(lead_id),
                    to=target_email,
                    delivered=email_status["delivered"])

    if parsed["agreed_price"]:
        repos.leads.update_status(lead_id, LeadStatus.NEGOTIATING, agreed_price=parsed["agreed_price"])
        return {
            "sms_sent": sms_text,
            "status": "deal_agreed",
            "agreed_price": parsed["agreed_price"],
            "email_to": target_email,
            "email_sent": bool(email_status and email_status["delivered"]),
            "email_error": email_status["error"] if email_status else None,
            "contract_url": contract_url,
        }

    if parsed["is_dead"]:
        repos.leads.update_status(lead_id, LeadStatus.DEAD)
        return {"sms_sent": sms_text, "status": "dead_lead"}

    if target_email and email_status:
        # Email received before price — still record + proceed
        repos.leads.update_status(lead_id, LeadStatus.NEGOTIATING)
        return {
            "sms_sent": sms_text,
            "status": "negotiating",
            "email_to": target_email,
            "email_sent": email_status["delivered"],
            "email_error": email_status["error"],
            "contract_url": contract_url,
        }

    repos.leads.update_status(lead_id, LeadStatus.NEGOTIATING)
    return {"sms_sent": sms_text, "status": "negotiating"}
