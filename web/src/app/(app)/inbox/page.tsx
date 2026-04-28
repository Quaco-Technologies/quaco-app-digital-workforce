"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { InboxThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Inbox as InboxIcon, MessageSquare } from "lucide-react";
import { LiveDot } from "@/components/LiveDot";
import { LiveMessageFeed } from "@/components/LiveMessageFeed";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export default function InboxPage() {
  const [threads, setThreads] = useState<InboxThread[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.inbox.list().then(setThreads).catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const unreadCount = threads?.filter((t) => t.has_unread_reply).length ?? 0;

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
              <InboxIcon size={22} className="text-blue-600" /> Inbox
            </h1>
            <LiveDot color="red" label="LIVE" />
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Real-time conversations with property owners.
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {unreadCount} new {unreadCount === 1 ? "reply" : "replies"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Thread list */}
        <div className="col-span-2">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
              Couldn&apos;t load inbox: {error}
            </div>
          )}

          {!error && threads === null && (
            <div className="text-sm text-zinc-400 py-12 text-center">Loading…</div>
          )}

          {!error && threads && threads.length === 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center">
              <MessageSquare size={28} className="mx-auto text-zinc-300 mb-3" />
              <p className="font-medium text-zinc-700">No conversations yet</p>
              <p className="text-sm text-zinc-500 mt-1">
                Once outreach goes out and an owner replies, threads will land here.
              </p>
            </div>
          )}

          {!error && threads && threads.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-100 stagger-children">
              {threads.map((t) => (
                <Link
                  key={t.lead_id}
                  href={`/leads/${t.lead_id}`}
                  className={cn(
                    "block px-5 py-4 hover:bg-zinc-50 transition-all",
                    t.has_unread_reply && "bg-emerald-50/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {t.has_unread_reply && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                        )}
                        <p className="font-semibold text-zinc-900 truncate">
                          {t.owner_name ?? "Unknown owner"}
                        </p>
                        <span className="text-xs text-zinc-400 shrink-0">
                          {relativeTime(t.last_sent_at)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        {t.address}{t.city ? `, ${t.city}` : ""}{t.state ? `, ${t.state}` : ""}
                      </p>
                      <p className="text-sm text-zinc-700 mt-2 line-clamp-2">
                        <span className={cn(
                          "font-medium mr-1",
                          t.last_role === "owner" ? "text-emerald-700" : "text-zinc-500"
                        )}>
                          {t.last_role === "owner" ? "Owner:" : "You:"}
                        </span>
                        {t.last_body}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-400 shrink-0">
                      {t.message_count} msg{t.message_count === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Live feed */}
        <div className="col-span-1">
          <LiveMessageFeed heading="Network Activity" />
        </div>
      </div>
    </div>
  );
}
