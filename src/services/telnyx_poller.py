"""Polls Telnyx for inbound SMS messages addressed to our number, then routes
each new one through the negotiation agent. Replaces the inbound webhook
when we can't get a valid public URL into Telnyx (their URL validator is
finicky about long tunnel subdomains).

Started by /demo/negotiate so it only runs while a demo is active. Runs for
up to 30 minutes, polling every 4 seconds. Tracks seen message IDs in
memory so we don't double-process.
"""
from __future__ import annotations

import asyncio
import os
from typing import Optional

import httpx

from src.core.database import get_db
from src.core.logging import get_logger
from src.models.contact import Contact
from src.repositories import Repositories
from src.services.pipeline import handle_sms_reply

logger = get_logger(__name__)

import threading

_seen_message_ids: set[str] = set()
_poller_thread: Optional[threading.Thread] = None
_poller_lock = threading.Lock()


def _api_key() -> str:
    return os.getenv("TELENYX_API_KEY", "").strip()


def _our_number() -> str:
    return os.getenv("TELENYX_FROM_NUMBER", "").strip()


async def _fetch_inbound() -> list[dict]:
    """Fetch the most recent inbound messages to our number."""
    if not _api_key():
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.telnyx.com/v2/messages",
                headers={"Authorization": f"Bearer {_api_key()}"},
                params={
                    "filter[direction]": "inbound",
                    "page[size]": 20,
                },
            )
            resp.raise_for_status()
            return resp.json().get("data", [])
    except Exception as exc:
        logger.warning("telnyx_poll.fetch_failed", error=str(exc)[:160])
        return []


def _find_contact_for_phone(repos: Repositories, from_number: str) -> Optional[Contact]:
    """Same fuzzy-match logic as the webhook handler — most-recent contact wins."""
    digits = "".join(ch for ch in from_number if ch.isdigit())
    last10 = digits[-10:] if len(digits) >= 10 else digits
    rows = (
        repos.db.table("contacts")
        .select("lead_id,phones,owner_name,emails,confidence,created_at")
        .order("created_at", desc=True)
        .limit(200)
        .execute().data or []
    )
    for row in rows:
        for p in (row.get("phones") or []):
            p_digits = "".join(ch for ch in str(p) if ch.isdigit())
            if p_digits.endswith(last10):
                return Contact(
                    lead_id=row["lead_id"],
                    owner_name=row.get("owner_name"),
                    phones=row.get("phones") or [],
                    emails=row.get("emails") or [],
                    confidence=row.get("confidence") or 0,
                )
    return None


async def _poll_loop() -> None:
    """Run for ~30 min. On startup, snapshot existing inbound IDs as 'already
    seen' so we only process messages that arrive AFTER the demo started.
    Then poll every 4s for new ones."""
    import time
    end_at = time.time() + 30 * 60
    our_num = _our_number()

    # Seed with existing IDs — we only care about messages received after we start
    seed = await _fetch_inbound()
    for m in seed:
        _seen_message_ids.add(m.get("id", ""))
    logger.info("telnyx_poll.started", seeded=len(_seen_message_ids))

    while time.time() < end_at:
        await asyncio.sleep(4)
        try:
            msgs = await _fetch_inbound()
            for m in msgs:
                msg_id = m.get("id", "")
                if not msg_id or msg_id in _seen_message_ids:
                    continue
                _seen_message_ids.add(msg_id)

                # Filter to messages addressed to OUR number
                to_list = m.get("to", [])
                to_us = any(
                    t.get("phone_number") == our_num for t in to_list
                ) if our_num else True
                if not to_us:
                    continue

                from_number = m.get("from", {}).get("phone_number", "")
                text = m.get("text", "")
                if not from_number or not text.strip():
                    continue

                # Find the most recent demo lead for this phone
                repos = Repositories(get_db())
                contact = _find_contact_for_phone(repos, from_number)
                if not contact:
                    logger.warning("telnyx_poll.unknown_number", from_number=from_number)
                    continue

                # Run the AI synchronously so we don't double-fire on next poll
                try:
                    result = handle_sms_reply(contact.lead_id, text.strip(), repos)
                    logger.info(
                        "telnyx_poll.handled",
                        lead_id=str(contact.lead_id),
                        from_number=from_number,
                        text_preview=text[:40],
                        status=result.get("status"),
                    )
                except Exception as exc:
                    logger.warning("telnyx_poll.handle_failed", error=str(exc)[:200])
        except Exception as exc:
            logger.warning("telnyx_poll.loop_error", error=str(exc)[:200])

    logger.info("telnyx_poll.exited")


def _run_in_thread() -> None:
    """Each thread gets its own asyncio event loop."""
    try:
        asyncio.run(_poll_loop())
    except Exception as exc:
        logger.warning("telnyx_poll.thread_crashed", error=str(exc)[:200])


def ensure_started() -> None:
    """Idempotent — start the poller thread if it isn't already running."""
    global _poller_thread
    with _poller_lock:
        if _poller_thread and _poller_thread.is_alive():
            return
        _poller_thread = threading.Thread(target=_run_in_thread, daemon=True, name="telnyx-poller")
        _poller_thread.start()
        logger.info("telnyx_poll.thread_started")
