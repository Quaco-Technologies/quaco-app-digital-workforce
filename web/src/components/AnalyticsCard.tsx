"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Campaign, Lead } from "@/lib/types";
import { fmt$$ } from "@/lib/utils";
import { buildFunnel, mockWeeklyMetrics, type FunnelStage } from "@/lib/mockData";
import { Activity, Target, Zap, DollarSign, ArrowRight } from "lucide-react";

function pct(n: number | null) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

const DEMO_BASELINE_STATS = {
  total_scraped: 4_812,
  by_status: {
    skip_traced: 882, enriched: 612, analyzed: 423,
    outreach: 287, negotiating: 64, under_contract: 12, closed: 5,
  } as Record<string, number>,
};

// Live deltas from the dashboard's event bus — additive on top of baseline
// so the funnel + KPIs visibly shift while the user watches.
export interface LiveDeltas {
  contacted: number;
  negotiating: number;
  accepted: number;
  contract: number;
}

interface Props {
  liveDeltas?: LiveDeltas;
  running?: boolean;
}

export function AnalyticsCard({ liveDeltas, running = false }: Props) {
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [scraped, setScraped] = useState(0);
  const [closedCount, setClosedCount] = useState(0);
  const [replyRate, setReplyRate] = useState(0);
  const [closeRate, setCloseRate] = useState(0);

  // Slow drift on "Records" so the number is always moving (1-3 per second)
  const [scrapedDrift, setScrapedDrift] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setScrapedDrift((d) => d + (running ? 4 + Math.floor(Math.random() * 8) : 1 + Math.floor(Math.random() * 3)));
    }, running ? 600 : 1500);
    return () => clearInterval(id);
  }, [running]);

  // Tiny ±0.05% jitter on rates each second so they feel alive
  const [rateJitter, setRateJitter] = useState({ reply: 0, close: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      setRateJitter({
        reply: (Math.random() - 0.5) * 0.001,
        close: (Math.random() - 0.5) * 0.0015,
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Promise.all([api.campaigns.list().catch(() => []), api.leads.list(undefined, 500).catch(() => [])])
      .then(([campaigns, leads]: [Campaign[], Lead[]]) => {
        const totalScraped = campaigns.reduce((s, c) => s + c.scraped_count, 0);
        const byStatus = leads.reduce<Record<string, number>>((acc, l) => {
          acc[l.status] = (acc[l.status] ?? 0) + 1;
          return acc;
        }, {});
        const stats = (totalScraped === 0)
          ? DEMO_BASELINE_STATS
          : { total_scraped: totalScraped, by_status: byStatus };

        setFunnel(buildFunnel(stats));
        setScraped(stats.total_scraped);
        setClosedCount(stats.by_status.closed ?? 0);

        const weekly = mockWeeklyMetrics(8);
        const totalContacted = weekly.reduce((s, w) => s + w.contacted, 0);
        const totalReplied = weekly.reduce((s, w) => s + w.replied, 0);
        const totalContracted = weekly.reduce((s, w) => s + w.contracted, 0);
        setReplyRate(totalContacted ? totalReplied / totalContacted : 0);
        setCloseRate(totalReplied ? totalContracted / totalReplied : 0);
      });
  }, []);

  // Apply live deltas to the funnel stages on each render
  const liveContacted   = liveDeltas?.contacted   ?? 0;
  const liveNegotiating = liveDeltas?.negotiating ?? 0;
  const liveAccepted    = liveDeltas?.accepted    ?? 0;
  const liveContract    = liveDeltas?.contract    ?? 0;

  const adjustedFunnel = funnel.map((stage) => {
    let delta = 0;
    // Cumulative additions: outreach upstream stages also include downstream
    if (stage.key === "scraped")        delta = scrapedDrift;
    else if (stage.key === "skip_traced") delta = Math.floor(scrapedDrift * 0.30) + liveContacted + liveNegotiating + liveAccepted + liveContract;
    else if (stage.key === "analyzed")    delta = Math.floor(scrapedDrift * 0.10) + liveContacted + liveNegotiating + liveAccepted + liveContract;
    else if (stage.key === "outreach")    delta = liveContacted + liveNegotiating + liveAccepted + liveContract;
    else if (stage.key === "negotiating") delta = liveNegotiating + liveAccepted + liveContract;
    else if (stage.key === "under_contract") delta = liveAccepted + liveContract;
    else if (stage.key === "closed")      delta = liveContract;
    return { ...stage, count: stage.count + delta };
  });

  // Recompute conversions on the bumped numbers so they shift live too
  const recomputed: FunnelStage[] = adjustedFunnel.map((stage, i) => {
    if (i === 0) return { ...stage, conversion: null };
    const prev = adjustedFunnel[i - 1].count;
    return { ...stage, conversion: prev > 0 ? stage.count / prev : null };
  });

  const maxFunnel = recomputed[0]?.count ?? 1;
  const liveScraped = scraped + scrapedDrift;
  const liveClosed = closedCount + liveContract;
  const costPerDeal = liveClosed > 0 ? Math.round((liveScraped * 0.12) / Math.max(liveClosed, 1)) : 487;

  // Apply jitter to rates
  const liveReplyRate = Math.max(0, Math.min(1, replyRate + rateJitter.reply));
  const liveCloseRate = Math.max(0, Math.min(1, closeRate + rateJitter.close));

  return (
    <div className="bg-white border border-slate-200/70 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight">Analytics</h3>
          <p className="text-xs text-slate-500 mt-0.5">Funnel performance · last 8 weeks</p>
        </div>
        <Link href="/analytics" className="text-[11px] font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors">
          Full report <ArrowRight size={11} />
        </Link>
      </div>

      {/* Inline KPIs */}
      <div className="flex items-center gap-5 mb-4 flex-wrap text-[12px]">
        <Stat icon={<Activity size={11} />} label="Records" value={liveScraped.toLocaleString()} color="#64748b" />
        <Stat icon={<Target size={11} />} label="Reply" value={pct(liveReplyRate)} color="#3b82f6" />
        <Stat icon={<Zap size={11} />} label="Close" value={pct(liveCloseRate)} color="#f59e0b" />
        <Stat icon={<DollarSign size={11} />} label="Cost/deal" value={fmt$$(costPerDeal)} color="#10b981" />
      </div>

      {/* Mini funnel — bars shift live */}
      <div className="space-y-1.5">
        {recomputed.map((stage) => {
          const widthPct = maxFunnel > 0 ? (stage.count / maxFunnel) * 100 : 0;
          return (
            <div key={stage.key}>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-slate-600">{stage.label}</span>
                <div className="flex items-center gap-2">
                  {stage.conversion != null && (
                    <span className={`font-medium ${stage.conversion >= 0.2 ? "text-emerald-600" : stage.conversion >= 0.05 ? "text-amber-600" : "text-slate-400"}`}>
                      {pct(stage.conversion)}
                    </span>
                  )}
                  <span className="font-semibold text-slate-900 tabular-nums w-14 text-right">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="bg-slate-100 rounded h-1.5 relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-slate-900 rounded transition-all duration-700"
                  style={{ width: `${Math.max(widthPct, 0.5)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color }}>{icon}</span>
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}
