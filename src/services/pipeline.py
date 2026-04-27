from __future__ import annotations

from typing import Any, Dict
from uuid import UUID

from src.core.logging import get_logger
from src.models.buy_box import BuyBox, Investor
from src.models.deal import DealRecommendation
from src.models.lead import LeadStatus
from src.repositories import Repositories
from src.agents import contract, deal_analysis, lead_ingestion, negotiation, skip_trace

logger = get_logger(__name__)


def run_ingestion(buy_box: BuyBox, investor: Investor, repos: Repositories) -> Dict[str, Any]:
    """Stage 1: Scrape leads and persist them."""
    logger.info("pipeline.ingestion.start", city=buy_box.city, state=buy_box.state)
    result = lead_ingestion.run(buy_box, repos, investor.id)  # type: ignore[arg-type]
    logger.info("pipeline.ingestion.done", ingested=result.get("ingested", 0))
    return result


def run_skip_trace(lead_id: UUID, repos: Repositories) -> Dict[str, Any]:
    """Stage 2: Find owner contact info for a single lead."""
    logger.info("pipeline.skip_trace.start", lead_id=str(lead_id))
    result = skip_trace.run(lead_id, repos)
    logger.info("pipeline.skip_trace.done", lead_id=str(lead_id), phones=result.get("phones", []))
    return result


def run_deal_analysis(lead_id: UUID, repos: Repositories) -> Dict[str, Any]:
    """Stage 3: Analyze deal for a single lead."""
    logger.info("pipeline.analysis.start", lead_id=str(lead_id))
    result = deal_analysis.run(lead_id, repos)
    logger.info("pipeline.analysis.done", lead_id=str(lead_id), recommendation=result.get("recommendation"))
    return result


def run_outreach(lead_id: UUID, repos: Repositories) -> Dict[str, Any]:
    """Stage 4: Send first SMS to owner."""
    logger.info("pipeline.outreach.start", lead_id=str(lead_id))
    result = negotiation.start_outreach(lead_id, repos)
    logger.info("pipeline.outreach.done", lead_id=str(lead_id))
    return result


def handle_sms_reply(lead_id: UUID, body: str, repos: Repositories) -> Dict[str, Any]:
    """Webhook handler: process inbound SMS from owner."""
    result = negotiation.handle_reply(lead_id, body, repos)
    status = result.get("status")

    if status == "deal_agreed":
        agreed_price = result.get("agreed_price", 0)
        logger.info("pipeline.deal_agreed", lead_id=str(lead_id), price=agreed_price)

    return result


def run_contract(
    lead_id: UUID,
    agreed_price: int,
    investor: Investor,
    repos: Repositories,
) -> Dict[str, Any]:
    """Stage 5: Generate and send contract for signature."""
    logger.info("pipeline.contract.start", lead_id=str(lead_id), price=agreed_price)
    result = contract.run(lead_id, agreed_price, investor.name, investor.email, repos)
    logger.info("pipeline.contract.sent", lead_id=str(lead_id), envelope=result.get("envelope_id"))
    return result


def handle_signature_complete(envelope_id: str, repos: Repositories) -> Dict[str, Any]:
    """Webhook handler: Lumin signature completion event."""
    contract_record = repos.contracts.get_by_envelope(envelope_id)
    if not contract_record:
        logger.warning("pipeline.signature.unknown_envelope", envelope_id=envelope_id)
        return {"error": "envelope not found"}

    result = contract.check_completion(contract_record.lead_id, envelope_id, repos)
    logger.info("pipeline.signature.complete", lead_id=str(contract_record.lead_id))
    return result
