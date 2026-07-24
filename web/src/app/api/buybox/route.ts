import { NextResponse, type NextRequest } from "next/server";
import { runBuyBox, type BuyBox } from "@/lib/apify";
import { createClient } from "@/lib/supabase/server";

// Off-market (Propwire) scrapes are slower than Zillow, so scrape + skip trace
// can run past a minute. Needs a Pro-plan function limit.
export const maxDuration = 300;

const PUBLIC_TRACE_CAP = 100;
const WINDOW_MS = 60 * 60 * 1000;
// Only ANONYMOUS callers (the public /buybox link) are throttled, and generously
// — signed-in members are trusted and never rate limited. This just slows abuse
// of the open link; per-call cost is bounded by PUBLIC_TRACE_CAP.
const MAX_RUNS_PER_WINDOW = 40;

// Best-effort throttle. Serverless instances don't share memory, so this slows
// abuse rather than preventing it.
const hits = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_RUNS_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
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
  // Signed-in members search freely; only the open public link is throttled.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (rateLimited(ip, Date.now())) {
      return NextResponse.json(
        { error: "That's a lot of searches from this connection. Try again in a little while." },
        { status: 429 }
      );
    }
  }

  let body: BuyBox;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const hasArea = body.area?.trim() || (body.areas ?? []).some((a) => a?.trim());
  if (!hasArea) {
    return NextResponse.json(
      { error: "Enter an area — a city and state, a ZIP code, or a state." },
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
