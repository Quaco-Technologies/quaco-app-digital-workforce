from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from supabase import Client

from src.models.campaign import Campaign


class CampaignRepository:
    def __init__(self, db: Client):
        self._db = db

    def create(self, campaign: Campaign) -> Campaign:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "investor_id": str(campaign.investor_id) if campaign.investor_id else None,
            "name": campaign.name,
            "county": campaign.county,
            "state": campaign.state,
            "city": campaign.city,
            "min_price": campaign.min_price,
            "max_price": campaign.max_price,
            "property_types": campaign.property_types,
            "status": campaign.status,
            "scraped_count": campaign.scraped_count,
            "qualified_count": campaign.qualified_count,
            "saved_count": campaign.saved_count,
            "created_at": now,
            "updated_at": now,
        }
        res = self._db.table("campaigns").insert(row).execute()
        return Campaign(**res.data[0])

    def update(self, campaign_id: UUID, **fields) -> None:
        fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._db.table("campaigns").update(fields).eq("id", str(campaign_id)).execute()

    def get(self, campaign_id: UUID) -> Optional[Campaign]:
        res = self._db.table("campaigns").select("*").eq("id", str(campaign_id)).limit(1).execute()
        rows = res.data or []
        return Campaign(**rows[0]) if rows else None

    def list(self, investor_id: Optional[UUID] = None, limit: int = 50) -> List[Campaign]:
        q = self._db.table("campaigns").select("*").order("created_at", desc=True).limit(limit)
        if investor_id:
            q = q.eq("investor_id", str(investor_id))
        res = q.execute()
        return [Campaign(**row) for row in (res.data or [])]
