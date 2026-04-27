from __future__ import annotations

"""
FEMA flood zone checker — Census Geocoder → FEMA NFHL REST API.

NOTE: FEMA's arcgis servers (msc.fema.gov, hazards.fema.gov) use TLS fingerprint
filtering that rejects Python's LibreSSL on macOS. This returns UNKNOWN locally
on macOS but works correctly on Linux (Fly.io worker uses OpenSSL).
The fallback tries httpx then curl subprocess for best cross-platform coverage.
"""

import asyncio
import json
import subprocess
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
    match = _geocode_full(address)
    if not match:
        return None
    return match.get("addressComponents", {}).get("zip") or None


def _parse_zone(data: dict) -> Optional[str]:
    features = data.get("features", [])
    if not features:
        return None
    attrs = features[0].get("attributes", {})
    zone = (attrs.get("FLD_ZONE") or "").strip()
    subtyp = (attrs.get("ZONE_SUBTYP") or attrs.get("ZONE_SUBTY") or "").strip()
    if zone:
        return f"Zone {zone}" + (f" ({subtyp})" if subtyp else "")
    return None


def _curl_get_json(url: str) -> Optional[dict]:
    """Fetch JSON via curl subprocess (bypasses LibreSSL TLS fingerprint issues)."""
    try:
        result = subprocess.run(
            ["curl", "-sk", "--max-time", "15", url],
            capture_output=True, text=True, timeout=20,
        )
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
    except Exception as exc:
        logger.debug("fema.curl_error", url=url[:80], error=str(exc))
    return None


def _query_nfhl(lon: float, lat: float) -> Optional[str]:
    """Query FEMA NFHL. httpx first, curl fallback."""
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
        # Attempt 1: httpx
        try:
            with httpx.Client(verify=False, timeout=15) as client:
                r = client.get(endpoint, params=params)
            zone = _parse_zone(r.json())
            if zone:
                return zone
            # Got a response but no features — that's a real "no zone" answer
            if r.status_code == 200:
                continue
        except Exception as exc:
            logger.debug("fema.httpx_error", endpoint=endpoint, error=str(exc))

        # Attempt 2: curl subprocess (works through macOS Secure Transport or Linux OpenSSL)
        url = f"{endpoint}?{urllib.parse.urlencode(params)}"
        data = _curl_get_json(url)
        if data is not None:
            zone = _parse_zone(data)
            if zone:
                logger.debug("fema.curl_ok", endpoint=endpoint)
                return zone
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
    try:
        return await asyncio.to_thread(_check_sync, address)
    except Exception as exc:
        logger.error("fema.error", address=address, error=str(exc))
        return {"zone": "UNKNOWN", "flood_risk_high": False}
