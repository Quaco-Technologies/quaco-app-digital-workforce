"use client";

import { useState } from "react";
import {
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
  Check,
  ChevronDown,
} from "lucide-react";
import type { SkipTraceResult, BuyBoxLead } from "@/lib/apify";

/* ------------------------------------------------------------------ */
/* Shared helpers — also used by the authenticated Skip Trace page      */
/* ------------------------------------------------------------------ */

const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const phonesText = (o: SkipTraceResult | null) =>
  o?.phones.map((p) => `${p.number}${p.type ? ` (${p.type})` : ""}`).join("; ") ?? "";
export const emailsText = (o: SkipTraceResult | null) => o?.emails.join("; ") ?? "";

// Phones and emails get one column each rather than a single crammed cell, so
// the sheet can be sorted, filtered, and fed to a dialer. Column count follows
// the widest row in this result set so there are no empty trailing columns.
export function buildContactColumns(leads: BuyBoxLead[]) {
  const maxPhones = Math.max(1, ...leads.map((l) => l.owner?.phones.length ?? 0));
  const maxEmails = Math.max(0, ...leads.map((l) => l.owner?.emails.length ?? 0));

  const headers: string[] = [];
  for (let i = 0; i < maxPhones; i++) {
    const name = i === 0 ? "Primary Phone" : i === 1 ? "Secondary Phone" : `Phone ${i + 1}`;
    headers.push(name, `${name} Type`, `${name} Last Reported`);
  }
  for (let i = 0; i < maxEmails; i++) headers.push(`Email ${i + 1}`);

  const cells = (l: BuyBoxLead): string[] => {
    const out: string[] = [];
    for (let i = 0; i < maxPhones; i++) {
      const p = l.owner?.phones[i];
      // The Primary/Secondary ranking is already carried by the column name, so
      // this column stays what it says it is: Wireless or Landline.
      out.push(
        p?.number ?? "",
        p?.type ?? "",
        p?.lastReported.replace(/^Last reported\s*/i, "") ?? ""
      );
    }
    for (let i = 0; i < maxEmails; i++) out.push(l.owner?.emails[i] ?? "");
    return out;
  };

  return { headers, cells };
}

export const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400";
// appearance-none strips the clunky native arrow; we draw our own chevron.
export const selectCls =
  "w-full appearance-none rounded-lg border border-slate-200 pl-3 pr-9 py-2 text-sm text-slate-900 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 cursor-pointer transition-colors";

// A native select styled to match the text inputs, with our own chevron.
export function Dropdown({
  value,
  onChange,
  children,
  leftIcon,
}: {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {leftIcon}
        </span>
      )}
      <select value={value} onChange={onChange} className={`${selectCls} ${leftIcon ? "pl-9" : ""}`}>
        {children}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}
export const csvBtnCls =
  "flex items-center gap-2 text-sm font-medium text-slate-700 border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors";

// Preset options so investors pick from a list instead of typing. Values are
// strings (empty = no limit) to match the form state and the num() parser.
const POPULAR_MARKETS = [
  "Atlanta, GA", "Dallas, TX", "Houston, TX", "San Antonio, TX", "Phoenix, AZ",
  "Tampa, FL", "Jacksonville, FL", "Orlando, FL", "Charlotte, NC", "Memphis, TN",
  "Nashville, TN", "Birmingham, AL", "Cleveland, OH", "Columbus, OH",
  "Indianapolis, IN", "Kansas City, MO", "Oklahoma City, OK", "Detroit, MI",
  "St. Louis, MO", "Las Vegas, NV",
];
const PRICE_MIN_OPTS: [string, string][] = [
  ["", "No min"], ["50000", "$50k"], ["100000", "$100k"], ["150000", "$150k"],
  ["200000", "$200k"], ["250000", "$250k"], ["300000", "$300k"], ["400000", "$400k"],
  ["500000", "$500k"], ["750000", "$750k"],
];
const PRICE_MAX_OPTS: [string, string][] = [
  ["", "No max"], ["100000", "$100k"], ["150000", "$150k"], ["200000", "$200k"],
  ["250000", "$250k"], ["300000", "$300k"], ["400000", "$400k"], ["500000", "$500k"],
  ["750000", "$750k"], ["1000000", "$1M"], ["2000000", "$2M+"],
];
const BEDS_OPTS: [string, string][] = [
  ["", "Any"], ["1", "1+"], ["2", "2+"], ["3", "3+"], ["4", "4+"], ["5", "5+"],
];
const BATHS_OPTS: [string, string][] = [
  ["", "Any"], ["1", "1+"], ["2", "2+"], ["3", "3+"], ["4", "4+"],
];

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      <AlertCircle size={15} />
      {children}
    </div>
  );
}

export function ContactList({
  icon: Icon,
  items,
  empty,
}: {
  icon: typeof Phone;
  items: string[];
  empty: string;
}) {
  if (!items.length) return <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <ul className="space-y-1">
      {items.map((it, j) => (
        <li key={j} className="text-sm text-slate-700 flex items-center gap-2">
          <Icon size={13} className="text-slate-400 shrink-0" />
          {it}
        </li>
      ))}
    </ul>
  );
}

