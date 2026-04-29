"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { DemoState } from "@/lib/types";
import { fmt$$, fmtDate } from "@/lib/utils";
import {
  Play, Loader2, ChevronDown, MapPin, MessageSquare, Phone,
  Sparkles, FileSignature, CheckCircle2, Clock, ArrowRight,
  Users, Target, Handshake, FileCheck, Zap,
} from "lucide-react";
import { LiveDot } from "@/components/LiveDot";
import { CountUp } from "@/components/CountUp";
import { mockContracts, type MockContract } from "@/lib/mockData";

const US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["IL","Illinois"],["IN","Indiana"],["MA","Massachusetts"],["MI","Michigan"],["NV","Nevada"],
  ["NJ","New Jersey"],["NY","New York"],["NC","North Carolina"],["OH","Ohio"],["OR","Oregon"],
  ["PA","Pennsylvania"],["SC","South Carolina"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],
  ["VA","Virginia"],["WA","Washington"],["WI","Wisconsin"],
];

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "multi_family",  label: "Multi Family" },
  { value: "condo",         label: "Condo" },
  { value: "townhouse",     label: "Townhouse" },
];

interface Metric {
  key: string;
  label: string;
  value: number;
  color: "blue" | "cyan" | "teal" | "emerald" | "amber" | "violet";
  icon: React.ReactNode;
}

