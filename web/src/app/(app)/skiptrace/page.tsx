"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  Download,
  Phone,
  Mail,
  MapPin,
  User,
  AlertCircle,
  Target,
  Home,
  ExternalLink,
  Clock,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import type { SkipTraceResult } from "@/lib/apify";
import BuyBoxSearch, {
  BuyBoxResults,
  type BuyBoxData,
  downloadCsv,
  phonesText,
  emailsText,
  Banner,
  ContactList,
  csvBtnCls,
} from "@/components/BuyBoxSearch";

/* ================================================================== */
/* Page                                                               */
/* ================================================================== */

type Tab = "buybox" | "lookup" | "history";

export default function SkipTracePage() {
  const [tab, setTab] = useState<Tab>("buybox");

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Skip Trace</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter your buy box and get owner contact info for every matching property — or look up a
          single address.
        </p>
      </div>

      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("buybox")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
            tab === "buybox" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Target size={14} strokeWidth={1.75} />
          Buy Box
        </button>
        <button
          onClick={() => setTab("lookup")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
            tab === "lookup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Search size={14} strokeWidth={1.75} />
          Single Lookup
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
            tab === "history" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Clock size={14} strokeWidth={1.75} />
          History
        </button>
      </div>

      {tab === "buybox" && <BuyBoxSearch canSave />}
      {tab === "lookup" && <LookupTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}

/* ================================================================== */
/* History — past searches, reopened into the same results view       */
/* ================================================================== */

interface SearchSummary {
  id: string;
  area: string | null;
  found: number;
  traced: number;
  lead_count: number;
  created_at: string;
}

function HistoryTab() {
  const [searches, setSearches] = useState<SearchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BuyBoxData | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/searches");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't load history.");
        setSearches(json.searches);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, []);

  const open = async (id: string) => {
    setOpening(id);
    setError(null);
    try {
      const res = await fetch(`/api/searches/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't open that search.");
      setSelected(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOpening(null);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });

  // Viewing one past search — same cards, same CSV as a live run.
  if (selected) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 mb-1 transition-colors"
        >
          <ArrowLeft size={13} /> Back to history
        </button>
        <p className="text-sm text-slate-500">
          {selected.area}
          {selected.area ? " · " : ""}saved search
        </p>
        <BuyBoxResults data={selected} />
      </div>
    );
  }

  if (error) return <Banner>{error}</Banner>;
  if (!searches) return <p className="text-sm text-slate-400">Loading your searches…</p>;
  if (!searches.length)
    return (
      <div className="text-center py-12">
        <Clock size={28} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">No saved searches yet.</p>
        <p className="text-xs text-slate-400 mt-1">Run a buy box search and it&apos;ll show up here.</p>
      </div>
    );

  return (
    <div className="space-y-2">
      {searches.map((s) => (
        <button
          key={s.id}
          onClick={() => open(s.id)}
          disabled={opening === s.id}
          className="w-full flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm hover:border-slate-300 hover:shadow transition-all text-left"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {s.area || "Buy box search"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {s.lead_count} callable {s.lead_count === 1 ? "lead" : "leads"}
              {s.found > 0 && ` · ${s.found} matched`} · {fmtDate(s.created_at)}
            </p>
          </div>
          {opening === s.id ? (
            <Loader2 size={16} className="animate-spin text-slate-400 shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-slate-400 shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}

/* ================================================================== */
/* Single Lookup (secondary)                                          */
/* ================================================================== */

type Mode = "address" | "name" | "phone" | "email";

const MODES: { value: Mode; label: string; icon: typeof Search; placeholder: string; hint: string }[] = [
  { value: "address", label: "Address", icon: MapPin, placeholder: "3828 Double Oak Ln; Irving, TX 75061", hint: "One per line — street; city, state zip" },
  { value: "name", label: "Name", icon: User, placeholder: "James E Whitsitt; Dallas, TX 75228", hint: "One per line — full name; city, state zip" },
  { value: "phone", label: "Phone", icon: Phone, placeholder: "(214) 609-3137", hint: "One phone number per line" },
  { value: "email", label: "Email", icon: Mail, placeholder: "owner@example.com", hint: "One email address per line" },
];

function LookupTab() {
  const [mode, setMode] = useState<Mode>("address");
  const [text, setText] = useState("");
  const [maxResults, setMaxResults] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SkipTraceResult[] | null>(null);

  const active = MODES.find((m) => m.value === mode)!;

  const run = async () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      setError(`Enter at least one ${active.label.toLowerCase()} to skip trace.`);
      return;
    }
    setError(null);
    setLoading(true);
    setResults(null);
    const body: Record<string, unknown> = { max_results: maxResults };
    if (mode === "address") body.street_citystatezip = lines;
    if (mode === "name") body.name = lines;
    if (mode === "phone") body.phone_number = lines;
    if (mode === "email") body.email = lines;
    try {
      const res = await fetch("/api/skiptrace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Skip trace failed.");
      setResults(json.results as SkipTraceResult[]);
      if (!json.results.length) setError("No matches found for that search.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!results) return;
    downloadCsv(
      `birdog-skiptrace-${results.length}-results.csv`,
      ["Input", "First Name", "Last Name", "Age", "Lives In", "Address", "County", "Phones", "Emails"],
      results.map((r) => [
        r.inputGiven, r.firstName, r.lastName, r.age, r.livesIn, r.address, r.county,
        phonesText(r), emailsText(r),
      ])
    );
  };

  return (
    <>
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
        {MODES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              mode === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Icon size={14} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={active.placeholder}
          rows={4}
          className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        />
        <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
          <p className="text-xs text-slate-400">{active.hint}</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Max per search
              <input
                type="number"
                min={1}
                max={20}
                value={maxResults}
                onChange={(e) => setMaxResults(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-14 rounded-md border border-slate-200 px-2 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </label>
            <button
              onClick={run}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              {loading ? "Tracing…" : "Skip Trace"}
            </button>
          </div>
        </div>
      </div>

      {error && <Banner>{error}</Banner>}

      {results && results.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-700">
              {results.length} result{results.length === 1 ? "" : "s"}
            </p>
            <button onClick={exportCsv} className={csvBtnCls}>
              <Download size={15} />
              Download CSV
            </button>
          </div>
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {[r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown"}
                      {r.age && <span className="ml-2 text-sm font-normal text-slate-400">Age {r.age}</span>}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">{r.address || r.livesIn}</p>
                    {r.county && <p className="text-xs text-slate-400 mt-0.5">{r.county}</p>}
                  </div>
                  <p className="text-xs text-slate-400 max-w-[40%] text-right truncate" title={r.inputGiven}>
                    {r.inputGiven}
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 mt-4">
                  <ContactList icon={Phone} items={r.phones.map((p) => `${p.number}${p.type ? ` · ${p.type}` : ""}`)} empty="—" />
                  <ContactList icon={Mail} items={r.emails} empty="—" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
