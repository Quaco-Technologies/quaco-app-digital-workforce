from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from uuid import UUID

from supabase import Client

from src.models.message import Message, MessageRole


class MessageRepository:
    def __init__(self, db: Client):
        self._db = db

    def append(self, lead_id: UUID, role: MessageRole, body: str) -> Message:
        row = {
            "lead_id": str(lead_id),
            "role": role.value,
            "body": body,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }
        res = self._db.table("messages").insert(row).execute()
        return Message(**res.data[0])

    def get_conversation(self, lead_id: UUID) -> List[Message]:
        res = (
            self._db.table("messages")
            .select("*")
            .eq("lead_id", str(lead_id))
            .order("sent_at")
            .execute()
        )
        return [Message(**row) for row in (res.data or [])]
