"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Sparkles, RefreshCw } from "lucide-react";

interface Insight {
  headline: string;
  body: string;
  confidence: string;
}

export function AIInsight() {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.insights.activity()
      .then(setInsight)
      .catch(() => setInsight({
        headline: "Insight unavailable",
        body: "Couldn't reach the AI insight service. Try refreshing.",
        confidence: "low",
      }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-90">
          <Sparkles size={12} />
          <span>AI Insight</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-white/70 hover:text-white transition-colors disabled:opacity-40"
          title="Regenerate"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading && !insight ? (
        <div className="space-y-2">
          <div className="h-3 bg-white/20 rounded w-2/3 animate-pulse" />
          <div className="h-3 bg-white/20 rounded w-full animate-pulse" />
          <div className="h-3 bg-white/20 rounded w-4/5 animate-pulse" />
        </div>
      ) : insight ? (
        <div className="animate-fade-in">
          <p className="text-sm font-semibold mb-1">{insight.headline}</p>
          <p className="text-xs opacity-90 leading-relaxed">{insight.body}</p>
        </div>
      ) : null}
    </div>
  );
}
