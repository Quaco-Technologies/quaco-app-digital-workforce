"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings as SettingsIcon, LogOut, Download, X, MoreHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Mobile-only floating action button. Single tap → menu with the rare
// stuff (Settings, Install, Sign out). Replaces the noisy bottom nav.
export function MobileFAB() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
  };

  return (
    <div ref={ref} className="md:hidden fixed bottom-5 right-5 z-40" style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-44 bg-white rounded-xl shadow-[0_8px_32px_-8px_rgba(15,23,42,0.20),0_0_0_1px_rgba(15,23,42,0.06)] overflow-hidden animate-fade-up">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50"
          >
            <SettingsIcon size={14} strokeWidth={1.75} /> Settings
          </Link>
          <Link
            href="/install"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} strokeWidth={1.75} /> Install app
          </Link>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-rose-600 hover:bg-rose-50"
          >
            <LogOut size={14} strokeWidth={1.75} /> Sign out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-11 h-11 rounded-full bg-white shadow-[0_4px_16px_-4px_rgba(15,23,42,0.18),0_0_0_1px_rgba(15,23,42,0.06)] flex items-center justify-center text-slate-700 active:scale-95 transition-transform"
      >
        {open ? <X size={18} strokeWidth={1.75} /> : <MoreHorizontal size={18} strokeWidth={1.75} />}
      </button>
    </div>
  );
}
