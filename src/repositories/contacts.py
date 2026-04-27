from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from supabase import Client

from src.models.contact import Contact


class ContactRepository:
    def __init__(self, db: Client):
        self._db = db

    def upsert(self, contact: Contact) -> Contact:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "lead_id": str(contact.lead_id),
            "owner_name": contact.owner_name,
            "phones": contact.phones,
            "emails": contact.emails,
            "mailing_address": contact.mailing_address,
            "confidence": contact.confidence,
            "updated_at": now,
        }
        res = self._db.table("contacts").upsert(row, on_conflict="lead_id").execute()
        return Contact(**res.data[0])

    def get(self, lead_id: UUID) -> Optional[Contact]:
        res = (
            self._db.table("contacts")
            .select("*")
            .eq("lead_id", str(lead_id))
            .single()
            .execute()
        )
        if not res.data:
            return None
        data = res.data
        if isinstance(data.get("phones"), str):
            data["phones"] = json.loads(data["phones"])
        if isinstance(data.get("emails"), str):
            data["emails"] = json.loads(data["emails"])
        return Contact(**data)

    def get_by_lead_ids(self, lead_ids: List[str]) -> List[Contact]:
        if not lead_ids:
            return []
        res = self._db.table("contacts").select("*").in_("lead_id", lead_ids).execute()
        result = []
        for data in (res.data or []):
            if isinstance(data.get("phones"), str):
                data["phones"] = json.loads(data["phones"])
            if isinstance(data.get("emails"), str):
                data["emails"] = json.loads(data["emails"])
            result.append(Contact(**data))
        return result

    def find_by_phone(self, phone: str) -> Optional[Contact]:
        res = (
            self._db.table("contacts")
            .select("*")
            .contains("phones", [phone])
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return Contact(**res.data[0])
