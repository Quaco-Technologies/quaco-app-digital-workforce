"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Lead } from "@/lib/types";
import { fmt$$ } from "@/lib/utils";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Loader2,
  MapPin,
  Play,
  Search,
  Home,
  Calculator,
  Users,
  Zap,
  ChevronDown,
} from "lucide-react";

const US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
  ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
  ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
  ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
  ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
];

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "multi_family",  label: "Multi Family" },
  { value: "condo",         label: "Condo" },
  { value: "townhouse",     label: "Townhouse" },
];

const PIPELINE_STEPS = [
  { icon: MapPin,      label: "Finding Properties",   detail: "Pulling off-market records from county assessor" },
  { icon: Users,       label: "Skip Tracing Owners",  detail: "Looking up owner contact info — phone & email" },
  { icon: Home,        label: "Property Condition",   detail: "Reviewing exterior condition from street-level imagery" },
  { icon: Search,      label: "Comparable Sales",     detail: "Recent sold homes in the area for accurate pricing" },
  { icon: Calculator,  label: "Offer Calculation",    detail: "Computing your max offer based on ARV formula" },
];

const PRICE_PRESETS = [
  { label: "$50k–$150k", min: 50000,  max: 150000 },
  { label: "$100k–$300k", min: 100000, max: 300000 },
  { label: "$200k–$500k", min: 200000, max: 500000 },
  { label: "$400k–$800k", min: 400000, max: 800000 },
];

type RunState =
  | { phase: "idle" }
  | { phase: "running"; jobId: string | null; startedAt: number }
  | { phase: "done"; result: Record<string, unknown> };

interface NewLead extends Lead {
  isNew?: boolean;
  phones?: string[];
}

