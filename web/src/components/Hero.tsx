'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import LiveDashboard from './LiveDashboard';

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  const textY = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const dashboardY = useTransform(scrollYProgress, [0, 1], [0, -250]);

  return (
    <section
      ref={sectionRef}
      className="landing-dark relative min-h-screen overflow-hidden"
    >
      {/* Background ambience */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="hero-grain" />
      <div className="hero-glow" />

      {/* Navbar */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-4 md:px-28">
        <a href="/" className="flex items-center">
          <img
            src="/birdog-logo-white.png"
            alt="Birdog"
            className="h-24 w-auto object-contain md:h-28"
          />
        </a>
        <a
          href="/waitlist"
          className="rounded-lg bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Apply
        </a>
      </nav>

      {/* Hero text */}
      <motion.div
        style={{ y: textY, opacity: textOpacity }}
        className="relative z-20 mt-12 flex flex-col items-center px-4 text-center md:mt-16"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0 }}
          className="liquid-glass mb-6 flex items-center gap-2 rounded-lg px-3 py-2"
        >
          <span className="rounded-md bg-white px-2 py-0.5 text-sm font-medium text-black">
            June 1
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            500 Real estate investors · Apply now
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-4 text-5xl font-medium leading-tight tracking-[-2px] md:text-7xl md:leading-[1.05]"
        >
          Off-Market Deals.
          <br />
          Closed on{' '}
          <span className="font-serif font-normal italic">Autopilot.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="hero-subtitle mb-8 max-w-xl text-lg font-normal leading-7 opacity-90"
        >
          Birdog scrapes leads, skip traces, negotiates via SMS,
          <br className="hidden md:inline" />
          {' '}and sends contracts — while you sleep.
        </motion.p>

        <motion.a
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          href="/waitlist"
          className="cta-glow rounded-full bg-foreground px-8 py-3.5 text-base font-medium text-background"
        >
          Apply for access
        </motion.a>

        {/* Social proof strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs uppercase tracking-[0.18em] text-white/40"
        >
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
            Real estate cohort opening
          </span>
          <span className="hidden h-3 w-px bg-white/15 md:block" />
          <span>327 applications in</span>
          <span className="hidden h-3 w-px bg-white/15 md:block" />
          <span>Launch June 1, 2026</span>
        </motion.div>
      </motion.div>

      {/* Dashboard + video area — fixed aspect on desktop, intrinsic stack on mobile */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="relative mt-16 w-screen md:[aspect-ratio:16/9]"
        style={{ marginLeft: 'calc(-50vw + 50%)' }}
      >
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        {/* Very light dim — keep video texture visible through glass */}
        <div className="pointer-events-none absolute inset-0 bg-black/15" />
        {/* On mobile: dashboard sits inline with vertical padding. On desktop: floats centered with parallax. */}
        <motion.div
          style={{ y: dashboardY }}
          className="relative mx-auto w-[95%] max-w-[1500px] overflow-hidden rounded-2xl py-8 shadow-[0_40px_140px_-20px_rgba(0,0,0,0.85)] md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:py-0"
        >
          <LiveDashboard />
        </motion.div>
      </motion.div>

      {/* Bottom gradient fade */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 h-40"
        style={{
          background:
            'linear-gradient(to top, hsl(0 0% 0%) 0%, transparent 100%)',
        }}
      />
    </section>
  );
}
