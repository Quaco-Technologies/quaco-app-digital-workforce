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
      {/* Ambient blue→emerald gradient backdrop, washes across whole app */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-50 via-white to-emerald-50" />
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[420px] h-[420px] bg-emerald-200/25 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[380px] h-[380px] bg-cyan-200/20 rounded-full blur-3xl" />
      </div>
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
