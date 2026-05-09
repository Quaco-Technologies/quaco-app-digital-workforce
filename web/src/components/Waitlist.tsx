'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const LAUNCH_AT = new Date('2026-06-01T13:00:00Z');
const SPOTS_TOTAL = 500;
const SPOTS_TAKEN_BASE = 327;

type FormState = {
  name: string;
  email: string;
  phone: string;
  markets: string[];
  minPrice: string;
  maxPrice: string;
  minBeds: string;
  minBaths: string;
  minSqft: string;
  maxYearBuilt: string;
  propertyTypes: string[];
  strategy: '' | 'long_term_rental' | 'fix_and_flip' | 'wholesale' | 'brrrr';
  funding: '' | 'cash' | 'hard_money' | 'conventional';
  maxRehab: string;
  properties2026: string;
  notes: string;
};

const EMPTY: FormState = {
  name: '',
  email: '',
  phone: '',
  markets: [],
  minPrice: '',
  maxPrice: '',
  minBeds: '',
  minBaths: '',
  minSqft: '',
  maxYearBuilt: '',
  propertyTypes: [],
  strategy: '',
  funding: '',
  maxRehab: '',
  properties2026: '',
  notes: '',
};

const MARKETS = [
  'Atlanta, GA', 'Dallas, TX', 'Houston, TX', 'San Antonio, TX', 'Austin, TX',
  'Memphis, TN', 'Nashville, TN', 'Birmingham, AL', 'Charlotte, NC', 'Raleigh, NC',
  'Tampa, FL', 'Jacksonville, FL', 'Orlando, FL', 'Miami, FL',
  'Phoenix, AZ', 'Las Vegas, NV', 'Salt Lake City, UT', 'Denver, CO',
  'Indianapolis, IN', 'Columbus, OH', 'Cleveland, OH', 'Cincinnati, OH', 'Detroit, MI',
  'Kansas City, MO', 'St. Louis, MO', 'Oklahoma City, OK', 'Pittsburgh, PA',
];

const PRICE_OPTIONS = [
  '$40,000', '$60,000', '$80,000', '$100,000', '$125,000',
  '$150,000', '$175,000', '$200,000', '$250,000', '$300,000',
  '$400,000', '$500,000', '$750,000+',
];
const BED_OPTIONS = ['Any', '1+', '2+', '3+', '4+', '5+'];
const BATH_OPTIONS = ['Any', '1+', '1.5+', '2+', '2.5+', '3+'];
const SQFT_OPTIONS = ['Any', '600+', '800+', '1,000+', '1,200+', '1,500+', '2,000+', '2,500+'];
const YEAR_OPTIONS = ['Any year', '2010', '2000', '1990', '1980', '1970', '1960'];
const REHAB_OPTIONS = ['$0 (turnkey)', 'Up to $15k', 'Up to $30k', 'Up to $50k', 'Up to $75k', '$75k+'];
const PROPERTIES_2026_OPTIONS = ['5–9', '10–19', '20–49', '50–99', '100+'];
const PROPERTY_TYPES = ['SFR', 'Duplex', 'Triplex', 'Quadplex', 'Condo', 'Townhome'] as const;

const STRATEGY_OPTIONS: Array<{ key: FormState['strategy']; label: string }> = [
  { key: 'long_term_rental', label: 'Long term rental' },
  { key: 'fix_and_flip', label: 'Fix & flip' },
  { key: 'wholesale', label: 'Wholesale' },
  { key: 'brrrr', label: 'BRRRR' },
];
const FUNDING_OPTIONS: Array<{ key: FormState['funding']; label: string }> = [
  { key: 'cash', label: 'All cash' },
  { key: 'hard_money', label: 'Hard money' },
  { key: 'conventional', label: 'Conventional' },
];

// ─── Step definitions ──────────────────────────────────────────────────────

type StepDef = {
  id: string;
  title: string;
  sub: string;
  isComplete: (f: FormState) => boolean;
};

