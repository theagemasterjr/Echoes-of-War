'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/state/appStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useProgressStore } from '@/state/progressStore';
import { chapterMeta, loadChapter, CHAPTERS } from '@/chapters/registry';
import type { Beat, ChapterId, ChapterModule } from '@/chapters/types';
import { ConversationUI } from '@/conversation/ConversationUI';
import { ErrorBoundary } from '@/core/ErrorBoundary';

export function UiLayer() {
  const view = useAppStore((s) => s.view);
  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      <AnimatePresence>{view.kind === 'title' && <TitleIntro key="title" />}</AnimatePresence>
      {view.kind === 'prologue' && <PrologueVideo />}
      {view.kind === 'chapter' && (
        <ChapterBeats key={view.chapterId} chapterId={view.chapterId} beat={view.beat} />
      )}
      {view.kind === 'map' && <YearTicker />}
      <Hud />
    </div>
  );
}

/** Fullscreen prologue film. Plays /video/prologue.mp4 once, then hands off to
 *  the camera glide down to the map (via completePrologue). The video fills the
 *  screen edge-to-edge (letterboxed on black where the aspect doesn't match). */
function PrologueVideo() {
  const completePrologue = useAppStore((s) => s.completePrologue);
  const phase = useAppStore((s) => s.phase);
  const videoRef = useRef<HTMLVideoElement>(null);
  // browsers block autoplay-with-sound after a state change (the BEGIN click is
  // no longer the active gesture by the time this mounts) — try sound first,
  // fall back to muted playback and offer a one-tap unmute.
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    completePrologue();
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => setFailed(true));
    });
  }, []);

  const unmute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    v.play().catch(() => {});
  };

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      // fades away first, then the camera glide down to the map plays in the
      // open (same choreography as the title screen's BEGIN)
      animate={{ opacity: phase === 'out' ? 0 : 1 }}
      transition={{ duration: phase === 'out' ? 0.9 : 0.8 }}
    >
      {failed ? (
        <p className="max-w-[34ch] text-center text-sm leading-relaxed text-stone-500">
          The opening film couldn’t play. You can continue to the map.
        </p>
      ) : (
        <video
          ref={videoRef}
          src="/video/prologue.mp4"
          className="absolute inset-0 h-full w-full object-contain"
          playsInline
          autoPlay
          preload="auto"
          onEnded={finish}
          onError={() => setFailed(true)}
        />
      )}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.4em] text-amber-200/60">
        Prologue · 1939
      </div>
      {/* one-tap unmute when the browser forced a muted start */}
      {muted && !failed && (
        <button
          onClick={unmute}
          className="absolute bottom-6 left-6 rounded-sm border border-amber-200/40 bg-black/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-amber-100/90 backdrop-blur-sm transition hover:bg-amber-200/10"
        >
          ♪ Sound on
        </button>
      )}
      <button
        onClick={finish}
        disabled={phase !== 'idle'}
        className="absolute right-6 bottom-6 rounded-sm border border-amber-200/40 bg-black/50 px-8 py-2.5 text-sm tracking-[0.25em] text-amber-100/90 backdrop-blur-sm transition hover:bg-amber-200/10 disabled:opacity-40"
      >
        {failed ? 'CONTINUE' : 'SKIP →'}
      </button>
    </motion.div>
  );
}

/** The story's start year per active chapter — the ticker shows where you are. */
const CHAPTER_YEAR: Record<ChapterId, number> = {
  ch1: 1939, ch2: 1940, ch3: 1941, ch4: 1942, ch5: 1944, ch6: 1945,
};
const TICKER_YEARS = [1935, 1936, 1937, 1938, 1939, 1940, 1941, 1942, 1943, 1944, 1945, 1946, 1947];
const YEAR_W = 76; // px per year segment on the ruler

/** Gold year ruler at the top of the map: the current year sits centered under
 *  a ticked line that fades out toward its neighbours, and slides when the
 *  story moves forward. */
