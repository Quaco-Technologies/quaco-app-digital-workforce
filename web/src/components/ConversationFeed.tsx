"use client";

import { useState } from "react";
import { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Send } from "lucide-react";

interface Props {
  messages: Message[];
  leadId?: string;
  canReply?: boolean;
  onReplySent?: (msg: Message) => void;
}

export function ConversationFeed({ messages, leadId, canReply = false, onReplySent }: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!leadId || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.inbox.reply(leadId, draft.trim());
      onReplySent?.(res.message);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <h3 className="font-semibold text-zinc-900 mb-4">SMS Conversation</h3>

      {messages.length === 0 ? (
        <p className="text-sm text-zinc-400">No messages yet.</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "agent" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-xs px-4 py-2.5 rounded-2xl text-sm",
                  msg.role === "agent"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.body}</p>
                <p
                  className={cn(
                    "text-[10px] mt-1",
                    msg.role === "agent" ? "text-indigo-200" : "text-zinc-400"
                  )}
                >
                  {new Date(msg.sent_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {canReply && leadId && (
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Send a manual reply…"
              disabled={sending}
              className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-indigo-400 disabled:bg-zinc-50"
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Send size={14} />
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600 mt-2">{error}</p>
          )}
          <p className="text-[11px] text-zinc-400 mt-2">
            Manual replies bypass the AI negotiation agent.
          </p>
        </div>
      )}
    </div>
  );
}
