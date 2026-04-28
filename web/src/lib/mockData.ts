import { LeadStatus } from "@/lib/types";

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  conversion: number | null;
}

export interface MockContract {
  id: string;
  lead_id: string;
  address: string;
  city: string;
  state: string;
  owner_name: string;
  agreed_price: number;
  status: "sent" | "completed" | "voided";
  sent_at: string;
  completed_at: string | null;
  envelope_id: string;
}

export interface MockSequence {
  id: string;
  name: string;
  trigger: "no_reply" | "interested" | "not_interested";
  delay_days: number;
  message_template: string;
  enabled: boolean;
  fired_count: number;
  reply_rate: number;
}

export interface MockWeeklyMetric {
  week: string;
  scraped: number;
  qualified: number;
  contacted: number;
  replied: number;
  contracted: number;
}

export interface MockMarketInsight {
  market: string;
  state: string;
  active_leads: number;
  avg_offer: number;
  reply_rate: number;
  trend: "up" | "down" | "flat";
}

const STAGE_ORDER: Array<{ key: LeadStatus | "scraped"; label: string }> = [
  { key: "scraped", label: "Records Scraped" },
  { key: "skip_traced", label: "Skip Traced" },
  { key: "analyzed", label: "Offer Calculated" },
  { key: "outreach", label: "Outreach Sent" },
  { key: "negotiating", label: "In Negotiation" },
  { key: "under_contract", label: "Under Contract" },
  { key: "closed", label: "Closed" },
];

export function buildFunnel(stats: {
  total_scraped: number;
  by_status: Partial<Record<LeadStatus, number>>;
}): FunnelStage[] {
  const cumulative: Record<string, number> = {
    scraped: stats.total_scraped,
    skip_traced:
      (stats.by_status.skip_traced ?? 0) +
      (stats.by_status.enriched ?? 0) +
      (stats.by_status.analyzed ?? 0) +
      (stats.by_status.outreach ?? 0) +
      (stats.by_status.negotiating ?? 0) +
      (stats.by_status.under_contract ?? 0) +
      (stats.by_status.closed ?? 0),
    analyzed:
      (stats.by_status.analyzed ?? 0) +
      (stats.by_status.outreach ?? 0) +
      (stats.by_status.negotiating ?? 0) +
      (stats.by_status.under_contract ?? 0) +
      (stats.by_status.closed ?? 0),
    outreach:
      (stats.by_status.outreach ?? 0) +
      (stats.by_status.negotiating ?? 0) +
      (stats.by_status.under_contract ?? 0) +
      (stats.by_status.closed ?? 0),
    negotiating:
      (stats.by_status.negotiating ?? 0) +
      (stats.by_status.under_contract ?? 0) +
      (stats.by_status.closed ?? 0),
    under_contract:
      (stats.by_status.under_contract ?? 0) +
      (stats.by_status.closed ?? 0),
    closed: stats.by_status.closed ?? 0,
  };

  return STAGE_ORDER.map((s, i) => {
    const count = cumulative[s.key];
    const prev = i === 0 ? null : cumulative[STAGE_ORDER[i - 1].key];
    const conversion = prev && prev > 0 ? count / prev : null;
    return { key: s.key, label: s.label, count, conversion };
  });
}

const SAMPLE_OWNERS = [
  "Maria Hernandez", "James Patel", "Linda Goodwin", "Marcus Chen",
  "Tasha Williams", "Robert Kim", "Emma O'Brien", "Devon Carter",
  "Sofia Rossi", "Aaron Brooks",
];

const SAMPLE_ADDRESSES: Array<{ address: string; city: string; state: string }> = [
  { address: "3857 N High St", city: "Atlanta", state: "GA" },
  { address: "1204 Maple Ridge Dr", city: "Dallas", state: "TX" },
  { address: "62 Oak Lane", city: "Atlanta", state: "GA" },
  { address: "991 Bayview Ave", city: "Tampa", state: "FL" },
  { address: "4421 W Pine St", city: "Charlotte", state: "NC" },
  { address: "707 Sunset Blvd", city: "Phoenix", state: "AZ" },
];

