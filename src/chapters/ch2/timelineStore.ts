'use client';
/**
 * Chapter 2 timeline minigame state — a 2D card row version of chapter 1's
 * tabletop timeline (no 3D scene; the founder may build one later). The eight
 * event cards sit in ONE row in shuffled order; the player rearranges them
 * (tap two to swap) until the row runs earliest → latest, pressing CHECK to
 * lock in whatever is right. Score = right on the first check.
 */
import { create } from 'zustand';

export interface TimelineEvent {
  id: string;
  order: number; // 1 = earliest
  label: string;
  date: string;
  why: string;
  /** Which Objectives row this event belongs to. */
  group: string;
  /**
   * The learning point in src/content/trees/ch2.ts that teaches this event.
   * NOTHING in this minigame may exist without one: the player is only ever
   * asked to order moments the character has already explained. Adding a
   * card here means adding or extending that point (and its cues) there.
   */
  teachesPointId: string;
}

// The summer of 1940, told as eight moments to put in order. Every row names
// the learning point it comes from — see the note on teachesPointId. Dates verified.
export const EVENTS: TimelineEvent[] = [
  { id: 'dunkirk', order: 1, group: 'Why Britain stood alone', teachesPointId: 'dunkirk', label: 'The army escapes from Dunkirk', date: '26 May – 4 June 1940', why: 'Around 338,000 men got home, but their guns and tanks were left behind.' },
  { id: 'france', order: 2, group: 'Why Britain stood alone', teachesPointId: 'france', label: 'France signs an armistice', date: '22 June 1940', why: 'Britain and the Commonwealth were now facing Germany alone.' },
  { id: 'channel', order: 3, group: 'Germany’s plan and the attack', teachesPointId: 'sealion', label: 'The air battle begins over the Channel', date: '10 July 1940', why: 'German aircraft attacked ships in the Channel. The fighting had started.' },
  { id: 'eagleday', order: 4, group: 'Germany’s plan and the attack', teachesPointId: 'eagleday', label: '“Eagle Day” — the full attack opens', date: '13 August 1940', why: 'The Luftwaffe went all out at the airfields and radar stations, trying to destroy the RAF.' },
  { id: 'airfields', order: 5, group: 'Germany’s plan and the attack', teachesPointId: 'airfields', label: 'The airfields are hit hardest', date: '18 August – early September 1940', why: 'Attacks on the fighter airfields nearly broke Fighter Command. This was the closest call.' },
  { id: 'berlin', order: 6, group: 'The Blitz and 15 September', teachesPointId: 'berlin', label: 'Bombs on London, and Berlin bombed in reply', date: '24–26 August 1940', why: 'German bombs hit London by mistake; the RAF bombed Berlin in return.' },
  { id: 'london', order: 7, group: 'The Blitz and 15 September', teachesPointId: 'london', label: 'The Blitz begins — the bombers turn on London', date: '7 September 1940', why: 'Bombing the city took the pressure off the airfields that were nearly beaten.' },
  { id: 'sept15', order: 8, group: 'The Blitz and 15 September', teachesPointId: 'sept15', label: 'The big daylight raids are turned back', date: '15 September 1940', why: 'The largest daylight attacks were beaten off with heavy losses. Daylight raids fell away after this.' },
];

export const eventById = (id: string) => EVENTS.find((e) => e.id === id)!;

/** End-of-chapter summary — one short line per Objectives topic, in the same
 *  order as the five objectives in src/content/trees/ch2.ts. Narrated audio is
 *  keyed to these entries BY INDEX, so keep them five and keep them in order.
 *  The last line speaks in the narrator's voice (Tom himself never knows the
 *  invasion was called off). Kept under 700 characters so the voice can read it all. */
export const SUMMARY: { topic: string; line: string }[] = [
  { topic: 'Escape at Dunkirk', line: 'Trapped on the beaches of France, over three hundred thousand British and Allied soldiers were rescued by navy ships and small boats.' },
  { topic: 'Britain stands alone', line: 'France surrendered to Germany in June 1940. Britain and the Commonwealth now faced Germany alone.' },
  { topic: 'Eagle Day', line: 'In August, Germany launched its air assault on Britain, hammering the RAF’s airfields to clear the way for invasion.' },
  { topic: 'The cities burn', line: 'In September the bombers turned on London and other cities. Night after night the cities burned — but Britain held on.' },
  { topic: 'The battle won', line: 'On 15 September the biggest raids were beaten back. Germany gave up, and the invasion never came. Britain had won.' },
];
export const SUMMARY_SPOKEN = SUMMARY.map((s) => `${s.topic}. ${s.line}`).join(' ');

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A shuffled row that is never accidentally already solved. */
function shuffledOrder(): string[] {
  for (let tries = 0; tries < 20; tries++) {
    const order = shuffle(EVENTS).map((e) => e.id);
    if (order.some((id, i) => id !== EVENTS[i].id)) return order;
  }
  return [...EVENTS.map((e) => e.id)].reverse();
}

interface TimelineState {
  /** Current left→right arrangement of the card row. */
  order: string[];
  /** Ids confirmed in the right place by a CHECK — locked, shown revealed. */
  locked: string[];
  /** Ids that were in the wrong place at the last check (until next move). */
  lastWrong: string[];
  selected: string | null;
  checks: number;
  /** How many stood correct at the very first check (the score). */
  firstCheckScore: number | null;

  select: (id: string | null) => void;
  /** Swap the two ids' positions (no-op if either is locked). */
  swapById: (a: string, b: string) => void;
  /** Grade the row: correct cards lock and reveal, wrong ones flag. */
  check: () => void;
  reset: () => void;
}

const fresh = () => ({
  order: shuffledOrder(),
  locked: [] as string[],
  lastWrong: [] as string[],
  selected: null,
  checks: 0,
  firstCheckScore: null,
});

export const useTimelineStore = create<TimelineState>((set, get) => ({
  ...fresh(),

  select: (selected) => {
    if (selected && get().locked.includes(selected)) return;
    set({ selected });
  },

  swapById: (a, b) => {
    const s = get();
    if (a === b || s.locked.includes(a) || s.locked.includes(b)) return;
    const ia = s.order.indexOf(a);
    const ib = s.order.indexOf(b);
    if (ia === -1 || ib === -1) return;
    const order = [...s.order];
    [order[ia], order[ib]] = [order[ib], order[ia]];
    set({ order, selected: null, lastWrong: [] });
  },

  check: () => {
    const s = get();
    const locked = s.order.filter((id, i) => id === EVENTS[i].id);
    set({
      locked,
      lastWrong: s.order.filter((id) => !locked.includes(id)),
      checks: s.checks + 1,
      firstCheckScore: s.firstCheckScore ?? locked.length,
      selected: null,
    });
  },

  reset: () => set(fresh()),
}));
