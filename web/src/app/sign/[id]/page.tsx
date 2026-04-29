"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, FileSignature, Loader2, Zap, MapPin } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Contract {
  lead_id: string;
  address: string;
  city: string | null;
  state: string | null;
  owner_name: string;
  agreed_price: number | null;
  signed: boolean;
  signed_at: string | null;
}

export default function SignContractPage() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/demo/contract/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Contract not found");
        return r.json();
      })
      .then(setContract)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const sign = async () => {
    setSigning(true);
    try {
      const r = await fetch(`${API_BASE}/demo/contract/${id}/sign`, { method: "POST" });
      const data = await r.json();
      setContract((c) => c ? { ...c, signed: true, signed_at: data.signed_at } : c);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex flex-col">
      <header className="px-6 py-5 border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-semibold text-slate-900 tracking-tight">Birddogs</span>
          <span className="ml-auto text-xs text-slate-500 font-medium uppercase tracking-wider">Purchase Agreement</span>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="max-w-2xl mx-auto">
          {loading && (
            <div className="text-center py-20">
              <Loader2 size={24} className="text-slate-300 animate-spin mx-auto" />
            </div>
          )}

          {error && !loading && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
              <p className="text-sm font-semibold text-rose-700">Contract not found</p>
              <p className="text-xs text-rose-600 mt-1">{error}</p>
            </div>
          )}

          {contract && !loading && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fade-up">
              <div className="px-6 py-5 border-b border-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Property</p>
                <h1 className="text-2xl font-bold text-slate-900">{contract.address}</h1>
                <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                  <MapPin size={12} className="text-slate-400" />
                  {contract.city}, {contract.state}
                </p>
              </div>

              <div className="px-6 py-5 space-y-3 bg-slate-50/50">
                <Row label="Buyer" value="Birddogs Investor Group" />
                <Row label="Seller" value={contract.owner_name} />
                <Row label="Closing terms" value="Cash, as-is, 14-day close, no inspections, no fees" />
                <Row label="Agreed price" value={contract.agreed_price ? `$${contract.agreed_price.toLocaleString()}` : "—"} highlight />
              </div>

              <div className="px-6 py-5 border-t border-slate-100">
                <p className="text-xs text-slate-500 leading-relaxed">
                  By clicking <strong className="text-slate-700">Sign</strong>, you agree to the
                  cash purchase terms above. The buyer will reach out within 24 hours to schedule
                  closing. This is a demo — no real transaction occurs.
                </p>
              </div>

              <div className="px-6 py-5 bg-slate-50">
                {contract.signed ? (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                      <CheckCircle2 size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-emerald-900">Signed</p>
                      <p className="text-xs text-emerald-700">
                        {contract.signed_at ? new Date(contract.signed_at).toLocaleString() : "Just now"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={sign}
                    disabled={signing}
                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {signing ? <Loader2 size={16} className="animate-spin" /> : <FileSignature size={16} />}
                    {signing ? "Signing…" : "Sign Contract"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        Powered by Birddogs · Investor demo
      </footer>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">{label}</span>
      <span className={`text-sm text-right ${highlight ? "font-bold text-emerald-700 text-xl" : "font-medium text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}
