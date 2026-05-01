"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmt$$, fmtDate } from "@/lib/utils";
import {
  Play, Loader2, ChevronDown, MapPin,
  FileSignature, CheckCircle2, Clock, ArrowRight,
} from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { PipelineStages } from "@/components/PipelineStages";
import { MetricDetailModal, type MetricKind } from "@/components/MetricDetailModal";
import { LiveMessageFeed, type FeedEvent } from "@/components/LiveMessageFeed";
import { AnalyticsCard } from "@/components/AnalyticsCard";
import { MarketSwitcher, MARKETS, type Market } from "@/components/MarketSwitcher";
import { mockContracts, type MockContract } from "@/lib/mockData";

interface ConvMsg {
  role: "agent" | "owner";
  body: string;
  sent_at: string;
}

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
  color: "slate" | "blue" | "amber" | "emerald";
}

// Premium light palette — saturated dots, deep text on white surfaces.
const COLOR: Record<Metric["color"], { dot: string; ring: string; text: string }> = {
  slate:   { dot: "bg-slate-500",   ring: "bg-slate-400/50",   text: "text-slate-900"  },
  blue:    { dot: "bg-sky-500",     ring: "bg-sky-400/50",     text: "text-sky-700"    },
  amber:   { dot: "bg-amber-500",   ring: "bg-amber-400/50",   text: "text-amber-700"  },
  emerald: { dot: "bg-emerald-500", ring: "bg-emerald-400/50", text: "text-emerald-700" },
};

const IDLE_METRICS: Metric[] = [
  { key: "contacted",   label: "Sellers contacted",   value: 0, color: "slate"   },
  { key: "negotiating", label: "In negotiation",      value: 0, color: "blue"    },
  { key: "accepted",    label: "Offers accepted",     value: 0, color: "amber"   },
  { key: "contract",    label: "Under contract",      value: 0, color: "emerald" },
];

const DEMO_BASELINE: Metric[] = [
  { key: "contacted",   label: "Sellers contacted",   value: 287, color: "slate"   },
  { key: "negotiating", label: "In negotiation",      value: 56,  color: "blue"    },
  { key: "accepted",    label: "Offers accepted",     value: 12,  color: "amber"   },
  { key: "contract",    label: "Under contract",      value: 4,   color: "emerald" },
];

// Scale demo numbers by the selected market's relative size so switching
// between markets feels like switching between actual investor accounts.
function baselineForMarket(activeLeads: number): Metric[] {
  // Atlanta = 142 = scale 1.0 reference. Numbers scale linearly.
  const scale = activeLeads / 142;
  return DEMO_BASELINE.map((m) => ({
    ...m,
    value: Math.max(1, Math.round(m.value * scale)),
  }));
}

