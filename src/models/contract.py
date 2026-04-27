from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ContractStatus(str, Enum):
    SENT = "sent"
    COMPLETED = "completed"
    VOIDED = "voided"


class Contract(BaseModel):
    id: Optional[UUID] = None
    lead_id: UUID
    envelope_id: str
    agreed_price: Optional[int] = None
    status: ContractStatus = ContractStatus.SENT
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
