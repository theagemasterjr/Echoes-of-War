'use client';
/**
 * Chapter 2 matching minigame state — shared between the 3D tabletop scene
 * (inside the Canvas) and the DOM HUD (descriptions / summary).
 *
 * Five dark boxes stand in a fixed row across the back of the war-room table,
 * each one holding the description of a moment from the summer of 1940; the
 * five game pieces sit in a shuffled row in front of them. The player drags
 * each piece into the box that describes it. A right drop snaps in and locks;
 * a wrong one is only ever a "try again" — no penalty, no counter.
 * Score = how many were right on the very first try.
 */
import { create } from 'zustand';

export interface Moment {
  id: string;
  /** This moment's game piece, by asset id (see src/assets/registry.tsx). */
  assetId: string;
  /** The event this piece stands for — shown under the piece in the row until
   *  it is placed. The event NAME under the piece, the description in the box:
   *  matching the two is the comprehension check. */
  pieceName: string;
  /**
   * The words in the box. The objective's NAME is deliberately not shown:
   * "Eagle Day" printed beside a bomber would be word-matching, not
   * comprehension. The description alone asks the player to remember.
   */
  description: string;
  /**
   * The learning point in src/content/trees/ch2.ts that teaches this moment.
   * NOTHING in this minigame may exist without one: the player is only ever
   * asked to match moments the character has already explained. Adding a
   * piece here means adding or extending that point (and its cues) there.
   */
  teachesPointId: string;
}

/**
 * The five boxes in their fixed left→right order on the table — and, in the
 * same row, the piece that belongs in each. The index IS the mapping: piece
 * MOMENTS[i].id is right only in box i.
 */
export const MOMENTS: Moment[] = [
  {
    id: 'dunkirk',
    assetId: 'ch2.piece.boat',
    pieceName: 'Escape at Dunkirk',
    description:
      'Three hundred thousand soldiers, trapped on a beach in France, were carried home to fight another day.',
    teachesPointId: 'dunkirk',
  },
  {
    id: 'alone',
    assetId: 'ch2.piece.carriage',
    pieceName: 'France’s surrender',
    description:
      'One ally gave up the fight — signing the papers in the very same place Germany had been made to sign years before.',
    teachesPointId: 'france',
  },
  {
    id: 'eagleday',
    assetId: 'ch2.piece.bomber',
    pieceName: 'Eagle Day',
    description: 'Germany’s assault on Britain began — an attack that came from the sky.',
    teachesPointId: 'eagleday',
  },
  {
    id: 'cities',
    assetId: 'ch2.piece.cathedral',
    pieceName: 'The Blitz',
    description: 'Night after night the bombs fell on London. But the city, and its people, held on.',
    teachesPointId: 'london',
  },
  {
    id: 'won',
    assetId: 'ch2.piece.crown',
    pieceName: 'Victory',
    description:
      'The great raids were beaten back, Germany gave up, and the invasion never came.',
    teachesPointId: 'sept15',
  },
];

export const momentById = (id: string) => MOMENTS.find((m) => m.id === id)!;

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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A shuffled front row that is never accidentally the answer already laid
 *  out: at least one piece must sit under a box that is not its own. */
function shuffledRow(): string[] {
  for (let tries = 0; tries < 20; tries++) {
    const row = shuffle(MOMENTS).map((m) => m.id);
    if (row.some((id, i) => id !== MOMENTS[i].id)) return row;
  }
  return [...MOMENTS.map((m) => m.id)].reverse();
}

/** Where a row of five lands on screen, as fractions of the viewport: the row's
 *  own line (from the top) and the width of one column. Measured by the 3D
 *  scene and published here so the HUD can hang each description directly
 *  above its own box — all text in this game is plain 2D DOM, never in-scene. */
export interface RowScreen {
  /** 0 = top of the window, 1 = bottom. */
  top: number;
  /** Width of one of the five columns, 0..1 of the window's width. */
  column: number;
}

interface MatchState {
  /** Left→right arrangement of the pieces in the front row. A piece keeps its
   *  place here after it is matched, so the others never shuffle underfoot. */
  row: string[];
  /** Pieces that found their box — locked, and no longer draggable. */
  placed: string[];
  /** Pieces that have been dropped in a wrong box at least once. */
  missed: string[];
  /** How many pieces went straight into the right box (the score). */
  firstTryCorrect: number;
  /** Pieces whose model would not load — drawn as plain blocks and named in
   *  the HUD, so a missing file never makes the game unplayable. */
  failed: string[];
  /** Where the two rows sit on screen; null until the scene has measured. */
  screen: { boxes: RowScreen; pieces: RowScreen } | null;

  /** Drop a held piece on box `boxIndex` — true if that is its box. */
  tryDrop: (pieceId: string, boxIndex: number) => boolean;
  markFailed: (pieceId: string) => void;
  setScreen: (screen: { boxes: RowScreen; pieces: RowScreen }) => void;
  reset: () => void;
}

const fresh = () => ({
  row: shuffledRow(),
  placed: [] as string[],
  missed: [] as string[],
  firstTryCorrect: 0,
  failed: [] as string[],
});

export const useMatchStore = create<MatchState>((set, get) => ({
  ...fresh(),
  screen: null,

  tryDrop: (pieceId, boxIndex) => {
    const s = get();
    if (s.placed.includes(pieceId)) return false;
    const correct = MOMENTS[boxIndex]?.id === pieceId;
    if (correct) {
      set({
        placed: [...s.placed, pieceId],
        firstTryCorrect: s.firstTryCorrect + (s.missed.includes(pieceId) ? 0 : 1),
      });
    } else if (!s.missed.includes(pieceId)) {
      set({ missed: [...s.missed, pieceId] });
    }
    return correct;
  },

  markFailed: (pieceId) =>
    set((s) => (s.failed.includes(pieceId) ? s : { failed: [...s.failed, pieceId] })),

  // measured every time the camera or the window changes; kept across a reset
  // so the descriptions never blink out of place when a game starts over
  setScreen: (screen) => set({ screen }),

  reset: () => set(fresh()),
}));
