from __future__ import annotations

from typing import Any, Dict, List, Optional

from openai import OpenAI

from src.core.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    """Nous Research exposes an OpenAI-compatible API, so we reuse the OpenAI SDK
    pointed at the Nous inference endpoint."""
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.nous_api_key, base_url=settings.nous_base_url)
    return _client


_SYSTEM = """You are Hermes, an acquisitions copilot for a real estate wholesaling team.
You help the investor reason about leads, deals, negotiation strategy, and pipeline priorities.
Be concise and direct — answer in 2-4 sentences unless the investor asks for detail.
Be specific with numbers when pipeline data is provided. No greetings, no hedging, no fluff.
If something can't be answered from the data you were given, say so plainly."""


def is_configured() -> bool:
    return bool(settings.nous_api_key)


def chat(history: List[Dict[str, str]], pipeline_facts: Optional[str] = None) -> Dict[str, Any]:
    """Run a conversational turn through the Nous Hermes model.

    history: list of {"role": "user"|"assistant", "content": str}
    pipeline_facts: optional live pipeline snapshot appended to the system prompt.
    """
    if not is_configured():
        return {"reply": "Hermes agent unavailable — set NOUS_API_KEY.", "configured": False}

    system = _SYSTEM if not pipeline_facts else f"{_SYSTEM}\n\nLive pipeline data:\n{pipeline_facts}"
    messages: List[Dict[str, str]] = [{"role": "system", "content": system}]
    for turn in history[-12:]:
        if turn.get("role") in ("user", "assistant") and (turn.get("content") or "").strip():
            messages.append({"role": turn["role"], "content": turn["content"].strip()})

    if len(messages) == 1 or messages[-1]["role"] != "user":
        return {"reply": "Ask me anything — lead triage, offer strategy, what to focus on next.",
                "configured": True}

    try:
        resp = _get_client().chat.completions.create(
            model=settings.nous_model,
            max_tokens=400,
            messages=messages,  # type: ignore[arg-type]
        )
        reply = (resp.choices[0].message.content or "").strip()
    except Exception as exc:
        logger.warning("hermes.chat.error", error=str(exc)[:200])
        return {"reply": "Couldn't reach Hermes right now. Try again in a moment.",
                "configured": True, "error": str(exc)[:200]}

    logger.info("hermes.chat.done", model=settings.nous_model, turns=len(messages))
    return {"reply": reply or "I'm not sure — try asking a different way?", "configured": True}