const COLOR_CLASSES: Record<Metric["color"], { bg: string; ring: string; text: string; dot: string }> = {
  blue:    { bg: "bg-blue-50/80",    ring: "ring-blue-200",    text: "text-blue-700",    dot: "bg-blue-500"    },
  cyan:    { bg: "bg-cyan-50/80",    ring: "ring-cyan-200",    text: "text-cyan-700",    dot: "bg-cyan-500"    },
  teal:    { bg: "bg-teal-50/80",    ring: "ring-teal-200",    text: "text-teal-700",    dot: "bg-teal-500"    },
  emerald: { bg: "bg-emerald-50/80", ring: "ring-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  amber:   { bg: "bg-amber-50/80",   ring: "ring-amber-200",   text: "text-amber-700",   dot: "bg-amber-500"   },
  violet:  { bg: "bg-violet-50/80",  ring: "ring-violet-200",  text: "text-violet-700",  dot: "bg-violet-500"  },
};

// Baseline numbers shown before / between demo runs so the page never feels dead.
const IDLE_METRICS: Metric[] = [
  { key: "scraping",    label: "Records scanned",      value: 0,   color: "blue",    icon: <Target size={13} /> },
  { key: "skip_traced", label: "Owners skip-traced",   value: 0,   color: "cyan",    icon: <Users size={13} /> },
  { key: "contacting",  label: "Sellers contacted",    value: 0,   color: "teal",    icon: <MessageSquare size={13} /> },
  { key: "negotiating", label: "Sellers negotiating",  value: 0,   color: "violet",  icon: <Handshake size={13} /> },
  { key: "accepted",    label: "Offers accepted",      value: 0,   color: "amber",   icon: <CheckCircle2 size={13} /> },
  { key: "contract",    label: "Under contract",       value: 0,   color: "emerald", icon: <FileCheck size={13} /> },
];

const DEMO_BASELINE: Metric[] = [
  { key: "scraping",    label: "Records scanned",      value: 4_812, color: "blue",    icon: <Target size={13} /> },
  { key: "skip_traced", label: "Owners skip-traced",   value: 1_445, color: "cyan",    icon: <Users size={13} /> },
  { key: "contacting",  label: "Sellers contacted",    value: 287,   color: "teal",    icon: <MessageSquare size={13} /> },
  { key: "negotiating", label: "Sellers negotiating",  value: 56,    color: "violet",  icon: <Handshake size={13} /> },
  { key: "accepted",    label: "Offers accepted",      value: 12,    color: "amber",   icon: <CheckCircle2 size={13} /> },
  { key: "contract",    label: "Under contract",       value: 4,     color: "emerald", icon: <FileCheck size={13} /> },
];

// Maps each demo stage to which metrics should "tick up" while it's running.
const STAGE_METRIC_GROWTH: Record<string, Partial<Record<string, number>>> = {
  scrape:     { scraping: 1500 },
  skip_trace: { skip_traced: 600 },
  analyze:    { contacting: 80 },
  outreach:   { contacting: 80, negotiating: 12 },
  negotiate:  { negotiating: 18, accepted: 3 },
  contract:   { accepted: 1, contract: 1 },
};

export default function MissionControlPage() {
  const [form, setForm] = useState({
    city: "Atlanta", state: "GA", county: "Fulton",
    min_price: 100_000, max_price: 400_000, min_beds: 2,
    property_types: ["single_family"] as string[],
    notify_phone: "",
  });

  const [demo, setDemo] = useState<DemoState | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>(IDLE_METRICS);
  const [contracts, setContracts] = useState<MockContract[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setContracts(mockContracts()); }, []);

  const stop = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };
  useEffect(() => () => stop(), []);

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));
  const toggleType = (t: string) =>
    set("property_types",
      form.property_types.includes(t)
        ? form.property_types.filter((x) => x !== t)
        : [...form.property_types, t],
    );

  const startDemo = async () => {
    setStarting(true);
    setError(null);
    setDemo(null);
    setMetrics(DEMO_BASELINE.map((m) => ({ ...m, value: Math.round(m.value * 0.6) })));

    try {
      const res = await api.demo.start(form.notify_phone.trim() || undefined);

      // Poll real demo state from backend
      pollRef.current = setInterval(async () => {
        try {
          const s = await api.demo.status(res.demo_id);
          setDemo(s);
          if (s.is_complete) {
            stop();
            // Add the demo's contract to the contracts list
            if (s.contract_url) {
              setContracts((prev) => [
                {
                  id: s.demo_id,
                  lead_id: "demo-lead",
                  address: "3857 N High St",
                  city: "Atlanta",
                  state: "GA",
                  owner_name: "Maria Hernandez",
                  agreed_price: 208_000,
                  status: "sent",
                  sent_at: new Date().toISOString(),
                  completed_at: null,
                  envelope_id: s.demo_id,
                },
                ...prev,
              ]);
            }
          }
        } catch (e) {
          stop();
          setError(e instanceof Error ? e.message : "Lost connection to demo");
        }
      }, 800);

      // Tick metrics independently — pulses growth as stages run
      tickRef.current = setInterval(() => {
        setMetrics((prev) => {
          if (!demo) return prev;
          const runningStage = demo.stages.find((s) => s.status === "running")?.name;
          if (!runningStage) return prev;
          const growth = STAGE_METRIC_GROWTH[runningStage] ?? {};
          return prev.map((m) => {
            const inc = growth[m.key];
            if (!inc) return m;
            const target = (DEMO_BASELINE.find((d) => d.key === m.key)?.value ?? m.value) * 1.05;
            const next = Math.min(target, m.value + Math.ceil(Math.random() * inc));
            return { ...m, value: Math.round(next) };
          });
        });
      }, 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  const isRunning = demo && !demo.is_complete;
  const isComplete = demo?.is_complete;
  const sms = demo?.sms_sent ?? [];
  const elapsed = demo ? Math.max(0, Math.round(Date.now() / 1000 - demo.started_at)) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Mission Control</h1>
            {isRunning && <LiveDot color="red" label="LIVE" />}
            {isComplete && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                Demo Complete
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            {isRunning
              ? `Pipeline running — ${elapsed}s elapsed.`
              : isComplete
                ? `Closed in ${elapsed}s. ${sms.filter((m) => m.delivered).length} of ${sms.length} texts delivered.`
                : "Set your buy box, hit Start, watch the funnel move in real time."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* ── BUY BOX (left on desktop, top on mobile) ── */}
        <div className="lg:col-span-3 order-1">
          <BuyBoxCard
            form={form}
            set={set}
            toggleType={toggleType}
            startDemo={startDemo}
            starting={starting}
            isRunning={!!isRunning}
            error={error}
          />
        </div>

        {/* ── LIVE UPDATES (center on desktop, middle on mobile) ── */}
        <div className="lg:col-span-6 order-2">
          <LiveUpdatesCard
            metrics={metrics}
            isRunning={!!isRunning}
            isComplete={!!isComplete}
            currentStage={demo?.stages.find((s) => s.status === "running")?.label}
            sms={sms}
          />
        </div>

        {/* ── CONTRACTS (right on desktop, bottom on mobile) ── */}
        <div className="lg:col-span-3 order-3">
          <ContractsCard contracts={contracts} />
        </div>
      </div>
    </div>
  );
}

// ─── BUY BOX ─────────────────────────────────────────────────────────────────
function BuyBoxCard({
  form, set, toggleType, startDemo, starting, isRunning, error,
}: {
  form: { city: string; state: string; county: string; min_price: number; max_price: number; min_beds: number; property_types: string[]; notify_phone: string };
  set: (key: string, value: unknown) => void;
  toggleType: (t: string) => void;
  startDemo: () => void;
  starting: boolean;
  isRunning: boolean;
  error: string | null;
}) {
  const inputClass = "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400";
  const labelClass = "block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1";

  return (
    <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-md shadow-blue-500/30">
          <Target size={14} className="text-white" />
        </div>
        <h2 className="font-semibold text-zinc-900">Buy Box</h2>
      </div>

      <div className="space-y-3 flex-1">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>City</label>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>County</label>
            <input value={form.county} onChange={(e) => set("county", e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>State</label>
          <div className="relative">
            <select value={form.state} onChange={(e) => set("state", e.target.value)} className={`${inputClass} appearance-none pr-8`}>
              {US_STATES.map(([abbr, name]) => <option key={abbr} value={abbr}>{abbr} — {name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Price range</label>
          <div className="flex items-center gap-2">
            <input type="number" value={form.min_price} onChange={(e) => set("min_price", Number(e.target.value))} className={inputClass} />
            <span className="text-zinc-300">—</span>
            <input type="number" value={form.max_price} onChange={(e) => set("max_price", Number(e.target.value))} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Min beds</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => set("min_beds", n)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  form.min_beds === n
                    ? "bg-gradient-to-br from-blue-500 to-emerald-500 text-white border-transparent shadow-sm"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300 bg-white"
                }`}
              >
                {n}+
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Types</label>
          <div className="flex flex-wrap gap-1.5">
            {PROPERTY_TYPES.map((p) => (
              <button
                key={p.value}
                onClick={() => toggleType(p.value)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  form.property_types.includes(p.value)
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-100">
          <label className={labelClass}>Notify me at (SMS)</label>
          <input
            type="tel"
            value={form.notify_phone}
            onChange={(e) => set("notify_phone", e.target.value)}
            placeholder="+1 555 123 4567 (or use default)"
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</p>
      )}

      <button
        onClick={startDemo}
        disabled={starting || isRunning}
        className="mt-4 w-full bg-gradient-to-br from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.01] flex items-center justify-center gap-2"
      >
        {starting || isRunning
          ? <><Loader2 size={14} className="animate-spin" /> {isRunning ? "Pipeline running…" : "Starting…"}</>
          : <><Play size={14} fill="currentColor" /> Start Pipeline</>}
      </button>
    </div>
  );
}

// ─── LIVE UPDATES ────────────────────────────────────────────────────────────
function LiveUpdatesCard({
  metrics, isRunning, isComplete, currentStage, sms,
}: {
  metrics: Metric[];
  isRunning: boolean;
  isComplete: boolean;
  currentStage: string | undefined;
  sms: DemoState["sms_sent"];
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-xl shadow-blue-500/20 h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-cyan-600 to-emerald-600 animate-gradient" />
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/40 blur-3xl rounded-full" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-300/40 blur-3xl rounded-full" />
      </div>
      <div className="relative p-5 sm:p-6 text-white flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} />
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Live Pipeline</p>
          </div>
          {isRunning && <LiveDot color="red" label="LIVE" />}
          {isComplete && <LiveDot color="green" label="DONE" />}
        </div>

        {currentStage && (
          <p className="text-[11px] mb-4 opacity-90 italic">→ {currentStage}…</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
          {metrics.map((m) => <MetricChip key={m.key} m={m} live={isRunning} />)}
        </div>

        {/* SMS feed (only shown once messages exist) */}
        <div className="flex-1 min-h-0">
          {sms.length === 0 ? (
            <div className="bg-black/20 backdrop-blur-md rounded-xl p-4 border border-white/20 text-center">
              <p className="text-xs opacity-90">
                {isRunning ? "Waiting for first SMS…" : "Click Start Pipeline to begin"}
              </p>
            </div>
          ) : (
            <div className="bg-black/20 backdrop-blur-md rounded-xl p-3 border border-white/20 space-y-2 max-h-[180px] overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">Texts sent ({sms.filter((m) => m.delivered).length}/{sms.length} delivered)</p>
              {sms.map((m, i) => (
                <div key={i} className="animate-slide-in">
                  <div className="flex items-center gap-1.5 text-[10px] opacity-80 mb-0.5">
                    <Phone size={9} />
                    <span className="font-bold uppercase tracking-wide">{m.kind}</span>
                    {m.delivered && <CheckCircle2 size={10} className="ml-auto" />}
                  </div>
                  <p className="text-xs leading-relaxed">{m.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricChip({ m, live }: { m: Metric; live: boolean }) {
  const c = COLOR_CLASSES[m.color];
  return (
    <div className={`relative rounded-xl ${c.bg} backdrop-blur-md ring-1 ${c.ring} px-3 py-2.5 transition-all`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`relative flex h-1.5 w-1.5`}>
          {live && <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${c.dot} animate-ping`} />}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${c.dot}`} />
        </span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${c.text}`}>{m.label}</span>
      </div>
      <p className={`text-xl font-bold ${c.text} flex items-center gap-1.5`}>
        <span>{m.icon}</span>
        <CountUp value={m.value} durationMs={500} />
      </p>
    </div>
  );
}

// ─── CONTRACTS ───────────────────────────────────────────────────────────────
function ContractsCard({ contracts }: { contracts: MockContract[] }) {
  const pending = contracts.filter((c) => c.status === "sent");
  const signed = contracts.filter((c) => c.status === "completed");
  return (
    <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center shadow-md shadow-emerald-500/30">
          <FileSignature size={14} className="text-white" />
        </div>
        <h2 className="font-semibold text-zinc-900">Ready to Sign</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-3">{pending.length} awaiting · {signed.length} signed</p>

      <div className="space-y-2 flex-1 overflow-y-auto">
        {contracts.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-8">
            Contracts land here once the AI agent closes a deal.
          </p>
        ) : (
          contracts.slice(0, 6).map((c) => {
            const isSigned = c.status === "completed";
            return (
              <Link
                key={c.id}
                href={`/leads/${c.lead_id}`}
                className={`block rounded-xl p-3 border transition-all hover:-translate-y-0.5 ${
                  isSigned
                    ? "bg-emerald-50/60 border-emerald-100 hover:border-emerald-300"
                    : "bg-amber-50/60 border-amber-100 hover:border-amber-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-zinc-900 leading-tight line-clamp-1">{c.address}</p>
                  {isSigned ? (
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  ) : (
                    <Clock size={14} className="text-amber-600 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 flex items-center gap-1 mb-2">
                  <MapPin size={9} className="text-zinc-400" />{c.city}, {c.state}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold text-emerald-700">{fmt$$(c.agreed_price)}</p>
                  <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                    isSigned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {isSigned ? "Signed" : "Awaiting"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100">
                  <span className="text-[10px] text-zinc-500 truncate">{c.owner_name}</span>
                  <span className="text-[10px] text-zinc-400">{fmtDate(c.sent_at)}</span>
                </div>
                {!isSigned && (
                  <button className="mt-2 w-full bg-gradient-to-br from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider py-1.5 rounded-lg transition-all flex items-center justify-center gap-1">
                    Review & sign <ArrowRight size={11} />
                  </button>
                )}
              </Link>
            );
          })
        )}
      </div>

      {contracts.length > 6 && (
        <Link href="/contracts" className="text-xs text-blue-600 hover:text-blue-700 font-medium text-center mt-3">
          View all {contracts.length} →
        </Link>
      )}
    </div>
  );
}