const STEPS: StepDef[] = [
  {
    id: 'contact',
    title: 'Who are you?',
    sub: 'So we can confirm your spot.',
    isComplete: (f) =>
      f.name.trim().length > 1 && /\S+@\S+\.\S+/.test(f.email),
  },
  {
    id: 'markets',
    title: 'Where do you buy?',
    sub: 'Pick the markets you target.',
    isComplete: (f) => f.markets.length > 0,
  },
  {
    id: 'buybox',
    title: 'What are you buying?',
    sub: 'Set your buybox criteria.',
    isComplete: (f) =>
      f.minPrice !== '' && f.maxPrice !== '' && f.propertyTypes.length > 0,
  },
  {
    id: 'strategy',
    title: 'How do you operate?',
    sub: 'Strategy and financing.',
    isComplete: (f) => f.strategy !== '' && f.funding !== '',
  },
  {
    id: 'volume',
    title: 'Your 2026 plans',
    sub: 'Real estate cohort needs 5+ acquisitions.',
    isComplete: (f) => f.properties2026 !== '',
  },
];

// ─── Section helpers used in steps ─────────────────────────────────────────

function intOrNull(v: string): number | null {
  if (!v) return null;
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}
function numOrNull(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function propsRangeMin(label: string): number {
  // "5–9" → 5; "100+" → 100
  return parseInt(label.split(/[–+]/)[0], 10) || 0;
}

// ─── Main component ────────────────────────────────────────────────────────

export default function Waitlist() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [stepIdx, setStepIdx] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = STEPS.length;
  const currentStep = STEPS[stepIdx];
  const canProceed = currentStep.isComplete(form);
  const isLast = stepIdx === totalSteps - 1;

  const completedCount = STEPS.filter((s) => s.isComplete(form)).length;
  const progressPct = (completedCount / totalSteps) * 100;

  const next = () => {
    if (!canProceed) return;
    if (isLast) {
      void onSubmit();
    } else {
      setStepIdx((i) => Math.min(totalSteps - 1, i + 1));
    }
  };
  const back = () => setStepIdx((i) => Math.max(0, i - 1));

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload = {
        full_name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        markets: form.markets.length ? form.markets.join(', ') : null,
        min_price: intOrNull(form.minPrice),
        max_price: intOrNull(form.maxPrice),
        min_beds: intOrNull(form.minBeds),
        min_baths: numOrNull(form.minBaths),
        min_sqft: intOrNull(form.minSqft),
        max_year_built: intOrNull(form.maxYearBuilt),
        property_types: form.propertyTypes.length ? form.propertyTypes : null,
        strategy: form.strategy || null,
        funding: form.funding,
        max_rehab_budget: intOrNull(form.maxRehab),
        properties_2026: propsRangeMin(form.properties2026) || null,
        notes: form.notes.trim() || null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      };

      const { error: insertError } = await supabase
        .from('waitlist_applications')
        .insert(payload);

      if (insertError) {
        if (insertError.code === '23505') {
          setError("You're already on the list. Check your inbox for confirmation.");
        } else {
          setError("Couldn't save that — please try again, or email hello@birdog.ai");
        }
        setSubmitting(false);
        return;
      }

      const { count } = await supabase
        .from('waitlist_applications')
        .select('*', { count: 'exact', head: true });
      setPosition((count ?? SPOTS_TAKEN_BASE) + Math.floor(Math.random() * 3));
      setSubmitted(true);
    } catch {
      setError("Couldn't save that — please try again, or email hello@birdog.ai");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="hero-grain" />
      <div className="hero-glow" />

      <nav className="relative z-20 flex items-center justify-between px-6 py-5 md:px-12 lg:px-24">
        <a
          href="/"
          className="flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back home
        </a>
        <a href="/" className="flex items-center">
          <img
            src="/birdog-logo-white.png"
            alt="Birdog"
            className="h-14 w-auto object-contain"
          />
        </a>
        <div className="hidden text-xs uppercase tracking-[0.18em] text-white/40 md:block">
          Early access
        </div>
      </nav>

      <div className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-6 md:px-12 md:pb-32 md:pt-10">
        {!submitted ? (
          <>
            <Header />
            <Counters />
            <WizardCard
              stepIdx={stepIdx}
              currentStep={currentStep}
              totalSteps={totalSteps}
              progressPct={progressPct}
              completedCount={completedCount}
              canProceed={canProceed}
              isLast={isLast}
              submitting={submitting}
              error={error}
              onNext={next}
              onBack={back}
              form={form}
              setForm={setForm}
            />
            <FoundersNote />
          </>
        ) : (
          <ThankYouView form={form} position={position} />
        )}
      </div>
    </section>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div className="text-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="liquid-glass mx-auto mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-1.5"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          500 Real estate investors · Launching June 1, 2026
        </span>
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="text-4xl font-medium leading-[1.05] tracking-[-1.5px] md:text-6xl"
      >
        Apply for{' '}
        <span className="font-serif font-normal italic">early access.</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="hero-subtitle mx-auto mt-4 max-w-xl text-base opacity-90 md:text-lg"
      >
        Five quick questions. We&apos;ll review and let you know.
      </motion.p>
    </div>
  );
}

