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

export const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400";
export const csvBtnCls =
  "flex items-center gap-2 text-sm font-medium text-slate-700 border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors";

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

interface BuyBoxData {
  found: number;
  scanned: number;
  capped: boolean;
  traced: number;
  leads: BuyBoxLead[];
}

// maxTrace bounds how many owners a single run will skip trace. The public,
// no-login page passes a low number because every trace costs real money and
// anyone with the link can run it.
export default function BuyBoxSearch({ maxTrace = 100 }: { maxTrace?: number }) {
  const [area, setArea] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [bedsMin, setBedsMin] = useState("");
  const [bathsMin, setBathsMin] = useState("");
  const [limit, setLimit] = useState(Math.min(25, maxTrace));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BuyBoxData | null>(null);

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  const run = async () => {
    if (!area.trim()) {
      setError("Enter an area — a city and state, or a ZIP code.");
      return;
    }
    setError(null);
    setLoading(true);
    setData(null);
    try {
      const res = await fetch("/api/buybox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area,
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
      if (!json.leads.length) setError("No matching properties found for that buy box.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(
      `birdog-buybox-${data.leads.length}-leads.csv`,
      [
        "Address", "City", "State", "Zip", "Price", "Beds", "Baths", "Sqft",
        "Owner Name", "Owner Age", "Owner Mailing Address", "Phones", "Emails", "Listing", "Photo",
      ],
      data.leads.map((l) => [
        l.street, l.city, l.state, l.zip, l.price || "", l.beds || "", l.baths || "", l.sqft || "",
        l.owner ? `${l.owner.firstName} ${l.owner.lastName}`.trim() : "",
        l.owner?.age ?? "", l.owner?.address ?? "",
        phonesText(l.owner), emailsText(l.owner), l.url, l.imgSrc,
      ])
    );
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Area</label>
        <div className="relative">
          <MapPin size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Atlanta, GA  ·  or a ZIP like 30303"
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Field label="Price min">
            <input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="50000" className={inputCls} />
          </Field>
          <Field label="Price max">
            <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="400000" className={inputCls} />
          </Field>
          <Field label="Beds min">
            <input type="number" value={bedsMin} onChange={(e) => setBedsMin(e.target.value)} placeholder="3" className={inputCls} />
          </Field>
          <Field label="Baths min">
            <input type="number" value={bathsMin} onChange={(e) => setBathsMin(e.target.value)} placeholder="2" className={inputCls} />
          </Field>
        </div>

        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Trace up to
            <input
              type="number"
              min={1}
              max={maxTrace}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(maxTrace, Number(e.target.value) || 1)))}
              className="w-16 rounded-md border border-slate-200 px-2 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            owners
          </label>
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
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{data.leads.length}</span> properties shown
              {" · "}
              <span className="font-medium text-slate-900">{data.traced}</span> with phone numbers
              {data.found > data.leads.length && (
                <span className="text-slate-400">
                  {" · "}
                  {data.found}
                  {data.capped ? "+" : ""} matched your buy box
                </span>
              )}
            </p>
            <button onClick={exportCsv} className={csvBtnCls}>
              <Download size={15} />
              Download CSV
            </button>
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
                        <ContactList icon={Phone} items={l.owner.phones.map((p) => `${p.number}${p.type ? ` · ${p.type}` : ""}`)} empty="No phones" />
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
      )}
    </>
  );
}
