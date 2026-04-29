from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from supabase import Client

from src.models.lead import Lead, LeadStatus

# When the service-role key is used as auth (dev/CI), requests arrive with this UUID.
# We intentionally skip investor_id filtering so all leads are visible.
_DEV_INVESTOR_ID = UUID("00000000-0000-0000-0000-000000000001")


class LeadRepository:
    def __init__(self, db: Client):
        self._db = db

    def upsert(self, lead: Lead) -> Lead:
        now = datetime.now(timezone.utc).isoformat()
        row = lead.model_dump(mode="json", exclude={"id", "created_at", "updated_at"}, exclude_none=True)
        row["updated_at"] = now
        res = self._db.table("leads").upsert(row, on_conflict="address,source").execute()
        if res.data:
            return Lead(**res.data[0])
        # PostgREST may return empty data on no-op conflict — fetch by natural key
        fetch = (
            self._db.table("leads")
            .select("*")
            .eq("address", lead.address)
            .eq("source", lead.source or "county_records")
            .limit(1)
            .execute()
        )
        if fetch.data:
            return Lead(**fetch.data[0])
        raise RuntimeError(f"upsert returned no data for address={lead.address!r}")

    def get(self, lead_id: UUID) -> Optional[Lead]:
        res = self._db.table("leads").select("*").eq("id", str(lead_id)).limit(1).execute()
        rows = res.data or []
        return Lead(**rows[0]) if rows else None

    def list(
        self,
        investor_id: Optional[UUID] = None,
        status: Optional[LeadStatus] = None,
        limit: int = 100,
    ) -> List[Lead]:
        q = self._db.table("leads").select("*").order("created_at", desc=True).limit(limit)
        if investor_id and investor_id != _DEV_INVESTOR_ID:
            q = q.eq("investor_id", str(investor_id))
        if status:
            q = q.eq("status", status.value)
        res = q.execute()
        return [Lead(**row) for row in (res.data or [])]

    def list_by_campaign(self, campaign_id: UUID, investor_id: Optional[UUID] = None, limit: int = 500) -> List[Lead]:
        q = self._db.table("leads").select("*").eq("campaign_id", str(campaign_id)).order("created_at", desc=True).limit(limit)
        if investor_id and investor_id != _DEV_INVESTOR_ID:
            q = q.eq("investor_id", str(investor_id))
        res = q.execute()
        return [Lead(**row) for row in (res.data or [])]

    def update_status(
        self,
        lead_id: UUID,
        status: LeadStatus,
        investor_id: Optional[UUID] = None,
        agreed_price: Optional[int] = None,
    ) -> Lead:
        payload: dict = {
            "status": status.value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if agreed_price is not None:
            payload["agreed_price"] = agreed_price
        q = self._db.table("leads").update(payload).eq("id", str(lead_id))
        if investor_id:
            q = q.eq("investor_id", str(investor_id))
        res = q.execute()
        return Lead(**res.data[0])
