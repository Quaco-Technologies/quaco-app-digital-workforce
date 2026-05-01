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

// ─── Fast-scrolling ticker data per stage ────────────────────────────────────
const STREETS = ["N High St","Maple Ridge Dr","Oak Ln","Bayview Ave","W Pine St","Sunset Blvd","Cedar Ct","Lakeshore Dr","Hillview Rd","Riverside Pl","Elm Way","Bay Pl","Birch Ave","Magnolia Ct","Sycamore Ln","Fern Hollow Rd","Crestview Dr","Park Ridge Ave","King St","Queen Blvd","River Rd","Forest Hill Ln"];
const NAMES = ["Maria Hernandez","James Patel","Linda Goodwin","Marcus Chen","Tasha Williams","Robert Kim","Emma O'Brien","Devon Carter","Sofia Rossi","Aaron Brooks","Carlos Diaz","Olivia Martinez","Wilson Park","Naomi Frank","Yusuf Hayes","Priya Shah","Greta Lin","Hassan Reed","Imani Cole","Beatrice Vance"];

function rng(max: number) { return Math.floor(Math.random() * max); }

function pickAddress() { return `${100 + rng(9899)} ${STREETS[rng(STREETS.length)]}`; }
function pickPhone() { return `(${200 + rng(800)}) ${100 + rng(900)}-${1000 + rng(9000)}`; }
function pickName() { return NAMES[rng(NAMES.length)]; }
function pickAPN() { const seg = () => String(rng(9999)).padStart(4, "0"); return `${seg()}-${seg()}-${seg()}`; }

// Returns one fake "activity line" for the given stage
function makeTickerLine(stageKey: string, hit: boolean): { left: string; right: string; ok: boolean } {
  switch (stageKey) {
    case "scrape": {
      return { left: pickAddress(), right: `APN ${pickAPN()}`, ok: true };
    }
    case "skip": {
      return hit
        ? { left: pickName(), right: pickPhone(), ok: true }
        : { left: pickName(), right: "no phone", ok: false };
    }
    case "analyze": {
      const arv = (120 + rng(280)) * 1000;
      const offer = Math.round(arv * 0.7);
      return { left: pickAddress(), right: `ARV $${arv.toLocaleString()} → $${offer.toLocaleString()}`, ok: true };
    }
    case "score": {
      const score = (5 + rng(50)) / 10; // 0.5–5.4
      return hit
        ? { left: pickAddress(), right: `score ${score.toFixed(1)} ✓ pursue`, ok: true }
        : { left: pickAddress(), right: `score ${score.toFixed(1)} skip`, ok: false };
    }
    case "outreach": {
      return hit
        ? { left: pickName(), right: `${pickPhone()} ✓ sent`, ok: true }
        : { left: pickName(), right: "queued", ok: false };
    }
  }
  return { left: "", right: "", ok: true };
}

// ─── Ticker component (renders inside a running stage) ───────────────────────
function StageTicker({ stageKey }: { stageKey: string }) {
  const [lines, setLines] = useState<Array<{ id: number; left: string; right: string; ok: boolean }>>([]);
  const idRef = useRef(0);

  useEffect(() => {
    setLines([]);
    idRef.current = 0;
    const tick = setInterval(() => {
      const hit = stageKey === "skip" ? Math.random() > 0.18
                : stageKey === "score" ? Math.random() > 0.30
                : stageKey === "outreach" ? Math.random() > 0.10
                : true;
      const line = makeTickerLine(stageKey, hit);
      setLines((prev) => [...prev, { id: idRef.current++, ...line }].slice(-5));
    }, 110);
    return () => clearInterval(tick);
  }, [stageKey]);

  return (
    <div className="mt-1.5 ml-6 rounded-md bg-slate-900/95 px-2.5 py-1.5 font-mono text-[10px] leading-tight space-y-0.5 overflow-hidden">
      {lines.map((l) => (
        <div key={l.id} className="flex items-center justify-between gap-2 animate-slide-in">
          <span className="text-slate-300 truncate">{l.left}</span>
          <span className={l.ok ? "text-emerald-300 shrink-0" : "text-slate-500 shrink-0"}>{l.right}</span>
        </div>
      ))}
      {lines.length === 0 && <div className="h-3 text-slate-600">·</div>}
    </div>
  );
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
    <div className="space-y-2">
      {STAGES.map((s, i) => {
        const isDone = done.has(s.key);
        const isRunning = !isDone && i === currentIdx;
        return (
          <div key={s.key}>
            <div className="flex items-center gap-2.5">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                isDone ? "bg-emerald-500 text-white"
                  : isRunning ? "bg-blue-500 text-white"
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
            {isRunning && <StageTicker stageKey={s.key} />}
          </div>
        );
      })}
    </div>
  );
}
