"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Light top bar matching the page below it, with the dark BirdDog mark (which
// reads cleanly on white) and a Log out action.
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
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/skiptrace" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/birdog-logo-dark.png" alt="BirdDog" className="h-10 w-auto object-contain" />
        </a>
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
