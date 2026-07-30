'use client';
/**
 * The end-of-game screen — shown once, after chapter 6 completes, before the
 * map returns. Built like a chapter summary, but the six CHAPTERS are the
 * rows: one short line each of what the player learned, a congratulations,
 * and a quiet celebration — drifting gold sparks over black, in the game's
 * own palette, never confetti-noisy. Reduced motion gets a still page.
 *
 * The founder's recording reads the intro paragraph and then the six chapter
 * lines (never the heading, titles or footer), so the screen reveals each
 * block as the narrator reaches it — same clock, same fallback and same skip
 * as the chapter summaries (see audio/summaryNarration). The footer arrives
 * when the take ends.
 */
import { useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppStore } from '@/state/appStore';
import { useNarratedReveal, type SummaryTake } from '@/audio/summaryNarration';

/** One row per chapter — the titles are on screen; the lines are what the
 *  narration reads (re-measure TAKE below if a line's wording changes). */
const CHAPTERS: { title: string; line: string }[] = [
  {
    title: 'The Spark',
    line: 'One unfair treaty left Germany broken and angry — and a leader who promised revenge marched the world back to war.',
  },
  {
    title: 'Standing Alone',
    line: 'Britain saved its army at Dunkirk, won the battle in the air, and refused to give in.',
  },
  {
    title: 'A World at War',
    line: 'One morning at Pearl Harbor pulled America in — and the fighting became one war, across the whole world.',
  },
  {
    title: 'Turning the Tide',
    line: 'At Stalingrad the Red Army closed a ring around a whole German army — and Germany never advanced east again.',
  },
  {
    title: 'The Road Back',
    line: 'On D-Day the Allies returned to Europe — after making Germany certain they would land somewhere else.',
  },
  {
    title: 'The Cost of Victory',
    line: 'The war ended in the Pacific at a terrible cost — and left the world a question people are still asking.',
  },
];

/**
 * The founder's 2026-07-30 recording: the intro paragraph, then the six
 * chapter lines, in order. Measured with scripts/lib/narration-segments.mjs
 * (10.9–13.8 characters a second across all seven segments).
 */
const TAKE: SummaryTake = {
  track: '/audio/ending.mp3?v=1',
  topics: [
    { start: 0.08, end: 12.46 }, // intro paragraph
    { start: 12.92, end: 21.92 },
    { start: 22.7, end: 29.2 },
    { start: 29.94, end: 38.62 },
    { start: 39.6, end: 48.34 },
    { start: 49.3, end: 58.58 },
    { start: 59.9, end: 67.46 },
  ],
};

/** Deterministic pseudo-random spark layout — stable across renders. */
function sparks(n: number) {
  const out: { left: number; delay: number; duration: number; size: number; drift: number }[] = [];
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < n; i++) {
    out.push({
      left: 4 + rand() * 92,
      delay: rand() * 6,
      duration: 7 + rand() * 8,
      size: 2 + rand() * 3,
      drift: -20 - rand() * 30,
    });
  }
  return out;
}

export function EndOfGame() {
  const returnToMap = useAppStore((s) => s.returnToMap);
  const reduced = useReducedMotion() ?? false;
  const dots = useMemo(() => sparks(26), []);
  const backRef = useRef<HTMLButtonElement>(null);

  // segment 0 is the intro paragraph, segments 1–6 the chapter rows
  const reveal = useNarratedReveal(TAKE, CHAPTERS.length + 1, true);
  const introShown = reveal.revealed > 0;

  return (
    <div
      className="pointer-events-auto absolute inset-0 overflow-y-auto bg-black"
      role="region"
      aria-label="You finished the game"
      aria-live="polite"
    >
      {/* the celebration: slow golden sparks rising like the war room's dust
          motes — present, warm, never loud. Skipped under reduced motion. */}
      {!reduced && (
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          {dots.map((d, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full bg-amber-200/70"
              style={{
                left: `${d.left}%`,
                bottom: '-3%',
                width: d.size,
                height: d.size,
                boxShadow: '0 0 8px 2px rgba(252, 211, 77, 0.35)',
              }}
              animate={{ y: [`0vh`, `${d.drift - 85}vh`], opacity: [0, 0.9, 0.7, 0] }}
              transition={{
                duration: d.duration,
                delay: d.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}
        </div>
      )}

      <div className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col items-center px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.9 }}
          className="text-center"
        >
          <div className="text-[10px] uppercase tracking-[0.35em] text-amber-200/60">
            Echoes of War · 1938–1945
          </div>
          <h1 className="mt-4 text-3xl font-light tracking-wide text-amber-100 sm:text-4xl">
            You made it through the war.
          </h1>
          <motion.p
            initial={false}
            animate={{ opacity: introShown ? 1 : 0, y: introShown || reduced ? 0 : 10 }}
            transition={{ duration: reduced ? 0 : 0.7, ease: 'easeOut' }}
            aria-hidden={!introShown}
            className="mt-4 text-base leading-relaxed text-stone-300"
          >
            Great job. You met six people who lived it, asked your own questions, and pieced the
            whole story together yourself. That is real history work.
          </motion.p>
        </motion.div>

        <ul className="mt-12 w-full space-y-7">
          {CHAPTERS.map((c, i) => {
            const shown = reveal.revealed > i + 1;
            const speaking = reveal.current === i + 1 && !reveal.finished;
            return (
              <motion.li
                key={c.title}
                initial={false}
                animate={{
                  opacity: shown ? (speaking || reveal.finished ? 1 : 0.4) : 0,
                  y: shown || reduced ? 0 : 10,
                }}
                transition={{ duration: reduced ? 0 : 0.7, ease: 'easeOut' }}
                aria-hidden={!shown}
              >
                <div
                  className={`text-[11px] uppercase tracking-[0.25em] ${
                    speaking ? 'text-amber-200' : 'text-amber-200/70'
                  }`}
                >
                  Chapter {i + 1} · {c.title}
                </div>
                <p className="mt-1.5 text-base leading-relaxed text-stone-200">{c.line}</p>
              </motion.li>
            );
          })}
        </ul>

        {reveal.finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.9 }}
            // NO autoFocus on the button: focusing while this overflow
            // container is mid-reveal would scroll the page to the footer.
            // Focus only once the footer has fully faded in, and without
            // scrolling (same hazard MissionBrief documents).
            onAnimationComplete={() => backRef.current?.focus({ preventScroll: true })}
            className="mt-12 flex flex-col items-center pb-6"
          >
            <p className="text-sm text-stone-400">
              The map is still yours — every chapter can be played again.
            </p>
            <button
              ref={backRef}
              onClick={() => returnToMap()}
              className="mt-5 rounded-sm border border-amber-200/50 px-8 py-3 text-xs tracking-[0.3em] text-amber-100 transition hover:bg-amber-200/10"
            >
              BACK TO THE MAP →
            </button>
          </motion.div>
        )}
      </div>

      {!reveal.finished && (
        <button
          onClick={reveal.skip}
          className="fixed bottom-6 right-6 rounded-sm border border-stone-700/70 px-5 py-2 text-[10px] uppercase tracking-[0.25em] text-stone-500 transition hover:border-amber-200/40 hover:text-amber-100/80"
        >
          Skip →
        </button>
      )}
    </div>
  );
}
