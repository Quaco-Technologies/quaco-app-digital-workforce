from __future__ import annotations

import csv
import io
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from src.api.deps import get_repos
from src.api.middleware.auth import get_investor_id
from src.core.exceptions import NotFoundError
from src.models.lead import Lead, LeadStatus
from src.repositories import Repositories

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=List[Lead])
def list_leads(
    status: Optional[LeadStatus] = Query(None),
    limit: int = Query(50, le=500),
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> List[Lead]:
    return repos.leads.list(investor_id=investor_id, status=status, limit=limit)


@router.get("/enriched")
def list_enriched_leads(
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> List[dict]:
    """Returns skip-traced leads with owner contact info embedded."""
    leads = repos.leads.list(investor_id=investor_id, status=LeadStatus.ENRICHED, limit=1000)
    if not leads:
        return []
    contact_map = {
        str(c.lead_id): c
        for c in repos.contacts.get_by_lead_ids([str(l.id) for l in leads])
    }
    result = []
    for lead in leads:
        c = contact_map.get(str(lead.id))
        result.append({
            "id": str(lead.id),
            "address": lead.address,
            "city": lead.city,
            "state": lead.state,
            "price": lead.price,
            "bedrooms": lead.bedrooms,
            "sqft": lead.sqft,
            "arv": lead.arv,
            "offer_price": lead.offer_price,
            "pipeline_recommendation": lead.pipeline_recommendation,
            "owner_name": c.owner_name if c else None,
            "phones": c.phones if c else [],
            "emails": c.emails if c else [],
            "confidence": round(c.confidence, 2) if c else 0,
            "created_at": lead.created_at.isoformat() if lead.created_at else None,
        })
    return result


@router.get("/export.csv")
def export_leads_csv(
    status: Optional[LeadStatus] = Query(None),
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> StreamingResponse:
    leads = repos.leads.list(investor_id=investor_id, status=status, limit=5000)
    contact_map = {
        str(c.lead_id): c
        for c in repos.contacts.get_by_lead_ids([str(l.id) for l in leads])
    }

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Owner Name", "Phone", "Email",
        "Address", "City", "State", "Zip",
        "Assessed Value", "ARV", "Offer Price", "Recommendation",
        "Beds", "Sqft", "Flood Zone", "Photo Condition",
    ])
    for lead in leads:
        c = contact_map.get(str(lead.id))
        writer.writerow([
            c.owner_name if c else "",
            c.phones[0] if c and c.phones else "",
            c.emails[0] if c and c.emails else "",
            lead.address,
            lead.city or "",
            lead.state or "",
            lead.zip or "",
            lead.price or "",
            lead.arv or "",
            lead.offer_price or "",
            lead.pipeline_recommendation or "",
            lead.bedrooms or "",
            lead.sqft or "",
            lead.flood_zone or "",
            lead.photo_condition or "",
        ])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
    )


@router.get("/{lead_id}")
def get_lead(
    lead_id: UUID,
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> dict:
    lead = repos.leads.get(lead_id)
    if not lead or lead.investor_id != investor_id:
        raise NotFoundError("Lead", str(lead_id))
    return {
        "lead": lead,
        "deal": repos.deals.get(lead_id),
        "contact": repos.contacts.get(lead_id),
        "conversation": repos.messages.get_conversation(lead_id),
    }
