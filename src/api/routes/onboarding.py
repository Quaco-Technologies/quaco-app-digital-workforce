from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.deps import get_repos
from src.api.middleware.auth import get_investor_id
from src.repositories import Repositories

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class ValidateInviteRequest(BaseModel):
    code: str


class InvestorProfileRequest(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    investor_type: Optional[str] = None
    primary_state: Optional[str] = None
    target_markets: Optional[str] = None
    typical_min_price: Optional[int] = None
    typical_max_price: Optional[int] = None
    typical_property_types: Optional[List[str]] = None
    experience_level: Optional[str] = None
    monthly_deal_target: Optional[int] = None
    referral_source: Optional[str] = None
    onboarding_completed: bool = False


@router.post("/validate-invite")
def validate_invite(
    req: ValidateInviteRequest,
    repos: Repositories = Depends(get_repos),
) -> dict:
    """Public endpoint — check if an invite code is valid and unused."""
    rows = (
        repos.db.table("invite_codes")
        .select("id, used_by")
        .eq("code", req.code.strip().upper())
        .limit(1)
        .execute()
        .data or []
    )
    if not rows:
        raise HTTPException(status_code=400, detail="Invalid invite code")
    if rows[0].get("used_by"):
        raise HTTPException(status_code=400, detail="This invite code has already been used")
    return {"valid": True}


@router.post("/use-invite")
def use_invite(
    req: ValidateInviteRequest,
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> dict:
    """Mark an invite code as used after successful signup."""
    rows = (
        repos.db.table("invite_codes")
        .select("id")
        .eq("code", req.code.strip().upper())
        .is_("used_by", "null")
        .limit(1)
        .execute()
        .data or []
    )
    if rows:
        repos.db.table("invite_codes").update({
            "used_by": str(investor_id),
            "used_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", rows[0]["id"]).execute()
    return {"ok": True}


@router.get("/profile")
def get_profile(
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> Optional[dict]:
    rows = (
        repos.db.table("investor_profiles")
        .select("*")
        .eq("id", str(investor_id))
        .limit(1)
        .execute()
        .data or []
    )
    return rows[0] if rows else None


@router.post("/profile")
def save_profile(
    req: InvestorProfileRequest,
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    data = {k: v for k, v in req.model_dump().items() if v is not None}
    data["id"] = str(investor_id)
    data["updated_at"] = now

    existing = (
        repos.db.table("investor_profiles")
        .select("id")
        .eq("id", str(investor_id))
        .limit(1)
        .execute()
        .data or []
    )
    if existing:
        repos.db.table("investor_profiles").update(data).eq("id", str(investor_id)).execute()
    else:
        data["created_at"] = now
        repos.db.table("investor_profiles").insert(data).execute()
    return {"ok": True}
