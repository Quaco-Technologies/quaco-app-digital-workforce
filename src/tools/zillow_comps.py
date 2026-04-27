from __future__ import annotations

"""
Zillow property data via Apify — comps + photos for a specific address.
Replaces the Playwright scraper which gets bot-blocked at scale.
"""

import json
from typing import Any, Dict, List, Optional

from apify_client import ApifyClient
from openai import AsyncOpenAI

from src.core.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

_ZILLOW_ACTOR = "maxcopell/zillow-scraper"


def _apify_client() -> ApifyClient:
    return ApifyClient(settings.apify_token)


def _zillow_search_sync(url: str, max_items: int = 30) -> List[Dict]:
    client = _apify_client()
    try:
        run = client.actor(_ZILLOW_ACTOR).call(
            run_input={"searchUrls": [{"url": url}], "maxItems": max_items},
            timeout_secs=180,
        )
        return list(client.dataset(run["defaultDatasetId"]).iterate_items())
    except Exception as exc:
        logger.warning("zillow_apify.error", url=url, error=str(exc)[:200])
        return []


def _extract_comps(items: List[Dict]) -> List[Dict]:
    comps = []
    for item in items:
        sqft = item.get("livingArea") or item.get("resoFacts", {}).get("livingArea")
        price = item.get("price") or item.get("lastSoldPrice")
        if not sqft or not price or sqft <= 0:
            continue
        sold_date = (
            item.get("dateSold")
            or item.get("lastSoldDate")
            or item.get("soldDate", "")
        )
        comps.append({
            "address": item.get("address", ""),
            "sale_price": int(price),
            "sqft": int(sqft),
            "bedrooms": item.get("bedrooms"),
            "bathrooms": item.get("bathrooms"),
            "sold_date": str(sold_date)[:10] if sold_date else "",
            "price_per_sqft": int(price / sqft),
        })
    return comps


def _extract_photos(item: Dict) -> List[str]:
    raw = item.get("photos") or item.get("originalPhotos") or []
    urls = []
    for p in raw:
        if isinstance(p, str):
            urls.append(p)
        elif isinstance(p, dict):
            urls.append(p.get("url") or p.get("src") or "")
    return [u for u in urls if u]


_PHOTO_SYSTEM = """You are a property condition analyst and real estate renovation estimator. You will receive one or more photos from a real estate listing (interior and exterior shots).

Analyze ALL photos carefully and return JSON with exactly these keys:
- overall_condition: "excellent" | "good" | "fair" | "poor" | "unknown"
- roof_condition: "good" | "fair" | "poor" | "unknown"
- interior_condition: "excellent" | "good" | "fair" | "poor" | "unknown"
- appears_vacant: true | false
- major_issues_visible: true | false  (structural damage, fire damage, collapse, severe water damage)
- investment_type: "fix_and_flip" | "rental" | "turnkey" | "unknown"
- visible_damage_notes: string (empty string if none)
- summary: string (2–3 sentences describing the property condition and investment potential)
- confidence: 0.0–1.0
- repair_breakdown: object with keys for each repair category needed (only include items you can see evidence for):
  - roof: estimated cost in dollars or null
  - hvac: estimated cost in dollars or null
  - kitchen: estimated cost in dollars or null
  - bathrooms: estimated cost in dollars or null
  - flooring: estimated cost in dollars or null
  - windows: estimated cost in dollars or null
  - paint_interior: estimated cost in dollars or null
  - paint_exterior: estimated cost in dollars or null
  - landscaping: estimated cost in dollars or null
  - electrical: estimated cost in dollars or null
  - plumbing: estimated cost in dollars or null
  - foundation: estimated cost in dollars or null
  - other: estimated cost in dollars or null

Use realistic contractor pricing for the US market. Only include repair items you have evidence for from the photos. If a category looks fine, set it to null.

Return JSON only. No other text."""


