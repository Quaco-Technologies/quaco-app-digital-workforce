"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

interface Turn { role: "agent" | "owner"; body: string; }

interface Conversation {
  id: string;
  owner: string;
  initials: string;
  city: string;
  state: string;
  turns: Turn[];
  done: boolean;
  lastUpdate: number;
}

const SCRIPTS: Array<Omit<Conversation, "id" | "turns" | "done" | "lastUpdate"> & { script: Turn[] }> = [
  { owner: "Maria Hernandez", initials: "MH", city: "Atlanta",   state: "GA", script: [
    { role: "agent", body: "Hi Maria, this is Alex — got a sec? Quick question about your place." },
    { role: "owner", body: "Maybe. What kind of number are we talking?" },
    { role: "agent", body: "$187,500 cash, as-is, close in 14 days." },
    { role: "owner", body: "Could you do $200k?" },
    { role: "agent", body: "I can stretch to $195k. That's my best." },
    { role: "owner", body: "Deal. Send the paperwork." },
  ]},
  { owner: "James Patel", initials: "JP", city: "Dallas", state: "TX", script: [
    { role: "agent", body: "Hey James, would you consider a cash offer on 1204 Maple Ridge?" },
    { role: "owner", body: "Send me the offer in writing." },
    { role: "agent", body: "Just sent — $142k cash, 10-day close. What's your email?" },
    { role: "owner", body: "james.p@gmail.com" },
    { role: "agent", body: "Awesome. Contract on its way." },
  ]},
  { owner: "Linda Goodwin", initials: "LG", city: "Atlanta", state: "GA", script: [
    { role: "agent", body: "Hi Linda, following up on 62 Oak Lane. Open to a quick chat?" },
    { role: "owner", body: "Not interested right now, thanks." },
  ]},
  { owner: "Marcus Chen", initials: "MC", city: "Tampa", state: "FL", script: [
    { role: "agent", body: "Hey Marcus, are you open to a cash offer on 991 Bayview Ave?" },
    { role: "owner", body: "I'd need at least $215k. Can you do that?" },
    { role: "agent", body: "I can stretch to $208k cash, 14-day close." },
    { role: "owner", body: "Deal. Send the paperwork." },
  ]},
  { owner: "Tasha Williams", initials: "TW", city: "Charlotte", state: "NC", script: [
    { role: "agent", body: "Hi Tasha, any chance you'd consider a cash offer on 4421 W Pine?" },
    { role: "owner", body: "Yes! Let's do it." },
    { role: "agent", body: "Awesome. $168k cash. What's the best email for paperwork?" },
  ]},
  { owner: "Robert Kim", initials: "RK", city: "Phoenix", state: "AZ", script: [
    { role: "agent", body: "Hi Robert, would you consider a cash offer on 707 Sunset Blvd?" },
    { role: "owner", body: "Maybe — what's your offer?" },
    { role: "agent", body: "$198k cash, close in 14 days. Sound fair?" },
  ]},
  { owner: "Devon Carter", initials: "DC", city: "Atlanta", state: "GA", script: [
    { role: "agent", body: "Hi Devon, quick question about 857 Cedar Court." },
    { role: "owner", body: "What's your timeline?" },
    { role: "agent", body: "I can close in 10 days, $178,500 cash." },
  ]},
  { owner: "Sofia Rossi", initials: "SR", city: "Tampa", state: "FL", script: [
    { role: "agent", body: "Hi Sofia, would you ever consider selling 1501 Bay Pl?" },
    { role: "owner", body: "Maybe. What's it worth to you?" },
  ]},
];

const AVATAR_COLORS = [
  "from-indigo-400 to-blue-500",
  "from-rose-400 to-pink-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-sky-500",
];

export function LiveMessageFeed({ heading = "Live Activity" }: { heading?: string }) {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const idRef = useRef(0);
  const cursorRef = useRef(0);

  const spawn = (templateIdx: number): Conversation => {
    const t = SCRIPTS[templateIdx % SCRIPTS.length];
    return {
      id: `c-${idRef.current++}`,
      owner: t.owner,
      initials: t.initials,
      city: t.city,
      state: t.state,
      turns: [],
      done: false,
      lastUpdate: Date.now(),
    };
  };

  useEffect(() => {
    // Seed with the first 3 templates, partially filled
    const seed = [
      { ...spawn(0), turns: SCRIPTS[0].script.slice(0, 2) },
      { ...spawn(1), turns: SCRIPTS[1].script.slice(0, 1) },
      { ...spawn(2), turns: SCRIPTS[2].script.slice(0, 1) },
    ];
    cursorRef.current = 3;
    setConvos(seed);

    const tick = setInterval(() => {
      setConvos((prev) => {
        const next = [...prev];
        // Advance the oldest non-done conversation by one turn
        const oldest = next
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !c.done)
          .sort((a, b) => a.c.lastUpdate - b.c.lastUpdate)[0];
        if (oldest) {
          const tmpl = SCRIPTS.find((t) => t.owner === oldest.c.owner);
          if (tmpl && oldest.c.turns.length < tmpl.script.length) {
            const newLen = oldest.c.turns.length + 1;
            next[oldest.i] = {
              ...oldest.c,
              turns: tmpl.script.slice(0, newLen),
              done: newLen >= tmpl.script.length,
              lastUpdate: Date.now(),
            };
          }
        }
        // If all visible are done, queue a new one at the bottom (preserves scroll history)
        if (next.every((c) => c.done) && cursorRef.current < SCRIPTS.length * 3) {
          next.push(spawn(cursorRef.current++));
        }
        return next;
      });
    }, 2200);

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="surface p-4 overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-[14px] font-semibold text-slate-900 tracking-tight">{heading}</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
          </span>
          Live
        </span>
      </div>

      {/* Stacked conversation cards — one per seller. Scroll for more. */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5 scroll-smooth">
        {convos.map((c) => <ConversationCard key={c.id} c={c} />)}
      </div>
    </div>
  );
}

function ConversationCard({ c }: { c: Conversation }) {
  const colorIdx = (c.owner.charCodeAt(0) + c.owner.charCodeAt(1)) % AVATAR_COLORS.length;
  const color = AVATAR_COLORS[colorIdx];
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [c.turns.length]);

  return (
    <div className="bg-slate-50/50 border border-slate-200/60 rounded-lg p-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-[9px] font-semibold text-white`}>
          {c.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-slate-900 truncate leading-tight">{c.owner}</p>
          <p className="text-[10px] text-slate-500 flex items-center gap-1 leading-tight">
            <MapPin size={8} className="text-slate-400" />{c.city}, {c.state}
          </p>
        </div>
        {c.done && (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Closed</span>
        )}
      </div>

      {/* Turns — show last 3, scroll for older */}
      <div ref={scrollRef} className="space-y-1 max-h-[88px] overflow-y-auto pr-1">
        {c.turns.map((t, i) => (
          <div key={i} className="flex gap-2 text-[11px] leading-relaxed animate-slide-in">
            <span className={`shrink-0 font-semibold ${t.role === "agent" ? "text-blue-600" : "text-slate-500"}`}>
              {t.role === "agent" ? "AI" : "·"}
            </span>
            <p className="text-slate-700 line-clamp-2">{t.body}</p>
          </div>
        ))}
        {c.turns.length === 0 && (
          <p className="text-[11px] text-slate-400 italic">Reaching out…</p>
        )}
      </div>
    </div>
  );
}
