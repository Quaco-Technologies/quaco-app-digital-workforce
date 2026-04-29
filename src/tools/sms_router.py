from __future__ import annotations

"""SMS router — picks Twilio if configured, falls back to Telnyx.

Lets us flip providers via env without touching callers."""

import os

from src.tools import telenyx_tools, twilio_tools


def send_sms(to: str, body: str, from_number: str | None = None) -> dict:
    if os.getenv("TWILIO_ACCOUNT_SID", "").strip():
        return twilio_tools.send_sms(to, body, from_number)
    return telenyx_tools.send_sms(to, body, from_number)
