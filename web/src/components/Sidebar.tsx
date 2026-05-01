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
    <aside className="w-60 shrink-0 bg-zinc-950 min-h-screen flex flex-col">
      <div className="px-5 py-6 flex items-center gap-2 border-b border-zinc-800">
        <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-white font-semibold tracking-tight text-sm">
          Birddogs
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {sections.map((section, i) => (
          <div key={i}>
            {section.heading && (
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-3 mb-1.5">
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
                      "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                      active
                        ? "bg-gradient-to-r from-blue-500/20 to-emerald-500/10 text-white font-medium shadow-inner"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900/80 hover:translate-x-0.5"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-gradient-to-b from-blue-400 to-emerald-400" />
                    )}
                    <Icon size={15} className={active ? "text-blue-300" : ""} />
                    <span className="flex-1">{label}</span>
                    {href === "/inbox" && unread > 0 && (
                      <span className="text-[10px] font-semibold bg-gradient-to-br from-blue-500 to-emerald-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-md shadow-blue-500/30">
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

      <div className="px-3 py-4 border-t border-zinc-800/60 space-y-1">
        {user && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {(user.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <p className="text-xs text-zinc-300 truncate min-w-0">{user.email}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
