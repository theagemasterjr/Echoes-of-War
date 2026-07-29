'use client';
/**
 * Chapter 6 "The Voices" — the DOM layer. Every word the player reads lives
 * here (drawn from voicesStore, positioned by the scene's projections); the
 * 3D board never renders text. Ends in the shared ChapterSummary.
 *
 * The finale is deliberately quiet, and the quiet is enforced here: from the
 * moment the ninth slip settles until the final line appears, this component
 * renders NOTHING — no labels, no card, no strip, no button. The warm light
 * and the silence are the payoff. Do not add a celebration.
 *
 * Debug: typing "ninth" during play jumps straight to the ninth-slip state,
 * so the ending can be tested without replaying the board.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { MinigameProps } from '../types';
import { ChapterSummary } from '@/ui/ChapterSummary';
import { useSecretCode } from '@/core/debug/useSecretCode';
import { voicePlayer } from '@/audio/voicePlayer';
import { SUMMARY } from './summary';
import {
  FINAL_LINE, INSTRUCTION, NINTH_FALLBACK, NINTH_HINT_MS, TAP_HINT,
  slipById, speak, useVoicesStore,
} from './voicesStore';
import { TIMELINE } from './VoicesScene';

/** How long a correct-placement line stays. Nudges are shorter — one thought. */
const FEEDBACK_MS = 9000;
const NUDGE_MS = 7000;

export function VoicesMinigame({ chapterId, onComplete }: MinigameProps) {
  const reduced = useReducedMotion() ?? false;
  const stage = useVoicesStore((s) => s.stage);
  const placedCount = useVoicesStore((s) => s.placedCount);
  const order = useVoicesStore((s) => s.order);
  const labels = useVoicesStore((s) => s.labels);
  const stripTop = useVoicesStore((s) => s.stripTop);
  const feedback = useVoicesStore((s) => s.feedback);
  const nudge = useVoicesStore((s) => s.nudge);
  const selected = useVoicesStore((s) => s.selected);
  const ninthRefusedAt = useVoicesStore((s) => s.ninthRefusedAt);
  const finaleAt = useVoicesStore((s) => s.finaleAt);
  const jumpToNinth = useVoicesStore((s) => s.jumpToNinth);

  const [showSummary, setShowSummary] = useState(false);
  // a coarse clock so the ninth-slip fallback and the finale beats re-render
  const [, tick] = useState(0);
  useEffect(() => {
    if (!finaleAt && !(stage === 'ninth' && ninthRefusedAt)) return;
    const t = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(t);
  }, [finaleAt, stage, ninthRefusedAt]);

  // the ending must be reachable for testing without playing the whole board
  useSecretCode('ninth', jumpToNinth);

  // the first slip is read aloud as the board opens
  useEffect(() => {
    const first = useVoicesStore.getState().order[0];
    if (first) speak(slipById(first).text);
  }, []);

  const liveSlip = useMemo(() => {
    const id = stage === 'ninth' || placedCount < 8 ? order[placedCount] : undefined;
    return id ? slipById(id) : null;
  }, [stage, placedCount, order]);

  /* whichever of feedback / nudge landed last is the one line on screen */
  const latest = useMemo(() => {
    if (!feedback && !nudge) return null;
    if (feedback && (!nudge || feedback.at > nudge.at))
      return { key: `f${feedback.at}`, text: feedback.text, nudge: false };
    return { key: `n${nudge!.at}`, text: nudge!.text, nudge: true };
  }, [feedback, nudge]);

  /* the ninth-slip fallback line: only after a refusal, only after ~20 s */
  const now = performance.now();
  const fallbackDue =
    stage === 'ninth' && !finaleAt && ninthRefusedAt !== null &&
    now - ninthRefusedAt > NINTH_HINT_MS;
  const spokeFallback = useRef(false);
  useEffect(() => {
    if (fallbackDue && !spokeFallback.current) {
      spokeFallback.current = true;
      speak(NINTH_FALLBACK);
    }
  }, [fallbackDue]);

  /* finale beats */
  const finaleAge = finaleAt !== null ? (now - finaleAt) / 1000 : -1;
  const lineDue = finaleAt !== null && finaleAge >= TIMELINE.lineAt;
  const continueDue = finaleAt !== null && finaleAge >= TIMELINE.continueAt;
  const spokeLine = useRef(false);
  useEffect(() => {
    if (lineDue && !spokeLine.current) {
      spokeLine.current = true;
      speak(FINAL_LINE);
    }
  }, [lineDue]);

  if (showSummary) {
    return (
      <ChapterSummary
        chapterId={chapterId}
        summary={SUMMARY}
        onFinish={() => onComplete({ chapterId, completed: true })}
      />
    );
  }

  /* ── THE HOLD. From the ninth slip settling until the final line, the
        screen carries no UI of any kind. The board glows; that is all. ── */
  if (finaleAt !== null && !lineDue) {
    return <div className="pointer-events-none absolute inset-0" aria-hidden />;
  }

  /* ── the finale line and, later, the continue control ── */
  if (finaleAt !== null) {
    return (
      <div className="pointer-events-none absolute inset-0">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 1.6 }}
          className="absolute left-1/2 top-[16%] w-full max-w-2xl -translate-x-1/2 px-6 text-center text-[17px] tracking-wide text-amber-50/95"
        >
          {FINAL_LINE}
        </motion.p>
        {continueDue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.9 }}
            className="pointer-events-auto absolute bottom-10 left-1/2 -translate-x-1/2"
          >
            <button
              autoFocus
              onClick={() => {
                voicePlayer.stop();
                setShowSummary(true);
              }}
              className="rounded-sm border border-amber-200/40 bg-amber-200/5 px-6 py-2.5 text-xs uppercase tracking-[0.3em] text-amber-200/90 transition hover:bg-amber-200/15"
            >
              CONTINUE →
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  /* ── play and ninth-slip stages ── */
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* the cut from Dr. Hale to the war table */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.9 }}
        className="absolute inset-0 bg-black"
      />

      {/* header: one quiet standing instruction */}
      <div className="absolute left-1/2 top-5 w-full max-w-2xl -translate-x-1/2 px-6 text-center">
        <div className="text-[9px] uppercase tracking-[0.4em] text-amber-200/50">
          The war room · 1945
        </div>
        <h2 className="mt-1.5 text-[13px] tracking-wide text-stone-200">{INSTRUCTION}</h2>
      </div>

      {/* the four voice labels, fading in one at a time, left to right */}
      {labels.map((l) => (
        <motion.div
          key={l.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.8, delay: reduced ? 0 : 0.7 + l.order * 0.55 }}
          className="absolute -translate-x-1/2 text-center"
          style={{
            left: `${Math.min(96, Math.max(4, l.left))}%`,
            top: `${Math.min(95, Math.max(4, l.top))}%`,
          }}
        >
          <div className="rounded-sm border border-stone-800/60 bg-stone-950/80 px-2.5 py-1 backdrop-blur-[2px]">
            <div className="text-[11px] font-medium tracking-wide text-amber-50">{l.text}</div>
            {l.note && <div className="text-[9px] leading-snug text-stone-400">{l.note}</div>}
          </div>
        </motion.div>
      ))}

      {/* the current slip, readable at the bottom, spoken by Dr. Hale */}
      <AnimatePresence mode="wait">
        {liveSlip && (
          <motion.div
            key={liveSlip.id}
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.5 }}
            className="absolute bottom-[3.5%] left-1/2 w-full max-w-xl -translate-x-1/2 px-6 text-center"
            aria-live="polite"
          >
            <div
              className={`rounded-md border px-5 py-2.5 backdrop-blur-sm transition-colors ${
                selected
                  ? 'border-amber-200/50 bg-amber-950/60'
                  : 'border-stone-800/70 bg-stone-950/85'
              }`}
            >
              <p className="text-[13px] italic leading-relaxed text-amber-50">{liveSlip.text}</p>
              {placedCount === 0 && (
                <p className="mt-1 text-[9.5px] uppercase tracking-[0.2em] text-stone-500">
                  {TAP_HINT}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* one line at a time: feedback on a correct drop, or a nudge. Never
          near a piece — that is what used to drop text on the models. */}
      <AnimatePresence mode="wait">
        {latest && !fallbackDue && (
          <TimedLine key={latest.key} after={latest.nudge ? NUDGE_MS : FEEDBACK_MS} reduced={reduced}>
            <div
              className="absolute left-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 px-4"
              style={{ top: `${stripTop}%` }}
              aria-live="polite"
            >
              <div className="rounded-md border border-stone-800/70 bg-stone-950/85 px-5 py-1.5 text-center backdrop-blur-sm">
                <SpokenLine text={latest.text} />
              </div>
            </div>
          </TimedLine>
        )}
      </AnimatePresence>

      {/* the ninth-slip fallback — a hint, not an instruction */}
      <AnimatePresence>
        {fallbackDue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 1.4 }}
            className="absolute left-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 px-4 text-center"
            style={{ top: `${stripTop}%` }}
            aria-live="polite"
          >
            <p className="text-[13px] tracking-wide text-amber-100/85">{NINTH_FALLBACK}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── helpers ───────────────────────────────────────────────────────── */

