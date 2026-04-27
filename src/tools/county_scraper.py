from __future__ import annotations

"""
County records scraper — ArcGIS REST API (primary) + Firecrawl AI (discovery).

Strategy:
  1. Look up cached ArcGIS endpoint for this county in the DB.
  2. If no endpoint cached, use Firecrawl (1 AI call) to discover the county's
     ArcGIS parcel feature service URL. Cache it forever.
  3. Query the ArcGIS REST API directly for up to 2000 residential parcels.
     This is free, instant, and returns real owner names + assessed values.
  4. If ArcGIS is unavailable for this county, fall back to Firecrawl AI extract.
"""

import asyncio
import json
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from src.core.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

_PROPERTY_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "properties": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "address":          {"type": "string"},
                    "city":             {"type": "string"},
                    "state":            {"type": "string"},
                    "zip":              {"type": "string"},
                    "apn":              {"type": "string"},
                    "owner_name":       {"type": "string"},
                    "assessed_value":   {"type": "integer"},
                    "improvement_value":{"type": "integer"},
                    "bedrooms":         {"type": "integer"},
                    "bathrooms":        {"type": "number"},
                    "sqft":             {"type": "integer"},
                    "year_built":       {"type": "integer"},
                    "property_type":    {"type": "string"},
                },
                "required": ["address"],
            },
        }
    },
    "required": ["properties"],
}


# ---------------------------------------------------------------------------
# DB cache helpers — store both the assessor URL and ArcGIS endpoint
# ---------------------------------------------------------------------------

def _get_county_cache(county: str, state: str) -> Optional[Dict[str, Any]]:
    try:
        from src.core.database import get_db
        db = get_db()
        res = (
            db.table("county_configs")
            .select("assessor_url,notes")
            .eq("county", county)
            .eq("state", state)
            .maybe_single()
            .execute()
        )
        if not res.data:
            return None
        data = res.data
        try:
            notes_parsed = json.loads(data.get("notes", ""))
            if isinstance(notes_parsed, dict):
                return {
                    "assessor_url": data.get("assessor_url", ""),
                    **notes_parsed,
                }
        except (json.JSONDecodeError, TypeError):
            pass
        return {"assessor_url": data.get("assessor_url", ""), "notes": data.get("notes", "")}
    except Exception as exc:
        logger.debug("county_cache.miss", county=county, state=state, error=str(exc))
        return None


