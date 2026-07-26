'use client';
/**
 * Chapter 2 minigame, DOM layer — the instructions, the five box descriptions
 * and the summary. The boxes and the pieces themselves are the 3D scene
 * (MatchTableScene); every word in the game is plain 2D DOM up here, the way
 * chapter 1's card strip is. Each description hangs directly above its own box:
 * the scene measures where the box row lands on screen and publishes it
 * (matchStore.screen), so the pairing holds at any window size. Root is
 * pointer-events-none so drags reach the canvas; the summary opts back in.
 *
 * The summary is its own black screen, shared by every chapter and by the
 * debug menu's jump — see ui/ChapterSummary.
 */
import { useEffect, useState } from 'react';
import type { MinigameProps } from '../types';
import { ChapterSummary } from '@/ui/ChapterSummary';
import { MOMENTS, SUMMARY, momentById, useMatchStore } from './matchStore';

/** A beat to admire the finished row before the summary takes the screen. */
const FINISH_HOLD_MS = 2200;

export function MatchMinigame({ chapterId, onComplete }: MinigameProps) {
  const row = useMatchStore((s) => s.row);
  const placed = useMatchStore((s) => s.placed);
  const firstTryCorrect = useMatchStore((s) => s.firstTryCorrect);
  const screen = useMatchStore((s) => s.screen);
  const [showSummary, setShowSummary] = useState(false);
  const done = placed.length === MOMENTS.length;

  // the last piece lands, the row holds for a moment, then the chapter closes
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setShowSummary(true), FINISH_HOLD_MS);
    return () => clearTimeout(t);
  }, [done]);

  // the shared summary screen — mounted only once the row is finished, which
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
            score: firstTryCorrect / MOMENTS.length,
          })
        }
      />
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-4 -translate-x-1/2 px-6 text-center" aria-live="polite">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
          The Summer of 1940 · Match the piece to the moment
        </div>
        <h2 className="mt-1 text-lg font-light text-stone-100">
          {done ? 'All five in their place.' : 'Drag each piece into the box that describes it'}
        </h2>
        {!done && (
          <span className="mt-1 inline-block text-xs text-stone-400">
            {placed.length} of {MOMENTS.length} matched
          </span>
        )}
      </div>

      {/* The five descriptions, hung above their own box. The strip fills the
          screen down to the far edge of the box row and bottom-aligns its
          cards, so a long description grows upward and never covers a box. */}
      {screen && (
        <div
          className="absolute inset-x-0 top-0 flex justify-center px-2 pb-[1.2vh]"
          style={{ height: `${screen.boxes.top * 100}%` }}
          aria-label="What each box is looking for"
        >
          <div
            className="flex w-full items-end gap-2"
            style={{ maxWidth: `${screen.boxes.column * MOMENTS.length * 100}%` }}
          >
            {MOMENTS.map((moment) => {
              const matched = placed.includes(moment.id);
              return (
                <div key={moment.id} className="flex-1">
                  <div
                    className={`rounded-sm border px-2 py-1.5 text-center backdrop-blur-sm transition ${
                      matched
                        ? 'border-amber-300/60 bg-amber-950/45'
                        : 'border-stone-700 bg-stone-950/75'
                    }`}
                  >
                    <p
                      className={`text-sm leading-snug ${
                        matched ? 'text-amber-100/90' : 'text-stone-200'
                      }`}
                    >
                      {moment.description}
                    </p>
                    {matched && (
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.25em] text-amber-200/70">
                        ✓ matched
                      </span>
                    )}
                  </div>
                  {/* the little point aimed at this card's own box */}
                  <div
                    className={`mx-auto -mt-1 h-2 w-2 rotate-45 border-b border-r backdrop-blur-sm ${
                      matched
                        ? 'border-amber-300/60 bg-amber-950/45'
                        : 'border-stone-700 bg-stone-950/75'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Each piece's name, under its place in the row — a bronze boat and a
          bronze carriage read alike at table distance, so every piece is
          named until it finds its box (and a piece whose model failed to load
          is a plain block with only this name to go by). */}
      {screen && (
        <div
          className="absolute inset-x-0 flex justify-center px-2"
          style={{ top: `${screen.pieces.top * 100}%` }}
        >
          <div
            className="flex w-full gap-2"
            style={{ maxWidth: `${screen.pieces.column * MOMENTS.length * 100}%` }}
          >
            {row.map((id) => (
              <div key={id} className="flex-1 text-center">
                {!placed.includes(id) && (
                  <span className="rounded-sm bg-stone-950/60 px-2 py-0.5 text-[11px] leading-snug text-stone-300 backdrop-blur-sm">
                    {momentById(id).pieceName}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
