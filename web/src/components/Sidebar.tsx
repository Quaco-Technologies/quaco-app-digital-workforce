"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Folder, Play, Settings, Zap, LogOut, Inbox,
  LayoutGrid, BarChart3, FileSignature, Repeat,
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
      { href: "/leads",     label: "Leads",          icon: Folder },
      { href: "/campaigns", label: "Campaigns",      icon: Folder },
      { href: "/pipeline",  label: "Run New",        icon: Play },
    ],
  },
  {
    heading: "Communication",
    items: [
      { href: "/inbox",     label: "Inbox",     icon: Inbox },
      { href: "/sequences", label: "Sequences", icon: Repeat },
    ],
  },
  {
    heading: "Outcomes",
    items: [
      { href: "/contracts", label: "Contracts", icon: FileSignature },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
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
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-white font-semibold tracking-tight text-sm">
          Quaco
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
              {section.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive(href)
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                  )}
                >
                  <Icon size={15} />
                  <span className="flex-1">{label}</span>
                  {href === "/inbox" && unread > 0 && (
                    <span className="text-[10px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-zinc-800 space-y-1">
        {user && (
          <div className="px-3 py-2">
            <p className="text-xs text-zinc-400 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
