from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class DealRecommendation(str, Enum):
    PURSUE = "pursue"
    WATCH = "watch"
    SKIP = "skip"


class Deal(BaseModel):
    id: Optional[UUID] = None
    lead_id: UUID
    arv: Optional[int] = None
    repair_estimate: Optional[int] = None
    max_offer: Optional[int] = None
    initial_offer: Optional[int] = None
    deal_score: Optional[float] = None
    recommendation: Optional[DealRecommendation] = None
    comps: List[Dict[str, Any]] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
