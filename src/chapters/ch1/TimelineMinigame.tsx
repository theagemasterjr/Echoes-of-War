'use client';
/**
 * Chapter 1 minigame, DOM layer — plain 2D UI over the 3D table. The bottom
 * strip shows one card per column (matching the figure row left→right): tap
 * two cards (or two figures, or drag a figure) to swap, then CHECK MY ORDER.
 * Correct figures lock and their card reveals the date and why it matters.
 * Root is pointer-events-none so canvas taps work; the strip and panels
 * opt back in.
 */
import { useEffect, useState } from 'react';
import type { MinigameProps } from '../types';
import { voicePlayer } from '@/audio/voicePlayer';
import { EVENTS, SUMMARY, SUMMARY_SPOKEN, eventById, useTimelineStore } from './timelineStore';

export function TimelineMinigame({ chapterId, onComplete }: MinigameProps) {
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
  const [spoken, setSpoken] = useState(false); // the voice reads the summary exactly once
  const done = locked.length === EVENTS.length;

  // leaving the screen silences any summary still being read
  useEffect(() => () => voicePlayer.stop(), []);

  const onCardClick = (id: string) => {
    if (locked.includes(id)) return;
    if (selected && selected !== id) swapById(selected, id);
    else select(selected === id ? null : id);
  };

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
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/90 via-stone-950/75 to-transparent px-4 pb-4 pt-8">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-8 gap-1.5">
            {order.map((id, i) => {
              const event = eventById(id);
              const isLocked = locked.includes(id);
              const isSel = selected === id;
              const isWrong = lastWrong.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onCardClick(id)}
                  disabled={isLocked}
                  className={`flex flex-col items-center rounded-sm border px-1.5 py-2 text-center transition ${
                    isLocked
                      ? 'border-emerald-600/50 bg-emerald-500/10'
                      : isSel
                        ? 'border-amber-300 bg-amber-200/15'
                        : isWrong
                          ? 'border-red-800/70 bg-red-900/10 hover:border-red-500/70'
                          : 'border-stone-700 bg-stone-900/60 hover:border-amber-200/50'
                  }`}
                >
                  <span className="text-[9px] uppercase tracking-widest text-stone-500">
                    {i + 1}{i === 0 ? ' · earliest' : i === EVENTS.length - 1 ? ' · latest' : ''}
                  </span>
                  <span className={`mt-1 text-xs leading-snug ${isLocked ? 'text-emerald-100' : isSel ? 'text-amber-100' : 'text-stone-200'}`}>
                    {isLocked ? '✓ ' : ''}{event.label}
                  </span>
                  {isLocked && (
                    <>
                      <span className="mt-1 text-[10px] font-medium text-amber-200/80">{event.date}</span>
                      <span className="mt-0.5 text-[10px] leading-snug text-stone-400">{event.why}</span>
                    </>
                  )}
                  {!isLocked && isSel && (
                    <span className="mt-1 text-[9px] uppercase tracking-widest text-amber-200/70">
                      tap another to swap
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-center gap-4">
            {checks > 0 && (
              <span className="text-xs text-stone-400">
                {locked.length} of {EVENTS.length} in the right place — keep going.
              </span>
            )}
            <button
              onClick={check}
              className="rounded-sm border border-amber-200/50 bg-amber-200/10 px-6 py-2 text-xs tracking-[0.25em] text-amber-100 transition hover:bg-amber-200/20"
            >
              CHECK MY ORDER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