function fmtPrice(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

export default function PipelinePage() {
  const [form, setForm] = useState({
    city: "",
    state: "GA",
    county: "",
    min_price: 100000,
    max_price: 400000,
    min_beds: 2,
    property_types: ["single_family"] as string[],
  });
  const [run, setRun]                   = useState<RunState>({ phase: "idle" });
  const [error, setError]               = useState("");
  const [newLeads, setNewLeads]         = useState<NewLead[]>([]);
  const [pulseActive, setPulseActive]   = useState(false);
  const baselineRef  = useRef<{ count: number; ids: Set<string> } | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevLeadIds  = useRef<Set<string>>(new Set());
  const phonesMapRef = useRef<Map<string, string[]>>(new Map());

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const toggleType = (t: string) =>
    set("property_types",
      form.property_types.includes(t)
        ? form.property_types.filter((x) => x !== t)
        : [...form.property_types, t]
    );

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopPolling(), []);

  const flashPulse = () => {
    setPulseActive(true);
    setTimeout(() => setPulseActive(false), 800);
  };

  const startPolling = (jobId: string | null, startedAt: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const [all, enrichedData] = await Promise.all([
          api.leads.list(undefined, 500),
          api.leads.listEnriched(),
        ]);

        const phonesMap = new Map(enrichedData.map((e) => [e.id, e.phones ?? []]));
        phonesMapRef.current = phonesMap;

        if (baselineRef.current) {
          const fresh = all.filter((l) => !baselineRef.current!.ids.has(l.id));
          const tagged: NewLead[] = fresh.map((l) => ({
            ...l,
            phones: phonesMap.get(l.id) ?? [],
            isNew: !prevLeadIds.current.has(l.id),
          }));

          const hadNew = tagged.some((l) => l.isNew);
          if (hadNew) flashPulse();
          prevLeadIds.current = new Set(fresh.map((l) => l.id));
          setNewLeads(tagged);

          if (hadNew) {
            setTimeout(() => setNewLeads((prev) => prev.map((l) => ({ ...l, isNew: false }))), 1500);
          }
        }

        if (jobId) {
          const { status, result } = await api.pipeline.status(jobId);
          if (status === "complete" && result) {
            stopPolling();
            setRun({ phase: "done", result });
            return;
          }
          if (status === "not_found" && Date.now() - startedAt > 600_000) {
            stopPolling();
            setRun({ phase: "done", result: {} });
          }
        } else if (Date.now() - startedAt > 600_000) {
          stopPolling();
          setRun({ phase: "done", result: {} });
        }
      } catch { /* swallow */ }
    }, 4000);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNewLeads([]);
    prevLeadIds.current = new Set();

    try {
      const existing = await api.leads.list(undefined, 500);
      baselineRef.current = { count: existing.length, ids: new Set(existing.map((l) => l.id)) };
    } catch {
      baselineRef.current = { count: 0, ids: new Set() };
    }

    try {
      const resp = await api.pipeline.run({
        city: form.city, state: form.state, county: form.county,
        min_price: form.min_price, max_price: form.max_price,
        min_beds: form.min_beds, property_types: form.property_types,
      });
      const startedAt = Date.now();
      setRun({ phase: "running", jobId: resp.job_id, startedAt });
      startPolling(resp.job_id, startedAt);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const selectClass = "w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none";
  const inputClass  = "w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass  = "block text-xs font-medium text-zinc-500 mb-1.5";

  // ── IDLE: buy-box form + always-visible stage preview ─────────────────────
  if (run.phase === "idle") {
    return (
      <div className="p-8 max-w-5xl mx-auto animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">Run Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Enter a county and your buy box — Acquire runs the 5-stage pipeline below automatically.
          </p>
        </div>

        {/* Always-visible stage preview */}
        <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-6 mb-6 shadow-sm animate-fade-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-md shadow-blue-500/25">
              <Zap size={13} className="text-white" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900">What runs when you click Find Deals</h2>
          </div>
          <div className="grid grid-cols-5 gap-2 relative">
            {/* Connecting line */}
            <div className="absolute top-6 left-[10%] right-[10%] h-px bg-gradient-to-r from-blue-200 via-cyan-200 to-emerald-200 -z-0" />
            {PIPELINE_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white to-blue-50 border border-blue-100 flex items-center justify-center shadow-sm mb-2">
                    <Icon size={18} className="text-blue-600" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-800 leading-tight">{step.label}</p>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{step.detail}</p>
                  <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-blue-100 text-blue-700 rounded-full w-4 h-4 flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {/* Location */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">Location</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>City</label>
                <input
                  required
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="e.g. Atlanta"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>County</label>
                <input
                  required
                  value={form.county}
                  onChange={(e) => set("county", e.target.value)}
                  placeholder="e.g. Fulton"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>State</label>
              <div className="relative">
                <select
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                  className={selectClass}
                >
                  {US_STATES.map(([abbr, name]) => (
                    <option key={abbr} value={abbr}>{abbr} — {name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Buy Box */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">Buy Box</h2>

            {/* Price presets */}
            <div>
              <label className={labelClass}>Price Range</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {PRICE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { set("min_price", p.min); set("max_price", p.max); }}
                    className={`py-2 text-xs rounded-lg font-medium transition-colors ${
                      form.min_price === p.min && form.max_price === p.max
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-50 border border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className={labelClass}>Min ($)</label>
                  <input
                    type="number"
                    value={form.min_price}
                    onChange={(e) => set("min_price", Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div className="text-zinc-300 mt-5">—</div>
                <div className="flex-1">
                  <label className={labelClass}>Max ($)</label>
                  <input
                    type="number"
                    value={form.max_price}
                    onChange={(e) => set("max_price", Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="text-xs text-blue-600 font-medium mt-2">
                {fmtPrice(form.min_price)} – {fmtPrice(form.max_price)}
              </p>
            </div>

            {/* Beds */}
            <div>
              <label className={labelClass}>Min Bedrooms</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set("min_beds", n)}
                    className={`w-10 h-10 text-sm rounded-lg font-semibold transition-colors ${
                      form.min_beds === n
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-50 border border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    {n}+
                  </button>
                ))}
              </div>
            </div>

            {/* Property types */}
            <div>
              <label className={labelClass}>Property Types</label>
              <div className="flex gap-2 flex-wrap">
                {PROPERTY_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleType(value)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                      form.property_types.includes(value)
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-50 border border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
          >
            <Play size={15} fill="currentColor" />
            Find Deals in {form.county || "this county"}, {form.state}
          </button>
        </form>
      </div>
    );
  }

  // ── RUNNING ────────────────────────────────────────────────────────────────
  if (run.phase === "running") {
    const elapsed  = Math.floor((Date.now() - run.startedAt) / 1000);
    const mins     = Math.floor(elapsed / 60);
    const secs     = elapsed % 60;
    const hasLeads = newLeads.length > 0;
    const hasOffers = newLeads.some((l) => l.offer_price);
    const hasDone   = newLeads.some((l) => l.status === "skip_traced");

    const stepStatus = (idx: number): "done" | "running" | "waiting" => {
      if (idx === 0) return hasLeads ? "done" : "running";
      if (idx === 1) return hasLeads ? (hasDone ? "done" : "running") : "waiting";
      if (idx === 2) return hasDone ? (hasOffers ? "done" : "running") : "waiting";
      if (idx === 3) return hasOffers ? "done" : hasDone ? "running" : "waiting";
      if (idx === 4) return hasOffers ? (hasDone ? "done" : "running") : "waiting";
      return "waiting";
    };

    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">Pipeline Running</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {form.city}, {form.state} &middot; {form.county} County
          </p>
        </div>

        {/* Pulse banner */}
        <div className={`relative mb-5 rounded-xl border overflow-hidden transition-all duration-300 ${
          pulseActive
            ? "border-green-400 bg-green-50 shadow-[0_0_20px_4px_rgba(74,222,128,0.35)]"
            : hasLeads
            ? "border-green-200 bg-green-50"
            : "border-zinc-200 bg-zinc-50"
        }`}>
          <div className="px-5 py-4 flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              hasLeads ? "bg-green-500 animate-pulse" : "bg-zinc-300 animate-pulse"
            }`} />
            <div>
              <p className={`text-sm font-semibold ${hasLeads ? "text-green-800" : "text-zinc-600"}`}>
                {hasLeads
                  ? `${newLeads.length} ${newLeads.length === 1 ? "property" : "properties"} found with owner contact info`
                  : `Searching ${form.county} County — working on it…`}
              </p>
              <p className={`text-xs mt-0.5 ${hasLeads ? "text-green-600" : "text-zinc-400"}`}>
                {hasLeads
                  ? `${newLeads.filter(l => (l.phones?.length ?? 0) > 0).length} with phone · ${newLeads.filter(l => l.offer_price).length} with offers`
                  : `${mins}m ${secs}s — scraping county records, skip tracing owners`}
              </p>
            </div>
            {hasLeads && <Zap size={16} className={`ml-auto text-green-500 ${pulseActive ? "animate-bounce" : ""}`} />}
          </div>
        </div>

        {/* Step progress */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-5">
          <div className="space-y-3.5">
            {PIPELINE_STEPS.map((step, i) => {
              const s = stepStatus(i);
              const Icon = step.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    s === "done"    ? "bg-green-50" :
                    s === "running" ? "bg-blue-50" : "bg-zinc-50"
                  }`}>
                    {s === "done"    ? <CheckCircle2 size={16} className="text-green-500" />
                   : s === "running" ? <Loader2 size={16} className="text-blue-500 animate-spin" />
                   :                   <Icon size={16} className="text-zinc-300" />}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${s === "waiting" ? "text-zinc-400" : "text-zinc-800"}`}>
                        {step.label}
                      </p>
                      {s === "running" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold animate-pulse">
                          running
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${s === "waiting" ? "text-zinc-300" : "text-zinc-400"}`}>
                      {step.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live lead feed */}
        {newLeads.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-5">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900 text-sm">Live Feed — {newLeads.length} leads</h3>
              <Link href="/leads" className="text-xs text-blue-600 hover:text-blue-700">View all →</Link>
            </div>
            <div className="divide-y divide-zinc-50">
              {newLeads.slice(0, 10).map((lead) => (
                <div
                  key={lead.id}
                  className={`px-5 py-3 flex items-center justify-between transition-all duration-700 ${lead.isNew ? "bg-green-50" : "bg-white"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-800 truncate">{lead.address}</p>
                    <p className="text-xs text-zinc-400">{lead.city}, {lead.state}</p>
                    {(lead.phones?.length ?? 0) > 0 && (
                      <p className="text-xs text-blue-600 font-medium mt-0.5">{lead.phones![0]}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    {lead.offer_price ? (
                      <>
                        <p className="text-sm font-bold text-green-700">{fmt$$(lead.offer_price)}</p>
                        <p className="text-[10px] text-zinc-400">ARV {fmt$$(lead.arv)}</p>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" /> analyzing
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {newLeads.length > 10 && (
                <div className="px-5 py-2.5 text-xs text-zinc-400 text-center">
                  +{newLeads.length - 10} more leads
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/leads" className="flex-1 text-center py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
            View Leads
          </Link>
          <button
            onClick={() => { stopPolling(); setRun({ phase: "idle" }); }}
            className="flex-1 py-2.5 text-sm font-medium border border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors"
          >
            Stop &amp; Start Over
          </button>
        </div>
      </div>
    );
  }

  // ── DONE ───────────────────────────────────────────────────────────────────
  const result   = run.result;
  const saved    = (result.saved       as number) ?? newLeads.length;
  const pursue   = (result.pursue      as number) ?? 0;
  const review   = (result.needs_review as number) ?? 0;

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Pipeline Complete</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{form.city}, {form.state} &middot; {form.county} County</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
            <CheckCircle2 size={18} className="text-green-500" />
          </div>
          <p className="font-semibold text-zinc-900">All steps complete</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-zinc-900">{saved}</p>
            <p className="text-xs text-zinc-500 mt-1">Leads saved</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-700">{pursue}</p>
            <p className="text-xs text-green-600 mt-1">Pursue</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-amber-700">{review}</p>
            <p className="text-xs text-amber-600 mt-1">Review</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/leads"
          className="flex-1 text-center py-3 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
          View All Leads
        </Link>
        <button
          onClick={() => setRun({ phase: "idle" })}
          className="flex-1 py-3 text-sm font-medium border border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors"
        >
          Run Another County
        </button>
      </div>
    </div>
  );
}
