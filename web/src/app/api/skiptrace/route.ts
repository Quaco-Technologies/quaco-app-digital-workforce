import { NextResponse, type NextRequest } from "next/server";
import { skipTrace, type SkipTraceInput } from "@/lib/apify";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Secondary tool: manual skip trace by address / name / phone / email.
export async function POST(request: NextRequest) {
  // Spends Apify credit per lookup — authenticated investors only.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to run a skip trace." }, { status: 401 });
  }

  let body: SkipTraceInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const hasQuery =
    body.street_citystatezip?.filter(Boolean).length ||
    body.name?.filter(Boolean).length ||
    body.phone_number?.filter(Boolean).length ||
    body.email?.filter(Boolean).length;

  if (!hasQuery) {
    return NextResponse.json(
      { error: "Enter an address, name, phone, or email to skip trace." },
      { status: 400 }
    );
  }

  try {
    const results = await skipTrace(body);
    return NextResponse.json({ count: results.length, results });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
