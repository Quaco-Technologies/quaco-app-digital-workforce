"use client";

import { useState } from "react";
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
} from "lucide-react";
import type { SkipTraceResult } from "@/lib/apify";
import BuyBoxSearch, {
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

type Tab = "buybox" | "lookup";

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
      </div>

      {tab === "buybox" ? <BuyBoxSearch /> : <LookupTab />}
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
