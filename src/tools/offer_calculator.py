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
    assessed_value_fallback: Optional[int] = None,
    assessment_ratio: float = 0.70,
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
    hard_block = False

    if comp_count < 2:
        review_reasons.append(f"only {comp_count} comp(s) found")
        hard_block = True
    if flood_risk_high:
        review_reasons.append("high-risk FEMA flood zone (A or AE)")
        hard_block = True
    if photo_major_issues:
        review_reasons.append("major damage visible in photos")
        hard_block = True
    if photo_confidence is not None and photo_confidence < 0.4:
        review_reasons.append(f"photo analysis unavailable — verify condition before offer")

    if not sqft or not avg_price_per_sqft:
        # Fall back to assessed value estimate if comps unavailable
        if assessed_value_fallback and assessed_value_fallback > 0:
            est_arv = int(assessed_value_fallback / assessment_ratio)
            multiplier = 0.70
            condition_lower = (photo_condition or "").lower()
            if condition_lower == "poor":
                multiplier = 0.50
            elif condition_lower == "fair":
                multiplier = 0.60
            est_offer = _round_to_nearest(min(est_arv * multiplier, est_arv * 0.75), 500)
            return {
                "arv": est_arv,
                "offer_price": est_offer,
                "pipeline_recommendation": "needs_review",
                "review_reasons": ["ARV estimated from county assessed value — verify with comps before offer"],
            }
        return {
            "arv": None,
            "offer_price": None,
            "pipeline_recommendation": "needs_review",
            "review_reasons": ["missing sqft or comp data"],
        }

    if hard_block:
        if assessed_value_fallback and assessed_value_fallback > 0:
            est_arv = int(assessed_value_fallback / assessment_ratio)
            est_offer = _round_to_nearest(est_arv * 0.70, 500)
            return {
                "arv": est_arv,
                "offer_price": est_offer,
                "pipeline_recommendation": "needs_review",
                "review_reasons": review_reasons + ["ARV estimated from county assessed value"],
            }
        return {
            "arv": None,
            "offer_price": None,
            "pipeline_recommendation": "needs_review",
            "review_reasons": review_reasons,
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

    recommendation = "needs_review" if review_reasons else "pursue"
    return {
        "arv": arv,
        "offer_price": offer_rounded,
        "pipeline_recommendation": recommendation,
        "review_reasons": review_reasons,
    }
