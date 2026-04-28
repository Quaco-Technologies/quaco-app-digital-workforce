"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Campaign, EnrichedLead, InboxThread, Lead } from "@/lib/types";
import { fmt$$, fmtDate, STATUS_LABEL, PIPELINE_REC_STYLE } from "@/lib/utils";
import {
  Play, Folder, Users, MessageSquare, FileSignature,
  TrendingUp, Phone, ArrowRight, Loader2, Activity,
  Clock, MapPin, Sparkles,
} from "lucide-react";
import { mockContracts, type MockContract } from "@/lib/mockData";
import { SparkLine } from "@/components/SparkLine";

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
  const underContract = leads.filter((l) => l.status === "under_contract").length;
  const totalAgreed = contracts
    .filter((c) => c.status !== "voided")
    .reduce((s, c) => s + c.agreed_price, 0);
  const runningCampaigns = campaigns.filter((c) => c.status === "running").length;

  // Synthetic 14-day activity sparkline (records scraped per day)
  const activityTrend = Array.from({ length: 14 }, (_, i) =>
    20 + Math.round(Math.sin(i / 1.7) * 12) + i * 2 + (i === 13 ? 18 : 0)
  );

  const recentLeads = [...actionable]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 5);
  const hotThreads = threads.filter((t) => t.has_unread_reply).slice(0, 4);

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="py-20 text-center"><Loader2 size={20} className="text-zinc-300 animate-spin mx-auto" /></div>
      </div>
    );
  }

  const isFirstRun = campaigns.length === 0 && leads.length === 0;

  if (isFirstRun) {
    return <FirstRunHero />;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Command Center</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {runningCampaigns > 0
              ? `${runningCampaigns} campaign${runningCampaigns === 1 ? "" : "s"} running.`
              : "Your acquisition machine at a glance."}
          </p>
        </div>
        <Link
          href="/pipeline"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Play size={13} /> New Campaign
        </Link>
      </div>

      {/* Hero KPI strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPI
          icon={<Users size={14} className="text-indigo-500" />}
          label="Ready to Contact"
          value={actionable.length.toString()}
          accent="text-indigo-700"
          href="/leads"
        />
        <KPI
          icon={<MessageSquare size={14} className="text-purple-500" />}
          label="Owners Replied"
          value={unread.toString()}
          subtitle={unread > 0 ? "needs your eyes" : "all clear"}
          accent={unread > 0 ? "text-purple-700" : "text-zinc-700"}
          href="/inbox"
          highlight={unread > 0}
        />
        <KPI
          icon={<TrendingUp size={14} className="text-amber-500" />}
          label="In Negotiation"
          value={inNegotiation.toString()}
          accent="text-amber-700"
          href="/board"
        />
        <KPI
          icon={<FileSignature size={14} className="text-green-600" />}
          label="Agreed Value"
          value={fmt$$(totalAgreed)}
          subtitle={`${underContract + contracts.filter((c) => c.status === "completed").length} deals`}
          accent="text-emerald-700"
          href="/contracts"
        />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Activity card */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white col-span-2">
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
          <div className="mt-4">
            <SparkLine
              values={activityTrend}
              width={520}
              height={70}
              stroke="white"
              fill="rgba(255,255,255,0.2)"
            />
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h3 className="font-semibold text-zinc-900 mb-3">Jump to</h3>
          <div className="space-y-1.5">
            <QuickLink href="/board" icon={<TrendingUp size={13} />} label="Pipeline Board" hint="Kanban by stage" />
            <QuickLink href="/inbox" icon={<MessageSquare size={13} />} label="Inbox" hint={unread > 0 ? `${unread} new` : "All threads"} />
            <QuickLink href="/analytics" icon={<Activity size={13} />} label="Analytics" hint="Funnel + reply rate" />
            <QuickLink href="/contracts" icon={<FileSignature size={13} />} label="Contracts" hint="Out for signature" />
            <QuickLink href="/sequences" icon={<Clock size={13} />} label="Sequences" hint="Auto follow-ups" />
          </div>
        </div>
      </div>

      {/* Hot threads + recent leads */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
              <MessageSquare size={15} className="text-purple-500" />
              Hot Replies
            </h3>
            <Link href="/inbox" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              Inbox →
            </Link>
          </div>
          {hotThreads.length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">
              No new replies. Your AI agent is on it.
            </p>
          ) : (
            <div className="space-y-2">
              {hotThreads.map((t) => (
                <Link
                  key={t.lead_id}
                  href={`/leads/${t.lead_id}`}
                  className="block bg-purple-50/40 hover:bg-purple-50 border border-purple-100 rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
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

        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
              <Users size={15} className="text-indigo-500" />
              New Qualified Leads
            </h3>
            <Link href="/leads" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              All leads →
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">
              No new qualified leads yet — run a pipeline to find some.
            </p>
          ) : (
            <div className="space-y-2">
              {recentLeads.map((lead) => {
                const c = enrichedById.get(lead.id);
                const rec = lead.pipeline_recommendation
                  ? PIPELINE_REC_STYLE[lead.pipeline_recommendation]
                  : null;
                return (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="block hover:bg-zinc-50 rounded-lg p-2.5 transition-colors"
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
                              <span className="text-indigo-600 font-medium">{c.phones[0]}</span>
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

      {/* Recent campaigns */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
            <Folder size={15} className="text-zinc-500" />
            Recent Campaigns
          </h3>
          <Link href="/campaigns" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            All campaigns →
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4 text-center">No campaigns yet.</p>
        ) : (
          <div className="space-y-1">
            {campaigns.slice(0, 4).map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="flex items-center justify-between hover:bg-zinc-50 rounded-lg px-3 py-2.5 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                    <MapPin size={12} className="text-indigo-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{c.name}</p>
                    <p className="text-[11px] text-zinc-400">{fmtDate(c.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 shrink-0 ml-3">
                  <span className="text-xs text-zinc-500">
                    {c.scraped_count.toLocaleString()} scraped
                  </span>
                  <span className="text-sm font-semibold text-indigo-600">
                    {c.saved_count} leads
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    c.status === "running" ? "bg-blue-50 text-blue-600" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {c.status === "running" ? "Running" : "Done"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
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
      className={`group bg-white border rounded-xl p-5 transition-all ${
        highlight
          ? "border-purple-300 ring-1 ring-purple-200 hover:ring-2"
          : "border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      {subtitle && <p className="text-[11px] text-zinc-400 mt-1">{subtitle}</p>}
    </Link>
  );
}

function QuickLink({
  href, icon, label, hint,
}: { href: string; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between hover:bg-zinc-50 rounded-lg px-2.5 py-2 transition-colors group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-zinc-400 group-hover:text-indigo-500 transition-colors">{icon}</div>
        <p className="text-sm font-medium text-zinc-800">{label}</p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        <span>{hint}</span>
        <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

function FirstRunHero() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-10 text-white mb-6">
        <Sparkles size={28} className="mb-4 opacity-80" />
        <h1 className="text-3xl font-bold mb-2">Welcome to Quaco</h1>
        <p className="text-indigo-100 max-w-md mb-6">
          Tell us your buy box and we&apos;ll find off-market deals automatically — county records,
          skip-traced phone numbers, ARV-based offers, and AI-driven SMS negotiation.
        </p>
        <Link
          href="/pipeline"
          className="inline-flex items-center gap-2 bg-white hover:bg-indigo-50 text-indigo-700 text-sm font-semibold px-5 py-3 rounded-xl transition-colors"
        >
          <Play size={14} /> Run your first campaign
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <HowStep
          num={1}
          title="Define your buy box"
          body="City, county, price range, beds, property types. Takes 30 seconds."
        />
        <HowStep
          num={2}
          title="Let the agent run"
          body="Scrape records → skip trace → calculate offers → start outreach."
        />
        <HowStep
          num={3}
          title="Reply or close deals"
          body="Owners reply by SMS. AI negotiates. You sign contracts."
        />
      </div>
    </div>
  );
}

function HowStep({ num, title, body }: { num: number; title: string; body: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <div className="w-7 h-7 bg-indigo-100 text-indigo-700 font-bold rounded-full flex items-center justify-center text-sm mb-3">
        {num}
      </div>
      <p className="font-semibold text-zinc-900 mb-1">{title}</p>
      <p className="text-xs text-zinc-500 leading-relaxed">{body}</p>
    </div>
  );
}