/** Fades its child in, holds, and fades it back out after `after` ms. */
function TimedLine({ children, after, reduced }: {
  children: React.ReactNode;
  after: number;
  reduced: boolean;
}) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), after);
    return () => clearTimeout(t);
  }, [after]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: gone ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.5 }}
    >
      {children}
    </motion.div>
  );
}

/** Sentence-level highlight while the voice reads the line: the sentence
 *  being spoken sits at full brightness, the others dim — the same idea the
 *  chapter 3 letters use. With no voice playing, every sentence is bright. */
function SpokenLine({ text }: { text: string }) {
  const sentences = useMemo(() => text.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [text], [text]);
  const [current, setCurrent] = useState(-1);

  useEffect(() => {
    if (sentences.length < 2) return;
    const total = sentences.reduce((n, s) => n + s.length, 0);
    const t = setInterval(() => {
      const dur = voicePlayer.durationSec;
      if (!voicePlayer.speaking || !dur) {
        setCurrent(-1);
        return;
      }
      const through = voicePlayer.currentTime / dur;
      let acc = 0;
      for (let i = 0; i < sentences.length; i++) {
        acc += sentences[i].length / total;
        if (through <= acc) {
          setCurrent(i);
          return;
        }
      }
      setCurrent(sentences.length - 1);
    }, 200);
    return () => clearInterval(t);
  }, [sentences]);

  return (
    <span className="text-[12px] leading-[1.4]">
      {sentences.map((s, i) => (
        <span
          key={i}
          className={
            current === -1 || current === i ? 'text-amber-50' : 'text-amber-50/45'
          }
        >
          {s}{' '}
        </span>
      ))}
    </span>
  );
}