/* ================================================================== */
/* Buy box search — form, results list, CSV export                    */
/* ================================================================== */

export interface BuyBoxData {
  area?: string;
  found: number;
  scanned: number;
  capped: boolean;
  traced: number;
  paid?: number;
  cached?: number;
  noPhone: number;
  leads: BuyBoxLead[];
}

// maxTrace bounds how many owners a single run will skip trace. The public,
// no-login page passes a low number because every trace costs real money and
// anyone with the link can run it.
export default function BuyBoxSearch({
  maxTrace = 100,
  canSave = false,
}: {
  maxTrace?: number;
  // Only shown to signed-in investors — the public link has no account to save to.
  canSave?: boolean;
}) {
  const [source, setSource] = useState<"forsale" | "offmarket">("offmarket");
  const [area, setArea] = useState("");
  // Area is a dropdown of popular markets; picking "Other" reveals a text box
  // so any city or ZIP still works.
  const [customArea, setCustomArea] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [bedsMin, setBedsMin] = useState("");
  const [bathsMin, setBathsMin] = useState("");
  const [limit, setLimit] = useState(Math.min(25, maxTrace));

  // Lead-count choices, capped to what this context allows.
  const countOpts = [5, 10, 25, 50, 100].filter((n) => n <= maxTrace);
  if (!countOpts.includes(maxTrace)) countOpts.push(maxTrace);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BuyBoxData | null>(null);
  // For signed-in investors every search is saved to history automatically.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const autoSave = async (result: BuyBoxData) => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: result.area,
          params: { source, priceMin, priceMax, bedsMin, bathsMin, limit },
          found: result.found,
          traced: result.traced,
          leads: result.leads,
        }),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  };

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  const run = async () => {
    if (!area.trim()) {
      setError("Enter an area — a city and state, or a ZIP code.");
      return;
    }
    setError(null);
    setLoading(true);
    setData(null);
    setSaveState("idle");
    try {
      const res = await fetch("/api/buybox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area,
          source,
          priceMin: num(priceMin),
          priceMax: num(priceMax),
          bedsMin: num(bedsMin),
          bathsMin: num(bathsMin),
          limit,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Buy box search failed.");
      setData(json);
      if (!json.leads.length) {
        setError(
          json.traced > 0
            ? `Traced ${json.traced} owner${json.traced === 1 ? "" : "s"}, but none had a phone number on record. Try a different area or widen the buy box.`
            : "No matching properties found for that buy box."
        );
      } else if (canSave) {
        void autoSave(json); // fire-and-forget; the results are already shown
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        {/* Source toggle — off-market (distressed) vs on-market (for sale) */}
        <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setSource("offmarket")}
            className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              source === "offmarket" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Off-Market
          </button>
          <button
            type="button"
            onClick={() => setSource("forsale")}
            className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              source === "forsale" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            For Sale
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4 -mt-2">
          {source === "offmarket"
            ? "Distressed owners — foreclosure, pre-foreclosure, auction, bank-owned. Not on the open market."
            : "Active MLS listings currently for sale."}
        </p>

        <label className="block text-xs font-medium text-slate-500 mb-1.5">Area</label>
        <Dropdown
          value={customArea ? "__other__" : area}
          leftIcon={<MapPin size={15} />}
          onChange={(e) => {
            if (e.target.value === "__other__") {
              setCustomArea(true);
              setArea("");
            } else {
              setCustomArea(false);
              setArea(e.target.value);
            }
          }}
        >
          <option value="" disabled>
            Choose a market…
          </option>
          {POPULAR_MARKETS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value="__other__">Other — type a city or ZIP…</option>
        </Dropdown>
        {customArea && (
          <input
            value={area}
            autoFocus
            onChange={(e) => setArea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="e.g. Marfa, TX  ·  or a ZIP like 30303"
            className={`${inputCls} mt-2`}
          />
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Field label="Price min">
            <Dropdown value={priceMin} onChange={(e) => setPriceMin(e.target.value)}>
              {PRICE_MIN_OPTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </Dropdown>
          </Field>
          <Field label="Price max">
            <Dropdown value={priceMax} onChange={(e) => setPriceMax(e.target.value)}>
              {PRICE_MAX_OPTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </Dropdown>
          </Field>
          <Field label="Beds min">
            <Dropdown value={bedsMin} onChange={(e) => setBedsMin(e.target.value)}>
              {BEDS_OPTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </Dropdown>
          </Field>
          <Field label="Baths min">
            <Dropdown value={bathsMin} onChange={(e) => setBathsMin(e.target.value)}>
              {BATHS_OPTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </Dropdown>
          </Field>
        </div>

        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Give me</span>
            <div className="relative">
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="appearance-none rounded-md border border-slate-200 pl-2.5 pr-7 py-1.5 text-slate-900 bg-white cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
              >
                {countOpts.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <span>owners with phone numbers</span>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Target size={15} />}
            {loading ? "Finding owners…" : "Find Owners"}
          </button>
        </div>
        {loading && (
          <p className="text-xs text-slate-400 mt-3">
            Scraping listings, then skip tracing each owner — this can take a minute or two.
          </p>
        )}
      </div>

      {error && <Banner>{error}</Banner>}

      {data && data.leads.length > 0 && (
        <BuyBoxResults
          data={data}
          headerNote={
            canSave ? (
              <span className="flex items-center gap-1 text-xs">
                {saveState === "saving" && (
                  <>
                    <Loader2 size={12} className="animate-spin text-slate-400" />
                    <span className="text-slate-400">Saving to history…</span>
                  </>
                )}
                {saveState === "saved" && (
                  <>
                    <Check size={12} className="text-emerald-600" />
                    <span className="text-emerald-600">Saved to history</span>
                  </>
                )}
                {saveState === "error" && (
                  <span className="text-amber-600">Not saved to history</span>
                )}
              </span>
            ) : null
          }
        />
      )}
    </>
  );
}

/* ================================================================== */
/* Results — shared by live search and saved history                  */
/* ================================================================== */

// Renders the counts line, CSV button, and property cards for a result set.
// Live search and reopened history both use this, so they look and export
// identically by construction.
export function BuyBoxResults({
  data,
  headerNote,
}: {
  data: BuyBoxData;
  headerNote?: React.ReactNode;
}) {
  const exportCsv = () => {
    const contact = buildContactColumns(data.leads);
    downloadCsv(
      `birdog-buybox-${data.leads.length}-leads.csv`,
      [
        "Address", "City", "State", "Zip", "Price", "Beds", "Baths", "Sqft",
        "Owner Name", "Owner Age", "Owner Mailing Address",
        ...contact.headers,
        "Listing", "Photo",
      ],
      data.leads.map((l) => [
        l.street, l.city, l.state, l.zip, l.price || "", l.beds || "", l.baths || "", l.sqft || "",
        l.owner ? `${l.owner.firstName} ${l.owner.lastName}`.trim() : "",
        l.owner?.age ?? "", l.owner?.address ?? "",
        ...contact.cells(l),
        l.url, l.imgSrc,
      ])
    );
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{data.leads.length}</span> owners you can call
          <span className="text-slate-400">
            {data.found > 0 && ` · ${data.found}${data.capped ? "+" : ""} matched your buy box`}
            {(data.cached ?? 0) > 0 && ` · ${data.cached} reused from cache (no charge)`}
          </span>
        </p>
        <div className="flex items-center gap-3">
          {headerNote}
          <button onClick={exportCsv} className={csvBtnCls}>
            <Download size={15} />
            Download CSV
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {data.leads.map((l, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-4">
              {l.imgSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.imgSrc}
                  alt={l.street}
                  loading="lazy"
                  className="w-28 h-24 sm:w-36 sm:h-28 object-cover rounded-lg bg-slate-100 shrink-0"
                />
              ) : (
                <div className="w-28 h-24 sm:w-36 sm:h-28 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Home size={20} className="text-slate-300" />
                </div>
              )}
              <div className="flex items-start justify-between gap-4 flex-wrap flex-1 min-w-0">
                <div className="min-w-0">
                  {l.distress && (
                    <span className="inline-block mb-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                      {l.distress}
                    </span>
                  )}
                  <p className="text-base font-semibold text-slate-900">{l.street}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {[l.city, l.state, l.zip].filter(Boolean).join(", ")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {l.priceText && <span className="font-medium text-slate-700">{l.priceText}</span>}
                    {l.beds ? ` · ${l.beds} bd` : ""}
                    {l.baths ? ` · ${l.baths} ba` : ""}
                    {l.sqft ? ` · ${l.sqft.toLocaleString()} sqft` : ""}
                  </p>
                </div>
                {l.url && (
                  <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 shrink-0">
                    Listing <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100">
              {l.owner && (l.owner.phones.length || l.owner.emails.length) ? (
                <div>
                  <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                    <User size={13} className="text-slate-400" />
                    {`${l.owner.firstName} ${l.owner.lastName}`.trim() || "Owner"}
                    {l.owner.age && <span className="text-xs font-normal text-slate-400">Age {l.owner.age}</span>}
                  </p>
                  <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 mt-2">
                    <ul className="space-y-1">
                      {l.owner.phones.map((p, j) => (
                        <li key={j} className="text-sm text-slate-700 flex items-center gap-2 flex-wrap">
                          <Phone size={13} className="text-slate-400 shrink-0" />
                          <a href={`tel:${p.number.replace(/[^\d+]/g, "")}`} className="font-medium hover:underline">
                            {p.number}
                          </a>
                          {p.label && (
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                p.label === "Primary"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : p.label === "Secondary"
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {p.label}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {p.type}
                            {/\d{4}/.test(p.lastReported)
                              ? ` · ${p.lastReported.replace(/^Last reported\s*/i, "")}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <ContactList icon={Mail} items={l.owner.emails} empty="No emails" />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No owner contact info found.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
