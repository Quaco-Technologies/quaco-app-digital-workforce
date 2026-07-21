// Server-only Apify helpers. The APIFY_TOKEN is read here and never sent to the
// browser — only route handlers (server code) import this module.
import { getCachedTraces, putCachedTraces, traceKey } from "@/lib/traceCache";

const TOKEN = process.env.APIFY_TOKEN;
const SKIPTRACE_ACTOR = process.env.APIFY_SKIPTRACE_ACTOR ?? "one-api~skip-trace";
const ZILLOW_ACTOR = process.env.APIFY_ZILLOW_ACTOR ?? "maxcopell~zillow-scraper";

export interface SkipTracePhone {
  number: string;
  type: string;
  provider: string;
  lastReported: string;
  // "Primary" / "Secondary" / "Alt" for reachable mobiles, "" for landlines.
  label: string;
}

// "Last reported Jun 2026" → a sortable timestamp. The actor sometimes puts a
// carrier name in this column instead of a date, so anything unparseable sorts
// last rather than throwing off the order.
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function reportedAt(lastReported: string): number {
  const m = lastReported.match(/([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (!m) return 0;
  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) return 0;
  return new Date(Number(m[2]), month).getTime();
}

const isMobile = (p: SkipTracePhone) => /wireless|mobile|cell/i.test(p.type);

// Investors call and text these numbers, so a mobile beats a landline even when
// the landline was reported more recently — you can't text a landline, and the
// listed landline is often a relative's or a disconnected legacy record. Within
// each group the most recently reported number wins.
function rankPhones(phones: SkipTracePhone[]): SkipTracePhone[] {
  const sorted = [...phones].sort((a, b) => {
    if (isMobile(a) !== isMobile(b)) return isMobile(a) ? -1 : 1;
    return reportedAt(b.lastReported) - reportedAt(a.lastReported);
  });

  let mobileSeen = 0;
  return sorted.map((p) => {
    if (!isMobile(p)) return { ...p, label: "" };
    mobileSeen += 1;
    return {
      ...p,
      label: mobileSeen === 1 ? "Primary" : mobileSeen === 2 ? "Secondary" : "Alt",
    };
  });
}

export interface SkipTraceResult {
  searchOption: string;
  inputGiven: string;
  firstName: string;
  lastName: string;
  age: string;
  livesIn: string;
  address: string;
  county: string;
  emails: string[];
  phones: SkipTracePhone[];
}

export interface Property {
  address: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  priceText: string;
  beds: number;
  baths: number;
  sqft: number;
  status: string;
  url: string;
  imgSrc: string;
  // Off-market only: "Pre-foreclosure" / "Auction" / "Bank-owned" / "Foreclosure".
  distress?: string;
  // Off-market only: estimated equity % and whether the owner lives elsewhere.
  equity?: number;
  absentee?: boolean;
}

export interface BuyBoxLead extends Property {
  owner: SkipTraceResult | null;
}

export interface BuyBox {
  area: string; // "City, ST" or ZIP
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  bathsMin?: number;
  limit?: number; // cap how many owners we skip trace (cost control)
  // "forsale" = on-market Zillow listings (default). "offmarket" = distressed
  // (foreclosure / pre-foreclosure / auction / bank-owned).
  source?: "forsale" | "offmarket";
}

function requireToken(): string {
  if (!TOKEN) throw new Error("APIFY_TOKEN is not configured on the server.");
  return TOKEN;
}

function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return v == null ? "" : String(v).trim();
}

// The skip-trace actor returns flat columns: Email-1..5, Phone-1, Phone-1 Type…
export function normalizeSkipRow(row: Record<string, unknown>): SkipTraceResult {
  const emails: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const e = str(row, `Email-${i}`);
    if (e) emails.push(e);
  }
  const phones: SkipTracePhone[] = [];
  for (let i = 1; i <= 10; i++) {
    const number = str(row, `Phone-${i}`);
    if (!number) continue;
    phones.push({
      number,
      type: str(row, `Phone-${i} Type`),
      provider: str(row, `Phone-${i} Provider`),
      lastReported: str(row, `Phone-${i} Last Reported`),
      label: "",
    });
  }
  // The actor returns a sentinel name row when nothing matched.
  let firstName = str(row, "First Name");
  let lastName = str(row, "Last Name");
  if (/person not found|could not find/i.test(firstName)) {
    firstName = "";
    lastName = "";
  }

  return {
    searchOption: str(row, "Search Option"),
    inputGiven: str(row, "Input Given"),
    firstName,
    lastName,
    age: str(row, "Age"),
    livesIn: str(row, "Lives in"),
    address: [
      str(row, "Street Address"),
      str(row, "Address Locality"),
      str(row, "Address Region"),
      str(row, "Postal Code"),
    ]
      .filter(Boolean)
      .join(", "),
    county: str(row, "County Name"),
    emails,
    phones: rankPhones(phones),
  };
}

