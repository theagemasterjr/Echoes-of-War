'use client';
/**
 * The narrated chapter summary — one hand-recorded take per chapter, and the
 * moments inside it where the narrator moves from one topic to the next.
 *
 * The summary screen is a black card of film titles: a topic appears as the
 * narrator reaches it, earlier ones settle back, and when the take ends they
 * are all on screen and the chapter's finish button arrives. The recorded
 * pauses between topics are part of the take, so the screen simply holds.
 *
 * The voice plays through the same element as the mission brief (see
 * narrationPlayer), which the player's first tap unlocked, so no sound button
 * is needed — and only ever one voice can be speaking. If the browser refuses
 * to play anyway, the reveal falls back to the wall clock on the very same
 * timings, so the screen never stalls in silence.
 *
 * A chapter with no recording returns null here and its summary shows whole,
 * immediately.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/state/settingsStore';
import { claimNarration, narrationAudio, releaseNarration } from './narrationPlayer';

export interface SummaryTake {
  /** the recording, served from /public */
  track: string;
  /** seconds into the take: where the narrator starts and finishes each topic,
   *  in the same order the chapter's SUMMARY lists them */
  topics: { start: number; end: number }[];
}

/**
 * The recordings, by chapter. Data, not behaviour: nothing here knows what a
 * chapter is about, and a chapter without a row simply has no narration.
 * Re-measure and update a row whenever a take is re-recorded.
 *
 * A take speaks each topic's body only — the titles are on screen, so reading
 * them aloud would say everything twice. Roughly nine tenths of a second of
 * silence separates one topic from the next.
 */
const TAKES: Record<string, SummaryTake> = {
  ch1: {
    track: '/audio/summary/ch1.mp3?v=2',
    topics: [
      { start: 0.0, end: 5.87 },
      { start: 6.77, end: 12.61 },
      { start: 13.51, end: 18.57 },
      { start: 19.47, end: 30.34 },
      { start: 31.24, end: 41.39 },
    ],
  },
  ch2: {
    track: '/audio/summary/ch2.mp3?v=2',
    topics: [
      { start: 0.0, end: 7.24 },
      { start: 8.14, end: 14.43 },
      { start: 15.33, end: 22.2 },
      { start: 23.1, end: 30.7 },
      { start: 31.6, end: 39.16 },
    ],
  },
  ch3: {
    track: '/audio/summary/ch3.mp3?v=2',
    topics: [
      { start: 0.0, end: 8.45 },
      { start: 9.35, end: 19.24 },
      { start: 20.14, end: 31.14 },
    ],
  },
};

/** The take recorded for a chapter, or null if it has none. */
export function summaryTake(chapterId: string): SummaryTake | null {
  return TAKES[chapterId] ?? null;
}

export interface SummaryReveal {
  /** how many topics have been reached — show rows [0, revealed) */
  revealed: number;
  /** the topic being spoken right now (-1 before the take starts) */
  current: number;
  /** the take is over (or was skipped): every topic is on screen */
  finished: boolean;
  /** show everything now and silence the voice — the skip button */
  skip: () => void;
}

/** Point the shared element at a file without restarting an identical one. */
function setSource(el: HTMLAudioElement, url: string) {
  const absolute = new URL(url, window.location.origin).href;
  if (el.src !== absolute) el.src = url;
}

/**
 * Runs a chapter's summary screen: plays its take and reports which topics the
 * narrator has reached.
 *
 * `active` is what the summary screen is showing — the hook sits idle (and
 * silent) while the minigame is still being played, and starts the take the
 * moment the summary opens. Leaving the screen stops the voice.
 */
export function useSummaryNarration(
  chapterId: string,
  topicCount: number,
  active: boolean,
): SummaryReveal {
  const take = summaryTake(chapterId);
  // no recording for this chapter: the whole summary is simply there
  const silent = !take;

  const [revealed, setRevealed] = useState(silent ? topicCount : 0);
  const [current, setCurrent] = useState(silent ? topicCount - 1 : -1);
  const [finished, setFinished] = useState(silent);
  const doneRef = useRef(silent);

  const skip = useCallback(() => {
    doneRef.current = true;
    try {
      // pause, never clear the source — clearing raises a media error
      narrationAudio()?.pause();
    } catch {}
    setRevealed(topicCount);
    setCurrent(topicCount - 1);
    setFinished(true);
  }, [topicCount]);

  // hold the narrator's voice while the summary is up, hand it back on the way
  // out (the hand-back is deferred — see claimNarration)
  useEffect(() => {
    if (!active) return;
    const token = claimNarration();
    return () => releaseNarration(token);
  }, [active]);

  useEffect(() => {
    if (!active || !take || doneRef.current || topicCount === 0) return;

    // a topic the take has no timing for (the wording gained a topic after the
    // recording) waits for the end, so nothing is ever stuck out of sight
    const lastEnd = take.topics[take.topics.length - 1]?.end ?? 0;
    const starts = Array.from(
      { length: topicCount },
      (_, i) => take.topics[i]?.start ?? lastEnd,
    );

    let raf = 0;
    let cancelled = false;

    const finish = () => {
      if (cancelled || doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(raf);
      setRevealed(topicCount);
      setCurrent(topicCount - 1);
      setFinished(true);
    };

    const el = narrationAudio();
    if (el) {
      try {
        setSource(el, take.track);
        el.currentTime = 0; // a replay starts the take over, not where it stopped
        el.volume = useSettingsStore.getState().volume;
        const start = () => el.play().catch(() => {}); // refused: the wall clock carries it
        if (el.readyState >= 2) start();
        else el.addEventListener('canplay', start, { once: true });
        // the recording finishing IS the take being over — never wait on the
        // timed lastEnd, which can sit a hair past the file's real duration
        el.addEventListener('ended', finish);
      } catch {
        /* fail silent — the reveal runs on the wall clock */
      }
    }

    const startedAt = performance.now();
    // the screen only ever moves forward, so a stutter never un-reveals a topic
    let seen = 0;

    const tick = () => {
      if (cancelled || doneRef.current) return;
      // follow the voice when it is playing, otherwise keep the screen moving
      // at the pace the take was timed to
      const t =
        el && el.currentTime > 0 ? el.currentTime : (performance.now() - startedAt) / 1000;

      let n = 0;
      while (n < starts.length && t >= starts[n]) n++;
      seen = Math.max(seen, n);
      setRevealed(seen);
      setCurrent(seen - 1);

      if (t >= lastEnd || (el && el.ended)) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      el?.removeEventListener('ended', finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, take?.track, topicCount]);

  return { revealed, current, finished, skip };
}
