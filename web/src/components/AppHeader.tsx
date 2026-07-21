"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Minimal top bar for the signed-in BirdDog buy box tool. Deliberately not the
// old Digital Workforce nav (dashboard/inbox/pipeline/…) — this product is just
// the buy box search + history.
export default function AppHeader() {
  const router = useRouter();
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/birdog-logo.png" alt="BirdDog" width={28} height={28} className="rounded" />
          <span className="font-semibold text-slate-900 tracking-tight">BirdDog</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <LogOut size={15} />
          Log out
        </button>
      </div>
    </header>
  );
}
