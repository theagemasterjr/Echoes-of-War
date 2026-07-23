'use client';
/**
 * Chapter 1 — The Spark. This is the VERTICAL SLICE chapter: still placeholder
 * content, but slightly fuller so it doubles as the reference example for how
 * a filled-in chapter looks. Founders: see docs/chapter-guide.md.
 */
import { useState } from 'react';
import type { BeatProps, ChapterModule, MinigameProps } from '../types';

function Overview({ onAdvance }: BeatProps) {
  return (
    /* side panel — the 3D showcase orbits the chapter object on the left */
    <div className="absolute inset-0 flex items-center justify-end p-6 md:pr-14">
      <div className="w-full max-w-md rounded-md border border-stone-800 bg-stone-950/70 p-8 backdrop-blur-sm">
        <div className="text-[11px] uppercase tracking-[0.4em] text-amber-200/60">
          Chapter 1 · 1919 – 1939
        </div>
        <h2 className="mt-3 text-3xl font-light text-stone-100">The Spark</h2>
        <p className="mt-2 text-sm text-stone-400">The road to war · Warsaw, Poland</p>
        <p className="mt-5 text-sm leading-relaxed text-stone-300">
          1919. The Treaty of Versailles ends one war and quietly seeds another: resentment,
          economic collapse, extremism, and a decade of steps nobody stopped. By September
          1939, German forces cross the Polish border — and Europe is at war again.
        </p>
        <p className="mt-3 text-xs text-stone-500">
          You are about to speak with a radio journalist in Warsaw. They are a fictional
          composite, built from documented experiences of the time.
        </p>
        <button
          onClick={onAdvance}
          className="mt-8 rounded-sm border border-amber-200/40 px-6 py-2.5 text-xs tracking-[0.25em] text-amber-100 hover:bg-amber-200/10"
        >
          TALK TO THE RADIO JOURNALIST →
        </button>
      </div>
    </div>
  );
}

/** Placeholder minigame, but wired like a real one: an answer, feedback, a result. */
function Minigame({ chapterId, onComplete }: MinigameProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const correct = 'versailles';
  const options = [
    { id: 'versailles', text: 'Resentment of the Treaty of Versailles' },
    { id: 'radio', text: 'The invention of radio broadcasting' },
    { id: 'weather', text: 'An unusually cold winter in 1938' },
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-md border border-stone-800 bg-stone-950/80 p-8 backdrop-blur-sm">
        <div className="text-center text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
          Placeholder minigame — the full cause-and-effect chain goes here
        </div>
        <h2 className="mt-4 text-center text-xl font-light text-stone-100">
          Which of these fed the road to war?
        </h2>
        <div className="mt-6 space-y-2">
          {options.map((o) => (
            <button
              key={o.id}
              onClick={() => setPicked(o.id)}
              className={`w-full rounded-sm border px-4 py-3 text-left text-sm transition ${
                picked === o.id
                  ? o.id === correct
                    ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-100'
                    : 'border-red-400/60 bg-red-400/10 text-red-200'
                  : 'border-stone-700 text-stone-300 hover:border-stone-500'
              }`}
            >
              {o.text}
            </button>
          ))}
        </div>
        {picked && (
          <p className="mt-4 text-center text-xs text-stone-400">
            {picked === correct
              ? 'Yes — the treaty’s terms bred a resentment extremists would exploit.'
              : 'Not this one — try again.'}
          </p>
        )}
        <div className="mt-6 text-center">
          <button
            onClick={() =>
              onComplete({ chapterId, completed: true, score: picked === correct ? 1 : 0 })
            }
            disabled={picked !== correct}
            className="rounded-sm border border-amber-200/40 px-6 py-2 text-xs tracking-[0.25em] text-amber-100 hover:bg-amber-200/10 disabled:opacity-40"
          >
            COMPLETE CHAPTER →
          </button>
        </div>
      </div>
    </div>
  );
}

const chapter: ChapterModule = { Overview, Minigame };
export default chapter;