async def analyze_zillow_photos(photos: List[str], address: str) -> Dict[str, Any]:
    default: Dict[str, Any] = {
        "overall_condition": "unknown",
        "interior_condition": "unknown",
        "roof_condition": "unknown",
        "appears_vacant": False,
        "major_issues_visible": False,
        "investment_type": "unknown",
        "visible_damage_notes": "",
        "summary": "",
        "confidence": 0.0,
        "repair_breakdown": {},
    }

    # Use up to 6 photos (mix of interior + exterior)
    usable = [u for u in photos if u][:6]
    if not usable:
        return default

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    content: List[Dict] = [{"type": "text", "text": f"Property: {address}\nAnalyze all photos for condition and investment type. Return JSON only."}]
    for url in usable:
        content.append({
            "type": "image_url",
            "image_url": {"url": url, "detail": "low"},
        })

    try:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": _PHOTO_SYSTEM},
                {"role": "user", "content": content},  # type: ignore[arg-type]
            ],
            max_tokens=600,
        )
        text = response.choices[0].message.content or ""
        start, end = text.find("{"), text.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(text[start:end])
            result = {**default, **parsed}
            logger.info(
                "zillow_photos.done",
                address=address,
                condition=result.get("overall_condition"),
                investment_type=result.get("investment_type"),
                confidence=result.get("confidence"),
            )
            return result
    except Exception as exc:
        logger.error("zillow_photos.error", address=address, error=str(exc)[:200])

    return default


async def get_zillow_comps(
    address: str,
    zip_code: Optional[str],
    subject_sqft: Optional[int],
    bedrooms: Optional[int],
    bathrooms: Optional[float],
) -> Dict[str, Any]:
    """
    Fetch sold comps from Zillow via Apify for the given zip code.
    Also attempts to fetch the specific property listing for photo analysis.
    Returns comps, avg_price_per_sqft, and photo data.
    """
    import asyncio

    empty: Dict[str, Any] = {
        "comps": [],
        "avg_price_per_sqft": None,
        "comp_count": 0,
        "needs_review": True,
        "photos": [],
        "photo_analysis": None,
    }

    if not zip_code:
        logger.warning("zillow_comps.no_zip", address=address)
        return empty

    # Fetch sold comps + property listing in parallel (both sync, run in threads)
    recently_sold_url = f"https://www.zillow.com/homes/recently_sold/{zip_code}/"
    city_state = address.replace(",", "").replace(" ", "-")
    property_url = f"https://www.zillow.com/homes/{zip_code}/"  # zip-level, find nearest match

    sold_items, prop_items = await asyncio.gather(
        asyncio.to_thread(_zillow_search_sync, recently_sold_url, 30),
        asyncio.to_thread(_zillow_search_sync, property_url, 5),
    )

    # Extract comps
    all_comps = _extract_comps(sold_items)
    sqft_low = int(subject_sqft * 0.75) if subject_sqft else 0
    sqft_high = int(subject_sqft * 1.25) if subject_sqft else 999999

    valid = [
        c for c in all_comps
        if (sqft_low <= c["sqft"] <= sqft_high)
        and (bedrooms is None or c["bedrooms"] is None or abs((c["bedrooms"] or 0) - (bedrooms or 0)) <= 1)
    ]
    # Fall back to all comps if too few match sqft filter
    if len(valid) < 2:
        valid = all_comps

    if valid:
        ppsf_vals = [c["price_per_sqft"] for c in valid if c["price_per_sqft"] > 0]
        avg_ppsf = int(sum(ppsf_vals) / len(ppsf_vals)) if ppsf_vals else None
    else:
        avg_ppsf = None

    # Extract photos from property listing results
    photos: List[str] = []
    for item in prop_items:
        photos = _extract_photos(item)
        if photos:
            break

    # Analyze photos with GPT-4 Vision
    photo_analysis: Optional[Dict] = None
    if photos:
        photo_analysis = await analyze_zillow_photos(photos, address)
        logger.info("zillow_comps.photos", address=address, count=len(photos))
    else:
        logger.info("zillow_comps.no_photos", address=address)

    result = {
        "comps": valid,
        "avg_price_per_sqft": avg_ppsf,
        "comp_count": len(valid),
        "needs_review": len(valid) < 3,
        "photos": photos[:6],
        "photo_analysis": photo_analysis,
    }
    logger.info("zillow_comps.done", address=address, comp_count=len(valid), avg_ppsf=avg_ppsf)
    return result
