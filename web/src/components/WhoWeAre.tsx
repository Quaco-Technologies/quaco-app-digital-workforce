'use client';

import { motion } from 'motion/react';

export default function WhoWeAre() {
  return (
    <section className="landing-dark relative overflow-hidden px-6 py-24 md:px-12 md:py-32 lg:px-24">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, rgba(168,85,247,0.16), transparent 60%)',
        }}
      />

      <div className="relative mx-auto max-w-3xl">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            Who we are
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-3 text-4xl font-medium leading-[1.05] tracking-[-1.5px] md:text-6xl"
          >
            We&apos;re builders. Investors.{' '}
            <span className="font-serif font-normal italic">Tired</span> of the old
            way.
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-8 space-y-5 text-base leading-7 text-white/70 md:text-lg md:leading-8"
          >
            <p>
              We started Birdog because we&apos;d been the bird-dog. We&apos;d sat
              in the Facebook group at midnight watching the same wholesalers post
              the same pre-shopped deals to 40,000 strangers. We&apos;d paid agents
              6% to forward us listings every other investor on the MLS already had.
            </p>
            <p>
              We knew the work: scrape lists, skip trace, send 500 texts, follow up,
              negotiate, follow up again, lose half the deals to slow replies.
              That&apos;s not a job — that&apos;s a{' '}
              <span className="font-serif italic text-white">team.</span> A team
              most investors can&apos;t afford.
            </p>
            <p>
              So we built the team. Birdog runs the entire acquisition pipeline
              with Claude-powered agents that text, negotiate, and close around the
              clock. No bird-dog markup. No agent commission. No spammy group of
              strangers. Just deals, in your inbox, signed.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <a
              href="/waitlist"
              className="cta-glow rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background"
            >
              Start your first market
            </a>
            <a
              href="#pipeline"
              className="liquid-glass rounded-full border border-white/15 px-7 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/[0.04]"
            >
              See it negotiate
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
