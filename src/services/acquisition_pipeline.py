from __future__ import annotations

"""
Acquisition pipeline — 4 steps:
  1. Scrape county assessor records (Firecrawl AI)
  2. Buy-box filter
  3. Skip trace every match — discard leads with no phone number
  4. Zillow sold comps → ARV → offer calculation → save
"""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from supabase import Client

from src.core.logging import get_logger
from src.models.buy_box import BuyBox
from src.models.campaign import Campaign
from src.models.contact import Contact
from src.models.lead import Lead, LeadStatus
from src.repositories import Repositories
from src.tools.apify_tools import batch_enrich_contacts
from src.tools.county_scraper import scrape_county_records
from src.tools.offer_calculator import calculate_offer
from src.tools.photo_analyzer import analyze_property_photos
from src.tools.zillow_comps import get_zillow_comps
from src.tools.fema_checker import lookup_zip

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Buy-box filter
# ---------------------------------------------------------------------------

_RESIDENTIAL_KEYWORDS = {
    "single_family": ["single", "sfr", "house", "residential", "home", "detached"],
    "multi_family":  ["multi", "duplex", "triplex", "quadplex", "apartment"],
    "condo":         ["condo", "condominium", "unit"],
    "townhouse":     ["townhouse", "townhome", "town"],
}


def _normalise_property_type(raw: str) -> str:
    s = raw.lower().strip()
    for canonical, keywords in _RESIDENTIAL_KEYWORDS.items():
        if any(k in s for k in keywords):
            return canonical
    return s


def _matches_buy_box(rec: Dict[str, Any], buy_box: BuyBox) -> bool:
    raw_type = (rec.get("property_type") or "").strip()
    if raw_type:
        prop_type = _normalise_property_type(raw_type)
        rec["property_type"] = prop_type
    else:
        prop_type = ""

    if buy_box.property_types and prop_type:
        if not any(t == prop_type or t in prop_type or prop_type in t for t in buy_box.property_types):
            return False

    sqft = rec.get("sqft")
    if sqft:
        try:
            sqft_int = int(float(str(sqft)))
            if buy_box.min_sqft and sqft_int < buy_box.min_sqft:
                return False
            if buy_box.max_sqft and sqft_int > buy_box.max_sqft:
                return False
        except (ValueError, TypeError):
            pass

    assessed = rec.get("assessed_value") or rec.get("price")
    if assessed:
        try:
            v = int(float(str(assessed)))
            if buy_box.max_price and v > buy_box.max_price:
                return False
            if buy_box.min_price and v < buy_box.min_price:
                return False
        except (ValueError, TypeError):
            pass

    beds = rec.get("bedrooms")
    if beds and buy_box.min_beds:
        try:
            if int(beds) < buy_box.min_beds:
                return False
        except (ValueError, TypeError):
            pass

    return True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _save_lead(rec: Dict[str, Any], buy_box: BuyBox, investor_id: Optional[UUID], repos: Repositories, campaign_id: Optional[UUID] = None) -> Lead:
    lead = Lead(
        source="county_records",
        investor_id=investor_id,
        campaign_id=campaign_id,
        address=rec["address"],
        city=rec.get("city") or buy_box.city,
        state=rec.get("state") or buy_box.state,
        zip=rec.get("zip"),
        bedrooms=rec.get("bedrooms"),
        bathrooms=rec.get("bathrooms"),
        sqft=rec.get("sqft"),
        apn=rec.get("apn"),
        owner_name=rec.get("owner_name"),
        owner_mailing_address=rec.get("owner_mailing_address"),
        improvement_value=rec.get("improvement_value"),
        year_built=rec.get("year_built"),
        assessed_value=rec.get("assessed_value"),
        price=rec.get("assessed_value") or rec.get("price"),
        status=LeadStatus.NEW,
    )
    return repos.leads.upsert(lead)


