import { NextResponse, type NextRequest } from "next/server";
import { runBuyBox, type BuyBox } from "@/lib/apify";

// Scraping a metro and then skip tracing the owners runs ~20s and can reach a
// minute on a dense area. Without this the platform default (10-15s) kills the
// request and the investor sees a 504 on every search.
// Off-market (Propwire) scrapes are slower than Zillow, so scrape + skip trace
// can run past a minute. Needs a Pro-plan function limit.
export const maxDuration = 300;

// This endpoint is intentionally open — /buybox is shared as a plain link with
// no sign-in. That means anyone with the URL can spend Apify credit, so the
// cost of a single run is capped and repeat callers are throttled.
//
// The cap is set by the 60s function timeout, not by cost: skip traces are
// $0.007 each, but they run sequentially at roughly a third of a second apiece.
// 50 traces measured 26s on a small area, and a dense metro spends ~20s on the
// listing scrape before tracing starts, so 50 leaves real headroom under the
// limit while 100 would not.
const PUBLIC_TRACE_CAP = 100;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_RUNS_PER_WINDOW = 5;

// Best-effort throttle. Serverless instances don't share memory, so this slows
// abuse rather than preventing it; PUBLIC_TRACE_CAP is what actually bounds the
// spend per call.
const hits = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_RUNS_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);

  // Keep the map from growing without bound across a long-lived instance.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

// Primary flow: buy box (area + criteria) in → matching properties with owner
// contact info out. Scrapes the area, then skip traces the owners.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (rateLimited(ip, Date.now())) {
    return NextResponse.json(
      { error: "That's a lot of searches. Try again in a little while." },
      { status: 429 }
    );
  }

  let body: BuyBox;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.area?.trim()) {
    return NextResponse.json(
      { error: "Enter an area — a city and state, or a ZIP code." },
      { status: 400 }
    );
  }

  try {
    const result = await runBuyBox({
      ...body,
      limit: Math.min(body.limit ?? PUBLIC_TRACE_CAP, PUBLIC_TRACE_CAP),
    });
    return NextResponse.json(result);
  } catch (err) {
    // Don't leak raw actor errors to the UI. A flaky data-provider run gets a
    // friendly retry message; anything we deliberately threw (e.g. a bad area)
    // is already user-facing and passes through.
    const msg = (err as Error).message;
    const friendly = msg.includes("ACTOR_FAILED")
      ? "The search service is busy right now. Please try again in a moment."
      : msg;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}
