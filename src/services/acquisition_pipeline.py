from __future__ import annotations

"""
6-step acquisition pipeline:
  1. Scrape county records (Browserbase + Claude)
  2. FEMA flood zone check (Browserbase + Claude)
  3. Property photos + vision analysis (Browserbase + Claude vision)
  4. Zillow sold comps (Browserbase + Claude)
  5. Offer calculation (pure Python)
  6. Apify skip-trace enrichment (for 'pursue' leads only)
"""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from supabase import Client

from src.core.logging import get_logger
from src.models.buy_box import BuyBox
from src.models.contact import Contact
from src.models.lead import Lead, LeadStatus
from src.repositories import Repositories
from src.tools.apify_tools import enrich_contact
from src.tools.county_scraper import scrape_county_records
from src.tools.fema_checker import check_fema_flood_zone, lookup_zip
from src.tools.offer_calculator import calculate_offer
from src.tools.photo_analyzer import analyze_property_photos
from src.tools.zillow_comps import get_zillow_comps

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Buy-box filter
# ---------------------------------------------------------------------------

def _matches_buy_box(rec: Dict[str, Any], buy_box: BuyBox) -> bool:
    """Return True if a raw county record falls within the buy box."""
    prop_type = (rec.get("property_type") or "").lower().replace(" ", "_")
    if buy_box.property_types and prop_type:
        if not any(t in prop_type or prop_type in t for t in buy_box.property_types):
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
            assessed_int = int(float(str(assessed)))
            if buy_box.max_price and assessed_int > buy_box.max_price:
                return False
            if buy_box.min_price and assessed_int < buy_box.min_price:
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
# Step helpers
# ---------------------------------------------------------------------------

