'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import USMap from './USMap';

function useCountUp(target: number, durationMs = 1400, active = true) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, active]);
  return n;
}

function useTickingNumber(initial: number, minMs: number, maxMs: number, increment = 1, active = true) {
  const [n, setN] = useState(initial);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const loop = () => {
      const wait = minMs + Math.random() * (maxMs - minMs);
      setTimeout(() => {
        if (cancelled) return;
        setN((v) => v + increment);
        loop();
      }, wait);
    };
    loop();
    return () => { cancelled = true; };
  }, [minMs, maxMs, increment, active]);
  return n;
}

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

const MESSAGE_POOL: Array<{ phone: string; msg: string }> = [
  { phone: '+1 (404) ••• 2241', msg: 'Just sent the offer — $182k cash, 14 day close.' },
  { phone: '+1 (770) ••• 0193', msg: 'Owner confirmed motivation. Booking inspection.' },
  { phone: '+1 (678) ••• 8842', msg: 'Counter at $215k. Splitting at $198k looks live.' },
  { phone: '+1 (404) ••• 5569', msg: 'Contract signed via Lumin. Funding scheduled.' },
  { phone: '+1 (305) ••• 1147', msg: 'Tampa lead replied — wants to chat tomorrow at 9.' },
  { phone: '+1 (214) ••• 9920', msg: 'Dallas SFR — agreed at $241k. Sending paperwork.' },
  { phone: '+1 (602) ••• 3315', msg: 'Phoenix owner went silent. Sending day-7 nudge.' },
  { phone: '+1 (615) ••• 0078', msg: 'Nashville duplex — owner wants $312k. Walking.' },
  { phone: '+1 (704) ••• 4421', msg: 'Charlotte deal under contract. $34k spread.' },
  { phone: '+1 (901) ••• 8823', msg: 'Memphis — accepted $128k cash, closing in 10.' },
];

const DEAL_STREAM = [
  { city: 'Atlanta, GA', value: '$182k', state: 'closed' },
  { city: 'Dallas, TX', value: '$241k', state: 'closed' },
  { city: 'Memphis, TN', value: '$128k', state: 'closed' },
  { city: 'Phoenix, AZ', value: 'negotiating', state: 'live' },
  { city: 'Tampa, FL', value: '$214k', state: 'closed' },
  { city: 'Charlotte, NC', value: '$166k', state: 'closed' },
  { city: 'Houston, TX', value: 'engaged', state: 'live' },
  { city: 'Nashville, TN', value: '$294k', state: 'closed' },
  { city: 'Birmingham, AL', value: '$98k', state: 'closed' },
  { city: 'Jacksonville, FL', value: 'replied', state: 'live' },
  { city: 'Raleigh, NC', value: '$203k', state: 'closed' },
  { city: 'San Antonio, TX', value: '$157k', state: 'closed' },
] as const;

