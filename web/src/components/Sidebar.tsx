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
    <aside className="w-60 shrink-0 bg-[#faf9f6] border-r border-slate-200/60 min-h-screen flex flex-col">
      <div className="px-4 py-4 flex items-center gap-2.5 border-b border-slate-200/60">
        <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/30">
          <Zap size={13} className="relative text-white" fill="currentColor" />
        </div>
        <div className="flex flex-col">
          <span className="text-slate-900 font-semibold tracking-tight text-[14px] leading-none">Birddogs</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {sections.map((section, i) => (
          <div key={i}>
            {section.heading && (
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] px-3 mb-1">
                {section.heading}
              </p>
            )}
            <div className="space-y-px">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-150",
                      active
                        ? "bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.05),0_0_0_1px_rgba(15,23,42,0.06)]"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    )}
                  >
                    <Icon size={14} strokeWidth={1.75} className={active ? "text-slate-900" : "text-slate-500"} />
                    <span className="flex-1">{label}</span>
                    {href === "/inbox" && unread > 0 && (
                      <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded min-w-[18px] text-center">
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

      <div className="px-3 py-3 border-t border-slate-200/60 space-y-0.5">
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-md">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
              {(user.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-slate-900 truncate leading-tight">{user.email?.split("@")[0]}</p>
              <p className="text-[10px] text-slate-500 truncate leading-tight">{user.email?.split("@")[1]}</p>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] text-slate-500 hover:text-slate-900 hover:bg-white/60 transition-colors"
        >
          <LogOut size={14} strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
