"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockContracts, type MockContract } from "@/lib/mockData";
import { fmt$$, fmtDate } from "@/lib/utils";
import {
  FileSignature, CheckCircle2, Clock, XCircle,
  ExternalLink, MapPin, User as UserIcon,
} from "lucide-react";

const STATUS_META: Record<MockContract["status"], { label: string; className: string; icon: React.ReactNode }> = {
  sent:      { label: "Awaiting Signature", className: "bg-amber-50 text-amber-700 border-amber-200",   icon: <Clock size={12} /> },
  completed: { label: "Signed",              className: "bg-green-50 text-green-700 border-green-200",   icon: <CheckCircle2 size={12} /> },
  voided:    { label: "Voided",              className: "bg-red-50 text-red-600 border-red-200",         icon: <XCircle size={12} /> },
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<MockContract[]>([]);
  const [filter, setFilter] = useState<MockContract["status"] | "all">("all");

  useEffect(() => {
    setContracts(mockContracts());
  }, []);

  const visible = contracts.filter((c) => filter === "all" || c.status === filter);
  const totalAgreed = contracts.filter((c) => c.status !== "voided").reduce((s, c) => s + c.agreed_price, 0);
  const completed = contracts.filter((c) => c.status === "completed").length;
  const pending = contracts.filter((c) => c.status === "sent").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
          <FileSignature size={22} /> Contracts
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Purchase agreements out for signature.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Stat label="Total Agreed Value" value={fmt$$(totalAgreed)} accent="text-emerald-700" />
        <Stat label="Awaiting Signature" value={pending.toString()} accent="text-amber-700" />
        <Stat label="Signed" value={completed.toString()} accent="text-green-700" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(["all", "sent", "completed", "voided"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === f
                ? "bg-zinc-900 text-white"
                : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300"
            }`}
          >
            {f === "all" ? "All" : STATUS_META[f].label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-xl overflow-hidden">
        {visible.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">
            No contracts in this view yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Property</th>
                <th className="px-5 py-3 font-medium">Owner</th>
                <th className="px-5 py-3 font-medium">Agreed Price</th>
                <th className="px-5 py-3 font-medium">Sent</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {visible.map((c) => {
                const meta = STATUS_META[c.status];
                return (
                  <tr key={c.id} className="hover:bg-zinc-50/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/leads/${c.lead_id}`} className="font-medium text-zinc-900 hover:text-blue-600">
                        {c.address}
                      </Link>
                      <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
                        <MapPin size={9} />{c.city}, {c.state}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center">
                          <UserIcon size={11} className="text-blue-500" />
                        </div>
                        <span className="text-sm text-zinc-800">{c.owner_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-emerald-700">{fmt$$(c.agreed_price)}</p>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-600">
                      {fmtDate(c.sent_at)}
                      {c.completed_at && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Signed {fmtDate(c.completed_at)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${meta.className}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/leads/${c.lead_id}`}
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-xs font-medium"
                      >
                        <ExternalLink size={11} />
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-zinc-400 mt-4">
        Contracts are sent automatically once the AI negotiation agent reaches a deal.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-xl p-5">
      <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}
