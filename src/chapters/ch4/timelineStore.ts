'use client';
/**
 * Chapter 4 timeline minigame state and content — eight moments from the
 * battle, shuffled, to be put back in order earliest → latest. The player taps
 * two cards to swap them and presses CHECK MY ORDER; whatever stands in the
 * right place locks and opens (date + why). Score = right on the FIRST check.
 *
 * Unlike chapters 1–3 this game is plain DOM — no 3D scene, no minigame
 * camera. It is deliberately the simplest safe shape, so the founder can
 * replace it later without unpicking anything.
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
   * The learning point in src/content/trees/ch4.ts that teaches this event.
   * NOTHING in this minigame may exist without one: the player is only ever
   * asked to order moments Nina has already explained. Adding a card here
   * means adding or extending that point (and its cues) there.
   */
  teachesPointId: string;
}

/**
 * The eight moments. Dates verified.
 *
 * Only three of the four Objectives rows appear here — "What it cost" (the
 * medics and the families who were never got out) is carried by the closing
 * summary instead, because it is not a dated moment you can put in a line.
 *
 * On card 5: the counter-attack's secret codename ("Uranus") could be added to
 * this line — the cards are the narrator's voice, not Nina's — but it must
 * never reach her dialogue, because in early 1943 nobody outside the planning
 * staff had heard it. The card deliberately teaches the IDEA instead: the
 * attack went in where the enemy line was weakest, not where the fighting was
 * hardest. That is the part a child should walk away with.
 *
 * Deliberately absent, and not to be added: any casualty total for the battle,
 * and what became of the prisoners. See the tone note at the top of
 * src/content/trees/ch4.ts.
 */
export const EVENTS: TimelineEvent[] = [
  { id: 'invasion', order: 1, group: 'Why Stalingrad', teachesPointId: 'barbarossa', label: 'Germany invades the Soviet Union', date: '22 June 1941', why: 'The largest invasion in history. German armies pushed deep into Soviet land.' },
  { id: 'southeast', order: 2, group: 'Why Stalingrad', teachesPointId: 'whystalingrad', label: 'Germany’s summer attack drives south-east', date: '28 June 1942', why: 'The new push aimed at the oil fields in the south. Stalingrad guarded the side of that push, and the river it stood on.' },
  { id: 'bombing', order: 3, group: 'Fighting in the ruins', teachesPointId: 'bombing', label: 'The city is bombed and the Germans reach the Volga', date: '23 August 1942', why: 'The city was set alight in a day. Thousands of people were killed and Stalingrad became ruins.' },
  { id: 'ruins', order: 4, group: 'Fighting in the ruins', teachesPointId: 'ruins', label: 'Months of fighting through the ruins', date: 'September – November 1942', why: 'House by house, factory by factory. The wreckage helped the defenders and slowed the attackers.' },
  { id: 'counterattack', order: 5, group: 'How the tide turned', teachesPointId: 'counterattack', label: 'The Red Army counter-attacks the flanks', date: '19 November 1942', why: 'Instead of attacking the strong German centre, the Soviets hit the weaker armies on either side.' },
  { id: 'encircled', order: 6, group: 'How the tide turned', teachesPointId: 'encircled', label: 'The German army in the city is surrounded', date: '23 November 1942', why: 'The two Soviet attacks met behind the city. A whole German army was trapped inside.' },
  { id: 'trapped', order: 7, group: 'How the tide turned', teachesPointId: 'trapped', label: 'The rescue fails and supply by air falls short', date: 'December 1942', why: 'A relief attempt was stopped and far too little food and fuel could be flown in.' },
  { id: 'surrender', order: 8, group: 'How the tide turned', teachesPointId: 'surrender', label: 'The last German troops surrender', date: '2 February 1943', why: 'An entire German army was gone. From here the Red Army began pushing west.' },
];

export const eventById = (id: string) => EVENTS.find((e) => e.id === id)!;

/**
 * End-of-chapter summary — one short line per Objectives row, in the same
 * four-topic order as the objectives in src/content/trees/ch4.ts (a narrated
 * recording, when one exists, is matched to these entries BY INDEX — keep the
 * count and the order). Kept under 700 characters in total so a voice could
 * read the whole thing in one go.
 *
 * "What it cost" is the quiet one, and it stays quiet: the people of the city
 * and the soldiers on both sides, no numbers and no imagery.
 */
export const SUMMARY: { topic: string; line: string }[] = [
  { topic: 'Why Stalingrad', line: 'Germany invaded the Soviet Union in 1941. The next summer it drove south for oil, and this city guarded the Volga at the side of that drive.' },
  { topic: 'Fighting in the ruins', line: 'The city was bombed to rubble, then fought over house by house for months. Everything came in across the river by boat.' },
  { topic: 'What it cost', line: 'The families in the city were never taken to safety, and soldiers on both sides lived through that winter. The cost fell on all of them.' },
  { topic: 'How the tide turned', line: 'In November the Red Army struck the weaker armies on the flanks and surrounded the Germans in the city. They surrendered in February 1943, and the war in the east changed direction.' },
];

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
  /** Current arrangement of the cards, earliest slot first. */
  order: string[];
  /** Ids confirmed in the right place by a CHECK — locked, shown opened. */
  locked: string[];
  /** Ids that were in the wrong place at the last check (until the next move). */
  lastWrong: string[];
  selected: string | null;
  checks: number;
  /** How many stood correct at the very first check (the score). */
  firstCheckScore: number | null;

  select: (id: string | null) => void;
  /** Swap the two ids' positions (no-op if either is locked). */
  swapById: (a: string, b: string) => void;
  /** Grade the row: correct cards lock and open, wrong ones flag. */
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
