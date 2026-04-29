"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmt$$, fmtDate } from "@/lib/utils";
import {
  Play, Loader2, ChevronDown, MapPin, MessageSquare, Phone,
  Sparkles, FileSignature, CheckCircle2, Clock, ArrowRight,
  Users, Target, Handshake, FileCheck,
} from "lucide-react";
import { LiveDot } from "@/components/LiveDot";
import { CountUp } from "@/components/CountUp";
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

  const [leadId, setLeadId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConvMsg[]>([]);
  const [negotiationStatus, setNegotiationStatus] = useState<string>("idle");
  const [agreedPrice, setAgreedPrice] = useState<number | null>(null);
  const [recipientPhone, setRecipientPhone] = useState<string>("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>(IDLE_METRICS);
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
    setStarting(true);
    setError(null);
    setLeadId(null);
    setConversation([]);
    setNegotiationStatus("scraping");
    setAgreedPrice(null);
    startedAtRef.current = Date.now() / 1000;
    setMetrics(DEMO_BASELINE.map((m) => ({ ...m, value: Math.round(m.value * 0.6) })));

    // Tick metrics with growth so the dashboard feels alive while we wait for SMS
    tickRef.current = setInterval(() => {
      setMetrics((prev) => prev.map((m) => {
        const target = DEMO_BASELINE.find((d) => d.key === m.key)?.value ?? m.value;
        if (m.value >= target) return m;
        const inc = Math.max(1, Math.ceil((target - m.value) * 0.04));
        return { ...m, value: Math.min(target, m.value + Math.ceil(Math.random() * inc)) };
      }));
    }, 350);

    try {
      const res = await api.demo.negotiate({
        recipient_phone: form.notify_phone.trim() || undefined,
        owner_name: "Maria Hernandez",
        address: `${form.city || "Atlanta"} demo property`,
        city: form.city || "Atlanta",
        state: form.state || "GA",
        arv: 268_000,
        offer_price: Math.round((form.min_price + form.max_price) / 2),
      });
      setLeadId(res.lead_id);
      setRecipientPhone(res.recipient_phone);
      setNegotiationStatus("outreach");

      if (res.opening_message) {
        setConversation([{ role: "agent", body: res.opening_message, sent_at: new Date().toISOString() }]);
      }
      if (res.error) {
        setError(res.error);
      }

      // Poll the live conversation every 2s — picks up owner replies +
      // AI counter-texts as they happen
      pollRef.current = setInterval(async () => {
        try {
          const c = await api.demo.conversation(res.lead_id);
          setConversation(c.messages);
          setNegotiationStatus(c.status);
          if (c.agreed_price) setAgreedPrice(c.agreed_price);

          // Once a deal is agreed, drop a contract into the list and stop polling
          if (c.status === "negotiating" && c.agreed_price !== null) {
            const agreed = c.agreed_price;
            setContracts((prev) => {
              if (prev.some((p) => p.id === c.lead_id)) return prev;
              const next: MockContract = {
                id: c.lead_id,
                lead_id: c.lead_id,
                address: `${form.city || "Atlanta"} demo property`,
                city: form.city || "Atlanta",
                state: form.state || "GA",
                owner_name: "Maria Hernandez",
                agreed_price: agreed,
                status: "sent",
                sent_at: new Date().toISOString(),
                completed_at: null,
                envelope_id: c.lead_id,
              };
              return [next, ...prev];
            });
          }
          if (c.status === "dead") stop();
        } catch (e) {
          // Keep polling — transient errors shouldn't kill the live view
        }
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      stop();
    } finally {
      setStarting(false);
    }
  };

  const isRunning = !!leadId && negotiationStatus !== "dead" && !agreedPrice;
  const isComplete = !!agreedPrice;
  const elapsed = leadId ? Math.max(0, Math.round(Date.now() / 1000 - startedAtRef.current)) : 0;

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
                ? `Deal agreed at $${agreedPrice?.toLocaleString()} in ${elapsed}s. Contract sent to your inbox.`
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
            conversation={conversation}
            recipientPhone={recipientPhone}
            agreedPrice={agreedPrice}
            leadId={leadId}
            onSimulateReply={async (body) => {
              if (!leadId) return;
              try {
                const c = await api.demo.simulateReply(leadId, body);
                setConversation(c.messages);
                setNegotiationStatus(c.status);
                if (c.agreed_price) setAgreedPrice(c.agreed_price);
              } catch {
                /* swallow — poll will catch any state changes */
              }
            }}
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
const SUGGESTED_REPLIES = [
  "Maybe — what's your number?",
  "I'd need at least $215k.",
  "Send me the offer in writing.",
  "Yes! Let's do it.",
];

function LiveUpdatesCard({
  metrics, isRunning, isComplete, conversation, recipientPhone, agreedPrice,
  onSimulateReply, leadId,
}: {
  metrics: Metric[];
  isRunning: boolean;
  isComplete: boolean;
  conversation: ConvMsg[];
  recipientPhone: string;
  agreedPrice: number | null;
  onSimulateReply: (body: string) => void;
  leadId: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation]);

  const sendReply = async (text: string) => {
    const body = text.trim();
    if (!body || thinking || !leadId) return;
    setThinking(true);
    try {
      await onSimulateReply(body);
      setDraft("");
    } finally {
      setThinking(false);
    }
  };

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
          {isComplete && <LiveDot color="green" label="DEAL" />}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
          {metrics.map((m) => <MetricChip key={m.key} m={m} live={isRunning} />)}
        </div>

        {/* Live AI ↔ Owner conversation */}
        <div className="flex-1 min-h-0">
          {conversation.length === 0 ? (
            <div className="bg-black/25 backdrop-blur-md rounded-xl p-4 border border-white/30 text-center">
              <p className="text-xs">
                {isRunning ? "Waiting for AI agent to send opening text…" : "Click Start Pipeline to fire the negotiation bot"}
              </p>
            </div>
          ) : (
            <div className="bg-black/25 backdrop-blur-md rounded-xl p-3 border border-white/30 flex flex-col">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                  Negotiating with {recipientPhone || "owner"}
                </p>
                {agreedPrice && (
                  <span className="text-[10px] font-bold bg-emerald-500/30 border border-emerald-400/50 text-white px-2 py-0.5 rounded-full">
                    ✓ DEAL @ ${agreedPrice.toLocaleString()}
                  </span>
                )}
              </div>
              <div ref={scrollRef} className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {conversation.map((m, i) => (
                  <div key={i} className={`flex animate-slide-in ${m.role === "agent" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] flex flex-col ${m.role === "agent" ? "items-end" : "items-start"} gap-0.5`}>
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 px-1">
                        {m.role === "agent" ? "AI Agent" : "Owner"}
                      </span>
                      <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                        m.role === "agent"
                          ? "bg-white text-zinc-900 rounded-br-sm shadow-sm"
                          : "bg-white/15 border border-white/20 text-white rounded-bl-sm"
                      }`}>
                        {m.body}
                      </div>
                    </div>
                  </div>
                ))}
                {isRunning && conversation.length > 0 && conversation[conversation.length - 1].role === "agent" && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="bg-white/15 border border-white/20 px-3 py-2 rounded-2xl rounded-bl-sm">
                      <div className="flex gap-1">
                        <span className="h-1 w-1 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1 w-1 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1 w-1 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Simulated reply controls — let investors drive the conversation
                  even if their phone isn't on the same Telnyx account */}
              {leadId && !agreedPrice && (
                <div className="pt-2 mt-2 border-t border-white/15 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {SUGGESTED_REPLIES.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendReply(s)}
                        disabled={thinking}
                        className="text-[10px] font-medium bg-white/15 hover:bg-white/25 border border-white/20 text-white px-2 py-1 rounded-md transition-colors disabled:opacity-40"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendReply(draft); } }}
                      placeholder="Reply as the owner…"
                      disabled={thinking}
                      className="flex-1 bg-white/10 border border-white/25 text-white placeholder-white/60 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-white/50"
                    />
                    <button
                      onClick={() => sendReply(draft)}
                      disabled={thinking || !draft.trim()}
                      className="bg-white text-blue-700 disabled:bg-white/40 disabled:text-white/60 disabled:cursor-not-allowed text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                    >
                      {thinking ? "…" : "Send"}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-[9px] opacity-70 text-center pt-2 mt-1 border-t border-white/15">
                Reply on your phone OR use the buttons above — AI counters live
              </p>
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
