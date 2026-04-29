"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Sparkles, Send, RefreshCw, Loader2 } from "lucide-react";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Insight {
  headline: string;
  body: string;
}

const STARTERS = [
  "Where's my biggest bottleneck?",
  "What should I focus on this week?",
  "How's my reply rate trending?",
];

export function AIChat() {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(true);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadInsight = () => {
    setLoadingInsight(true);
    api.insights.activity()
      .then((d) => setInsight({ headline: d.headline, body: d.body }))
      .catch(() => setInsight({ headline: "Insight unavailable", body: "Refresh to try again." }))
      .finally(() => setLoadingInsight(false));
  };

  useEffect(() => { loadInsight(); }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat, sending]);

  const send = async (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body || sending) return;
    const next: ChatMsg[] = [...chat, { role: "user", content: body }];
    setChat(next);
    setDraft("");
    setSending(true);
    try {
      const res = await api.insights.chat(next);
      setChat([...next, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setChat([...next, { role: "assistant", content: "Couldn't reach the AI. Try again." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-black/30 backdrop-blur-md rounded-xl border border-white/30 flex flex-col h-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white">
          <Sparkles size={12} />
          <span>AI Analyst</span>
        </div>
        <button
          onClick={loadInsight}
          disabled={loadingInsight}
          className="text-white/80 hover:text-white transition-colors disabled:opacity-40"
          title="Regenerate insight"
        >
          <RefreshCw size={12} className={loadingInsight ? "animate-spin" : ""} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[180px] max-h-[260px]">
        {/* Initial insight as the first "assistant" turn */}
        {loadingInsight && !insight ? (
          <div className="space-y-2">
            <div className="h-3 bg-white/30 rounded w-2/3 animate-pulse" />
            <div className="h-3 bg-white/30 rounded w-full animate-pulse" />
          </div>
        ) : insight ? (
          <div className="animate-fade-in">
            <p className="text-sm font-semibold text-white mb-1 leading-snug">{insight.headline}</p>
            <p className="text-xs text-white/95 leading-relaxed break-words">{insight.body}</p>
          </div>
        ) : null}

        {/* Chat turns */}
        {chat.map((m, i) => (
          <div key={i} className={`flex animate-slide-in ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed break-words ${
                m.role === "user"
                  ? "bg-white text-zinc-900 rounded-br-sm"
                  : "bg-white/15 text-white rounded-bl-sm border border-white/20"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start animate-slide-in">
            <div className="px-3 py-2 rounded-xl bg-white/15 border border-white/20 text-white">
              <Loader2 size={11} className="animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Starter chips */}
      {chat.length === 0 && !sending && (
        <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[10px] font-medium text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 px-2 py-1 rounded-md transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-1 flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about your pipeline…"
          disabled={sending}
          className="flex-1 min-w-0 bg-white/10 border border-white/20 text-white placeholder-white/60 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-white/40 disabled:opacity-50"
        />
        <button
          onClick={() => send()}
          disabled={sending || !draft.trim()}
          className="bg-white text-blue-700 disabled:bg-white/40 disabled:text-white/60 disabled:cursor-not-allowed text-xs font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-1"
        >
          <Send size={11} />
        </button>
      </div>
    </div>
  );
}
