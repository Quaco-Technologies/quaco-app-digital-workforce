// Short, members-only landing for birdog.ai — keeps the site's dark, glowing
// style but exists only to send members to sign in. The full marketing sections
// still live in src/components and can be reassembled later if needed.
export default function Home() {
  return (
    <main className="landing-dark relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Background ambience — same primitives as the main site hero */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="hero-grain" />
      <div className="hero-glow" />

      {/* Navbar */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-4 md:px-20">
        <a href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/birdog-logo-white.png"
            alt="Birdog"
            className="h-20 w-auto object-contain md:h-24"
          />
        </a>
        <a
          href="/login"
          className="rounded-lg bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Member login
        </a>
      </nav>

      {/* Hero */}
      <div className="relative z-20 mx-auto mt-24 flex max-w-3xl flex-col items-center px-4 text-center md:mt-32">
        <div className="liquid-glass mb-6 flex items-center gap-2 rounded-lg px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-sm font-medium text-muted-foreground">Members only</span>
        </div>

        <h1 className="mb-4 text-5xl font-medium leading-tight tracking-[-2px] md:text-7xl md:leading-[1.05]">
          Off-Market Deals.
          <br />
          Found on <span className="font-serif font-normal italic">Autopilot.</span>
        </h1>

        <p className="hero-subtitle mb-8 max-w-xl text-lg font-normal leading-7 opacity-90">
          BirdDog finds motivated sellers and their phone numbers — so you can
          pick up the phone and close the deal.
        </p>

        <a
          href="/login"
          className="cta-glow rounded-full bg-foreground px-8 py-3.5 text-base font-medium text-background"
        >
          Member Login
        </a>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs uppercase tracking-[0.18em] text-white/40">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
            Invite only
          </span>
          <span className="hidden h-3 w-px bg-white/15 md:block" />
          <span>For real estate investors</span>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-40"
        style={{ background: "linear-gradient(to top, hsl(0 0% 0%) 0%, transparent 100%)" }}
      />
    </main>
  );
}