async function runActorSync(
  actor: string,
  input: unknown,
  timeoutSecs = 240,
  maxItems?: number
): Promise<Record<string, unknown>[]> {
  const token = requireToken();
  // These actors bill per row returned, and maxItems is enforced by the Apify
  // platform — rows beyond it are never produced, so they are never charged.
  const cap = maxItems ? `&maxItems=${maxItems}` : "";
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}${cap}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Apify ${actor} returned ${res.status}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>[];
}

export interface SkipTraceInput {
  street_citystatezip?: string[];
  name?: string[];
  phone_number?: string[];
  email?: string[];
  max_results?: number;
}

export async function skipTrace(input: SkipTraceInput): Promise<SkipTraceResult[]> {
  const rows = await runActorSync(SKIPTRACE_ACTOR, {
    street_citystatezip: input.street_citystatezip ?? [],
    name: input.name ?? [],
    phone_number: input.phone_number ?? [],
    email: input.email ?? [],
    max_results: input.max_results ?? 5,
  });
  return rows.map(normalizeSkipRow);
}

// Geocode an area ("Atlanta, GA" or "30303") to a Zillow map bounding box.
export async function geocodeBounds(
  area: string
): Promise<{ west: number; east: number; south: number; north: number; display: string }> {
  const q = encodeURIComponent(area.trim());
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`;
  const res = await fetch(url, { headers: { "User-Agent": "birdog-skiptrace/1.0" } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status}).`);
  const data = (await res.json()) as { boundingbox: string[]; display_name: string }[];
  if (!data.length) throw new Error(`Could not find "${area}". Try "City, ST" or a ZIP code.`);
  const [south, north, west, east] = data[0].boundingbox.map(Number);
  return { south, north, west, east, display: data[0].display_name };
}

function normalizeZillow(row: Record<string, unknown>): Property | null {
  const street = str(row, "addressStreet");
  const address = str(row, "address");
  if (!address && !street) return null;

  // Drop rows that aren't a real, traceable house. Builder floor plans ("Martin
  // Plan, Twin Creeks Watters") and undisclosed-address listings have no owner
  // of record, so skip tracing them burns spend and returns nothing.
  if (row.isPaidBuilderNewConstruction === true) return null;
  if (row.isUndisclosedAddress === true) return null;
  if (!str(row, "zpid")) return null;
  if (!/^\d/.test(street || address)) return null;

  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  return {
    address: address || street,
    street: street || address,
    city: str(row, "addressCity"),
    state: str(row, "addressState"),
    zip: str(row, "addressZipcode"),
    price: num(row.unformattedPrice),
    priceText: str(row, "price"),
    beds: num(row.beds),
    baths: num(row.baths),
    sqft: num(row.area),
    status: str(row, "statusType"),
    url: str(row, "detailUrl"),
    imgSrc: str(row, "imgSrc"),
  };
}

// The investor typed an area and expects properties *in* that area. A geocoded
// bounding box is a rectangle, so it also covers neighbouring towns — a "Plano,
// TX" box reaches into Allen. Pin results back to what they actually asked for.
function localityFilter(area: string): (p: Property) => boolean {
  const trimmed = area.trim();
  const zip = trimmed.match(/^(\d{5})/);
  if (zip) return (p) => p.zip === zip[1];

  // "City, ST" — match the city name. Anything else (a state, a county) is
  // intentionally broad, so leave it to the bounding box.
  const comma = trimmed.indexOf(",");
  if (comma > 0) {
    const city = trimmed.slice(0, comma).trim().toLowerCase();
    if (city) return (p) => p.city.trim().toLowerCase() === city;
  }
  return () => true;
}

