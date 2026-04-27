from __future__ import annotations

import json
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List
from uuid import UUID

from anthropic import Anthropic

from src.core.config import settings
from src.core.logging import get_logger
from src.models.contract import Contract, ContractStatus
from src.models.lead import LeadStatus
from src.repositories import Repositories
from src.tools.lumin_tools import (
    create_signature_request,
    get_signature_status,
    upload_contract,
)

logger = get_logger(__name__)
_client = Anthropic()

_SYSTEM = """You are the Contract Agent for a real estate acquisition platform.

Steps:
1. Write a complete real estate purchase agreement as plain text.
2. Call upload_contract_text with the text to get a document_id.
3. Call send_for_signature with document_id and signers.
4. Call save_contract to persist the envelope.
5. Return JSON: {"envelope_id": "...", "agreed_price": N, "signing_urls": [...]}

The agreement must include:
- Parties (buyer/seller), property address
- Purchase price and earnest money (1% of price, min $500)
- Closing date (30 days from effective date)
- As-is clause
- Assignment clause (buyer may assign without seller consent)
- Default remedies
Keep it concise but complete for a wholesale deal."""

_TOOLS = [
    {
        "name": "upload_contract_text",
        "description": "Convert purchase agreement text to PDF and upload to Lumin.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agreement_text": {"type": "string"},
                "filename": {"type": "string"},
            },
            "required": ["agreement_text", "filename"],
        },
    },
    {
        "name": "send_for_signature",
        "description": "Create a Lumin signature request for the uploaded document.",
        "input_schema": {
            "type": "object",
            "properties": {
                "document_id": {"type": "string"},
                "signers": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "email": {"type": "string"},
                            "role": {"type": "string"},
                        },
                    },
                },
                "subject": {"type": "string"},
                "message": {"type": "string"},
            },
            "required": ["document_id", "signers"],
        },
    },
    {
        "name": "save_contract",
        "description": "Persist envelope ID and agreed price to the database.",
        "input_schema": {
            "type": "object",
            "properties": {
                "envelope_id": {"type": "string"},
                "agreed_price": {"type": "integer"},
            },
            "required": ["envelope_id", "agreed_price"],
        },
    },
]


def _render_pdf(text: str, filename: str) -> Dict[str, Any]:
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

        buf = BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=letter,
                                leftMargin=inch, rightMargin=inch,
                                topMargin=inch, bottomMargin=inch)
        styles = getSampleStyleSheet()
        story = []
        for line in text.splitlines():
            if line.strip():
                story.append(Paragraph(
                    line.replace("&", "&amp;").replace("<", "&lt;"),
                    styles["Normal"]
                ))
            story.append(Spacer(1, 6))
        doc.build(story)
        pdf_bytes = buf.getvalue()
    except ImportError:
        pdf_bytes = text.encode("utf-8")

    return upload_contract(pdf_bytes, filename)


def run(
    lead_id: UUID,
    agreed_price: int,
    investor_name: str,
    investor_email: str,
    repos: Repositories,
) -> Dict[str, Any]:
    lead = repos.leads.get(lead_id)
    contact = repos.contacts.get(lead_id)
    if not lead or not contact:
        return {"error": "missing lead or contact"}

    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    earnest = max(500, int(agreed_price * 0.01))
    seller_email = contact.emails[0] if contact.emails else ""

    def _upload(agreement_text: str, filename: str) -> Dict[str, Any]:
        return _render_pdf(agreement_text, filename)

    def _send(document_id: str, signers: List[Dict[str, Any]],
              subject: str = "Purchase Agreement — Action Required",
              message: str = "Please review and sign the attached purchase agreement.") -> Dict[str, Any]:
        return create_signature_request(document_id, signers, message, subject)

    def _save(envelope_id: str, agreed_price: int) -> Dict[str, Any]:
        contract = Contract(
            lead_id=lead_id,
            envelope_id=envelope_id,
            agreed_price=agreed_price,
            status=ContractStatus.SENT,
        )
        repos.contracts.upsert(contract)
        repos.leads.update_status(lead_id, LeadStatus.UNDER_CONTRACT)
        return {"saved": True}

    tool_map = {
        "upload_contract_text": _upload,
        "send_for_signature": _send,
        "save_contract": _save,
    }

    user_prompt = (
        f"Generate and send a purchase agreement for signature.\n\n"
        f"Property: {lead.address}, {lead.city}, {lead.state} {lead.zip or ''}\n"
        f"Seller: {contact.owner_name} | Email: {seller_email}\n"
        f"Buyer: {investor_name} | Email: {investor_email}\n"
        f"Purchase Price: ${agreed_price:,}\n"
        f"Earnest Money: ${earnest:,}\n"
        f"Effective Date: {today}\n\n"
        "Write the agreement, upload as 'purchase_agreement.pdf', send for signatures, save, return JSON."
    )
    messages: List[Dict[str, Any]] = [{"role": "user", "content": user_prompt}]

    with _client.messages.stream(
        model=settings.model,
        max_tokens=8192,
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
            max_tokens=8192,
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


def check_completion(lead_id: UUID, envelope_id: str, repos: Repositories) -> Dict[str, Any]:
    status = get_signature_status(envelope_id)
    if status.get("status") == "completed":
        repos.contracts.update_status(
            lead_id, ContractStatus.COMPLETED, completed_at=status.get("completed_at")
        )
        repos.leads.update_status(lead_id, LeadStatus.CLOSED)
    return status
