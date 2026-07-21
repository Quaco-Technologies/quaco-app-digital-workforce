'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spawnSeller, type Seller, type Turn } from '@/lib/sellerPool';

// ─── Status types ───────────────────────────────────────────────────────────

type Tone = 'emerald' | 'amber' | 'zinc' | 'rose' | 'blue';
type Bucket = 'early' | 'mid' | 'late';

interface ChatStatus { label: string; tone: Tone }

interface OutcomeFooter {
  tone: 'success' | 'warn' | 'fail';
  body: string;
}

interface Archetype {
  bucket: Bucket;
  status: ChatStatus;
  outcome?: 'agreed' | 'dead' | 'pending';
  /** Built per spawn so first-name and address are inserted into the dialogue */
  build: (ctx: { first: string; address: string; arv: number; offer: number; stretch: number }) => Turn[];
  footer?: (ctx: { stretch: number; offer: number; first: string }) => OutcomeFooter;
}

// ─── Archetypes (no em-dashes anywhere; lowercase casual replies; mixed tone)

const ARCHETYPES: Archetype[] = [
  // EARLY: qualifying / asking questions
  {
    bucket: 'early',
    status: { label: 'Qualifying', tone: 'blue' },
    outcome: 'pending',
    build: ({ first, address }) => [
      { role: 'agent', body: `Hi ${first}, this is Jordan with Birdog. I came across ${address} and wanted to see if you might consider selling. No pressure.` },
      { role: 'owner', body: 'maybe. depends on the offer' },
      { role: 'agent', body: `Totally fair. Quick question, how long have you had the place?` },
      { role: 'owner', body: 'bought in 2011. rented it out for a while' },
      { role: 'agent', body: 'Any tenants in there now or is it vacant?' },
      { role: 'owner', body: 'vacant since march. roof leaks pretty bad honestly' },
      { role: 'agent', body: 'Appreciate the honesty. What number would let you walk away clean?' },
    ],
    footer: () => ({ tone: 'warn', body: 'Awaiting price from owner. Auto follow up in 24h.' }),
  },
  {
    bucket: 'early',
    status: { label: 'Building rapport', tone: 'blue' },
    outcome: 'pending',
    build: ({ first, address }) => [
      { role: 'agent', body: `Hey ${first}, hope I'm not bothering you. Local investor here, saw ${address} might be sitting empty. You still own it?` },
      { role: 'owner', body: 'yes' },
      { role: 'agent', body: 'Cool. Any chance you would entertain a cash offer?' },
      { role: 'owner', body: 'what kind of number' },
      { role: 'agent', body: 'Depends on condition. Has it been updated? Roof, HVAC, anything I should know?' },
      { role: 'owner', body: 'roof was redone 4 years ago. HVAC is original from like 1998' },
      { role: 'agent', body: 'Got it. Any code violations or back taxes I should be aware of?' },
    ],
    footer: () => ({ tone: 'warn', body: 'Owner gathering condition info. Pricing offer next.' }),
  },
  {
    bucket: 'early',
    status: { label: 'Asking questions', tone: 'blue' },
    outcome: 'pending',
    build: ({ first, address }) => [
      { role: 'agent', body: `Hi ${first}, Sam with Birdog. Quick question, are you still the owner of ${address}?` },
      { role: 'owner', body: 'who is this' },
      { role: 'agent', body: 'Local cash buyer. Saw it was listed as vacant in the public records.' },
      { role: 'owner', body: 'where did u get my number' },
      { role: 'agent', body: 'Public county records, all legit. I can share my info if you want to verify.' },
      { role: 'owner', body: 'send me your business address and a website' },
      { role: 'agent', body: '1209 Orange St Wilmington DE. birdog.ai. Happy to do a quick video call too.' },
    ],
    footer: () => ({ tone: 'warn', body: 'Verifying credibility. Likely to negotiate next.' }),
  },

  // MID: negotiating
  {
    bucket: 'mid',
    status: { label: 'Negotiating', tone: 'amber' },
    outcome: 'agreed',
    build: ({ first, address, offer, stretch }) => [
      { role: 'agent', body: `Hi ${first}, just sent the offer at $${offer.toLocaleString()} cash for ${address}. Still working for you?` },
      { role: 'owner', body: `i was thinking more like $${(stretch + 12000).toLocaleString()}` },
      { role: 'agent', body: `I hear you. The HVAC and electrical alone is gonna run us about 28k. Best I can stretch is $${stretch.toLocaleString()}.` },
      { role: 'owner', body: `can u do $${(stretch + 4000).toLocaleString()}?` },
      { role: 'agent', body: `Tell you what. $${stretch.toLocaleString()} cash, 14 day close, no inspection contingency. Final.` },
      { role: 'owner', body: 'ok deal' },
      { role: 'agent', body: `Awesome. Sending paperwork through Lumin now. What's the best email for you?` },
    ],
    footer: ({ stretch }) => ({
      tone: 'success',
      body: `Closed at $${stretch.toLocaleString()}. Contract sent via Lumin.`,
    }),
  },
  {
    bucket: 'mid',
    status: { label: 'Negotiating', tone: 'amber' },
    outcome: 'dead',
    build: ({ first, address, offer }) => [
      { role: 'agent', body: `Hi ${first}, can you do $${offer.toLocaleString()} cash for ${address}? Closing in 14.` },
      { role: 'owner', body: 'absolutely not. zillow says 195' },
      { role: 'agent', body: `Zillow doesn't account for the condition. Comps with new roof and HVAC are at 145, this one is 60k of work.` },
      { role: 'owner', body: 'find someone else' },
      { role: 'agent', body: 'No problem. If anything changes I am here. Take care.' },
    ],
    footer: () => ({ tone: 'warn', body: 'Walked. Re queued for 30 day follow up.' }),
  },
  {
    bucket: 'mid',
    status: { label: 'Negotiating', tone: 'amber' },
    outcome: 'agreed',
    build: ({ first, address, offer }) => [
      { role: 'agent', body: `Hey ${first}, before I throw out a number, can you tell me what's happening with ${address}? Any tenants? Code stuff?` },
      { role: 'owner', body: 'no tenants, place is in alright shape. just inherited from my dad' },
      { role: 'agent', body: 'Sorry for your loss. Are you trying to sell quick or take your time?' },
      { role: 'owner', body: 'honestly want it gone before tax season' },
      { role: 'agent', body: `Got it. $${offer.toLocaleString()} cash, 21 day close, we eat closing costs. Work for you?` },
      { role: 'owner', body: 'yeah lets do it' },
    ],
    footer: ({ offer }) => ({
      tone: 'success',
      body: `Agreed at $${offer.toLocaleString()}. Title scheduled this week.`,
    }),
  },

  // LATE: closed, walked, hostile, ghosted, emotional close
  {
    bucket: 'late',
    status: { label: 'Under Contract', tone: 'emerald' },
    outcome: 'agreed',
    build: ({ first, stretch }) => [
      { role: 'agent', body: `Hi ${first}, $${stretch.toLocaleString()} cash, close by the 30th. Yes or no?` },
      { role: 'owner', body: 'yes please. i need to be out' },
      { role: 'agent', body: `Done. Sending docs to your email. What's the best one?` },
      { role: 'owner', body: 'jamie.k@gmail.com. how soon?' },
      { role: 'agent', body: 'In your inbox in 5 min. Earnest goes into escrow today.' },
    ],
    footer: ({ stretch }) => ({
      tone: 'success',
      body: `Closed at $${stretch.toLocaleString()}. Closing in 12 days.`,
    }),
  },
  {
    bucket: 'late',
    status: { label: 'Removed from list', tone: 'rose' },
    outcome: 'dead',
    build: ({ first, address }) => [
      { role: 'agent', body: `Hi ${first}, just checking, are you the owner of ${address}?` },
      { role: 'owner', body: 'stop fucking texting me' },
      { role: 'agent', body: 'Got it. Removing you from our list right now. Have a good one.' },
    ],
    footer: () => ({ tone: 'fail', body: 'Hostile. Auto removed from all outreach.' }),
  },
  {
    bucket: 'late',
    status: { label: 'Walked away', tone: 'zinc' },
    outcome: 'dead',
    build: ({ first, address }) => [
      { role: 'agent', body: `Hi ${first}, are you still the owner of ${address}?` },
      { role: 'owner', body: 'not selling. lose my number' },
      { role: 'agent', body: 'No worries. Removing you. Take care.' },
    ],
    footer: () => ({ tone: 'warn', body: 'Not selling. Re queued for 90 day check in.' }),
  },
  {
    bucket: 'late',
    status: { label: 'Awaiting reply', tone: 'zinc' },
    outcome: 'pending',
    build: ({ first, address, offer }) => [
      { role: 'agent', body: `Hey ${first}, just checking in. Sent the offer Thursday at $${offer.toLocaleString()} cash for ${address}. Any thoughts?` },
      { role: 'owner', body: 'ill think about it' },
      { role: 'agent', body: 'Totally. Want me to revise the number or table this for now?' },
      { role: 'agent', body: `Hey ${first}, just bumping this. Happy to revisit anytime.` },
    ],
    footer: () => ({ tone: 'warn', body: 'Ghosted. Day 5 follow up scheduled.' }),
  },
  {
    bucket: 'late',
    status: { label: 'Under Contract', tone: 'emerald' },
    outcome: 'agreed',
    build: ({ first, stretch }) => [
      { role: 'agent', body: `Hi ${first}, we landed at $${stretch.toLocaleString()} cash, 21 day close. Confirming?` },
      { role: 'owner', body: 'yes confirming. honestly thank you' },
      { role: 'owner', body: 'this property has been hanging over me for 3 years' },
      { role: 'agent', body: 'Glad we could make it work. Sending the contract through Lumin in 5 min.' },
      { role: 'owner', body: 'much appreciated' },
    ],
    footer: ({ stretch }) => ({
      tone: 'success',
      body: `Closed at $${stretch.toLocaleString()}. Title in motion.`,
    }),
  },
];