// The scraper bills per listing returned ($0.002 each) and would hand back ~820
// rows for a dense metro — $1.64 — when a 50-lead run only ever reads the first
// ~80 that survive the buy box. Capping the scrape is the single biggest cost
// lever in the pipeline.
//
// 300 keeps a wide margin: a city search retains roughly half its rows through
// the buy box filters, so 300 scanned still yields far more matches than the
// ~80 needed for 50 traced leads. Sorting is newest-first, so the cap keeps the
// freshest listings rather than an arbitrary slice.
const SCRAPE_MAX_ITEMS = 300;

export interface ScrapeResult {
  props: Property[];
  scanned: number;
  capped: boolean;
}

export async function scrapeProperties(box: BuyBox): Promise<ScrapeResult> {
  const b = await geocodeBounds(box.area);

  const filterState: Record<string, unknown> = {
    sort: { value: "days" },
    ah: { value: true },
  };
  if (box.priceMin != null || box.priceMax != null) {
    filterState.price = {
      ...(box.priceMin != null ? { min: box.priceMin } : {}),
      ...(box.priceMax != null ? { max: box.priceMax } : {}),
    };
  }
  if (box.bedsMin != null) filterState.beds = { min: box.bedsMin };
  if (box.bathsMin != null) filterState.baths = { min: box.bathsMin };

  const sqs = {
    isMapVisible: true,
    mapBounds: { west: b.west, east: b.east, south: b.south, north: b.north },
    filterState,
    isListVisible: true,
    pagination: {},
  };
  const searchUrl =
    "https://www.zillow.com/homes/for_sale/?searchQueryState=" +
    encodeURIComponent(JSON.stringify(sqs));

  const rows = await runActorSync(
    ZILLOW_ACTOR,
    { searchUrls: [{ url: searchUrl }], extractionMethod: "PAGINATION" },
    240,
    SCRAPE_MAX_ITEMS
  );

  let props = rows
    .map(normalizeZillow)
    .filter((p): p is Property => p !== null && p.status === "FOR_SALE");

  // Keep only what the investor actually asked for.
  props = props.filter(localityFilter(box.area));

  // A listing with no published price (auction, coming-soon) can't be evaluated
  // against a buy box and reads as a broken "$0" card, so it never belongs in
  // the results — whether or not a price bound was set.
  props = props.filter((p) => p.price > 0);

  // Belt-and-suspenders: re-apply the buy box in case the actor returns a few
  // out-of-band rows. A criterion the investor set has to be *proven* met.
  if (box.priceMin != null) props = props.filter((p) => p.price >= box.priceMin!);
  if (box.priceMax != null) props = props.filter((p) => p.price <= box.priceMax!);
  if (box.bedsMin != null) props = props.filter((p) => p.beds >= box.bedsMin!);
  if (box.bathsMin != null) props = props.filter((p) => p.baths >= box.bathsMin!);

  return { props, scanned: rows.length, capped: rows.length >= SCRAPE_MAX_ITEMS };
}

// ---------------------------------------------------------------------------
// Off-market source — PRE-FORECLOSURE via Propwire. These owners are behind on
// payments but still own the home and aren't on the market: the most motivated
// sellers, and where wholesale deals come from. (Zillow can't surface these.)
// ---------------------------------------------------------------------------
const OFFMARKET_ACTOR = process.env.APIFY_OFFMARKET_ACTOR ?? "memo23~propwire-leads-scraper";

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

// Build a Propwire search URL for the investor's area. Propwire targets by a
// location object in the URL — a city needs its state; a ZIP stands alone.
function propwireUrl(area: string, leadType: string): string | null {
  const trimmed = area.trim();
  const zip = trimmed.match(/^(\d{5})$/);
  let location: Record<string, unknown> | null = null;
  if (zip) {
    location = { searchType: "Z", zip: zip[1], title: `${zip[1]}, USA` };
  } else {
    const m = trimmed.match(/^(.+),\s*([A-Za-z]{2})$/);
    if (m) {
      const city = m[1].trim();
      const st = m[2].toUpperCase();
      location = {
        searchType: "C",
        city,
        state: st,
        title: `${city}, ${st}, USA`,
        stateName: US_STATES[st] ?? st,
      };
    }
  }
  if (!location) return null;
  const filters = { locations: [location], lead_type: [leadType], property_type: ["sfr"] };
  return "https://propwire.com/search?filters=" + encodeURIComponent(JSON.stringify(filters));
}

