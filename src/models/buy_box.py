from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class BuyBox(BaseModel):
    id: Optional[UUID] = None
    investor_id: Optional[UUID] = None
    city: str
    state: str
    county: str
    min_price: int = 0
    max_price: int = 1_000_000
    property_types: List[str] = ["single_family"]
    min_beds: int = 2
    max_beds: Optional[int] = None
    min_baths: Optional[float] = None
    min_sqft: Optional[int] = None
    max_sqft: Optional[int] = None


class Investor(BaseModel):
    id: Optional[UUID] = None
    name: str
    email: str
