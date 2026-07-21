import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BuyBoxLead } from "@/lib/apify";

// One saved search, reconstructed into the exact shape the results UI renders,
// so reopening it looks and exports identically to the live search.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: search, error } = await supabase
    .from("saved_searches")
    .select("id, area, params, found, traced, lead_count, created_at")
    .eq("id", id)
    .single();
  if (error || !search) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: leadRows, error: leadsErr } = await supabase
    .from("saved_leads")
    .select("lead, created_at")
    .eq("search_id", id)
    .order("created_at", { ascending: true });
  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });

  const leads = (leadRows ?? []).map((r) => r.lead as BuyBoxLead);

  // Same object shape the buy box route returns.
  return NextResponse.json({
    area: search.area,
    found: search.found,
    scanned: 0,
    capped: false,
    traced: search.traced,
    noPhone: Math.max(0, (search.traced ?? 0) - leads.length),
    leads,
    savedAt: search.created_at,
    params: search.params,
  });
}
