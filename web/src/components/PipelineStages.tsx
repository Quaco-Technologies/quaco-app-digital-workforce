"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const STAGES: Array<{ key: string; label: string; durationMs: number }> = [
  { key: "scrape",   label: "Scraping county records",  durationMs: 2200 },
  { key: "skip",     label: "Skip tracing owners",      durationMs: 2400 },
  { key: "analyze",  label: "Calculating offers",       durationMs: 2200 },
  { key: "score",    label: "Scoring deals",            durationMs: 1800 },
  { key: "outreach", label: "Sending opening text",     durationMs: 1800 },
];

interface Props {
  onComplete: () => void;
  onProgress?: (stageKey: string) => void;
}

export function PipelineStages({ onComplete, onProgress }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());

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
      if (!cancelled) setTimeout(() => { if (!cancelled) completeRef.current(); }, 500);
    };
    advance();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-1.5">
      {STAGES.map((s, i) => {
        const isDone = done.has(s.key);
        const isRunning = !isDone && i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-2.5 py-1">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              isDone
                ? "bg-emerald-500 text-white"
                : isRunning
                  ? "bg-blue-500 text-white"
                  : "bg-slate-200"
            }`}>
              {isDone ? <CheckCircle2 size={10} /> : isRunning ? <Loader2 size={10} className="animate-spin" /> : null}
            </div>
            <p className={`text-xs ${
              isDone ? "text-slate-700" : isRunning ? "text-slate-900 font-medium" : "text-slate-400"
            }`}>
              {s.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
