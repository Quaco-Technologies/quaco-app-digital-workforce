from __future__ import annotations

import asyncio
import time
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.agents import negotiation
from src.api.deps import get_repos
from src.api.middleware.auth import get_investor_id
from src.core.config import settings
from src.core.logging import get_logger
from src.models.contact import Contact
from src.models.lead import Lead, LeadStatus
from src.repositories import Repositories
from src.services import telnyx_poller
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


# ─── Real AI negotiation demo ────────────────────────────────────────────────
# Seeds a real Lead + Contact in the DB with the recipient phone as the
# "owner", then fires the actual negotiation agent. The agent's opening SMS
# goes to the recipient's phone via Telenyx; their replies hit the existing
# /webhooks/sms endpoint, run through negotiation.handle_reply, and get a
# real Claude-generated counter-text. The frontend polls
# /demo/conversation/{lead_id} to render the live conversation.

class StartNegotiationRequest(BaseModel):
    recipient_phone: Optional[str] = None
    additional_phones: Optional[list[str]] = None
    owner_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    arv: Optional[int] = None
    offer_price: Optional[int] = None


class StartNegotiationResponse(BaseModel):
    lead_id: str
    recipient_phone: str
    sent: bool
    opening_message: str
    error: Optional[str] = None
    additional_lead_ids: Optional[list[str]] = None


