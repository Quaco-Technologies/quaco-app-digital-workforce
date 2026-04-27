from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from supabase import Client

from src.models.contract import Contract, ContractStatus


class ContractRepository:
    def __init__(self, db: Client):
        self._db = db

    def upsert(self, contract: Contract) -> Contract:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "lead_id": str(contract.lead_id),
            "envelope_id": contract.envelope_id,
            "agreed_price": contract.agreed_price,
            "status": contract.status.value,
            "updated_at": now,
        }
        res = self._db.table("contracts").upsert(row, on_conflict="lead_id").execute()
        return Contract(**res.data[0])

    def get(self, lead_id: UUID) -> Optional[Contract]:
        res = (
            self._db.table("contracts")
            .select("*")
            .eq("lead_id", str(lead_id))
            .single()
            .execute()
        )
        return Contract(**res.data) if res.data else None

    def get_by_envelope(self, envelope_id: str) -> Optional[Contract]:
        res = (
            self._db.table("contracts")
            .select("*")
            .eq("envelope_id", envelope_id)
            .single()
            .execute()
        )
        return Contract(**res.data) if res.data else None

    def update_status(
        self,
        lead_id: UUID,
        status: ContractStatus,
        completed_at: Optional[str] = None,
    ) -> Contract:
        payload: dict = {
            "status": status.value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if completed_at:
            payload["completed_at"] = completed_at
        res = (
            self._db.table("contracts")
            .update(payload)
            .eq("lead_id", str(lead_id))
            .execute()
        )
        return Contract(**res.data[0])
