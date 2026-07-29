'use client';
/**
 * The end-of-game screen — shown once, after chapter 6 completes, before the
 * map returns. Built like a chapter summary, but the six CHAPTERS are the
 * rows: one short line each of what the player learned, a congratulations,
 * and a quiet celebration — drifting gold sparks over black, in the game's
 * own palette, never confetti-noisy. Reduced motion gets a still page.
 *
 * The rows reveal on a stagger (no narration is recorded for this screen
 * yet; when the founders record one, wire it the way summaryNarration wires
 * the chapter summaries and reveal rows on its clock instead).
 */
import { useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppStore } from '@/state/appStore';

/** One row per chapter — the titles are on screen; the lines are written to
 *  be readable AND recordable (the future narration reads the lines only). */
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

  return (
    <div
      className="pointer-events-auto absolute inset-0 overflow-y-auto bg-black"
      role="region"
      aria-label="You finished the game"
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
          <h1 className="mt-4 text-4xl font-light tracking-wide text-amber-100">
            You made it through the war.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-stone-300">
            Great job. You met six people who lived it, asked your own questions, and pieced the
            whole story together yourself. That is real history work.
          </p>
        </motion.div>

        <ul className="mt-12 w-full space-y-7">
          {CHAPTERS.map((c, i) => (
            <motion.li
              key={c.title}
              initial={{ opacity: 0, y: reduced ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : 0.6 + i * 0.45 }}
            >
              <div className="text-[11px] uppercase tracking-[0.25em] text-amber-200/70">
                Chapter {i + 1} · {c.title}
              </div>
              <p className="mt-1.5 text-base leading-relaxed text-stone-200">{c.line}</p>
            </motion.li>
          ))}
        </ul>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.9, delay: reduced ? 0 : 0.6 + CHAPTERS.length * 0.45 }}
          // NO autoFocus on the button: it is mounted (invisibly) from the
          // first frame, and focusing it at mount scrolls this overflow
          // container straight to the footer — the whole reveal would play
          // off-screen. Focus it when it has actually faded in, and without
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
      </div>
    </div>
  );
}
