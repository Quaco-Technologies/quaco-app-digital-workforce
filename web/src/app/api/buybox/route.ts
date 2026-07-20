import { NextResponse, type NextRequest } from "next/server";
import { runBuyBox, type BuyBox } from "@/lib/apify";
import { createClient } from "@/lib/supabase/server";

// Scraping a metro and then skip tracing the owners runs ~20s and can reach a
// minute on a dense area. Without this the platform default (10-15s) kills the
// request and the investor sees a 504 on every search.
export const maxDuration = 60;

// Primary flow: buy box (area + criteria) in → matching properties with owner
// contact info out. Scrapes the area, then skip traces the owners.
export async function POST(request: NextRequest) {
  // Every run spends real Apify credit, so this cannot be an open endpoint.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to run a buy box search." }, { status: 401 });
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
    const result = await runBuyBox(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
