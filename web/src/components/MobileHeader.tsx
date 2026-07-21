"use client";

import { LiveDot } from "@/components/LiveDot";

export function MobileHeader() {
  return (
    <header
      className="md:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-zinc-200/80 px-4 py-3 flex items-center justify-between"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0) + 0.75rem)" }}
    >
      <img
        src="/birdog-logo-dark.png"
        alt="Birdog"
        className="h-9 w-auto object-contain"
      />
      <LiveDot color="red" label="LIVE" />
    </header>
  );
}
