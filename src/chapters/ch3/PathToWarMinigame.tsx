'use client';
/**
 * Chapter 3 minigame — the road to a world war as a 2D card timeline, played
 * over the shared chapter staging (no 3D scene of its own; the founder may
 * replace this with a tabletop scene later, the way chapter 1's works). Tap
 * two cards to swap them; CHECK MY ORDER locks the correct ones, which turn
 * green and reveal their date and why they mattered. Score = right on the
 * first check. Summary screen behaviour is identical to chapter 1's: its own
 * black screen, narrated, each topic appearing as it is spoken.
 */
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { MinigameProps } from '../types';
import { useSummaryNarration } from '@/audio/summaryNarration';
import { EVENTS, SUMMARY, eventById, useTimelineStore } from './timelineStore';

export function PathToWarMinigame({ chapterId, onComplete }: MinigameProps) {
  const order = useTimelineStore((s) => s.order);
  const locked = useTimelineStore((s) => s.locked);
  const lastWrong = useTimelineStore((s) => s.lastWrong);
  const selected = useTimelineStore((s) => s.selected);
  const checks = useTimelineStore((s) => s.checks);
  const firstCheckScore = useTimelineStore((s) => s.firstCheckScore);
  const select = useTimelineStore((s) => s.select);
  const swapById = useTimelineStore((s) => s.swapById);
  const check = useTimelineStore((s) => s.check);
  const [showSummary, setShowSummary] = useState(false);
  const done = locked.length === EVENTS.length;

  // the narrated summary — idle until the summary screen opens, and silenced
  // by leaving it (the hook hands the voice back on unmount)
  const reveal = useSummaryNarration(chapterId, SUMMARY.length, showSummary);
  const reduced = useReducedMotion() ?? false;

  const tapCard = (id: string) => {
    if (locked.includes(id)) return;
    if (selected === null) select(id);
    else if (selected === id) select(null);
    else swapById(selected, id);
  };

  if (showSummary) {
    return (
      <div
        className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black px-6 py-10"
        role="region"
        aria-label="Chapter summary"
        aria-live="polite"
      >
        <div className="w-full max-w-2xl">
          <div className="text-center text-[10px] uppercase tracking-[0.35em] text-amber-200/50">
            Chapter 3 · Summary
          </div>
          <h2 className="mt-3 text-center text-2xl font-light tracking-wide text-stone-100">
            What you learned
          </h2>
          <ul className="mt-10 space-y-7">
            {SUMMARY.map((s, i) => {
              const shown = i < reveal.revealed;
              const speaking = i === reveal.current && !reveal.finished;
              return (
                <motion.li
                  key={s.topic}
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
                    {s.topic}
                  </div>
                  <p className="mt-1.5 text-base leading-relaxed text-stone-200">{s.line}</p>
                </motion.li>
              );
            })}
          </ul>
          {reveal.finished && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.9 }}
              className="mt-12 flex justify-center"
            >
              <button
                autoFocus
                onClick={() =>
                  onComplete({
                    chapterId,
                    completed: true,
                    score: (firstCheckScore ?? 0) / EVENTS.length,
                  })
                }
                className="rounded-sm border border-amber-200/50 px-8 py-3 text-xs tracking-[0.3em] text-amber-100 transition hover:bg-amber-200/10"
              >
                FINISH CHAPTER →
              </button>
            </motion.div>
          )}
        </div>

        {!reveal.finished && (
          <button
            onClick={reveal.skip}
            className="absolute bottom-6 right-6 rounded-sm border border-stone-700/70 px-5 py-2 text-[10px] uppercase tracking-[0.25em] text-stone-500 transition hover:border-amber-200/40 hover:text-amber-100/80"
          >
            Skip →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="mt-10 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
          The Road to a World War · Timeline
        </div>
        <h2 className="mt-1 text-lg font-light text-stone-100">
          Put the cards in order, earliest to latest
        </h2>
        <p className="mt-1 text-xs text-stone-400">
          Tap two cards to swap them. Then check your order.
        </p>
      </div>

      {/* the card row — wraps to two rows of four on ordinary screens */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="pointer-events-auto grid w-full max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
          {order.map((id, i) => {
            const e = eventById(id);
            const isLocked = locked.includes(id);
            const isSelected = selected === id;
            const isWrong = lastWrong.includes(id);
            return (
              <button
                key={id}
                onClick={() => tapCard(id)}
                disabled={isLocked}
                className={`flex min-h-32 flex-col rounded-md border p-3 text-left backdrop-blur-sm transition ${
                  isLocked
                    ? 'border-emerald-700/60 bg-emerald-950/40'
                    : isSelected
                      ? 'border-amber-300 bg-amber-200/10'
                      : isWrong
                        ? 'border-red-900/70 bg-stone-950/70 hover:border-amber-200/40'
                        : 'border-stone-700 bg-stone-950/70 hover:border-amber-200/40'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-stone-500">
                    {i + 1}
                  </span>
                  <span className="truncate text-[9px] uppercase tracking-wider text-amber-200/50">
                    {e.group}
                  </span>
                </div>
                <div className="mt-1 text-sm leading-snug text-stone-100">{e.label}</div>
                {isLocked && (
                  <div className="mt-2">
                    <div className="text-[10px] tracking-wider text-emerald-300">{e.date}</div>
                    <p className="mt-1 text-[11px] leading-snug text-stone-400">{e.why}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {done ? (
        <div className="flex justify-center p-6 pb-8">
          <div className="pointer-events-auto w-full max-w-md rounded-md border border-stone-800 bg-stone-950/85 p-7 text-center backdrop-blur-sm">
            <p className="text-sm text-stone-200">
              Timeline complete — {firstCheckScore} of {EVENTS.length} right on your first check.
            </p>
            <p className="mt-2 text-xs text-stone-500">
              You just put the whole story in order: why Japan attacked, the attack on
              Pearl Harbor, and how America — and the whole world — went to war.
            </p>
            <button
              onClick={() => setShowSummary(true)}
              className="mt-5 rounded-sm border border-amber-200/40 px-6 py-2.5 text-xs tracking-[0.25em] text-amber-100 hover:bg-amber-200/10"
            >
              CONTINUE →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 p-6 pb-8">
          {checks > 0 && (
            <span className="rounded-sm bg-stone-950/70 px-3 py-1 text-xs text-stone-300 backdrop-blur-sm">
              {locked.length} of {EVENTS.length} in the right place — keep going.
            </span>
          )}
          <button
            onClick={check}
            className="pointer-events-auto rounded-sm border border-amber-200/50 bg-stone-950/70 px-6 py-2 text-xs tracking-[0.25em] text-amber-100 backdrop-blur-sm transition hover:bg-amber-200/10"
          >
            CHECK MY ORDER
          </button>
        </div>
      )}
    </div>
  );
}
