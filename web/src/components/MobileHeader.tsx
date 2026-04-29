"use client";

import { Zap } from "lucide-react";
import { LiveDot } from "@/components/LiveDot";

export function MobileHeader() {
  return (
    <header
      className="md:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-zinc-200/80 px-4 py-3 flex items-center justify-between"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0) + 0.75rem)" }}
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/30">
          <Zap size={14} className="text-white" />
        </div>
        <span className="font-semibold tracking-tight text-zinc-900">Birddogs</span>
      </div>
      <LiveDot color="red" label="LIVE" />
    </header>
  );
}
