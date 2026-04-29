from __future__ import annotations

"""Twilio SMS — replaces Telnyx for the investor demo.

Same `send_sms` signature as telenyx_tools.py so callers don't have to know
which provider is in use. Reads creds from env at call time so the value
can be flipped without restarting.
"""

import os
from typing import Optional

import httpx

from src.core.logging import get_logger

logger = get_logger(__name__)

_BASE = "https://api.twilio.com/2010-04-01"


def _creds() -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip() or None
    token = os.getenv("TWILIO_AUTH_TOKEN", "").strip() or None
    sender = os.getenv("TWILIO_FROM_NUMBER", "").strip() or None
    test_to = os.getenv("TWILIO_TEST_RECIPIENT", "").strip() or None
    return sid, token, sender, test_to


def send_sms(to: str, body: str, from_number: Optional[str] = None) -> dict:
    """Send an SMS via Twilio. Raises with the actual Twilio error JSON on failure."""
    sid, token, sender, test_to = _creds()
    if not sid or not token or not sender:
        raise RuntimeError("Twilio not configured — TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER required")

    recipient = test_to or to
    payload = {
        "To": recipient,
        "From": from_number or sender,
        "Body": body,
    }
    resp = httpx.post(
        f"{_BASE}/Accounts/{sid}/Messages.json",
        data=payload,
        auth=(sid, token),
        timeout=15,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Twilio {resp.status_code}: {resp.text}")
    data = resp.json()
    return {
        "message_id": data.get("sid", ""),
        "to": data.get("to", recipient),
        "status": data.get("status", ""),
        "cost": data.get("price", ""),
    }
