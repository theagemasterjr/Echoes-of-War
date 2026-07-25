'use client';
/**
 * Chapter 1 minigame, DOM layer — instructions, the CHECK MY ORDER button and
 * the summary. The per-figure cards live in the 3D scene (screen-anchored
 * under each figure, like the chapter labels on the map). Root is
 * pointer-events-none so canvas taps work; buttons and panels opt back in.
 */
import { useEffect, useState } from 'react';
import type { MinigameProps } from '../types';
import { voicePlayer } from '@/audio/voicePlayer';
import { EVENTS, SUMMARY, SUMMARY_SPOKEN, useTimelineStore } from './timelineStore';

export function TimelineMinigame({ chapterId, onComplete }: MinigameProps) {
  const locked = useTimelineStore((s) => s.locked);
  const checks = useTimelineStore((s) => s.checks);
  const firstCheckScore = useTimelineStore((s) => s.firstCheckScore);
  const check = useTimelineStore((s) => s.check);
  const [showSummary, setShowSummary] = useState(false);
  const [spoken, setSpoken] = useState(false); // the voice reads the summary exactly once
  const done = locked.length === EVENTS.length;

  // leaving the screen silences any summary still being read
  useEffect(() => () => voicePlayer.stop(), []);

  if (showSummary) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
        <div className="pointer-events-auto w-full max-w-xl rounded-md border border-stone-800 bg-stone-950/85 p-8 backdrop-blur-sm">
          <div className="text-center text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
            Chapter 1 · Summary
          </div>
          <h2 className="mt-3 text-center text-xl font-light text-stone-100">What you learned</h2>
          <ul className="mt-6 space-y-4">
            {SUMMARY.map((s) => (
              <li key={s.topic}>
                <div className="text-[10px] uppercase tracking-widest text-amber-200/70">{s.topic}</div>
                <p className="mt-1 text-sm leading-relaxed text-stone-300">{s.line}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex justify-center gap-3">
            <button
              onClick={() => {
                if (spoken) return;
                setSpoken(true);
                voicePlayer.speak(SUMMARY_SPOKEN, chapterId);
              }}
              disabled={spoken}
              className="rounded-sm border border-stone-700 px-5 py-2.5 text-xs tracking-widest text-stone-300 transition hover:bg-stone-800 disabled:opacity-40"
            >
              {spoken ? '✓ PLAYED' : '🔊 READ IT TO ME'}
            </button>
            <button
              onClick={() => {
                voicePlayer.stop();
                onComplete({ chapterId, completed: true, score: (firstCheckScore ?? 0) / EVENTS.length });
              }}
              className="rounded-sm border border-amber-200/40 px-5 py-2.5 text-xs tracking-[0.25em] text-amber-100 hover:bg-amber-200/10"
            >
              FINISH CHAPTER →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-12 -translate-x-1/2 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
          Road to War · Timeline
        </div>
        <h2 className="mt-1 text-lg font-light text-stone-100">
          Put the figures in order, earliest to latest
        </h2>
        <p className="mt-1 text-xs text-stone-400">
          Tap two cards (or two figures) to swap them — or drag a figure along the table. Then check your order.
        </p>
      </div>

      {done ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-6 pb-8">
          <div className="pointer-events-auto w-full max-w-md rounded-md border border-stone-800 bg-stone-950/85 p-7 text-center backdrop-blur-sm">
            <p className="text-sm text-stone-200">
              Timeline complete — {firstCheckScore} of {EVENTS.length} right on your first check.
            </p>
            <p className="mt-2 text-xs text-stone-500">
              You just put the whole story in order: the treaty, Germany under it, Hitler’s rise
              to power, and how Poland was conquered.
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
        /* the cards live in the 3D scene under each figure — down here only
           the check button and its running status */
        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
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
