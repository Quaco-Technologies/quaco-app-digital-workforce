from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel

from src.api.deps import get_repos
from src.api.middleware.auth import get_investor_id
from src.models.buy_box import BuyBox, Investor
from src.models.lead import Lead, LeadStatus
from src.repositories import Repositories
from src.core.database import get_db
from src.core.logging import get_logger


class PipelineRunRequest(BaseModel):
    city: str
    state: str
    county: str
    min_price: int = 0
    max_price: int = 1_000_000
    min_beds: int = 2
    property_types: List[str] = ["single_family"]
    investor_name: str
    investor_email: str

router = APIRouter(prefix="/pipeline", tags=["pipeline"])
logger = get_logger(__name__)


async def _dispatch(
    request: Request,
    bg: BackgroundTasks,
    task_name: str,
    sync_fn,
    **kwargs,
) -> str:
    """Use Redis queue when available, else run as a background task."""
    if request.app.state.redis:
        await request.app.state.redis.enqueue_job(task_name, **kwargs)
        return "queued"
    else:
        bg.add_task(sync_fn, **kwargs)
        return "running"


def _run_ingestion_sync(buy_box_data: Dict, investor_data: Dict) -> None:
    import asyncio
    from src.tools.county_scraper import scrape_county_records
    from src.services import pipeline as pipeline_service
    repos = Repositories(get_db())
    buy_box = BuyBox(**buy_box_data)
    investor = Investor(**investor_data)

    try:
        county_raw = asyncio.run(scrape_county_records(buy_box.county, buy_box.state, buy_box.city))
    except Exception:
        county_raw = []

    for rec in county_raw:
        address = rec.get("address", "").strip()
        if not address:
            continue

        assessed = rec.get("assessed_value")
        if assessed:
            try:
                assessed_int = int(float(str(assessed)))
                if buy_box.max_price and assessed_int > buy_box.max_price:
                    continue
                if buy_box.min_price and assessed_int < buy_box.min_price:
                    continue
            except (ValueError, TypeError):
                pass

        beds = rec.get("bedrooms")
        if beds and buy_box.min_beds:
            try:
                if int(beds) < buy_box.min_beds:
                    continue
            except (ValueError, TypeError):
                pass

        prop_type = (rec.get("property_type") or "").lower().replace(" ", "_")
        if buy_box.property_types and prop_type and prop_type not in buy_box.property_types:
            continue

        lead = Lead(
            investor_id=investor.id,
            source="county_records",
            address=address,
            city=rec.get("city") or buy_box.city,
            state=rec.get("state") or buy_box.state,
            price=assessed,
            bedrooms=rec.get("bedrooms"),
            sqft=rec.get("sqft"),
            status=LeadStatus.NEW,
        )
        saved = repos.leads.upsert(lead)
        # Run skip trace inline when no Redis
        pipeline_service.run_skip_trace(saved.id, repos)


@router.post("/run", status_code=202)
async def run_pipeline(
    body: PipelineRunRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    investor_id: UUID = Depends(get_investor_id),
) -> dict:
    investor = Investor(id=investor_id, name=body.investor_name, email=body.investor_email)
    buy_box = BuyBox(
        investor_id=investor_id,
        city=body.city,
        state=body.state,
        county=body.county,
        min_price=body.min_price,
        max_price=body.max_price,
        min_beds=body.min_beds,
        property_types=body.property_types,
    )

    mode = await _dispatch(
        request, background_tasks,
        "task_ingest_leads",
        _run_ingestion_sync,
        buy_box_data=buy_box.model_dump(mode="json"),
        investor_data=investor.model_dump(mode="json"),
    )

    return {
        "status": mode,
        "buy_box": f"{buy_box.city}, {buy_box.state}",
        "investor_id": str(investor_id),
    }


@router.post("/contract/{lead_id}", status_code=202)
async def trigger_contract(
    lead_id: UUID,
    agreed_price: int,
    investor_name: str,
    investor_email: str,
    request: Request,
    investor_id: UUID = Depends(get_investor_id),
) -> dict:
    investor = Investor(id=investor_id, name=investor_name, email=investor_email)

    await _enqueue(
        request,
        "task_generate_contract",
        lead_id=str(lead_id),
        agreed_price=agreed_price,
        investor_data=investor.model_dump(mode="json"),
    )
    return {"status": "queued", "lead_id": str(lead_id)}
