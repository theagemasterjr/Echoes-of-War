'use client';
/**
 * Chapter 4 minigame — "Turning the Tide", put the eight moments in order.
 *
 * Plain 2D DOM, deliberately: chapters 1–3 play on the 3D war-room table, but
 * this one is the simple safe shape the founder can replace later without
 * touching anything shared. Tap two cards to swap them, then CHECK MY ORDER —
 * whatever stands in the right place locks, opens (date + why) and stays put.
 * Score = how many were right on the FIRST check.
 *
 * The cards read left → right, top → bottom, so the row still runs earliest to
 * latest on a narrow window where it wraps onto two lines.
 *
 * The summary is its own black screen, shared by every chapter and by the
 * debug menu's jump — see ui/ChapterSummary.
 */
import { useEffect, useState } from 'react';
import type { MinigameProps } from '../types';
import { ChapterSummary } from '@/ui/ChapterSummary';
import { EVENTS, SUMMARY, eventById, useTimelineStore } from './timelineStore';

export function TurningPointMinigame({ chapterId, onComplete }: MinigameProps) {
  const order = useTimelineStore((s) => s.order);
  const locked = useTimelineStore((s) => s.locked);
  const lastWrong = useTimelineStore((s) => s.lastWrong);
  const selected = useTimelineStore((s) => s.selected);
  const checks = useTimelineStore((s) => s.checks);
  const firstCheckScore = useTimelineStore((s) => s.firstCheckScore);
  const select = useTimelineStore((s) => s.select);
  const swapById = useTimelineStore((s) => s.swapById);
  const check = useTimelineStore((s) => s.check);
  const reset = useTimelineStore((s) => s.reset);
  const [showSummary, setShowSummary] = useState(false);
  const done = locked.length === EVENTS.length;

  useEffect(() => reset(), [reset]); // fresh shuffle every time the player arrives

  /** Tap one card to pick it up, tap a second to swap the two. */
  const tap = (id: string) => {
    if (locked.includes(id)) return;
    if (!selected) return select(id);
    if (selected === id) return select(null);
    swapById(selected, id);
  };

  // the shared summary screen — mounted only once the player opens it, which
  // is what starts (and, on the way out, silences) the narrated take
  if (showSummary) {
    return (
      <ChapterSummary
        chapterId={chapterId}
        summary={SUMMARY}
        onFinish={() =>
          onComplete({
            chapterId,
            completed: true,
            score: (firstCheckScore ?? 0) / EVENTS.length,
          })
        }
      />
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center overflow-y-auto px-4 py-6">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
          Stalingrad · Timeline
        </div>
        <h2 className="mt-1 text-lg font-light text-stone-100">
          Put the moments in order, earliest to latest
        </h2>
        <p className="mt-1 text-xs text-stone-400">
          Tap two cards to swap them. Then check your order.
        </p>
      </div>

      <div
        className="pointer-events-auto mt-6 grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4"
        role="list"
        aria-label="The eight moments, in the order you have put them"
      >
        {order.map((id, i) => {
          const e = eventById(id);
          const isLocked = locked.includes(id);
          const isSelected = selected === id;
          const wasWrong = lastWrong.includes(id);
          return (
            <button
              key={id}
              role="listitem"
              onClick={() => tap(id)}
              disabled={isLocked}
              aria-pressed={isSelected}
              aria-label={`Position ${i + 1}: ${e.label}${isLocked ? ` — correct, ${e.date}` : ''}`}
              className={`rounded-md border p-3 text-left transition disabled:cursor-default ${
                isLocked
                  ? 'border-emerald-500/50 bg-emerald-950/60'
                  : isSelected
                    ? 'border-amber-200/70 bg-amber-200/10'
                    : wasWrong
                      ? 'border-stone-600 bg-stone-950/90 hover:bg-stone-900/90'
                      : 'border-stone-800 bg-stone-950/90 hover:bg-stone-900/90'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] tracking-[0.2em] text-stone-500">{i + 1}</span>
                {isLocked && <span className="text-[10px] text-emerald-400">✓</span>}
                {!isLocked && wasWrong && (
                  <span className="text-[10px] text-stone-500">not yet</span>
                )}
              </div>
              <div className="mt-1.5 text-sm leading-snug text-stone-100">{e.label}</div>
              {/* a card only opens once it is in the right place — the date and
                  the reason are the reward for getting it there */}
              {isLocked && (
                <div className="mt-2 border-t border-emerald-500/20 pt-2">
                  <div className="text-[11px] tracking-wide text-amber-200/80">{e.date}</div>
                  <p className="mt-1 text-xs leading-relaxed text-stone-300">{e.why}</p>
                  <div className="mt-2 text-[9px] uppercase tracking-[0.2em] text-stone-500">
                    {e.group}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {done ? (
        <div className="pointer-events-auto mt-6 w-full max-w-md rounded-md border border-stone-800 bg-stone-950/85 p-7 text-center backdrop-blur-sm">
          <p className="text-sm text-stone-200">
            Timeline complete — {firstCheckScore} of {EVENTS.length} right on your first check.
          </p>
          <p className="mt-2 text-xs text-stone-500">
            You just put the whole battle in order: why the fighting came here, the months in
            the ruins, and how the tide turned.
          </p>
          <button
            onClick={() => setShowSummary(true)}
            className="mt-5 rounded-sm border border-amber-200/40 px-6 py-2.5 text-xs tracking-[0.25em] text-amber-100 hover:bg-amber-200/10"
          >
            CONTINUE →
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-2 pb-2">
          {checks > 0 && (
            <span
              className="rounded-sm bg-stone-950/70 px-3 py-1 text-xs text-stone-300 backdrop-blur-sm"
              aria-live="polite"
            >
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
