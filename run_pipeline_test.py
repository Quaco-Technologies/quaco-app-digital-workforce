"""
Full real pipeline test using live Fulton County parcel data from ArcGIS:
  1. Query Atlanta 2025 Regrid Tax Parcels → single family homes
  2. Save as leads
  3. Apify skip trace each
  4. Verify via API
"""
import os, sys, json, uuid, requests
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, ".")

from supabase import create_client
from src.tools.apify_tools import enrich_contact

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
API          = "http://localhost:8000"

admin = create_client(SUPABASE_URL, SUPABASE_KEY)
s     = requests.Session()
s.headers["User-Agent"] = "Mozilla/5.0"

# ── 1. Test user ──────────────────────────────────────────────────────────────
TEST_EMAIL = f"test-{uuid.uuid4().hex[:6]}@digitalworkforce.internal"
TEST_PASS  = "Test1234!Secure"
print(f"\n[1] Creating test user: {TEST_EMAIL}")
created = admin.auth.admin.create_user({"email": TEST_EMAIL, "password": TEST_PASS, "email_confirm": True})
user_id = created.user.id
session = admin.auth.sign_in_with_password({"email": TEST_EMAIL, "password": TEST_PASS})
token   = session.session.access_token
headers_api = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
print(f"    user_id: {user_id}")

# ── 2. Check Regrid field list ─────────────────────────────────────────────────
REGRID_BASE = "https://services6.arcgis.com/QmEXbya2dRd48yU4/arcgis/rest/services/Atlanta_(April)_2025_Regrid_Tax_Parcels/FeatureServer/0"
r = s.get(f"{REGRID_BASE}?f=json", timeout=10)
layer_info = r.json()
all_fields  = [f["name"] for f in layer_info.get("fields", [])]
print(f"\n[2] Regrid Atlanta layer fields ({len(all_fields)}):")
print(f"    {all_fields}")

# Key fields to request
want_fields = [
    "siteaddr", "address", "mailadd", "addr", "situs",       # address
    "ownname", "owner", "own_name", "owner1",                  # owner name
    "asmtland", "asmt_tot", "totval", "apprtot", "apprland",  # assessed value
    "bedrooms", "bdrms", "bedrooms_count",                     # bedrooms
    "bldgarea", "sqft", "living_area", "gla", "calc_sqft",    # sqft
    "usedesc", "usecode", "luc_desc",                          # property type
    "parcel_id", "parcelnumb",                                  # parcel ID
]
available = [f for f in want_fields if f in all_fields]
# Always include these for sure
must_have = [f for f in ["siteaddr","ownname","asmtland","bldgarea","usedesc","parcelnumb"] if f in all_fields]
fields_to_fetch = list(dict.fromkeys(available + must_have + ["OBJECTID"]))
print(f"\n    Available wanted fields: {available}")
print(f"    Will fetch: {fields_to_fetch}")

# ── 3. Query single family homes ──────────────────────────────────────────────
print(f"\n[3] Querying Atlanta single family residential parcels…")

# Try common use codes for single family: 01, R1, 100, 101, "SINGLE FAMILY"
where_clauses = [
    "usedesc LIKE '%SINGLE%FAMILY%'",
    "usedesc LIKE '%RESIDENTIAL%'",
    "usecode IN ('01', 'R1', 'R-1', '101', '100', '1')",
    "1=1",  # fallback: all
]

features = []
for where in where_clauses:
    params = {
        "where": where,
        "outFields": ",".join(fields_to_fetch) if fields_to_fetch else "*",
        "resultRecordCount": 10,
        "orderByFields": "OBJECTID",
        "f": "json",
    }
    try:
        r = s.get(f"{REGRID_BASE}/query", params=params, timeout=15)
        data = r.json()
        features = data.get("features", [])
        print(f"    where='{where}' → {len(features)} features")
        if features:
            print(f"    Sample: {json.dumps({k:v for k,v in list(features[0]['attributes'].items())[:15]}, default=str)}")
            break
    except Exception as e:
        print(f"    error: {e}")

# Also try Johns Creek Parcels which has Owner + Address fields
if not features or not features[0]["attributes"].get("ownname"):
    print(f"\n    Trying Johns Creek (Fulton) Parcels which has Owner field…")
    JC_BASE = "https://services1.arcgis.com/bqfNVPUK3HOnCFmA/arcgis/rest/services/Parcels/FeatureServer/0"
    r = s.get(f"{JC_BASE}?f=json", timeout=10)
    jc_fields = [f["name"] for f in r.json().get("fields", [])]
    print(f"    Fields: {jc_fields}")

    params = {
        "where": "Address IS NOT NULL AND Owner IS NOT NULL",
        "outFields": "Address,Owner,OwnerAddr1,TotAssess,ImprAssess,ParcelID,TaxDist",
        "resultRecordCount": 10,
        "f": "json",
    }
    r2 = s.get(f"{JC_BASE}/query", params=params, timeout=15)
    jc_features = r2.json().get("features", [])
    print(f"    Johns Creek features: {len(jc_features)}")
    if jc_features:
        print(f"    Sample: {json.dumps(jc_features[0]['attributes'], default=str)}")
        features = jc_features

