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

const SCRIPT: Array<Omit<FakeMessage, "id" | "ts">> = [
  { owner: "Maria H.",     city: "Atlanta, GA",      role: "agent", body: "Hi Maria, I'm a local cash buyer. Would you ever consider an offer on 3857 N High St?" },
  { owner: "Maria H.",     city: "Atlanta, GA",      role: "owner", body: "Maybe. What kind of number are we talking?" },
  { owner: "James P.",     city: "Dallas, TX",       role: "owner", body: "Send me the offer in writing." },
  { owner: "Maria H.",     city: "Atlanta, GA",      role: "agent", body: "I can do $187,500 cash, as-is, close in 14 days. No fees on your end." },
  { owner: "Linda G.",     city: "Atlanta, GA",      role: "agent", body: "Hi Linda, just following up on 62 Oak Lane — still open to a quick chat?" },
  { owner: "James P.",     city: "Dallas, TX",       role: "agent", body: "Just sent the offer over text. $142k cash, 10-day close." },
  { owner: "Marcus C.",    city: "Tampa, FL",        role: "owner", body: "I'd need at least $215k. Can you do that?" },
  { owner: "Linda G.",     city: "Atlanta, GA",      role: "owner", body: "Not interested right now, thanks." },
  { owner: "Marcus C.",    city: "Tampa, FL",        role: "agent", body: "I can stretch to $208k cash, 14-day close. That's my best." },
  { owner: "Tasha W.",     city: "Charlotte, NC",    role: "owner", body: "Yes! Let's do it." },
  { owner: "Robert K.",    city: "Phoenix, AZ",      role: "agent", body: "Hi Robert, would you ever consider a cash offer on 707 Sunset Blvd?" },
  { owner: "Marcus C.",    city: "Tampa, FL",        role: "owner", body: "Deal. Send the paperwork." },
];

export function LiveMessageFeed({ heading = "Live Activity" }: { heading?: string }) {
  const [messages, setMessages] = useState<FakeMessage[]>([]);
  const idxRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Seed with first 3
    const seed: FakeMessage[] = [];
    for (let i = 0; i < 3; i++) {
      const m = SCRIPT[i];
      seed.push({ ...m, id: `seed-${i}`, ts: Date.now() - (3 - i) * 8_000 });
    }
    setMessages(seed);
    idxRef.current = 3;

    const interval = setInterval(() => {
      const next = SCRIPT[idxRef.current % SCRIPT.length];
      idxRef.current += 1;
      setMessages((prev) => {
        const newMsg: FakeMessage = { ...next, id: `m-${Date.now()}`, ts: Date.now() };
        const updated = [...prev, newMsg];
        return updated.slice(-12);
      });
    }, 4_500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 overflow-hidden">
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
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm"
                    : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
                }`}
              >
                {m.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-400 mt-3 pt-3 border-t border-zinc-100 text-center">
        Streaming AI conversations from your active campaigns
      </p>
    </div>
  );
}