function normalizePropwire(row: Record<string, unknown>): Property | null {
  const addr = (row.address ?? {}) as Record<string, unknown>;
  const street = String(addr.address ?? "").trim();
  if (!street || !/^\d/.test(street)) return null;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const lead = (row.lead_type ?? {}) as Record<string, boolean>;
  const mls = (row.mls_details ?? {}) as Record<string, unknown>;
  const price = num(row.estimated_value);
  const equity = num(row.estimated_equity_percentage);
  return {
    address: [street, addr.city, addr.state, addr.zip].filter(Boolean).join(", "),
    street,
    city: String(addr.city ?? ""),
    state: String(addr.state ?? ""),
    zip: String(addr.zip ?? ""),
    price,
    priceText: price ? `~$${price.toLocaleString()} est.` : "Value N/A",
    beds: num(row.bedrooms),
    baths: num(row.bathrooms),
    sqft: num(row.building_area_sf) || num(row.living_area_sf),
    status: "OFF_MARKET",
    url: "",
    imgSrc: String(mls.photo_url ?? ""),
    distress: "Pre-foreclosure",
    equity: equity || undefined,
    absentee: lead.absentee_owner || undefined,
  };
}

// Propwire is slower per item than Zillow (~5 items/sec), so cap lower to keep
// the scrape well inside the request budget and leave time for skip tracing.
// 120 pre-foreclosures is plenty to yield 50 with-phone leads at a ~65% rate.
const OFFMARKET_MAX_ITEMS = 120;

export async function scrapeOffMarket(box: BuyBox): Promise<ScrapeResult> {
  const url = propwireUrl(box.area, "preforeclosure");
  if (!url) {
    throw new Error('For off-market, enter an area as "City, ST" or a 5-digit ZIP.');
  }

  const rows = await runActorSync(
    OFFMARKET_ACTOR,
    { startUrls: [{ url }], maxItems: OFFMARKET_MAX_ITEMS, proxy: { useApifyProxy: true } },
    240,
    OFFMARKET_MAX_ITEMS
  );

  let props = rows.map(normalizePropwire).filter((p): p is Property => p !== null);

  // Value is an estimate; only filter when a bound is set and we have a number.
  if (box.priceMin != null) props = props.filter((p) => !p.price || p.price >= box.priceMin!);
  if (box.priceMax != null) props = props.filter((p) => !p.price || p.price <= box.priceMax!);
  if (box.bedsMin != null) props = props.filter((p) => !p.beds || p.beds >= box.bedsMin!);
  if (box.bathsMin != null) props = props.filter((p) => !p.baths || p.baths >= box.bathsMin!);

  return { props, scanned: rows.length, capped: rows.length >= OFFMARKET_MAX_ITEMS };
}

// Share of traced owners that come back with a phone number, measured on live
// runs. Only the seed for batch one — after that the real rate is used.
const EXPECTED_HIT_RATE = 0.65;

// Ceiling on traces per requested lead, so a region with unusually poor phone
// coverage can't quietly spend several times what the investor expected.
const MAX_TRACE_MULTIPLE = 3;

// Total wall-clock budget for the whole request (scrape + trace), kept under
// the route's maxDuration. Measured from the function start, so a slower scrape
// (off-market/Propwire) simply leaves a shorter — but still used — trace window,
// instead of the old fixed deadlines that a slow scrape blew past entirely.
const TOTAL_BUDGET_MS = 110_000;
const RESPONSE_MARGIN_MS = 6_000;
const MS_PER_TRACE = 400;

