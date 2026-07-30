'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/state/appStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useProgressStore } from '@/state/progressStore';
import { loadChapter, CHAPTERS } from '@/chapters/registry';
import type { Beat, ChapterId, ChapterModule } from '@/chapters/types';
import { ConversationUI } from '@/conversation/ConversationUI';
import { ChapterIntroVideo } from '@/ui/ChapterIntroVideo';
import { BufferedVideo } from '@/media/BufferedVideo';
import { PROLOGUE_VIDEO } from '@/media/VideoPreloader';
import { MissionBrief } from '@/ui/MissionBrief';
import { EndOfGame } from '@/ui/EndOfGame';
import { ErrorBoundary } from '@/core/ErrorBoundary';

export function UiLayer() {
  const view = useAppStore((s) => s.view);
  useReadingPreferences();
  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      <AnimatePresence>{view.kind === 'title' && <TitleIntro key="title" />}</AnimatePresence>
      {view.kind === 'prologue' && <PrologueVideo />}
      {view.kind === 'chapter' && (
        <ChapterBeats key={view.chapterId} chapterId={view.chapterId} beat={view.beat} />
      )}
      {view.kind === 'map' && <YearTicker />}
      {view.kind === 'ending' && <EndOfGame />}
      <Hud />
      <SmallScreenNotice />
    </div>
  );
}

/**
 * Shown once, over everything, when the game opens on a phone (or a very small
 * tablet): a plain recommendation to play on a computer, with a CONTINUE that
 * carries straight on here. Dismissal is remembered for the visit, so an
 * in-page error recovery never shows it twice. Detection runs after mount —
 * the server render must stay deterministic — and keys on a touch-first
 * pointer plus a genuinely small screen, so a touch-screen laptop never sees it.
 */
function SmallScreenNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem('eow-small-screen-ok')) return;
    } catch {}
    const touchFirst = window.matchMedia('(pointer: coarse)').matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 768;
    if (touchFirst && small) setShow(true);
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      sessionStorage.setItem('eow-small-screen-ok', '1');
    } catch {}
    setShow(false);
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="small-screen-title"
      className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center bg-black px-8 text-center"
    >
      <div className="text-xs uppercase tracking-[0.5em] text-amber-200/60">Echoes of War</div>
      <h2 id="small-screen-title" className="mt-5 max-w-[22ch] text-2xl font-light leading-snug text-stone-100">
        This game works best on a computer.
      </h2>
      <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-stone-400">
        You can still play here. Things will just look smaller.
      </p>
      <button
        autoFocus
        onClick={dismiss}
        className="mt-9 rounded-sm border border-amber-200/40 px-8 py-3 text-sm tracking-[0.25em] text-amber-100/90 transition hover:bg-amber-200/10"
      >
        CONTINUE →
      </button>
    </div>
  );
}

/** Mirrors the reading settings onto <html> as data attributes, which is
 *  all the global rules in globals.css need: `data-reading-font="lexend"`
 *  swaps the whole game over to the easy-read face (and opens its spacing a
 *  touch, so the flip is visible), `data-text-size="large"` raises the root
 *  font-size so every rem-based size grows with it, and
 *  `data-text-spacing="wide"` opens every line up further. Kept here because
 *  UiLayer is mounted for the entire session. */
function useReadingPreferences() {
  const readingFont = useSettingsStore((s) => s.readingFont);
  const textSize = useSettingsStore((s) => s.textSize);
  const textSpacing = useSettingsStore((s) => s.textSpacing);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.readingFont = readingFont;
    root.dataset.textSize = textSize;
    root.dataset.textSpacing = textSpacing;
  }, [readingFont, textSize, textSpacing]);
}

/** Fullscreen prologue film. Plays /video/prologue.mp4 once, then hands off to
 *  the camera glide down to the map (via completePrologue). The film is already
 *  buffered by the VideoPreloader, so it opens on its first frame. It fills the
 *  screen edge-to-edge (letterboxed on black where the aspect doesn't match). */