const BY_BUCKET: Record<Bucket, Archetype[]> = {
  early: ARCHETYPES.filter((a) => a.bucket === 'early'),
  mid: ARCHETYPES.filter((a) => a.bucket === 'mid'),
  late: ARCHETYPES.filter((a) => a.bucket === 'late'),
};

function pickFromBucket(bucket: Bucket, exclude?: Archetype): Archetype {
  const pool = BY_BUCKET[bucket].filter((a) => a !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? BY_BUCKET[bucket][0];
}

// ─── Spawn a seller + script for a given bucket ────────────────────────────

function spawnFor(bucket: Bucket, last?: Archetype): {
  seller: Seller;
  archetype: Archetype;
  footer?: OutcomeFooter;
} {
  const meta = spawnSeller();
  const first = meta.owner.split(' ')[0];
  const arv = (140 + Math.floor(Math.random() * 220)) * 1000;
  const offer = Math.round(arv * 0.7);
  const stretch = Math.round(offer * (1.04 + Math.random() * 0.08));
  const archetype = pickFromBucket(bucket, last);
  const script = archetype.build({ first, address: meta.address, arv, offer, stretch });
  const footer = archetype.footer?.({ stretch, offer, first });
  return {
    seller: {
      ...meta,
      script,
      initialOffer: offer,
      agreedPrice: archetype.outcome === 'agreed' ? stretch : undefined,
      outcome: archetype.outcome === 'agreed' ? 'agreed' : 'dead',
    },
    archetype,
    footer,
  };
}

// ─── Thread state machine ───────────────────────────────────────────────────

type RevealedTurn = { role: 'agent' | 'owner'; body: string; id: number };

interface ThreadState {
  seller: Seller;
  archetype: Archetype;
  footer?: OutcomeFooter;
  revealed: RevealedTurn[];
  cursor: number;
  typing: boolean;
  done: boolean;
}

const MIN_TURN_DELAY = 1100;
const MAX_TURN_DELAY = 2400;
const TYPING_DELAY = 900;
const POST_DONE_HOLD = 3600;

function useChatThread(bucket: Bucket, seedDelayMs: number, active: boolean) {
  const [state, setState] = useState<ThreadState | null>(null);
  const turnIdRef = useRef(0);
  const stateRef = useRef<ThreadState | null>(null);
  const lastArchetypeRef = useRef<Archetype | undefined>(undefined);
  stateRef.current = state;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const commit = (next: ThreadState) => {
      stateRef.current = next;
      setState(next);
    };

    const startNew = () => {
      if (cancelled) return;
      const spawned = spawnFor(bucket, lastArchetypeRef.current);
      lastArchetypeRef.current = spawned.archetype;
      commit({
        seller: spawned.seller,
        archetype: spawned.archetype,
        footer: spawned.footer,
        revealed: [],
        cursor: 0,
        typing: false,
        done: false,
      });
      timeout = setTimeout(advance, 700);
    };

    const advance = () => {
      if (cancelled) return;
      const cur = stateRef.current;
      if (!cur) return;
      if (cur.cursor >= cur.seller.script.length) {
        commit({ ...cur, typing: false, done: true });
        timeout = setTimeout(startNew, POST_DONE_HOLD);
        return;
      }
      commit({ ...cur, typing: true });
      timeout = setTimeout(() => {
        if (cancelled) return;
        const c = stateRef.current;
        if (!c) return;
        const next = c.seller.script[c.cursor];
        if (!next) return;
        const turn: RevealedTurn = {
          role: next.role,
          body: next.body,
          id: turnIdRef.current++,
        };
        const newCursor = c.cursor + 1;
        const finished = newCursor >= c.seller.script.length;
        commit({
          ...c,
          revealed: [...c.revealed, turn],
          cursor: newCursor,
          typing: false,
          done: finished,
        });
        if (finished) {
          timeout = setTimeout(startNew, POST_DONE_HOLD);
        } else {
          const wait =
            MIN_TURN_DELAY + Math.random() * (MAX_TURN_DELAY - MIN_TURN_DELAY);
          timeout = setTimeout(advance, wait);
        }
      }, TYPING_DELAY);
    };

    timeout = setTimeout(startNew, seedDelayMs);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [bucket, seedDelayMs, active]);

  return state;
}

