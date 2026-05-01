"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedEvent } from "@/components/LiveMessageFeed";

// City coordinates on a 1000×560 viewBox of a stylized lower-48 outline.
// Mapped to the 12 markets used by the procedural seller pool.
const CITIES: Record<string, { x: number; y: number; label: string }> = {
  "Atlanta":      { x: 720, y: 350, label: "ATL" },
  "Dallas":       { x: 510, y: 410, label: "DAL" },
  "Tampa":        { x: 770, y: 460, label: "TPA" },
  "Phoenix":      { x: 215, y: 365, label: "PHX" },
  "Charlotte":    { x: 760, y: 320, label: "CLT" },
  "Houston":      { x: 535, y: 460, label: "HOU" },
  "Memphis":      { x: 640, y: 335, label: "MEM" },
  "Birmingham":   { x: 685, y: 360, label: "BHM" },
  "Raleigh":      { x: 790, y: 305, label: "RDU" },
  "Nashville":    { x: 670, y: 310, label: "BNA" },
  "Jacksonville": { x: 790, y: 425, label: "JAX" },
  "San Antonio":  { x: 490, y: 480, label: "SAT" },
};

type DotState = "idle" | "contacted" | "negotiating" | "won" | "dead";

interface Pulse {
  id: number;
  city: string;
  state: DotState;
}

// Stylized lower-48 silhouette. ~70 control points hitting the recognizable
// coastline features: Maine notch, Cape Cod, Florida peninsula, Gulf bend,
// Texas point, California curve, Pacific Northwest, then Canada border across
// the top. Not topo-accurate but reads instantly as "the US".
const US_PATH = "\
M 92 220 \
L 130 200 L 170 195 L 220 192 L 280 185 L 340 178 L 400 173 L 460 170 L 520 168 \
L 580 168 L 640 170 L 700 174 L 760 178 L 810 184 L 850 192 L 870 175 L 882 168 \
L 895 178 L 905 195 L 902 215 L 915 222 L 925 235 L 920 252 L 905 268 L 890 275 \
L 880 290 L 868 312 L 855 335 L 838 350 L 815 360 L 790 370 L 770 388 L 757 410 \
L 750 435 L 758 455 L 770 470 L 778 488 L 790 500 L 800 488 L 808 478 L 815 488 \
L 815 505 L 802 520 L 780 522 L 758 515 L 738 510 L 720 506 L 700 510 L 678 514 \
L 650 510 L 615 504 L 575 502 L 540 504 L 500 502 L 462 498 L 430 495 L 400 498 \
L 372 502 L 348 506 L 320 502 L 296 492 L 270 478 L 245 462 L 220 446 L 195 428 \
L 172 408 L 152 388 L 134 365 L 118 340 L 105 318 L 95 295 L 88 270 L 88 245 \
Z";

interface Props {
  running?: boolean;
  /** When set, the map zooms onto this city. Use "all" or undefined for the whole US. */
  focusCity?: string;
  /** Lets the dashboard pipe the same FeedEvent stream into the map. */
  registerEventSink?: (handler: (e: FeedEvent) => void) => void;
}

