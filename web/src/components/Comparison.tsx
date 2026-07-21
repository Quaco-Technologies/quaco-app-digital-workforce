'use client';

import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';

type Column = 'fb' | 'tools' | 'wholesalers';
type Row = {
  feature: string;
  fb: string;
  tools: string;
  wholesalers: string;
  us: string;
};

const ROWS: Row[] = [
  {
    feature: 'Cost',
    fb: 'Free + your time',
    tools: '$99–$199 / mo + per-lead fees',
    wholesalers: '30–50% spread fee, every deal',
    us: 'Free. Finders fee only when you close',
  },
  {
    feature: 'Lead quality',
    fb: 'Already shopped to 40k strangers',
    tools: 'Stale public-record lists everyone has',
    wholesalers: 'Pre-pitched. The deal already got the bid war',
    us: 'Off-market, sourced fresh, exclusive to you',
  },
  {
    feature: 'Outreach',
    fb: 'You DM at midnight',
    tools: 'You hand-text with their dialer',
    wholesalers: 'You wait for their text',
    us: 'AI texts, follows up, negotiates 24/7',
  },
  {
    feature: 'Speed to first contact',
    fb: 'Hours, if you remember',
    tools: 'Whenever you log in',
    wholesalers: 'Their schedule, not yours',
    us: '11 seconds — fully automated',
  },
  {
    feature: 'Hours per week',
    fb: '20+ scrolling, copy-pasting',
    tools: '15+ texting, dialing, exporting',
    wholesalers: '10+ chasing & negotiating',
    us: 'Set buybox once. Walk away.',
  },
  {
    feature: 'Risk if no deal closes',
    fb: 'Wasted nights',
    tools: 'You still pay $200 for the spam list',
    wholesalers: 'Locked into bad spreads',
    us: '$0. We only earn when you close.',
  },
];

const COLS: Array<{ key: Column; title: string; sub: string }> = [
  { key: 'fb', title: 'Facebook groups', sub: 'The "free" hustle' },
  { key: 'tools', title: 'DealMachine / PropStream', sub: '$99–$199 / month' },
  { key: 'wholesalers', title: 'Wholesalers', sub: '30%+ spread fee' },
];

