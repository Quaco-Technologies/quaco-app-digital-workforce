"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Campaign, EnrichedLead, InboxThread, Lead } from "@/lib/types";
import { fmt$$, PIPELINE_REC_STYLE } from "@/lib/utils";
import {
  Play, Users, MessageSquare, FileSignature,
  TrendingUp, Phone, ArrowRight, Loader2, Activity,
  MapPin, Sparkles,
} from "lucide-react";
import { mockContracts, type MockContract } from "@/lib/mockData";
import { SparkLine } from "@/components/SparkLine";
import { LiveDot } from "@/components/LiveDot";
import { LiveMessageFeed } from "@/components/LiveMessageFeed";
import { AIChat } from "@/components/AIChat";
import { CountUp } from "@/components/CountUp";

// Demo data shown when the investor hasn't run a pipeline yet — so the dashboard
// never looks empty during a sales pitch.
const DEMO_LEADS = [
  { id: "d1", address: "3857 N High St",       city: "Atlanta",   state: "GA", offer_price: 187_500, owner: "Maria H.",   phone: "(404) 555-0142", rec: "pursue" },
  { id: "d2", address: "1204 Maple Ridge Dr",  city: "Dallas",    state: "TX", offer_price: 142_000, owner: "James P.",   phone: "(214) 555-0188", rec: "pursue" },
  { id: "d3", address: "62 Oak Lane",          city: "Atlanta",   state: "GA", offer_price: 95_000,  owner: "Linda G.",   phone: "(404) 555-0107", rec: "needs_review" },
  { id: "d4", address: "991 Bayview Ave",      city: "Tampa",     state: "FL", offer_price: 215_000, owner: "Marcus C.",  phone: "(813) 555-0233", rec: "pursue" },
] as const;

