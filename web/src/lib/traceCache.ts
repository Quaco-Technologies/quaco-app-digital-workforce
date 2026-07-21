// Global skip-trace cache (server-only). Skip tracing the same address twice is
// pure waste — the owner rarely changes — so results are cached in Supabase and
// reused across every search and every investor.
//
// Everything here fails open: if Supabase is slow or down, a search still runs,
// it just pays Apify like it used to. The cache can never break the product.
import type { SkipTraceResult } from "@/lib/apify";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Skip-trace data goes stale slowly; re-verify anything older than this.
const TTL_DAYS = 90;

export function traceKey(query: string): string {
  return query.replace(/\s+/g, " ").trim().toLowerCase();
}

function enabled(): boolean {
  return Boolean(URL && SERVICE_KEY);
}

function headers() {
  return {
    apikey: SERVICE_KEY!,
    Authorization: `Bearer ${SERVICE_KEY!}`,
    "Content-Type": "application/json",
  };
}

interface CacheRow {
  query_key: string;
  result: SkipTraceResult;
}

// Look up many keys in one request. Returns only fresh (non-expired) hits.
export async function getCachedTraces(keys: string[]): Promise<Map<string, SkipTraceResult>> {
  const out = new Map<string, SkipTraceResult>();
  if (!enabled() || keys.length === 0) return out;

  const cutoff = new Date(Date.now() - TTL_DAYS * 86_400_000).toISOString();
  const inList = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(",");
  const url =
    `${URL}/rest/v1/skip_trace_cache?select=query_key,result` +
    `&query_key=in.(${encodeURIComponent(inList)})` +
    `&created_at=gte.${encodeURIComponent(cutoff)}`;

  try {
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return out;
    const rows = (await res.json()) as CacheRow[];
    for (const r of rows) out.set(r.query_key, r.result);
  } catch {
    // fail open — treat as all-miss
  }
  return out;
}

// Upsert freshly traced rows. Refreshes created_at so a re-traced key restarts
// its TTL. Best-effort: a write failure just means we may trace it again later.
export async function putCachedTraces(
  entries: { key: string; result: SkipTraceResult }[]
): Promise<void> {
  if (!enabled() || entries.length === 0) return;

  const body = entries.map((e) => ({
    query_key: e.key,
    result: e.result,
    has_phone: (e.result.phones?.length ?? 0) > 0,
    created_at: new Date().toISOString(),
  }));

  try {
    await fetch(`${URL}/rest/v1/skip_trace_cache`, {
      method: "POST",
      headers: { ...headers(), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(body),
    });
  } catch {
    // best-effort
  }
}
