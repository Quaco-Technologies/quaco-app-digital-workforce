"use client";

import { useEffect, useRef, useState } from "react";
import { LiveDot } from "@/components/LiveDot";
import { MessageSquare } from "lucide-react";

interface FakeMessage {
  id: string;
  owner: string;
  city: string;
  body: string;
  role: "agent" | "owner";
  ts: number;
}

interface TypingIndicator {
  id: "typing";
  owner: string;
  city: string;
  role: "agent" | "owner";
}

const SCRIPT: Array<Omit<FakeMessage, "id" | "ts">> = [
  { owner: "Maria H.",  city: "Atlanta, GA",   role: "agent", body: "Hi Maria, I'm a local cash buyer. Would you ever consider an offer on 3857 N High St?" },
  { owner: "Maria H.",  city: "Atlanta, GA",   role: "owner", body: "Maybe. What kind of number are we talking?" },
  { owner: "James P.",  city: "Dallas, TX",    role: "owner", body: "Send me the offer in writing." },
  { owner: "Maria H.",  city: "Atlanta, GA",   role: "agent", body: "I can do $187,500 cash, as-is, close in 14 days. No fees on your end." },
  { owner: "Linda G.",  city: "Atlanta, GA",   role: "agent", body: "Hi Linda, just following up on 62 Oak Lane — still open to a quick chat?" },
  { owner: "James P.",  city: "Dallas, TX",    role: "agent", body: "Just sent the offer over text. $142k cash, 10-day close." },
  { owner: "Marcus C.", city: "Tampa, FL",     role: "owner", body: "I'd need at least $215k. Can you do that?" },
  { owner: "Linda G.",  city: "Atlanta, GA",   role: "owner", body: "Not interested right now, thanks." },
  { owner: "Marcus C.", city: "Tampa, FL",     role: "agent", body: "I can stretch to $208k cash, 14-day close. That's my best." },
  { owner: "Tasha W.",  city: "Charlotte, NC", role: "owner", body: "Yes! Let's do it." },
  { owner: "Robert K.", city: "Phoenix, AZ",   role: "agent", body: "Hi Robert, would you ever consider a cash offer on 707 Sunset Blvd?" },
  { owner: "Marcus C.", city: "Tampa, FL",     role: "owner", body: "Deal. Send the paperwork." },
  { owner: "Devon C.",  city: "Atlanta, GA",   role: "owner", body: "What's your timeline?" },
  { owner: "Sofia R.",  city: "Tampa, FL",     role: "agent", body: "Sofia, congrats on the new arrival! Heard 1501 Bay Pl might be on your mind — open to chatting?" },
  { owner: "Robert K.", city: "Phoenix, AZ",   role: "owner", body: "Maybe — what's your offer?" },
  { owner: "Aaron B.",  city: "Charlotte, NC", role: "agent", body: "Aaron, $156k cash works for me on 118 Hillview. Can close end of month." },
  { owner: "Olivia M.", city: "Atlanta, GA",   role: "owner", body: "How fast can you close?" },
  { owner: "Devon C.",  city: "Atlanta, GA",   role: "agent", body: "I can close in 10 days, no inspections, $178,500 cash. Sound fair?" },
  { owner: "Aaron B.",  city: "Charlotte, NC", role: "owner", body: "OK. Send the contract." },
];

export function LiveMessageFeed({ heading = "Live Activity" }: { heading?: string }) {
  const [messages, setMessages] = useState<FakeMessage[]>([]);
  const [typing, setTyping] = useState<TypingIndicator | null>(null);
  const idxRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seed: FakeMessage[] = [];
    for (let i = 0; i < 3; i++) {
      const m = SCRIPT[i];
      seed.push({ ...m, id: `seed-${i}`, ts: Date.now() - (3 - i) * 4_000 });
    }
    setMessages(seed);
    idxRef.current = 3;

    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      const next = SCRIPT[idxRef.current % SCRIPT.length];
      idxRef.current += 1;

      // Show typing indicator first
      setTyping({ id: "typing", owner: next.owner, city: next.city, role: next.role });

      // Then drop the message after a typing delay
      const typingDelay = 900 + Math.random() * 600;
      timeoutId = setTimeout(() => {
        setTyping(null);
        const newMsg: FakeMessage = { ...next, id: `m-${Date.now()}`, ts: Date.now() };
        setMessages((prev) => [...prev, newMsg].slice(-14));

        // Schedule next tick
        const nextDelay = 1800 + Math.random() * 1400;
        timeoutId = setTimeout(tick, nextDelay);
      }, typingDelay);
    };

    timeoutId = setTimeout(tick, 1500);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, typing]);

  return (
    <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-5 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
          <MessageSquare size={15} className="text-blue-500" /> {heading}
        </h3>
        <LiveDot color="red" label="LIVE" />
      </div>

      <div
        ref={containerRef}
        className="space-y-2 max-h-[340px] overflow-y-auto pr-1 scroll-smooth"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex animate-slide-in ${m.role === "agent" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[78%] ${m.role === "agent" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <span className="font-medium text-zinc-500">{m.owner}</span>
                <span>·</span>
                <span>{m.city}</span>
              </div>
              <div
                className={`px-3.5 py-2 rounded-2xl text-sm shadow-sm ${
                  m.role === "agent"
                    ? "bg-gradient-to-br from-blue-500 to-emerald-500 text-white rounded-br-sm"
                    : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
                }`}
              >
                {m.body}
              </div>
            </div>
          </div>
        ))}

        {typing && (
          <div className={`flex animate-slide-in ${typing.role === "agent" ? "justify-end" : "justify-start"}`}>
            <div className={`flex flex-col gap-1 ${typing.role === "agent" ? "items-end" : "items-start"}`}>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <span className="font-medium text-zinc-500">{typing.owner}</span>
                <span>·</span>
                <span>{typing.city}</span>
                <span>·</span>
                <span className="italic">typing</span>
              </div>
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-sm shadow-sm flex items-center gap-1 ${
                  typing.role === "agent"
                    ? "bg-gradient-to-br from-blue-500/70 to-emerald-500/70 text-white rounded-br-sm"
                    : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
                }`}
              >
                <TypingDots color={typing.role === "agent" ? "white" : "zinc"} />
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-zinc-400 mt-3 pt-3 border-t border-zinc-100 text-center">
        Streaming AI conversations from your active campaigns
      </p>
    </div>
  );
}

function TypingDots({ color }: { color: "white" | "zinc" }) {
  const dotClass =
    color === "white"
      ? "bg-white/90"
      : "bg-zinc-500";
  return (
    <div className="flex items-center gap-1 py-1">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass} animate-bounce`} style={{ animationDelay: "0ms" }} />
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass} animate-bounce`} style={{ animationDelay: "150ms" }} />
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass} animate-bounce`} style={{ animationDelay: "300ms" }} />
    </div>
  );
}
