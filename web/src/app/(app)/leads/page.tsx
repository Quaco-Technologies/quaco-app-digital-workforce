"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EnrichedLead, Lead, LeadStatus } from "@/lib/types";
import { fmt$$, STATUS_LABEL, STATUS_COLOR, PIPELINE_REC_STYLE } from "@/lib/utils";
import Link from "next/link";
import { Download, Phone, Search, User } from "lucide-react";

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

  const statusCounts = actionable.reduce<Partial<Record<LeadStatus, number>>>((acc, l) => {
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Leads</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {actionable.length} qualified · {visible.length} shown
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || visible.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 disabled:opacity-50 transition-colors"
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

      <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-400">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Search size={26} className="text-white" />
            </div>
            <p className="font-semibold text-zinc-800 mb-1">
              {actionable.length === 0 ? "No qualified leads yet" : "No leads match this filter"}
            </p>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-5">
              {actionable.length === 0
                ? "Run a pipeline on a county and we'll surface off-market owners with phone numbers and offer prices."
                : "Try clearing the search or switching tabs."}
            </p>
            {actionable.length === 0 && (
              <Link
                href="/pipeline"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg hover:scale-[1.02]"
              >
                Run your first pipeline →
              </Link>
            )}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
