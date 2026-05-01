"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin, Check, Globe } from "lucide-react";

export interface Market {
  key: string;
  city: string;
  state: string;
  county: string;
  active_leads: number;
}

export const MARKETS: Market[] = [
  { key: "all",        city: "All Markets", state: "",   county: "",          active_leads: 587 },
  { key: "atl",        city: "Atlanta",     state: "GA", county: "Fulton",    active_leads: 142 },
  { key: "dfw",        city: "Dallas",      state: "TX", county: "Dallas",    active_leads: 98  },
  { key: "phx",        city: "Phoenix",     state: "AZ", county: "Maricopa",  active_leads: 71  },
  { key: "tpa",        city: "Tampa",       state: "FL", county: "Hillsborough", active_leads: 64 },
  { key: "clt",        city: "Charlotte",   state: "NC", county: "Mecklenburg",  active_leads: 53 },
  { key: "hou",        city: "Houston",     state: "TX", county: "Harris",    active_leads: 47  },
  { key: "mem",        city: "Memphis",     state: "TN", county: "Shelby",    active_leads: 38  },
  { key: "bhm",        city: "Birmingham",  state: "AL", county: "Jefferson", active_leads: 26  },
];

interface Props {
  current: Market;
  onChange: (m: Market) => void;
}

export function MarketSwitcher({ current, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isAll = current.key === "all";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 transition-all text-left min-w-[200px] shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_12px_-4px_rgba(15,23,42,0.08)] hover:shadow-[0_2px_6px_rgba(15,23,42,0.08),0_8px_20px_-4px_rgba(15,23,42,0.12)]"
      >
        {isAll ? (
          <Globe size={14} className="text-slate-500 shrink-0" />
        ) : (
          <MapPin size={14} className="text-blue-600 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Market</p>
          <p className="text-sm font-semibold text-slate-900 truncate">
            {isAll ? "All Markets" : `${current.city}, ${current.state}`}
          </p>
        </div>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-[0_8px_32px_-8px_rgba(15,23,42,0.16),0_0_0_1px_rgba(15,23,42,0.04)] z-30 overflow-hidden animate-fade-up">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/60">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Switch market</p>
          </div>
          <div className="max-h-[340px] overflow-y-auto py-1">
            {MARKETS.map((m) => {
              const selected = m.key === current.key;
              const allRow = m.key === "all";
              return (
                <button
                  key={m.key}
                  onClick={() => { onChange(m); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    selected ? "bg-blue-50/60" : "hover:bg-slate-50"
                  }`}
                >
                  {allRow ? (
                    <Globe size={14} className="text-slate-500 shrink-0" />
                  ) : (
                    <MapPin size={14} className="text-blue-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {allRow ? "All Markets" : `${m.city}, ${m.state}`}
                    </p>
                    {!allRow && (
                      <p className="text-[11px] text-slate-500">{m.county} County</p>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                    {m.active_leads}
                  </span>
                  {selected && <Check size={13} className="text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
