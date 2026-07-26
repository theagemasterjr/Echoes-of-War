'use client';
/**
 * Chapter 1 timeline minigame state — shared between the 3D tabletop scene
 * (inside the Canvas) and the DOM HUD (labels / check button / summary).
 * The eight event figures stand in ONE row in shuffled order; the player
 * rearranges them (swap two) until the row runs earliest → latest, pressing
 * CHECK to lock in whatever is right. Score = right on the first check.
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
   * The learning point in src/content/trees/ch1.ts that teaches this event.
   * NOTHING in this minigame may exist without one: the player is only ever
   * asked to order moments the character has already explained. Adding a
   * figure here means adding or extending that point (and its cues) there.
   */
  teachesPointId: string;
}

// The four Objectives, told as eight moments to put in order. Every row names
// the learning point it comes from — see the note on teachesPointId. Dates verified.
export const EVENTS: TimelineEvent[] = [
  { id: 'versailles', order: 1, group: 'The Treaty of Versailles', teachesPointId: 'versailles-terms', label: 'Treaty of Versailles', date: '28 June 1919', why: 'The treaty ended World War I and punished Germany hard. Many Germans felt it was unfair.' },
  { id: 'depression', order: 2, group: 'Germany under the treaty', teachesPointId: 'depression', label: 'The Great Depression hits Germany', date: 'October 1929', why: 'Jobs and savings vanished. Angry, struggling people started listening to extreme leaders.' },
  { id: 'hitler', order: 3, group: 'Hitler’s rise to power', teachesPointId: 'hitler-power', label: 'Hitler becomes Chancellor', date: '30 January 1933', why: 'Hitler promised to undo the treaty and began rebuilding Germany’s army.' },
  { id: 'rhineland', order: 4, group: 'Hitler’s rise to power', teachesPointId: 'rhineland-austria', label: 'German troops enter the Rhineland', date: '7 March 1936', why: 'The treaty said this land must stay free of troops. Hitler sent them in — and no one stopped him.' },
  { id: 'munich', order: 5, group: 'Hitler’s rise to power', teachesPointId: 'munich-prague', label: 'Munich Agreement', date: '30 September 1938', why: 'Britain and France let Germany take part of Czechoslovakia, hoping that would keep the peace. It did not.' },
  { id: 'pact', order: 6, group: 'How Poland was conquered', teachesPointId: 'pact', label: 'Germany and the Soviet Union make a deal', date: '23 August 1939', why: 'The two promised not to fight each other. Poland was now in danger from both sides.' },
  { id: 'invasion', order: 7, group: 'How Poland was conquered', teachesPointId: 'invasion', label: 'Germany invades Poland', date: '1 September 1939', why: 'German forces attacked at dawn. World War II in Europe began.' },
  { id: 'declarations', order: 8, group: 'How Poland was conquered', teachesPointId: 'declarations', label: 'Britain and France declare war', date: '3 September 1939', why: 'They had promised to protect Poland. The war grew bigger.' },
];

export const eventById = (id: string) => EVENTS.find((e) => e.id === id)!;

/** End-of-chapter summary — one short line per Objectives topic, in the same
 *  five-topic order as the objectives in src/content/trees/ch1.ts (the narrated
 *  audio is matched to these entries BY INDEX — keep the count and the order).
 *  Kept under 700 characters so the voice can read the whole thing. */
export const SUMMARY: { topic: string; line: string }[] = [
  { topic: 'The Treaty of Versailles', line: 'The treaty ended World War I and punished Germany. Many Germans felt it was unfair.' },
  { topic: 'Germany under the treaty', line: 'When the Great Depression hit, jobs vanished. Angry, struggling people turned to extreme leaders.' },
  { topic: 'Hitler’s rise to power', line: 'Hitler became Chancellor in 1933 and quickly turned Germany into a dictatorship.' },
  { topic: 'The road to war', line: 'German troops re-entered the Rhineland, the Munich Agreement handed Hitler part of Czechoslovakia, and Germany signed a secret pact with the Soviet Union. No one stopped him.' },
  { topic: 'Germany invades Poland', line: 'On 1 September 1939, Germany invaded Poland. Two days later, Britain and France declared war. World War II had begun.' },
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
  /** Current left→right arrangement of the figure row. */
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
  /** Grade the row: correct figures lock and reveal, wrong ones flag. */
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
