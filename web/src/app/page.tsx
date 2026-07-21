import Hero from "@/components/Hero";
import BuyBoxDemo from "@/components/BuyBoxDemo";
import LiveNegotiation from "@/components/LiveNegotiation";
import HowItWorks from "@/components/HowItWorks";
import Comparison from "@/components/Comparison";
import WhoWeAre from "@/components/WhoWeAre";
import Testimonial from "@/components/Testimonial";
import ClosingCTA from "@/components/ClosingCTA";
import SiteFooter from "@/components/SiteFooter";
import ScrollToTop from "@/components/ScrollToTop";

export default function Home() {
  return (
    <main className="landing-dark min-h-screen bg-background text-foreground">
      <ScrollToTop />
      <Hero />
      <BuyBoxDemo />
      <LiveNegotiation />
      <HowItWorks />
      <Comparison />
      <WhoWeAre />
      <Testimonial />
      <ClosingCTA />
      <SiteFooter />
    </main>
  );
}
