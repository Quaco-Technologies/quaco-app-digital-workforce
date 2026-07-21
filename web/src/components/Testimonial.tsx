'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

const QUOTE =
  'Birdog replaced my entire VA team. We went from 3 deals a month to 12, and the AI handles every conversation. I haven’t sent a single follow-up text in weeks. It just works.';

export default function Testimonial() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end center'],
  });

  const words = QUOTE.split(' ');
  const total = words.length;

  return (
    <section className="landing-dark relative flex min-h-screen items-center justify-center overflow-hidden px-8 py-24 md:px-28 md:py-32">
      <div
        className="pointer-events-none absolute -left-40 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full opacity-40 blur-[100px]"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.35), transparent 60%)' }}
      />
      <div
        className="pointer-events-none absolute -right-40 top-1/3 h-[420px] w-[420px] rounded-full opacity-30 blur-[100px]"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.30), transparent 60%)' }}
      />
      <div
        ref={containerRef}
        className="mx-auto flex max-w-3xl flex-col items-start gap-10"
      >
        {/* Quote symbol — Instrument Serif glyph */}
        <span
          aria-hidden
          className="font-serif text-[120px] leading-none text-foreground"
          style={{ marginBottom: '-32px' }}
        >
          &ldquo;
        </span>

        {/* Testimonial text with scroll-driven word reveal */}
        <p className="flex flex-wrap text-4xl font-medium leading-[1.2] md:text-5xl">
          {words.map((word, i) => (
            <Word
              key={i}
              word={word}
              progress={scrollYProgress}
              range={[i / total, (i + 1) / total]}
            />
          ))}
        </p>

        {/* Author */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-foreground bg-gradient-to-br from-zinc-700 to-zinc-900 text-base font-semibold text-foreground">
            MC
          </div>
          <div>
            <div className="text-base font-semibold leading-7 text-foreground">
              Marcus Chen
            </div>
            <div className="text-sm font-normal leading-5 text-muted-foreground">
              Wholesale Investor
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Word({
  word,
  progress,
  range,
}: {
  word: string;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.2, 1]);
  const color = useTransform(progress, range, [
    'hsl(0 0% 35%)',
    'hsl(0 0% 100%)',
  ]);

  return (
    <motion.span style={{ opacity, color }} className="mr-[0.3em]">
      {word}
    </motion.span>
  );
}
