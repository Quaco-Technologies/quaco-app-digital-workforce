import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BuyBoxLead } from "@/lib/apify";

// A signed-in investor's buy box history. Each run is one saved_searches row
// plus its leads. RLS scopes everything to auth.uid().

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, area, params, found, traced, lead_count, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ searches: data ?? [] });
}

interface SavePayload {
  area?: string;
  params?: Record<string, unknown>;
  found?: number;
  traced?: number;
  leads?: BuyBoxLead[];
}

// Auto-save: called by the client right after a buy box search returns.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: SavePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const leads = body.leads ?? [];
  if (!leads.length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  const { data: search, error: searchErr } = await supabase
    .from("saved_searches")
    .insert({
      investor_id: user.id,
      area: body.area ?? null,
      params: body.params ?? {},
      found: body.found ?? 0,
      traced: body.traced ?? 0,
      lead_count: leads.length,
    })
    .select("id")
    .single();

  if (searchErr || !search) {
    return NextResponse.json({ error: searchErr?.message ?? "Save failed." }, { status: 500 });
  }

  // Full lead stored as jsonb so a reopened search renders identically; a few
  // flat columns kept for display and future filtering.
  const rows = leads.map((l) => ({
    investor_id: user.id,
    search_id: search.id,
    address: l.address || `${l.street}, ${l.city}, ${l.state} ${l.zip}`.trim(),
    city: l.city,
    state: l.state,
    price: l.price || null,
    owner_name: l.owner ? `${l.owner.firstName} ${l.owner.lastName}`.trim() : null,
    lead: l,
  }));

  const { error: leadsErr } = await supabase.from("saved_leads").insert(rows);
  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });

  return NextResponse.json({ id: search.id, saved: rows.length });
}
