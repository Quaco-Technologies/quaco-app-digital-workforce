"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Campaign } from "@/lib/types";
import { fmt$$, fmtDate } from "@/lib/utils";
import Link from "next/link";
import { MapPin, Users, CheckCircle, Loader2, Play } from "lucide-react";

function fmtPrice(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}k`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  return `${fmt(min!)}+`;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.campaigns.list()
      .then(setCampaigns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Campaigns</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Each pipeline run is a campaign — click one to see its leads
          </p>
        </div>
        <Link
          href="/pipeline"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Play size={13} />
          New Campaign
        </Link>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 size={20} className="text-zinc-300 animate-spin mx-auto" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-zinc-400">No campaigns yet.</p>
          <Link href="/pipeline" className="text-sm text-indigo-600 hover:text-indigo-700 mt-1 inline-block">
            Run your first pipeline →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="block bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h2 className="font-semibold text-zinc-900 text-base truncate">{c.name}</h2>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                      c.status === "running"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {c.status === "running" ? (
                        <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Running</span>
                      ) : "Complete"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3">
                    {c.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {c.city}, {c.state}
                      </span>
                    )}
                    {fmtPrice(c.min_price, c.max_price) && (
                      <span>{fmtPrice(c.min_price, c.max_price)}</span>
                    )}
                    <span>{fmtDate(c.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="text-center">
                      <p className="text-lg font-bold text-zinc-900">{c.scraped_count.toLocaleString()}</p>
                      <p className="text-xs text-zinc-400">Scraped</p>
                    </div>
                    <div className="text-zinc-200 text-lg">→</div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-zinc-900">{c.qualified_count.toLocaleString()}</p>
                      <p className="text-xs text-zinc-400">With Phone</p>
                    </div>
                    <div className="text-zinc-200 text-lg">→</div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${c.saved_count > 0 ? "text-indigo-600" : "text-zinc-900"}`}>
                        {c.saved_count.toLocaleString()}
                      </p>
                      <p className="text-xs text-zinc-400">Ready to Contact</p>
                    </div>
                  </div>
                </div>

                <div className="ml-4 flex-shrink-0">
                  {c.status === "complete" && c.saved_count > 0 ? (
                    <CheckCircle size={20} className="text-indigo-400" />
                  ) : c.status === "running" ? (
                    <Loader2 size={20} className="text-blue-400 animate-spin" />
                  ) : (
                    <Users size={20} className="text-zinc-300" />
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
