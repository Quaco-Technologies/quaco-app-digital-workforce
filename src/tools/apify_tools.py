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
# Contact enrichment (skip tracing) — Apify one-api/skip-trace
# ---------------------------------------------------------------------------

def _fmt_street_citystatezip(address: str) -> str:
    """'123 Main St, Atlanta, GA 30301' → '123 Main St; Atlanta, GA 30301'"""
    parts = address.split(",", 1)
    if len(parts) == 2:
        return f"{parts[0].strip()}; {parts[1].strip()}"
    return address


def enrich_contact(property_address: str, owner_name: str = "") -> dict:
    """
    Skip trace a property owner using one-api/skip-trace.

    Correct input format (discovered from working runs):
      street_citystatezip: ["STREET; City, State Zip"]
      name: ["Full Name; City, State Zip"]  (optional, improves match)
    """
    street_entry = _fmt_street_citystatezip(property_address)

    run_input: dict = {
        "street_citystatezip": [street_entry],
        "max_results_per_query": 5,
        "max_results": 5,
    }

    if owner_name:
        # Extract city/state/zip from the address to pair with the name
        parts = property_address.split(",", 1)
        city_state_zip = parts[1].strip() if len(parts) == 2 else ""
        if city_state_zip:
            run_input["name"] = [f"{owner_name}; {city_state_zip}"]

    try:
        run = _client.actor("one-api/skip-trace").call(run_input=run_input)
        items = list(_client.dataset(run["defaultDatasetId"]).iterate_items())
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("skip_trace.apify_error %s", str(exc)[:200])
        return {"owner_name": owner_name, "phones": [], "emails": [], "confidence": 0.0}

    if not items:
        return {"owner_name": owner_name, "phones": [], "emails": [], "confidence": 0.0}

    # Results are flat dicts with keys Phone-1..Phone-5, Email-1..Email-5
    result = items[0]

    phones = [
        str(result[f"Phone-{i}"]).strip()
        for i in range(1, 6)
        if result.get(f"Phone-{i}", "").strip()
    ]
    emails = [
        str(result[f"Email-{i}"]).strip()
        for i in range(1, 6)
        if result.get(f"Email-{i}", "").strip()
    ]

    first = result.get("First Name", "")
    last = result.get("Last Name", "")
    found_name = f"{first} {last}".strip() or owner_name

    mailing = ", ".join(filter(None, [
        result.get("Street Address", ""),
        result.get("Address Locality", ""),
        result.get("Address Region", ""),
        result.get("Postal Code", ""),
    ]))

    return {
        "owner_name": found_name,
        "phones": phones,
        "emails": emails,
        "mailing_address": mailing,
        "confidence": 0.8 if phones else 0.3,
    }


def _parse_skip_trace_result(result: dict, fallback_owner: str = "") -> dict:
    """Parse a single skip-trace result row into our contact schema."""
    phones = [
        str(result[f"Phone-{i}"]).strip()
        for i in range(1, 6)
        if result.get(f"Phone-{i}", "").strip()
    ]
    emails = [
        str(result[f"Email-{i}"]).strip()
        for i in range(1, 6)
        if result.get(f"Email-{i}", "").strip()
    ]
    first = result.get("First Name", "")
    last = result.get("Last Name", "")
    found_name = f"{first} {last}".strip() or fallback_owner
    mailing = ", ".join(filter(None, [
        result.get("Street Address", ""),
        result.get("Address Locality", ""),
        result.get("Address Region", ""),
        result.get("Postal Code", ""),
    ]))
    return {
        "owner_name": found_name,
        "phones": phones,
        "emails": emails,
        "mailing_address": mailing,
        "confidence": 0.8 if phones else 0.3,
    }


def batch_enrich_contacts(
    records: list[dict],
    default_city: str = "",
    default_state: str = "",
) -> dict[str, dict | None]:
    """
    Batch skip-trace all records in a single Apify actor call.

    The actor accepts arrays of address and name queries, tagging each result
    with "Input Given" so we can map results back to the original address.

    Returns: {address_string: contact_dict | None}
      contact_dict has phones, emails, owner_name, mailing_address, confidence.
      None means no results found.
    """
    street_entries: list[str] = []
    name_entries: list[str] = []
    key_to_rec: dict[str, dict] = {}

    for rec in records:
        addr = rec.get("address", "").strip()
        if not addr:
            continue
        owner = rec.get("owner_name", "")
        rec_city = rec.get("city") or default_city
        rec_state = rec.get("state") or default_state
        zip_ = rec.get("zip", "")
        city_state_zip = f"{rec_city}, {rec_state}" + (f" {zip_}" if zip_ else "")

        street_key = f"{addr}; {city_state_zip}"
        street_entries.append(street_key)
        key_to_rec[street_key] = rec

        if owner:
            name_key = f"{owner}; {city_state_zip}"
            name_entries.append(name_key)
            key_to_rec[name_key] = rec

    if not street_entries:
        return {}

    run_input: dict = {
        "street_citystatezip": street_entries,
        "max_results_per_query": 3,
        "max_results": 3,
    }
    if name_entries:
        run_input["name"] = name_entries

    import logging
    log = logging.getLogger(__name__)
    try:
        run = _client.actor("one-api/skip-trace").call(run_input=run_input)
        items = list(_client.dataset(run["defaultDatasetId"]).iterate_items())
    except Exception as exc:
        log.warning("skip_trace.batch_error %s", str(exc)[:200])
        return {}

    # Group best result per input key (first result with phones wins)
    best_by_key: dict[str, dict] = {}
    for item in items:
        key = item.get("Input Given", "").strip()
        if not key:
            continue
        existing = best_by_key.get(key)
        phones_in_item = any(item.get(f"Phone-{i}", "").strip() for i in range(1, 6))
        if existing is None or (phones_in_item and not any(existing.get(f"Phone-{j}", "").strip() for j in range(1, 6))):
            best_by_key[key] = item

    # Map back to original address strings
    contacts: dict[str, dict | None] = {}
    for rec in records:
        addr = rec.get("address", "").strip()
        if not addr:
            continue
        owner = rec.get("owner_name", "")
        rec_city = rec.get("city") or default_city
        rec_state = rec.get("state") or default_state
        zip_ = rec.get("zip", "")
        city_state_zip = f"{rec_city}, {rec_state}" + (f" {zip_}" if zip_ else "")

        result = best_by_key.get(f"{addr}; {city_state_zip}")
        if not result and owner:
            result = best_by_key.get(f"{owner}; {city_state_zip}")

        contacts[addr] = _parse_skip_trace_result(result, owner) if result else None

    return contacts


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
