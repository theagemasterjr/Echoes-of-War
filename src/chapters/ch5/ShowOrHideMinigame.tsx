'use client';
/**
 * Chapter 5 minigame, DOM layer — "Show it or hide it".
 *
 * Every word in the game lives up here: the one question the game turns on, the
 * label under each piece and beside each place, the line a correct drop earns,
 * Ted's hint after a second miss, and the closing card. The board itself —
 * table, map, pieces, the payoff — is the 3D scene (ShowOrHideScene), which
 * measures where each labelled thing lands on screen and publishes it, so the
 * pairing holds at any window size. Root is pointer-events-none so drags reach
 * the canvas.
 *
 * There is no score, no timer and no lose state, so nothing here counts down or
 * marks anything wrong. The counter says how many pieces are done and nothing
 * else — never how many belong in a zone.
 *
 * All of this text inherits the easy-read font from the global setting (see
 * globals.css), like every other word in the game.
 *
 * The summary is its own black screen, shared by every chapter — see
 * ui/ChapterSummary.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MinigameProps } from '../types';
import { ChapterSummary } from '@/ui/ChapterSummary';
import { voicePlayer } from '@/audio/voicePlayer';
import { SUMMARY } from './summary';
import {
  CLOSING_CARD, PIECES, QUESTION, counterText, useShowOrHideStore,
} from './showOrHideStore';

/** A feedback line has said its piece after this long. */
const FEEDBACK_MS = 9000;
/** So has one of Ted's hints, if the player leaves it alone. */
const NUDGE_MS = 14000;
/** The closing card holds this long before it offers to move on, so nobody
 *  clicks past it before they have read it. */
const CARD_READ_MS = 2600;

