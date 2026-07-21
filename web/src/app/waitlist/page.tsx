import Waitlist from "@/components/Waitlist";
import ScrollToTop from "@/components/ScrollToTop";

export default function WaitlistPage() {
  return (
    <main className="landing-dark min-h-screen bg-background text-foreground">
      <ScrollToTop />
      <Waitlist />
    </main>
  );
}
