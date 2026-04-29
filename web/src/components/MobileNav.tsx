"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, Inbox, Folder, MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/dashboard", label: "Home",   icon: LayoutDashboard },
  { href: "/demo",      label: "Demo",   icon: Sparkles },
  { href: "/inbox",     label: "Inbox",  icon: Inbox },
  { href: "/leads",     label: "Leads",  icon: Folder },
  { href: "#more",      label: "More",   icon: MoreHorizontal },
];

const MORE_LINKS = [
  { href: "/board",     label: "Pipeline Board" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/pipeline",  label: "Run New" },
  { href: "/sequences", label: "Sequences" },
  { href: "/contracts", label: "Contracts" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings",  label: "Settings" },
];

export function MobileNav() {
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      api.inbox.list()
        .then((threads) => { if (!cancelled) setUnread(threads.filter((t) => t.has_unread_reply).length); })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Close the More sheet on route change
  useEffect(() => { setMoreOpen(false); }, [path]);

  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);

  return (
    <>
      {/* Bottom tab bar — visible only on mobile */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/85 backdrop-blur-xl border-t border-zinc-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="grid grid-cols-5 h-16">
          {PRIMARY.map(({ href, label, icon: Icon }) => {
            const active = href !== "#more" && isActive(href);
            const isMoreActive = href === "#more" && moreOpen;
            const node = (
              <div className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 transition-colors",
                active || isMoreActive ? "text-blue-600" : "text-zinc-500"
              )}>
                <div className="relative">
                  <Icon size={20} />
                  {href === "/inbox" && unread > 0 && (
                    <span className="absolute -top-1.5 -right-2 text-[9px] font-bold bg-gradient-to-br from-blue-500 to-emerald-500 text-white rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shadow-md">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{label}</span>
                {(active || isMoreActive) && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b bg-gradient-to-r from-blue-500 to-emerald-500" />
                )}
              </div>
            );
            if (href === "#more") {
              return (
                <button key={href} onClick={() => setMoreOpen((v) => !v)} className="text-left">
                  {node}
                </button>
              );
            }
            return <Link key={href} href={href} aria-label={label}>{node}</Link>;
          })}
        </div>
      </nav>

      {/* "More" bottom sheet */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end animate-fade-in"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-3xl shadow-2xl pt-3 pb-8 animate-fade-up"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1.5rem)" }}
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-zinc-200 mb-4" />
            <div className="px-4 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 px-2">More</p>
              <div className="grid grid-cols-2 gap-2">
                {MORE_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "px-4 py-3 rounded-xl border text-sm font-medium transition-colors",
                      isActive(l.href)
                        ? "bg-gradient-to-br from-blue-50 to-emerald-50 border-blue-200 text-blue-700"
                        : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
