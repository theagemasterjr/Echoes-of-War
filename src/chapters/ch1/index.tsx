'use client';
/**
 * Chapter 1 — The Spark. This is the VERTICAL SLICE chapter: still placeholder
 * content, but slightly fuller so it doubles as the reference example for how
 * a filled-in chapter looks. Founders: see docs/chapter-guide.md.
 */
import type { BeatProps, ChapterModule } from '../types';
import { TimelineMinigame } from './TimelineMinigame';

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

const chapter: ChapterModule = { Overview, Minigame: TimelineMinigame };
export default chapter;
