'use client';
/**
 * Chapter 3 minigame, DOM layer — the round banner, the score screen and the
 * chapter's narrated summary. The documents AND the opened letter's actual
 * words live in the 3D scene now (LetterTableScene's OpenLetterSheet, a paper
 * sheet with the text on it held up in front of the camera); this layer only
 * supplies the controls around it — read aloud, put it back, commit — plus a
 * spoken-sentence caption while the voice reads and the "ruled this one out"
 * note once a wrong document is committed. Root is pointer-events-none so
 * canvas taps reach the table; the control strip opts back in.
 *
 * Two screens close the chapter, in this order: a score screen that says only
 * "N of 3 on the first try" (no content — nothing should be said twice), and
 * then the chapter's narrated summary — the black screen shared by every
 * chapter and by the debug menu's jump, see ui/ChapterSummary.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ChapterId, MinigameProps } from '../types';
import { ChapterSummary } from '@/ui/ChapterSummary';
import { voicePlayer } from '@/audio/voicePlayer';
import { ROUNDS, SUMMARY, docById, useLettersStore } from './lettersStore';

export function LettersMinigame({ chapterId, onComplete }: MinigameProps) {
  const roundIndex = useLettersStore((s) => s.roundIndex);
  const openId = useLettersStore((s) => s.openId);
  const lastWrongId = useLettersStore((s) => s.lastWrongId);
  const solvedId = useLettersStore((s) => s.solvedId);
  const attempts = useLettersStore((s) => s.attempts);
  const score = useLettersStore((s) => s.score);
  const stage = useLettersStore((s) => s.stage);
  const nextRound = useLettersStore((s) => s.nextRound);
  const [showSummary, setShowSummary] = useState(false);
  const round = ROUNDS[roundIndex];

  /* ---- screen 2: the chapter's narrated summary — the shared black screen
   * every chapter ends on, mounted only once it opens, which is what starts
   * (and, on the way out, silences) the narrated take ---- */
  if (showSummary) {
    return (
      <ChapterSummary
        chapterId={chapterId}
        summary={SUMMARY}
        onFinish={() => onComplete({ chapterId, completed: true, score: score / ROUNDS.length })}
      />
    );
  }

  /* ---- screen 1: just the score — the narrated summary that follows owns
   * all the actual teaching, so nothing is said twice ---- */
  if (stage === 'score') {
    return (
      <div
        className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black px-6 py-10"
        role="region"
        aria-label="Your score"
      >
        <div className="w-full max-w-2xl">
          <div className="text-center text-[10px] uppercase tracking-[0.35em] text-amber-200/50">
            Chapter 3 · Letters of December
          </div>
          <h2 className="mt-3 text-center text-2xl font-light tracking-wide text-stone-100">
            {score} of {ROUNDS.length} right on your first try
          </h2>
          <div className="mt-12 flex justify-center">
            <button
              autoFocus
              onClick={() => setShowSummary(true)}
              className="rounded-sm border border-amber-200/50 px-8 py-3 text-xs tracking-[0.3em] text-amber-100 transition hover:bg-amber-200/10"
            >
              CONTINUE →
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- the table: banner, feedback, and whichever letter is open ---- */
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-10 w-full max-w-2xl -translate-x-1/2 px-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
          Letters of December · Round {roundIndex + 1} of {ROUNDS.length} · {round.eyebrow}
        </div>
        <h2 className="mt-2 text-base font-light leading-snug text-stone-100 md:text-lg">
          {round.banner}
        </h2>
        <p className="mt-2 text-xs text-stone-400">
          They look identical. Open one to read it, then choose the one you believe is real.
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center p-6 pb-8">
        {solvedId ? (
          /* the real one is found — the quiet confirm, then onward */
          <div className="pointer-events-auto w-full max-w-md rounded-md border border-emerald-800/60 bg-stone-950/85 p-6 text-center backdrop-blur-sm">
            <p className="text-sm text-emerald-200">
              {attempts === 1
                ? 'That is the real document — found first time.'
                : 'That is the real document.'}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-stone-400">{round.why}</p>
            <button
              autoFocus
              onClick={nextRound}
              className="mt-5 rounded-sm border border-amber-200/40 px-6 py-2.5 text-xs tracking-[0.25em] text-amber-100 hover:bg-amber-200/10"
            >
              {roundIndex < ROUNDS.length - 1 ? 'NEXT ROUND →' : 'SEE YOUR SCORE →'}
            </button>
          </div>
        ) : (
          lastWrongId &&
          !openId && (
            /* a wrong choice teaches, it does not punish — the round goes on */
            <div className="pointer-events-auto w-full max-w-md rounded-md border border-stone-700 bg-stone-950/85 p-5 text-center backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-[0.25em] text-amber-200/60">
                Not that one
              </p>
              <p className="mt-2 text-xs leading-relaxed text-stone-300">
                {docById(lastWrongId).correction}
              </p>
              <p className="mt-2 text-[11px] text-stone-500">Keep reading the others.</p>
            </div>
          )
        )}
      </div>

      {openId && <LetterPage key={openId} docId={openId} chapterId={chapterId} />}
    </div>
  );
}

