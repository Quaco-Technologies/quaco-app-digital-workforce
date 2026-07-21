'use client';

import { motion } from 'motion/react';

export default function ClosingCTA() {
  return (
    <section className="landing-dark relative overflow-hidden px-6 py-24 md:px-12 md:py-32 lg:px-24">
      <div className="orb orb-1" style={{ top: 'auto', bottom: '-100px', left: '-150px' }} />
      <div className="orb orb-2" style={{ top: 'auto', bottom: '-100px' }} />

      <div className="relative mx-auto max-w-4xl text-center">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-4xl font-medium leading-[1.05] tracking-[-1.5px] md:text-7xl"
        >
          Stop scrolling Facebook groups.{' '}
          <span className="font-serif font-normal italic">Start closing.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="hero-subtitle mx-auto mt-6 max-w-xl text-base opacity-90 md:text-lg"
        >
          Pick your markets. Set your numbers. Wake up to deals.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="/waitlist"
            className="cta-glow rounded-full bg-foreground px-8 py-3.5 text-base font-medium text-background"
          >
            Apply for access
          </a>
          <a
            href="mailto:kwabena@quacotech.com?subject=Birdog%20%E2%80%94%20chat%20with%20founder"
            className="liquid-glass rounded-full border border-white/15 px-8 py-3.5 text-base font-medium text-white/85 transition-colors hover:bg-white/[0.04]"
          >
            Talk to a founder
          </a>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 text-xs uppercase tracking-[0.2em] text-white/40"
        >
          Free to start · We earn only when you close · No monthly fees
        </motion.div>
      </div>
    </section>
  );
}
