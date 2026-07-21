import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && process.env.NODE_ENV !== "development") {
    redirect("/login");
  }

  // The BirdDog buy box tool is the whole signed-in experience — a clean header
  // over the page, no old Digital Workforce nav or onboarding gate.
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main>{children}</main>
    </div>
  );
}
