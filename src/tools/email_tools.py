from __future__ import annotations

import os
from typing import Optional

import httpx

from src.core.logging import get_logger

logger = get_logger(__name__)

_RESEND_BASE = "https://api.resend.com/emails"


def send_email(to: str, subject: str, html: str, from_addr: Optional[str] = None) -> dict:
    """Send an email via Resend. If RESEND_API_KEY is unset, returns a stub
    indicating "would have sent" — useful for demos before the key is added.

    Returns: { "delivered": bool, "id": str, "error": Optional[str] }
    """
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = from_addr or os.getenv("RESEND_FROM", "Birddogs <onboarding@resend.dev>").strip()

    if not api_key:
        logger.info("email.would_send", to=to, subject=subject)
        return {"delivered": False, "id": "", "error": "RESEND_API_KEY not configured"}

    try:
        resp = httpx.post(
            _RESEND_BASE,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": sender,
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=15,
        )
        if resp.status_code >= 400:
            return {"delivered": False, "id": "", "error": f"Resend {resp.status_code}: {resp.text[:200]}"}
        data = resp.json()
        return {"delivered": True, "id": data.get("id", ""), "error": None}
    except Exception as exc:
        return {"delivered": False, "id": "", "error": str(exc)[:200]}


def render_contract_email(owner_name: str, address: str, agreed_price: int, contract_url: str) -> tuple[str, str]:
    """Build a (subject, html) tuple for the offer-accepted contract email."""
    subject = f"Birddogs — Contract for {address} ($${agreed_price:,})"
    html = f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#2563eb,#06b6d4,#10b981);border-radius:16px;padding:32px;color:#fff;text-align:center;">
      <div style="font-size:32px;margin-bottom:4px;">🎯</div>
      <h1 style="margin:0;font-size:22px;">Deal locked in</h1>
      <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">Cash offer accepted on {address}</p>
    </div>
    <div style="background:#fff;border-radius:16px;padding:28px;margin-top:16px;box-shadow:0 4px 24px rgba(0,0,0,0.04);">
      <p style="margin:0 0 12px;color:#27272a;">Hi {owner_name},</p>
      <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6;">
        Great chatting with you. Here's the purchase agreement for <strong>{address}</strong> at the
        agreed price of <strong style="color:#10b981;">${agreed_price:,}</strong>, cash, 14-day close,
        no inspections, no fees.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:8px 0;color:#71717a;">Property</td><td style="padding:8px 0;text-align:right;color:#18181b;font-weight:600;">{address}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a;">Agreed Price</td><td style="padding:8px 0;text-align:right;color:#10b981;font-weight:700;font-size:18px;">${agreed_price:,}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a;">Close</td><td style="padding:8px 0;text-align:right;color:#18181b;font-weight:600;">14 days, cash</td></tr>
      </table>
      <a href="{contract_url}" style="display:block;text-align:center;background:linear-gradient(135deg,#2563eb,#10b981);color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:600;margin-top:8px;">
        Review & Sign Contract →
      </a>
      <p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;text-align:center;">
        Sent by Birddogs on behalf of your buyer. Reply to this email or text back with any questions.
      </p>
    </div>
  </div>
</body></html>"""
    return subject, html