const DEMO_HOT_REPLIES = [
  { lead_id: "d1", owner: "Maria H.",  body: "Maybe. What kind of number are we talking?" },
  { lead_id: "d4", owner: "Marcus C.", body: "I'd need at least $215k. Can you do that?" },
  { lead_id: "d2", owner: "James P.",  body: "Send me the offer in writing." },
] as const;

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [enriched, setEnriched] = useState<EnrichedLead[]>([]);
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [contracts, setContracts] = useState<MockContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.campaigns.list().catch(() => []),
      api.leads.list(undefined, 500).catch(() => []),
      api.leads.listEnriched().catch(() => []),
      api.inbox.list().catch(() => []),
    ])
      .then(([c, l, e, t]) => {
        setCampaigns(c); setLeads(l); setEnriched(e); setThreads(t);
        setContracts(mockContracts());
      })
      .finally(() => setLoading(false));
  }, []);

  const enrichedById = new Map(enriched.map((e) => [e.id, e]));
  const realActionable = leads.filter((l) => {
    const c = enrichedById.get(l.id);
    return (c?.phones ?? []).length > 0 && l.offer_price != null;
  });

  const isDemo = campaigns.length === 0 && leads.length === 0;

  const actionableCount = isDemo ? 287 : realActionable.length;
  const unreadCount = isDemo ? 7 : threads.filter((t) => t.has_unread_reply).length;
  const inNegotiation = isDemo ? 12 : leads.filter((l) => l.status === "negotiating").length;
  const totalAgreed = isDemo
    ? 1_240_000
    : contracts.filter((c) => c.status !== "voided").reduce((s, c) => s + c.agreed_price, 0);
  const signedCount = isDemo ? 3 : contracts.filter((c) => c.status === "completed").length;
  const runningCampaigns = isDemo ? 2 : campaigns.filter((c) => c.status === "running").length;

  const activityTrend = Array.from({ length: 14 }, (_, i) =>
    20 + Math.round(Math.sin(i / 1.7) * 12) + i * 2 + (i === 13 ? 18 : 0)
  );

  const recentLeads = isDemo ? DEMO_LEADS : [...realActionable]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 4);
  const hotThreads = isDemo
    ? DEMO_HOT_REPLIES
    : threads.filter((t) => t.has_unread_reply).slice(0, 3).map((t) => ({
        lead_id: t.lead_id, owner: t.owner_name ?? "Unknown owner", body: t.last_body,
      }));

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="py-20 text-center"><Loader2 size={20} className="text-zinc-300 animate-spin mx-auto" /></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-zinc-900">Command Center</h1>
            {runningCampaigns > 0 && <LiveDot color="red" label="LIVE" />}
            {isDemo && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Demo Data
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">
            {runningCampaigns > 0
              ? `${runningCampaigns} campaign${runningCampaigns === 1 ? "" : "s"} actively scraping right now.`
              : "Your acquisition machine at a glance."}
          </p>
        </div>
        <Link
          href="/pipeline"
          className="flex items-center gap-2 bg-gradient-to-br from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02]"
        >
          <Play size={13} /> New Campaign
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4 mb-6 stagger-children">
        <KPI icon={<Users size={14} />} label="Ready to Contact" value={actionableCount.toString()} accent="text-blue-700" href="/leads" />
        <KPI
          icon={<MessageSquare size={14} />}
          label="Owners Replied"
          value={unreadCount.toString()}
          subtitle={unreadCount > 0 ? "needs your eyes" : "all clear"}
          accent={unreadCount > 0 ? "text-emerald-700" : "text-zinc-700"}
          href="/inbox"
          highlight={unreadCount > 0}
        />
        <KPI icon={<TrendingUp size={14} />} label="In Negotiation" value={inNegotiation.toString()} accent="text-cyan-700" href="/board" />
        <KPI
          icon={<FileSignature size={14} />}
          label="Agreed Value"
          value={fmt$$(totalAgreed)}
          subtitle={`${signedCount} signed`}
          accent="text-emerald-700"
          href="/contracts"
        />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Activity card — left half metric, right half AI insight */}
        <div className="col-span-2 relative overflow-hidden rounded-2xl text-white shadow-xl shadow-blue-500/30 animate-fade-up">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-cyan-600 to-emerald-600 animate-gradient" />
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/50 blur-3xl rounded-full" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-300/50 blur-3xl rounded-full" />
            <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-cyan-200/40 blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="relative p-6 grid grid-cols-2 gap-5">
            {/* Left: hero metric + sparkline */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={14} />
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-90">Last 14 Days</p>
              </div>
              <p className="text-5xl font-bold leading-none mb-1">
                <CountUp value={activityTrend.reduce((s, n) => s + n, 0)} />
              </p>
              <p className="text-sm opacity-90 mb-1">records processed</p>
              <p className="text-xs opacity-75 mb-4">across all active campaigns</p>
              <div className="mt-auto">
                <SparkLine values={activityTrend} width={280} height={56} stroke="white" fill="rgba(255,255,255,0.28)" />
              </div>
            </div>
            {/* Right: AI chat panel */}
            <AIChat />
          </div>
        </div>

        {/* Live message feed */}
        <LiveMessageFeed heading="Live Conversations" />
      </div>

      {/* Hot replies + new leads */}
      <div className="grid grid-cols-2 gap-6">
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
              <MessageSquare size={15} className="text-emerald-500" />
              Hot Replies
            </h3>
            <Link href="/inbox" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              Inbox →
            </Link>
          </div>
          {hotThreads.length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">
              No new replies. Your AI agent is on it.
            </p>
          ) : (
            <div className="space-y-2 stagger-children">
              {hotThreads.map((t) => (
                <Link
                  key={t.lead_id}
                  href={isDemo ? "/inbox" : `/leads/${t.lead_id}`}
                  className="block bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-100 rounded-lg p-3 transition-all hover:translate-x-0.5"
                >
                  <div className="flex items-start gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0 animate-pulse" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-zinc-900 truncate">{t.owner}</p>
                      <p className="text-xs text-zinc-600 line-clamp-2 mt-0.5">{t.body}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
              <Users size={15} className="text-blue-500" />
              New Qualified Leads
            </h3>
            <Link href="/leads" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              All leads →
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">
              No new qualified leads yet — run a pipeline to find some.
            </p>
          ) : (
            <div className="space-y-2 stagger-children">
              {recentLeads.map((lead) => {
                const isDemoLead = "rec" in lead;
                const rec = isDemoLead
                  ? PIPELINE_REC_STYLE[(lead as { rec: "pursue" | "needs_review" }).rec]
                  : (lead as Lead).pipeline_recommendation
                    ? PIPELINE_REC_STYLE[(lead as Lead).pipeline_recommendation!]
                    : null;
                const phone = isDemoLead ? (lead as { phone: string }).phone : enrichedById.get((lead as Lead).id)?.phones?.[0];
                return (
                  <Link
                    key={lead.id}
                    href={isDemoLead ? "/leads" : `/leads/${(lead as Lead).id}`}
                    className="block hover:bg-zinc-50/70 rounded-lg p-2.5 transition-all hover:translate-x-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-zinc-900 truncate">{lead.address}</p>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                          <MapPin size={9} />
                          <span>{lead.city}, {lead.state}</span>
                          {phone && (
                            <>
                              <span className="text-zinc-300">·</span>
                              <Phone size={9} />
                              <span className="text-blue-600 font-medium">{phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {(lead as { offer_price?: number }).offer_price && (
                          <p className="text-sm font-bold text-emerald-700">{fmt$$((lead as { offer_price: number }).offer_price)}</p>
                        )}
                        {rec && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${rec.className}`}>
                            {rec.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {isDemo && (
        <div className="mt-6 bg-gradient-to-br from-blue-50/80 to-emerald-50/80 backdrop-blur-sm border border-blue-200/60 rounded-2xl p-5 flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900">This is a preview with sample data</p>
              <p className="text-xs text-zinc-600 mt-0.5">Run your first campaign to see real leads from your county.</p>
            </div>
          </div>
          <Link
            href="/pipeline"
            className="bg-gradient-to-br from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg hover:scale-[1.02] flex items-center gap-2"
          >
            <Play size={13} /> Run Real Campaign
          </Link>
        </div>
      )}
    </div>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-5 shadow-sm animate-fade-up">
      {children}
    </div>
  );
}

function KPI({
  icon, label, value, subtitle, accent, href, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  accent: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative bg-white/70 backdrop-blur-md border rounded-xl p-5 transition-all hover:-translate-y-0.5 ${
        highlight
          ? "border-emerald-300/80 ring-1 ring-emerald-200/60 hover:ring-2 hover:shadow-xl hover:shadow-emerald-500/15"
          : "border-white/60 hover:border-blue-300/80 hover:shadow-xl hover:shadow-blue-500/15"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={highlight ? "text-emerald-500" : "text-blue-500"}>{icon}</span>
        <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      {subtitle && <p className="text-[11px] text-zinc-400 mt-1">{subtitle}</p>}
      <ArrowRight size={14} className="absolute top-5 right-5 text-zinc-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}
