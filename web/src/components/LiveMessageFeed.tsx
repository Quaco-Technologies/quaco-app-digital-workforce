"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { spawnSeller, type Seller, type Outcome } from "@/lib/sellerPool";

interface FakeMessage {
  id: string;
  body: string;
  role: "agent" | "owner";
}

export type FeedEvent =
  | { type: "spawned"; seller: Seller }
  | { type: "negotiating"; sellerId: string }
  | { type: "completed"; seller: Seller; outcome: Outcome };

interface Props {
  heading?: string;
  running?: boolean;
  onEvent?: (e: FeedEvent) => void;
}

export function LiveMessageFeed({ heading = "Network Activity", running = false, onEvent }: Props) {
  const [deck, setDeck] = useState<Seller[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const eventRef = useRef(onEvent);
  useEffect(() => { eventRef.current = onEvent; }, [onEvent]);

  // Seed 3 unique sellers on mount
  useEffect(() => {
    const seed = [spawnSeller(), spawnSeller(), spawnSeller()];
    setDeck(seed);
    seed.forEach((s) => eventRef.current?.({ type: "spawned", seller: s }));
  }, []);

  // Replace one card whenever a SellerConversation reports completion.
  // The replaced seller scrolls off the top, fresh one slides in at the bottom.
  const handleCompleted = useCallback((sellerId: string, outcome: Outcome) => {
    setDeck((prev) => {
      const idx = prev.findIndex((s) => s.id === sellerId);
      if (idx < 0) return prev;
      const completed = prev[idx];
      eventRef.current?.({ type: "completed", seller: completed, outcome });
      const fresh = spawnSeller();
      eventRef.current?.({ type: "spawned", seller: fresh });
      // Append the fresh one at the bottom, drop the completed one
      const next = prev.filter((_, i) => i !== idx);
      next.push(fresh);
      // Keep a rolling history so user can scroll up to see past closes
      return next.slice(-15);
    });
    // Auto-scroll the visible window to the freshest if user is near the bottom
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (atBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const handleNegotiating = useCallback((sellerId: string) => {
    eventRef.current?.({ type: "negotiating", sellerId });
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
          {running ? "Live · running" : "Live"}
        </span>
      </div>

      {/* TikTok-style scroll: snap to each card, scroll up for prior closes,
          scroll down to the latest. New cards spawn over time. */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1 snap-y snap-mandatory scroll-smooth"
      >
        {deck.map((s) => (
          <div
            key={s.id}
            className="snap-start flex-shrink-0"
            style={{ minHeight: "calc((100% - 1.5rem) / 3)" }}
          >
            <SellerConversation
              seller={s}
              accelerated={running}
              onNegotiating={() => handleNegotiating(s.id)}
              onCompleted={() => handleCompleted(s.id, s.outcome)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface SellerCardProps {
  seller: Seller;
  accelerated: boolean;
  onNegotiating: () => void;
  onCompleted: () => void;
}

function SellerConversation({ seller, accelerated, onNegotiating, onCompleted }: SellerCardProps) {
  const [messages, setMessages] = useState<FakeMessage[]>([]);
  const [typing, setTyping] = useState<{ role: "agent" | "owner" } | null>(null);
  const [closed, setClosed] = useState(false);
  const idxRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const negotiatedRef = useRef(false);

  // Capture latest callbacks
  const negCb = useRef(onNegotiating);
  const doneCb = useRef(onCompleted);
  useEffect(() => { negCb.current = onNegotiating; doneCb.current = onCompleted; }, [onNegotiating, onCompleted]);

  useEffect(() => {
    setMessages([]);
    setTyping(null);
    setClosed(false);
    idxRef.current = 0;
    completedRef.current = false;
    negotiatedRef.current = false;

    let timeoutId: ReturnType<typeof setTimeout>;
    const baseGap = accelerated ? 900 : 1700;
    const baseTyping = accelerated ? 350 : 600;

    const tick = () => {
      if (idxRef.current >= seller.script.length) {
        // Conversation finished. Hold for ~3s with a "Closed" badge, then signal completion.
        if (!completedRef.current) {
          completedRef.current = true;
          setClosed(true);
          timeoutId = setTimeout(() => doneCb.current(), 3000);
        }
        return;
      }
      const next = seller.script[idxRef.current++];
      // Fire negotiation event the first time the OWNER replies
      if (next.role === "owner" && !negotiatedRef.current) {
        negotiatedRef.current = true;
        negCb.current();
      }
      setTyping({ role: next.role });
      timeoutId = setTimeout(() => {
        setTyping(null);
        setMessages((prev) => [...prev, {
          id: `m-${Date.now()}-${Math.random()}`,
          body: next.body, role: next.role,
        }].slice(-5));
        timeoutId = setTimeout(tick, baseGap + Math.random() * 600);
      }, baseTyping + Math.random() * 300);
    };

    timeoutId = setTimeout(tick, 300 + Math.random() * 500);
    return () => clearTimeout(timeoutId);
  }, [seller, accelerated]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const closedColor = seller.outcome === "agreed" ? "emerald" : "slate";

  return (
    <div className="surface p-3 overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 text-[10px] mb-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 text-slate-400">
          <span className="font-medium text-slate-600 truncate">{seller.owner}</span>
          <span>·</span>
          <span className="truncate">{seller.city}, {seller.state}</span>
        </div>
        {closed && (
          <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
            closedColor === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}>
            {seller.outcome === "agreed" ? `✓ $${seller.agreedPrice?.toLocaleString()}` : "Passed"}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5 scroll-smooth">
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
