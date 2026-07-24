'use client';
/**
 * Chapter 1 minigame — Road to War Timeline. Seven shuffled event cards are
 * placed, earliest to latest, along a timeline. A correct placement snaps in
 * and reveals the date and one-line significance; a wrong one shakes with a
 * gentle "earlier/later" hint. Score is the count placed correctly on the
 * first attempt. Tap-a-card-then-a-slot is primary (keyboard-accessible for
 * free); HTML5 drag is a desktop convenience over the same place-attempt.
 *
 * Chapter-internal only — nothing outside src/chapters/ch1 is touched.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { MinigameProps } from '../types';
import { voicePlayer } from '@/audio/voicePlayer';

interface EventCard {
  id: string;
  order: number; // 1 = earliest
  label: string;
  date: string;
  why: string;
  /** Which "Things to learn about" topic this card belongs to. */
  group: string;
}

// Content mirrors the conversation's "Things to learn about" checklist —
// same four topics, told as eight moments in order. Dates verified.
const EVENTS: EventCard[] = [
  { id: 'versailles', order: 1, group: 'The Treaty of Versailles', label: 'Treaty of Versailles', date: '28 June 1919', why: 'The treaty ended World War I and punished Germany hard. Many Germans felt it was unfair.' },
  { id: 'depression', order: 2, group: 'Germany under the treaty', label: 'The Great Depression hits Germany', date: 'October 1929', why: 'Jobs and savings vanished. Angry, struggling people started listening to extreme leaders.' },
  { id: 'hitler', order: 3, group: 'Hitler’s rise to power', label: 'Hitler becomes Chancellor', date: '30 January 1933', why: 'Hitler promised to undo the treaty and began rebuilding Germany’s army.' },
  { id: 'rhineland', order: 4, group: 'Hitler’s rise to power', label: 'German troops enter the Rhineland', date: '7 March 1936', why: 'The treaty said this land must stay free of troops. Hitler sent them in — and no one stopped him.' },
  { id: 'munich', order: 5, group: 'Hitler’s rise to power', label: 'Munich Agreement', date: '30 September 1938', why: 'Britain and France let Germany take part of Czechoslovakia, hoping that would keep the peace. It did not.' },
  { id: 'pact', order: 6, group: 'How Poland was conquered', label: 'Germany and the Soviet Union make a deal', date: '23 August 1939', why: 'The two promised not to fight each other. Poland was now in danger from both sides.' },
  { id: 'invasion', order: 7, group: 'How Poland was conquered', label: 'Germany invades Poland', date: '1 September 1939', why: 'German forces attacked at dawn. World War II in Europe began.' },
  { id: 'declarations', order: 8, group: 'How Poland was conquered', label: 'Britain and France declare war', date: '3 September 1939', why: 'They had promised to protect Poland. The war grew bigger.' },
];

/** End-of-chapter summary — one short line per "Things to learn about" topic.
 *  Kept under 700 characters so the voice can read the whole thing. */
