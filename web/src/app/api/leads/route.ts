import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BuyBoxLead } from "@/lib/apify";

// Saved leads live per investor. Reads and writes go through the investor's own
// authenticated client, so row-level security scopes everything to auth.uid().

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}

// Save a batch of buy box results. Upsert on (investor_id, address) so re-saving
// the same property refreshes it instead of duplicating.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { area?: string; leads?: BuyBoxLead[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const leads = body.leads ?? [];
  if (!leads.length) return NextResponse.json({ error: "No leads to save." }, { status: 400 });

  const rows = leads.map((l) => ({
    investor_id: user.id,
    address: l.address || `${l.street}, ${l.city}, ${l.state} ${l.zip}`.trim(),
    street: l.street,
    city: l.city,
    state: l.state,
    zip: l.zip,
    price: l.price || null,
    beds: l.beds || null,
    baths: l.baths || null,
    sqft: l.sqft || null,
    listing_url: l.url,
    img_src: l.imgSrc,
    area: body.area ?? null,
    owner_name: l.owner ? `${l.owner.firstName} ${l.owner.lastName}`.trim() : null,
    owner_age: l.owner?.age || null,
    owner_mailing: l.owner?.address || null,
    phones: l.owner?.phones ?? [],
    emails: l.owner?.emails ?? [],
  }));

  const { error, count } = await supabase
    .from("saved_leads")
    .upsert(rows, { onConflict: "investor_id,address", count: "exact" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: count ?? rows.length });
}
