"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, MapPin } from "lucide-react";

interface Turn {
  role: "agent" | "owner";
  body: string;
}

interface Conversation {
  id: string;
  owner: string;
  city: string;
  state: string;
  initials: string;
  turns: Turn[];
  lastUpdate: number;
  done: boolean;
}

// Pre-scripted seller conversations — each one a complete deal arc.
// Three play "live" at any time (visible in the panel), older ones get
// archived below as you scroll. New ones spin up over time.
const SCRIPT_TEMPLATES: Array<Omit<Conversation, "id" | "lastUpdate" | "done"> & { script: Turn[] }> = [
  {
    owner: "Maria H.", city: "Atlanta", state: "GA", initials: "MH", turns: [],
    script: [
      { role: "agent", body: "Hi Maria, this is Alex — got a sec? Quick question about your place." },
      { role: "owner", body: "Maybe. What kind of number are we talking?" },
      { role: "agent", body: "I can do $187,500 cash, as-is, close in 14 days. No fees on your end." },
      { role: "owner", body: "Hmm. Could you do $200k?" },
      { role: "agent", body: "I can stretch to $195k cash. That's my best." },
      { role: "owner", body: "Deal. Send the paperwork." },
    ],
  },
  {
    owner: "James P.", city: "Dallas", state: "TX", initials: "JP", turns: [],
    script: [
      { role: "agent", body: "Hey James, would you ever consider a cash offer on 1204 Maple Ridge?" },
      { role: "owner", body: "Send me the offer in writing." },
      { role: "agent", body: "Just sent — $142k cash, 10-day close. What's your email?" },
      { role: "owner", body: "james.p@gmail.com" },
      { role: "agent", body: "Awesome. Contract on its way." },
    ],
  },
  {
    owner: "Linda G.", city: "Atlanta", state: "GA", initials: "LG", turns: [],
    script: [
      { role: "agent", body: "Hi Linda, just following up on 62 Oak Lane — open to a quick chat?" },
      { role: "owner", body: "Not interested right now, thanks." },
      { role: "agent", body: "No problem — if anything changes, I'm here." },
    ],
  },
  {
    owner: "Marcus C.", city: "Tampa", state: "FL", initials: "MC", turns: [],
    script: [
      { role: "agent", body: "Hey Marcus, are you open to a cash offer on 991 Bayview Ave?" },
      { role: "owner", body: "I'd need at least $215k. Can you do that?" },
      { role: "agent", body: "I can stretch to $208k cash, 14-day close. That's my best." },
      { role: "owner", body: "Deal. Send the paperwork." },
    ],
  },
  {
    owner: "Tasha W.", city: "Charlotte", state: "NC", initials: "TW", turns: [],
    script: [
      { role: "agent", body: "Hi Tasha, any chance you'd consider a cash offer on 4421 W Pine?" },
      { role: "owner", body: "Yes! Let's do it." },
      { role: "agent", body: "Awesome. $168k cash, what's the best email for paperwork?" },
    ],
  },
  {
    owner: "Robert K.", city: "Phoenix", state: "AZ", initials: "RK", turns: [],
    script: [
      { role: "agent", body: "Hi Robert, would you ever consider a cash offer on 707 Sunset Blvd?" },
      { role: "owner", body: "Maybe — what's your offer?" },
      { role: "agent", body: "I'm thinking $198k cash, close in 14 days. Sound fair?" },
    ],
  },
];

export function LiveMessageFeed({ heading = "Live Activity" }: { heading?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const idRef = useRef(0);
  const cursorRef = useRef(0);

  // Spawn a new conversation thread
  const spawn = (templateIdx?: number): Conversation => {
    const idx = templateIdx ?? cursorRef.current % SCRIPT_TEMPLATES.length;
    cursorRef.current += 1;
    const template = SCRIPT_TEMPLATES[idx];
    return {
      id: `c-${idRef.current++}`,
      owner: template.owner,
      city: template.city,
      state: template.state,
      initials: template.initials,
      turns: [],
      lastUpdate: Date.now(),
      done: false,
    };
  };

  useEffect(() => {
    // Seed three convos with some initial turns
    const seed: Conversation[] = [spawn(0), spawn(1), spawn(2)];
    seed[0].turns = SCRIPT_TEMPLATES[0].script.slice(0, 3);
    seed[1].turns = SCRIPT_TEMPLATES[1].script.slice(0, 2);
    seed[2].turns = SCRIPT_TEMPLATES[2].script.slice(0, 1);
    setConversations(seed);

    const tick = setInterval(() => {
      setConversations((prev) => {
        // Find the oldest non-done conversation and advance it
        const next = [...prev];
        const candidates = next
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !c.done)
          .sort((a, b) => a.c.lastUpdate - b.c.lastUpdate);

        if (candidates.length > 0) {
          const { c, i } = candidates[0];
          // Find the matching template by owner name
          const template = SCRIPT_TEMPLATES.find((t) => t.owner === c.owner);
          if (template && c.turns.length < template.script.length) {
            const updated: Conversation = {
              ...c,
              turns: template.script.slice(0, c.turns.length + 1),
              lastUpdate: Date.now(),
              done: c.turns.length + 1 >= template.script.length,
            };
            next[i] = updated;
          }
        }

        // Spawn a new conversation occasionally if we don't have too many
        const allDone = next.every((c) => c.done);
        if (allDone || (next.length < 8 && Math.random() < 0.18)) {
          next.unshift(spawn());
        }

        // Keep only the most recent ~8
        return next.slice(0, 8);
      });
    }, 1800);

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="surface p-4 overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-[14px] font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          <MessageSquare size={13} strokeWidth={1.75} className="text-slate-400" />
          {heading}
        </h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
          </span>
          Live
        </span>
      </div>

      {/* Desktop: vertical stack with vertical scroll inside the panel.
          Mobile (≤md): horizontal scroll row of cards (snap) — saves space. */}
      <div className="flex-1 min-h-0 overflow-y-auto md:pr-1 space-y-2.5 scroll-smooth
                      max-md:flex max-md:flex-row max-md:gap-2.5 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:space-y-0 max-md:snap-x">
        {conversations.map((c) => (
          <div key={c.id} className="max-md:snap-start max-md:shrink-0 max-md:w-[260px]">
            <ConversationCard c={c} />
          </div>
        ))}
      </div>
    </div>
  );
}

const AVATAR_COLORS = [
  "from-indigo-400 to-blue-500",
  "from-rose-400 to-pink-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-sky-500",
];

function ConversationCard({ c }: { c: Conversation }) {
  // Stable color per owner
  const colorIdx = (c.owner.charCodeAt(0) + c.owner.charCodeAt(1)) % AVATAR_COLORS.length;
  const color = AVATAR_COLORS[colorIdx];

  return (
    <div className="bg-slate-50/50 border border-slate-200/60 rounded-lg px-3 py-2.5 animate-fade-up">
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

      {/* Turns — compact text-only */}
      <div className="space-y-1">
        {c.turns.slice(-3).map((t, i) => (
          <div key={i} className="flex gap-2 text-[11px] leading-relaxed animate-slide-in">
            <span className={`shrink-0 font-semibold ${t.role === "agent" ? "text-blue-600" : "text-slate-500"}`}>
              {t.role === "agent" ? "AI" : "·"}
            </span>
            <p className="text-slate-700 line-clamp-2">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
