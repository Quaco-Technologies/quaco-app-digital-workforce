from __future__ import annotations

import json
from typing import Any, Dict, List
from uuid import UUID

from anthropic import Anthropic

from src.core.config import settings
from src.core.logging import get_logger
from src.models.buy_box import BuyBox
from src.models.lead import Lead, LeadStatus
from src.repositories import Repositories
from src.tools.apify_tools import (
    get_tax_delinquent_list,
    scrape_craigslist_realestate,
    scrape_zillow_fsbo,
)

logger = get_logger(__name__)
_client = Anthropic()

_SYSTEM = """You are the Lead Ingestion Agent for a real estate acquisition platform.

Your job:
1. Use the available tools to scrape property leads matching the investor's buy box.
2. Filter results to those plausibly matching the buy box (price range, property type, location).
3. Call upsert_lead for every qualifying lead.
4. Return JSON: {"ingested": N, "skipped": M}

Never fabricate data. Only call upsert_lead with real scraped records."""

_TOOLS = [
    {
        "name": "scrape_zillow_fsbo",
        "description": "Scrape FSBO listings from Zillow.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string"},
                "state": {"type": "string"},
                "max_results": {"type": "integer", "default": 50},
            },
            "required": ["city", "state"],
        },
    },
    {
        "name": "scrape_craigslist_realestate",
        "description": "Scrape Craigslist real estate FSBO listings.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string"},
                "max_results": {"type": "integer", "default": 50},
            },
            "required": ["city"],
        },
    },
    {
        "name": "get_tax_delinquent_list",
        "description": "Fetch tax-delinquent property list from county records.",
        "input_schema": {
            "type": "object",
            "properties": {
                "county": {"type": "string"},
                "state": {"type": "string"},
                "max_results": {"type": "integer", "default": 100},
            },
            "required": ["county", "state"],
        },
    },
    {
        "name": "upsert_lead",
        "description": "Persist a qualifying lead to the database.",
        "input_schema": {
            "type": "object",
            "properties": {
                "source": {"type": "string"},
                "address": {"type": "string"},
                "city": {"type": "string"},
                "state": {"type": "string"},
                "zip": {"type": "string"},
                "price": {"type": "integer"},
                "bedrooms": {"type": "integer"},
                "bathrooms": {"type": "number"},
                "sqft": {"type": "integer"},
                "listing_url": {"type": "string"},
                "days_on_market": {"type": "integer"},
                "description": {"type": "string"},
            },
            "required": ["source", "address"],
        },
    },
]


def run(buy_box: BuyBox, repos: Repositories, investor_id: UUID) -> Dict[str, Any]:
    def _upsert_lead(**kwargs: Any) -> Dict[str, Any]:
        lead = Lead(investor_id=investor_id, **kwargs)
        saved = repos.leads.upsert(lead)
        return {"id": str(saved.id), "address": saved.address}

    tool_map = {
        "scrape_zillow_fsbo": scrape_zillow_fsbo,
        "scrape_craigslist_realestate": scrape_craigslist_realestate,
        "get_tax_delinquent_list": get_tax_delinquent_list,
        "upsert_lead": _upsert_lead,
    }

    user_prompt = (
        f"Find and ingest leads matching this buy box:\n{buy_box.model_dump_json(indent=2)}\n\n"
        "Scrape all relevant sources, filter to matches, and upsert each qualifying lead."
    )
    messages: List[Dict[str, Any]] = [{"role": "user", "content": user_prompt}]

    with _client.messages.stream(
        model=settings.model,
        max_tokens=8096,
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
            max_tokens=8096,
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

    return {"ingested": 0, "error": "no response"}
