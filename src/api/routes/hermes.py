from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.agents import hermes
from src.api.deps import get_repos
from src.api.middleware.auth import get_investor_id
from src.api.routes.insights import _pipeline_facts
from src.core.config import settings
from src.repositories import Repositories

router = APIRouter(prefix="/hermes", tags=["hermes"])


class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    history: list[ChatTurn]
    include_pipeline: bool = True


class ChatResponse(BaseModel):
    reply: str
    configured: bool


@router.get("/status")
def hermes_status() -> dict:
    """Report whether the Hermes agent is wired up and which model it uses."""
    return {
        "configured": hermes.is_configured(),
        "model": settings.nous_model,
        "base_url": settings.nous_base_url,
    }


@router.post("/chat", response_model=ChatResponse)
def hermes_chat(
    req: ChatRequest,
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> ChatResponse:
    """Conversational acquisitions copilot powered by Nous Research Hermes."""
    facts = _pipeline_facts(repos, investor_id) if req.include_pipeline else None
    history = [{"role": t.role, "content": t.content} for t in req.history]
    result = hermes.chat(history, pipeline_facts=facts)
    return ChatResponse(reply=result["reply"], configured=result.get("configured", False))
