'use client';
/**
 * Mission brief — the black screen between a chapter's intro film and its
 * conversation. The narration is a recording that ships with the game; this
 * only plays those files, so nothing here ever calls a voice API. The words
 * type themselves onto the screen exactly in step with the narrator, then the
 * accept button fades in.
 *
 * The voice starts by itself: this screen is only ever reached by a click
 * (the chapter pin, the film's continue button), which is the permission a
 * browser asks for. There is no "sound on" button anywhere — if a browser
 * somehow still refuses, or the audio stalls mid-take, the briefing carries on
 * against the wall clock so the words never freeze.
 *
 * Chapter-agnostic: the lines, the button wording and the audio all come from
 * that chapter's entry in src/content/briefs.json. A chapter with no entry
 * never reaches this screen (see appStore.beatsFor).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

/** How long the voice may sit still before the words stop waiting for it. */
const AUDIO_STALL_MS = 350;

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

  const doneRef = useRef(false);

  /** Point the element at a file without restarting what is already playing.
   *  Answers whether the file actually changed. */
  const setSource = (el: HTMLAudioElement, url: string) => {
    const absolute = new URL(url, window.location.origin).href;
    if (el.src === absolute) return false;
    el.src = url;
    return true;
  };

  /**
   * Start the voice. Waits until the file is actually ready: asking an element
   * to play while it is still fetching a newly-set source gets the request
   * cancelled, which leaves the screen silent. Returns a disposer for the
   * pending wait, so leaving the screen never starts a voice behind it.
   */
  const play = (el: HTMLAudioElement) => {
    el.volume = useSettingsStore.getState().volume;
    const start = () => {
      el.play().catch(() => {
        /* the words keep going on the wall clock — see the rAF loops below */
      });
    };
    if (el.readyState >= 2) {
      start();
      return () => {};
    }
    el.addEventListener('canplay', start, { once: true });
    return () => el.removeEventListener('canplay', start);
  };

  // pull in the recorded narration; a chapter whose audio has not been
  // generated yet still plays, silently, at a steady reading pace
  useEffect(() => {
    let live = true;
    loadManifest().then((m) => {
      if (!live) return;
      const recorded = m?.chapters?.[chapterId] ?? null;
      // the wording must match the recording exactly, or the timings would
      // drift — a founder who edited a line without re-timing the take gets
      // the silent pace instead of words out of step
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
    let stopWaiting: (() => void) | null = null;

    let swapped = false;
    if (el) {
      swapped = setSource(el, track);
      // a new file, or a replay of one parked at its end — start from the top.
      // (A take already speaking is left alone: React remounts this screen
      //  while developing, and rewinding then would stutter the narration.)
      if (swapped || el.paused) {
        try {
          el.currentTime = 0;
        } catch {
          /* a freshly-set source is not seekable yet — it starts at 0 anyway */
        }
      }
      // always with sound, always by itself — the player clicked to get here
      if (el.paused) stopWaiting = play(el);
    }

    const lastEnd = segments[segments.length - 1]?.end ?? 0;
    // the display only ever moves forward, so a stutter never un-types a line
    let atLine = 0;
    let atChars = 0;

    /**
     * The briefing's own clock. It follows the voice while the voice is
     * moving; the moment the voice stalls (buffering, a refused autoplay, a
     * tab that was backgrounded) it carries on from that exact point against
     * the wall clock, so the words never freeze half-typed.
     */
    let base = !el || swapped ? 0 : el.currentTime || 0;
    let baseWall = performance.now();
    let lastAudioT = base;
    let lastAudioMove = baseWall;

    const complete = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      setIndex(lines.length - 1);
      setRevealed(lines[lines.length - 1].length);
      setFinished(true);
      doneRef.current = true;
    };

    // the file may run out a hair before the manifest's last end time — that
    // is still the end of the briefing
    const handleEnded = () => complete();
    el?.addEventListener('ended', handleEnded);

    const tick = () => {
      if (cancelled) return;
      const now = performance.now();

      if (el) {
        const audioT = el.currentTime;
        // a jump far past where the briefing can possibly be is a stale
        // reading from the element the moment its source was swapped — ignore
        // it rather than let it fling the screen to the accept button
        const plausible = audioT <= base + (now - baseWall) / 1000 + 2;
        if (audioT > lastAudioT + 0.005 && plausible) {
          lastAudioT = audioT;
          lastAudioMove = now;
          base = audioT;
          baseWall = now;
        }
      }
      const stalled = !el || now - lastAudioMove > AUDIO_STALL_MS;
      const t = stalled ? base + (now - baseWall) / 1000 : base;

      let i = 0;
      for (let k = 0; k < segments.length; k++) if (t >= (segments[k].start ?? 0)) i = k;
      const seg = segments[i];
      const span = Math.max(0.001, (seg.end ?? 0) - (seg.start ?? 0));
      const through = reducedMotion ? 1 : Math.min(1, Math.max(0, (t - (seg.start ?? 0)) / span));

      if (i > atLine) {
        // finish the line we are leaving before moving on, so nothing is
        // dropped when the voice runs ahead of a frame
        atLine = i;
        atChars = 0;
      }
      atChars = Math.max(atChars, Math.round(lines[atLine].length * through));
      setIndex(atLine);
      setRevealed(atChars);

      if (t >= lastEnd) {
        complete();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopWaiting?.();
      el?.removeEventListener('ended', handleEnded);
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
    let stopWaiting: (() => void) | null = null;

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
        setRevealed(Math.min(text.length, reducedMotion ? text.length : charsAt(t)));
        if (t >= (clip.duration || 0)) {
          holdThenAdvance();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      if (el.paused) stopWaiting = play(el);
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
      stopWaiting?.();
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

  /**
   * Credits-style scroll: the stack of lines slides up so the line being
   * spoken sits at the vertical middle of the screen. Because the accept
   * button lives inside the stack right after the last line, the briefing
   * ends with "Do you accept the mission?" dead centre and the button just
   * beneath it — never off the bottom of a small window.
   */
  const stackRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const [scrollY, setScrollY] = useState(0);
  useLayoutEffect(() => {
    const stack = stackRef.current;
    const line = lineRefs.current[index];
    if (!stack || !line) return;
    // the stack is flex-centred, so its middle sits at the screen's middle;
    // shift it by how far this line's centre is from the stack's own centre
    const y = stack.offsetHeight / 2 - (line.offsetTop + line.offsetHeight / 2);
    setScrollY((v) => (Math.abs(v - y) > 0.5 ? y : v));
  }, [index, finished]);

  // the button can't use autoFocus — it is mounted (invisibly) from the start
  useEffect(() => {
    if (finished) acceptRef.current?.focus();
  }, [finished]);

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
    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-black px-6">
      {/* The whole stack slides up as the narrator moves on (see the
          useLayoutEffect above): the line being spoken is always held at the
          middle of the screen, so the last line — "Do you accept the
          mission?" — ends centered with the accept button right under it. */}
      <motion.div
        ref={stackRef}
        initial={false}
        animate={{ y: scrollY }}
        transition={{ duration: reducedMotion ? 0 : 0.7, ease: 'easeOut' }}
        className="flex w-full max-w-2xl flex-col items-center gap-5 text-center"
        role="region"
        aria-label="Mission brief"
        aria-live="polite"
      >
        {/* EVERY line (and the button) is mounted from the first frame,
            invisible until its turn — the stack's height never changes, so
            the only movement is the animated scroll. Mounting lines as they
            arrived made the flex centring re-jump the stack half a line each
            time, which read as the text bouncing up and down. */}
        {lines.map((line, i) => {
          const upcoming = i > index;
          const current = i === index && !finished;
          const text = upcoming ? '' : current ? line.slice(0, revealed) : line;
          return (
            <motion.p
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              aria-hidden={upcoming}
              initial={false}
              animate={{
                opacity: upcoming ? 0 : finished || !current ? (i === lines.length - 1 ? 1 : 0.32) : 1,
              }}
              transition={{ duration: reducedMotion ? 0 : 0.6 }}
              className="relative text-xl font-light leading-relaxed tracking-wide text-stone-100 md:text-2xl"
            >
              {/* the full line, invisible, holds the final size from the first
                  frame — so typing never re-wraps the text or moves the stack */}
              <span aria-hidden className="invisible">{line}</span>
              <span className="absolute inset-0">
                {text}
                {current && revealed < line.length && (
                  <span className="ml-0.5 inline-block h-[1em] w-px translate-y-[0.12em] animate-pulse bg-amber-200/80 align-middle" />
                )}
              </span>
            </motion.p>
          );
        })}

        <motion.button
          ref={acceptRef}
          initial={false}
          animate={{ opacity: finished ? 1 : 0 }}
          transition={{ duration: reducedMotion ? 0 : 1.1, delay: finished && !reducedMotion ? 0.5 : 0 }}
          disabled={!finished}
          aria-hidden={!finished}
          style={{ pointerEvents: finished ? 'auto' : 'none' }}
          onClick={onAccept}
          className="mt-8 rounded-sm border border-amber-200/50 px-10 py-3 text-sm tracking-[0.3em] text-amber-100 transition hover:bg-amber-200/10"
        >
          {brief.accept}
        </motion.button>
      </motion.div>

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
