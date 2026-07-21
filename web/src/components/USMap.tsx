'use client';

import { motion } from 'motion/react';

// SVG coords are based on Wikimedia "Blank US Map (states only).svg"
// viewBox 0 0 959 593. We position cities by percentage of those dimensions.
type City = { name: string; label?: string; x: number; y: number; hot?: boolean };

// SVG coords inside each state's path, derived from the Wikimedia Albers-USA
// projection (viewBox 0 0 959 593). Hand-tuned to land inside the correct state.
const CITIES: City[] = [
  { name: 'Seattle',        label: 'SEA',  x: 158, y: 76 },
  { name: 'Portland',                       x: 154, y: 122 },
  { name: 'San Francisco',                  x: 102, y: 290 },
  { name: 'Los Angeles',    label: 'LA',   x: 142, y: 372, hot: true },
  { name: 'Las Vegas',                      x: 178, y: 340, hot: true },
  { name: 'Phoenix',        label: 'PHX',  x: 208, y: 402, hot: true },
  { name: 'Salt Lake City',                 x: 248, y: 240 },
  { name: 'Denver',                         x: 318, y: 288 },
  { name: 'Albuquerque',                    x: 302, y: 382 },
  { name: 'Minneapolis',                    x: 528, y: 198 },
  { name: 'Kansas City',                    x: 502, y: 308 },
  { name: 'St. Louis',                      x: 574, y: 318 },
  { name: 'Oklahoma City',                  x: 458, y: 388 },
  { name: 'San Antonio',                    x: 470, y: 482 },
  { name: 'Austin',                         x: 478, y: 462, hot: true },
  { name: 'Dallas',         label: 'DAL',  x: 488, y: 428, hot: true },
  { name: 'Houston',        label: 'HOU',  x: 516, y: 476, hot: true },
  { name: 'New Orleans',                    x: 584, y: 472 },
  { name: 'Memphis',                        x: 588, y: 398, hot: true },
  { name: 'Nashville',      label: 'BNA',  x: 636, y: 402, hot: true },
  { name: 'Birmingham',                     x: 660, y: 438, hot: true },
  { name: 'Atlanta',        label: 'ATL',  x: 700, y: 432, hot: true },
  { name: 'Jacksonville',                   x: 728, y: 472 },
  { name: 'Orlando',                        x: 738, y: 492 },
  { name: 'Tampa',          label: 'TPA',  x: 726, y: 506, hot: true },
  { name: 'Miami',          label: 'MIA',  x: 762, y: 538, hot: true },
  { name: 'Charlotte',      label: 'CLT',  x: 728, y: 422, hot: true },
  { name: 'Raleigh',                        x: 766, y: 412, hot: true },
  { name: 'Richmond',                       x: 778, y: 346 },
  { name: 'Washington DC',                  x: 786, y: 322 },
  { name: 'Philadelphia',                   x: 800, y: 294 },
  { name: 'New York',       label: 'NYC',  x: 818, y: 274 },
  { name: 'Boston',                         x: 846, y: 234 },
  { name: 'Pittsburgh',                     x: 738, y: 290 },
  { name: 'Cleveland',                      x: 686, y: 274, hot: true },
  { name: 'Detroit',                        x: 652, y: 252 },
  { name: 'Columbus',                       x: 674, y: 296, hot: true },
  { name: 'Cincinnati',                     x: 658, y: 312 },
  { name: 'Indianapolis',                   x: 614, y: 296, hot: true },
  { name: 'Chicago',        label: 'ORD',  x: 588, y: 274 },
];

const W = 959;
const H = 593;

export default function USMap({
  variant = 'dashboard',
  showLabels = true,
}: {
  variant?: 'dashboard' | 'hero';
  showLabels?: boolean;
}) {
  const dotScale = variant === 'hero' ? 1.3 : 1;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* US states base layer — inverted dark */}
      <img
        src="/us-states.svg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
        style={{
          filter:
            'invert(1) hue-rotate(180deg) saturate(0.6) brightness(0.5) drop-shadow(0 0 18px rgba(99,102,241,0.10))',
          opacity: 0.55,
        }}
      />

      {/* Glow tint overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 70% at 50% 60%, rgba(99,102,241,0.08), transparent 70%)',
        }}
      />

      {/* City dots (positioned by %) */}
      <div className="absolute inset-0">
        {CITIES.map((c, i) => {
          const left = (c.x / W) * 100;
          const top = (c.y / H) * 100;
          return (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, scale: 0.4 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.5,
                delay: 0.2 + i * 0.025,
                ease: 'easeOut',
              }}
              className="absolute"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {c.hot && (
                <span
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/80 map-ping"
                  style={{
                    width: `${10 * dotScale}px`,
                    height: `${10 * dotScale}px`,
                    animationDelay: `${(i % 6) * 0.4}s`,
                  }}
                />
              )}
              <span
                className={
                  'relative block rounded-full ring-1 ring-white/30 ' +
                  (c.hot
                    ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]'
                    : 'bg-white/55')
                }
                style={{
                  width: c.hot ? `${6 * dotScale}px` : `${4 * dotScale}px`,
                  height: c.hot ? `${6 * dotScale}px` : `${4 * dotScale}px`,
                }}
              />
              {showLabels && c.label && (
                <span
                  className={
                    'absolute left-2 top-1/2 -translate-y-1/2 whitespace-nowrap font-medium ' +
                    (c.hot ? 'text-emerald-200/80' : 'text-white/55')
                  }
                  style={{ fontSize: variant === 'hero' ? 11 : 9 }}
                >
                  {c.label}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