def _save_county_cache(
    county: str,
    state: str,
    assessor_url: str = "",
    arcgis_url: str = "",
    notes: str = "",
) -> None:
    try:
        from datetime import datetime, timezone
        from src.core.database import get_db
        db = get_db()
        db.table("county_configs").upsert(
            {
                "county": county,
                "state": state,
                "assessor_url": assessor_url or "",
                "notes": json.dumps({"arcgis_url": arcgis_url, "description": notes}),
                "last_success_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="county,state",
        ).execute()
        logger.info("county_cache.saved", county=county, state=state, arcgis_url=arcgis_url[:60] if arcgis_url else "")
    except Exception as exc:
        logger.warning("county_cache.save_error", county=county, state=state, error=str(exc))


# ---------------------------------------------------------------------------
# ArcGIS REST API — primary data source (free, high volume)
# ---------------------------------------------------------------------------

def _first_attr(attrs: Dict, *keys: str) -> Any:
    """Return the first non-null value from attrs matching any of the given keys (case-insensitive)."""
    lower_attrs = {k.lower(): v for k, v in attrs.items()}
    for key in keys:
        v = lower_attrs.get(key.lower())
        if v not in (None, "", 0):
            return v
    return None


def _normalize_arcgis_feature(attrs: Dict, city: str, state: str) -> Optional[Dict[str, Any]]:
    """Map ArcGIS parcel attributes to our property schema. Handles varied field names across counties."""
    # Address — try composite field first, then build from parts
    address = _first_attr(
        attrs,
        "Address", "SITEADDRESS", "SITE_ADDRESS", "PropertyAddress",
        "PROP_ADDRESS", "FULLADDRESS", "SITUS_ADDRESS", "ADDR",
    )
    if not address:
        parts = [
            str(_first_attr(attrs, "AddrNumber", "STREETNO", "HOUSE_NUM", "HOUSENUM") or ""),
            str(_first_attr(attrs, "AddrPreDir", "PREDIR", "PREDIRECTION") or ""),
            str(_first_attr(attrs, "AddrStreet", "STREETNAME", "STREET_NAME", "STRNAME") or ""),
            str(_first_attr(attrs, "AddrSuffix", "SUFFIX", "STREETTYPE", "STRTYPE") or ""),
        ]
        address = " ".join(p for p in parts if p).strip()

    if not address:
        return None

    owner = _first_attr(
        attrs,
        "Owner", "OWNER", "OWNER_NAME", "OwnName", "OWNERNAME",
        "TaxpayerName", "TAXPAYER", "GRANTOR",
    )

    assessed = _first_attr(
        attrs,
        "TotAssess", "TOTALASSESSEDVALUE", "ASSESSEDVALUE", "ASSDVALUE",
        "TotAppr", "TOTALAPPRAISEDVALUE", "APPRAISEDVALUE", "AV", "TAXVALUE",
    )

    improvement = _first_attr(
        attrs,
        "ImprAssess", "IMPROVEMENTASSESSEDVALUE", "IMPRVALUE",
        "ImprAppr", "BUILDINGVALUE", "IMPROVVALUE",
    )

    zip_raw = _first_attr(attrs, "ZipCode", "ZIP", "ZIPCODE", "POSTAL_CODE", "SITUS_ZIP")
    zip_code = str(zip_raw or "").split(".")[0].strip()[:5] or None

    apn = _first_attr(
        attrs,
        "ParcelID", "PARCELID", "APN", "PIN", "PARCEL_ID",
        "PARID", "PARCELNUMBER", "PARCEL_NUMBER",
    )

    bedrooms = _first_attr(attrs, "Bedrooms", "BEDROOMS", "BEDS", "BED")
    bathrooms = _first_attr(attrs, "Bathrooms", "BATHROOMS", "BATHS", "BATH")
    sqft = _first_attr(
        attrs,
        "SqFt", "SQFT", "LIVAREA", "LIVINGAREA", "BLDGAREA",
        "HEATED_AREA", "GROSSAREA", "TOTALSQFT",
    )
    year_built = _first_attr(attrs, "YearBuilt", "YEARBUILT", "YEAR_BUILT", "YR_BUILT")

    return {
        "address": str(address).strip(),
        "city": city,
        "state": state,
        "zip": zip_code,
        "apn": str(apn).strip() if apn else None,
        "owner_name": str(owner).strip() if owner else None,
        "assessed_value": int(float(str(assessed))) if assessed else None,
        "improvement_value": int(float(str(improvement))) if improvement else None,
        "bedrooms": int(bedrooms) if bedrooms else None,
        "bathrooms": float(bathrooms) if bathrooms else None,
        "sqft": int(float(str(sqft))) if sqft else None,
        "year_built": int(year_built) if year_built else None,
        "property_type": "residential",  # normalised downstream by buy-box filter
    }


# ---------------------------------------------------------------------------
# Firecrawl — used ONLY to discover ArcGIS endpoint (once per county, cached)
# ---------------------------------------------------------------------------

async def _discover_arcgis_endpoint(county: str, state: str) -> Optional[str]:
    """
    Use Firecrawl AI to find the county's ArcGIS parcel feature service URL.
    This is a one-time operation per county — the result is cached in the DB.
    """
    if not settings.firecrawl_api_key:
        return None

    try:
        from firecrawl import FirecrawlApp
        app = FirecrawlApp(api_key=settings.firecrawl_api_key)

        result = await asyncio.to_thread(
            app.extract,
            prompt=(
                f"Find the ArcGIS REST feature service URL for {county} County, {state} "
                f"property parcels or tax assessor parcel data. "
                f"Look for ArcGIS Online hosted services, county GIS portals, or open data portals. "
                f"Return the full URL ending in /FeatureServer/0, /FeatureServer/1, or /MapServer/0."
            ),
            schema={
                "type": "object",
                "properties": {
                    "gis_api_url": {
                        "type": "string",
                        "description": "Full ArcGIS REST endpoint URL ending in /FeatureServer/0 or similar",
                    },
                },
            },
            enable_web_search=True,
            allow_external_links=True,
            timeout=90000,
        )

        if result and hasattr(result, "data") and result.data:
            url = result.data.get("gis_api_url", "")
            if url and "arcgis" in url.lower() and ("featureserver" in url.lower() or "mapserver" in url.lower()):
                logger.info("arcgis.discovered", county=county, state=state, url=url[:80])
                return url

    except Exception as exc:
        logger.warning("arcgis.discover_error", county=county, state=state, error=str(exc)[:200])

    return None


# ---------------------------------------------------------------------------
# Firecrawl full extraction — fallback for counties without ArcGIS
# ---------------------------------------------------------------------------

async def _firecrawl_county_extract(
    county: str,
    state: str,
    city: str,
    assessor_url: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fallback: use Firecrawl AI to extract records from the county assessor website.
    Used when no ArcGIS endpoint is found for the county.
    """
    if not settings.firecrawl_api_key:
        return []

    try:
        from firecrawl import FirecrawlApp
        app = FirecrawlApp(api_key=settings.firecrawl_api_key)

        prompt = (
            f"Extract as many residential property records as possible from the "
            f"{county} County, {state} assessor or auditor website.\n\n"
            f"Find the county's property search tool and retrieve residential properties in {city}, {state}. "
            f"Do NOT limit to specific street names — use whatever search returns the most records. "
            f"If results are paginated, follow every Next/Page 2 link and extract those records too.\n\n"
            f"For each property extract: address, city, state, zip, owner_name, apn, "
            f"assessed_value, improvement_value, bedrooms, bathrooms, sqft, year_built, property_type.\n\n"
            f"Goal: return 50+ unique residential properties."
        )

        urls = [assessor_url] if assessor_url else None
        logger.info("firecrawl_county.start", county=county, state=state, url=assessor_url)

        result = await asyncio.to_thread(
            app.extract,
            urls=urls,
            prompt=prompt,
            schema=_PROPERTY_SCHEMA,
            enable_web_search=True,
            allow_external_links=True,
            timeout=120000,
        )

        if result and hasattr(result, "data") and result.data:
            props = result.data.get("properties", [])
            props = [p for p in props if p.get("address", "").strip()]
            logger.info("firecrawl_county.done", county=county, found=len(props))
            return props

    except Exception as exc:
        logger.warning("firecrawl_county.error", county=county, error=str(exc)[:300])

    return []


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def scrape_county_records(county: str, state: str, city: str) -> List[Dict[str, Any]]:
    """
    Extract residential property records for a given county.

    Primary path (fast, free, 2000 records):
      - Query the county's ArcGIS parcel REST API directly.

    On first run per county:
      - Use Firecrawl to discover the ArcGIS endpoint, then cache it.

    Fallback (if no ArcGIS found):
      - Use Firecrawl AI to extract from the county assessor website.
    """
    cache = _get_county_cache(county, state)
    assessor_url = (cache or {}).get("assessor_url", "")
    arcgis_url   = (cache or {}).get("arcgis_url", "")

    logger.info("county_scraper.start", county=county, state=state, has_arcgis=bool(arcgis_url))

    # ── Try ArcGIS direct query first ─────────────────────────────────────
    if arcgis_url:
        records = await asyncio.to_thread(_query_arcgis_sync, arcgis_url, city, state)
        if records:
            logger.info("county_scraper.done", county=county, found=len(records), source="arcgis")
            return _dedupe(records)

    # ── Discover ArcGIS endpoint via Firecrawl (one-time per county) ──────
    logger.info("arcgis.discovering", county=county, state=state)
    arcgis_url = await _discover_arcgis_endpoint(county, state) or ""

    if arcgis_url:
        _save_county_cache(county, state, assessor_url=assessor_url, arcgis_url=arcgis_url)
        records = await asyncio.to_thread(_query_arcgis_sync, arcgis_url, city, state)
        if records:
            logger.info("county_scraper.done", county=county, found=len(records), source="arcgis")
            return _dedupe(records)

    # ── Fallback: Firecrawl AI extraction from assessor website ───────────
    logger.info("county_scraper.firecrawl_fallback", county=county)
    records = await _firecrawl_county_extract(county, state, city, assessor_url or None)
    if records:
        _save_county_cache(county, state, assessor_url=assessor_url, arcgis_url="")

    logger.info("county_scraper.done", county=county, found=len(records), source="firecrawl_fallback")
    return _dedupe(records)


_VALUE_FIELD_CANDIDATES = [
    "TotAppr", "TotAssess", "TOTALASSESSEDVALUE", "ASSESSEDVALUE",
    "AV", "TAXVALUE", "APPRAISED", "APPRAISEDVALUE", "AssessedValue",
]
_OWNER_FIELD_CANDIDATES = [
    "Owner", "OWNER", "OWNER_NAME", "OwnName", "OWNERNAME",
    "TaxpayerName", "TAXPAYER", "GRANTOR",
]


def _get_layer_fields(gis_url: str) -> set:
    """Return lowercase field names from the ArcGIS layer metadata."""
    try:
        req = urllib.request.Request(f"{gis_url}?f=json", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        return {f["name"].lower() for f in data.get("fields", [])}
    except Exception:
        return set()


def _build_arcgis_where(field_names: set) -> str:
    """Build a WHERE clause using only fields confirmed to exist in this layer."""
    value_field = next(
        (f for f in _VALUE_FIELD_CANDIDATES if f.lower() in field_names),
        None,
    )
    owner_field = next(
        (f for f in _OWNER_FIELD_CANDIDATES if f.lower() in field_names),
        None,
    )
    conditions = []
    if value_field:
        conditions.append(f"{value_field} > 50000")
    if owner_field:
        conditions.append(f"{owner_field} IS NOT NULL")
    return " AND ".join(conditions) if conditions else "1=1"


def _query_arcgis_sync(gis_url: str, city: str, state: str) -> List[Dict[str, Any]]:
    """Synchronous ArcGIS query (called via asyncio.to_thread)."""
    field_names = _get_layer_fields(gis_url)
    where = _build_arcgis_where(field_names)
    logger.info("arcgis.where_clause", gis_url=gis_url[:60], where=where)

    params = urllib.parse.urlencode({
        "where": where,
        "outFields": "*",
        "f": "json",
        "resultRecordCount": 2000,
    })
    try:
        url = f"{gis_url}/query?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())

        if "error" in data:
            logger.warning("arcgis.api_error", gis_url=gis_url[:60], error=str(data["error"])[:200])
            return []

        features = data.get("features", [])
        records = []
        for f in features:
            rec = _normalize_arcgis_feature(f.get("attributes", {}), city, state)
            if rec and rec.get("address") and rec.get("owner_name"):
                records.append(rec)

        logger.info("arcgis.query_done", gis_url=gis_url[:60], records=len(records))
        return records
    except Exception as exc:
        logger.warning("arcgis.query_error", gis_url=gis_url[:60], error=str(exc)[:200])
        return []


def _dedupe(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set = set()
    out: List[Dict[str, Any]] = []
    for rec in records:
        key = rec.get("address", "").strip().upper()
        if key and key not in seen:
            seen.add(key)
            out.append(rec)
    return out