function PrologueVideo() {
  const completePrologue = useAppStore((s) => s.completePrologue);
  const phase = useAppStore((s) => s.phase);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    // the element stays mounted (visually fading) through the glide down to
    // the map — silence its soundtrack so it can't play over the theme
    if (videoRef.current) videoRef.current.muted = true;
    completePrologue();
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
        <BufferedVideo
          src={PROLOGUE_VIDEO}
          elementRef={videoRef}
          className="absolute inset-0 h-full w-full object-contain"
          onEnded={finish}
          onError={() => setFailed(true)}
        />
      )}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.4em] text-amber-200/60">
        Prologue · 1939
      </div>
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
      className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-start overflow-y-auto pb-8 pt-[9vh] text-center"
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
            className="mx-auto max-h-[32vh] w-[min(560px,80vw)] object-contain"
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
  if (beat === 'minigame' && !mod) return null; // loading hides under the transition black

  return (
    <ErrorBoundary
      label="This chapter ran into a problem — your progress on the map is safe."
      onReset={() => returnToMap(true)}
    >
      {/* the minigame beat lets taps through to the 3D table — its DOM parts
          opt back in with pointer-events-auto where needed */}
      <div className={`absolute inset-0 ${beat === 'minigame' ? 'pointer-events-none' : 'pointer-events-auto'}`}>
        {beat === 'intro' && <ChapterIntroVideo chapterId={chapterId} onAdvance={advanceBeat} />}
        {beat === 'brief' && <MissionBrief chapterId={chapterId} onAccept={advanceBeat} />}
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

  // The mission brief owns the whole screen: black, the words, and the one
  // button that answers its question. No back button, no settings gear —
  // nothing on that screen is clickable except its own skip and I ACCEPT.
  if (view.kind === 'chapter' && view.beat === 'brief') return null;

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
  const readingFont = useSettingsStore((s) => s.readingFont);
  const setReadingFont = useSettingsStore((s) => s.setReadingFont);
  const textSize = useSettingsStore((s) => s.textSize);
  const setTextSize = useSettingsStore((s) => s.setTextSize);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useSettingsStore((s) => s.setVoiceEnabled);
  const subtitlesEnabled = useSettingsStore((s) => s.subtitlesEnabled);
  const setSubtitlesEnabled = useSettingsStore((s) => s.setSubtitlesEnabled);
  const textSpacing = useSettingsStore((s) => s.textSpacing);
  const setTextSpacing = useSettingsStore((s) => s.setTextSpacing);
  const easyRead = readingFont === 'lexend';
  const wideSpacing = textSpacing === 'wide';

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
            className="mt-2 w-64 rounded-md border border-stone-700 bg-stone-950/95 p-4 text-stone-300 shadow-xl backdrop-blur-sm"
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
            <div className="my-3 h-px bg-stone-800" />
            {/* ---- voice: character speech + narration on/off (default on),
                and the caption text that goes with it. Off skips every voice
                fetch and playback, so testing never spends TTS tokens. ---- */}
            <button
              type="button"
              role="switch"
              aria-checked={voiceEnabled}
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2.5 text-left text-xs transition ${
                voiceEnabled
                  ? 'border-amber-200/70 bg-amber-200/15 text-amber-100'
                  : 'border-stone-600 text-stone-200 hover:bg-stone-800'
              }`}
            >
              <span>Character voice</span>
              <span
                aria-hidden
                className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                  voiceEnabled ? 'bg-amber-200/90 text-stone-950' : 'bg-stone-700 text-stone-200'
                }`}
              >
                {voiceEnabled ? 'On' : 'Off'}
              </span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={subtitlesEnabled}
              onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
              className={`mt-1.5 flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2.5 text-left text-xs transition ${
                subtitlesEnabled
                  ? 'border-amber-200/70 bg-amber-200/15 text-amber-100'
                  : 'border-stone-600 text-stone-200 hover:bg-stone-800'
              }`}
            >
              <span>Subtitles</span>
              <span
                aria-hidden
                className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                  subtitlesEnabled ? 'bg-amber-200/90 text-stone-950' : 'bg-stone-700 text-stone-200'
                }`}
              >
                {subtitlesEnabled ? 'On' : 'Off'}
              </span>
            </button>
            <div className="my-3 h-px bg-stone-800" />
            {/* ---- reading: font + size. Both write to the settings store,
                which useReadingPreferences mirrors onto <html>. ---- */}
            <span className="text-[10px] uppercase tracking-widest text-stone-400">Reading</span>
            <button
              type="button"
              role="switch"
              aria-checked={easyRead}
              onClick={() => setReadingFont(easyRead ? 'default' : 'lexend')}
              className={`mt-1.5 flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2.5 text-left text-xs transition ${
                easyRead
                  ? 'border-amber-200/70 bg-amber-200/15 text-amber-100'
                  : 'border-stone-600 text-stone-200 hover:bg-stone-800'
              }`}
            >
              <span>Dyslexia-friendly font</span>
              <span
                aria-hidden
                className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                  easyRead ? 'bg-amber-200/90 text-stone-950' : 'bg-stone-700 text-stone-200'
                }`}
              >
                {easyRead ? 'On' : 'Off'}
              </span>
            </button>
            {/* Wide spacing: taller lines, wider letter and word gaps, on every
                word in the game — many dyslexic readers find this helps more
                than any font. Independent of the font toggle; they stack. */}
            <button
              type="button"
              role="switch"
              aria-checked={wideSpacing}
              onClick={() => setTextSpacing(wideSpacing ? 'normal' : 'wide')}
              className={`mt-1.5 flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2.5 text-left text-xs transition ${
                wideSpacing
                  ? 'border-amber-200/70 bg-amber-200/15 text-amber-100'
                  : 'border-stone-600 text-stone-200 hover:bg-stone-800'
              }`}
            >
              <span>Wide spacing</span>
              <span
                aria-hidden
                className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                  wideSpacing ? 'bg-amber-200/90 text-stone-950' : 'bg-stone-700 text-stone-200'
                }`}
              >
                {wideSpacing ? 'On' : 'Off'}
              </span>
            </button>
            <div className="mt-3">
              <span className="text-[10px] uppercase tracking-widest text-stone-400">Text size</span>
              <div className="mt-1.5 flex gap-2">
                {([['normal', 'Normal'], ['large', 'Large']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={textSize === id}
                    onClick={() => setTextSize(id)}
                    className={`flex-1 rounded-sm border px-2 py-2.5 text-xs transition ${
                      textSize === id
                        ? 'border-amber-200/70 bg-amber-200/15 text-amber-100'
                        : 'border-stone-600 text-stone-200 hover:bg-stone-800'
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