@router.post("/negotiate", response_model=StartNegotiationResponse)
def start_real_negotiation(
    req: StartNegotiationRequest,
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> StartNegotiationResponse:
    """Seed a fake lead with the user's phone and fire the real AI negotiation bot."""
    phone = (req.recipient_phone or settings.telenyx_test_recipient or "").strip()
    if not phone:
        raise HTTPException(
            status_code=400,
            detail="No recipient phone — pass `recipient_phone` or set TELENYX_TEST_RECIPIENT",
        )
    address = req.address or "3857 N High St"
    city = req.city or "Atlanta"
    state = req.state or "GA"
    arv = req.arv or 268_000
    offer_price = req.offer_price or 187_500

    # 1. Create the lead — use a unique source so we don't collide with a real one
    source = f"demo_{uuid4().hex[:8]}"
    lead = Lead(
        source=source,
        address=address,
        city=city,
        state=state,
        zip="30301",
        owner_name=req.owner_name or "Maria Hernandez",
        bedrooms=3, bathrooms=2.0, sqft=1850, year_built=1972,
        arv=arv,
        offer_price=offer_price,
        assessed_value=215_000,
        photo_condition="fair",
        investor_id=investor_id,
        status=LeadStatus.ANALYZED,
    )

    row = lead.model_dump(mode="json", exclude_none=True, exclude={"id", "created_at", "updated_at"})
    res = repos.db.table("leads").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create demo lead")
    lead_id = UUID(res.data[0]["id"])

    # 2. Create the contact with the user's phone
    contact = Contact(
        lead_id=lead_id,
        owner_name=req.owner_name or "Maria Hernandez",
        phones=[phone],
        emails=[],
        confidence=0.95,
    )
    repos.contacts.upsert(contact)

    # 3. Fire the real negotiation agent — sends real SMS to the user's phone
    try:
        result = negotiation.start_outreach(lead_id, repos)
    except Exception as exc:
        logger.warning("demo.negotiate.outreach_failed", lead_id=str(lead_id), error=str(exc)[:200])
        return StartNegotiationResponse(
            lead_id=str(lead_id),
            recipient_phone=phone,
            sent=False,
            opening_message="",
            error=str(exc)[:200],
        )

    if "error" in result:
        return StartNegotiationResponse(
            lead_id=str(lead_id),
            recipient_phone=phone,
            sent=False,
            opening_message="",
            error=result["error"],
        )

    # 4. Optionally fan out to additional phones — each gets its own lead
    additional_lead_ids: list[str] = []
    for extra in (req.additional_phones or []):
        extra = (extra or "").strip()
        if not extra or extra == phone:
            continue
        try:
            extra_source = f"demo_{uuid4().hex[:8]}"
            extra_lead = lead.model_copy(update={"source": extra_source})
            extra_row = extra_lead.model_dump(mode="json", exclude_none=True, exclude={"id", "created_at", "updated_at"})
            extra_res = repos.db.table("leads").insert(extra_row).execute()
            if extra_res.data:
                xid = UUID(extra_res.data[0]["id"])
                repos.contacts.upsert(Contact(
                    lead_id=xid,
                    owner_name=req.owner_name or "Maria Hernandez",
                    phones=[extra], emails=[], confidence=0.95,
                ))
                negotiation.start_outreach(xid, repos)
                additional_lead_ids.append(str(xid))
        except Exception as exc:
            logger.warning("demo.fanout_failed", phone=extra, error=str(exc)[:160])

    sms_error = result.get("sms_error")
    return StartNegotiationResponse(
        lead_id=str(lead_id),
        recipient_phone=phone,
        sent=bool(result.get("sent")),
        opening_message=result.get("sms", ""),
        error=sms_error,
        additional_lead_ids=additional_lead_ids or None,
    )


class ConversationMessage(BaseModel):
    role: str  # "agent" | "owner"
    body: str
    sent_at: str


class ConversationResponse(BaseModel):
    lead_id: str
    status: str
    agreed_price: Optional[int] = None
    messages: list[ConversationMessage]
    contract_email_sent_to: Optional[str] = None
    contract_email_delivered: bool = False
    contract_url: Optional[str] = None
    contract_signed: bool = False
    signed_at: Optional[str] = None


class SimulateReplyRequest(BaseModel):
    body: str


# In-memory cache of email-send state per lead (the messages table doesn't
# track this and adding a column means a migration the user has to run)
_LEAD_EMAIL_STATE: dict[str, dict] = {}


@router.post("/conversation/{lead_id}/simulate_reply", response_model=ConversationResponse)
def simulate_owner_reply(
    lead_id: UUID,
    req: SimulateReplyRequest,
    repos: Repositories = Depends(get_repos),
) -> ConversationResponse:
    """Pretend the owner just texted us. Drives the real AI agent through
    handle_reply — useful for demoing live negotiation when Telnyx is
    misconfigured or you want to script the conversation."""
    if not req.body.strip():
        raise HTTPException(status_code=400, detail="empty body")
    try:
        result = negotiation.handle_reply(lead_id, req.body.strip(), repos)
        if result.get("email_to"):
            _LEAD_EMAIL_STATE[str(lead_id)] = {
                "to": result["email_to"],
                "delivered": bool(result.get("email_sent")),
                "url": result.get("contract_url"),
                "error": result.get("email_error"),
            }
    except Exception as exc:
        logger.warning("demo.simulate_reply.error", lead_id=str(lead_id), error=str(exc)[:200])
    return get_conversation(lead_id, repos)


@router.get("/conversation/{lead_id}", response_model=ConversationResponse)
def get_conversation(
    lead_id: UUID,
    repos: Repositories = Depends(get_repos),
) -> ConversationResponse:
    """Fetch the live conversation for a demo lead — frontend polls this."""
    lead = repos.leads.get(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    messages = repos.messages.get_conversation(lead_id)
    email_state = _LEAD_EMAIL_STATE.get(str(lead_id), {})
    sign_state = _SIGNED.get(str(lead_id))
    return ConversationResponse(
        lead_id=str(lead_id),
        status=lead.status.value if hasattr(lead.status, "value") else str(lead.status),
        agreed_price=lead.agreed_price,
        messages=[
            ConversationMessage(
                role=m.role.value if hasattr(m.role, "value") else str(m.role),
                body=m.body,
                sent_at=m.sent_at.isoformat() if m.sent_at else "",
            )
            for m in messages
        ],
        contract_email_sent_to=email_state.get("to"),
        contract_email_delivered=bool(email_state.get("delivered")),
        contract_url=email_state.get("url"),
        contract_signed=bool(sign_state),
        signed_at=sign_state,
    )


# Public sign endpoints — no auth, called from the email link OR the dashboard.
_SIGNED: dict[str, str] = {}


class SignRequest(BaseModel):
    pass


@router.post("/contract/{lead_id}/sign")
def sign_contract(lead_id: UUID) -> dict:
    """Mark a demo contract as signed. Public endpoint so the email link works.
    Idempotent — multiple calls return the same timestamp."""
    key = str(lead_id)
    if key not in _SIGNED:
        _SIGNED[key] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return {"lead_id": key, "signed": True, "signed_at": _SIGNED[key]}


@router.get("/contract/{lead_id}")
def get_contract_summary(lead_id: UUID, repos: Repositories = Depends(get_repos)) -> dict:
    """Lightweight public lookup for the sign page — no auth needed."""
    lead = repos.leads.get(lead_id)
    contact = repos.contacts.get(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Contract not found")
    return {
        "lead_id": str(lead_id),
        "address": lead.address,
        "city": lead.city,
        "state": lead.state,
        "owner_name": (contact.owner_name if contact else None) or lead.owner_name or "Owner",
        "agreed_price": lead.agreed_price or lead.offer_price,
        "signed": str(lead_id) in _SIGNED,
        "signed_at": _SIGNED.get(str(lead_id)),
    }