if not features:
    print("No features found from any source")
    sys.exit(1)

# ── 4. Normalise to lead records ───────────────────────────────────────────────
def normalize(attrs: dict) -> Optional[dict]:
    addr = (attrs.get("Address") or attrs.get("siteaddr") or attrs.get("mailadd") or "").strip()
    if not addr:
        return None
    owner  = attrs.get("Owner") or attrs.get("ownname") or ""
    price  = attrs.get("TotAssess") or attrs.get("asmtland") or attrs.get("asmt_tot") or 0
    try:
        price = int(float(str(price))) if price else None
    except Exception:
        price = None
    sqft = attrs.get("bldgarea") or attrs.get("sqft") or 0
    try:
        sqft = int(float(str(sqft))) if sqft else None
    except Exception:
        sqft = None
    return {
        "address": addr,
        "city": "Atlanta",
        "state": "GA",
        "owner_name": owner.strip() if owner else "",
        "price": price,
        "sqft": sqft,
    }

leads_data = [n for f in features if (n := normalize(f["attributes"]))][:8]
print(f"\n    Normalized leads: {len(leads_data)}")
for ld in leads_data:
    print(f"      • {ld['address']:40} owner={ld['owner_name'] or '—':25} ${ld.get('price',0):,}")

# ── 5. Save leads ─────────────────────────────────────────────────────────────
print(f"\n[4] Saving {len(leads_data)} leads…")
lead_ids = []
for ld in leads_data:
    lid = str(uuid.uuid4())
    admin.table("leads").insert({
        "id": lid, "investor_id": user_id, "source": "county_records",
        "address": ld["address"], "city": ld["city"], "state": ld["state"],
        "price": ld.get("price"), "sqft": ld.get("sqft"), "status": "new",
    }).execute()
    lead_ids.append((lid, ld["address"], ld["city"], ld["state"], ld.get("owner_name","")))
    print(f"    ✓ {ld['address']}")

# ── 6. Skip trace ─────────────────────────────────────────────────────────────
print(f"\n[5] Skip tracing {len(lead_ids)} leads via Apify…")
enriched_count = 0
for lid, address, city, state, owner_name in lead_ids:
    full = f"{address}, {city}, {state}"
    print(f"    {full[:55]:55} … ", end="", flush=True)
    try:
        result = enrich_contact(full, owner_name)
        phones = result.get("phones", [])
        emails = result.get("emails", [])
        owner  = result.get("owner_name") or owner_name or ""
        conf   = float(result.get("confidence") or 0)
        admin.table("contacts").upsert({
            "lead_id": lid, "owner_name": owner or None,
            "phones": json.dumps(phones), "emails": json.dumps(emails),
            "mailing_address": result.get("mailing_address","") or "", "confidence": conf,
        }, on_conflict="lead_id").execute()
        admin.table("leads").update({"status": "skip_traced"}).eq("id", lid).execute()
        enriched_count += 1
        print(f"✓  {owner or '—':30} {phones[0] if phones else '—':16} {emails[0] if emails else '—'}  ({conf:.0%})")
    except Exception as e:
        print(f"✗ {e}")

print(f"\n    {enriched_count}/{len(lead_ids)} enriched")

# ── 7. API verify ─────────────────────────────────────────────────────────────
print(f"\n[6] API check…")
r = requests.get(f"{API}/leads?limit=50", headers=headers_api)
print(f"    /leads          → {r.status_code}  ({len(r.json())} leads)")
r = requests.get(f"{API}/leads/enriched", headers=headers_api)
enriched = r.json()
print(f"    /leads/enriched → {r.status_code}  ({len(enriched)} enriched)")
for e in enriched[:5]:
    ph = (e.get("phones") or ["—"])[0]
    print(f"      • {(e.get('owner_name') or '—'):30} | {ph:15} | {e['address']}")
r = requests.get(f"{API}/leads/export.csv", headers={"Authorization": f"Bearer {token}"})
lines = r.text.strip().splitlines()
print(f"    /export.csv     → {r.status_code}  ({len(lines)} rows)")
if len(lines) > 1:
    print(f"      {lines[1]}")

print(f"\n✓ Done. {len(leads_data)} leads + {enriched_count} enriched under user {user_id}.")
print(f"  Login: {TEST_EMAIL} / {TEST_PASS}")
print(f"  Run to clean up: python3 cleanup_test.py {user_id}")