export function USMapCard({ running = false, focusCity, registerEventSink }: Props) {
  // Per-city state: latest classification (drives the steady dot color).
  const [cityState, setCityState] = useState<Record<string, DotState>>({});
  // Transient pulse animations keyed by id so multiple can stack on the same city.
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const idRef = useRef(0);

  // Decay: after 6s of no further events, calm a city back toward "contacted"
  // unless it has reached a terminal state (won / dead).
  const decayTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!registerEventSink) return;
    registerEventSink((e: FeedEvent) => {
      const city = e.type === "spawned" || e.type === "completed" ? e.seller.city : null;
      if (!city || !(city in CITIES)) return;

      let next: DotState | null = null;
      if (e.type === "spawned")     next = "contacted";
      if (e.type === "negotiating") next = "negotiating";
      if (e.type === "completed")   next = e.outcome === "agreed" ? "won" : "dead";
      if (!next) return;

      setCityState((prev) => ({ ...prev, [city]: next! }));
      const id = ++idRef.current;
      setPulses((prev) => [...prev, { id, city, state: next! }]);
      // Pulse cleans itself up after the animation.
      setTimeout(() => setPulses((prev) => prev.filter((p) => p.id !== id)), 1400);

      // Reset the decay timer for terminal states only.
      if (next === "won" || next === "dead") {
        if (decayTimers.current[city]) clearTimeout(decayTimers.current[city]);
        decayTimers.current[city] = setTimeout(() => {
          setCityState((prev) => {
            const cp = { ...prev };
            delete cp[city];
            return cp;
          });
        }, 6000);
      }
    });

    return () => {
      Object.values(decayTimers.current).forEach((t) => clearTimeout(t));
    };
  }, [registerEventSink]);

  return (
    <div className="surface p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight">Coverage Map</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{running ? "Lighting up live" : "12 active markets"}</p>
        </div>
        <Legend />
      </div>

      <div className="flex-1 min-h-0 relative overflow-hidden">
        <svg viewBox="0 0 1000 560" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="us-glow" cx="50%" cy="50%" r="60%">
              <stop offset="0%"   stopColor="rgba(99, 102, 241, 0.10)" />
              <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
            </radialGradient>
            <filter id="dot-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/*
            Zoom group: when focusCity is set, scale up around that city.
            CSS transform is animated via the inline transition for a smooth
            cinematic glide between US and state-level views.
          */}
          <g
            style={{
              transform: zoomTransform(focusCity),
              transformOrigin: "0 0",
              transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <path
              d={US_PATH}
              fill="rgba(241, 245, 249, 0.9)"
              stroke="rgba(99, 102, 241, 0.25)"
              strokeWidth={focusCity ? 0.6 : 1.5}
            />
            <rect x="0" y="0" width="1000" height="560" fill="url(#us-glow)" pointerEvents="none" />

            {pulses.map((p) => {
              const pos = CITIES[p.city];
              const color = COLORS[p.state];
              return (
                <circle
                  key={p.id}
                  cx={pos.x}
                  cy={pos.y}
                  r={6}
                  fill="none"
                  stroke={color.stroke}
                  strokeWidth="2"
                  opacity="0.9"
                  style={{ animation: "map-pulse 1.4s ease-out forwards" }}
                />
              );
            })}

            {Object.entries(CITIES).map(([name, pos]) => {
              const state = cityState[name] ?? "idle";
              const color = COLORS[state];
              const isLive = state !== "idle";
              const focused = focusCity === name;
              const r = focused ? 4 : isLive ? 5.5 : 3.5;
              return (
                <g key={name}>
                  {isLive && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="9"
                      fill={color.stroke}
                      opacity="0.20"
                      filter="url(#dot-glow)"
                    />
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={color.fill}
                    stroke={color.stroke}
                    strokeWidth={isLive ? 1.5 : 1}
                    style={{ transition: "all 360ms cubic-bezier(0.16, 1, 0.3, 1)" }}
                  />
                  <text
                    x={pos.x + 9}
                    y={pos.y + 3}
                    fontSize={focused ? 7 : 11}
                    fontWeight="600"
                    fill={isLive ? color.stroke : "rgba(100, 116, 139, 0.6)"}
                    style={{ transition: "fill 360ms, font-size 360ms" }}
                  >
                    {pos.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

// Zoom + pan so the focused city sits roughly in the centre of the viewBox.
function zoomTransform(focusCity?: string): string {
  if (!focusCity || !(focusCity in CITIES)) return "scale(1) translate(0, 0)";
  const pos = CITIES[focusCity];
  const scale = 3.2;
  // After scaling, translate so the city lands near the centre of the viewBox.
  const tx = 500 - pos.x * scale;
  const ty = 280 - pos.y * scale;
  return `translate(${tx}px, ${ty}px) scale(${scale})`;
}

const COLORS: Record<DotState, { fill: string; stroke: string }> = {
  idle:        { fill: "#cbd5e1", stroke: "#94a3b8" },          // slate-300/400
  contacted:   { fill: "#fef08a", stroke: "#eab308" },          // yellow-200/500
  negotiating: { fill: "#fda4af", stroke: "#f43f5e" },          // rose-300/500
  won:         { fill: "#86efac", stroke: "#10b981" },          // emerald-300/500
  dead:        { fill: "#cbd5e1", stroke: "#64748b" },          // slate
};

function Legend() {
  return (
    <div className="flex items-center gap-2.5 text-[10px] font-medium">
      <LegendDot color="#eab308" label="Contacted" />
      <LegendDot color="#f43f5e" label="Negotiating" />
      <LegendDot color="#10b981" label="Won" />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-slate-500">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