// ─── Wizard ────────────────────────────────────────────────────────────────

function WizardCard({
  stepIdx,
  currentStep,
  totalSteps,
  progressPct,
  completedCount,
  canProceed,
  isLast,
  submitting,
  error,
  onNext,
  onBack,
  form,
  setForm,
}: {
  stepIdx: number;
  currentStep: StepDef;
  totalSteps: number;
  progressPct: number;
  completedCount: number;
  canProceed: boolean;
  isLast: boolean;
  submitting: boolean;
  error: string | null;
  onNext: () => void;
  onBack: () => void;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.25 }}
      className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c0c0e] to-[#050507] shadow-[0_30px_120px_-20px_rgba(0,0,0,0.7)]"
    >
      <ProgressBar
        stepIdx={stepIdx}
        totalSteps={totalSteps}
        progressPct={progressPct}
        completedCount={completedCount}
      />

      <div className="px-6 pb-8 pt-6 md:px-10 md:pb-10 md:pt-8">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-300/80">
          Step {stepIdx + 1} of {totalSteps}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
              {currentStep.title}
            </h2>
            <p className="mt-2 text-sm text-white/55 md:text-base">
              {currentStep.sub}
            </p>
            <div className="mt-6">
              <StepBody
                stepId={currentStep.id}
                form={form}
                setForm={setForm}
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          {stepIdx > 0 ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/25 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={!canProceed || submitting}
            className={
              'inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all ' +
              (canProceed && !submitting
                ? 'cta-glow bg-foreground text-background'
                : 'cursor-not-allowed bg-white/10 text-white/40')
            }
          >
            {submitting ? 'Submitting…' : isLast ? 'Submit application' : 'Continue'}
            {!isLast && <ArrowRight className="h-4 w-4" />}
            {isLast && !submitting && <CheckCircle2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ProgressBar({
  stepIdx,
  totalSteps,
  progressPct,
  completedCount,
}: {
  stepIdx: number;
  totalSteps: number;
  progressPct: number;
  completedCount: number;
}) {
  return (
    <div className="border-b border-white/10 bg-white/[0.01] px-6 py-4 md:px-10">
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
        <span>{completedCount} of {totalSteps} complete</span>
        <span className="text-emerald-300">{Math.round(progressPct)}%</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-3 flex justify-between gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const isCurrent = i === stepIdx;
          const isPast = i < stepIdx;
          return (
            <div
              key={i}
              className={
                'h-1 flex-1 rounded-full transition-colors ' +
                (isCurrent
                  ? 'bg-emerald-400'
                  : isPast
                    ? 'bg-emerald-400/45'
                    : 'bg-white/10')
              }
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Step bodies ───────────────────────────────────────────────────────────

function StepBody({
  stepId,
  form,
  setForm,
}: {
  stepId: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  if (stepId === 'contact') {
    return (
      <div className="space-y-3">
        <Field
          label="Full name"
          required
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          placeholder="Marcus Chen"
        />
        <Field
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
          placeholder="you@email.com"
        />
        <Field
          label="Phone (optional)"
          type="tel"
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
          placeholder="(555) 123 4567"
        />
      </div>
    );
  }

  if (stepId === 'markets') {
    const toggle = (m: string) => {
      setForm((prev) => ({
        ...prev,
        markets: prev.markets.includes(m)
          ? prev.markets.filter((x) => x !== m)
          : [...prev.markets, m],
      }));
    };
    return (
      <div>
        <Label>Pick all that apply</Label>
        <div className="mt-3 flex flex-wrap gap-2">
          {MARKETS.map((m) => {
            const active = form.markets.includes(m);
            return (
              <button
                type="button"
                key={m}
                onClick={() => toggle(m)}
                className={
                  'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ' +
                  (active
                    ? 'border-emerald-400/60 bg-emerald-400/[0.10] text-emerald-100'
                    : 'border-white/10 bg-white/[0.02] text-white/65 hover:border-white/30')
                }
              >
                {m}
              </button>
            );
          })}
        </div>
        {form.markets.length > 0 && (
          <div className="mt-4 text-xs text-white/45">
            {form.markets.length} selected
          </div>
        )}
      </div>
    );
  }

  if (stepId === 'buybox') {
    const togglePT = (t: string) => {
      setForm((prev) => ({
        ...prev,
        propertyTypes: prev.propertyTypes.includes(t)
          ? prev.propertyTypes.filter((x) => x !== t)
          : [...prev.propertyTypes, t],
      }));
    };
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Min price *"
            value={form.minPrice}
            options={PRICE_OPTIONS}
            onChange={(v) => setForm({ ...form, minPrice: v })}
          />
          <Select
            label="Max price *"
            value={form.maxPrice}
            options={PRICE_OPTIONS}
            onChange={(v) => setForm({ ...form, maxPrice: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Select
            label="Min beds"
            value={form.minBeds}
            options={BED_OPTIONS}
            onChange={(v) => setForm({ ...form, minBeds: v })}
          />
          <Select
            label="Min baths"
            value={form.minBaths}
            options={BATH_OPTIONS}
            onChange={(v) => setForm({ ...form, minBaths: v })}
          />
          <Select
            label="Min sq ft"
            value={form.minSqft}
            options={SQFT_OPTIONS}
            onChange={(v) => setForm({ ...form, minSqft: v })}
          />
          <Select
            label="Built before"
            value={form.maxYearBuilt}
            options={YEAR_OPTIONS}
            onChange={(v) => setForm({ ...form, maxYearBuilt: v })}
          />
        </div>
        <div>
          <Label>Property types you&apos;ll buy *</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((t) => {
              const active = form.propertyTypes.includes(t);
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => togglePT(t)}
                  className={
                    'rounded-full border px-4 py-2 text-xs font-medium transition-colors ' +
                    (active
                      ? 'border-emerald-400/60 bg-emerald-400/[0.10] text-emerald-100'
                      : 'border-white/10 bg-white/[0.02] text-white/65 hover:border-white/30')
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (stepId === 'strategy') {
    return (
      <div className="space-y-5">
        <div>
          <Label>Primary strategy *</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {STRATEGY_OPTIONS.map((s) => (
              <ChipButton
                key={s.key}
                active={form.strategy === s.key}
                onClick={() => setForm({ ...form, strategy: s.key })}
              >
                {s.label}
              </ChipButton>
            ))}
          </div>
        </div>
        <div>
          <Label>How do you fund deals? *</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {FUNDING_OPTIONS.map((f) => (
              <ChipButton
                key={f.key}
                active={form.funding === f.key}
                onClick={() => setForm({ ...form, funding: f.key })}
              >
                {f.label}
              </ChipButton>
            ))}
          </div>
        </div>
        <div>
          <Label>Max rehab budget per deal</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
            {REHAB_OPTIONS.map((r) => (
              <ChipButton
                key={r}
                active={form.maxRehab === r}
                onClick={() => setForm({ ...form, maxRehab: r })}
              >
                {r}
              </ChipButton>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stepId === 'volume') {
    return (
      <div className="space-y-5">
        <div>
          <Label>Properties you&apos;ll acquire in 2026 *</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
            {PROPERTIES_2026_OPTIONS.map((p) => (
              <ChipButton
                key={p}
                active={form.properties2026 === p}
                onClick={() => setForm({ ...form, properties2026: p })}
              >
                {p}
              </ChipButton>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/45">
            Real estate cohort minimum is 5 acquisitions in 2026.
          </p>
        </div>
        <div>
          <Label>Anything else? (optional)</Label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            placeholder="Strategy, partners, current portfolio…"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-white placeholder-white/30 transition-colors focus:border-emerald-400/40 focus:outline-none"
          />
        </div>
      </div>
    );
  }

  return null;
}

// ─── Field primitives ──────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-white placeholder-white/30 transition-colors focus:border-emerald-400/40 focus:outline-none"
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative mt-1.5">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={
            'w-full appearance-none rounded-xl border bg-white/[0.02] px-3.5 py-2.5 pr-10 text-sm transition-colors focus:border-emerald-400/40 focus:outline-none ' +
            (value ? 'border-emerald-400/40 text-white' : 'border-white/10 text-white/45')
          }
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o} value={o} className="bg-[#0c0c0e] text-white">
              {o}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/45">
          ▾
        </span>
      </div>
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors md:text-sm ' +
        (active
          ? 'border-emerald-400/60 bg-emerald-400/[0.10] text-emerald-100'
          : 'border-white/10 bg-white/[0.02] text-white/65 hover:border-white/30')
      }
    >
      {children}
    </button>
  );
}

// ─── Counters / Countdown / Founder note / Thank you (unchanged) ───────────

function Counters() {
  const [taken, setTaken] = useState(SPOTS_TAKEN_BASE);
  useEffect(() => {
    const id = setInterval(() => {
      setTaken((v) => (v < 425 ? v + (Math.random() < 0.3 ? 1 : 0) : v));
    }, 4000);
    return () => clearInterval(id);
  }, []);
  const pct = Math.min(100, Math.round((taken / SPOTS_TOTAL) * 100));
  return (
    <div className="mx-auto mt-10 max-w-xl">
      <div className="flex items-end justify-between text-sm">
        <div>
          <span className="text-2xl font-semibold tabular-nums text-white md:text-3xl">
            {taken}
          </span>
          <span className="text-white/40"> applications · 500 Real estate spots</span>
        </div>
        <Countdown compact />
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
        />
      </div>
    </div>
  );
}

function Countdown({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, LAUNCH_AT.getTime() - now.getTime());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  if (compact) {
    return (
      <div className="text-right text-[11px] uppercase tracking-[0.18em] text-white/45">
        Launches in
        <div className="mt-0.5 text-base font-semibold tabular-nums normal-case tracking-normal text-white">
          {days}d {hours}h {mins}m
        </div>
      </div>
    );
  }
  return (
    <div className="liquid-glass flex items-center justify-around gap-4 rounded-2xl border border-white/10 px-6 py-5">
      {[
        ['Days', days],
        ['Hours', hours],
        ['Mins', mins],
        ['Secs', secs],
      ].map(([label, value]) => (
        <div key={label as string} className="text-center">
          <div className="text-3xl font-semibold tabular-nums text-white md:text-4xl">
            {String(value).padStart(2, '0')}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/40">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

function FoundersNote() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 1 }}
      className="mx-auto mt-16 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8"
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
        From the founders
      </div>
      <p className="mt-3 text-sm leading-7 text-white/70 md:text-base md:leading-8">
        We&apos;re capping the launch cohort at 500 because we onboard every
        investor by hand. That&apos;s why we ask for 5+ acquisitions in 2026 —
        we want partners we can move serious volume with. If we can&apos;t close
        at least one deal for you in your first 90 days, you owe us nothing —
        that&apos;s the model.
      </p>
      <p className="mt-3 text-sm font-medium italic leading-7 text-white/85 md:text-base md:leading-8">
        See you on June 1.
      </p>
    </motion.div>
  );
}

function ThankYouView({
  form,
  position,
}: {
  form: FormState;
  position: number | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative"
    >
      <div className="mx-auto max-w-2xl text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 200 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10"
        >
          <CheckCircle2 className="h-8 w-8 text-emerald-300" strokeWidth={2.2} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 text-4xl font-medium leading-[1.05] tracking-[-1.5px] md:text-6xl"
        >
          Application{' '}
          <span className="font-serif font-normal italic">received,</span>{' '}
          {form.name.split(' ')[0]}.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="hero-subtitle mt-5 text-base opacity-90 md:text-lg"
        >
          Our team will review your buybox within 48 hours. If you qualify,
          we&apos;ll reserve your spot and email{' '}
          <span className="font-medium text-white">{form.email}</span> with
          next steps.
        </motion.p>

        {position !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="liquid-glass mt-8 inline-flex items-center gap-3 rounded-2xl border border-white/10 px-6 py-4"
          >
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                Application #
              </div>
              <div className="mt-0.5 text-3xl font-semibold tabular-nums">
                {position}
              </div>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                Cohort size
              </div>
              <div className="mt-0.5 text-3xl font-semibold tabular-nums text-white/60">
                500
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.55 }}
        className="mx-auto mt-14 grid max-w-3xl gap-4 md:grid-cols-3"
      >
        {[
          {
            step: '01',
            title: 'We review',
            body: 'Our team reviews your application within 48 hours. We accept investors who plan 5+ acquisitions in 2026 and whose buybox matches our launch markets.',
          },
          {
            step: '02',
            title: 'Spot reserved',
            body: 'If you qualify, we email you a confirmation, reserve your spot in the Real estate cohort, and book a 20 minute onboarding call.',
          },
          {
            step: '03',
            title: 'June 1, 9am ET',
            body: 'Pipeline goes live in your markets. You start getting deals the morning of launch.',
          },
        ].map((s) => (
          <div key={s.step} className="liquid-glass rounded-2xl border border-white/10 p-5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
              Step {s.step}
            </div>
            <div className="mt-3 text-lg font-medium text-white">{s.title}</div>
            <p className="mt-2 text-sm leading-6 text-white/65">{s.body}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="mx-auto mt-12 max-w-3xl"
      >
        <Countdown />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.85 }}
        className="mx-auto mt-12 flex max-w-3xl flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.04] p-6 md:flex-row md:items-center md:p-8"
      >
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
            Skip the line
          </div>
          <div className="mt-2 text-xl font-medium text-white">
            Bring an investor friend, jump 50 spots.
          </div>
          <p className="mt-1 max-w-lg text-sm leading-6 text-white/65">
            Referrals get reviewed first. Forward your confirmation email or share your
            link once it lands.
          </p>
        </div>
        <a
          href={`mailto:?subject=Birdog%20Early%20Access&body=${encodeURIComponent(
            "I just applied for Birdog (off-market AI deal sourcing). They're capping the launch cohort at 500. Apply here: https://birdog.ai/waitlist"
          )}`}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <Mail className="h-4 w-4" />
          Share invite
        </a>
      </motion.div>

      <FoundersNote />
    </motion.div>
  );
}
