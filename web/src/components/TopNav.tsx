"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, Settings as SettingsIcon, Zap, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV: Array<{ href: string; label: string }> = [
  { href: "/dashboard",  label: "Home" },
  { href: "/board",      label: "Pipeline" },
  { href: "/contracts",  label: "Contracts" },
];

export function TopNav() {
  const path = usePathname();
  const router = useRouter();
  const [initial, setInitial] = useState("?");
  const [email, setEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const e = data.user?.email ?? "";
      setEmail(e);
      setInitial((e.charAt(0) || "?").toUpperCase());
    });
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);
  const signOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  return (
    <header className="sticky top-0 z-30 bg-[#ebeae5]/85 backdrop-blur-xl border-b border-slate-200/40">
      <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center gap-6">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/30">
            <Zap size={13} className="text-white" fill="currentColor" />
          </div>
          <span className="text-slate-900 font-semibold tracking-tight text-[14px]">Birddogs</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "px-3 py-1.5 text-[13px] rounded-full transition-colors",
                isActive(n.href)
                  ? "text-slate-900 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Search */}
        <div className="flex-1 max-w-sm relative ml-auto">
          <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search…"
            className="w-full bg-white/70 hover:bg-white border border-slate-200/60 rounded-full pl-9 pr-4 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 transition-all"
          />
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 rounded-full hover:bg-white/60 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors">
            <Bell size={15} strokeWidth={1.75} />
          </button>
          <Link href="/settings" className="w-8 h-8 rounded-full hover:bg-white/60 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors">
            <SettingsIcon size={15} strokeWidth={1.75} />
          </Link>
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-[12px] font-semibold text-white ring-2 ring-white/60 hover:ring-white transition-all"
            >
              {initial}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_8px_32px_-8px_rgba(15,23,42,0.16),0_0_0_1px_rgba(15,23,42,0.06)] overflow-hidden animate-fade-up">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-[13px] font-medium text-slate-900 truncate">{email?.split("@")[0]}</p>
                  <p className="text-[11px] text-slate-500 truncate">{email}</p>
                </div>
                <div className="py-1">
                  <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                    <SettingsIcon size={13} strokeWidth={1.75} /> Settings
                  </Link>
                  <Link href="/install" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                    <Zap size={13} strokeWidth={1.75} /> Install app
                  </Link>
                  <button onClick={signOut} className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-rose-600 hover:bg-rose-50">
                    <LogOut size={13} strokeWidth={1.75} /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
