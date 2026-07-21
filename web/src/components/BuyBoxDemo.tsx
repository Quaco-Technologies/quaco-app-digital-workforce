'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  MapPin, DollarSign, BedDouble, Home, Play,
  CheckCircle2, Loader2,
} from 'lucide-react';

type Field = { key: string; label: string; value: string; icon: typeof MapPin };

const FIELDS: Field[] = [
  { key: 'market', label: 'Markets', value: 'Atlanta, GA · Memphis, TN · Tampa, FL', icon: MapPin },
  { key: 'price', label: 'Price range', value: '$80,000 — $250,000', icon: DollarSign },
  { key: 'beds', label: 'Bedrooms', value: '3+ beds, 2+ baths', icon: BedDouble },
  { key: 'type', label: 'Property type', value: 'SFR, duplex · built before 2000', icon: Home },
];

const RESULTS = [
  { addr: '4127 Briarcliff Rd', city: 'Atlanta, GA', est: '$184k', spread: '$32k', tag: 'Vacant · pre-foreclosure' },
  { addr: '8829 Riverside Pl', city: 'Memphis, TN', est: '$108k', spread: '$24k', tag: 'Code violations · absentee' },
  { addr: '215 Bayview Ave', city: 'Tampa, FL', est: '$226k', spread: '$41k', tag: 'Tax delinquent · inherited' },
  { addr: '6510 Maple Ridge Dr', city: 'Atlanta, GA', est: '$172k', spread: '$28k', tag: 'Tired landlord · vacant' },
  { addr: '3344 Forest Hill Ln', city: 'Memphis, TN', est: '$94k', spread: '$22k', tag: 'High equity · 30+ yr owner' },
];

type Phase = 'typing' | 'ready' | 'running' | 'results' | 'reset';

