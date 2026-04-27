from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class MessageRole(str, Enum):
    AGENT = "agent"
    OWNER = "owner"


class Message(BaseModel):
    id: Optional[UUID] = None
    lead_id: UUID
    role: MessageRole
    body: str
    sent_at: Optional[datetime] = None
