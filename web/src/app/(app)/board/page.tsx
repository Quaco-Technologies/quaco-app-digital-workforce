"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { EnrichedLead, Lead, LeadStatus } from "@/lib/types";
import { fmt$$, STATUS_LABEL, PIPELINE_REC_STYLE } from "@/lib/utils";
import { Phone, MapPin, Loader2, Filter, LayoutGrid } from "lucide-react";

const COLUMNS: Array<{ key: LeadStatus; accent: string }> = [
  { key: "skip_traced",    accent: "border-t-blue-500"    },
  { key: "analyzed",       accent: "border-t-yellow-500"  },
  { key: "outreach",       accent: "border-t-orange-500"  },
  { key: "negotiating",    accent: "border-t-blue-500"  },
  { key: "under_contract", accent: "border-t-emerald-500" },
  { key: "closed",         accent: "border-t-green-600"   },
];

export default function BoardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [enriched, setEnriched] = useState<EnrichedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [pursueOnly, setPursueOnly] = useState(false);

  useEffect(() => {
    Promise.all([api.leads.list(undefined, 500), api.leads.listEnriched()])
      .then(([l, e]) => { setLeads(l); setEnriched(e); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const enrichedById = new Map(enriched.map((e) => [e.id, e]));
  const visible = leads.filter((l) => {
    if (pursueOnly && l.pipeline_recommendation !== "pursue") return false;
    return true;
  });

  const grouped = COLUMNS.reduce<Record<string, Lead[]>>((acc, col) => {
    acc[col.key] = visible.filter((l) => l.status === col.key);
    return acc;
  }, {});

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <LayoutGrid size={22} /> Pipeline Board
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Every lead, grouped by what stage of the deal it's in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPursueOnly((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
              pursueOnly
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <Filter size={12} /> Pursue only
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 size={20} className="text-zinc-300 animate-spin mx-auto" /></div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map(({ key, accent }) => {
              const items = grouped[key] ?? [];
              return (
                <div key={key} className="w-72 flex-shrink-0">
                  <div className={`bg-white border-t-4 ${accent} border border-zinc-200 rounded-t-xl px-4 py-3`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-zinc-900">{STATUS_LABEL[key]}</h3>
                      <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    </div>
                  </div>
                  <div className="bg-zinc-50/60 border-x border-b border-zinc-200 rounded-b-xl p-2 space-y-2 min-h-[400px]">
                    {items.length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-8">No leads</p>
                    ) : (
                      items.slice(0, 25).map((lead) => {
                        const contact = enrichedById.get(lead.id);
                        const rec = lead.pipeline_recommendation
                          ? PIPELINE_REC_STYLE[lead.pipeline_recommendation]
                          : null;
                        return (
                          <Link
                            key={lead.id}
                            href={`/leads/${lead.id}`}
                            className="block bg-white border border-zinc-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <p className="text-sm font-semibold text-zinc-900 leading-tight line-clamp-2">
                                {lead.address}
                              </p>
                              {rec && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${rec.className}`}>
                                  {rec.label}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 flex items-center gap-1 mb-2">
                              <MapPin size={9} />
                              {lead.city}, {lead.state}
                            </p>
                            {lead.offer_price && (
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-zinc-400 uppercase tracking-wide">Offer</span>
                                <span className="text-sm font-bold text-emerald-700">{fmt$$(lead.offer_price)}</span>
                              </div>
                            )}
                            {contact?.phones && contact.phones.length > 0 && (
                              <div className="flex items-center gap-1 text-[11px] text-zinc-600 pt-1.5 border-t border-zinc-100">
                                <Phone size={9} className="text-zinc-400" />
                                <span className="truncate">{contact.owner_name ?? "Owner"}</span>
                              </div>
                            )}
                          </Link>
                        );
                      })
                    )}
                    {items.length > 25 && (
                      <p className="text-[11px] text-center text-zinc-400 pt-2">
                        + {items.length - 25} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