// ─── Section ────────────────────────────────────────────────────────────────

export default function LiveNegotiation() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      id="pipeline"
      className="landing-dark relative overflow-hidden px-6 py-24 md:px-12 md:py-32 lg:px-24"
    >
      <div
        className="pointer-events-none absolute -left-32 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full blur-[100px]"
        style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.18), transparent 60%)' }}
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full blur-[100px]"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18), transparent 60%)' }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-14 text-center md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="liquid-glass mx-auto mb-5 inline-flex items-center gap-2 rounded-lg px-3 py-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Live demo · happening right now
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-4xl font-medium leading-[1.05] tracking-[-1.5px] md:text-6xl"
          >
            Watch the AI{' '}
            <span className="font-serif font-normal italic">negotiate.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="hero-subtitle mx-auto mt-4 max-w-xl text-base opacity-90 md:text-lg"
          >
            Three sellers, three different stages, zero humans. Some warm,
            some difficult, some closing. All real.
          </motion.p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ChatThread bucket="early" seedDelayMs={0} active={active} />
          <ChatThread bucket="mid" seedDelayMs={1200} active={active} />
          <ChatThread bucket="late" seedDelayMs={2400} active={active} />
        </div>

        <NegotiationStats />
      </div>
    </section>
  );
}

// ─── Chat thread card ───────────────────────────────────────────────────────

