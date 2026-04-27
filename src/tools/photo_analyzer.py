from __future__ import annotations

"""
Property photo analyzer — Firecrawl screenshot + GPT-4o vision.
Firecrawl fetches the Zillow/Redfin page and captures a screenshot.
GPT-4o analyzes the screenshot for property condition.
"""

import asyncio
import base64
import json
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

from firecrawl import V1FirecrawlApp
from openai import AsyncOpenAI

from src.core.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

_VISION_SYSTEM = """You are a property condition analyst reviewing a screenshot from a real estate listing page.

Analyze whatever is visible — exterior, interior, lot — and return JSON with exactly these keys:
- overall_condition: "excellent" | "good" | "fair" | "poor" | "unknown"
- roof_condition: "good" | "fair" | "poor" | "unknown"
- appears_vacant: true | false
- major_issues_visible: true | false  (structural damage, fire, flood, collapse risk)
- visible_damage_notes: string (empty string if none)
- confidence: 0.0–1.0  (lower if screenshot is a map, CAPTCHA, or shows no property)

Return JSON only. No other text."""


def _fetch_as_b64(url: str) -> Optional[str]:
    """Download an image URL and return it as a base64 string."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        return base64.b64encode(data).decode("ascii")
    except Exception as exc:
        logger.debug("photos.fetch_error", url=url, error=str(exc))
        return None


def _scrape_screenshot(address: str) -> Optional[str]:
    """Return base64 screenshot string or None. Firecrawl returns a URL; we download it."""
    fc = V1FirecrawlApp(api_key=settings.firecrawl_api_key)

    addr_slug = address.replace(" ", "-").replace(",", "").replace("  ", "-")
    addr_q = urllib.parse.quote(address)

    urls = [
        f"https://www.zillow.com/homes/{urllib.parse.quote(addr_slug)}/",
        f"https://www.zillow.com/homes/for_sale/{urllib.parse.quote(addr_slug)}/",
        f"https://www.redfin.com/search?location={addr_q}",
    ]

    for url in urls:
        try:
            resp = fc.scrape_url(
                url,
                formats=["screenshot"],
                proxy="stealth",
                wait_for=3000,
                timeout=30000,
            )
            if resp and resp.screenshot:
                screenshot = resp.screenshot
                # Firecrawl may return a URL or raw base64
                if screenshot.startswith("http"):
                    b64 = _fetch_as_b64(screenshot)
                    if b64:
                        logger.debug("photos.screenshot_ok", url=url)
                        return b64
                else:
                    logger.debug("photos.screenshot_ok", url=url)
                    return screenshot
        except Exception as exc:
            logger.debug("photos.scrape_miss", url=url, error=str(exc))

    return None


async def analyze_property_photos(address: str) -> Dict[str, Any]:
    """Find property photos via Firecrawl, analyze with GPT-4o vision."""
    default: Dict[str, Any] = {
        "overall_condition": "unknown",
        "roof_condition": "unknown",
        "appears_vacant": False,
        "major_issues_visible": False,
        "visible_damage_notes": "",
        "confidence": 0.0,
    }

    try:
        screenshot_b64 = await asyncio.to_thread(_scrape_screenshot, address)
    except Exception as exc:
        logger.error("photos.screenshot_error", address=address, error=str(exc))
        return default

    if not screenshot_b64:
        logger.warning("photos.no_screenshot", address=address)
        return default

    def _mime_type(b64: str) -> str:
        h = b64[:8]
        if h.startswith("/9j/"):
            return "image/jpeg"
        if h.startswith("UklG"):
            return "image/webp"
        if h.startswith("R0lG"):
            return "image/gif"
        return "image/png"  # iVBO... = PNG magic bytes \x89PNG

    mime = _mime_type(screenshot_b64)

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
                            "url": f"data:{mime};base64,{screenshot_b64}",
                            "detail": "high",
                        },
                    },
                    {
                        "type": "text",
                        "text": f"Property address: {address}\nAnalyze the property condition and return JSON only.",
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