export default function MissionControlPage() {
  const [market, setMarket] = useState<Market>(MARKETS[1]); // default: Atlanta
  const [form, setForm] = useState({
    city: "Atlanta", state: "GA", county: "Fulton",
    min_price: 100_000, max_price: 400_000, min_beds: 2,
    property_types: ["single_family"] as string[],
    notify_phone: "",
    extra_phones: [] as string[],
  });

  // When the market switches: sync the buy box, scale the metric baselines.
  const switchMarket = (m: Market) => {
    setMarket(m);
    if (m.key !== "all") {
      setForm((f) => ({ ...f, city: m.city, state: m.state, county: m.county }));
    }
    // Reset the displayed metrics to the new market's baseline so the dashboard
    // reflects the new context immediately (only if we're not mid-run).
    if (phase === "idle") {
      setMetrics(baselineForMarket(m.active_leads));
    }
  };

  const [phase, setPhase] = useState<"idle" | "stages" | "negotiating">("idle");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConvMsg[]>([]);
  const [agreedPrice, setAgreedPrice] = useState<number | null>(null);
  const [recipientPhone, setRecipientPhone] = useState<string>("");
  const [contractEmail, setContractEmail] = useState<string | null>(null);
  const [contractDelivered, setContractDelivered] = useState(false);
  const [contractSigned, setContractSigned] = useState(false);
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>(baselineForMarket(MARKETS[1].active_leads));
  const [contracts, setContracts] = useState<MockContract[]>([]);
  const startedAtRef = useRef<number>(0);
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
    stop();
    setError(null);
    setLeadId(null);
    setConversation([]);
    setContractEmail(null);
    setContractDelivered(false);
    setContractSigned(false);
    setContractUrl(null);
    setAgreedPrice(null);
    startedAtRef.current = Date.now() / 1000;
    setMetrics(IDLE_METRICS);
    setPhase("stages");

    // Sequential count-up: fill metric 0 to its target, THEN metric 1, then 2.
    // Skip metric 3 (Under Contract) entirely — that one only moves on sign.
    // Real-world flow: contact → negotiate → accepted → contract.
    // Each metric fills in ~1.4s with a smooth linear ramp + tiny jitter so
    // it doesn't look mechanical.
    let activeIdx = 0;
    let pauseTicks = 0; // brief pause between metrics for visual breathing room
    const TICKABLE = 3;
    const TICK_MS = 60;
    const FILL_TICKS = 22; // ~22 ticks × 60ms ≈ 1.3s per metric
    const PAUSE_TICKS = 6;  // ~360ms pause between metrics
    const baseline = baselineForMarket(market.active_leads);
    tickRef.current = setInterval(() => {
      setMetrics((prev) => {
        if (activeIdx >= TICKABLE) return prev;
        if (pauseTicks > 0) { pauseTicks -= 1; return prev; }
        const m = prev[activeIdx];
        const target = baseline[activeIdx].value;
        if (m.value >= target) {
          activeIdx += 1;
          pauseTicks = PAUSE_TICKS;
          return prev;
        }
        const baseStep = Math.max(1, Math.ceil(target / FILL_TICKS));
        // ±20% jitter so it feels alive
        const jitter = Math.max(1, Math.round(baseStep * (0.8 + Math.random() * 0.4)));
        const next = Math.min(target, m.value + jitter);
        return prev.map((p, i) => i === activeIdx ? { ...p, value: next } : p);
      });
    }, TICK_MS);
  };

  const fireNegotiation = useCallback(async () => {
    setPhase("negotiating");
    try {
      const res = await api.demo.negotiate({
        recipient_phone: form.notify_phone.trim() || undefined,
        additional_phones: form.extra_phones.length > 0 ? form.extra_phones : undefined,
        owner_name: "Maria Hernandez",
        address: "3857 N High St",
        city: form.city || "Atlanta",
        state: form.state || "GA",
        arv: 268_000,
        offer_price: Math.round((form.min_price + form.max_price) / 2),
      });
      setLeadId(res.lead_id);
      setRecipientPhone(res.recipient_phone);

      if (res.opening_message) {
        setConversation([{ role: "agent", body: res.opening_message, sent_at: new Date().toISOString() }]);
      }
      if (res.error) setError(res.error);

      pollRef.current = setInterval(async () => {
        try {
          const c = await api.demo.conversation(res.lead_id);
          setConversation(c.messages);
          if (c.agreed_price) setAgreedPrice(c.agreed_price);
          if (c.contract_email_sent_to) {
            setContractEmail(c.contract_email_sent_to);
            setContractDelivered(c.contract_email_delivered);
          }
          if (c.contract_url) setContractUrl(c.contract_url);

          // Only add the contract to "Ready to Sign" + bump Under Contract
          // ONCE THE USER SIGNS — not at deal-agreed time.
          if (c.contract_signed && !contractSigned) {
            setContractSigned(true);
            const agreed = c.agreed_price ?? 0;
            setContracts((prev) => {
              if (prev.some((p) => p.id === c.lead_id)) return prev;
              const next: MockContract = {
                id: c.lead_id,
                lead_id: c.lead_id,
                address: "3857 N High St",
                city: form.city || "Atlanta",
                state: form.state || "GA",
                owner_name: "Maria Hernandez",
                agreed_price: agreed,
                status: "completed",
                sent_at: new Date().toISOString(),
                completed_at: c.signed_at || new Date().toISOString(),
                envelope_id: c.lead_id,
              };
              return [next, ...prev];
            });
            // bump Under Contract metric +1
            setMetrics((prev) => prev.map((m) =>
              m.key === "contract" ? { ...m, value: m.value + 1 } : m
            ));
            stop();
          }
          if (c.status === "dead") stop();
        } catch { /* keep polling */ }
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.notify_phone, form.extra_phones, form.city, form.state, form.min_price, form.max_price]);

  const isRunning = phase !== "idle" && (!agreedPrice || !contractDelivered);
  const elapsed = phase !== "idle" ? Math.max(0, Math.round(Date.now() / 1000 - startedAtRef.current)) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Mercury-style hero: greeting + market chip + action pill row */}
      <div className="mb-6">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight leading-tight">
              {phase === "idle" ? "Welcome back" : phase === "stages" ? "Pipeline running" : agreedPrice ? "Deal agreed" : "Negotiating"}
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5 flex items-center gap-2">
              {phase === "idle"
                ? (market.key === "all" ? "Across all markets" : `Viewing ${market.city}, ${market.state}`)
                : `${elapsed}s elapsed`}
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
                  </span>
                  Live
                </span>
              )}
            </p>
          </div>
          <MarketSwitcher current={market} onChange={switchMarket} />
        </div>

        {/* Action pill row — Mercury "Send / Transfer / Deposit" pattern */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={startDemo} disabled={isRunning} className="btn-pill-primary">
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={11} fill="currentColor" />}
            {isRunning ? "Running" : "Go"}
          </button>
          <Link href="/board" className="btn-pill">
            <FileSignature size={12} strokeWidth={1.75} />
            Pipeline Board
          </Link>
          <Link href="/contracts" className="btn-pill">
            <FileSignature size={12} strokeWidth={1.75} />
            Contracts
          </Link>
          <Link href="/analytics" className="btn-pill ml-auto text-slate-500 hover:text-slate-900">
            Customize →
          </Link>
        </div>
      </div>

      {/* New layout:
          LEFT (col-span-8): grid of [Buy Box | Live Pipeline] then [Ready to Sign] then [Analytics]
          RIGHT (col-span-4): Network Activity, full-height column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 lg:items-stretch">
        {/* LEFT side: 2-col sub-grid for the top row, then full-width rows below */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 lg:auto-rows-min">
          <div className="md:col-span-1">
            <BuyBoxCard form={form} set={set} toggleType={toggleType} startDemo={startDemo} isRunning={isRunning} error={error} />
          </div>
          <div className="md:col-span-1">
            <LiveFeedCard
              phase={phase}
              metrics={metrics}
              conversation={conversation}
              recipientPhone={recipientPhone}
              agreedPrice={agreedPrice}
              contractEmail={contractEmail}
              contractDelivered={contractDelivered}
              contractSigned={contractSigned}
              contractUrl={contractUrl}
              leadId={leadId}
              onStagesComplete={fireNegotiation}
            />
          </div>
          <div className="md:col-span-2">
            <ContractsRow contracts={contracts} />
          </div>
          <div className="md:col-span-2">
            <AnalyticsCard />
          </div>
        </div>

        {/* RIGHT side: Network Activity, full height of the row */}
        <div className="lg:col-span-4">
          <div className="h-full">
            <LiveMessageFeed
              heading="Network Activity"
              running={isRunning}
              onEvent={(e: FeedEvent) => {
                // Each lifecycle event ticks a Live Pipeline metric so the
                // numbers on the right reflect the action on the left.
                setMetrics((prev) => prev.map((m) => {
                  if (e.type === "spawned"     && m.key === "contacted")    return { ...m, value: m.value + 1 };
                  if (e.type === "negotiating" && m.key === "negotiating")  return { ...m, value: m.value + 1 };
                  if (e.type === "completed" && e.outcome === "agreed") {
                    if (m.key === "accepted") return { ...m, value: m.value + 1 };
                    if (m.key === "contract") return { ...m, value: m.value + 1 };
                  }
                  return m;
                }));
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BUY BOX ─────────────────────────────────────────────────────────────────
function BuyBoxCard({
  form, set, toggleType, startDemo, isRunning, error,
}: {
  form: { city: string; state: string; county: string; min_price: number; max_price: number; min_beds: number; property_types: string[]; notify_phone: string; extra_phones: string[] };
  set: (key: string, value: unknown) => void;
  toggleType: (t: string) => void;
  startDemo: () => void;
  isRunning: boolean;
  error: string | null;
}) {

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200/60 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400";
  const labelClass = "block text-[11px] font-medium text-slate-500 mb-1";

  return (
    <div className="surface rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight mb-5">Buy Box</h2>

      <div className="space-y-3">
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
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Price range</label>
          <div className="flex items-center gap-2">
            <input type="number" value={form.min_price} onChange={(e) => set("min_price", Number(e.target.value))} className={inputClass} />
            <span className="text-slate-300">—</span>
            <input type="number" value={form.max_price} onChange={(e) => set("max_price", Number(e.target.value))} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Min beds</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => set("min_beds", n)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  form.min_beds === n
                    ? "bg-white text-slate-900 shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]"
                    : "text-slate-500 hover:bg-white/60"
                }`}
              >
                {n}+
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Types</label>
          <div className="flex flex-wrap gap-1">
            {PROPERTY_TYPES.map((p) => (
              <button
                key={p.value}
                onClick={() => toggleType(p.value)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  form.property_types.includes(p.value)
                    ? "bg-white text-slate-900 shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]"
                    : "text-slate-500 hover:bg-white/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      <button
        onClick={startDemo}
        disabled={isRunning}
        className="btn-pill-primary mt-5 w-full justify-center"
      >
        {isRunning
          ? <><Loader2 size={13} className="animate-spin" /> Running…</>
          : <><Play size={12} fill="currentColor" /> Go</>}
      </button>

      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-3">{error}</p>
      )}

    </div>
  );
}

// ─── LIVE FEED ──────────────────────────────────────────────────────────────
function LiveFeedCard({
  phase, metrics, conversation, recipientPhone, agreedPrice,
  contractEmail, contractDelivered, contractSigned, contractUrl,
  leadId, onStagesComplete,
}: {
  phase: "idle" | "stages" | "negotiating";
  metrics: Metric[];
  conversation: ConvMsg[];
  recipientPhone: string;
  agreedPrice: number | null;
  contractEmail: string | null;
  contractDelivered: boolean;
  contractSigned: boolean;
  contractUrl: string | null;
  leadId: string | null;
  onStagesComplete: () => void;
}) {
  const [activeModal, setActiveModal] = useState<MetricKind | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation]);

  return (
    <div className="surface p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[15px] font-medium text-slate-900 tracking-tight">Live Pipeline</h3>
          <p className="text-[12px] text-slate-500 mt-0.5">Click any tile for details</p>
        </div>
        {phase !== "idle" ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
            </span>
            Live
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">Idle</span>
        )}
      </div>

      {/* 2×2 grid of big metric tiles — clickable */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {metrics.map((m) => (
          <MetricTile
            key={m.key}
            m={m}
            active={phase !== "idle"}
            onClick={() => setActiveModal(m.key as MetricKind)}
          />
        ))}
      </div>
      <MetricDetailModal
        kind={activeModal}
        active={phase !== "idle"}
        onClose={() => setActiveModal(null)}
      />

      {/* Stages animation while pipeline is "running" */}
      {phase === "stages" && (
        <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 mt-2">
          <PipelineStagesLight onComplete={onStagesComplete} />
        </div>
      )}

      {/* Conversation thread */}
      {phase === "negotiating" && (
        <div className="border-t border-slate-200/60 pt-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Negotiating with {recipientPhone || "owner"}
            </p>
            {agreedPrice && (
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                ✓ DEAL @ ${agreedPrice.toLocaleString()}
              </span>
            )}
          </div>

          {conversation.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Sending opening text…</p>
          ) : (
            <div ref={scrollRef} className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {conversation.map((m, i) => (
                <div key={i} className={`flex animate-slide-in ${m.role === "agent" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] flex flex-col gap-0.5 ${m.role === "agent" ? "items-end" : "items-start"}`}>
                    <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400 px-1">
                      {m.role === "agent" ? "AI Agent" : "Owner"}
                    </span>
                    <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                      m.role === "agent"
                        ? "bg-slate-900 text-white rounded-br-sm"
                        : "bg-slate-100 text-slate-800 rounded-bl-sm"
                    }`}>
                      {m.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}


          {/* Contract sent — with Sign Now button until signed */}
          {contractEmail && (
            <div className={`mt-3 rounded-xl p-3 border animate-fade-up ${
              contractSigned
                ? "bg-emerald-50 border-emerald-200"
                : "bg-amber-50 border-amber-200"
            }`}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
                  contractSigned ? "bg-emerald-100" : "bg-amber-100"
                }`}>
                  <FileSignature size={14} className={contractSigned ? "text-emerald-700" : "text-amber-700"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                    contractSigned ? "text-emerald-700" : "text-amber-700"
                  }`}>
                    {contractSigned ? "Contract signed" : contractDelivered ? "Contract emailed" : "Contract queued"}
                  </p>
                  <p className="text-xs text-slate-700 truncate">{contractEmail}</p>
                </div>
                {contractSigned && (
                  <span className="text-[10px] font-semibold bg-white text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">✓ SIGNED</span>
                )}
              </div>
              {!contractSigned && leadId && (
                <div className="flex gap-1.5">
                  <a
                    href={contractUrl ?? `/sign/${leadId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2 rounded-md transition-colors"
                  >
                    Open in new tab
                  </a>
                  <button
                    onClick={async () => {
                      if (!leadId) return;
                      try {
                        await api.demo.signContract(leadId);
                        // poll will pick up the signed state on next tick
                      } catch { /* swallow */ }
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-md transition-colors"
                  >
                    Sign here ↳
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Idle state */}
      {phase === "idle" && (
        <p className="text-xs text-slate-400 text-center pt-2">Press Go to begin.</p>
      )}
    </div>
  );
}

// Mercury-style tile: white surface, near-invisible border, big number on top,
// soft uppercase label below. Pulsing colored dot in the corner only when live.
function MetricTile({ m, active, onClick }: { m: Metric; active: boolean; onClick: () => void }) {
  const c = COLOR[m.color];
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative text-left rounded-xl bg-white border border-slate-200/60 px-4 py-3.5 transition-all duration-200 hover:border-slate-300/80 hover:shadow-[0_4px_12px_-4px_rgba(15,23,42,0.06)] group overflow-hidden"
    >
      <span className="absolute top-3 right-3 flex h-1.5 w-1.5">
        {active && <span className={`absolute inline-flex h-full w-full rounded-full ${c.ring} animate-ping`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${c.dot}`} />
      </span>
      <p className={`num-display text-[28px] font-semibold tabular-nums leading-none text-slate-900`}>
        <CountUp value={m.value} durationMs={500} />
      </p>
      <p className="text-[11px] text-slate-500 mt-2 leading-tight">
        {m.label}
      </p>
    </button>
  );
}

// Lightweight inline stages animation for the live card
function PipelineStagesLight({ onComplete }: { onComplete: () => void }) {
  return <PipelineStages onComplete={onComplete} />;
}

// ─── CONTRACTS (bottom right) ────────────────────────────────────────────────
function ContractsRow({ contracts }: { contracts: MockContract[] }) {
  const pending = contracts.filter((c) => c.status === "sent");
  const signed = contracts.filter((c) => c.status === "completed");
  return (
    <div className="surface rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight">Ready to Sign</h3>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{pending.length} awaiting · {signed.length} signed</p>
        </div>
        <Link href="/contracts" className="text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors">View all →</Link>
      </div>

      {contracts.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">
          Contracts land here once the AI agent closes a deal.
        </p>
      ) : (
        // Compact one-row layout: 3 cards across, no big Review button — entire
        // card is clickable. Keeps the right column flush with Network Activity.
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {contracts.slice(0, 3).map((c) => {
            const isSigned = c.status === "completed";
            return (
              <Link
                key={c.id}
                href={`/leads/${c.lead_id}`}
                className="block surface rounded-lg px-3 py-2.5 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 leading-tight line-clamp-1">{c.address}</p>
                  {isSigned
                    ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    : <Clock size={13} className="text-amber-600 shrink-0" />}
                </div>
                <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={8} className="text-slate-400" />{c.city}, {c.state}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-sm font-semibold text-slate-900">{fmt$$(c.agreed_price)}</p>
                  <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                    isSigned ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}>
                    {isSigned ? "Signed" : "Awaiting"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