// Primary flow: buy box in → matching properties with owner contact info out.
export async function runBuyBox(box: BuyBox): Promise<{
  area: string;
  found: number;
  scanned: number;
  capped: boolean;
  traced: number;
  paid: number;
  cached: number;
  noPhone: number;
  leads: BuyBoxLead[];
}> {
  const startedAt = Date.now();
  const { props: all, scanned, capped } =
    box.source === "offmarket" ? await scrapeOffMarket(box) : await scrapeProperties(box);
  const wanted = Math.max(1, Math.min(box.limit ?? 25, 100));

  if (!all.length) {
    return { area: box.area, found: 0, scanned, capped, traced: 0, paid: 0, cached: 0, noPhone: 0, leads: [] };
  }

  // Asking for 50 means 50 owners you can actually call, so we trace past that
  // to cover the misses. Roughly a third of owners have no number on record
  // (LLCs, trusts, out-of-state holders), so the first batch is sized by the
  // observed hit rate and later batches re-estimate from what we've seen.
  const leads: BuyBoxLead[] = [];
  let cursor = 0;
  let examined = 0; // owners looked at (cache hits + fresh)
  let paid = 0; // owners actually traced via Apify (what we spent on)
  let cachedHits = 0; // owners served from the cache (what we saved)

  // The cost cap and the "trace more to hit the target" logic apply to *paid*
  // traces — cache hits are free, so they never count against the ceiling.
  while (leads.length < wanted && cursor < all.length && paid < wanted * MAX_TRACE_MULTIPLE) {
    // Leave room to serialize and return inside the function limit rather than
    // dying at the ceiling with nothing to show.
    const remaining = TOTAL_BUDGET_MS - RESPONSE_MARGIN_MS - (Date.now() - startedAt);
    if (remaining <= 0) break;

    const hitRate = examined > 0 ? Math.max(0.2, leads.length / examined) : EXPECTED_HIT_RATE;
    const affordable = Math.floor(remaining / MS_PER_TRACE);
    if (affordable < 1) break;

    const batchSize = Math.min(
      Math.ceil((wanted - leads.length) / hitRate),
      all.length - cursor,
      // Never let a batch's worst case (all misses) exceed the paid ceiling…
      wanted * MAX_TRACE_MULTIPLE - paid,
      // …or overrun the time budget.
      affordable
    );

    const batch = all.slice(cursor, cursor + batchSize);
    cursor += batch.length;
    examined += batch.length;

    const queries = batch.map(
      (p) => `${p.street}; ${[p.city, p.state].filter(Boolean).join(", ")} ${p.zip}`.trim()
    );
    const keys = queries.map(traceKey);

    // Cache first — one lookup for the whole batch.
    const cached = await getCachedTraces(keys);
    cachedHits += keys.filter((k) => cached.has(k)).length;

    // Only the misses cost money.
    const missIdx = keys.map((k, i) => (cached.has(k) ? -1 : i)).filter((i) => i >= 0);
    const fresh = new Map<string, SkipTraceResult>();
    if (missIdx.length) {
      const owners = await skipTrace({
        street_citystatezip: missIdx.map((i) => queries[i]),
        max_results: 1,
      });
      const byInput = new Map<string, SkipTraceResult>();
      for (const t of owners) {
        const key = traceKey(t.inputGiven);
        if (key && !byInput.has(key)) byInput.set(key, t);
      }
      // Record every miss — including "no owner found" — so we never pay to
      // look it up again. traceKey(query) is the stable key.
      const toWrite: { key: string; result: SkipTraceResult }[] = [];
      for (const i of missIdx) {
        const result = byInput.get(keys[i]) ?? emptyTrace(queries[i]);
        fresh.set(keys[i], result);
        toWrite.push({ key: keys[i], result });
      }
      await putCachedTraces(toWrite);
      paid += missIdx.length;
    }

    batch.forEach((p, i) => {
      const owner = cached.get(keys[i]) ?? fresh.get(keys[i]) ?? null;
      // A property whose owner has no phone is a dead end — never surfaced.
      if (owner && owner.phones.length > 0) leads.push({ ...p, owner });
    });
  }

  const delivered = leads.slice(0, wanted);
  return {
    area: box.area,
    found: all.length,
    scanned,
    capped,
    traced: examined,
    paid,
    cached: cachedHits,
    noPhone: examined - delivered.length,
    leads: delivered,
  };
}

// A "we looked and found nothing" placeholder, cached so the same dead address
// isn't re-traced on the next search.
function emptyTrace(query: string): SkipTraceResult {
  return {
    searchOption: "",
    inputGiven: query,
    firstName: "",
    lastName: "",
    age: "",
    livesIn: "",
    address: "",
    county: "",
    emails: [],
    phones: [],
  };
}
