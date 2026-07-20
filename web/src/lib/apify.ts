// Server-only Apify helpers. The APIFY_TOKEN is read here and never sent to the
// browser — only route handlers (server code) import this module.
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
  timeoutSecs = 240
): Promise<Record<string, unknown>[]> {
  const token = requireToken();
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}`;
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

// Zillow's own search pagination stops around 800 listings, so a dense metro
// returns a truncated slice rather than every listing in the area. We surface
// that instead of implying the number is the whole market.
const SCRAPE_CEILING = 800;

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

  const rows = await runActorSync(ZILLOW_ACTOR, {
    searchUrls: [{ url: searchUrl }],
    extractionMethod: "PAGINATION",
  });

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

  return { props, scanned: rows.length, capped: rows.length >= SCRAPE_CEILING };
}

// Primary flow: buy box in → matching properties with owner contact info out.
export async function runBuyBox(box: BuyBox): Promise<{
  area: string;
  found: number;
  scanned: number;
  capped: boolean;
  traced: number;
  noPhone: number;
  leads: BuyBoxLead[];
}> {
  const { props: all, scanned, capped } = await scrapeProperties(box);
  const limit = Math.max(1, Math.min(box.limit ?? 25, 100));
  const target = all.slice(0, limit);

  if (!target.length) {
    return { area: box.area, found: 0, scanned, capped, traced: 0, noPhone: 0, leads: [] };
  }

  // One batched skip-trace call for all addresses; results carry "Input Given".
  const queries = target.map(
    (p) => `${p.street}; ${[p.city, p.state].filter(Boolean).join(", ")} ${p.zip}`.trim()
  );
  const owners = await skipTrace({ street_citystatezip: queries, max_results: 1 });

  const byInput = new Map<string, SkipTraceResult>();
  for (const t of owners) {
    const key = t.inputGiven.replace(/\s+/g, " ").trim().toLowerCase();
    if (key && !byInput.has(key)) byInput.set(key, t);
  }

  const traced: BuyBoxLead[] = target.map((p, i) => {
    const key = queries[i].replace(/\s+/g, " ").trim().toLowerCase();
    return { ...p, owner: byInput.get(key) ?? null };
  });

  // The point of the list is someone to call. A property whose owner has no
  // phone number is a dead end, so it never reaches the investor.
  const leads = traced.filter((l) => (l.owner?.phones.length ?? 0) > 0);

  return {
    area: box.area,
    found: all.length,
    scanned,
    capped,
    traced: traced.length,
    noPhone: traced.length - leads.length,
    leads,
  };
}
