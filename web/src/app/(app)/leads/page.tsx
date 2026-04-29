"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EnrichedLead, Lead, LeadStatus } from "@/lib/types";
import { fmt$$, STATUS_LABEL, STATUS_COLOR, PIPELINE_REC_STYLE } from "@/lib/utils";
import Link from "next/link";
import { Download, Phone, Search, User, Sparkles, Play, MapPin } from "lucide-react";

interface DemoRow {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  owner: string;
  phone: string;
  offer: number;
  arv: number;
  rec: "pursue" | "needs_review";
  status: LeadStatus;
}

const DEMO_LEADS: DemoRow[] = [
  { id: "dl1",  address: "3857 N High St",       city: "Atlanta",   state: "GA", zip: "30301", owner: "Maria Hernandez", phone: "(404) 555-0142", offer: 187_500, arv: 268_000, rec: "pursue", status: "outreach"       },
  { id: "dl2",  address: "1204 Maple Ridge Dr",  city: "Dallas",    state: "TX", zip: "75201", owner: "James Patel",     phone: "(214) 555-0188", offer: 142_000, arv: 205_000, rec: "pursue", status: "outreach"       },
  { id: "dl3",  address: "62 Oak Lane",          city: "Atlanta",   state: "GA", zip: "30308", owner: "Linda Goodwin",   phone: "(404) 555-0107", offer: 95_000,  arv: 138_000, rec: "needs_review", status: "analyzed" },
  { id: "dl4",  address: "991 Bayview Ave",      city: "Tampa",     state: "FL", zip: "33602", owner: "Marcus Chen",     phone: "(813) 555-0233", offer: 215_000, arv: 308_000, rec: "pursue", status: "negotiating"    },
  { id: "dl5",  address: "4421 W Pine St",       city: "Charlotte", state: "NC", zip: "28202", owner: "Tasha Williams",  phone: "(704) 555-0156", offer: 168_000, arv: 240_000, rec: "pursue", status: "outreach"       },
  { id: "dl6",  address: "707 Sunset Blvd",      city: "Phoenix",   state: "AZ", zip: "85001", owner: "Robert Kim",      phone: "(602) 555-0189", offer: 198_000, arv: 282_000, rec: "pursue", status: "skip_traced"    },
  { id: "dl7",  address: "857 Cedar Court",      city: "Atlanta",   state: "GA", zip: "30309", owner: "Devon Carter",    phone: "(404) 555-0211", offer: 178_500, arv: 255_000, rec: "pursue", status: "negotiating"    },
  { id: "dl8",  address: "2210 Lakeshore Dr",    city: "Tampa",     state: "FL", zip: "33606", owner: "Sofia Rossi",     phone: "(813) 555-0144", offer: 245_000, arv: 350_000, rec: "pursue", status: "under_contract" },
  { id: "dl9",  address: "118 Hillview Rd",      city: "Charlotte", state: "NC", zip: "28203", owner: "Aaron Brooks",    phone: "(704) 555-0177", offer: 156_000, arv: 223_000, rec: "pursue", status: "closed"         },
  { id: "dl10", address: "78 Riverside Pl",      city: "Atlanta",   state: "GA", zip: "30310", owner: "Olivia Martinez", phone: "(404) 555-0265", offer: 132_000, arv: 189_000, rec: "pursue", status: "outreach"       },
  { id: "dl11", address: "412 Elm Way",          city: "Atlanta",   state: "GA", zip: "30312", owner: "Carlos Diaz",     phone: "(404) 555-0148", offer: 124_500, arv: 178_000, rec: "pursue", status: "skip_traced"    },
  { id: "dl12", address: "1501 Bay Pl",          city: "Tampa",     state: "FL", zip: "33611", owner: "Sofia Romero",    phone: "(813) 555-0298", offer: 198_000, arv: 282_000, rec: "pursue", status: "negotiating"    },
];

const STATUSES: Array<LeadStatus | "all"> = [
  "all", "new", "enriched", "skip_traced", "analyzed",
  "outreach", "negotiating", "under_contract", "dead", "closed",
];

const PIPELINE_STATUSES: LeadStatus[] = [
  "new", "skip_traced", "enriched", "analyzed",
  "outreach", "negotiating", "under_contract", "dead", "closed",
];

