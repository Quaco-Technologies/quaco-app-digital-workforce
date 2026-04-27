from __future__ import annotations

import json
from typing import Any, Dict, List
from uuid import UUID

from anthropic import Anthropic

from src.core.config import settings
from src.core.logging import get_logger
from src.models.contact import Contact
from src.models.lead import LeadStatus
from src.repositories import Repositories
from src.tools.apify_tools import enrich_contact

logger = get_logger(__name__)
_client = Anthropic()

_SYSTEM = """You are the Skip Trace Agent for a real estate acquisition platform.

Steps:
1. Call enrich_contact with the property address (and owner name if available).
   The actor will find the owner name, phone numbers, and email.
2. If confidence is below 0.3 and an owner name was found, retry once with the name.
3. Call save_contact with the best result you found.
4. Return JSON: {"owner_name": "...", "phones": [...], "emails": [...], "confidence": 0.0}

Never invent contact data. If nothing is found, save empty arrays and confidence 0."""

_TOOLS = [
    {
        "name": "enrich_contact",
        "description": "Skip trace a property — finds owner name, phones, and email from address alone.",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_address": {"type": "string", "description": "Full property address including city and state"},
                "owner_name": {"type": "string", "description": "Owner name if already known — improves accuracy"},
            },
            "required": ["property_address"],
        },
    },
    {
        "name": "save_contact",
        "description": "Persist the skip trace result for this lead.",
        "input_schema": {
            "type": "object",
            "properties": {
                "owner_name": {"type": "string"},
                "phones": {"type": "array", "items": {"type": "string"}},
                "emails": {"type": "array", "items": {"type": "string"}},
                "mailing_address": {"type": "string"},
                "confidence": {"type": "number"},
            },
            "required": ["owner_name", "phones", "emails", "confidence"],
        },
    },
]


def run(lead_id: UUID, repos: Repositories) -> Dict[str, Any]:
    lead = repos.leads.get(lead_id)
    if not lead:
        return {"error": f"lead {lead_id} not found"}

    full_address = f"{lead.address}, {lead.city}, {lead.state}"

    def _save_contact(**kwargs: Any) -> Dict[str, Any]:
        contact = Contact(lead_id=lead_id, **kwargs)
        repos.contacts.upsert(contact)
        repos.leads.update_status(lead_id, LeadStatus.SKIP_TRACED)
        return {"saved": True}

    tool_map = {
        "enrich_contact": enrich_contact,
        "save_contact": _save_contact,
    }

    user_prompt = (
        f"Skip trace this property and find the owner's contact info.\n\n"
        f"Lead ID: {lead_id}\n"
        f"Address: {full_address}\n\n"
        "Use enrich_contact with the full address. If confidence is low, retry with any "
        "owner name found. Save the best result and return JSON summary."
    )
    messages: List[Dict[str, Any]] = [{"role": "user", "content": user_prompt}]

    with _client.messages.stream(
        model=settings.model,
        max_tokens=4096,
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
            max_tokens=4096,
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
