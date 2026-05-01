"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Campaign, Lead } from "@/lib/types";
import { fmt$$ } from "@/lib/utils";
import { buildFunnel, mockWeeklyMetrics, type FunnelStage } from "@/lib/mockData";
import { SparkLine } from "@/components/SparkLine";
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

export function AnalyticsCard() {
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [scraped, setScraped] = useState(0);
  const [closedCount, setClosedCount] = useState(0);
  const [trend6w, setTrend6w] = useState<number[]>([]);
  const [replyTrend, setReplyTrend] = useState<number[]>([]);
  const [closeTrend, setCloseTrend] = useState<number[]>([]);
  const [replyRate, setReplyRate] = useState(0);
  const [closeRate, setCloseRate] = useState(0);

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
        setTrend6w(weekly.slice(-6).map((w) => w.scraped));
        setReplyTrend(weekly.slice(-6).map((w) => (w.contacted ? w.replied / w.contacted : 0) * 100));
        setCloseTrend(weekly.slice(-6).map((w) => (w.replied ? w.contracted / w.replied : 0) * 100));
      });
  }, []);

  const maxFunnel = funnel[0]?.count ?? 1;
  const costPerDeal = closedCount > 0 ? Math.round((scraped * 0.12) / Math.max(closedCount, 1)) : 487;

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

      {/* 4 mini KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MiniKPI icon={<Activity size={11} />} label="Records" value={scraped.toLocaleString()} trend={trend6w} color="#64748b" />
        <MiniKPI icon={<Target size={11} />} label="Reply rate" value={pct(replyRate)} trend={replyTrend} color="#3b82f6" />
        <MiniKPI icon={<Zap size={11} />} label="Close rate" value={pct(closeRate)} trend={closeTrend} color="#f59e0b" />
        <MiniKPI icon={<DollarSign size={11} />} label="Cost/deal" value={fmt$$(costPerDeal)} color="#10b981" />
      </div>

      {/* Mini funnel */}
      <div className="space-y-1.5">
        {funnel.map((stage) => {
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
                  className="absolute left-0 top-0 h-full bg-slate-900 rounded transition-all"
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

function MiniKPI({
  icon, label, value, trend, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: number[];
  color: string;
}) {
  return (
    <div className="bg-slate-50/60 border border-slate-100 rounded-lg px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-0.5">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <p className="text-base font-bold text-slate-900 tabular-nums">{value}</p>
      {trend && trend.length > 1 && (
        <div className="mt-0.5"><SparkLine values={trend} width={80} height={16} stroke={color} fill={`${color}22`} /></div>
      )}
    </div>
  );
}