/**
 * The controls around the opened letter. The letter's actual words are a 3D
 * paper sheet held up in front of the camera (LetterTableScene's
 * OpenLetterSheet) — this is only the strip beneath it: read aloud, a caption
 * of the sentence being spoken (the words themselves are on the page, not
 * here — this is just so a spoken line is never audio-only), the "ruled this
 * one out" note, and put-it-back / commit.
 */
function LetterPage({ docId, chapterId }: { docId: string; chapterId: ChapterId }) {
  const doc = docById(docId);
  const ruledOut = useLettersStore((s) => s.ruledOut.includes(docId));
  const close = useLettersStore((s) => s.close);
  const commit = useLettersStore((s) => s.commit);
  const reduced = useReducedMotion() ?? false;
  const aloud = useReadAloud(doc.text, chapterId);

  // leaving the page always takes the voice with it
  const stopAloud = aloud.stop;
  const leave = useCallback(() => {
    stopAloud();
    close();
  }, [stopAloud, close]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave]);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end gap-3 p-5 pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      /* the delay is the point: the letter is seen opening in 3D first, and
         this strip fades in under it — together they read as one motion */
      transition={{ duration: reduced ? 0 : 0.35, delay: reduced ? 0 : 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-label="Document"
    >
      {aloud.playing && aloud.spokenIndex >= 0 && (
        <p className="max-w-lg rounded-sm bg-stone-950/80 px-4 py-2 text-center text-xs leading-relaxed text-amber-100 backdrop-blur-sm">
          {aloud.sentences[aloud.spokenIndex]}
        </p>
      )}

      {ruledOut && (
        <div className="pointer-events-auto w-full max-w-md rounded-sm border border-[#8a6a3a]/50 bg-stone-950/85 p-4 text-center backdrop-blur-sm">
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber-200/60">
            You ruled this one out
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-200">{doc.correction}</p>
        </div>
      )}

      <div className="pointer-events-auto flex w-full max-w-md flex-wrap items-center justify-between gap-3 rounded-md border border-[#7a5c30]/50 bg-stone-950/85 p-4 backdrop-blur-sm">
        <div className="flex flex-col items-start gap-1">
          <button
            onClick={aloud.playing ? aloud.stop : aloud.start}
            disabled={aloud.status === 'loading'}
            className="rounded-sm border border-amber-200/40 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-amber-100 transition hover:bg-amber-200/10 disabled:opacity-50"
          >
            {aloud.playing ? '■ Stop reading' : aloud.status === 'loading' ? 'Reading…' : '▶ Read aloud'}
          </button>
          {aloud.status === 'unavailable' && (
            <span className="text-[10px] text-stone-400">voice unavailable</span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={leave}
            className="rounded-sm border border-amber-200/40 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-amber-100 transition hover:bg-amber-200/10"
          >
            Put it back
          </button>
          {!ruledOut && (
            <button
              onClick={() => {
                aloud.stop();
                commit(docId);
              }}
              className="rounded-sm border border-amber-200/50 bg-amber-200/15 px-5 py-2 text-[11px] uppercase tracking-[0.2em] text-amber-100 transition hover:bg-amber-200/25"
            >
              This is the real one
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Split a letter into sentences, so one can be highlighted as it is spoken.
 *  (Same rule the conversation subtitles use.) */
function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?…]+[.!?…]+[”"’']?\s*|[^.!?…]+$/g);
  const out = (parts ?? [text]).map((s) => s.trim()).filter(Boolean);
  return out.length > 0 ? out : [text];
}

type AloudStatus = 'idle' | 'loading' | 'playing' | 'unavailable';

/**
 * Read the letter aloud in the chapter's voice, with the sentence being spoken
 * highlighted.
 *
 * The highlight follows the REAL audio clock — every tick it reads how far
 * into the clip the voice is and maps that onto the letter (each sentence
 * takes a share of the clip proportional to its length), exactly the way the
 * conversation subtitles pace themselves. Timers would drift within a sentence
 * or two on a letter this long.
 *
 * Voice is optional infrastructure: no key, a failed synthesis or a spent
 * budget all end the same quiet way — the toggle says "voice unavailable" and
 * the letter stays perfectly playable in silence.
 */
function useReadAloud(text: string, chapterId: ChapterId) {
  const sentences = useMemo(() => splitSentences(text), [text]);
  const [status, setStatus] = useState<AloudStatus>('idle');
  const [spokenIndex, setSpokenIndex] = useState(-1);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      voicePlayer.stop(); // a letter never reads on over the next screen
    };
  }, []);

  // where each sentence ends as a fraction of the clip; characters stand in
  // for speaking time, which is close enough that a highlight never lands
  // early or hangs on after the voice has moved along
  const endsAt = useMemo(() => {
    const total = sentences.reduce((a, s) => a + s.length, 0) || 1;
    let acc = 0;
    return sentences.map((s) => {
      acc += s.length;
      return acc / total;
    });
  }, [sentences]);

  // follow the voice while it plays; land on the last sentence when it ends
  useEffect(() => {
    if (status !== 'playing') return;
    const follow = setInterval(() => {
      const dur = voicePlayer.durationSec;
      if (!voicePlayer.speaking || dur <= 1) return;
      const at = voicePlayer.currentTime / dur;
      let k = 0;
      while (k < endsAt.length - 1 && at >= endsAt[k]) k++;
      setSpokenIndex((v) => (k > v ? k : v)); // the highlight only moves forward
    }, 100);
    const un = voicePlayer.subscribe((e) => {
      if (e === 'end' && live.current) {
        setStatus('idle');
        setSpokenIndex(-1);
      }
    });
    return () => {
      clearInterval(follow);
      un();
    };
  }, [status, endsAt]);

  const start = useCallback(async () => {
    setStatus('loading');
    setSpokenIndex(0);
    // speak() resolves once the clip is actually playing (or has quietly
    // failed) — asking the player afterwards is the whole availability check
    await voicePlayer.speak(text, chapterId);
    if (!live.current) return;
    if (voicePlayer.speaking) {
      setStatus('playing');
    } else {
      setStatus('unavailable');
      setSpokenIndex(-1);
    }
  }, [text, chapterId]);

  const stop = useCallback(() => {
    voicePlayer.stop();
    setSpokenIndex(-1);
    setStatus((s) => (s === 'unavailable' ? s : 'idle'));
  }, []);

  return { sentences, spokenIndex, status, playing: status === 'playing', start, stop };
}
