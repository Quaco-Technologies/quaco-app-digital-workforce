from __future__ import annotations

"""
FEMA flood zone checker — Census Geocoder → FEMA NFHL REST API.
No browser needed. Uses httpx for FEMA queries (better TLS support on macOS).
"""

import asyncio
import json
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Tuple

import httpx

from src.core.logging import get_logger

logger = get_logger(__name__)

_CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
_FEMA_URLS = [
    "https://msc.fema.gov/arcgis/rest/services/NFHP_Service/NFHL_Service/MapServer/28/query",
    "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHLWMS/MapServer/28/query",
]
_HIGH_RISK_ZONES = {"A", "AE", "AO", "AH", "AX", "AR", "VE", "V", "V1", "V30"}


def _geocode_full(address: str) -> Optional[Dict[str, Any]]:
    """Return Census geocoder match dict or None. Uses urllib (Census works fine with it)."""
    params = urllib.parse.urlencode({
        "address": address,
        "benchmark": "Public_AR_Current",
        "format": "json",
    })
    try:
        with urllib.request.urlopen(f"{_CENSUS_URL}?{params}", timeout=15) as r:
            data = json.loads(r.read())
        matches = data.get("result", {}).get("addressMatches", [])
        if matches:
            return matches[0]
    except Exception as exc:
        logger.debug("fema.geocode_error", address=address, error=str(exc))
    return None


def _geocode(address: str) -> Optional[Tuple[float, float]]:
    match = _geocode_full(address)
    if match:
        c = match["coordinates"]
        return float(c["x"]), float(c["y"])
    return None


def lookup_zip(address: str) -> Optional[str]:
    """Return zip code for address via Census geocoder (sync helper for pipeline)."""
    match = _geocode_full(address)
    if not match:
        return None
    return match.get("addressComponents", {}).get("zip") or None


def _query_nfhl(lon: float, lat: float) -> Optional[str]:
    """Query FEMA NFHL via httpx (handles TLS better than urllib on macOS LibreSSL)."""
    params = {
        "geometry": f"{lon},{lat}",
        "geometryType": "esriGeometryPoint",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "FLD_ZONE,ZONE_SUBTYP",
        "returnGeometry": "false",
        "f": "json",
    }
    for endpoint in _FEMA_URLS:
        try:
            with httpx.Client(verify=False, timeout=15) as client:
                r = client.get(endpoint, params=params)
            data = r.json()
            features = data.get("features", [])
            if features:
                attrs = features[0].get("attributes", {})
                zone = (attrs.get("FLD_ZONE") or "").strip()
                subtyp = (attrs.get("ZONE_SUBTYP") or "").strip()
                if zone:
                    return f"Zone {zone}" + (f" ({subtyp})" if subtyp else "")
        except Exception as exc:
            logger.debug("fema.nfhl_error", endpoint=endpoint, error=str(exc))
    return None


def _check_sync(address: str) -> Dict[str, Any]:
    coords = _geocode(address)
    if not coords:
        logger.warning("fema.no_geocode", address=address)
        return {"zone": "UNKNOWN", "flood_risk_high": False}

    lon, lat = coords
    zone = _query_nfhl(lon, lat) or "UNKNOWN"

    zone_code = zone.upper().replace("ZONE ", "").split(" ")[0].strip()
    high_risk = zone_code in _HIGH_RISK_ZONES

    result = {"zone": zone, "flood_risk_high": high_risk}
    logger.info("fema.done", address=address, zone=zone, high_risk=high_risk)
    return result


async def check_fema_flood_zone(address: str) -> Dict[str, Any]:
    """Check FEMA flood zone via Census Geocoder + NFHL REST API (async wrapper)."""
    try:
        return await asyncio.to_thread(_check_sync, address)
    except Exception as exc:
        logger.error("fema.error", address=address, error=str(exc))
        return {"zone": "UNKNOWN", "flood_risk_high": False}
