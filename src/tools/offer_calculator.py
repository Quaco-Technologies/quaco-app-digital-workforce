from __future__ import annotations

from typing import Any, Dict, List, Optional


def _round_to_nearest(value: float, nearest: int = 500) -> int:
    return int(round(value / nearest) * nearest)


def calculate_offer(
    sqft: Optional[int],
    avg_price_per_sqft: Optional[int],
    comp_count: int,
    photo_condition: Optional[str],
    photo_major_issues: Optional[bool],
    flood_risk_high: Optional[bool],
    photo_confidence: Optional[float],
    comps_needs_review: bool,
) -> Dict[str, Any]:
    """
    Pure Python offer calculation — no LLM.

    ARV  = avg_price_per_sqft × sqft
    Base multiplier: 70% (clean), 60% (one issue), 50% (multiple issues)
    Hard cap: 75% of ARV.
    Round to nearest $500.

    Any of these flags → needs_review, no offer:
      - fewer than 3 comps
      - high risk flood zone (A / AE)
      - photo confidence < 0.4
      - major damage visible
    """
    review_reasons: List[str] = []

    if comp_count < 3:
        review_reasons.append(f"only {comp_count} comp(s) found — need minimum 3")
    if flood_risk_high:
        review_reasons.append("high-risk FEMA flood zone (A or AE)")
    if photo_confidence is not None and photo_confidence < 0.4:
        review_reasons.append(f"low photo confidence ({photo_confidence:.0%})")
    if photo_major_issues:
        review_reasons.append("major damage visible in photos")

    if review_reasons:
        return {
            "arv": None,
            "offer_price": None,
            "pipeline_recommendation": "needs_review",
            "review_reasons": review_reasons,
        }

    if not sqft or not avg_price_per_sqft:
        return {
            "arv": None,
            "offer_price": None,
            "pipeline_recommendation": "needs_review",
            "review_reasons": ["missing sqft or comp data"],
        }

    arv = sqft * avg_price_per_sqft

    # Count soft issues (not major damage, but condition flags)
    issue_count = 0
    condition_lower = (photo_condition or "").lower()
    if condition_lower in ("poor",):
        issue_count += 2
    elif condition_lower in ("fair",):
        issue_count += 1

    if issue_count == 0:
        multiplier = 0.70
    elif issue_count == 1:
        multiplier = 0.60
    else:
        multiplier = 0.50

    raw_offer = arv * multiplier
    # Hard cap: never exceed 75% of ARV
    cap = arv * 0.75
    offer = min(raw_offer, cap)
    offer_rounded = _round_to_nearest(offer, 500)

    return {
        "arv": arv,
        "offer_price": offer_rounded,
        "pipeline_recommendation": "pursue",
        "review_reasons": [],
    }
