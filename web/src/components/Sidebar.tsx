"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Folder, Play, Settings, Zap, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

const nav = [
  { href: "/dashboard",  label: "Dashboard",    icon: LayoutDashboard },
  { href: "/campaigns",  label: "Campaigns",    icon: Folder },
  { href: "/pipeline",   label: "Run Pipeline", icon: Play },
  { href: "/settings",   label: "Settings",     icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="w-56 shrink-0 bg-zinc-950 min-h-screen flex flex-col">
      <div className="px-5 py-6 flex items-center gap-2 border-b border-zinc-800">
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-white font-semibold tracking-tight text-sm">
          Quaco
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              path.startsWith(href)
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            )}
          >
            <Icon size={15} />
            {label}
          </Link>
        ))}
      </nav>

      {/* User + sign out */}
      <div className="px-3 py-4 border-t border-zinc-800 space-y-1">
        {user && (
          <div className="px-3 py-2">
            <p className="text-xs text-zinc-400 truncate">
              {user.email}
            </p>
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
