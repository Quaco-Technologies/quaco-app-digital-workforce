from __future__ import annotations
"""
Telenyx SMS tools for outbound messages and inbound webhook parsing.
All functions return plain dicts suitable as tool results for Claude.
from __future__ import annotations
"""

import httpx

from src.core.config import settings

_BASE = "https://api.telnyx.com/v2"
_HEADERS = {
    "Authorization": f"Bearer {settings.telenyx_api_key}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


def send_sms(to: str, body: str, from_number: str | None = None) -> dict:
    """Send an SMS message via Telenyx. Returns message ID and status."""
    # Test-mode override: redirect all SMS to a single number
    recipient = settings.telenyx_test_recipient or to
    payload = {
        "from": from_number or settings.telenyx_from_number,
        "to": recipient,
        "text": body,
    }
    resp = httpx.post(f"{_BASE}/messages", json=payload, headers=_HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json().get("data", {})
    return {
        "message_id": data.get("id", ""),
        "to": data.get("to", [{}])[0].get("phone_number", to) if isinstance(data.get("to"), list) else to,
        "status": data.get("to", [{}])[0].get("status", "") if isinstance(data.get("to"), list) else "",
        "cost": data.get("cost", {}).get("amount", ""),
    }


def parse_inbound_sms(webhook_payload: dict) -> dict:
    """
    Extract relevant fields from a Telenyx inbound SMS webhook payload.
    Call this inside the FastAPI webhook handler before passing to the negotiation agent.
    """
    data = webhook_payload.get("data", {})
    payload = data.get("payload", {})
    return {
        "message_id": payload.get("id", ""),
        "from_number": payload.get("from", {}).get("phone_number", ""),
        "to_number": payload.get("to", [{}])[0].get("phone_number", "") if isinstance(payload.get("to"), list) else "",
        "body": payload.get("text", ""),
        "received_at": payload.get("received_at", ""),
    }


def get_message_status(message_id: str) -> dict:
    """Poll Telenyx for the delivery status of a sent message."""
    resp = httpx.get(f"{_BASE}/messages/{message_id}", headers=_HEADERS, timeout=10)
    resp.raise_for_status()
    data = resp.json().get("data", {})
    to_list = data.get("to", [])
    status = to_list[0].get("status", "") if to_list else ""
    return {
        "message_id": message_id,
        "status": status,
        "errors": to_list[0].get("errors", []) if to_list else [],
    }
