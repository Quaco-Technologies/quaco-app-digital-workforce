"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Folder, Play, Settings, Zap, LogOut, Inbox,
  LayoutGrid, BarChart3, FileSignature, Repeat, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { api } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavSection {
  heading?: string;
  items: NavItem[];
}

// Hidden but still routable: /demo, /leads, /inbox, /analytics — pages exist,
// just not in nav. Direct URLs and inter-page Links continue to work.
const sections: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    heading: "Pipeline",
    items: [
      { href: "/board",     label: "Pipeline Board", icon: LayoutGrid },
      { href: "/campaigns", label: "Campaigns",      icon: Folder },
      { href: "/pipeline",  label: "Run New",        icon: Play },
    ],
  },
  {
    heading: "Communication",
    items: [
      { href: "/sequences", label: "Sequences", icon: Repeat },
    ],
  },
  {
    heading: "Outcomes",
    items: [
      { href: "/contracts", label: "Contracts", icon: FileSignature },
    ],
  },
  {
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [unread, setUnread] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      api.inbox.list()
        .then((threads) => {
          if (!cancelled) setUnread(threads.filter((t) => t.has_unread_reply).length);
        })
        .catch(() => { /* sidebar badge is best-effort */ });
    };
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [path]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/leads") return path === "/leads" || path.startsWith("/leads/");
    if (href === "/campaigns") return path === "/campaigns" || path.startsWith("/campaigns/");
    return path === href || path.startsWith(`${href}/`);
  };

  return (
    <aside className="w-60 shrink-0 bg-[#0a0e1a] border-r border-white/5 min-h-screen flex flex-col">
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-white/5">
        <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/40">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/20 to-transparent" />
          <Zap size={14} className="relative text-white" fill="currentColor" />
        </div>
        <div className="flex flex-col">
          <span className="text-white font-semibold tracking-tight text-[15px] leading-none">Birddogs</span>
          <span className="text-[9px] text-zinc-500 uppercase tracking-[0.18em] mt-0.5">Acquisition OS</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {sections.map((section, i) => (
          <div key={i}>
            {section.heading && (
              <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-[0.16em] px-3 mb-1">
                {section.heading}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "relative flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-150",
                      active
                        ? "bg-white/5 text-white font-medium ring-1 ring-white/10"
                        : "text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.03]"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-2 bottom-2 w-px bg-cyan-400" />
                    )}
                    <Icon size={14} strokeWidth={1.75} className={active ? "text-cyan-400" : ""} />
                    <span className="flex-1">{label}</span>
                    {href === "/inbox" && unread > 0 && (
                      <span className="text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30 px-1.5 py-0.5 rounded min-w-[18px] text-center">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/5 space-y-0.5">
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-md">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0 ring-1 ring-white/10">
              {(user.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <p className="text-[12px] text-zinc-300 truncate min-w-0">{user.email}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] text-zinc-500 hover:text-white hover:bg-white/[0.03] transition-colors"
        >
          <LogOut size={14} strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
