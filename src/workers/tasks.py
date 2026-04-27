from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from src.core.database import get_db
from src.core.logging import get_logger
from src.models.buy_box import BuyBox
from src.models.lead import Lead, LeadStatus
from src.repositories import Repositories
from src.services.acquisition_pipeline import run_acquisition_pipeline

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Primary task: run the full 6-step acquisition pipeline
# ---------------------------------------------------------------------------

async def task_run_acquisition(
    ctx: Dict[str, Any],
    buy_box_data: Dict,
    investor_id: Optional[str] = None,
    max_leads: int = 10,
) -> Dict:
    """
    Full 6-step acquisition pipeline as a single ARQ job.

    Steps:
      1. Scrape county records (Browserbase + Claude)
      2. FEMA flood zone check per lead
      3. Property photo analysis per lead
      4. Zillow comps per lead
      5. Offer calculation per lead
      6. Skip trace pursue-leads via Apify
    """
    logger.info("task.acquisition.start", county=buy_box_data.get("county"), state=buy_box_data.get("state"))
    db = get_db()
    buy_box = BuyBox(**buy_box_data)
    inv_id = UUID(investor_id) if investor_id else None
    result = await run_acquisition_pipeline(buy_box, inv_id, db, max_leads=max_leads)
    logger.info(
        "task.acquisition.done",
        scraped=result.get("scraped"),
        saved=result.get("saved"),
        pursue=result.get("pursue"),
        needs_review=result.get("needs_review"),
        enriched=result.get("enriched"),
    )
    return result


# ---------------------------------------------------------------------------
# Legacy single-step tasks (kept for compatibility)
# ---------------------------------------------------------------------------

async def task_ingest_leads(ctx: Dict[str, Any], buy_box_data: Dict, investor_data: Dict) -> Dict:
    """Legacy ingestion-only task — use task_run_acquisition for full pipeline."""
    from src.models.buy_box import Investor
    from src.tools.county_scraper import scrape_county_records

    db = get_db()
    repos = Repositories(db)
    buy_box = BuyBox(**buy_box_data)
    investor = Investor(**investor_data)

    county_raw = await scrape_county_records(buy_box.county, buy_box.state, buy_box.city)
    ingested = 0
    for rec in county_raw:
        address = rec.get("address", "").strip()
        if not address:
            continue
        lead = Lead(
            investor_id=investor.id,
            source="county_records",
            address=address,
            city=rec.get("city") or buy_box.city,
            state=rec.get("state") or buy_box.state,
            sqft=rec.get("sqft"),
            bedrooms=rec.get("bedrooms"),
            apn=rec.get("apn"),
            owner_name=rec.get("owner_name"),
            assessed_value=rec.get("assessed_value"),
            status=LeadStatus.NEW,
        )
        repos.leads.upsert(lead)
        ingested += 1

    logger.info("task.ingest.done", ingested=ingested, county=buy_box.county)
    return {"ingested": ingested}


async def task_skip_trace(ctx: Dict[str, Any], lead_id: str) -> Dict:
    from src.services import pipeline as old_pipeline
    db = get_db()
    repos = Repositories(db)
    return old_pipeline.run_skip_trace(UUID(lead_id), repos)


async def task_analyze_deal(ctx: Dict[str, Any], lead_id: str) -> Dict:
    from src.services import pipeline as old_pipeline
    db = get_db()
    repos = Repositories(db)
    result = old_pipeline.run_deal_analysis(UUID(lead_id), repos)
    if result.get("recommendation") == "pursue":
        await ctx["redis"].enqueue_job("task_outreach", lead_id=lead_id)
    return result


async def task_outreach(ctx: Dict[str, Any], lead_id: str) -> Dict:
    from src.services import pipeline as old_pipeline
    db = get_db()
    repos = Repositories(db)
    return old_pipeline.run_outreach(UUID(lead_id), repos)


async def task_generate_contract(ctx: Dict[str, Any], lead_id: str, agreed_price: int, investor_data: Dict) -> Dict:
    from src.models.buy_box import Investor
    from src.services import pipeline as old_pipeline
    db = get_db()
    repos = Repositories(db)
    investor = Investor(**investor_data)
    return old_pipeline.run_contract(UUID(lead_id), agreed_price, investor, repos)


async def task_handle_sms_reply(ctx: Dict[str, Any], lead_id: str, body: str) -> Dict:
    from src.services import pipeline as old_pipeline
    db = get_db()
    repos = Repositories(db)
    return old_pipeline.handle_sms_reply(UUID(lead_id), body, repos)


async def task_handle_signature_complete(ctx: Dict[str, Any], envelope_id: str) -> Dict:
    from src.services import pipeline as old_pipeline
    db = get_db()
    repos = Repositories(db)
    return old_pipeline.handle_signature_complete(envelope_id, repos)


# ---------------------------------------------------------------------------
# Worker hooks
# ---------------------------------------------------------------------------

async def startup(ctx: Dict[str, Any]) -> None:
    logger.info("worker.startup")


async def shutdown(ctx: Dict[str, Any]) -> None:
    logger.info("worker.shutdown")
