from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class Contact(BaseModel):
    id: Optional[UUID] = None
    lead_id: UUID
    owner_name: Optional[str] = None
    phones: List[str] = []
    emails: List[str] = []
    mailing_address: Optional[str] = None
    confidence: float = 0.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
