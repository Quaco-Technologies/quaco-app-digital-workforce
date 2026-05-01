"use client";

import { useEffect, useRef, useState } from "react";
import { X, CheckCircle2, XCircle, Phone, MapPin, Clock, MessageSquare, Loader2 } from "lucide-react";

export type MetricKind = "contacted" | "negotiating" | "accepted" | "contract";

interface Props {
  kind: MetricKind | null;
  onClose: () => void;
  active: boolean; // true = still pulsing/live, false = locked baseline
}

interface FakeOwner {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  phone?: string;
  hasPhone: boolean;
  step: "queued" | "running" | "done" | "rejected";
  detail?: string;
}

const NAMES = [
  "Maria Hernandez", "James Patel", "Linda Goodwin", "Marcus Chen",
  "Tasha Williams", "Robert Kim", "Emma O'Brien", "Devon Carter",
  "Sofia Rossi", "Aaron Brooks", "Carlos Diaz", "Olivia Martinez",
  "Wilson Park", "Naomi Frank", "Yusuf Hayes", "Priya Shah",
  "Greta Lin", "Hassan Reed", "Imani Cole", "Beatrice Vance",
];

const STREETS = [
  "N High St", "Maple Ridge Dr", "Oak Lane", "Bayview Ave",
  "W Pine St", "Sunset Blvd", "Cedar Court", "Lakeshore Dr",
  "Hillview Rd", "Riverside Pl", "Elm Way", "Bay Pl",
  "Birch Ave", "Magnolia Ct", "Sycamore Ln", "Fern Hollow Rd",
];

const CITIES: Array<[string, string]> = [
  ["Atlanta", "GA"], ["Dallas", "TX"], ["Tampa", "FL"], ["Phoenix", "AZ"],
  ["Charlotte", "NC"], ["Houston", "TX"], ["Memphis", "TN"], ["Birmingham", "AL"],
];

function makeFake(idx: number): FakeOwner {
  const num = 100 + Math.floor(Math.random() * 9899);
  const street = STREETS[Math.floor(Math.random() * STREETS.length)];
  const [city, stateAbbr] = CITIES[Math.floor(Math.random() * CITIES.length)];
  const name = NAMES[idx % NAMES.length];
  const hasPhone = Math.random() > 0.18;
  return {
    id: idx,
    name,
    address: `${num} ${street}`,
    city,
    state: stateAbbr,
    hasPhone,
    phone: hasPhone ? `(${100 + (idx % 800)}) 555-${String(1000 + (idx % 9000)).slice(0, 4)}` : undefined,
    step: "queued",
  };
}

const META: Record<MetricKind, { title: string; sub: string; accent: string }> = {
  contacted:   { title: "Sellers being contacted",   sub: "Opening text going out via SMS",      accent: "text-slate-700" },
  negotiating: { title: "Active negotiations",        sub: "AI agent counter-offering live",       accent: "text-blue-700"  },
  accepted:    { title: "Offers accepted",            sub: "Sellers agreed to a cash price",       accent: "text-amber-700" },
  contract:    { title: "Under contract",             sub: "Signed deals heading to close",        accent: "text-emerald-700" },
};

export function MetricDetailModal({ kind, onClose, active }: Props) {
  const [items, setItems] = useState<FakeOwner[]>([]);
  const idRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!kind) return;
    setItems([]);
    idRef.current = 0;

    // Seed with a bunch of in-flight items
    const seed: FakeOwner[] = [];
    for (let i = 0; i < 6; i++) {
      const o = makeFake(idRef.current++);
      o.step = i < 4 ? "done" : i === 4 ? "running" : "queued";
      if (kind === "contacted") {
        o.detail = o.hasPhone ? "Text sent" : "No phone — skipped";
        if (!o.hasPhone) o.step = "rejected";
      } else if (kind === "negotiating") {
        o.detail = ["Asked for offer", "Counter-offered", "Agreed in principle", "Discussing close date", "Just replied", "Awaiting response"][i % 6];
      } else if (kind === "accepted") {
        o.detail = `Agreed: $${(120 + Math.floor(Math.random() * 200)) * 1000}`;
      } else if (kind === "contract") {
        o.detail = "Signing pending";
      }
      seed.push(o);
    }
    setItems(seed);

    if (!active) return; // baseline view, no streaming
    const tick = setInterval(() => {
      setItems((prev) => {
        const next = [...prev];
        // Bump the running one to done
        const runningIdx = next.findIndex((x) => x.step === "running");
        if (runningIdx >= 0) {
          next[runningIdx] = { ...next[runningIdx], step: next[runningIdx].hasPhone ? "done" : "rejected" };
        }
        // Promote first queued to running
        const queuedIdx = next.findIndex((x) => x.step === "queued");
        if (queuedIdx >= 0) {
          next[queuedIdx] = { ...next[queuedIdx], step: "running" };
        }
        // Add a new queued at the end
        const fresh = makeFake(idRef.current++);
        if (kind === "contacted") {
          fresh.detail = fresh.hasPhone ? "Texting now…" : "No phone — skip";
        } else if (kind === "negotiating") {
          fresh.detail = ["Just replied", "Counter-offering", "Asked timeline"][Math.floor(Math.random() * 3)];
        } else if (kind === "accepted") {
          fresh.detail = `Agreed: $${(120 + Math.floor(Math.random() * 200)) * 1000}`;
        } else if (kind === "contract") {
          fresh.detail = "Awaiting signature";
        }
        next.push(fresh);
        return next.slice(-30);
      });
    }, 900);

    return () => clearInterval(tick);
  }, [kind, active]);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [items]);

  if (!kind) return null;
  const meta = META[kind];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`font-semibold ${meta.accent}`}>{meta.title}</h2>
              {active && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
                  </span>
                  LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{meta.sub}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 -m-1">
            <X size={18} />
          </button>
        </div>

        <div ref={containerRef} className="max-h-[460px] overflow-y-auto px-3 py-3 space-y-1.5 bg-slate-50/40">
          {items.map((o) => <ActivityRow key={o.id} owner={o} kind={kind} />)}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
          Live activity feed — updates every second while the pipeline runs
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ owner: o, kind }: { owner: FakeOwner; kind: MetricKind }) {
  const isDone = o.step === "done";
  const isRunning = o.step === "running";
  const isRejected = o.step === "rejected";
  const isQueued = o.step === "queued";

  return (
    <div className={`flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2.5 transition-all animate-slide-in ${
      isQueued ? "opacity-50" : ""
    }`}>
      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
        isDone ? "bg-emerald-50" : isRunning ? "bg-blue-50" : isRejected ? "bg-slate-100" : "bg-slate-50"
      }`}>
        {isDone ? <CheckCircle2 size={14} className="text-emerald-600" />
         : isRunning ? <Loader2 size={14} className="text-blue-600 animate-spin" />
         : isRejected ? <XCircle size={14} className="text-slate-400" />
         : <Clock size={14} className="text-slate-300" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-slate-900 truncate">{o.address}</p>
          <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
            <MapPin size={8} />{o.city}, {o.state}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
          <span className="truncate">{o.name}</span>
          {o.phone && (
            <span className="flex items-center gap-0.5 text-blue-600 font-medium">
              <Phone size={9} />{o.phone}
            </span>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className={`text-[11px] font-medium ${
          isDone ? "text-emerald-700" : isRunning ? "text-blue-700" : isRejected ? "text-slate-400" : "text-slate-500"
        }`}>
          {o.detail}
        </p>
      </div>
    </div>
  );
}