function YearTicker() {
  const prologueDone = useProgressStore((s) => s.prologueDone);
  const completed = useProgressStore((s) => s.completed);
  const active = CHAPTERS.find((c) => !completed.includes(c.id));
  const year = !prologueDone ? 1938 : active ? CHAPTER_YEAR[active.id] : 1945;
  const offset = -TICKER_YEARS.indexOf(year) * YEAR_W - YEAR_W / 2;

  return (
    <div className="absolute left-1/2 top-4 -translate-x-1/2 text-center">
      <div
        className="w-[300px] overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 35%, black 65%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 35%, black 65%, transparent)',
        }}
      >
        <div
          className="flex transition-transform duration-1000 ease-in-out"
          style={{ transform: `translateX(calc(50% + ${offset}px))` }}
        >
          {TICKER_YEARS.map((y) => (
            <div key={y} className="shrink-0" style={{ width: YEAR_W }}>
              <div className="flex h-3 items-end justify-between px-px">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-px bg-amber-200/70"
                    style={{ height: i === 2 ? 12 : 6 }}
                  />
                ))}
              </div>
              <div
                className={`mt-1 text-[10px] tracking-[0.2em] transition-colors duration-1000 ${
                  y === year ? 'text-transparent' : 'text-amber-200/40'
                }`}
              >
                {y}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        className="-mt-4 text-lg font-light tracking-[0.35em] text-amber-200"
        style={{ textShadow: '0 0 12px rgba(255,196,90,0.45)' }}
      >
        {year}
      </div>
    </div>
  );
}

function TitleIntro() {
  const begin = useAppStore((s) => s.begin);
  const phase = useAppStore((s) => s.phase);
  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-start pt-[9vh] text-center"
      // fade the title away first — the camera glide waits for this (its 1.0s
      // delay in SceneRouter), so nothing moves while the text is still up
      animate={{ opacity: phase === 'out' ? 0 : 1 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
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
        <p className="mx-auto mt-8 max-w-[46ch] text-sm leading-relaxed text-stone-300/80">
          An interactive journey through the Second World War.
        </p>
        <button
          onClick={begin}
          disabled={phase !== 'idle'}
          className="mt-8 rounded-sm border border-amber-200/40 px-8 py-2.5 text-sm tracking-[0.25em] text-amber-100/90 transition hover:bg-amber-200/10 disabled:opacity-40"
        >
          BEGIN
        </button>
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
  const returnToTitle = useAppStore((s) => s.returnToTitle);
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
      {view.kind === 'map' && idle && (
        <button
          onClick={returnToTitle}
          className="pointer-events-auto absolute left-4 top-4 rounded-sm border border-stone-700 bg-stone-950/60 px-3 py-1.5 text-xs tracking-widest text-stone-300 backdrop-blur-sm transition hover:bg-stone-800"
        >
          ← TITLE
        </button>
      )}
      <SettingsMenu />
    </>
  );
}

function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const volume = useSettingsStore((s) => s.volume);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const soundtrack = useSettingsStore((s) => s.soundtrack);
  const setSoundtrack = useSettingsStore((s) => s.setSoundtrack);

  const resetProgress = () => {
    useProgressStore.getState().reset();
    setConfirming(false);
    setOpen(false);
    const { view, returnToTitle } = useAppStore.getState();
    if (view.kind !== 'title') returnToTitle();
  };

  return (
    <div className="pointer-events-auto absolute right-4 top-4 flex flex-col items-end">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setConfirming(false);
        }}
        aria-label="Settings"
        className={`rounded-sm border border-stone-700 bg-stone-950/60 px-2.5 py-1.5 text-sm backdrop-blur-sm transition hover:bg-stone-800 ${
          open ? 'text-amber-200/90' : 'text-stone-300'
        }`}
      >
        ⚙
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-2 w-56 rounded-md border border-stone-700 bg-stone-950/90 p-4 text-stone-300 shadow-xl backdrop-blur-sm"
          >
            <label className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-widest text-stone-400">Volume</span>
              <input
                type="range" min={0} max={1} step={0.05} value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="h-1 w-28 accent-amber-200/70"
                aria-label="Volume"
              />
            </label>
            <div className="mt-3">
              <span className="text-[10px] uppercase tracking-widest text-stone-400">Soundtrack</span>
              <div className="mt-1.5 flex gap-2">
                {([['main-theme', 'Theme I'], ['main-theme-2', 'Theme II']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setSoundtrack(id)}
                    className={`flex-1 rounded-sm border px-2 py-1.5 text-[10px] uppercase tracking-widest transition ${
                      soundtrack === id
                        ? 'border-amber-200/50 bg-amber-200/5 text-amber-200/90'
                        : 'border-stone-700 hover:bg-stone-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="my-3 h-px bg-stone-800" />
            {confirming ? (
              <div>
                <p className="text-xs text-stone-400">Erase all progress and start over?</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={resetProgress}
                    className="flex-1 rounded-sm border border-red-900/70 px-2 py-1.5 text-[10px] uppercase tracking-widest text-red-300 transition hover:bg-red-950/50"
                  >
                    Yes, reset
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="flex-1 rounded-sm border border-stone-700 px-2 py-1.5 text-[10px] uppercase tracking-widest transition hover:bg-stone-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="w-full rounded-sm border border-stone-700 px-2 py-1.5 text-[10px] uppercase tracking-widest transition hover:bg-stone-800"
              >
                Reset progress
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
