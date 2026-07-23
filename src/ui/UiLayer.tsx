'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/state/appStore';
import { useSettingsStore } from '@/state/settingsStore';
import { chapterMeta, CHAPTERS, loadChapter } from '@/chapters/registry';
import type { Beat, ChapterId, ChapterModule } from '@/chapters/types';
import { ConversationUI } from '@/conversation/ConversationUI';
import { ErrorBoundary } from '@/core/ErrorBoundary';

export function UiLayer() {
  const view = useAppStore((s) => s.view);
  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      <AnimatePresence>{view.kind === 'title' && <TitleIntro key="title" />}</AnimatePresence>
      {view.kind === 'chapter' && (
        <ChapterBeats key={view.chapterId} chapterId={view.chapterId} beat={view.beat} />
      )}
      <Hud />
    </div>
  );
}

function TitleIntro() {
  const begin = useAppStore((s) => s.begin);
  const phase = useAppStore((s) => s.phase);
  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center text-center"
      exit={{ opacity: 0, transition: { duration: 1.2 } }}
    >
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1 }}>
        <div className="text-xs uppercase tracking-[0.5em] text-amber-200/60">1939 – 1945</div>
        <h1 className="mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ui/title-logo.png"
            alt="Echoes of War"
            className="mx-auto w-[min(560px,80vw)]"
            style={{
              filter:
                'drop-shadow(0 0 14px rgba(255,196,90,0.4)) drop-shadow(0 0 46px rgba(255,160,40,0.2))',
            }}
            draggable={false}
          />
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-stone-400">
          Six chapters of the Second World War, told through live conversations with
          the people who could have lived them.
        </p>
        <button
          onClick={begin}
          disabled={phase !== 'idle'}
          className="mt-10 rounded-sm border border-amber-200/40 px-8 py-2.5 text-sm tracking-[0.25em] text-amber-100/90 transition hover:bg-amber-200/10 disabled:opacity-40"
        >
          BEGIN
        </button>
        <p className="mt-8 text-[11px] text-stone-600">
          Characters are fictional composites. Their responses are AI-generated and may contain errors.
        </p>
      </motion.div>
    </motion.div>
  );
}

const moduleCache = new Map<ChapterId, ChapterModule>();

function ChapterBeats({ chapterId, beat }: { chapterId: ChapterId; beat: Beat }) {
  const [mod, setMod] = useState<ChapterModule | null>(moduleCache.get(chapterId) ?? null);
  const [loadFailed, setLoadFailed] = useState(false);
  const advanceBeat = useAppStore((s) => s.advanceBeat);
  const completeChapter = useAppStore((s) => s.completeChapter);
  const returnToMap = useAppStore((s) => s.returnToMap);

  useEffect(() => {
    let live = true;
    if (!moduleCache.has(chapterId)) {
      loadChapter(chapterId)
        .then((m) => {
          moduleCache.set(chapterId, m.default);
          if (live) setMod(m.default);
        })
        .catch(() => {
          if (live) setLoadFailed(true);
        });
    }
    return () => {
      live = false;
    };
  }, [chapterId]);

  if (loadFailed) {
    return (
      <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center text-center text-stone-300">
        <p className="text-sm">This chapter couldn’t be loaded.</p>
        <button
          onClick={() => returnToMap(true)}
          className="mt-4 rounded-sm border border-stone-600 px-4 py-2 text-xs tracking-widest hover:bg-stone-800"
        >
          RETURN TO MAP
        </button>
      </div>
    );
  }
  if (beat !== 'conversation' && !mod) return null; // loading hides under the transition black

  return (
    <ErrorBoundary
      label="This chapter ran into a problem — your progress on the map is safe."
      onReset={() => returnToMap(true)}
    >
      <div className="pointer-events-auto absolute inset-0">
        {beat === 'overview' && mod && <mod.Overview chapterId={chapterId} onAdvance={advanceBeat} />}
        {beat === 'conversation' && (
          <ConversationUI chapterId={chapterId} onContinue={advanceBeat} />
        )}
        {beat === 'minigame' && mod && (
          <mod.Minigame chapterId={chapterId} onComplete={() => completeChapter()} />
        )}
      </div>
    </ErrorBoundary>
  );
}

function Hud() {
  const view = useAppStore((s) => s.view);
  const phase = useAppStore((s) => s.phase);
  const returnToMap = useAppStore((s) => s.returnToMap);
  const gotoChapter = useAppStore((s) => s.gotoChapter);
  const volume = useSettingsStore((s) => s.volume);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const idle = phase === 'idle';

  return (
    <>
      {view.kind === 'chapter' && idle && (
        <button
          onClick={() => returnToMap()}
          className="pointer-events-auto absolute left-4 top-4 rounded-sm border border-stone-700 bg-stone-950/60 px-3 py-1.5 text-xs tracking-widest text-stone-300 backdrop-blur-sm transition hover:bg-stone-800"
        >
          ← MAP
        </button>
      )}
      <label className="pointer-events-auto absolute right-4 top-4 flex items-center gap-2 rounded-sm bg-stone-950/50 px-3 py-1.5 text-stone-400 backdrop-blur-sm">
        <span className="text-[10px] uppercase tracking-widest">Vol</span>
        <input
          type="range" min={0} max={1} step={0.05} value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="h-1 w-20 accent-amber-200/70"
          aria-label="Volume"
        />
      </label>
      {view.kind === 'map' && idle && (
        <nav
          aria-label="Chapters"
          className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2"
        >
          {CHAPTERS.map((c) => (
            <button
              key={c.id}
              onClick={() => gotoChapter(c.id)}
              title={`Chapter ${c.index}: ${c.title}`}
              aria-label={`Open chapter ${c.index}: ${c.title}`}
              className="h-8 w-8 rounded-full border border-stone-700 bg-stone-950/60 text-xs text-stone-300 backdrop-blur-sm transition hover:border-amber-200/50 hover:text-amber-100"
            >
              {c.index}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
