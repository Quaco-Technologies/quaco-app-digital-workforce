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
    investor_name: Optional[str] = None
    investor_email: Optional[str] = None

router = APIRouter(prefix="/pipeline", tags=["pipeline"])
logger = get_logger(__name__)


@router.post("/run", status_code=202)
async def run_pipeline(
    body: PipelineRunRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    investor_id: UUID = Depends(get_investor_id),
) -> dict:
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

    job_id = None
    if request.app.state.redis:
        job = await request.app.state.redis.enqueue_job(
            "task_run_acquisition",
            buy_box_data=buy_box.model_dump(mode="json"),
            investor_id=str(investor_id),
            max_leads=100,
        )
        job_id = job.job_id if job else None
        mode = "queued"
        logger.info(
            "pipeline.queued",
            county=buy_box.county,
            state=buy_box.state,
            job_id=job_id,
            investor_id=str(investor_id),
        )
    else:
        # No Redis — run as async background task in the same event loop
        background_tasks.add_task(
            _run_acquisition_async,
            buy_box_data=buy_box.model_dump(mode="json"),
            investor_id=str(investor_id),
            max_leads=5,
        )
        mode = "running"
        logger.info("pipeline.background", county=buy_box.county, state=buy_box.state)

    return {
        "status": mode,
        "job_id": job_id,
        "buy_box": f"{buy_box.city}, {buy_box.state}",
        "investor_id": str(investor_id),
    }


@router.get("/status/{job_id}")
async def pipeline_status(job_id: str, request: Request) -> dict:
    """Poll ARQ job status. Returns status + result when complete."""
    redis = request.app.state.redis
    if not redis:
        return {"status": "unknown", "result": None}

    try:
        from arq.jobs import Job, JobStatus
        job = Job(job_id, redis=redis)
        status = await job.status()
        status_str = status.value if hasattr(status, "value") else str(status)

        result = None
        if status_str == "complete":
            try:
                result = await job.result(timeout=0.5)
            except Exception:
                pass

        return {"status": status_str, "result": result}
    except Exception as exc:
        logger.warning("pipeline.status_error", job_id=job_id, error=str(exc))
        return {"status": "unknown", "result": None}


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

    if request.app.state.redis:
        await request.app.state.redis.enqueue_job(
            "task_generate_contract",
            lead_id=str(lead_id),
            agreed_price=agreed_price,
            investor_data=investor.model_dump(mode="json"),
        )
    return {"status": "queued", "lead_id": str(lead_id)}


async def _run_acquisition_async(buy_box_data: Dict, investor_id: str, max_leads: int = 5) -> None:
    from src.services.acquisition_pipeline import run_acquisition_pipeline
    db = get_db()
    buy_box = BuyBox(**buy_box_data)
    inv_id = UUID(investor_id) if investor_id else None
    await run_acquisition_pipeline(buy_box, inv_id, db, max_leads=max_leads)
