from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class LeadStatus(str, Enum):
    NEW = "new"
    SKIP_TRACED = "skip_traced"
    ANALYZED = "analyzed"
    OUTREACH = "outreach"
    NEGOTIATING = "negotiating"
    UNDER_CONTRACT = "under_contract"
    ENRICHED = "enriched"
    DEAD = "dead"
    CLOSED = "closed"


class Lead(BaseModel):
    id: Optional[UUID] = None
    source: str
    address: str
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    price: Optional[int] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    sqft: Optional[int] = None
    listing_url: Optional[str] = None
    days_on_market: Optional[int] = None
    description: Optional[str] = None
    status: LeadStatus = LeadStatus.NEW
    investor_id: Optional[UUID] = None
    buy_box_id: Optional[UUID] = None
    agreed_price: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Step 1: County record fields
    apn: Optional[str] = None
    owner_name: Optional[str] = None
    owner_mailing_address: Optional[str] = None
    improvement_value: Optional[int] = None
    year_built: Optional[int] = None
    assessed_value: Optional[int] = None

    # Step 2: FEMA flood zone
    flood_zone: Optional[str] = None
    flood_risk_high: Optional[bool] = None

    # Step 3: Photo analysis
    photo_condition: Optional[str] = None
    photo_roof_condition: Optional[str] = None
    photo_vacant: Optional[bool] = None
    photo_major_issues: Optional[bool] = None
    photo_confidence: Optional[float] = None

    # Steps 4+5: Comps + offer
    comps: Optional[List[Dict[str, Any]]] = None
    arv: Optional[int] = None
    offer_price: Optional[int] = None
    pipeline_recommendation: Optional[str] = None
    review_reasons: Optional[List[str]] = None
