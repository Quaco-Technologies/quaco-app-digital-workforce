from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from supabase import Client

from src.models.lead import Lead, LeadStatus


class LeadRepository:
    def __init__(self, db: Client):
        self._db = db

    def upsert(self, lead: Lead) -> Lead:
        now = datetime.now(timezone.utc).isoformat()
        row = lead.model_dump(exclude={"id", "created_at", "updated_at"}, exclude_none=True)
        row["updated_at"] = now
        res = self._db.table("leads").upsert(row, on_conflict="address,source").execute()
        return Lead(**res.data[0])

    def get(self, lead_id: UUID) -> Optional[Lead]:
        res = self._db.table("leads").select("*").eq("id", str(lead_id)).single().execute()
        return Lead(**res.data) if res.data else None

    def list(
        self,
        investor_id: Optional[UUID] = None,
        status: Optional[LeadStatus] = None,
        limit: int = 100,
    ) -> List[Lead]:
        q = self._db.table("leads").select("*").order("created_at", desc=True).limit(limit)
        if investor_id:
            q = q.eq("investor_id", str(investor_id))
        if status:
            q = q.eq("status", status.value)
        res = q.execute()
        return [Lead(**row) for row in (res.data or [])]

    def update_status(self, lead_id: UUID, status: LeadStatus, investor_id: Optional[UUID] = None) -> Lead:
        payload = {
            "status": status.value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        q = self._db.table("leads").update(payload).eq("id", str(lead_id))
        if investor_id:
            q = q.eq("investor_id", str(investor_id))
        res = q.execute()
        return Lead(**res.data[0])
