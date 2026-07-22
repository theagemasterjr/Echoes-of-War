'use client';
/**
 * Shared placeholder beats for chapter shells. Founders: when building out a
 * chapter, replace its index.tsx exports with real Overview/Minigame
 * components — see docs/chapter-guide.md. This file is shared scaffolding,
 * not chapter content.
 */
import type { BeatProps, ChapterModule, MinigameProps } from './types';
import { chapterMeta } from './registry';

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-md border border-stone-800 bg-stone-950/80 p-8 text-center backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}

export function makePlaceholderModule(): ChapterModule {
  return {
    Overview: function Overview({ chapterId, onAdvance }: BeatProps) {
      const meta = chapterMeta(chapterId);
      return (
        <Panel>
          <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
            Placeholder overview — real cinematic scene comes later
          </div>
          <h2 className="mt-4 text-2xl font-light text-stone-100">{meta.title}</h2>
          <p className="mt-2 text-sm text-stone-400">
            {meta.subtitle} · {meta.dates} · {meta.location}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-stone-300">
            This is where a 30–60 second scene-setter will play. For now, you are headed
            straight to a conversation with {meta.characterRole.toLowerCase()} — a fictional
            composite character.
          </p>
          <button
            onClick={onAdvance}
            className="mt-8 rounded-sm border border-amber-200/40 px-6 py-2 text-xs tracking-[0.25em] text-amber-100 hover:bg-amber-200/10"
          >
            MEET THEM →
          </button>
        </Panel>
      );
    },
    Minigame: function Minigame({ chapterId, onComplete }: MinigameProps) {
      const meta = chapterMeta(chapterId);
      return (
        <Panel>
          <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
            Placeholder minigame — real activity comes later
          </div>
          <h2 className="mt-4 text-xl font-light text-stone-100">Check your understanding</h2>
          <p className="mt-3 text-sm text-stone-300">
            A short activity about “{meta.title}” will live here.
          </p>
          <button
            onClick={() => onComplete({ chapterId, completed: true })}
            className="mt-8 rounded-sm border border-amber-200/40 px-6 py-2 text-xs tracking-[0.25em] text-amber-100 hover:bg-amber-200/10"
          >
            COMPLETE CHAPTER →
          </button>
        </Panel>
      );
    },
  };
}
