from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class Campaign(BaseModel):
    id: Optional[UUID] = None
    investor_id: Optional[UUID] = None
    name: str
    county: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    min_price: Optional[int] = None
    max_price: Optional[int] = None
    property_types: Optional[List[str]] = None
    status: str = "running"
    scraped_count: int = 0
    qualified_count: int = 0
    saved_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
