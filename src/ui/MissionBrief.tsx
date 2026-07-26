'use client';
/**
 * Mission brief — the black screen between a chapter's intro film and its
 * conversation. The narration was recorded once by scripts/build-brief-audio.mjs
 * and ships with the game; this only plays those files, so nothing here ever
 * calls a voice API. The words type themselves onto the screen exactly in step
 * with the narrator (the recording carries a time for every character), then
 * the accept button fades in.
 *
 * Chapter-agnostic: the lines, the button wording and the audio all come from
 * that chapter's entry in src/content/briefs.json. A chapter with no entry
 * never reaches this screen (see appStore.beatsFor).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChapterId } from '@/chapters/types';
import {
  BRIEF_LINE_GAP_MS,
  BRIEF_MANIFEST_URL,
  BRIEF_SILENT_CPS,
  briefFor,
  type BriefAudioChapter,
  type BriefAudioManifest,
} from '@/content/briefs';
import { useSettingsStore } from '@/state/settingsStore';
import { claimNarration, narrationAudio, releaseNarration } from '@/audio/narrationPlayer';

/**
 * Fetched once per session; the file is small and static. Only a SUCCESSFUL
 * answer is kept: one flaky moment must not leave every later chapter's
 * briefing silent for the rest of the visit, which is what caching the
 * failure would do.
 */
let manifestPromise: Promise<BriefAudioManifest | null> | null = null;
function loadManifest(): Promise<BriefAudioManifest | null> {
  if (!manifestPromise) {
    manifestPromise = fetch(BRIEF_MANIFEST_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`brief manifest ${r.status}`);
        return r.json();
      })
      .catch(() => {
        manifestPromise = null; // let the next briefing try again
        return null;
      });
  }
  return manifestPromise;
}