export default function BuyBoxDemo() {
  const [phase, setPhase] = useState<Phase>('typing');
  const [activeFieldIdx, setActiveFieldIdx] = useState(0);
  const [typedValues, setTypedValues] = useState<string[]>(FIELDS.map(() => ''));
  const [resultsShown, setResultsShown] = useState(0);
  const [cycle, setCycle] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setInView(true),
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Drive the cycle
  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const typeField = (fieldIdx: number, charIdx: number) => {
      if (cancelled) return;
      const target = FIELDS[fieldIdx]?.value ?? '';
      if (charIdx > target.length) {
        timeout = setTimeout(() => {
          if (fieldIdx + 1 < FIELDS.length) {
            setActiveFieldIdx(fieldIdx + 1);
            typeField(fieldIdx + 1, 0);
          } else {
            // Typing done — button shows "GO" briefly, then auto-presses
            timeout = setTimeout(() => setPhase('ready'), 500);
          }
        }, 380);
        return;
      }
      setTypedValues((prev) => {
        const next = [...prev];
        next[fieldIdx] = target.slice(0, charIdx);
        return next;
      });
      const delay = 22 + Math.random() * 30;
      timeout = setTimeout(() => typeField(fieldIdx, charIdx + 1), delay);
    };

    if (phase === 'typing') {
      setActiveFieldIdx(0);
      setTypedValues(FIELDS.map(() => ''));
      typeField(0, 0);
    } else if (phase === 'ready') {
      // Hold on the GO button for a beat, then "press" it
      timeout = setTimeout(() => setPhase('running'), 1100);
    } else if (phase === 'running') {
      // Pipeline drives next via onComplete
    } else if (phase === 'results') {
      // Stream results, then hold, then reset
      const id = setInterval(() => {
        setResultsShown((n) => {
          if (n >= RESULTS.length) {
            clearInterval(id);
            timeout = setTimeout(() => setPhase('reset'), 5000);
            return n;
          }
          return n + 1;
        });
      }, 700);
      return () => {
        clearInterval(id);
        if (timeout) clearTimeout(timeout);
      };
    } else if (phase === 'reset') {
      timeout = setTimeout(() => {
        setCycle((c) => c + 1);
        setResultsShown(0);
        setPhase('typing');
      }, 800);
    }

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [phase, inView]);

  const formDone = phase !== 'typing';

  return (
    <section className="landing-dark relative overflow-hidden px-6 py-24 md:px-12 md:py-32 lg:px-24">
      <div
        className="pointer-events-none absolute -left-40 top-1/3 h-[500px] w-[500px] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.16), transparent 60%)' }}
      />
      <div
        className="pointer-events-none absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.16), transparent 60%)' }}
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
            See it in action
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-3 text-4xl font-medium leading-[1.05] tracking-[-1.5px] md:text-6xl"
          >
            Set your buybox.{' '}
            <span className="font-serif font-normal italic">Wake up to leads.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="hero-subtitle mt-5 max-w-2xl text-base opacity-90 md:text-lg"
          >
            Tell Birdog your markets and your numbers, once. Our agents source matching
            off-market deals 24/7 — every reply, follow-up, and counter is handled for you.
          </motion.p>
        </div>

        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c0c0e] to-[#050507] p-4 shadow-[0_30px_120px_-20px_rgba(0,0,0,0.7)] md:p-6"
        >
          {/* Window chrome */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <img
                src="/birdog-logo-white.png"
                alt="Birdog"
                className="h-8 w-auto object-contain"
              />
              <span className="text-sm font-semibold text-white">
                Buybox
              </span>
              <span className="hidden text-xs text-white/40 md:inline">/ atlanta_set_3</span>
            </div>
            <div className="flex gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500/60" />
              <span className="h-2 w-2 rounded-full bg-yellow-500/60" />
              <span className="h-2 w-2 rounded-full bg-green-500/60" />
            </div>
          </div>

          <div className="grid gap-6 pt-6 md:grid-cols-12">
            {/* LEFT — form + GO/active button */}
            <div className="md:col-span-5">
              <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                Define what you&apos;re buying
              </div>
              <div className="mt-4 space-y-4">
                {FIELDS.map((f, i) => {
                  const Icon = f.icon;
                  const isActive = phase === 'typing' && activeFieldIdx === i;
                  return (
                    <div
                      key={f.key}
                      className={
                        'rounded-xl border p-3 transition-colors ' +
                        (isActive
                          ? 'border-emerald-400/50 bg-emerald-400/[0.04]'
                          : 'border-white/10 bg-white/[0.02]')
                      }
                    >
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/40">
                        <Icon className="h-3 w-3" strokeWidth={2} />
                        {f.label}
                      </div>
                      <div className="mt-1 min-h-[1.4em] text-[15px] font-medium text-white">
                        {typedValues[i] || (formDone ? f.value : '')}
                        {isActive && (
                          <span className="ml-0.5 inline-block h-4 w-[2px] -translate-y-0.5 animate-pulse bg-emerald-300 align-middle" />
                        )}
                        {!typedValues[i] && !isActive && phase === 'typing' && (
                          <span className="text-white/25">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <ActionButton phase={phase} />
              <div className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/30">
                We only earn when you close
              </div>
            </div>

            {/* RIGHT — pipeline UI, dormant until 'running' */}
            <div className="md:col-span-7">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Live run
                </div>
                <RunStatusPill phase={phase} resultsShown={resultsShown} />
              </div>

              <div className="mt-4 min-h-[420px]">
                {phase === 'results' ? (
                  <ResultsList shown={resultsShown} cycle={cycle} />
                ) : (
                  <PipelineStagesPanel
                    key={`pipeline-${cycle}`}
                    active={phase === 'running'}
                    onComplete={() => {
                      setResultsShown(0);
                      setPhase('results');
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ActionButton({ phase }: { phase: Phase }) {
  if (phase === 'running' || phase === 'results') {
    return (
      <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] px-4 py-3 text-sm font-medium text-emerald-200">
        <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
        Buybox active · running 24/7
      </div>
    );
  }
  if (phase === 'ready') {
    return (
      <motion.div
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-base font-semibold text-black shadow-[0_0_40px_rgba(255,255,255,0.25)]"
      >
        <Play className="h-4 w-4" strokeWidth={0} fill="currentColor" />
        GO
      </motion.div>
    );
  }
  // typing or reset
  return (
    <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white/40">
      <Play className="h-4 w-4" strokeWidth={0} fill="currentColor" />
      GO
    </div>
  );
}

function RunStatusPill({
  phase,
  resultsShown,
}: {
  phase: Phase;
  resultsShown: number;
}) {
  if (phase === 'typing' || phase === 'ready' || phase === 'reset') {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/40">
        <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
        {phase === 'ready' ? 'Awaiting GO' : 'Idle'}
      </span>
    );
  }
  if (phase === 'running') {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
        Pipeline running · 14 data layers
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
      {resultsShown} matches sent to your inbox
    </span>
  );
}

function ResultsList({ shown, cycle }: { shown: number; cycle: number }) {
  return (
    <div className="space-y-2">
      <AnimatePresence>
        {RESULTS.slice(0, shown).map((r, i) => (
          <motion.div
            key={`${cycle}-${r.addr}`}
            initial={{ opacity: 0, x: 30, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">{r.addr}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/45">
                <span>{r.city}</span>
                <span>·</span>
                <span>{r.tag}</span>
              </div>
            </div>
            <div className="ml-4 flex shrink-0 items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-white/40">
                  Est. spread
                </div>
                <div className="text-sm font-semibold tabular-nums text-emerald-300">
                  {r.spread}
                </div>
              </div>
              <div className="hidden text-right md:block">
                <div className="text-[10px] uppercase tracking-wide text-white/40">
                  ARV
                </div>
                <div className="text-sm font-medium tabular-nums text-white/85">
                  {r.est}
                </div>
              </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
                Texting →
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Pipeline stages ────────────────────────────────────────────────────────

const STAGES: Array<{ key: StageKey; label: string; durationMs: number }> = [
  { key: 'scrape',   label: 'Scraping county records',    durationMs: 2200 },
  { key: 'skip',     label: 'Skip tracing owners',         durationMs: 2400 },
  { key: 'analyze',  label: 'Calculating offers',          durationMs: 2200 },
  { key: 'score',    label: 'Scoring deals',               durationMs: 1800 },
  { key: 'outreach', label: 'Sending opening text',        durationMs: 2000 },
];

type StageKey = 'scrape' | 'skip' | 'analyze' | 'score' | 'outreach';

const STREETS = [
  'N High St', 'Maple Ridge Dr', 'Oak Ln', 'Bayview Ave', 'W Pine St',
  'Sunset Blvd', 'Cedar Ct', 'Lakeshore Dr', 'Hillview Rd', 'Riverside Pl',
  'Elm Way', 'Bay Pl', 'Birch Ave', 'Magnolia Ct', 'Sycamore Ln',
  'Fern Hollow Rd', 'Crestview Dr', 'Park Ridge Ave', 'King St', 'Queen Blvd',
  'River Rd', 'Forest Hill Ln',
];
const NAMES = [
  'Maria Hernandez', 'James Patel', 'Linda Goodwin', 'Marcus Chen',
  'Tasha Williams', 'Robert Kim', "Emma O'Brien", 'Devon Carter',
  'Sofia Rossi', 'Aaron Brooks', 'Carlos Diaz', 'Olivia Martinez',
  'Wilson Park', 'Naomi Frank', 'Yusuf Hayes', 'Priya Shah',
  'Greta Lin', 'Hassan Reed', 'Imani Cole', 'Beatrice Vance',
];

function rng(max: number) { return Math.floor(Math.random() * max); }
function pickAddress() { return `${100 + rng(9899)} ${STREETS[rng(STREETS.length)]}`; }
function pickPhone() { return `(${200 + rng(800)}) ${100 + rng(900)}-${1000 + rng(9000)}`; }
function pickName() { return NAMES[rng(NAMES.length)]; }
function pickAPN() { const seg = () => String(rng(9999)).padStart(4, '0'); return `${seg()}-${seg()}-${seg()}`; }

function makeTickerLine(stage: StageKey, hit: boolean): { left: string; right: string; ok: boolean } {
  switch (stage) {
    case 'scrape':
      return { left: pickAddress(), right: `APN ${pickAPN()}`, ok: true };
    case 'skip':
      return hit
        ? { left: pickName(), right: pickPhone(), ok: true }
        : { left: pickName(), right: 'no phone', ok: false };
    case 'analyze': {
      const arv = (120 + rng(280)) * 1000;
      const offer = Math.round(arv * 0.7);
      return {
        left: pickAddress(),
        right: `ARV $${arv.toLocaleString()} → $${offer.toLocaleString()}`,
        ok: true,
      };
    }
    case 'score': {
      const score = (5 + rng(50)) / 10;
      return hit
        ? { left: pickAddress(), right: `score ${score.toFixed(1)} ✓ pursue`, ok: true }
        : { left: pickAddress(), right: `score ${score.toFixed(1)} skip`, ok: false };
    }
    case 'outreach':
      return hit
        ? { left: pickName(), right: `${pickPhone()} ✓ sent`, ok: true }
        : { left: pickName(), right: 'queued', ok: false };
  }
}

function StageTicker({ stage }: { stage: StageKey }) {
  const [lines, setLines] = useState<Array<{ id: number; left: string; right: string; ok: boolean }>>([]);
  const idRef = useRef(0);

  useEffect(() => {
    setLines([]);
    idRef.current = 0;
    const tick = setInterval(() => {
      const hit =
        stage === 'skip' ? Math.random() > 0.18 :
        stage === 'score' ? Math.random() > 0.30 :
        stage === 'outreach' ? Math.random() > 0.10 : true;
      const line = makeTickerLine(stage, hit);
      setLines((prev) => [...prev, { id: idRef.current++, ...line }].slice(-5));
    }, 110);
    return () => clearInterval(tick);
  }, [stage]);

  // Fixed-height window so the panel never grows as lines come in.
  // 5 lines × 14px + 4 × 2px gap + 12px padding = ~92px
  return (
    <div className="ml-7 mt-1.5 h-[92px] overflow-hidden rounded-md border border-white/10 bg-black/50 px-2.5 py-1.5 font-mono text-[10px] leading-[14px]">
      <div className="space-y-0.5">
        {lines.map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate text-white/70">{l.left}</span>
            <span className={l.ok ? 'shrink-0 text-emerald-300' : 'shrink-0 text-white/30'}>
              {l.right}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineStagesPanel({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setCurrentIdx(0);
    setDone(new Set());

    const advance = async () => {
      for (let i = 0; i < STAGES.length; i++) {
        if (cancelled) return;
        setCurrentIdx(i);
        await new Promise((r) => setTimeout(r, STAGES[i].durationMs));
        if (cancelled) return;
        setDone((d) => {
          const next = new Set(d);
          next.add(STAGES[i].key);
          return next;
        });
      }
      if (!cancelled) setTimeout(() => { if (!cancelled) onComplete(); }, 400);
    };
    advance();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="space-y-2.5">
      {STAGES.map((s, i) => {
        const isDone = active && done.has(s.key);
        const isRunning = active && !isDone && i === currentIdx;
        const isPending = !active || (!isDone && i > currentIdx);
        return (
          <div key={s.key}>
            <div
              className={
                'flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors ' +
                (active ? '' : 'opacity-55')
              }
            >
              <div
                className={
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ' +
                  (isDone
                    ? 'bg-emerald-500/90 text-white'
                    : isRunning
                      ? 'bg-blue-500/90 text-white'
                      : 'bg-white/10 text-white/30')
                }
              >
                {isDone ? (
                  <CheckCircle2 size={11} strokeWidth={2.5} />
                ) : isRunning ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : null}
              </div>
              <p
                className={
                  'text-sm ' +
                  (isDone
                    ? 'text-white/70'
                    : isRunning
                      ? 'font-medium text-white'
                      : 'text-white/40')
                }
              >
                {s.label}
              </p>
              {isDone && (
                <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-emerald-400/80">
                  done
                </span>
              )}
              {isRunning && (
                <span className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-blue-300/80">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-blue-400" />
                  live
                </span>
              )}
              {isPending && !isRunning && (
                <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-white/25">
                  pending
                </span>
              )}
            </div>
            {isRunning && <StageTicker stage={s.key} />}
          </div>
        );
      })}
    </div>
  );
}