function ChatThread({ bucket, seedDelayMs, active }: { bucket: Bucket; seedDelayMs: number; active: boolean }) {
  const state = useChatThread(bucket, seedDelayMs, active);
  if (!state) return <ChatSkeleton />;

  const { seller, archetype, revealed, typing, done, footer } = state;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6 }}
      className="liquid-glass flex flex-col rounded-2xl border border-white/10 p-4"
      style={{ height: 520 }}
    >
      <div className="flex items-start justify-between border-b border-white/10 pb-3">
        <div>
          <div className="text-xs font-medium text-white/50">
            {seller.address}, {seller.city}, {seller.state}
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            {seller.owner}
          </div>
        </div>
        <StatusBadge status={archetype.status} />
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-hidden py-3">
        <AnimatePresence initial={false}>
          {revealed.map((turn) => (
            <motion.div
              key={turn.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={turn.role === 'agent' ? 'self-end' : 'self-start'}
            >
              <div
                className={
                  'max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug ' +
                  (turn.role === 'agent'
                    ? 'rounded-br-sm bg-white text-black'
                    : 'rounded-bl-sm border border-white/10 bg-white/[0.06] text-white/85')
                }
              >
                {turn.body}
              </div>
              <div
                className={
                  'mt-0.5 text-[9px] uppercase tracking-wide text-white/30 ' +
                  (turn.role === 'agent' ? 'text-right' : 'text-left')
                }
              >
                {turn.role === 'agent' ? 'Birdog AI' : 'Seller'}
              </div>
            </motion.div>
          ))}
          {typing && !done && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 self-start rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.06] px-3 py-2"
            >
              <Dot delay={0} />
              <Dot delay={0.15} />
              <Dot delay={0.3} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {done && footer && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={
            'mt-auto rounded-lg px-3 py-2 text-xs ' +
            (footer.tone === 'success'
              ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
              : footer.tone === 'fail'
                ? 'border border-rose-400/30 bg-rose-400/10 text-rose-200'
                : 'border border-white/10 bg-white/[0.04] text-white/65')
          }
        >
          {footer.tone === 'success' ? '✓ ' : footer.tone === 'fail' ? '× ' : '· '}
          {footer.body}
        </motion.div>
      )}
    </motion.div>
  );
}

