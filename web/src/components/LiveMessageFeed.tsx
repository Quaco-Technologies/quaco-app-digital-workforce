"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";

interface FakeMessage {
  id: string;
  body: string;
  role: "agent" | "owner";
  ts: number;
}

interface SellerScript {
  owner: string;
  city: string;
  state: string;
  script: Array<{ role: "agent" | "owner"; body: string }>;
}

const SELLERS: SellerScript[] = [
  { owner: "Maria H.", city: "Atlanta", state: "GA", script: [
    { role: "agent", body: "Hi Maria, I'm a local cash buyer. Would you ever consider an offer on 3857 N High St?" },
    { role: "owner", body: "Maybe. What kind of number are we talking?" },
    { role: "agent", body: "I can do $187,500 cash, as-is, close in 14 days." },
    { role: "owner", body: "Could you do $200k?" },
    { role: "agent", body: "I can stretch to $195k cash. That's my best." },
    { role: "owner", body: "Deal. Send the paperwork." },
  ]},
  { owner: "James P.", city: "Dallas", state: "TX", script: [
    { role: "agent", body: "Hey James, would you consider a cash offer on 1204 Maple Ridge?" },
    { role: "owner", body: "Send me the offer in writing." },
    { role: "agent", body: "Just sent — $142k cash, 10-day close. What's your email?" },
    { role: "owner", body: "james.p@gmail.com" },
    { role: "agent", body: "Awesome. Contract on its way." },
  ]},
  { owner: "Linda G.", city: "Atlanta", state: "GA", script: [
    { role: "agent", body: "Hi Linda, just following up on 62 Oak Lane — still open to a quick chat?" },
    { role: "owner", body: "Not interested right now, thanks." },
    { role: "agent", body: "No problem — if anything changes, I'm here." },
  ]},
  { owner: "Marcus C.", city: "Tampa", state: "FL", script: [
    { role: "agent", body: "Hey Marcus, are you open to a cash offer on 991 Bayview Ave?" },
    { role: "owner", body: "I'd need at least $215k. Can you do that?" },
    { role: "agent", body: "I can stretch to $208k cash, 14-day close." },
    { role: "owner", body: "Deal. Send the paperwork." },
  ]},
  { owner: "Tasha W.", city: "Charlotte", state: "NC", script: [
    { role: "agent", body: "Hi Tasha, any chance you'd consider a cash offer on 4421 W Pine?" },
    { role: "owner", body: "Yes! Let's do it." },
    { role: "agent", body: "Awesome. $168k cash. What's the best email for paperwork?" },
  ]},
  { owner: "Robert K.", city: "Phoenix", state: "AZ", script: [
    { role: "agent", body: "Hi Robert, would you consider a cash offer on 707 Sunset Blvd?" },
    { role: "owner", body: "Maybe — what's your offer?" },
    { role: "agent", body: "$198k cash, close in 14 days. Sound fair?" },
  ]},
];

// Renders 3 separate seller cards stacked. Each is its own surface card,
// each cycles through its seller's conversation independently.
export function LiveMessageFeed({ heading = "Network Activity" }: { heading?: string }) {
  const [shown, setShown] = useState<SellerScript[]>([SELLERS[0], SELLERS[1], SELLERS[2]]);
  const cursorRef = useRef(3);

  // Rotate one of the three to a fresh seller every 25s so the panel keeps moving
  useEffect(() => {
    const swap = setInterval(() => {
      setShown((prev) => {
        const next = [...prev];
        const rotateIdx = Math.floor(Math.random() * 3);
        next[rotateIdx] = SELLERS[cursorRef.current % SELLERS.length];
        cursorRef.current += 1;
        return next;
      });
    }, 25_000);
    return () => clearInterval(swap);
  }, []);

  return (
    <div className="space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0 px-1">
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

      {/* Three separate cards stacked, scrollable for older */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 scroll-smooth">
        {shown.map((s, i) => <SellerConversation key={`${s.owner}-${i}`} seller={s} />)}
      </div>
    </div>
  );
}

function SellerConversation({ seller }: { seller: SellerScript }) {
  const [messages, setMessages] = useState<FakeMessage[]>([]);
  const [typing, setTyping] = useState<{ role: "agent" | "owner" } | null>(null);
  const idxRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setTyping(null);
    idxRef.current = 0;

    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (idxRef.current >= seller.script.length) {
        // Loop the conversation back from the start so the card keeps moving
        setMessages([]);
        idxRef.current = 0;
      }
      const next = seller.script[idxRef.current];
      idxRef.current += 1;

      setTyping({ role: next.role });
      const typingDelay = 700 + Math.random() * 500;
      timeoutId = setTimeout(() => {
        setTyping(null);
        const newMsg: FakeMessage = { id: `m-${Date.now()}-${Math.random()}`, body: next.body, role: next.role, ts: Date.now() };
        setMessages((prev) => [...prev, newMsg].slice(-6));
        timeoutId = setTimeout(tick, 2200 + Math.random() * 1200);
      }, typingDelay);
    };

    timeoutId = setTimeout(tick, 800 + Math.random() * 600);
    return () => clearTimeout(timeoutId);
  }, [seller]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, typing]);

  return (
    <div className="surface p-3 overflow-hidden flex flex-col h-[180px]">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-2 shrink-0">
        <span className="font-medium text-slate-600">{seller.owner}</span>
        <span>·</span>
        <span>{seller.city}, {seller.state}</span>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5 scroll-smooth">
        {messages.map((m) => (
          <div key={m.id} className={`flex animate-slide-in ${m.role === "agent" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-[12px] leading-snug shadow-sm ${
              m.role === "agent"
                ? "bg-gradient-to-br from-blue-500 to-emerald-500 text-white rounded-br-sm"
                : "bg-slate-100 text-slate-800 rounded-bl-sm"
            }`}>
              {m.body}
            </div>
          </div>
        ))}

        {typing && (
          <div className={`flex animate-slide-in ${typing.role === "agent" ? "justify-end" : "justify-start"}`}>
            <div className={`px-2.5 py-2 rounded-xl shadow-sm flex items-center ${
              typing.role === "agent"
                ? "bg-gradient-to-br from-blue-500/70 to-emerald-500/70 rounded-br-sm"
                : "bg-slate-100 rounded-bl-sm"
            }`}>
              <TypingDots color={typing.role === "agent" ? "white" : "zinc"} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots({ color }: { color: "white" | "zinc" }) {
  const dotClass = color === "white" ? "bg-white/90" : "bg-slate-500";
  return (
    <div className="flex items-center gap-1">
      <span className={`h-1 w-1 rounded-full ${dotClass} animate-bounce`} style={{ animationDelay: "0ms" }} />
      <span className={`h-1 w-1 rounded-full ${dotClass} animate-bounce`} style={{ animationDelay: "150ms" }} />
      <span className={`h-1 w-1 rounded-full ${dotClass} animate-bounce`} style={{ animationDelay: "300ms" }} />
    </div>
  );
}
