import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { MobileHeader } from "@/components/MobileHeader";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Check if onboarding is complete; redirect new users to onboarding flow
  try {
    const res = await fetch(`${API_BASE}/onboarding/profile`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const profile = await res.json();
      if (!profile || !profile.onboarding_completed) {
        redirect("/onboarding");
      }
    }
  } catch {
    // If the API is unreachable during SSR, let the user through — don't block access
  }

  return (
    <div className="flex min-h-screen relative">
      {/* Mercury-style warm cream canvas — smooth, no grid */}
      <div className="fixed inset-0 -z-20 bg-canvas" />
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto relative pb-20 md:pb-0">
        <MobileHeader />
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