function ChatSkeleton() {
  return (
    <div
      className="liquid-glass flex items-center justify-center rounded-2xl border border-white/10"
      style={{ height: 520 }}
    >
      <span className="text-xs text-white/40">Connecting…</span>
    </div>
  );
}

function StatusBadge({ status }: { status: ChatStatus }) {
  const colors: Record<Tone, string> = {
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    blue: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    zinc: 'border-white/15 bg-white/[0.04] text-white/55',
  };
  const dotColor: Record<Tone, string> = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    blue: 'bg-blue-400',
    rose: 'bg-rose-400',
    zinc: 'bg-white/40',
  };
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors[status.tone]}`}
    >
      <span
        className={
          'h-1.5 w-1.5 rounded-full ' +
          dotColor[status.tone] +
          (status.tone === 'zinc' ? '' : ' pulse-dot')
        }
      />
      {status.label}
    </span>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-white/60"
      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
      transition={{ duration: 0.9, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

function NegotiationStats() {
  const [agreed, setAgreed] = useState(168);
  const [conv, setConv] = useState(2841);
  const [vol, setVol] = useState(4.21);

  useEffect(() => {
    const i1 = setInterval(() => setAgreed((v) => v + 1), 6000 + Math.random() * 4000);
    const i2 = setInterval(() => setConv((v) => v + 1), 600 + Math.random() * 600);
    const i3 = setInterval(() => setVol((v) => +(v + 0.02).toFixed(2)), 5000);
    return () => {
      clearInterval(i1);
      clearInterval(i2);
      clearInterval(i3);
    };
  }, []);

  const items = [
    { label: 'Conversations today', value: conv.toLocaleString() },
    { label: 'Deals agreed today', value: agreed.toString() },
    { label: 'Pipeline volume today', value: `$${vol.toFixed(2)}M` },
    { label: 'Avg time to first reply', value: '11s' },
  ];

  return (
    <div className="mt-12 grid grid-cols-2 gap-3 md:mt-14 md:grid-cols-4">
      {items.map((it, i) => (
        <motion.div
          key={it.label}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="liquid-glass rounded-xl border border-white/10 p-4"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
            {it.label}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-white md:text-3xl">
            {it.value}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
