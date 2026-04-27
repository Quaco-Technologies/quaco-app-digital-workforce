from __future__ import annotations

"""
Property photo analyzer — Google Street View Static API + OpenAI vision.
Fetches a street-level photo of the property and analyzes condition with GPT-4o.
"""

import base64
import json
import urllib.parse
import urllib.request
from typing import Any, Dict

from openai import AsyncOpenAI

from src.core.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

_STREET_VIEW_URL = "https://maps.googleapis.com/maps/api/streetview"

_VISION_SYSTEM = """You are a property condition analyst reviewing a Google Street View photo of a house.

Analyze the exterior and return JSON with exactly these keys:
- overall_condition: "excellent" | "good" | "fair" | "poor" | "unknown"
- roof_condition: "good" | "fair" | "poor" | "unknown"
- appears_vacant: true | false
- major_issues_visible: true | false  (structural damage, fire damage, collapse risk)
- visible_damage_notes: string (empty string if none)
- confidence: 0.0–1.0  (lower if image is a gray placeholder or shows no structure)

Return JSON only. No other text."""


def _fetch_street_view(address: str) -> bytes | None:
    params = urllib.parse.urlencode({
        "size": "640x480",
        "location": address,
        "fov": "90",
        "pitch": "0",
        "key": settings.google_maps_api_key,
    })
    url = f"{_STREET_VIEW_URL}?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        # Street View returns a gray placeholder (~5KB) when no imagery exists
        if len(data) < 8_000:
            logger.debug("photos.street_view_placeholder", address=address, size=len(data))
            return None
        return data
    except Exception as exc:
        logger.error("photos.street_view_error", address=address, error=str(exc))
        return None


async def analyze_property_photos(address: str) -> Dict[str, Any]:
    default: Dict[str, Any] = {
        "overall_condition": "unknown",
        "roof_condition": "unknown",
        "appears_vacant": False,
        "major_issues_visible": False,
        "visible_damage_notes": "",
        "confidence": 0.0,
    }

    if not settings.google_maps_api_key:
        logger.warning("photos.no_api_key", address=address)
        return default

    image_bytes = _fetch_street_view(address)
    if not image_bytes:
        logger.warning("photos.no_image", address=address)
        return default

    b64 = base64.b64encode(image_bytes).decode("ascii")

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": _VISION_SYSTEM},
                {"role": "user", "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64}",
                            "detail": "high",
                        },
                    },
                    {
                        "type": "text",
                        "text": f"Property: {address}\nAnalyze condition. Return JSON only.",
                    },
                ]},  # type: ignore[arg-type]
            ],
            max_tokens=512,
        )
        text = response.choices[0].message.content or ""
        start, end = text.find("{"), text.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(text[start:end])
            result = {**default, **parsed}
            logger.info(
                "photos.done",
                address=address,
                condition=result.get("overall_condition"),
                confidence=result.get("confidence"),
            )
            return result
    except Exception as exc:
        logger.error("photos.vision_error", address=address, error=str(exc))

    return default
