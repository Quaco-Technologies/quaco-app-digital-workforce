from __future__ import annotations

import asyncio
import time
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.deps import get_repos
from src.api.middleware.auth import get_investor_id
from src.core.config import settings
from src.core.logging import get_logger
from src.repositories import Repositories
from src.tools.telenyx_tools import send_sms

logger = get_logger(__name__)

router = APIRouter(prefix="/demo", tags=["demo"])


class DemoStartRequest(BaseModel):
    recipient_phone: Optional[str] = None  # if not provided, uses TELENYX_TEST_RECIPIENT


class DemoStartResponse(BaseModel):
    demo_id: str
    recipient_phone: str
    message: str


class DemoStage(BaseModel):
    name: str
    label: str
    status: str  # "pending" | "running" | "complete"
    detail: str
    started_at: Optional[float] = None
    completed_at: Optional[float] = None


class DemoState(BaseModel):
    demo_id: str
    started_at: float
    recipient_phone: str
    stages: list[DemoStage]
    sms_sent: list[dict]
    contract_url: Optional[str] = None
    is_complete: bool


# In-memory demo store. Demos are short-lived and only used for sales pitches —
# durability isn't worth the schema cost.
_DEMOS: dict[str, DemoState] = {}


def _new_demo_state(demo_id: str, phone: str) -> DemoState:
    return DemoState(
        demo_id=demo_id,
        started_at=time.time(),
        recipient_phone=phone,
        stages=[
            DemoStage(name="scrape",     label="Scraping county records",   status="pending", detail="Pulling off-market property records from Fulton County, GA"),
            DemoStage(name="skip_trace", label="Skip tracing owners",       status="pending", detail="Looking up owner phones and emails"),
            DemoStage(name="analyze",    label="Calculating offers",        status="pending", detail="Computing ARV and 70% offer prices"),
            DemoStage(name="outreach",   label="Sending opening SMS",       status="pending", detail="AI agent reaches out to property owner"),
            DemoStage(name="negotiate",  label="Negotiating",               status="pending", detail="Owner replies, AI counters and reaches a deal"),
            DemoStage(name="contract",   label="Sending contract",          status="pending", detail="Generating purchase agreement and texting it over"),
        ],
        sms_sent=[],
        contract_url=None,
        is_complete=False,
    )


def _send_demo_sms(state: DemoState, body: str, kind: str) -> None:
    """Try to send a real SMS via Telenyx; record locally regardless."""
    sent_ok = False
    err: Optional[str] = None
    if settings.telenyx_api_key and settings.telenyx_from_number:
        try:
            send_sms(to=state.recipient_phone, body=body)
            sent_ok = True
        except Exception as exc:  # pragma: no cover
            err = str(exc)[:160]
            logger.warning("demo.sms_send_failed", error=err)
    else:
        err = "telenyx not configured (TELENYX_API_KEY / TELENYX_FROM_NUMBER unset)"

    state.sms_sent.append({
        "ts": time.time(),
        "kind": kind,
        "body": body,
        "to": state.recipient_phone,
        "delivered": sent_ok,
        "error": err,
    })


async def _run_demo(state: DemoState) -> None:
    """Walk through the 6-stage demo, sending SMS and advancing stage state."""
    try:
        # Stage 1: scrape (fast)
        state.stages[0].status = "running"; state.stages[0].started_at = time.time()
        await asyncio.sleep(2.5)
        state.stages[0].status = "complete"; state.stages[0].completed_at = time.time()

        # Stage 2: skip trace
        state.stages[1].status = "running"; state.stages[1].started_at = time.time()
        await asyncio.sleep(2.5)
        state.stages[1].status = "complete"; state.stages[1].completed_at = time.time()

        # Stage 3: analyze
        state.stages[2].status = "running"; state.stages[2].started_at = time.time()
        await asyncio.sleep(2.5)
        state.stages[2].status = "complete"; state.stages[2].completed_at = time.time()

        # Stage 4: outreach SMS — real send to recipient
        state.stages[3].status = "running"; state.stages[3].started_at = time.time()
        await asyncio.sleep(1.0)
        opening = (
            "Hi! I'm a local cash buyer working in Fulton County and I noticed your property "
            "at 3857 N High St. Would you ever consider a fair cash offer? No fees, quick close. "
            "(This is a Birddogs demo — replies welcome.)"
        )
        _send_demo_sms(state, opening, "outreach")
        await asyncio.sleep(3.5)
        state.stages[3].status = "complete"; state.stages[3].completed_at = time.time()

        # Stage 5: negotiation — real follow-up SMS
        state.stages[4].status = "running"; state.stages[4].started_at = time.time()
        await asyncio.sleep(2.0)
        followup = (
            "Quick update: my AI agent just heard back from the seller. They want $215k, "
            "we countered at $208k cash, 14-day close. Stand by — sending paperwork next."
        )
        _send_demo_sms(state, followup, "negotiation")
        await asyncio.sleep(3.0)
        state.stages[4].status = "complete"; state.stages[4].completed_at = time.time()

        # Stage 6: contract
        state.stages[5].status = "running"; state.stages[5].started_at = time.time()
        await asyncio.sleep(2.0)
        contract_url = "https://birddogs.app/demo/contract/3857-n-high-st.pdf"
        state.contract_url = contract_url
        contract_msg = (
            f"Deal locked: $208,000 cash for 3857 N High St. Closing in 14 days. "
            f"Sign here → {contract_url}"
        )
        _send_demo_sms(state, contract_msg, "contract")
        await asyncio.sleep(1.5)
        state.stages[5].status = "complete"; state.stages[5].completed_at = time.time()

        state.is_complete = True
    except Exception as exc:  # pragma: no cover
        logger.warning("demo.run_failed", demo_id=state.demo_id, error=str(exc)[:160])
        state.is_complete = True


@router.post("/start", response_model=DemoStartResponse)
async def start_demo(
    req: DemoStartRequest,
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> DemoStartResponse:
    """Kick off the end-to-end SMS demo. Sends real texts to the recipient phone."""
    phone = (req.recipient_phone or settings.telenyx_test_recipient or "").strip()
    if not phone:
        raise HTTPException(
            status_code=400,
            detail="No recipient phone — pass `recipient_phone` or set TELENYX_TEST_RECIPIENT",
        )

    demo_id = f"demo_{int(time.time() * 1000)}"
    state = _new_demo_state(demo_id, phone)
    _DEMOS[demo_id] = state
    asyncio.create_task(_run_demo(state))

    return DemoStartResponse(
        demo_id=demo_id,
        recipient_phone=phone,
        message="Demo running. Watch /demo/status/{demo_id} for live progress.",
    )


@router.get("/status/{demo_id}", response_model=DemoState)
def get_demo(demo_id: str) -> DemoState:
    state = _DEMOS.get(demo_id)
    if not state:
        raise HTTPException(status_code=404, detail="demo not found")
    return state
