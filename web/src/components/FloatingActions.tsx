"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Settings as SettingsIcon, LogOut, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Floating triangular cluster of 3 circles in the top-right corner.
// Notifications on top, Settings + Avatar on the bottom row.
// Each circle morphs into a soft "liquid blob" on hover (animated
// border-radius + scale + glow).
export function FloatingActions() {
  const router = useRouter();
  const supabase = createClient();
  const [initial, setInitial] = useState("?");
  const [email, setEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const signOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  return (
    <div className="fixed top-5 right-5 z-40 hidden md:block">
      {/* Triangle cluster: bell on top, gear + avatar on bottom row */}
      <div className="flex flex-col items-center gap-2">
        <button aria-label="Notifications" className="blob blob-light">
          <Bell size={15} strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-2">
          <Link href="/settings" aria-label="Settings" className="blob blob-light">
            <SettingsIcon size={15} strokeWidth={1.75} />
          </Link>

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account"
              className="blob blob-accent"
            >
              <span className="text-[12px] font-semibold text-white">{initial}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-3 w-56 bg-white rounded-2xl shadow-[0_8px_32px_-8px_rgba(15,23,42,0.16),0_0_0_1px_rgba(15,23,42,0.04)] overflow-hidden animate-fade-up">
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
    </div>
  );
}
