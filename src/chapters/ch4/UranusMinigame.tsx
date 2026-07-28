'use client';
/**
 * Chapter 4 minigame, DOM layer — "Operation Uranus".
 *
 * Every word in the game lives up here: the one instruction line at the top of
 * the screen, the label beside each piece on the table, the caption a correct
 * drop earns, and Nikolai's line when something is put in the wrong place. The
 * board itself — table, map, pieces, the ring closing — is the 3D scene
 * (UranusTableScene), which measures where each labelled piece lands on screen
 * and publishes it, so the pairing holds at any window size. Root is
 * pointer-events-none so drags reach the canvas.
 *
 * The Objectives panel stays on screen throughout, showing what the player
 * ticked off talking to Nikolai plus the three rows the board itself teaches. It is
 * the same panel the conversation uses.
 *
 * The summary is its own black screen, shared by every chapter and by the debug
 * menu's jump — see ui/ChapterSummary.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MinigameProps } from '../types';
import { ChapterSummary } from '@/ui/ChapterSummary';
import { ObjectivesPanel } from '@/ui/ObjectivesPanel';
import { useConversation } from '@/conversation/engine';
import { voicePlayer } from '@/audio/voicePlayer';
import { BANNER, INSTRUCTION, OBJECTIVE_ROWS, SUMMARY, useUranusStore } from './uranusStore';

/** The ring seals, everything holds still, and the sound drops out — then the
 *  chapter's summary takes the screen. */
const HOLD_MS = 2000;
const FADE_MS = 900;
/** A caption has said its piece after this long. */
const CAPTION_MS = 7000;
/** A phase banner holds this long, then hands the screen back to the board.
 *  Long enough to read the extra how-to-play sentence on the first banner. */
const BANNER_MS = 6000;
/** So does one of Nikolai's corrections, if the player leaves it alone. */
const SAID_MS = 14000;

export function UranusMinigame({ chapterId, onComplete }: MinigameProps) {
  const phase = useUranusStore((s) => s.phase);
  const seal = useUranusStore((s) => s.seal);
  const labels = useUranusStore((s) => s.labels);
  const caption = useUranusStore((s) => s.caption);
  const said = useUranusStore((s) => s.said);
  const ticked = useUranusStore((s) => s.ticked);
  // what the player ticked off talking to Nikolai — the store outlives the
  // conversation beat, and an empty list (jumped straight here from the debug
  // menu) simply means the panel starts blank
  const fromConversation = useConversation((s) => s.objectivesDone);

  const [stage, setStage] = useState<'play' | 'hold' | 'summary'>('play');

  // The phase banner: one sentence when the game opens and one at each phase
  // change — what just happened, and what to do next. It holds a few seconds
  // and fades; the instruction line at the top stays.
  const [banner, setBanner] = useState<string | null>(null);
  useEffect(() => {
    const text = BANNER[phase];
    if (!text) return;
    setBanner(text);
    const t = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // The close finishes: the voice stops, the board holds still and silent for a
  // couple of seconds, then the screen fades to the summary.
  useEffect(() => {
    if (seal !== 'sealed') return;
    voicePlayer.stop();
    setStage('hold');
    const t = setTimeout(() => setStage('summary'), HOLD_MS + FADE_MS);
    return () => clearTimeout(t);
  }, [seal]);

  if (stage === 'summary') {
    return (
      <ChapterSummary
        chapterId={chapterId}
        summary={SUMMARY}
        onFinish={() => onComplete({ chapterId, completed: true })}
      />
    );
  }

  const doneIds = Array.from(new Set([...fromConversation, ...ticked]));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* the cut from Nikolai to the war-room table */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />

      {/* the one instruction line — the only instruction text in the minigame */}
      <div className="absolute left-1/2 top-4 -translate-x-1/2 px-6 text-center" aria-live="polite">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
          The war room · November 1942
        </div>
        <AnimatePresence mode="wait">
          <motion.h2
            key={phase}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.4 }}
            className="mt-1 text-lg font-light text-stone-100"
          >
            {INSTRUCTION[phase]}
          </motion.h2>
        </AnimatePresence>
      </div>

      <ObjectivesPanel objectives={OBJECTIVE_ROWS} doneIds={doneIds} />

      {/* the phase banner: what just happened, what to do next */}
      <AnimatePresence>
        {banner && stage === 'play' && (
          <motion.div
            key={banner}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute left-1/2 top-[19%] w-full max-w-xl -translate-x-1/2 px-4"
            aria-live="polite"
          >
            <div className="rounded-md border border-amber-200/30 bg-stone-950/85 px-6 py-3.5 text-center backdrop-blur-sm">
              <p className="text-[15px] leading-relaxed text-amber-50">{banner}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Every piece on the table is named — the same little name tags as the
          bronze pieces in chapter 2 — and the map's geography is named too.
          The labels are drawn here, on top of the board, at one readable size
          whatever the camera does, in the easy-read font with every other word
          in the game. */}
      {labels.map((label) => (
        <motion.div
          key={label.id}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute -translate-x-1/2"
          style={{
            left: `${Math.max(3, Math.min(97, label.left))}%`,
            top: `${Math.max(4, Math.min(94, label.top))}%`,
          }}
        >
          {label.kind === 'geo' ? (
            <span className="whitespace-nowrap rounded-sm bg-stone-950/45 px-2 py-0.5 text-[10px] uppercase leading-snug tracking-[0.18em] text-amber-100/85 backdrop-blur-sm">
              {label.text}
            </span>
          ) : (
            <span className="whitespace-nowrap rounded-sm bg-stone-950/60 px-2 py-0.5 text-[11px] leading-snug text-stone-300 backdrop-blur-sm">
              {label.text}
            </span>
          )}
        </motion.div>
      ))}

      {/* what a correct drop just taught */}
      <AnimatePresence>
        {caption && stage === 'play' && (
          <TimedLine key={caption.at} after={CAPTION_MS}>
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-6 text-center">
              <p className="max-w-[46ch] text-sm leading-relaxed text-amber-100/90">
                {caption.text}
              </p>
            </div>
          </TimedLine>
        )}
      </AnimatePresence>

      {/* Nikolai, when something is put in the wrong place. Never a bare "no" —
          always the reason, in her own voice. */}
      <AnimatePresence>
        {said && stage === 'play' && (
          <TimedLine key={said.at} after={SAID_MS}>
            <div className="absolute bottom-6 left-1/2 w-full max-w-2xl -translate-x-1/2 px-4">
              <div className="rounded-md border border-stone-800 bg-stone-950/80 px-6 py-4 text-center backdrop-blur-sm">
                <div className="text-[10px] uppercase tracking-[0.25em] text-amber-200/50">
                  Nikolai
                </div>
                <p className="mt-1.5 text-[15px] leading-relaxed text-stone-100">{said.text}</p>
              </div>
            </div>
          </TimedLine>
        )}
      </AnimatePresence>

      {/* the ring is closed: hold, then fade */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: stage === 'hold' ? 1 : 0 }}
        transition={{ duration: FADE_MS / 1000, delay: stage === 'hold' ? HOLD_MS / 1000 : 0 }}
      />
    </div>
  );
}

/** Fades its child in, and out again once it has been on screen long enough. */
function TimedLine({
  after,
  children,
}: {
  after: number;
  children: React.ReactNode;
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
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
}
