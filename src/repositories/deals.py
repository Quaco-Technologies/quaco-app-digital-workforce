from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from supabase import Client

from src.models.deal import Deal


class DealRepository:
    def __init__(self, db: Client):
        self._db = db

    def upsert(self, deal: Deal) -> Deal:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "lead_id": str(deal.lead_id),
            "arv": deal.arv,
            "repair_estimate": deal.repair_estimate,
            "max_offer": deal.max_offer,
            "initial_offer": deal.initial_offer,
            "deal_score": deal.deal_score,
            "recommendation": deal.recommendation.value if deal.recommendation else None,
            "comps": deal.comps,
            "updated_at": now,
        }
        res = self._db.table("deals").upsert(row, on_conflict="lead_id").execute()
        return Deal(**res.data[0])

    def get(self, lead_id: UUID) -> Optional[Deal]:
        res = (
            self._db.table("deals")
            .select("*")
            .eq("lead_id", str(lead_id))
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return Deal(**rows[0]) if rows else None
