"use client";

import { Search, Bell, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function TopNav() {
  const [initial, setInitial] = useState("?");
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const e = data.user?.email ?? "";
      setInitial((e.charAt(0) || "?").toUpperCase());
    });
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-[#ebeae5]/85 backdrop-blur-md border-b border-slate-200/40">
      <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center gap-4">
        {/* Search */}
        <div className="flex-1 max-w-xl relative">
          <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search or jump to…"
            className="w-full bg-white/70 hover:bg-white border border-slate-200/60 rounded-full pl-9 pr-4 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 transition-all"
          />
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2">
          <button className="w-8 h-8 rounded-full hover:bg-white/60 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors">
            <Bell size={15} strokeWidth={1.75} />
          </button>
          <button className="w-8 h-8 rounded-full hover:bg-white/60 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors">
            <SettingsIcon size={15} strokeWidth={1.75} />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-[12px] font-semibold text-white ring-2 ring-white/60">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
