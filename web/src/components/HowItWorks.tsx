'use client';

import { motion } from 'motion/react';
import { Database, Phone, MessageSquare, FileSignature } from 'lucide-react';

const STEPS = [
  {
    icon: Database,
    title: 'Scrape',
    body:
      'Birdog pulls 10,000+ off-market leads every day — public records, vacant property lists, MLS expirations, code violations, pre-foreclosure. The deals nobody else sees.',
    metric: '10k+ leads / day',
  },
  {
    icon: Phone,
    title: 'Skip trace',
    body:
      'Owner phone numbers, validated. Cross-checked against carrier and litigation databases so you only spend texts on real, reachable, motivated owners.',
    metric: '94% number accuracy',
  },
  {
    icon: MessageSquare,
    title: 'Negotiate',
    body:
      'Claude-powered agents send the first text, follow up on objections, counter offers, and walk owners through cash terms. They learn from every reply across the network.',
    metric: 'Avg first reply in 11s',
  },
  {
    icon: FileSignature,
    title: 'Close',
    body:
      "When a number's agreed, the contract is generated, sent via Lumin e-sign, and the closing is booked with your title company. You wake up to deals on the calendar.",
    metric: 'Contract → close in 14d',
  },
];

export default function HowItWorks() {
  return (
    <section className="landing-dark relative overflow-hidden px-6 py-24 md:px-12 md:py-32 lg:px-24">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full blur-[110px]"
        style={{
          background:
            'radial-gradient(circle, rgba(56,189,248,0.16), transparent 60%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-16 max-w-2xl md:mb-20">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            How it works
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-3 text-4xl font-medium leading-[1.05] tracking-[-1.5px] md:text-6xl"
          >
            From cold list to{' '}
            <span className="font-serif font-normal italic">closed contract.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="hero-subtitle mt-5 text-base opacity-90 md:text-lg"
          >
            Four stages, fully automated. You set the budget and the markets — Birdog
            does the rest.
          </motion.p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="liquid-glass group relative flex flex-col rounded-2xl border border-white/10 p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
                    Step {String(i + 1).padStart(2, '0')}
                  </span>
                  <Icon className="h-5 w-5 text-white/70" strokeWidth={1.5} />
                </div>
                <h3 className="mt-6 text-2xl font-medium tracking-tight text-white md:text-3xl">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/60">{step.body}</p>
                <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
                  <span className="text-xs font-medium tabular-nums text-white/80">
                    {step.metric}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