const SOURCE_LABEL: Record<string, string> = {
  county_records: "County Records",
  zillow: "Zillow",
  craigslist: "Craigslist",
};

export default function LeadsPage() {
  const [leads, setLeads]             = useState<Lead[]>([]);
  const [enriched, setEnriched]       = useState<EnrichedLead[]>([]);
  const [filter, setFilter]           = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch]           = useState("");
  const [loading, setLoading]         = useState(true);
  const [exporting, setExporting]     = useState(false);
  const [updatingId, setUpdatingId]   = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.leads.list(undefined, 500), api.leads.listEnriched()])
      .then(([all, enr]) => { setLeads(all); setEnriched(enr); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = async (id: string, newStatus: LeadStatus) => {
    setUpdatingId(id);
    try {
      await api.leads.updateStatus(id, newStatus);
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: newStatus } : l));
    } catch { /* swallow */ } finally {
      setUpdatingId(null);
    }
  };

  const enrichedById = new Map(enriched.map((e) => [e.id, e]));
  const sources = Array.from(new Set(leads.map((l) => l.source)));

  // Only show leads that have a phone number AND an offer calculated
  const actionable = leads.filter((l) => {
    const contact = enrichedById.get(l.id);
    return (contact?.phones ?? []).length > 0 && l.offer_price != null;
  });
  const isDemo = !loading && actionable.length === 0;
  const demoFiltered = isDemo
    ? DEMO_LEADS.filter((l) => {
        if (filter !== "all" && l.status !== filter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            l.address.toLowerCase().includes(q) ||
            `${l.city} ${l.state}`.toLowerCase().includes(q) ||
            l.owner.toLowerCase().includes(q) ||
            l.phone.includes(q)
          );
        }
        return true;
      })
    : [];

  const statusCounts = (isDemo ? DEMO_LEADS : actionable).reduce<Partial<Record<LeadStatus, number>>>((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  const visible = actionable.filter((l) => {
    if (filter !== "all" && l.status !== filter) return false;
    if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const enr = enrichedById.get(l.id);
      return (
        l.address.toLowerCase().includes(q) ||
        `${l.city} ${l.state}`.toLowerCase().includes(q) ||
        (l.owner_name ?? "").toLowerCase().includes(q) ||
        (enr?.phones ?? []).some((p) => p.includes(q))
      );
    }
    return true;
  });

  const handleExport = async () => {
    setExporting(true);
    try { await api.leads.exportCsv(filter === "all" ? undefined : filter); }
    catch { /* */ } finally { setExporting(false); }
  };

  const totalCount = isDemo ? DEMO_LEADS.length : actionable.length;
  const shownCount = isDemo ? demoFiltered.length : visible.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">Leads</h1>
            {isDemo && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Demo Data
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">
            {totalCount} qualified · {shownCount} shown
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || shownCount === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white/70 backdrop-blur-md border border-white/60 rounded-lg hover:border-zinc-300 disabled:opacity-50 transition-colors"
        >
          <Download size={14} />
          {exporting ? "Exporting…" : "Download CSV"}
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search address or owner…"
              className="pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          {sources.length > 1 && (
            <div className="flex gap-1.5">
              {["all", ...sources].map((src) => (
                <button key={src} onClick={() => setSourceFilter(src)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    sourceFilter === src
                      ? "bg-zinc-900 text-white"
                      : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300"
                  }`}>
                  {src === "all" ? "All Sources" : (SOURCE_LABEL[src] ?? src)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map((s) => {
            const count = s === "all" ? actionable.length : (statusCounts[s as LeadStatus] ?? 0);
            return (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  filter === s
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}>
                {s === "all" ? "All" : STATUS_LABEL[s as LeadStatus]}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    filter === s ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-400">Loading…</div>
        ) : isDemo ? (
          demoFiltered.length === 0 ? (
            <div className="text-center text-sm text-zinc-400 py-12">No leads match this filter.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {demoFiltered.map((d) => {
                const rec = PIPELINE_REC_STYLE[d.rec];
                const margin = d.arv - d.offer;
                const marginPct = Math.round((margin / d.arv) * 100);
                return (
                  <Link
                    key={d.id}
                    href="/pipeline"
                    className="group relative bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-5 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-0.5 transition-all"
                  >
                    {/* Stage chip */}
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${STATUS_COLOR[d.status]}`}>
                        {STATUS_LABEL[d.status]}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${rec.className}`}>
                        {rec.label}
                      </span>
                    </div>

                    {/* Address */}
                    <p className="font-semibold text-zinc-900 leading-tight mb-0.5">{d.address}</p>
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mb-4">
                      <MapPin size={10} className="text-zinc-400" />
                      {d.city}, {d.state} {d.zip}
                    </p>

                    {/* Offer & ARV row */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-2.5">
                        <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wide">Your Offer</p>
                        <p className="text-base font-bold text-emerald-700">{fmt$$(d.offer)}</p>
                      </div>
                      <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-2.5">
                        <p className="text-[10px] text-blue-700 font-semibold uppercase tracking-wide">ARV</p>
                        <p className="text-base font-bold text-blue-700">{fmt$$(d.arv)}</p>
                      </div>
                    </div>

                    {/* Margin bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                        <span>Spread (ARV − offer)</span>
                        <span className="font-semibold text-zinc-700">{fmt$$(margin)} · {marginPct}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
                          style={{ width: `${Math.min(100, marginPct * 2)}%` }}
                        />
                      </div>
                    </div>

                    {/* Owner row */}
                    <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {d.owner.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-800 truncate">{d.owner}</p>
                          <p className="text-[10px] text-blue-600 font-medium">{d.phone}</p>
                        </div>
                      </div>
                      <button className="text-[10px] font-bold uppercase tracking-wide bg-gradient-to-br from-blue-600 to-emerald-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all">
                        Open
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        ) : visible.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Search size={26} className="text-white" />
            </div>
            <p className="font-semibold text-zinc-800 mb-1">No leads match this filter</p>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">Try clearing the search or switching tabs.</p>
          </div>
        ) : (
          <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Property</th>
                <th className="px-5 py-3 font-medium">Owner</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Offer / ARV</th>
                <th className="px-5 py-3 font-medium">Recommendation</th>
                <th className="px-5 py-3 font-medium">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {visible.map((lead) => {
                const rec = lead.pipeline_recommendation ? PIPELINE_REC_STYLE[lead.pipeline_recommendation] : null;
                const contact = enrichedById.get(lead.id);
                return (
                  <tr key={lead.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-zinc-900 hover:text-blue-600">
                        {lead.address}
                      </Link>
                      <p className="text-xs text-zinc-400 mt-0.5">{lead.city}, {lead.state} {lead.zip}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                          <User size={11} className="text-blue-500" />
                        </div>
                        <span className="text-sm text-zinc-800">
                          {lead.owner_name ?? contact?.owner_name ?? <span className="text-zinc-400 italic">—</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {contact && contact.phones.length > 0 ? (
                        <div className="space-y-0.5">
                          {contact.phones.slice(0, 2).map((p) => (
                            <div key={p} className="flex items-center gap-1.5">
                              <Phone size={11} className="text-zinc-400 flex-shrink-0" />
                              <a href={`tel:${p}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium">{p}</a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {lead.offer_price ? (
                        <>
                          <p className="font-semibold text-zinc-900">{fmt$$(lead.offer_price)}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">ARV {fmt$$(lead.arv)}</p>
                        </>
                      ) : <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {rec ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rec.className}`}>{rec.label}</span>
                      ) : <span className="text-xs text-zinc-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={lead.status}
                        disabled={updatingId === lead.id}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${STATUS_COLOR[lead.status]} ${updatingId === lead.id ? "opacity-50" : ""}`}
                      >
                        {PIPELINE_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {isDemo && (
        <div className="mt-6 bg-gradient-to-br from-blue-50/80 to-emerald-50/80 backdrop-blur-sm border border-blue-200/60 rounded-2xl p-5 flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900">These are sample leads</p>
              <p className="text-xs text-zinc-600 mt-0.5">Run a real campaign to fill this table with off-market owners from your county.</p>
            </div>
          </div>
          <Link
            href="/pipeline"
            className="bg-gradient-to-br from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg hover:scale-[1.02] flex items-center gap-2"
          >
            <Play size={13} fill="currentColor" /> Run Real Campaign
          </Link>
        </div>
      )}
    </div>
  );
}