export function MissionBrief({
  chapterId,
  onAccept,
}: {
  chapterId: ChapterId;
  onAccept: () => void;
}) {
  const brief = useMemo(() => briefFor(chapterId), [chapterId]);
  const lines = useMemo(() => brief?.lines ?? [], [brief]);

  /** Which line is speaking, and how much of it has been said. */
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [audio, setAudio] = useState<BriefAudioChapter | null>(null);
  const [ready, setReady] = useState(false);
  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  /**
   * True when the browser refused to start the voice (it is normally claimed
   * ahead of time by the player's first tap — see audio/narrationPlayer). The
   * briefing carries on either way; this only decides whether to offer sound.
   */
  const [blocked, setBlocked] = useState(false);
  /** Seconds into the briefing, whatever is driving it — lets sound switched
   *  on late join in at the right moment instead of starting over. */
  const clock = useRef(0);
  const doneRef = useRef(false);

  /** Point the element at a file without restarting what is already playing. */
  const setSource = (el: HTMLAudioElement, url: string) => {
    const absolute = new URL(url, window.location.origin).href;
    if (el.src !== absolute) el.src = url;
  };

  /**
   * Start playing, and remember if the browser said no.
   * Waits until the file is actually ready: asking an element to play while it
   * is still fetching a newly-set source gets the request cancelled, which
   * looks exactly like a refusal but leaves the screen silent.
   */
  const play = (el: HTMLAudioElement) => {
    const volume = useSettingsStore.getState().volume;
    el.volume = volume;
    const start = () =>
      el.play().then(
        // playing at zero volume is still silence, and this screen is nothing
        // but narration — treat it the same as a refusal and offer the sound
        () => setBlocked(volume === 0),
        () => setBlocked(true),
      );
    if (el.readyState >= 2) start();
    else el.addEventListener('canplay', start, { once: true });
  };

  /** The player asked for sound after all — pick the voice up where the words
   *  have got to, so nothing repeats and nothing is skipped. */
  const enableSound = () => {
    const el = narrationAudio();
    if (!el) return;
    // the game's sound may simply be turned all the way down — this screen has
    // no settings gear on it, so bring it back up to something audible
    const settings = useSettingsStore.getState();
    if (settings.volume === 0) settings.setVolume(0.8);
    try {
      el.currentTime = Math.max(0, clock.current);
    } catch {
      /* seeking before metadata lands is fine — it starts from the top */
    }
    play(el);
  };

  // pull in the recorded narration; a chapter whose audio has not been
  // generated yet still plays, silently, at a steady reading pace
  useEffect(() => {
    let live = true;
    loadManifest().then((m) => {
      if (!live) return;
      const recorded = m?.chapters?.[chapterId] ?? null;
      // the wording must match the recording exactly, or the timings would
      // drift — a founder who edited a line without re-running the build
      // script gets the silent pace instead of words out of step
      const matches =
        recorded &&
        recorded.lines.length === lines.length &&
        recorded.lines.every((l, i) => l.text === lines[i]);
      setAudio(matches ? recorded : null);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [chapterId, lines]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    narrationAudio()?.pause(); // pause, never clear src — clearing raises a media error
    setIndex(lines.length - 1);
    setRevealed(lines[lines.length - 1]?.length ?? 0);
    setFinished(true);
  };

  // ONE HAND-RECORDED TAKE: the whole brief is a single recording and each
  // line has a start/end time inside it. The pauses between lines are part of
  // the recording, so the screen just holds the last line while it breathes.
  useEffect(() => {
    const track = audio?.track;
    if (!ready || finished || !track || lines.length === 0) return;
    const segments = audio.lines;
    const el = narrationAudio();
    let raf = 0;
    let cancelled = false;

    if (el) {
      setSource(el, track);
      if (el.paused) play(el);
    }

    const startedAt = performance.now();
    const lastEnd = segments[segments.length - 1]?.end ?? 0;
    // the display only ever moves forward, so a stutter never un-types a line
    let atLine = 0;
    let atChars = 0;

    const tick = () => {
      if (cancelled) return;
      // follow the voice when it is playing; otherwise keep the briefing
      // moving on the wall clock at the pace the recording was timed to
      const t = el && el.currentTime > 0 ? el.currentTime : (performance.now() - startedAt) / 1000;
      clock.current = t;

      let i = 0;
      for (let k = 0; k < segments.length; k++) if (t >= (segments[k].start ?? 0)) i = k;
      const seg = segments[i];
      const span = Math.max(0.001, (seg.end ?? 0) - (seg.start ?? 0));
      const through = reducedMotion ? 1 : Math.min(1, Math.max(0, (t - (seg.start ?? 0)) / span));

      if (i > atLine) {
        atLine = i;
        atChars = 0;
      }
      atChars = Math.max(atChars, Math.round(lines[atLine].length * through));
      setIndex(atLine);
      setRevealed(atChars);

      if (t >= lastEnd) {
        setRevealed(lines[lines.length - 1].length);
        setFinished(true);
        doneRef.current = true;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, audio, finished]);

  // ONE CLIP PER LINE (generated through the API): play this line's clip and
  // reveal its characters in step with the voice, then hold a beat and move on.
  useEffect(() => {
    if (!ready || finished || lines.length === 0 || audio?.track) return;
    const text = lines[index] ?? '';
    const clip = audio?.lines?.[index];
    let raf = 0;
    let gapTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const nextLine = () => {
      if (cancelled) return;
      if (index >= lines.length - 1) {
        setFinished(true);
        doneRef.current = true;
      } else {
        setIndex((i) => i + 1);
        setRevealed(0);
      }
    };

    const holdThenAdvance = () => {
      if (cancelled) return;
      setRevealed(text.length);
      gapTimer = setTimeout(nextLine, BRIEF_LINE_GAP_MS);
    };

    /** Characters spoken so far at time t (seconds into this line). Only ever
     *  moves forward, so a slow-loading clip never un-types what it typed. */
    let shown = 0;
    const charsAt = (t: number) => {
      const starts = clip?.charStarts;
      let n: number;
      if (!starts || starts.length === 0) {
        n = Math.floor(t * BRIEF_SILENT_CPS);
      } else {
        n = 0;
        while (n < starts.length && starts[n] <= t) n++;
      }
      shown = Math.max(shown, n);
      return shown;
    };

    const el = narrationAudio();
    if (clip?.file && el) {
      setSource(el, clip.file);
      const started = performance.now();
      const tick = () => {
        if (cancelled) return;
        // follow the audio clock where we have it, the wall clock if playback
        // never started (a blocked autoplay must not freeze the briefing)
        const t = el.currentTime > 0 ? el.currentTime : (performance.now() - started) / 1000;
        clock.current = t;
        setRevealed(Math.min(text.length, reducedMotion ? text.length : charsAt(t)));
        if (t >= (clip.duration || 0)) {
          holdThenAdvance();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      if (el.paused) play(el);
      raf = requestAnimationFrame(tick);
    } else {
      // no recording for this line — steady reading pace
      const started = performance.now();
      const total = (text.length / BRIEF_SILENT_CPS) * 1000;
      const tick = () => {
        if (cancelled) return;
        const elapsed = performance.now() - started;
        setRevealed(
          Math.min(text.length, reducedMotion ? text.length : Math.floor((elapsed / 1000) * BRIEF_SILENT_CPS)),
        );
        if (elapsed >= total) {
          holdThenAdvance();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (gapTimer) clearTimeout(gapTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, index, audio, finished]);

  // hold the narrator's voice while this screen is up, and hand it back when
  // the player leaves (see claimNarration for why the hand-back is deferred)
  useEffect(() => {
    const token = claimNarration();
    return () => releaseNarration(token);
  }, []);

  // Escape skips to the end, the same as the skip button
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !finished) finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (!brief) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black px-6">
      <div
        className="flex w-full max-w-2xl flex-col items-center gap-5 text-center"
        role="region"
        aria-label="Mission brief"
        aria-live="polite"
      >
        {lines.map((line, i) => {
          if (i > index) return null;
          const current = i === index && !finished;
          const text = current ? line.slice(0, revealed) : line;
          return (
            <motion.p
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: finished || !current ? (i === lines.length - 1 ? 1 : 0.32) : 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.6 }}
              className="text-balance text-xl font-light leading-relaxed tracking-wide text-stone-100 md:text-2xl"
            >
              {text}
              {current && revealed < line.length && (
                <span className="ml-0.5 inline-block h-[1em] w-px translate-y-[0.12em] animate-pulse bg-amber-200/80 align-middle" />
              )}
            </motion.p>
          );
        })}
      </div>

      {finished && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reducedMotion ? 0 : 1.1, delay: reducedMotion ? 0 : 0.5 }}
          autoFocus
          onClick={onAccept}
          className="mt-14 rounded-sm border border-amber-200/50 px-10 py-3 text-sm tracking-[0.3em] text-amber-100 transition hover:bg-amber-200/10"
        >
          {brief.accept}
        </motion.button>
      )}

      {/* the browser would not let the voice start (rare — the player's first
          tap normally earns that permission). The briefing runs on regardless;
          this quietly offers the sound, and it joins at the current line. */}
      {blocked && !finished && (
        <button
          onClick={enableSound}
          className="absolute bottom-6 left-6 rounded-sm border border-amber-200/40 bg-black/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-amber-100/90 transition hover:bg-amber-200/10"
        >
          ♪ Sound on
        </button>
      )}

      {!finished && (
        <button
          onClick={finish}
          className="absolute bottom-6 right-6 rounded-sm border border-stone-700/70 px-5 py-2 text-[10px] uppercase tracking-[0.25em] text-stone-500 transition hover:border-amber-200/40 hover:text-amber-100/80"
        >
          Skip →
        </button>
      )}
    </div>
  );
}
