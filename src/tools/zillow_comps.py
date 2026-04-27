from __future__ import annotations

"""
Zillow sold comps — Firecrawl scrapes sold listings page, GPT-4o parses.
Firecrawl handles JS rendering + stealth proxy. No Playwright.
"""

import asyncio
import json
from typing import Any, Dict, List, Optional

from firecrawl import V1FirecrawlApp
from openai import AsyncOpenAI

from src.core.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

_PARSE_SYSTEM = """You are a real estate data extractor. Given the text content of a recently-sold listings page (Redfin or Zillow), extract all sold property listings.

Redfin shows prices as "$XXX,XXXLast list price" or just "$XXX,XXX" near a "SOLD" date — treat these as the sale price.
Zillow shows prices similarly near address links.

Return a JSON object with a single key "listings" containing an array. Each item must have:
- address (string)
- sale_price (integer, dollars, no commas — use the listed/sold price)
- sqft (integer)
- bedrooms (integer)
- bathrooms (number)
- sold_date (string, e.g. "2024-11-15" — parse "SOLD MAR 16, 2026" as "2026-03-16")
- price_per_sqft (integer, sale_price / sqft)

Only include listings where you have at least sale_price and sqft. Omit fields you cannot find rather than guessing.
Return JSON only. No other text."""


def _scrape_markdown(zip_code: str) -> str:
    """Scrape recently-sold listings. Tries Redfin first (shows real prices), Zillow fallback."""
    fc = V1FirecrawlApp(api_key=settings.firecrawl_api_key)
    urls = [
        f"https://www.redfin.com/zipcode/{zip_code}/filter/property-type=house,include=sold-3mo",
        f"https://www.zillow.com/homes/recently_sold/{zip_code}/",
    ]
    for url in urls:
        try:
            resp = fc.scrape_url(
                url,
                formats=["markdown"],
                proxy="stealth",
                only_main_content=True,
                wait_for=3000,
                timeout=45000,
            )
            md = (resp.markdown or "") if resp else ""
            if md and len(md) > 500:
                logger.debug("zillow_comps.scrape_ok", url=url, chars=len(md))
                return md
        except Exception as exc:
            logger.error("zillow_comps.scrape_error", url=url, zip=zip_code, error=str(exc))
    return ""


async def get_zillow_comps(
    address: str,
    zip_code: Optional[str],
    subject_sqft: Optional[int],
    bedrooms: Optional[int],
    bathrooms: Optional[float],
) -> Dict[str, Any]:
    """Scrape Zillow sold comps via Firecrawl + GPT-4o parsing."""
    empty: Dict[str, Any] = {
        "comps": [],
        "avg_price_per_sqft": None,
        "comp_count": 0,
        "needs_review": True,
    }

    if not zip_code:
        logger.warning("zillow_comps.no_zip", address=address)
        return empty

    markdown = await asyncio.to_thread(_scrape_markdown, zip_code)
    if not markdown:
        logger.warning("zillow_comps.no_content", zip=zip_code)
        return empty

    sqft_low = int(subject_sqft * 0.8) if subject_sqft else 0
    sqft_high = int(subject_sqft * 1.2) if subject_sqft else 99999

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": _PARSE_SYSTEM},
                {"role": "user", "content": (
                    f"Subject property: {address} (zip {zip_code})\n"
                    f"Subject: {subject_sqft} sqft, {bedrooms} bed, {bathrooms} bath\n"
                    f"Target sqft range: {sqft_low}–{sqft_high}\n\n"
                    f"Page content:\n{markdown[:8000]}\n\n"
                    f"Extract listings matching beds/baths and sqft range from last 12 months. Return JSON."
                )},
            ],  # type: ignore[arg-type]
            max_tokens=2048,
        )
        text = response.choices[0].message.content or ""
        start, end = text.find("{"), text.rfind("}") + 1
        if start < 0 or end <= start:
            logger.warning("zillow_comps.no_json", zip=zip_code)
            return empty

        parsed = json.loads(text[start:end])
        listings: List[Dict[str, Any]] = parsed.get("listings", [])
    except Exception as exc:
        logger.error("zillow_comps.parse_error", zip=zip_code, error=str(exc))
        return empty

    valid = [c for c in listings if c.get("sale_price") and c.get("sqft") and c["sqft"] > 0]
    if valid:
        ppsf_values = []
        for c in valid:
            ppsf = c.get("price_per_sqft") or (c["sale_price"] // c["sqft"])
            c["price_per_sqft"] = ppsf
            ppsf_values.append(ppsf)
        avg_ppsf = int(sum(ppsf_values) / len(ppsf_values))
    else:
        avg_ppsf = None

    result = {
        "comps": valid,
        "avg_price_per_sqft": avg_ppsf,
        "comp_count": len(valid),
        "needs_review": len(valid) < 3,
    }
    logger.info("zillow_comps.done", address=address, count=len(valid), avg_ppsf=avg_ppsf)
    return result
