"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Dark top bar with the white BirdDog mark — matches the login/landing brand.
export default function AppHeader() {
  const router = useRouter();
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 bg-black border-b border-white/10">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/skiptrace" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/birdog-logo-white.png" alt="BirdDog" className="h-11 w-auto object-contain" />
        </a>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <LogOut size={15} />
          Log out
        </button>
      </div>
    </header>
  );
}
