'use client';
/**
 * Chapter 3 timeline minigame state — same 2D card-row game as chapter 2
 * (no 3D scene; the founder may build one later). The eight event cards sit
 * in ONE row in shuffled order; the player rearranges them (tap two to swap)
 * until the row runs earliest → latest, pressing CHECK to lock in whatever
 * is right. Score = right on the first check.
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
   * The learning point in src/content/trees/ch3.ts that teaches this event.
   * NOTHING in this minigame may exist without one: the player is only ever
   * asked to order moments the character has already explained. Adding a
   * card here means adding or extending that point (and its cues) there.
   */
  teachesPointId: string;
}

// The road to a world war, told as eight moments to put in order. Every row
// names the learning point it comes from — see the note on teachesPointId.
// Dates verified. NOTE: Pearl Harbor and the strikes across the Pacific stay
// on ONE card — across the date line the Malaya landings actually began
// slightly BEFORE Pearl Harbor, so splitting them would put a false order on
// screen. And the 1940 pact did NOT oblige Germany to declare war on America
// (Japan attacked; the pact was defensive) — Hitler chose to. Keep both facts
// straight in any rewording.
export const EVENTS: TimelineEvent[] = [
  { id: 'china', order: 1, group: 'Why Japan attacked', teachesPointId: 'china', label: 'Japan’s war in China begins in earnest', date: '7 July 1937', why: 'Japan invaded deeper into China, looking for land and resources. The fighting never stopped.' },
  { id: 'pact', order: 2, group: 'Why Japan attacked', teachesPointId: 'oneworld', label: 'Japan joins Germany and Italy', date: '27 September 1940', why: 'The three countries signed a pact promising to back each other up.' },
  { id: 'indochina', order: 3, group: 'Why Japan attacked', teachesPointId: 'china', label: 'Japan moves into southern Indochina', date: 'July 1941', why: 'Japanese troops took over French colonies in South-East Asia, close to the oil fields.' },
  { id: 'oil', order: 4, group: 'Why Japan attacked', teachesPointId: 'oil', label: 'America cuts off Japan’s oil', date: '26 July 1941', why: 'America froze Japan’s money and stopped selling it oil. Japan bought most of its oil from America.' },
  { id: 'talks', order: 5, group: 'Why Japan attacked', teachesPointId: 'plan', label: 'The talks in Washington break down', date: '26 November 1941', why: 'Months of negotiating ended with no deal. Japan’s fleet was already at sea.' },
  { id: 'pearl', order: 6, group: 'The attack on Pearl Harbor', teachesPointId: 'sunday', label: 'The attack on Pearl Harbor', date: '7 December 1941', why: 'Japanese planes struck the fleet at anchor. In the same hours Japan attacked the Philippines, Guam, Wake, Hong Kong, Malaya and Thailand.' },
  { id: 'declaration', order: 7, group: 'America enters the war', teachesPointId: 'infamy', label: 'America declares war on Japan', date: '8 December 1941', why: 'Roosevelt asked Congress for a declaration of war, and Congress voted for it almost unanimously.' },
  { id: 'germany', order: 8, group: 'America enters the war', teachesPointId: 'germany', label: 'Germany and Italy declare war on America', date: '11 December 1941', why: 'Now the war in Europe and the war in Asia were one war.' },
];

export const eventById = (id: string) => EVENTS.find((e) => e.id === id)!;

/** End-of-chapter summary — one short line per Objectives topic, in the same
 *  order as the three objectives in src/content/trees/ch3.ts (why Japan
 *  attacked → what they came for → what changed). The narrator's voice, not
 *  Ray's. Kept under 700 characters so the voice can read it all. THREE
 *  entries, in this order: the narration is wired up by index. */
export const SUMMARY: { topic: string; line: string }[] = [
  { topic: 'Why Japan attacked', line: 'Japan wanted an empire in Asia. When America cut off its oil, Japan chose to strike first — and cripple the fleet that could stop it.' },
  { topic: 'Japan’s target at Pearl Harbor', line: 'On 7 December 1941, Japanese planes hit the fleet at anchor. The battleships were sunk or crippled — but the aircraft carriers were at sea, and escaped.' },
  { topic: 'America joins the war', line: 'America declared war on Japan the next day, and Germany and Italy declared war on America. American factories, ships, and troops poured in — and the tide began to turn against the Axis.' },
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