export function mockContracts(): MockContract[] {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  return [
    {
      id: "c1",
      lead_id: "lead-1",
      address: SAMPLE_ADDRESSES[0].address,
      city: SAMPLE_ADDRESSES[0].city,
      state: SAMPLE_ADDRESSES[0].state,
      owner_name: SAMPLE_OWNERS[0],
      agreed_price: 187_500,
      status: "sent",
      sent_at: new Date(now - 1 * day).toISOString(),
      completed_at: null,
      envelope_id: "env_8a4f2",
    },
    {
      id: "c2",
      lead_id: "lead-2",
      address: SAMPLE_ADDRESSES[1].address,
      city: SAMPLE_ADDRESSES[1].city,
      state: SAMPLE_ADDRESSES[1].state,
      owner_name: SAMPLE_OWNERS[1],
      agreed_price: 142_000,
      status: "completed",
      sent_at: new Date(now - 5 * day).toISOString(),
      completed_at: new Date(now - 1 * day).toISOString(),
      envelope_id: "env_3c1d9",
    },
    {
      id: "c3",
      lead_id: "lead-3",
      address: SAMPLE_ADDRESSES[2].address,
      city: SAMPLE_ADDRESSES[2].city,
      state: SAMPLE_ADDRESSES[2].state,
      owner_name: SAMPLE_OWNERS[2],
      agreed_price: 95_000,
      status: "sent",
      sent_at: new Date(now - 3 * day).toISOString(),
      completed_at: null,
      envelope_id: "env_b71e8",
    },
    {
      id: "c4",
      lead_id: "lead-4",
      address: SAMPLE_ADDRESSES[3].address,
      city: SAMPLE_ADDRESSES[3].city,
      state: SAMPLE_ADDRESSES[3].state,
      owner_name: SAMPLE_OWNERS[3],
      agreed_price: 215_000,
      status: "completed",
      sent_at: new Date(now - 12 * day).toISOString(),
      completed_at: new Date(now - 8 * day).toISOString(),
      envelope_id: "env_2f9a0",
    },
  ];
}

export function defaultSequences(): MockSequence[] {
  return [
    {
      id: "seq_followup_3d",
      name: "3-Day Follow-up",
      trigger: "no_reply",
      delay_days: 3,
      message_template:
        "Hey {first_name}, just wanted to follow up on my note about {address}. Cash offer still stands if you're open to a quick chat.",
      enabled: true,
      fired_count: 47,
      reply_rate: 0.18,
    },
    {
      id: "seq_followup_7d",
      name: "7-Day Final Touch",
      trigger: "no_reply",
      delay_days: 7,
      message_template:
        "Hi {first_name}, last note from me — if {address} is something you'd ever consider selling, I'd love to make a fair cash offer. No pressure either way.",
      enabled: true,
      fired_count: 23,
      reply_rate: 0.09,
    },
    {
      id: "seq_warm_2d",
      name: "Warm Lead Re-engage",
      trigger: "interested",
      delay_days: 2,
      message_template:
        "Hi {first_name}, circling back — were you able to think more about the offer on {address}?",
      enabled: false,
      fired_count: 8,
      reply_rate: 0.31,
    },
  ];
}

export function mockWeeklyMetrics(weeks = 8): MockWeeklyMetric[] {
  const now = new Date();
  const out: MockWeeklyMetric[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const base = 800 + Math.round(Math.sin(i / 1.5) * 200) + i * 30;
    const scraped = base;
    const qualified = Math.round(scraped * (0.18 + Math.random() * 0.04));
    const contacted = Math.round(qualified * (0.85 + Math.random() * 0.1));
    const replied = Math.round(contacted * (0.12 + Math.random() * 0.08));
    const contracted = Math.round(replied * (0.18 + Math.random() * 0.1));
    out.push({
      week: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      scraped, qualified, contacted, replied, contracted,
    });
  }
  return out;
}

export function mockMarkets(): MockMarketInsight[] {
  return [
    { market: "Atlanta Metro", state: "GA", active_leads: 142, avg_offer: 178_500, reply_rate: 0.21, trend: "up" },
    { market: "Dallas-Fort Worth", state: "TX", active_leads: 98, avg_offer: 211_000, reply_rate: 0.18, trend: "up" },
    { market: "Phoenix", state: "AZ", active_leads: 71, avg_offer: 256_000, reply_rate: 0.14, trend: "flat" },
    { market: "Tampa Bay", state: "FL", active_leads: 64, avg_offer: 198_000, reply_rate: 0.16, trend: "down" },
    { market: "Charlotte", state: "NC", active_leads: 53, avg_offer: 165_000, reply_rate: 0.19, trend: "up" },
  ];
}
