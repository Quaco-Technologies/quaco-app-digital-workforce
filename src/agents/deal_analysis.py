from __future__ import annotations

import json
from typing import Any, Dict, List
from uuid import UUID

from anthropic import Anthropic

from src.core.config import settings
from src.core.logging import get_logger
from src.models.deal import Deal, DealRecommendation
from src.models.lead import LeadStatus
from src.repositories import Repositories
from src.tools.apify_tools import get_comparable_sales

logger = get_logger(__name__)
_client = Anthropic()

_SYSTEM = """You are the Deal Analysis Agent for a real estate investment platform.

Methodology:
- Pull comps: similar sqft/beds within ~1 mile, sold in last 90 days.
- ARV = median comp sold price, adjusted for subject property.
- Repair estimate: $20/sqft default (light: $15-25, heavy: $30-50).
- Max Offer = ARV × 0.70 − Repair Costs
- Initial Offer = Max Offer × 0.85
- Deal Score (0.0–1.0): consider equity spread, DOM, motivated seller signals.
- Recommendation: pursue ≥0.65, watch 0.40-0.64, skip <0.40.

Call save_deal, then return JSON with all fields."""

_TOOLS = [
    {
        "name": "get_comparable_sales",
        "description": "Pull recent comparable sold properties.",
        "input_schema": {
            "type": "object",
            "properties": {
                "address": {"type": "string"},
                "city": {"type": "string"},
                "state": {"type": "string"},
                "radius_miles": {"type": "number", "default": 1.0},
            },
            "required": ["address", "city", "state"],
        },
    },
    {
        "name": "save_deal",
        "description": "Persist deal analysis results.",
        "input_schema": {
            "type": "object",
            "properties": {
                "arv": {"type": "integer"},
                "repair_estimate": {"type": "integer"},
                "max_offer": {"type": "integer"},
                "initial_offer": {"type": "integer"},
                "deal_score": {"type": "number"},
                "recommendation": {"type": "string", "enum": ["pursue", "watch", "skip"]},
                "comps": {"type": "array"},
            },
            "required": ["arv", "repair_estimate", "max_offer", "initial_offer", "deal_score", "recommendation"],
        },
    },
]


def run(lead_id: UUID, repos: Repositories) -> Dict[str, Any]:
    lead = repos.leads.get(lead_id)
    if not lead:
        return {"error": f"lead {lead_id} not found"}

    def _save_deal(**kwargs: Any) -> Dict[str, Any]:
        recommendation = DealRecommendation(kwargs.get("recommendation", "skip"))
        deal = Deal(lead_id=lead_id, recommendation=recommendation, **{
            k: v for k, v in kwargs.items() if k != "recommendation"
        })
        repos.deals.upsert(deal)
        repos.leads.update_status(lead_id, LeadStatus.ANALYZED)
        return {"saved": True}

    tool_map = {
        "get_comparable_sales": get_comparable_sales,
        "save_deal": _save_deal,
    }

    user_prompt = (
        f"Analyze this deal.\n\n"
        f"Lead ID: {lead_id}\n"
        f"Address: {lead.address}, {lead.city}, {lead.state}\n"
        f"Asking Price: ${(lead.price or 0):,}\n"
        f"Beds: {lead.bedrooms} | Baths: {lead.bathrooms} | Sqft: {lead.sqft}\n"
        f"Days on Market: {lead.days_on_market}\n"
        f"Description: {lead.description or ''}\n\n"
        "Pull comps, calculate ARV/repair/offers, score it, save, and return JSON."
    )
    messages: List[Dict[str, Any]] = [{"role": "user", "content": user_prompt}]

    with _client.messages.stream(
        model=settings.model,
        max_tokens=6144,
        thinking={"type": "adaptive"},
        system=_SYSTEM,
        tools=_TOOLS,  # type: ignore[arg-type]
        messages=messages,
    ) as stream:
        response = stream.get_final_message()

    while response.stop_reason == "tool_use":
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                fn = tool_map[block.name]
                result = fn(**block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                })

        messages = [
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": response.content},
            {"role": "user", "content": tool_results},
        ]

        with _client.messages.stream(
            model=settings.model,
            max_tokens=6144,
            thinking={"type": "adaptive"},
            system=_SYSTEM,
            tools=_TOOLS,  # type: ignore[arg-type]
            messages=messages,
        ) as stream:
            response = stream.get_final_message()

    for block in response.content:
        if hasattr(block, "text"):
            try:
                start = block.text.find("{")
                end = block.text.rfind("}") + 1
                if start >= 0 and end > start:
                    return json.loads(block.text[start:end])
            except json.JSONDecodeError:
                pass

    return {"lead_id": str(lead_id), "error": "no response"}
