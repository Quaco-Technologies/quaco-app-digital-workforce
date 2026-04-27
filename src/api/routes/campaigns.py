from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from src.api.deps import get_repos
from src.api.middleware.auth import get_investor_id
from src.core.exceptions import NotFoundError
from src.models.lead import LeadStatus
from src.repositories import Repositories

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("")
def list_campaigns(
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> List[dict]:
    campaigns = repos.campaigns.list(investor_id=investor_id)
    result = []
    for c in campaigns:
        result.append({
            "id": str(c.id),
            "name": c.name,
            "county": c.county,
            "state": c.state,
            "city": c.city,
            "min_price": c.min_price,
            "max_price": c.max_price,
            "property_types": c.property_types,
            "status": c.status,
            "scraped_count": c.scraped_count,
            "qualified_count": c.qualified_count,
            "saved_count": c.saved_count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return result


@router.get("/{campaign_id}/leads")
def list_campaign_leads(
    campaign_id: UUID,
    investor_id: UUID = Depends(get_investor_id),
    repos: Repositories = Depends(get_repos),
) -> List[dict]:
    """Return all leads for a campaign with their contact info."""
    leads = repos.leads.list_by_campaign(campaign_id=campaign_id, investor_id=investor_id)
    if not leads:
        return []

    lead_ids = [str(l.id) for l in leads]
    contact_map = {
        str(c.lead_id): c
        for c in repos.contacts.get_by_lead_ids(lead_ids)
    }

    # Fetch outreach_status for all leads in one query
    outreach_rows = (
        repos.db.table("leads")
        .select("id,outreach_status")
        .in_("id", lead_ids)
        .execute().data or []
    )
    outreach_map = {r["id"]: r.get("outreach_status") for r in outreach_rows}

    result = []
    for lead in leads:
        c = contact_map.get(str(lead.id))
        # Only include leads with phone numbers and offers
        phones = c.phones if c else []
        if not phones or lead.offer_price is None:
            continue
        result.append({
            "id": str(lead.id),
            "address": lead.address,
            "city": lead.city,
            "state": lead.state,
            "zip": lead.zip,
            "owner_name": lead.owner_name or (c.owner_name if c else None),
            "assessed_value": lead.assessed_value,
            "arv": lead.arv,
            "offer_price": lead.offer_price,
            "repair_estimate": lead.repair_estimate,
            "pipeline_recommendation": lead.pipeline_recommendation,
            "photo_condition": lead.photo_condition,
            "investment_type": lead.investment_type,
            "photos": lead.photos or [],
            "status": lead.status,
            "outreach_status": outreach_map.get(str(lead.id)),
            "phones": phones,
            "emails": c.emails if c else [],
            "contact_confidence": round(c.confidence, 2) if c else 0,
            "created_at": lead.created_at.isoformat() if lead.created_at else None,
        })
    return result