def _save_lead(rec: Dict[str, Any], buy_box: BuyBox, investor_id: Optional[UUID], repos: Repositories) -> Lead:
    lead = Lead(
        source="county_records",
        investor_id=investor_id,
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
    """Patch arbitrary columns on a lead row, scoped to investor when provided."""
    payload = {k: v for k, v in fields.items() if v is not None}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    q = repos.leads._db.table("leads").update(payload).eq("id", str(lead_id))
    if investor_id:
        q = q.eq("investor_id", str(investor_id))
    q.execute()


def _save_contact(lead_id: UUID, contact_data: Dict[str, Any], repos: Repositories) -> None:
    phones = contact_data.get("phones", [])
    emails = contact_data.get("emails", [])
    contact = Contact(
        lead_id=lead_id,
        owner_name=contact_data.get("owner_name"),
        phones=phones,
        emails=emails,
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
    max_leads: int = 10,
) -> Dict[str, Any]:
    """
    Run all 6 steps. Returns a summary dict with per-lead results.
    max_leads caps how many leads are processed through steps 2-6 in one run.
    """
    repos = Repositories(db)
    summary: Dict[str, Any] = {
        "county": buy_box.county,
        "state": buy_box.state,
        "scraped": 0,
        "filtered": 0,
        "saved": 0,
        "pursue": 0,
        "needs_review": 0,
        "skip": 0,
        "enriched": 0,
        "leads": [],
    }

    # ── Step 1: Scrape county records ─────────────────────────────────────────
    logger.info("pipeline.step1.start", county=buy_box.county, state=buy_box.state)
    raw_records = await scrape_county_records(buy_box.county, buy_box.state, buy_box.city)
    summary["scraped"] = len(raw_records)
    logger.info("pipeline.step1.done", scraped=len(raw_records))

    # Filter to buy box
    matching = [r for r in raw_records if _matches_buy_box(r, buy_box)]
    summary["filtered"] = len(matching)
    logger.info("pipeline.step1.filtered", matching=len(matching))

    # Save all matching leads first
    saved_leads: List[Lead] = []
    for rec in matching:
        if not rec.get("address", "").strip():
            continue
        try:
            lead = _save_lead(rec, buy_box, investor_id, repos)
            saved_leads.append(lead)
        except Exception as exc:
            logger.warning("pipeline.step1.save_error", address=rec.get("address"), error=str(exc))

    summary["saved"] = len(saved_leads)
    logger.info("pipeline.step1.saved", saved=len(saved_leads))

    # Cap how many leads we run through steps 2-6 in this pass
    process_leads = saved_leads[:max_leads]

    # ── Steps 2-6 per lead ───────────────────────────────────────────────────
    for lead in process_leads:
        lead_result: Dict[str, Any] = {
            "id": str(lead.id),
            "address": lead.address,
            "flood_zone": None,
            "photo_condition": None,
            "comp_count": 0,
            "arv": None,
            "offer": None,
            "recommendation": None,
            "review_reasons": [],
            "skip_traced": False,
        }

        iid = investor_id  # shorthand for investor_id filter in all partial updates

        # ── Step 2: FEMA flood zone ───────────────────────────────────────────
        logger.info("pipeline.step2.start", address=lead.address)
        fema = await check_fema_flood_zone(f"{lead.address}, {lead.city}, {lead.state}")
        _update_lead_partial(
            lead.id,  # type: ignore[arg-type]
            repos,
            investor_id=iid,
            flood_zone=fema.get("zone"),
            flood_risk_high=fema.get("flood_risk_high"),
        )
        lead_result["flood_zone"] = fema.get("zone")
        logger.info("pipeline.step2.done", address=lead.address, zone=fema.get("zone"))

        # ── Step 3: Property photos ───────────────────────────────────────────
        logger.info("pipeline.step3.start", address=lead.address)
        photos = await analyze_property_photos(f"{lead.address}, {lead.city}, {lead.state}")
        _update_lead_partial(
            lead.id,  # type: ignore[arg-type]
            repos,
            investor_id=iid,
            photo_condition=photos.get("overall_condition"),
            photo_roof_condition=photos.get("roof_condition"),
            photo_vacant=photos.get("appears_vacant"),
            photo_major_issues=photos.get("major_issues_visible"),
            photo_confidence=photos.get("confidence"),
        )
        lead_result["photo_condition"] = photos.get("overall_condition")
        logger.info(
            "pipeline.step3.done",
            address=lead.address,
            condition=photos.get("overall_condition"),
            confidence=photos.get("confidence"),
        )

        # ── Step 4: Zillow comps ──────────────────────────────────────────────
        # Resolve zip if missing (Census geocoder)
        zip_code = lead.zip
        if not zip_code:
            full_addr = f"{lead.address}, {lead.city}, {lead.state}"
            zip_code = await asyncio.to_thread(lookup_zip, full_addr)
            if zip_code:
                _update_lead_partial(lead.id, repos, investor_id=iid, zip=zip_code)  # type: ignore[arg-type]
                logger.info("pipeline.step4.zip_lookup", address=lead.address, zip=zip_code)

        logger.info("pipeline.step4.start", address=lead.address)
        comps_data = await get_zillow_comps(
            address=lead.address,
            zip_code=zip_code,
            subject_sqft=lead.sqft,
            bedrooms=lead.bedrooms,
            bathrooms=lead.bathrooms,
        )
        _update_lead_partial(
            lead.id,  # type: ignore[arg-type]
            repos,
            investor_id=iid,
            comps=comps_data.get("comps"),
        )
        lead_result["comp_count"] = comps_data.get("comp_count", 0)
        logger.info("pipeline.step4.done", address=lead.address, comps=comps_data.get("comp_count"))

        # ── Step 5: Offer calculation ─────────────────────────────────────────
        # Estimate sqft from comps median if county record didn't include it
        subject_sqft = lead.sqft
        if not subject_sqft:
            comp_sqfts = [c["sqft"] for c in comps_data.get("comps", []) if c.get("sqft")]
            if comp_sqfts:
                comp_sqfts_sorted = sorted(comp_sqfts)
                mid = len(comp_sqfts_sorted) // 2
                subject_sqft = comp_sqfts_sorted[mid]
                logger.info("pipeline.step5.sqft_estimated", address=lead.address, estimated_sqft=subject_sqft)

        logger.info("pipeline.step5.start", address=lead.address)
        offer = calculate_offer(
            sqft=subject_sqft,
            avg_price_per_sqft=comps_data.get("avg_price_per_sqft"),
            comp_count=comps_data.get("comp_count", 0),
            photo_condition=photos.get("overall_condition"),
            photo_major_issues=photos.get("major_issues_visible"),
            flood_risk_high=fema.get("flood_risk_high"),
            photo_confidence=photos.get("confidence"),
            comps_needs_review=comps_data.get("needs_review", True),
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
        lead_result["arv"] = offer.get("arv")
        lead_result["offer"] = offer.get("offer_price")
        lead_result["recommendation"] = offer.get("pipeline_recommendation")
        review_reasons = list(offer.get("review_reasons", []))
        if subject_sqft and not lead.sqft:
            review_reasons.append(f"sqft estimated from comps ({subject_sqft} sqft) — verify before offer")
        lead_result["review_reasons"] = review_reasons
        logger.info(
            "pipeline.step5.done",
            address=lead.address,
            arv=offer.get("arv"),
            offer=offer.get("offer_price"),
            recommendation=offer.get("pipeline_recommendation"),
        )

        rec = offer.get("pipeline_recommendation", "needs_review")
        if rec == "pursue":
            summary["pursue"] += 1
        elif rec == "needs_review":
            summary["needs_review"] += 1
        else:
            summary["skip"] += 1

        # ── Step 6: Skip trace (pursue only) ─────────────────────────────────
        if rec == "pursue":
            logger.info("pipeline.step6.start", address=lead.address)
            try:
                owner = lead.owner_name or ""
                contact_data = enrich_contact(
                    f"{lead.address}, {lead.city}, {lead.state}",
                    owner,
                )
                _save_contact(lead.id, contact_data, repos)  # type: ignore[arg-type]
                repos.leads.update_status(lead.id, LeadStatus.ENRICHED, investor_id=iid)  # type: ignore[arg-type]
                lead_result["skip_traced"] = True
                summary["enriched"] += 1
                logger.info(
                    "pipeline.step6.done",
                    address=lead.address,
                    phones=len(contact_data.get("phones", [])),
                    emails=len(contact_data.get("emails", [])),
                )
            except Exception as exc:
                logger.error("pipeline.step6.error", address=lead.address, error=str(exc))

        summary["leads"].append(lead_result)

    logger.info(
        "pipeline.complete",
        county=buy_box.county,
        scraped=summary["scraped"],
        saved=summary["saved"],
        pursue=summary["pursue"],
        needs_review=summary["needs_review"],
        enriched=summary["enriched"],
    )
    return summary
