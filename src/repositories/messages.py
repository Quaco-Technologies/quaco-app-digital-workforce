from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List
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

    def summarize_threads(self, lead_ids: List[str]) -> Dict[str, Dict]:
        """For a set of leads, return per-lead {last_body, last_role, last_sent_at, count}.
        Returns an empty dict for leads with no messages."""
        if not lead_ids:
            return {}
        res = (
            self._db.table("messages")
            .select("lead_id,role,body,sent_at")
            .in_("lead_id", lead_ids)
            .order("sent_at", desc=True)
            .limit(5000)
            .execute()
        )
        rows = res.data or []
        summary: Dict[str, Dict] = {}
        for row in rows:
            lid = row["lead_id"]
            if lid not in summary:
                summary[lid] = {
                    "last_body": row["body"],
                    "last_role": row["role"],
                    "last_sent_at": row["sent_at"],
                    "count": 1,
                }
            else:
                summary[lid]["count"] += 1
        return summary