const SUMMARY: { topic: string; line: string }[] = [
  { topic: 'The Treaty of Versailles', line: 'The treaty ended World War I and punished Germany. Many Germans felt it was unfair.' },
  { topic: 'Germany under the treaty', line: 'When the Great Depression hit, jobs vanished. Angry, struggling people turned to extreme leaders.' },
  { topic: 'Hitler’s rise to power', line: 'Hitler took power in 1933, rebuilt the army, and took land step by step — and no one stopped him.' },
  { topic: 'How Poland was conquered', line: 'After a deal with the Soviet Union, Germany invaded Poland on 1 September 1939. Britain and France declared war. World War II had begun.' },
];
const SUMMARY_SPOKEN = SUMMARY.map((s) => `${s.topic}. ${s.line}`).join(' ');

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function TimelineMinigame({ chapterId, onComplete }: MinigameProps) {
  const shuffled = useMemo(() => shuffle(EVENTS), []);
  const [placed, setPlaced] = useState<(EventCard | null)[]>(Array(EVENTS.length).fill(null));
  const [handIds, setHandIds] = useState<string[]>(shuffled.map((e) => e.id));
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongOnce, setWrongOnce] = useState<Set<string>>(new Set());
  const [firstTry, setFirstTry] = useState(0);
  const [shakeSlot, setShakeSlot] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [spoken, setSpoken] = useState(false); // the voice reads the summary exactly once

  // leaving the screen silences any summary still being read
  useEffect(() => () => voicePlayer.stop(), []);

  const byId = (id: string) => EVENTS.find((e) => e.id === id)!;
  const done = handIds.length === 0;

  const attempt = (cardId: string, slotIndex: number) => {
    if (placed[slotIndex]) return; // slot taken
    const card = byId(cardId);
    if (card.order - 1 === slotIndex) {
      // correct
      setPlaced((p) => {
        const next = [...p];
        next[slotIndex] = card;
        return next;
      });
      setHandIds((h) => h.filter((id) => id !== cardId));
      if (!wrongOnce.has(cardId)) setFirstTry((n) => n + 1);
      setSelected(null);
      setHint(null);
    } else {
      // wrong — remember it (kills the first-try credit) and hint direction
      setWrongOnce((s) => new Set(s).add(cardId));
      setShakeSlot(slotIndex);
      setTimeout(() => setShakeSlot(null), 400);
      setHint(
        card.order - 1 < slotIndex
          ? 'That happened earlier than that spot.'
          : 'That happened later than that spot.',
      );
    }
  };

  const onSlotClick = (i: number) => {
    if (selected) attempt(selected, i);
  };

  if (showSummary) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-md border border-stone-800 bg-stone-950/85 p-8 backdrop-blur-sm">
          <div className="text-center text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
            Chapter 1 · Summary
          </div>
          <h2 className="mt-3 text-center text-xl font-light text-stone-100">What you learned</h2>
          <ul className="mt-6 space-y-4">
            {SUMMARY.map((s) => (
              <li key={s.topic}>
                <div className="text-[10px] uppercase tracking-widest text-amber-200/70">{s.topic}</div>
                <p className="mt-1 text-sm leading-relaxed text-stone-300">{s.line}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex justify-center gap-3">
            <button
              onClick={() => {
                if (spoken) return;
                setSpoken(true);
                voicePlayer.speak(SUMMARY_SPOKEN, chapterId);
              }}
              disabled={spoken}
              className="rounded-sm border border-stone-700 px-5 py-2.5 text-xs tracking-widest text-stone-300 transition hover:bg-stone-800 disabled:opacity-40"
            >
              {spoken ? '✓ PLAYED' : '🔊 READ IT TO ME'}
            </button>
            <button
              onClick={() => {
                voicePlayer.stop();
                onComplete({ chapterId, completed: true, score: firstTry / EVENTS.length });
              }}
              className="rounded-sm border border-amber-200/40 px-5 py-2.5 text-xs tracking-[0.25em] text-amber-100 hover:bg-amber-200/10"
            >
              FINISH CHAPTER →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl rounded-md border border-stone-800 bg-stone-950/85 p-8 backdrop-blur-sm">
        <div className="text-center text-[10px] uppercase tracking-[0.3em] text-amber-200/50">
          Road to War · Timeline
        </div>
        <h2 className="mt-3 text-center text-xl font-light text-stone-100">
          Place the events in order, earliest to latest
        </h2>
        <p className="mt-2 text-center text-xs text-stone-500">
          Tap a card, then tap a spot on the timeline — or drag it there.
        </p>

        {/* timeline band — two rows of four, read left to right */}
        <div className="mt-8 grid grid-cols-4 gap-2">
          {placed.map((card, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => onSlotClick(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (id) attempt(id, i);
              }}
              animate={shakeSlot === i ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              disabled={!!card}
              className={`flex h-32 flex-col justify-center rounded-sm border px-2 py-2 text-center text-[11px] leading-snug transition ${
                card
                  ? 'border-emerald-500/40 bg-emerald-500/5 text-stone-200'
                  : selected
                    ? 'border-amber-200/50 bg-amber-200/5 text-amber-100/70 hover:bg-amber-200/10'
                    : 'border-dashed border-stone-700 text-stone-600'
              }`}
            >
              <span className="text-[9px] uppercase tracking-widest text-stone-500">{i + 1}</span>
              {card ? (
                <>
                  <span className="text-[8px] uppercase tracking-widest text-amber-200/50">{card.group}</span>
                  <span className="mt-1 font-medium">{card.label}</span>
                  <span className="mt-1 text-amber-200/70">{card.date}</span>
                  <span className="mt-1 text-[10px] text-stone-400">{card.why}</span>
                </>
              ) : (
                <span className="mt-2 text-stone-600">—</span>
              )}
            </motion.button>
          ))}
        </div>

        {hint && !done && (
          <p className="mt-4 text-center text-xs text-amber-200/70">{hint}</p>
        )}

        {/* hand of remaining cards */}
        {!done ? (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {handIds.map((id) => {
              const card = byId(id);
              return (
                <button
                  key={id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', id);
                    setSelected(id);
                  }}
                  onClick={() => setSelected((s) => (s === id ? null : id))}
                  className={`rounded-sm border px-4 py-2.5 text-sm transition ${
                    selected === id
                      ? 'border-amber-200/60 bg-amber-200/10 text-amber-100'
                      : 'border-stone-700 text-stone-300 hover:border-stone-500'
                  }`}
                >
                  {card.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 text-center">
            <p className="text-sm text-stone-200">
              Timeline complete — {firstTry} of {EVENTS.length} placed right the first time.
            </p>
            <p className="mt-1 text-xs text-stone-500">
              You just put the whole story in order: the treaty, Germany under it, Hitler’s rise
              to power, and how Poland was conquered.
            </p>
            <button
              onClick={() => setShowSummary(true)}
              className="mt-6 rounded-sm border border-amber-200/40 px-6 py-2.5 text-xs tracking-[0.25em] text-amber-100 hover:bg-amber-200/10"
            >
              CONTINUE →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