export default function Comparison() {
  return (
    <section className="landing-dark relative overflow-hidden px-6 py-24 md:px-12 md:py-32 lg:px-24">
      <div
        className="pointer-events-none absolute -right-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[110px]"
        style={{
          background:
            'radial-gradient(circle, rgba(244,63,94,0.18), transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute -left-40 bottom-0 h-[500px] w-[500px] rounded-full blur-[110px]"
        style={{
          background:
            'radial-gradient(circle, rgba(99,102,241,0.18), transparent 60%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-12 max-w-3xl md:mb-16">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            The new standard
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-3 text-4xl font-medium leading-[1.05] tracking-[-1.5px] md:text-6xl"
          >
            How investors used to find deals.{' '}
            <span className="font-serif font-normal italic">And what kills it.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="hero-subtitle mt-5 max-w-2xl text-base opacity-90 md:text-lg"
          >
            Facebook groups, lead-buying tools, wholesalers — every other channel makes
            you pay before you close. Birdog earns only when you do.
          </motion.p>
        </div>

        {/* Desktop: full table grid */}
        <div className="hidden md:block">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-3 text-[11px] font-medium uppercase tracking-[0.18em]">
            <div className="col-span-3 text-white/40">Feature</div>
            {COLS.map((c) => (
              <ColumnHead key={c.key} title={c.title} sub={c.sub} tone="muted" />
            ))}
            <ColumnHead title="Birdog" sub="Free · finders fee on close" tone="brand" />
          </div>

          <div className="mt-3 space-y-2">
            {ROWS.map((row, i) => (
              <motion.div
                key={row.feature}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className="grid grid-cols-12 items-stretch gap-3"
              >
                <div className="col-span-3 flex items-center text-sm font-medium text-white/85">
                  {row.feature}
                </div>
                <ConCell text={row.fb} />
                <ConCell text={row.tools} />
                <ConCell text={row.wholesalers} />
                <ProCell text={row.us} highlight={row.feature === 'Cost'} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mobile: stack each row as a card with feature label + 4 mini-rows */}
        <div className="space-y-3 md:hidden">
          {ROWS.map((row, i) => (
            <motion.div
              key={row.feature}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
            >
              <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                {row.feature}
              </div>
              <div className="divide-y divide-white/[0.06]">
                <MobileRow label="Facebook groups" text={row.fb} good={false} />
                <MobileRow label="DealMachine / PropStream" text={row.tools} good={false} />
                <MobileRow label="Wholesalers" text={row.wholesalers} good={false} />
                <MobileRow label="Birdog" text={row.us} good highlight={row.feature === 'Cost'} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Free callout */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.05] p-6 md:flex-row md:items-center md:p-8"
        >
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
              Why it&apos;s free
            </div>
            <div className="mt-2 text-2xl font-medium leading-tight text-white md:text-3xl">
              We win when you win.{' '}
              <span className="font-serif italic text-emerald-200">No wins, no fee.</span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
              Birdog runs your acquisition pipeline at no cost. When a deal you sourced
              through us closes, we take a small finders fee out of the spread. No
              monthly bills, no per-lead pricing, no minimums.
            </p>
          </div>
          <a
            href="/waitlist"
            className="cta-glow whitespace-nowrap rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background"
          >
            Start for free
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function ColumnHead({
  title,
  sub,
  tone,
}: {
  title: string;
  sub: string;
  tone: 'brand' | 'muted';
}) {
  return (
    <div
      className={
        'col-span-2 rounded-t-xl border border-b-0 px-3 py-3 ' +
        (tone === 'brand'
          ? 'col-span-3 border-emerald-400/40 bg-emerald-400/[0.07]'
          : 'border-white/10 bg-white/[0.02]')
      }
    >
      <div className={tone === 'brand' ? 'text-emerald-300' : 'text-white/55'}>
        {title}
      </div>
      <div
        className={
          'mt-1 text-[9px] font-normal normal-case tracking-normal ' +
          (tone === 'brand' ? 'text-emerald-200/70' : 'text-white/30')
        }
      >
        {sub}
      </div>
    </div>
  );
}

function ConCell({ text }: { text: string }) {
  return (
    <div className="col-span-2 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3 text-[13px] leading-snug">
      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400/80" strokeWidth={2.5} />
      <span className="text-white/55">{text}</span>
    </div>
  );
}

function ProCell({ text, highlight }: { text: string; highlight?: boolean }) {
  return (
    <div
      className={
        'col-span-3 flex items-start gap-2 rounded-lg border px-3 py-3 text-[13px] leading-snug shadow-[0_0_24px_-6px_rgba(52,211,153,0.30)] ' +
        (highlight
          ? 'border-emerald-400/50 bg-emerald-400/[0.10]'
          : 'border-emerald-400/30 bg-emerald-400/[0.06]')
      }
    >
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" strokeWidth={2.5} />
      <span className="font-medium text-emerald-100">{text}</span>
    </div>
  );
}

function MobileRow({
  label,
  text,
  good,
  highlight,
}: {
  label: string;
  text: string;
  good: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        'flex items-start gap-3 px-4 py-3 ' +
        (good
          ? highlight
            ? 'bg-emerald-400/[0.10]'
            : 'bg-emerald-400/[0.05]'
          : '')
      }
    >
      {good ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" strokeWidth={2.5} />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/80" strokeWidth={2.5} />
      )}
      <div className="flex-1">
        <div
          className={
            'text-[10px] font-medium uppercase tracking-[0.18em] ' +
            (good ? 'text-emerald-300' : 'text-white/40')
          }
        >
          {label}
        </div>
        <div
          className={
            'mt-0.5 text-[13px] leading-snug ' +
            (good ? 'font-medium text-emerald-100' : 'text-white/65')
          }
        >
          {text}
        </div>
      </div>
    </div>
  );
}
