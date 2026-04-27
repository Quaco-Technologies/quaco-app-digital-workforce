"""
Run the full 6-step acquisition pipeline against Fulton County, GA (Atlanta).
Buy box: single family, $200k-$500k, 3+ beds, 1+ bath.
"""
import asyncio
import json
import os
import sys
import time

from dotenv import load_dotenv
load_dotenv()
sys.path.insert(0, ".")

from supabase import create_client
from src.models.buy_box import BuyBox
from src.services.acquisition_pipeline import run_acquisition_pipeline

BUY_BOX = BuyBox(
    city="Atlanta",
    state="GA",
    county="Fulton",
    property_types=["single_family"],
    min_price=200_000,
    max_price=500_000,
    min_beds=3,
    min_baths=1.0,
)

async def main() -> None:
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    print(f"\n{'='*60}")
    print(f"  Atlanta | Fulton County, GA")
    print(f"  Single family  •  $200k–$500k  •  3+ beds  •  1+ bath")
    print(f"{'='*60}\n")

    t0 = time.time()
    result = await run_acquisition_pipeline(BUY_BOX, investor_id=None, db=db, max_leads=10)
    elapsed = time.time() - t0

    print(f"\n{'='*60}")
    print(f"  RESULT  ({elapsed:.0f}s)")
    print(f"{'='*60}")
    print(f"  Scraped:      {result['scraped']}")
    print(f"  Filtered:     {result['filtered']}")
    print(f"  Saved:        {result['saved']}")
    print(f"  Pursue:       {result['pursue']}")
    print(f"  Needs review: {result['needs_review']}")
    print(f"  Skipped:      {result['skip']}")
    print(f"  Enriched:     {result['enriched']}")

    leads = result.get("leads", [])
    if leads:
        print(f"\n  Leads:")
        for lead in leads:
            rec = lead.get("recommendation", "?")
            offer = f"${lead['offer']:,}" if lead.get("offer") else "—"
            arv   = f"${lead['arv']:,}" if lead.get("arv") else "—"
            print(
                f"    [{rec.upper()[:6]:6}]  {lead['address'][:45]:45}"
                f"  zone={lead.get('flood_zone') or '—':12}"
                f"  cond={lead.get('photo_condition') or '—':7}"
                f"  ARV={arv:>10}  offer={offer:>10}"
                + ("  ✓ traced" if lead.get("skip_traced") else "")
            )
    else:
        print("\n  No leads processed.")

    print()
    with open("atlanta_result.json", "w") as f:
        json.dump(result, f, indent=2, default=str)
    print(f"  Full result → atlanta_result.json")

if __name__ == "__main__":
    asyncio.run(main())
