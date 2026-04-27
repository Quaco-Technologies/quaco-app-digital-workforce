"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { CampaignLead, LeadStatus } from "@/lib/types";
import { fmt$$, STATUS_COLOR, STATUS_LABEL, PIPELINE_REC_STYLE } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Phone, Download, Search, Wrench, MessageCircle } from "lucide-react";

const INVESTMENT_LABEL: Record<string, string> = {
  fix_and_flip: "Fix & Flip",
  rental: "Rental",
  turnkey: "Turnkey",
  unknown: "",
};

const INVESTMENT_COLOR: Record<string, string> = {
  fix_and_flip: "bg-orange-50 text-orange-700",
  rental: "bg-blue-50 text-blue-700",
  turnkey: "bg-green-50 text-green-700",
};

const PIPELINE_STATUSES: LeadStatus[] = [
  "new", "skip_traced", "enriched", "analyzed",
  "outreach", "negotiating", "under_contract", "dead", "closed",
];

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [outreachStats, setOutreachStats] = useState<{ total: number; sent: number } | null>(null);

  useEffect(() => {
    api.campaigns.leads(id)
      .then(setLeads)
      .catch(() => {})
      .finally(() => setLoading(false));
    api.outreach.stats(id)
      .then(setOutreachStats)
      .catch(() => {});
  }, [id]);

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    setUpdatingId(leadId);
    try {
      await api.leads.updateStatus(leadId, newStatus);
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: newStatus } : l));
    } catch { /* */ } finally { setUpdatingId(null); }
  };

  const visible = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.address.toLowerCase().includes(q) ||
      `${l.city} ${l.state}`.toLowerCase().includes(q) ||
      (l.owner_name ?? "").toLowerCase().includes(q) ||
      l.phones.some((p) => p.includes(q))
    );
  });

  const handleExport = () => {
    const rows = [
      ["Owner", "Phone", "Email", "Address", "City", "State", "Zip", "ARV", "Offer", "Repair Est.", "Condition", "Investment Type", "Contacted"],
      ...visible.map((l) => [
        l.owner_name ?? "", l.phones[0] ?? "", l.emails[0] ?? "",
        l.address, l.city ?? "", l.state ?? "", l.zip ?? "",
        l.arv ?? "", l.offer_price ?? "", l.repair_estimate ?? "",
        l.photo_condition ?? "", l.investment_type ?? "",
        l.outreach_status === "contacted" ? "Yes" : "No",
      ]),
    ];
    const csv = rows.map((r) => r.map(String).map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leads.csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-5 transition-colors">
        <ArrowLeft size={14} /> Back to campaigns
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Leads</h1>
          <div className="flex items-center gap-4 mt-0.5">
            <p className="text-sm text-zinc-500">{leads.length} qualified · {visible.length} shown</p>
            {outreachStats && outreachStats.total > 0 && (
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {outreachStats.sent} contacted
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={visible.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 disabled:opacity-50 transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search address, owner, or phone…"
          className="pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-72"
        />
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-400">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">
            {leads.length === 0 ? "No qualified leads in this campaign yet." : "No leads match search."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Property</th>
                <th className="px-5 py-3 font-medium">Owner / Phone</th>
                <th className="px-5 py-3 font-medium">Offer</th>
                <th className="px-5 py-3 font-medium">Repair Est.</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Outreach</th>
                <th className="px-5 py-3 font-medium">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {visible.map((lead) => {
                const rec = lead.pipeline_recommendation ? PIPELINE_REC_STYLE[lead.pipeline_recommendation] : null;
                const typeLabel = lead.investment_type ? INVESTMENT_LABEL[lead.investment_type] : "";
                const typeColor = lead.investment_type ? INVESTMENT_COLOR[lead.investment_type] : "";
                const contacted = lead.outreach_status === "contacted";
                return (
                  <tr key={lead.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-zinc-900 hover:text-indigo-600">
                        {lead.address}
                      </Link>
                      <p className="text-xs text-zinc-400 mt-0.5">{lead.city}, {lead.state} {lead.zip}</p>
                      {lead.photo_condition && lead.photo_condition !== "unknown" && (
                        <p className="text-xs text-zinc-500 capitalize mt-0.5">Condition: {lead.photo_condition}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-zinc-800 text-sm">{lead.owner_name ?? "—"}</p>
                      {lead.phones.slice(0, 2).map((p) => (
                        <a key={p} href={`tel:${p}`} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-0.5">
                          <Phone size={10} /> {p}
                        </a>
                      ))}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-zinc-900">{fmt$$(lead.offer_price)}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">ARV {fmt$$(lead.arv)}</p>
                      {rec && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 inline-block ${rec.className}`}>
                          {rec.label}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {lead.repair_estimate ? (
                        <div className="flex items-center gap-1.5">
                          <Wrench size={12} className="text-zinc-400" />
                          <span className="font-medium text-zinc-700">{fmt$$(lead.repair_estimate)}</span>
                        </div>
                      ) : <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {typeLabel && typeColor ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>{typeLabel}</span>
                      ) : <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {contacted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <MessageCircle size={10} /> Contacted
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={lead.status}
                        disabled={updatingId === lead.id}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 ${STATUS_COLOR[lead.status]} ${updatingId === lead.id ? "opacity-50" : ""}`}
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
