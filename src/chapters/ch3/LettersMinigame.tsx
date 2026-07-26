'use client';
/**
 * Chapter 3 minigame, DOM layer — the round banner, the opened letter, the
 * score screen and the chapter's narrated summary. The documents themselves
 * live in the 3D scene (LetterTableScene); this layer is every word the player
 * reads, because 3D text is unreadable at this camera and never dyslexia-safe.
 * Root is pointer-events-none so canvas taps reach the table; the letter page
 * and the buttons opt back in.
 *
 * Two screens close the chapter, in this order: a score screen that says only
 * "N of 3 on the first try" (no content — nothing should be said twice), and
 * then the chapter's narrated summary — its own black screen, the narrator
 * reading what the chapter taught, each topic appearing as it is spoken (see
 * audio/summaryNarration).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ChapterId, MinigameProps } from '../types';
import { useSummaryNarration } from '@/audio/summaryNarration';
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

  // the narrated summary — idle until the summary screen opens, and silenced
  // by leaving it (the hook hands the voice back on unmount)
  const reveal = useSummaryNarration(chapterId, SUMMARY.length, showSummary);
  const reduced = useReducedMotion() ?? false;

  /* ---- screen 2: the chapter's narrated summary (unchanged from before) ---- */
  if (showSummary) {
    return (
      <div
        className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black px-6 py-10"
        role="region"
        aria-label="Chapter summary"
        aria-live="polite"
      >
        <div className="w-full max-w-2xl">
          <div className="text-center text-[10px] uppercase tracking-[0.35em] text-amber-200/50">
            Chapter 3 · Summary
          </div>
          <h2 className="mt-3 text-center text-2xl font-light tracking-wide text-stone-100">
            What you learned
          </h2>
          <ul className="mt-10 space-y-7">
            {SUMMARY.map((s, i) => {
              const shown = i < reveal.revealed;
              const speaking = i === reveal.current && !reveal.finished;
              return (
                <motion.li
                  key={s.topic}
                  initial={false}
                  animate={{
                    opacity: shown ? (speaking || reveal.finished ? 1 : 0.4) : 0,
                    y: shown || reduced ? 0 : 10,
                  }}
                  transition={{ duration: reduced ? 0 : 0.7, ease: 'easeOut' }}
                  aria-hidden={!shown}
                >
                  <div
                    className={`text-[11px] uppercase tracking-[0.25em] ${
                      speaking ? 'text-amber-200' : 'text-amber-200/70'
                    }`}
                  >
                    {s.topic}
                  </div>
                  <p className="mt-1.5 text-base leading-relaxed text-stone-200">{s.line}</p>
                </motion.li>
              );
            })}
          </ul>
          {reveal.finished && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.9 }}
              className="mt-12 flex justify-center"
            >
              <button
                autoFocus
                onClick={() =>
                  onComplete({ chapterId, completed: true, score: score / ROUNDS.length })
                }
                className="rounded-sm border border-amber-200/50 px-8 py-3 text-xs tracking-[0.3em] text-amber-100 transition hover:bg-amber-200/10"
              >
                FINISH CHAPTER →
              </button>
            </motion.div>
          )}
        </div>

        {!reveal.finished && (
          <button
            onClick={reveal.skip}
            className="absolute bottom-6 right-6 rounded-sm border border-stone-700/70 px-5 py-2 text-[10px] uppercase tracking-[0.25em] text-stone-500 transition hover:border-amber-200/40 hover:text-amber-100/80"
          >
            Skip →
          </button>
        )}
      </div>
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
 * The opened letter: a full parchment page, in the game's paper colours, over
 * the document lifting off the table behind it. Plain DOM text throughout, so
 * the easy-read font and the large text size apply to it like everywhere else.
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
      className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-black/55 p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      /* the delay is the point: the document is seen lifting off the table
         first, and the page fades in over it — together they read as
         "it opened and zoomed" */
      transition={{ duration: reduced ? 0 : 0.35, delay: reduced ? 0 : 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-label="Document"
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-sm px-7 py-6 md:px-9 md:py-8"
        style={{
          background: 'linear-gradient(158deg, #f0e5cb 0%, #e2d3ad 55%, #cfbd94 100%)',
          border: '1px solid rgba(120, 96, 58, 0.55)',
          boxShadow: '0 26px 70px rgba(0, 0, 0, 0.65)',
          color: '#2b2318',
        }}
      >
        <p className="text-[15px] leading-[1.95] md:text-base">
          {aloud.sentences.map((s, i) => (
            <span
              key={i}
              className="rounded-sm transition-colors duration-200"
              style={
                i === aloud.spokenIndex
                  ? { backgroundColor: 'rgba(176, 122, 32, 0.28)', boxShadow: '0 0 0 3px rgba(176, 122, 32, 0.28)' }
                  : undefined
              }
            >
              {s}{' '}
            </span>
          ))}
        </p>

        {ruledOut && (
          <div className="mt-6 rounded-sm border border-[#8a6a3a]/50 bg-[#d8c69c]/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#6b4f26]">
              You ruled this one out
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">{doc.correction}</p>
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#8a6a3a]/40 pt-5">
          <div className="flex flex-col items-start gap-1">
            <button
              onClick={aloud.playing ? aloud.stop : aloud.start}
              disabled={aloud.status === 'loading'}
              className="rounded-sm border border-[#7a5c30]/70 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#4a3a20] transition hover:bg-[#7a5c30]/15 disabled:opacity-50"
            >
              {aloud.playing ? '■ Stop reading' : aloud.status === 'loading' ? 'Reading…' : '▶ Read aloud'}
            </button>
            {aloud.status === 'unavailable' && (
              <span className="text-[10px] text-[#6b5a3c]">voice unavailable</span>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={leave}
              className="rounded-sm border border-[#7a5c30]/70 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#4a3a20] transition hover:bg-[#7a5c30]/15"
            >
              Put it back
            </button>
            {!ruledOut && (
              <button
                onClick={() => {
                  aloud.stop();
                  commit(docId);
                }}
                className="rounded-sm border border-[#5c4520] bg-[#5c4520] px-5 py-2 text-[11px] uppercase tracking-[0.2em] text-[#f3e7cb] transition hover:bg-[#6d5228]"
              >
                This is the real one
              </button>
            )}
          </div>
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