def _update_lead_partial(lead_id: UUID, repos: Repositories, investor_id: Optional[UUID] = None, **fields: Any) -> None:
    payload = {k: v for k, v in fields.items() if v is not None}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    q = repos.leads._db.table("leads").update(payload).eq("id", str(lead_id))
    if investor_id:
        q = q.eq("investor_id", str(investor_id))
    q.execute()


def _save_contact(lead_id: UUID, contact_data: Dict[str, Any], repos: Repositories) -> None:
    contact = Contact(
        lead_id=lead_id,
        owner_name=contact_data.get("owner_name"),
        phones=contact_data.get("phones", []),
        emails=contact_data.get("emails", []),
        mailing_address=contact_data.get("mailing_address", ""),
        confidence=float(contact_data.get("confidence", 0)),
    )
    repos.contacts.upsert(contact)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

async def run_acquisition_pipeline(
    buy_box: BuyBox,
    investor_id: Optional[UUID],
    db: Client,
    max_leads: int = 100,
    campaign_name: Optional[str] = None,
) -> Dict[str, Any]:
    repos = Repositories(db)

    # ── Create campaign record ─────────────────────────────────────────────
    from calendar import month_abbr
    from datetime import datetime
    now = datetime.now()
    auto_name = campaign_name or f"{buy_box.county} County, {buy_box.state} · {month_abbr[now.month]} {now.year}"
    campaign = repos.campaigns.create(Campaign(
        investor_id=investor_id,
        name=auto_name,
        county=buy_box.county,
        state=buy_box.state,
        city=buy_box.city,
        min_price=buy_box.min_price,
        max_price=buy_box.max_price,
        property_types=buy_box.property_types,
        status="running",
    ))
    campaign_id = campaign.id
    logger.info("pipeline.campaign_created", campaign_id=str(campaign_id), name=auto_name)

    summary: Dict[str, Any] = {
        "campaign_id": str(campaign_id),
        "county": buy_box.county,
        "state": buy_box.state,
        "scraped": 0,
        "filtered": 0,
        "skip_traced": 0,
        "saved": 0,
        "leads": [],
    }

    # ── Step 1: Scrape county assessor records ─────────────────────────────
    logger.info("pipeline.step1.start", county=buy_box.county, state=buy_box.state)
    raw_records = await scrape_county_records(buy_box.county, buy_box.state, buy_box.city)
    summary["scraped"] = len(raw_records)
    logger.info("pipeline.step1.done", scraped=len(raw_records))

    # ── Step 2: Buy-box filter ─────────────────────────────────────────────
    matching = [r for r in raw_records if _matches_buy_box(r, buy_box)]
    summary["filtered"] = len(matching)
    if raw_records and not matching:
        sample = raw_records[0]
        logger.warning(
            "pipeline.step2.all_filtered",
            sample_type=sample.get("property_type"),
            sample_price=sample.get("assessed_value") or sample.get("price"),
            buy_box_types=buy_box.property_types,
            buy_box_min=buy_box.min_price,
            buy_box_max=buy_box.max_price,
        )
    logger.info("pipeline.step2.filtered", matching=len(matching))

    candidates = matching

    # ── Step 3: Batch skip trace — one actor run per 100 candidates ─────────
    BATCH = 100
    qualified: List[Dict[str, Any]] = []

    for batch_start in range(0, len(candidates), BATCH):
        batch = candidates[batch_start: batch_start + BATCH]
        logger.info("pipeline.step3.batch", start=batch_start, size=len(batch))
        try:
            contacts = await asyncio.to_thread(
                batch_enrich_contacts,
                batch,
                buy_box.city,
                buy_box.state,
            )
        except Exception as exc:
            logger.warning("pipeline.step3.batch_error", start=batch_start, error=str(exc)[:200])
            continue

        for rec in batch:
            addr = rec["address"]
            contact = contacts.get(addr)
            if contact and contact.get("phones"):
                logger.info("pipeline.step3.found", address=addr, phones=len(contact["phones"]))
                qualified.append({**rec, "_contact": contact})
            else:
                logger.info("pipeline.step3.no_phone", address=addr)

    summary["skip_traced"] = len(qualified)
    logger.info("pipeline.step3.done", qualified=len(qualified), discarded=len(candidates) - len(qualified))

    # Cap enrichment+save at max_leads (skip trace ran on everything — only saving is capped)
    qualified = qualified[:max_leads]

    repos.campaigns.update(campaign_id, scraped_count=summary["scraped"], qualified_count=len(qualified))

    if not qualified:
        repos.campaigns.update(campaign_id, status="complete", saved_count=0)
        logger.info("pipeline.complete", **{k: summary[k] for k in ["county", "scraped", "filtered", "skip_traced", "saved"]})
        return summary

    # ── Step 4: Save leads then enrich with comps + offer + photos ─────────
    async def _enrich_lead(rec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        contact_data = rec.pop("_contact")
        iid = investor_id

        # Save the lead first
        try:
            lead = _save_lead(rec, buy_box, iid, repos, campaign_id=campaign_id)
        except Exception as exc:
            logger.warning("pipeline.step4.save_error", address=rec.get("address"), error=str(exc))
            return None

        # Save contact info
        try:
            _save_contact(lead.id, contact_data, repos)  # type: ignore[arg-type]
            if contact_data.get("owner_name"):
                _update_lead_partial(lead.id, repos, investor_id=iid, owner_name=contact_data["owner_name"])  # type: ignore[arg-type]
        except Exception as exc:
            logger.warning("pipeline.step4.contact_error", address=lead.address, error=str(exc))

        addr = f"{lead.address}, {lead.city}, {lead.state}"

        # Zip lookup first, then fetch Zillow data (photos + comps together)
        async def _zip_lookup() -> Optional[str]:
            if lead.zip:
                return lead.zip
            z = await asyncio.to_thread(lookup_zip, addr)
            if z:
                _update_lead_partial(lead.id, repos, investor_id=iid, zip=z)  # type: ignore[arg-type]
            return z

        zip_code = await _zip_lookup()

        # Fetch Zillow data: comps + property photos (one Apify call)
        comps_data = await get_zillow_comps(
            address=lead.address,
            zip_code=zip_code,
            subject_sqft=lead.sqft,
            bedrooms=lead.bedrooms,
            bathrooms=lead.bathrooms,
        )
        photos_list = comps_data.get("photos", [])
        _update_lead_partial(lead.id, repos, investor_id=iid, comps=comps_data.get("comps"), photos=photos_list or None)  # type: ignore[arg-type]

        # Use Zillow photo analysis if available, else fall back to Street View
        photo_analysis = comps_data.get("photo_analysis")
        if not photo_analysis or photo_analysis.get("confidence", 0) < 0.3:
            photo_analysis = await analyze_property_photos(addr)

        # Calculate repair estimate from breakdown
        repair_breakdown = photo_analysis.get("repair_breakdown") or {}
        repair_estimate = sum(v for v in repair_breakdown.values() if isinstance(v, (int, float)) and v) or None

        _update_lead_partial(
            lead.id,  # type: ignore[arg-type]
            repos,
            investor_id=iid,
            photo_condition=photo_analysis.get("overall_condition"),
            photo_roof_condition=photo_analysis.get("roof_condition"),
            photo_vacant=photo_analysis.get("appears_vacant"),
            photo_major_issues=photo_analysis.get("major_issues_visible"),
            photo_confidence=photo_analysis.get("confidence"),
            description=photo_analysis.get("summary") or None,
            investment_type=photo_analysis.get("investment_type") or None,
            repair_estimate=repair_estimate,
            repair_breakdown=repair_breakdown if repair_breakdown else None,
        )

        # Offer — use Zillow comps if available, else fall back to assessed value
        subject_sqft = lead.sqft
        if not subject_sqft:
            comp_sqfts = sorted(c["sqft"] for c in comps_data.get("comps", []) if c.get("sqft"))
            if comp_sqfts:
                subject_sqft = comp_sqfts[len(comp_sqfts) // 2]

        # State assessment ratios (assessed value → FMV)
        _ASSESSMENT_RATIO: Dict[str, float] = {
            "GA": 0.40, "TX": 0.85, "FL": 0.85, "NC": 1.00, "SC": 1.00,
        }
        assessed = lead.assessed_value or lead.price

        offer = calculate_offer(
            sqft=subject_sqft,
            avg_price_per_sqft=comps_data.get("avg_price_per_sqft"),
            comp_count=comps_data.get("comp_count", 0),
            photo_condition=photo_analysis.get("overall_condition"),
            photo_major_issues=photo_analysis.get("major_issues_visible"),
            flood_risk_high=False,
            photo_confidence=photo_analysis.get("confidence"),
            comps_needs_review=comps_data.get("needs_review", True),
            assessed_value_fallback=assessed,
            assessment_ratio=_ASSESSMENT_RATIO.get(buy_box.state.upper(), 0.70),
        )

        _update_lead_partial(
            lead.id,  # type: ignore[arg-type]
            repos,
            investor_id=iid,
            arv=offer.get("arv"),
            offer_price=offer.get("offer_price"),
            pipeline_recommendation=offer.get("pipeline_recommendation"),
            review_reasons=offer.get("review_reasons"),
        )

        repos.leads.update_status(lead.id, LeadStatus.SKIP_TRACED, investor_id=iid)  # type: ignore[arg-type]

        # Auto-send opening SMS via the negotiation agent (Claude crafts the message)
        phones = contact_data.get("phones", [])
        if phones and offer.get("offer_price"):
            try:
                from src.agents.negotiation import start_outreach
                outreach_result = await asyncio.to_thread(start_outreach, lead.id, repos)  # type: ignore[arg-type]
                if outreach_result.get("sent"):
                    now_iso = datetime.now(timezone.utc).isoformat()
                    repos.db.table("outreach_messages").insert({
                        "lead_id": str(lead.id),
                        "campaign_id": str(campaign_id),
                        "investor_id": str(iid),
                        "phone": phones[0],
                        "body": outreach_result.get("sms", ""),
                        "message_id": outreach_result.get("message_id", ""),
                        "status": "sent",
                        "error": None,
                        "sent_at": now_iso,
                    }).execute()
                    repos.db.table("leads").update({
                        "outreach_status": "contacted",
                        "updated_at": now_iso,
                    }).eq("id", str(lead.id)).execute()
            except Exception as exc:
                logger.warning("pipeline.sms.failed", address=lead.address, error=str(exc)[:200])

        logger.info(
            "pipeline.lead.done",
            address=lead.address,
            phones=len(phones),
            arv=offer.get("arv"),
            offer=offer.get("offer_price"),
        )

        return {
            "id": str(lead.id),
            "address": lead.address,
            "owner_name": contact_data.get("owner_name"),
            "phones": phones,
            "arv": offer.get("arv"),
            "offer": offer.get("offer_price"),
        }

    enrich_sem = asyncio.Semaphore(5)  # cap concurrent Playwright browser sessions

    async def _enrich_gated(rec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with enrich_sem:
            return await _enrich_lead(rec)

    lead_results = await asyncio.gather(*[_enrich_gated(r) for r in qualified])
    saved = [r for r in lead_results if r is not None]
    summary["saved"] = len(saved)
    summary["leads"] = saved

    repos.campaigns.update(campaign_id, status="complete", saved_count=len(saved))

    logger.info(
        "pipeline.complete",
        campaign_id=str(campaign_id),
        county=buy_box.county,
        scraped=summary["scraped"],
        filtered=summary["filtered"],
        skip_traced=summary["skip_traced"],
        saved=summary["saved"],
    )
    return summary
