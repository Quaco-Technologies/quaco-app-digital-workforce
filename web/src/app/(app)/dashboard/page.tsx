"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Campaign } from "@/lib/types";
import { fmt$$, fmtDate } from "@/lib/utils";
import Link from "next/link";
import { Folder, Play, Users, TrendingUp, MapPin, Loader2, RefreshCw } from "lucide-react";

function fmtPrice(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}k`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  return `${fmt(min!)}+`;
}

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.campaigns.list()
      .then(setCampaigns)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const totalLeads = campaigns.reduce((s, c) => s + c.saved_count, 0);
  const totalScraped = campaigns.reduce((s, c) => s + c.scraped_count, 0);
  const running = campaigns.filter((c) => c.status === "running").length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Your acquisition campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <Link
            href="/pipeline"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Play size={13} />
            New Campaign
          </Link>
        </div>
      </div>

      {!loading && campaigns.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center max-w-md mx-auto">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Play size={20} className="text-indigo-600" />
          </div>
          <h2 className="font-semibold text-zinc-900 text-lg mb-2">Run your first campaign</h2>
          <p className="text-sm text-zinc-500 mb-6">
            Pick a county, set your buy box, and the system will scrape owner records,
            skip trace phone numbers, and calculate offers — automatically.
          </p>
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <Play size={14} /> Start a Campaign
          </Link>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Folder size={14} className="text-indigo-400" />
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Campaigns</p>
              </div>
              <p className="text-3xl font-bold text-zinc-900">{campaigns.length}</p>
              {running > 0 && <p className="text-xs text-blue-500 mt-1">{running} running</p>}
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-indigo-400" />
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Ready to Contact</p>
              </div>
              <p className="text-3xl font-bold text-indigo-600">{totalLeads.toLocaleString()}</p>
              <p className="text-xs text-zinc-400 mt-1">with phone + offer</p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-indigo-400" />
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Records Scraped</p>
              </div>
              <p className="text-3xl font-bold text-zinc-900">{totalScraped.toLocaleString()}</p>
              <p className="text-xs text-zinc-400 mt-1">across all campaigns</p>
            </div>
          </div>

          {/* Recent campaigns */}
          <h2 className="font-semibold text-zinc-900 mb-3">Recent Campaigns</h2>
          {loading ? (
            <div className="py-12 text-center"><Loader2 size={20} className="text-zinc-300 animate-spin mx-auto" /></div>
          ) : (
            <div className="space-y-3">
              {campaigns.slice(0, 6).map((c) => (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.id}`}
                  className="flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:border-zinc-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin size={14} className="text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 truncate">{c.name}</p>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                        {fmtPrice(c.min_price, c.max_price) && <span>{fmtPrice(c.min_price, c.max_price)}</span>}
                        <span>{fmtDate(c.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-indigo-600">{c.saved_count}</p>
                      <p className="text-[10px] text-zinc-400">leads</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-700">{c.scraped_count.toLocaleString()}</p>
                      <p className="text-[10px] text-zinc-400">scraped</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      c.status === "running" ? "bg-blue-50 text-blue-600" : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {c.status === "running" ? "Running" : "Done"}
                    </span>
                  </div>
                </Link>
              ))}
              {campaigns.length > 6 && (
                <Link href="/campaigns" className="block text-center text-sm text-indigo-600 hover:text-indigo-700 py-2">
                  View all {campaigns.length} campaigns →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