export default function LiveDashboard() {
  const [rootRef, inView] = useInView(0.05);

  const baseLeads = useCountUp(14328, 1400, inView);
  const baseSms = useCountUp(482, 1400, inView);
  const baseContracts = useCountUp(37, 1400, inView);
  const basePipe = useCountUp(421, 1400, inView);

  const leadsAdd = useTickingNumber(0, 600, 1400, 1, inView);
  const smsAdd = useTickingNumber(0, 1500, 3500, 1, inView);
  const contractsAdd = useTickingNumber(0, 25000, 45000, 1, inView);
  const pipeAdd = useTickingNumber(0, 4000, 9000, 12, inView);

  const leads = baseLeads + leadsAdd;
  const sms = baseSms + smsAdd;
  const contracts = baseContracts + contractsAdd;
  const pipe = basePipe + pipeAdd;

  const [feed, setFeed] = useState(() => MESSAGE_POOL.slice(0, 4));
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => {
      setFeed((prev) => {
        const candidates = MESSAGE_POOL.filter(
          (m) => !prev.some((p) => p.phone === m.phone)
        );
        const pick =
          candidates[Math.floor(Math.random() * candidates.length)] ??
          MESSAGE_POOL[Math.floor(Math.random() * MESSAGE_POOL.length)];
        return [pick, ...prev].slice(0, 4);
      });
    }, 3200);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <div ref={rootRef} className="relative w-full overflow-hidden p-3 md:aspect-video md:p-4">
      <div className="scanline" />

      <div className="relative flex h-full flex-col gap-3 rounded-2xl border border-white/15 bg-black/45 p-4 backdrop-blur-2xl md:p-5"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.02)',
        }}
      >
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/birdog-logo-white.png"
              alt="Birdog"
              className="h-8 w-auto object-contain"
            />
            <span className="text-sm font-semibold text-white">
              Pipeline
            </span>
            <span className="ml-2 flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1 rounded-md border border-white/10 bg-black/45 px-2 py-0.5 text-[10px] text-white/50 md:flex">
              <kbd className="rounded bg-white/10 px-1 font-mono">⌘</kbd>
              <kbd className="rounded bg-white/10 px-1 font-mono">K</kbd>
              <span className="ml-1">search</span>
            </div>
            <div className="flex gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500/60" />
              <span className="h-2 w-2 rounded-full bg-yellow-500/60" />
              <span className="h-2 w-2 rounded-full bg-green-500/60" />
            </div>
          </div>
        </div>

        {/* Main split: BIG MAP left, supporting panels right (stacks vertical on mobile) */}
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden md:grid-cols-12">
          {/* LEFT — full-height live map */}
          <div className="relative flex h-[300px] flex-col rounded-lg border border-white/10 bg-black/45 p-3 md:col-span-7 md:h-auto">
            <div className="z-10 flex shrink-0 items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Live US markets
                </div>
                <div className="mt-0.5 text-base font-medium text-white">
                  Activity nationwide
                </div>
              </div>
              <div className="flex flex-col items-end text-right">
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
                  18 hot markets
                </span>
                <span className="mt-0.5 text-[10px] text-white/40">
                  +3 since yesterday
                </span>
              </div>
            </div>
            <div className="relative flex-1">
              <USMap />
            </div>
          </div>

          {/* RIGHT — stacked panels */}
          <div className="flex flex-col gap-3 overflow-hidden md:col-span-5">
            {/* Deal stream */}
            <DealStream />

            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Leads scraped" value={leads.toLocaleString()} delta="+12%" />
              <Kpi label="Active SMS" value={sms.toLocaleString()} delta="+34%" />
              <Kpi label="Contracts" value={contracts.toLocaleString()} delta="+8%" />
              <Kpi
                label="Pipeline value"
                value={`$${(pipe / 100).toFixed(2)}M`}
                delta="+19%"
              />
            </div>

            {/* Compact chart */}
            <div className="flex shrink-0 flex-col rounded-lg border border-white/10 bg-black/45 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wide text-white/40">
                  Conversations / day
                </div>
                <div className="text-[10px] text-white/40">14d</div>
              </div>
              <svg
                viewBox="0 0 300 70"
                preserveAspectRatio="none"
                className="mt-1 h-12 w-full"
              >
                <defs>
                  <linearGradient id="chartFill2" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(99,102,241,0.40)" />
                    <stop offset="100%" stopColor="rgba(99,102,241,0)" />
                  </linearGradient>
                  <linearGradient id="chartLine2" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="rgba(168,85,247,0.9)" />
                    <stop offset="100%" stopColor="rgba(56,189,248,1)" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0,55 L25,50 L50,46 L75,38 L100,42 L130,30 L160,26 L190,18 L220,22 L250,12 L275,10 L300,6"
                  fill="none"
                  stroke="url(#chartLine2)"
                  strokeWidth="1.8"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                />
                <path
                  d="M0,55 L25,50 L50,46 L75,38 L100,42 L130,30 L160,26 L190,18 L220,22 L250,12 L275,10 L300,6 L300,70 L0,70 Z"
                  fill="url(#chartFill2)"
                />
                <motion.circle
                  cx="300"
                  cy="6"
                  r="3"
                  fill="rgba(56,189,248,1)"
                  animate={{ opacity: [0.4, 1, 0.4], r: [2.5, 4, 2.5] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              </svg>
            </div>

            {/* Live SMS feed */}
            <div className="flex flex-1 flex-col rounded-lg border border-white/10 bg-black/45 p-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wide text-white/40">
                  Live SMS
                </div>
                <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                  <span className="h-1 w-1 rounded-full bg-emerald-400 pulse-dot" />
                  4 negotiating
                </span>
              </div>
              <div className="mt-2 flex flex-1 flex-col gap-1.5 overflow-hidden">
                <AnimatePresence initial={false}>
                  {feed.slice(0, 3).map((m) => (
                    <motion.div
                      key={m.phone}
                      layout
                      initial={{ opacity: 0, y: -16, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      className="rounded-md border border-white/[0.06] bg-black/45 p-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-white/80">
                          {m.phone}
                        </span>
                        <span className="text-[9px] text-white/35">just now</span>
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-[10px] text-white/55">
                        {m.msg}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/45 p-2.5">
      <div className="text-[9px] uppercase tracking-wide text-white/40">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums text-white">
        {value}
      </div>
      <div className="text-[9px] text-emerald-400">{delta}</div>
    </div>
  );
}

function DealStream() {
  const items = [...DEAL_STREAM, ...DEAL_STREAM];
  return (
    <div className="relative shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/45 py-1.5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#0a0a0c] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#050507] to-transparent" />
      <div className="marquee-track flex w-max gap-3 px-3 text-[10px]">
        {items.map((d, i) => (
          <span
            key={`${d.city}-${i}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5"
          >
            {d.state === 'closed' ? (
              <span className="text-emerald-400">●</span>
            ) : (
              <span className="text-amber-300">●</span>
            )}
            <span className="text-white/70">{d.city}</span>
            <span className="text-white/45">·</span>
            <span
              className={d.state === 'closed' ? 'font-medium text-white' : 'italic text-white/50'}
            >
              {d.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
