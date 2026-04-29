"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { EnrichedLead, Lead, LeadStatus } from "@/lib/types";
import { fmt$$, STATUS_LABEL, PIPELINE_REC_STYLE } from "@/lib/utils";
import { Phone, MapPin, Loader2, Filter, LayoutGrid, Sparkles } from "lucide-react";

interface ColumnDef {
  key: LeadStatus;
  accent: string;
  chipBg: string;
  chipFg: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "skip_traced",    accent: "from-sky-400 to-blue-500",      chipBg: "bg-sky-100",      chipFg: "text-sky-700"      },
  { key: "analyzed",       accent: "from-blue-400 to-cyan-500",     chipBg: "bg-blue-100",     chipFg: "text-blue-700"     },
  { key: "outreach",       accent: "from-cyan-400 to-teal-500",     chipBg: "bg-cyan-100",     chipFg: "text-cyan-700"     },
  { key: "negotiating",    accent: "from-teal-400 to-emerald-500",  chipBg: "bg-teal-100",     chipFg: "text-teal-700"     },
  { key: "under_contract", accent: "from-emerald-400 to-green-500", chipBg: "bg-emerald-100",  chipFg: "text-emerald-700"  },
  { key: "closed",         accent: "from-green-500 to-green-700",   chipBg: "bg-green-100",    chipFg: "text-green-800"    },
];

interface DemoCard {
  id: string;
  address: string;
  city: string;
  state: string;
  offer: number;
  owner: string;
  rec: "pursue" | "needs_review";
  isDemo: true;
}

