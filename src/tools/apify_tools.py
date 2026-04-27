from __future__ import annotations
"""
Apify-based tools for lead scraping and contact enrichment.
All tools return plain dicts so they can be passed directly as tool results to Claude.
from __future__ import annotations
"""

import json
from typing import Any

from apify_client import ApifyClient

from src.core.config import settings

_client = ApifyClient(settings.apify_token)


# ---------------------------------------------------------------------------
# Lead sources
# ---------------------------------------------------------------------------

def scrape_zillow_fsbo(city: str, state: str, max_results: int = 50) -> list[dict]:
    """Scrape FSBO listings from Zillow for a given city/state."""
    run = _client.actor("maxcopell/zillow-scraper").call(
        run_input={
            "searchUrls": [
                {"url": f"https://www.zillow.com/homes/for_sale/{city}-{state}/?searchQueryState=%7B%22isForSaleByOwner%22%3Atrue%7D"}
            ],
            "maxItems": max_results,
        }
    )
    items = list(_client.dataset(run["defaultDatasetId"]).iterate_items())
    return [_normalize_zillow(item) for item in items]


def scrape_craigslist_realestate(city: str, max_results: int = 50) -> list[dict]:
    """Scrape Craigslist real estate for sale by owner listings."""
    run = _client.actor("dtrungtin/craigslist-scraper").call(
        run_input={
            "startUrls": [{"url": f"https://{city.lower()}.craigslist.org/search/reo"}],
            "maxItems": max_results,
        }
    )
    items = list(_client.dataset(run["defaultDatasetId"]).iterate_items())
    return [_normalize_craigslist(item) for item in items]


def get_county_property_records(address: str, county: str, state: str) -> dict:
    """Pull property and ownership data from public county records."""
    run = _client.actor("apify/web-scraper").call(
        run_input={
            "startUrls": [
                {"url": f"https://www.{county.lower().replace(' ', '')}county{state.lower()}.gov/property/?search={address.replace(' ', '+')}"}
            ],
            "pageFunction": """
                async function pageFunction(context) {
                    const { $ } = context;
                    return {
                        address: $('[data-field="address"]').text().trim(),
                        owner: $('[data-field="owner"]').text().trim(),
                        assessed_value: $('[data-field="assessed_value"]').text().trim(),
                        tax_status: $('[data-field="tax_status"]').text().trim(),
                        year_built: $('[data-field="year_built"]').text().trim(),
                        sqft: $('[data-field="sqft"]').text().trim(),
                        lot_size: $('[data-field="lot_size"]').text().trim(),
                        zoning: $('[data-field="zoning"]').text().trim(),
                    };
                }
            """,
            "maxRequestsPerCrawl": 1,
        }
    )
    items = list(_client.dataset(run["defaultDatasetId"]).iterate_items())
    return items[0] if items else {}


def get_tax_delinquent_list(county: str, state: str, max_results: int = 100) -> list[dict]:
    """Fetch tax delinquent property list from county records."""
    run = _client.actor("apify/web-scraper").call(
        run_input={
            "startUrls": [
                {"url": f"https://www.{county.lower().replace(' ', '')}county{state.lower()}.gov/tax/delinquent"}
            ],
            "pageFunction": """
                async function pageFunction(context) {
                    const { $ } = context;
                    const results = [];
                    $('table tr').each((i, row) => {
                        if (i === 0) return;
                        const cols = $(row).find('td');
                        results.push({
                            parcel_id: $(cols[0]).text().trim(),
                            owner: $(cols[1]).text().trim(),
                            address: $(cols[2]).text().trim(),
                            amount_owed: $(cols[3]).text().trim(),
                            years_delinquent: $(cols[4]).text().trim(),
                        });
                    });
                    return results;
                }
            """,
            "maxRequestsPerCrawl": 5,
        }
    )
    items = list(_client.dataset(run["defaultDatasetId"]).iterate_items())
    flat = []
    for item in items:
        if isinstance(item, list):
            flat.extend(item)
        else:
            flat.append(item)
    return flat[:max_results]


# ---------------------------------------------------------------------------
# Contact enrichment (skip tracing)
# ---------------------------------------------------------------------------

def enrich_contact(property_address: str, owner_name: str = "") -> dict:
    """
    Skip trace a property owner using one-api/skip-trace.
    Works with address alone — owner_name improves accuracy but isn't required.
    The actor will attempt to find the owner name if not provided.
    """
    run_input: dict = {"address": property_address, "maxResults": 3}

    if owner_name:
        parts = owner_name.strip().split()
        run_input["firstName"] = parts[0]
        if len(parts) > 1:
            run_input["lastName"] = " ".join(parts[1:])

    try:
        run = _client.actor("one-api/skip-trace").call(run_input=run_input)
        items = list(_client.dataset(run["defaultDatasetId"]).iterate_items())
    except Exception:
        return {"owner_name": owner_name, "phones": [], "emails": [], "confidence": 0.0}

    if not items:
        return {"owner_name": owner_name, "phones": [], "emails": [], "confidence": 0.0}

    result = items[0]

    raw_phones = result.get("phones", [])
    phones = [p["number"] if isinstance(p, dict) else p for p in raw_phones]

    raw_emails = result.get("emails", [])
    emails = [e["address"] if isinstance(e, dict) else e for e in raw_emails]

    found_name = (
        result.get("fullName")
        or result.get("name")
        or f"{result.get('firstName', '')} {result.get('lastName', '')}".strip()
        or owner_name
    )

    return {
        "owner_name": found_name,
        "phones": phones,
        "emails": emails,
        "mailing_address": result.get("address", ""),
        "confidence": result.get("score", result.get("confidence", 0.5)),
    }


def get_comparable_sales(address: str, city: str, state: str, radius_miles: float = 1.0) -> list[dict]:
    """Pull recent comparable sales (comps) from Redfin via Apify."""
    run = _client.actor("maxcopell/redfin-scraper").call(
        run_input={
            "startUrls": [
                {"url": f"https://www.redfin.com/city/{city.lower()}/{state.upper()}/filter/include=sold-3mo,property-type=house"}
            ],
            "maxItems": 20,
        }
    )
    items = list(_client.dataset(run["defaultDatasetId"]).iterate_items())
    return [_normalize_comp(item) for item in items]


# ---------------------------------------------------------------------------
# Normalizers
# ---------------------------------------------------------------------------

def _normalize_zillow(item: dict) -> dict:
    return {
        "source": "zillow",
        "address": item.get("address", ""),
        "city": item.get("city", ""),
        "state": item.get("state", ""),
        "zip": item.get("zipcode", ""),
        "price": item.get("price", 0),
        "bedrooms": item.get("bedrooms", 0),
        "bathrooms": item.get("bathrooms", 0),
        "sqft": item.get("livingArea", 0),
        "listing_url": item.get("url", ""),
        "days_on_market": item.get("daysOnMarket", 0),
        "status": item.get("homeStatus", ""),
        "description": item.get("description", ""),
    }


def _normalize_craigslist(item: dict) -> dict:
    return {
        "source": "craigslist",
        "address": item.get("title", ""),
        "price": item.get("price", 0),
        "listing_url": item.get("url", ""),
        "description": item.get("description", ""),
    }


def _normalize_comp(item: dict) -> dict:
    return {
        "address": item.get("address", ""),
        "sold_price": item.get("price", 0),
        "sqft": item.get("sqft", 0),
        "bedrooms": item.get("beds", 0),
        "bathrooms": item.get("baths", 0),
        "sold_date": item.get("soldDate", ""),
        "price_per_sqft": item.get("pricePerSqFt", 0),
    }
