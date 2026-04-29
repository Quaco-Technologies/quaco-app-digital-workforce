"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Users, Calculator, Search, Send } from "lucide-react";

const STAGES: Array<{ key: string; label: string; sub: string; icon: React.ComponentType<{ size?: number; className?: string }>; durationMs: number }> = [
  { key: "scrape",   label: "Scraping county records",   sub: "Pulled 4,812 properties from Fulton County",  icon: MapPin,    durationMs: 2200 },
  { key: "skip",     label: "Skip tracing owners",       sub: "Found phone numbers for 1,445 owners",        icon: Users,     durationMs: 2400 },
  { key: "analyze",  label: "Calculating offers",        sub: "Computed ARV + 70% offer for 287 leads",      icon: Calculator,durationMs: 2200 },
  { key: "score",    label: "Scoring deals",             sub: "Ranked by spread, condition, motivation",     icon: Search,    durationMs: 1800 },
  { key: "outreach", label: "Sending opening text",      sub: "AI agent texting top seller now…",            icon: Send,      durationMs: 1800 },
];

interface Props {
  onComplete: () => void;
  onProgress?: (stageKey: string) => void;
}

export function PipelineStages({ onComplete, onProgress }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());

  // Capture latest callbacks in refs so we don't restart the loop when the
  // parent re-renders with fresh function refs.
  const completeRef = useRef(onComplete);
  const progressRef = useRef(onProgress);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => { progressRef.current = onProgress; }, [onProgress]);

  useEffect(() => {
    let cancelled = false;
    const advance = async () => {
      for (let i = 0; i < STAGES.length; i++) {
        if (cancelled) return;
        setCurrentIdx(i);
        progressRef.current?.(STAGES[i].key);
        await new Promise((r) => setTimeout(r, STAGES[i].durationMs));
        if (cancelled) return;
        setDone((d) => { const next = new Set(d); next.add(STAGES[i].key); return next; });
      }
      if (!cancelled) {
        setTimeout(() => { if (!cancelled) completeRef.current(); }, 500);
      }
    };
    advance();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-2.5">
      {STAGES.map((s, i) => {
        const isDone = done.has(s.key);
        const isRunning = !isDone && i === currentIdx;
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex items-center gap-3 animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
            <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500 ${
              isDone
                ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-500/40 scale-100"
                : isRunning
                  ? "bg-gradient-to-br from-blue-400 to-cyan-500 text-white shadow-md shadow-blue-500/40 scale-105"
                  : "bg-white/40 text-zinc-400 ring-1 ring-white/30"
            }`}>
              {isDone
                ? <CheckCircle2 size={16} />
                : isRunning
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Icon size={15} />}
              {isRunning && (
                <span className="absolute inset-0 rounded-xl bg-blue-400/40 blur-md animate-pulse pointer-events-none" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold transition-colors ${
                  isDone ? "text-white" : isRunning ? "text-white" : "text-white/60"
                }`}>
                  {s.label}
                </p>
                {isRunning && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 text-white px-1.5 py-0.5 rounded animate-pulse">
                    Running
                  </span>
                )}
                {isDone && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-400/30 text-white px-1.5 py-0.5 rounded">
                    ✓
                  </span>
                )}
              </div>
              <p className={`text-[11px] mt-0.5 transition-opacity ${isDone || isRunning ? "text-white/80" : "text-white/40"}`}>
                {s.sub}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
