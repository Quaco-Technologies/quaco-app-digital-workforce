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
import { AIInsight } from "@/components/AIInsight";

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
  const actionable = leads.filter((l) => {
    const c = enrichedById.get(l.id);
    return (c?.phones ?? []).length > 0 && l.offer_price != null;
  });

  const unread = threads.filter((t) => t.has_unread_reply).length;
  const inNegotiation = leads.filter((l) => l.status === "negotiating").length;
  const totalAgreed = contracts
    .filter((c) => c.status !== "voided")
    .reduce((s, c) => s + c.agreed_price, 0);
  const runningCampaigns = campaigns.filter((c) => c.status === "running").length;

  const activityTrend = Array.from({ length: 14 }, (_, i) =>
    20 + Math.round(Math.sin(i / 1.7) * 12) + i * 2 + (i === 13 ? 18 : 0)
  );

  const recentLeads = [...actionable]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 4);

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="py-20 text-center"><Loader2 size={20} className="text-zinc-300 animate-spin mx-auto" /></div>
      </div>
    );
  }

  if (campaigns.length === 0 && leads.length === 0) {
    return <FirstRunHero />;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-zinc-900">Command Center</h1>
            {runningCampaigns > 0 && <LiveDot color="red" label="LIVE" />}
          </div>
          <p className="text-sm text-zinc-500">
            {runningCampaigns > 0
              ? `${runningCampaigns} campaign${runningCampaigns === 1 ? "" : "s"} actively scraping right now.`
              : "Your acquisition machine at a glance."}
          </p>
        </div>
        <Link
          href="/pipeline"
          className="flex items-center gap-2 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02]"
        >
          <Play size={13} /> New Campaign
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4 mb-6 stagger-children">
        <KPI
          icon={<Users size={14} />}
          label="Ready to Contact"
          value={actionable.length.toString()}
          accent="text-blue-700"
          href="/leads"
        />
        <KPI
          icon={<MessageSquare size={14} />}
          label="Owners Replied"
          value={unread.toString()}
          subtitle={unread > 0 ? "needs your eyes" : "all clear"}
          accent={unread > 0 ? "text-emerald-700" : "text-zinc-700"}
          href="/inbox"
          highlight={unread > 0}
        />
        <KPI
          icon={<TrendingUp size={14} />}
          label="In Negotiation"
          value={inNegotiation.toString()}
          accent="text-blue-700"
          href="/board"
        />
        <KPI
          icon={<FileSignature size={14} />}
          label="Agreed Value"
          value={fmt$$(totalAgreed)}
          subtitle={`${contracts.filter((c) => c.status === "completed").length} signed`}
          accent="text-emerald-700"
          href="/contracts"
        />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Activity card with AI insight */}
        <div className="col-span-2 relative overflow-hidden rounded-2xl text-white shadow-xl shadow-blue-500/20 animate-fade-up">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-emerald-600 animate-gradient" />
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/30 blur-3xl rounded-full" />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-emerald-300/30 blur-3xl rounded-full" />
          </div>
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={14} />
                  <p className="text-xs font-medium uppercase tracking-wide opacity-80">Last 14 Days</p>
                </div>
                <p className="text-3xl font-bold">
                  {activityTrend.reduce((s, n) => s + n, 0).toLocaleString()} records
                </p>
                <p className="text-sm opacity-80 mt-0.5">processed across all campaigns</p>
              </div>
              <Sparkles size={20} className="opacity-60" />
            </div>

            <div className="my-4">
              <SparkLine
                values={activityTrend}
                width={520}
                height={64}
                stroke="white"
                fill="rgba(255,255,255,0.18)"
              />
            </div>

            <AIInsight />
          </div>
        </div>

        {/* Live message feed */}
        <LiveMessageFeed heading="Live Conversations" />
      </div>

      {/* Hot replies + new leads */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
              <MessageSquare size={15} className="text-emerald-500" />
              Hot Replies
            </h3>
            <Link href="/inbox" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              Inbox →
            </Link>
          </div>
          {threads.filter((t) => t.has_unread_reply).length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">
              No new replies. Your AI agent is on it.
            </p>
          ) : (
            <div className="space-y-2 stagger-children">
              {threads.filter((t) => t.has_unread_reply).slice(0, 4).map((t) => (
                <Link
                  key={t.lead_id}
                  href={`/leads/${t.lead_id}`}
                  className="block bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 rounded-lg p-3 transition-all hover:translate-x-0.5"
                >
                  <div className="flex items-start gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0 animate-pulse" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-zinc-900 truncate">
                        {t.owner_name ?? "Unknown owner"}
                      </p>
                      <p className="text-xs text-zinc-600 line-clamp-2 mt-0.5">{t.last_body}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 animate-fade-up">
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
                const c = enrichedById.get(lead.id);
                const rec = lead.pipeline_recommendation
                  ? PIPELINE_REC_STYLE[lead.pipeline_recommendation]
                  : null;
                return (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="block hover:bg-zinc-50 rounded-lg p-2.5 transition-all hover:translate-x-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-zinc-900 truncate">{lead.address}</p>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                          <MapPin size={9} />
                          <span>{lead.city}, {lead.state}</span>
                          {c && c.phones.length > 0 && (
                            <>
                              <span className="text-zinc-300">·</span>
                              <Phone size={9} />
                              <span className="text-blue-600 font-medium">{c.phones[0]}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {lead.offer_price && (
                          <p className="text-sm font-bold text-emerald-700">{fmt$$(lead.offer_price)}</p>
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
        </div>
      </div>
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
      className={`group relative bg-white border rounded-xl p-5 transition-all hover:-translate-y-0.5 ${
        highlight
          ? "border-emerald-300 ring-1 ring-emerald-200 hover:ring-2 hover:shadow-lg hover:shadow-emerald-500/10"
          : "border-zinc-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={highlight ? "text-emerald-500" : "text-blue-500"}>{icon}</span>
        <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      {subtitle && <p className="text-[11px] text-zinc-400 mt-1">{subtitle}</p>}
      <ArrowRight
        size={14}
        className="absolute top-5 right-5 text-zinc-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all"
      />
    </Link>
  );
}

function FirstRunHero() {
  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl text-white mb-6 shadow-xl shadow-blue-500/30">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-emerald-600 animate-gradient" />
        <div className="relative p-10">
          <Sparkles size={28} className="mb-4 opacity-90" />
          <h1 className="text-3xl font-bold mb-2">Welcome to Acquire</h1>
          <p className="text-blue-50 max-w-md mb-6">
            Tell us your buy box and we&apos;ll find off-market deals automatically — county records,
            skip-traced phone numbers, ARV-based offers, and AI-driven SMS negotiation.
          </p>
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-2 bg-white hover:bg-blue-50 text-blue-700 text-sm font-semibold px-5 py-3 rounded-xl transition-all hover:scale-[1.02]"
          >
            <Play size={14} /> Run your first campaign
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 stagger-children">
        <HowStep num={1} title="Define your buy box" body="City, county, price range, beds, property types. Takes 30 seconds." />
        <HowStep num={2} title="Let the agent run" body="Scrape records → skip trace → calculate offers → start outreach." />
        <HowStep num={3} title="Reply or close deals" body="Owners reply by SMS. AI negotiates. You sign contracts." />
      </div>
    </div>
  );
}

function HowStep({ num, title, body }: { num: number; title: string; body: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
      <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-emerald-500 text-white font-bold rounded-full flex items-center justify-center text-sm mb-3">
        {num}
      </div>
      <p className="font-semibold text-zinc-900 mb-1">{title}</p>
      <p className="text-xs text-zinc-500 leading-relaxed">{body}</p>
    </div>
  );
}