const DEMO_BY_STATUS: Partial<Record<LeadStatus, DemoCard[]>> = {
  skip_traced: [
    { id: "ds1", address: "3857 N High St",      city: "Atlanta",   state: "GA", offer: 0,        owner: "Maria H.",   rec: "pursue", isDemo: true },
    { id: "ds2", address: "707 Sunset Blvd",     city: "Phoenix",   state: "AZ", offer: 0,        owner: "Robert K.",  rec: "pursue", isDemo: true },
    { id: "ds3", address: "412 Elm Way",         city: "Atlanta",   state: "GA", offer: 0,        owner: "Carlos D.",  rec: "pursue", isDemo: true },
  ],
  analyzed: [
    { id: "da1", address: "62 Oak Lane",         city: "Atlanta",   state: "GA", offer: 95_000,   owner: "Linda G.",   rec: "needs_review", isDemo: true },
    { id: "da2", address: "4421 W Pine St",      city: "Charlotte", state: "NC", offer: 168_000,  owner: "Tasha W.",   rec: "pursue", isDemo: true },
  ],
  outreach: [
    { id: "do1", address: "1204 Maple Ridge Dr", city: "Dallas",    state: "TX", offer: 142_000,  owner: "James P.",   rec: "pursue", isDemo: true },
    { id: "do2", address: "991 Bayview Ave",     city: "Tampa",     state: "FL", offer: 215_000,  owner: "Marcus C.",  rec: "pursue", isDemo: true },
    { id: "do3", address: "78 Riverside Pl",     city: "Atlanta",   state: "GA", offer: 132_000,  owner: "Olivia M.",  rec: "pursue", isDemo: true },
  ],
  negotiating: [
    { id: "dn1", address: "857 Cedar Court",     city: "Atlanta",   state: "GA", offer: 178_500,  owner: "Devon C.",   rec: "pursue", isDemo: true },
    { id: "dn2", address: "1501 Bay Pl",         city: "Tampa",     state: "FL", offer: 198_000,  owner: "Sofia R.",   rec: "pursue", isDemo: true },
  ],
  under_contract: [
    { id: "duc1", address: "2210 Lakeshore Dr",  city: "Tampa",     state: "FL", offer: 245_000,  owner: "Aaron B.",   rec: "pursue", isDemo: true },
  ],
  closed: [
    { id: "dcl1", address: "118 Hillview Rd",    city: "Charlotte", state: "NC", offer: 156_000,  owner: "Emma O.",    rec: "pursue", isDemo: true },
  ],
};

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
  const isDemo = leads.length === 0;

  const grouped = COLUMNS.reduce<Record<string, Lead[]>>((acc, col) => {
    acc[col.key] = visible.filter((l) => l.status === col.key);
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
              <LayoutGrid size={22} className="text-blue-600" /> Pipeline Board
            </h1>
            {isDemo && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Demo Data
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">
            Every lead, grouped by what stage of the deal it&apos;s in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPursueOnly((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border backdrop-blur-md transition-colors ${
              pursueOnly
                ? "bg-emerald-50/80 text-emerald-700 border-emerald-200"
                : "bg-white/70 text-zinc-600 border-white/60 hover:border-zinc-300"
            }`}
          >
            <Filter size={12} /> Pursue only
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 size={20} className="text-zinc-300 animate-spin mx-auto" /></div>
      ) : (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 stagger-children">
            {COLUMNS.map((col) => {
              const realItems = grouped[col.key] ?? [];
              const demoItems = isDemo ? (DEMO_BY_STATUS[col.key] ?? []) : [];
              const totalCount = realItems.length + demoItems.length;
              return (
                <div key={col.key} className="min-w-0">
                  <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-t-2xl px-4 py-3 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${col.accent}`} />
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-zinc-900">{STATUS_LABEL[col.key]}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.chipBg} ${col.chipFg}`}>
                        {totalCount}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white/40 backdrop-blur-sm border-x border-b border-white/60 rounded-b-2xl p-2 space-y-2 min-h-[440px]">
                    {totalCount === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-8">No leads</p>
                    ) : (
                      <>
                        {realItems.slice(0, 25).map((lead) => {
                          const contact = enrichedById.get(lead.id);
                          const rec = lead.pipeline_recommendation
                            ? PIPELINE_REC_STYLE[lead.pipeline_recommendation]
                            : null;
                          return (
                            <BoardCard
                              key={lead.id}
                              href={`/leads/${lead.id}`}
                              address={lead.address}
                              city={lead.city ?? ""}
                              state={lead.state ?? ""}
                              offer={lead.offer_price ?? 0}
                              owner={contact?.owner_name ?? "Owner"}
                              rec={rec}
                            />
                          );
                        })}
                        {demoItems.map((d) => (
                          <BoardCard
                            key={d.id}
                            href="/pipeline"
                            address={d.address}
                            city={d.city}
                            state={d.state}
                            offer={d.offer}
                            owner={d.owner}
                            rec={PIPELINE_REC_STYLE[d.rec]}
                          />
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isDemo && !loading && (
        <div className="mt-6 bg-gradient-to-br from-blue-50/80 to-emerald-50/80 backdrop-blur-sm border border-blue-200/60 rounded-2xl p-5 flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900">This is a preview with sample leads</p>
              <p className="text-xs text-zinc-600 mt-0.5">Run a real campaign to populate the board with your own leads.</p>
            </div>
          </div>
          <Link
            href="/pipeline"
            className="bg-gradient-to-br from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg hover:scale-[1.02]"
          >
            Run a Campaign
          </Link>
        </div>
      )}
    </div>
  );
}

function BoardCard({
  href, address, city, state, offer, owner, rec,
}: {
  href: string;
  address: string;
  city: string;
  state: string;
  offer: number;
  owner: string;
  rec: { label: string; className: string } | null;
}) {
  return (
    <Link
      href={href}
      className="block bg-white/90 backdrop-blur-sm border border-white/80 rounded-xl p-3 hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/10 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-semibold text-zinc-900 leading-tight line-clamp-2">{address}</p>
        {rec && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${rec.className}`}>
            {rec.label}
          </span>
        )}
      </div>
      <p className="text-[11px] text-zinc-500 flex items-center gap-1 mb-2">
        <MapPin size={9} />{city}, {state}
      </p>
      {offer > 0 && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wide">Offer</span>
          <span className="text-sm font-bold text-emerald-700">{fmt$$(offer)}</span>
        </div>
      )}
      <div className="flex items-center gap-1 text-[11px] text-zinc-600 pt-1.5 border-t border-zinc-100">
        <Phone size={9} className="text-zinc-400" />
        <span className="truncate">{owner}</span>
      </div>
    </Link>
  );
}
