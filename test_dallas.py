"""
Dallas County TX acquisition pipeline test.

Buy box:
  county: Dallas, state: TX
  property type: single family residential
  price: $50k–$300k
  sqft: 1000–3000
  min beds: 3

Runs the full 6-step pipeline directly (no ARQ queue) so logs are immediate.
"""
from __future__ import annotations

import asyncio
import json
import sys
import os
from datetime import datetime

# ensure repo root is on path
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from src.core.database import get_db
from src.models.buy_box import BuyBox
from src.services.acquisition_pipeline import run_acquisition_pipeline

BUY_BOX = BuyBox(
    county="Dallas",
    state="TX",
    city="Dallas",
    property_types=["single_family", "single_family_residential", "residential"],
    min_price=50_000,
    max_price=300_000,
    min_sqft=1000,
    max_sqft=3000,
    min_beds=3,
)

INVESTOR_ID = None  # anonymous run — leads saved without investor_id

MAX_LEADS = 5  # process up to 5 leads through steps 2-6 per run


def _banner(step: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"\n{'='*60}")
    print(f"[{ts}] {step}")
    print("="*60)


async def main() -> None:
    _banner("DALLAS COUNTY TX — 6-STEP ACQUISITION PIPELINE")
    print(f"Buy box: {BUY_BOX.property_types} | ${BUY_BOX.min_price:,}–${BUY_BOX.max_price:,} | "
          f"{BUY_BOX.min_sqft}–{BUY_BOX.max_sqft} sqft | min {BUY_BOX.min_beds} beds")
    print(f"Model: {os.environ.get('MODEL', 'claude-sonnet-4-20250514')}")
    print(f"Max leads through steps 2-6: {MAX_LEADS}")

    db = get_db()

    _banner("STARTING PIPELINE")
    result = await run_acquisition_pipeline(BUY_BOX, INVESTOR_ID, db, max_leads=MAX_LEADS)

    # ── Summary ───────────────────────────────────────────────────────────────
    _banner("PIPELINE RESULTS")
    print(f"  Scraped from county:    {result['scraped']}")
    print(f"  Matched buy box:        {result['filtered']}")
    print(f"  Saved to DB:            {result['saved']}")
    print(f"  Processed (steps 2-6):  {len(result['leads'])}")
    print(f"  PURSUE:                 {result['pursue']}")
    print(f"  NEEDS REVIEW:           {result['needs_review']}")
    print(f"  SKIP:                   {result['skip']}")
    print(f"  Skip traced (enriched): {result['enriched']}")

    # ── Per-lead breakdown ────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print("PER-LEAD BREAKDOWN")
    print(f"{'─'*60}")
    for i, lead in enumerate(result["leads"], 1):
        rec = lead.get("recommendation", "?")
        offer_str = f"${lead['offer']:,}" if lead.get("offer") else "—"
        arv_str = f"${lead['arv']:,}" if lead.get("arv") else "—"
        print(f"\n[{i}] {lead['address']}")
        print(f"     Flood zone:    {lead.get('flood_zone', '—')}")
        print(f"     Photo cond:    {lead.get('photo_condition', '—')}")
        print(f"     Comps found:   {lead.get('comp_count', 0)}")
        print(f"     ARV:           {arv_str}")
        print(f"     Offer:         {offer_str}")
        print(f"     Recommendation: {rec.upper()}")
        if lead.get("review_reasons"):
            for reason in lead["review_reasons"]:
                print(f"       ⚠  {reason}")
        if lead.get("skip_traced"):
            print(f"     Skip traced:   ✓")

    # ── What worked / what didn't ─────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print("WHAT WORKED / WHAT DIDN'T")
    print(f"{'─'*60}")

    step1_ok = result["scraped"] > 0
    step2_ok = any(l.get("flood_zone") and l["flood_zone"] != "UNKNOWN" for l in result["leads"])
    step3_ok = any(l.get("photo_condition") and l["photo_condition"] != "unknown" for l in result["leads"])
    step4_ok = any(l.get("comp_count", 0) >= 3 for l in result["leads"])
    step5_ok = any(l.get("offer") for l in result["leads"])
    step6_ok = result["enriched"] > 0

    print(f"  Step 1 — County scrape:     {'✓ OK' if step1_ok else '✗ FAILED (0 records)'}")
    print(f"  Step 2 — FEMA flood zone:   {'✓ OK' if step2_ok else '✗ FAILED or all UNKNOWN'}")
    print(f"  Step 3 — Photo analysis:    {'✓ OK' if step3_ok else '✗ FAILED or all unknown'}")
    print(f"  Step 4 — Zillow comps:      {'✓ OK (≥3 comps on at least 1 lead)' if step4_ok else '✗ FAILED or <3 comps'}")
    print(f"  Step 5 — Offer calc:        {'✓ OK' if step5_ok else '✗ FAILED or all needs_review'}")
    print(f"  Step 6 — Skip trace:        {'✓ OK' if step6_ok else '— no pursue leads to enrich'}")

    # dump full result as JSON for record
    with open("dallas_test_result.json", "w") as f:
        json.dump(result, f, indent=2, default=str)
    print(f"\nFull result written to dallas_test_result.json")


if __name__ == "__main__":
    asyncio.run(main())