export function ShowOrHideMinigame({ chapterId, onComplete }: MinigameProps) {
  const placed = useShowOrHideStore((s) => s.placed);
  const labels = useShowOrHideStore((s) => s.labels);
  const stripTop = useShowOrHideStore((s) => s.stripTop);
  const feedback = useShowOrHideStore((s) => s.feedback);
  const nudge = useShowOrHideStore((s) => s.nudge);
  const stage = useShowOrHideStore((s) => s.stage);

  // the closing card hands on to the chapter's own summary screen, unchanged
  const [showSummary, setShowSummary] = useState(false);
  const placedCount = Object.keys(placed).length;

  // The eighth piece is down: the table clears itself — every piece name, both
  // zone plates, the strip and the counter — so the payoff plays on bare paper.
  // The French place names and the pin's tag stay: the payoff is about them.
  const clearing = stage !== 'play';
  const onBoard = clearing ? labels.filter((l) => l.kind === 'target' || l.kind === 'pin') : labels;

  // ONE strip, ONE position, for everything the board says. Whichever line
  // landed last is the line showing — a new one replaces it rather than
  // stacking, and nothing is ever drawn next to the piece that earned it.
  const latest =
    !feedback && !nudge ? null
      : !nudge || (feedback && feedback.at > nudge.at)
        ? { key: feedback!.at, text: feedback!.text, from: null as string | null }
        : { key: nudge.at, text: nudge.text, from: 'Ted' };

  // the closing card only offers CONTINUE once it has been on screen long
  // enough to read
  const [cardReady, setCardReady] = useState(false);
  useEffect(() => {
    if (stage !== 'card') return;
    voicePlayer.stop();
    const t = setTimeout(() => setCardReady(true), CARD_READ_MS);
    return () => clearTimeout(t);
  }, [stage]);

  if (showSummary) {
    return (
      <ChapterSummary
        chapterId={chapterId}
        summary={SUMMARY}
        onFinish={() => onComplete({ chapterId, completed: true })}
      />
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* the cut from Ted to the war-room table */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />

      {/* The question the whole game turns on. It opens the minigame and it
          never leaves — it is the only rule the player needs. */}
      <div className="absolute left-1/2 top-4 w-full max-w-3xl -translate-x-1/2 px-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
          The war room · spring 1944
        </div>
        <h2 className="mt-1 text-lg font-light leading-relaxed text-stone-100">{QUESTION}</h2>
        <motion.div
          className="mt-1.5 text-[11px] uppercase tracking-[0.25em] text-stone-400"
          animate={{ opacity: clearing ? 0 : 1 }}
          transition={{ duration: 0.3 }}
          aria-live="polite"
        >
          {counterText(placedCount)}
        </motion.div>
      </div>

      {/* Everything on the table is named: both zones, both places on the French
          coast, and every piece from the moment it appears. Drawn here, on top
          of the board, at one readable size whatever the window does. */}
      <AnimatePresence>
      {onBoard.map((label) => (
        <motion.div
          key={label.id}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute -translate-x-1/2"
          style={{
            left: `${Math.max(4, Math.min(96, label.left))}%`,
            top: `${Math.max(4, Math.min(95, label.top))}%`,
          }}
        >
          {label.kind === 'zone' ? (
            /* The zone's own name plate, sitting inside its outlined region
               near the top of it — the paper is cropped tight and Kent has no
               headroom above it. Dark backing so it holds up on pale parchment. */
            <div className="w-[7.4rem] -translate-y-1/2 rounded-sm border border-amber-200/30 bg-stone-950/85 px-1.5 py-px text-center shadow-lg backdrop-blur-sm">
              <div className="text-[10px] leading-[1.1] text-amber-100">{label.text}</div>
              <div className="text-[8px] uppercase leading-[1.1] tracking-[0.1em] text-amber-200/75">
                {label.note}
              </div>
            </div>
          ) : label.kind === 'target' || label.kind === 'pin' ? (
            <span
              className="whitespace-nowrap rounded-sm bg-stone-950/45 px-2 py-0.5 text-[10px] uppercase leading-snug tracking-[0.18em] text-sky-100 backdrop-blur-sm"
              style={{ opacity: label.dim ?? 1 }}
            >
              {label.text}
            </span>
          ) : (
            /* A piece waiting below the map is named under itself; a piece
               already in a zone is named in that zone's column, one row down
               per piece, so four of them never land on each other. */
            <div
              className={`rounded-sm bg-stone-950/65 px-1 py-0.5 text-center backdrop-blur-sm ${
                label.row === undefined ? 'w-[7.2rem]' : 'w-[8.8rem]'
              }`}
              style={label.row !== undefined ? { marginTop: `${label.row * 1.85}rem` } : undefined}
            >
              <div className="text-[11px] leading-snug text-stone-200">{label.text}</div>
              <div className="text-[10px] leading-snug text-stone-400">{label.note}</div>
            </div>
          )}
        </motion.div>
      ))}
      </AnimatePresence>

      {/*
        THE STRIP. Everything the board says to the player is drawn here and
        nowhere else: the line a correct piece earns, and Ted's hint after a
        second miss. One line at a time — a new one replaces the last rather
        than stacking.

        It sits in the clear band between the paper's near edge and the tray,
        at a position the scene measures each frame (stripTop), so it follows
        the board at any window size. It is deliberately NOT positioned near
        the piece that earned it: that is what used to drop text on top of the
        models, and it got worse as the zones filled.
      */}
      <AnimatePresence mode="wait">
        {latest && stage === 'play' && (
          <TimedLine key={latest.key} after={latest.from ? NUDGE_MS : FEEDBACK_MS}>
            <div
              className="absolute left-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 px-4"
              style={{ top: `${stripTop}%` }}
              aria-live="polite"
            >
              <div className="rounded-md border border-stone-800/70 bg-stone-950/85 px-5 py-1 text-center backdrop-blur-sm">
                {latest.from && (
                  <span className="mr-2 text-[9px] uppercase tracking-[0.25em] text-amber-200/50">
                    {latest.from}
                  </span>
                )}
                <span className="text-[12px] leading-[1.35] text-amber-50">{latest.text}</span>
              </div>
            </div>
          </TimedLine>
        )}
      </AnimatePresence>

      {/* the closing card, once the payoff has settled */}
      <AnimatePresence>
        {stage === 'card' && (
          <motion.div
            className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/92 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="max-w-2xl text-center">
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.35 }}
                className="text-xl font-light leading-relaxed text-amber-50"
              >
                {CLOSING_CARD}
              </motion.p>
              <AnimatePresence>
                {cardReady && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    onClick={() => setShowSummary(true)}
                    className="mt-10 rounded-sm border border-amber-200/40 px-6 py-2 text-xs tracking-[0.25em] text-amber-100 hover:bg-amber-200/10"
                  >
                    CONTINUE →
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Fades its child in, and out again once it has been on screen long enough. */
function TimedLine({ after, children }: { after: number; children: React.ReactNode }) {
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
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
}

/** Kept honest at build time: the split must stay four and four, and no text in
 *  this file may ever state it. */
if (process.env.NODE_ENV !== 'production') {
  const deceive = PIECES.filter((p) => p.zone === 'deceive').length;
  if (deceive !== 4 || PIECES.length !== 8) {
    console.warn('[ch5] the eight pieces are no longer four and four — check showOrHideStore.');
  }
}
