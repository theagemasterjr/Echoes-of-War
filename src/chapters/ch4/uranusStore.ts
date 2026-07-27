'use client';
/**
 * Chapter 4 minigame — "Operation Uranus". State, board and every word the
 * player reads or hears.
 *
 * The player is on the Soviet planning side, laying the counter-attack out on
 * the war-room table. Five drags, three phases, one correct arrangement: this is
 * a comprehension check made physical, not a strategy simulation. There is no
 * score, no timer, no lives, and no penalty for a wrong drop beyond an
 * explanation in Nikolai's voice. The player may retry as often as they like.
 *
 * NOTHING IS ASKED HERE THAT NINA HAS NOT ALREADY TAUGHT. Every slot names the
 * learning point in src/content/trees/ch4.ts that teaches it (`teachesPointId`)
 * — those ids must keep existing there. Add a slot, and add or widen the point
 * that teaches it; drop a point, and drop its slot.
 *
 * The board is the two supplied map images (identical framing, 1448 × 1086):
 * German-held territory in red across the west, the river running north to
 * south, the east clean parchment. Phase 3 wipes between them, so every
 * position below is in MAP COORDINATES — u across (0 = west edge, 1 = east),
 * v down (0 = north edge, 1 = south) — read off those images and true for both.
 *
 * A note for whoever edits the flanks: the two flank pieces are labelled
 * "Romanian Army" and "Hungarian Army", which is the founder's simplification
 * of a longer truth. In November 1942 the sectors either side of the city were
 * held by Romanian armies, with Hungarian and Italian armies holding the line
 * further up the Don to the north-west; the Hungarians were broken in the weeks
 * that followed. Both were Axis allies holding flank sectors of that front, and
 * the point the labels exist to teach — Germany's flanks were held by its
 * allies, not by Germans — is exactly right. Nikolai's own dialogue carries the
 * fuller version; see her `flanks` learning point.
 */
import { create } from 'zustand';
import { voicePlayer } from '@/audio/voicePlayer';
import type { SummaryEntry } from '../types';

/* ────────────────────────────── the board ────────────────────────────── */

/** Where the paper map lies on the tabletop, in table units. The aspect is the
 *  images' own (1448 × 1086), so nothing is stretched. */
export const MAP = { w: 8.4, d: 6.3, z: -0.55, y: 0.014 } as const;
/** The near edge of the table, where liftable pieces wait. */
export const TRAY_Z = 3.2;

export type MapPoint = readonly [u: number, v: number];

/** Map coordinates → table coordinates. */
export function mapToWorld([u, v]: MapPoint): [number, number, number] {
  return [(u - 0.5) * MAP.w, MAP.y, MAP.z + (v - 0.5) * MAP.d];
}

/** The three phases, then the scripted close and the hold before the summary. */
export type Phase = 'why' | 'strike' | 'close' | 'sealed';

/** One short line at the top of the screen — the only standing instruction
 *  text in the minigame. One sentence per phase, and each says what to DO
 *  (drag which piece, to where), because a player who has never seen the board
 *  cannot be expected to guess that the floating pieces at the table edge are
 *  for picking up. */
export const INSTRUCTION: Record<Phase, string> = {
  why: 'Drag the oil rig to the oil fields, and the barge to the Volga River.',
  strike: 'Drag the two Soviet armies onto the weak flanks north and south of the city.',
  close: 'Drag the last Soviet army behind the city to close the trap.',
  sealed: 'The ring is closed.',
};

/** One sentence when a phase opens — the transition moment. It says what just
 *  happened and what the player does next, then fades; the INSTRUCTION line
 *  above stays put for anyone who missed it. The first one is the very first
 *  thing the player reads, so it says what the whole game is. */
export const BANNER: Record<Phase, string> = {
  why: 'Help plan the Soviet counter-attack — drag the pieces onto the map.',
  strike: 'Those are the two things Germany came for — now choose where the Red Army strikes.',
  close: 'The flanks are set — now close the ring behind the German army.',
  sealed: '',
};

/** The places named on the paper itself, in every phase — the geography the
 *  player has to be able to see at a glance. Positions read off the map
 *  images; each label hangs at its own point, clear of the drop rings. */
export const GEO_LABELS: { id: string; text: string; at: MapPoint }[] = [
  { id: 'geo-volga', text: 'Volga River', at: [0.53, 0.1] },
  { id: 'geo-oil', text: 'Caucasus Oil Fields', at: [0.85, 0.9] },
  { id: 'geo-city', text: 'Stalingrad', at: [0.676, 0.56] },
];

/** Every piece that can end up on the table. `kind` is what a slot accepts. */
export type PieceId =
  | 'derrick'
  | 'barge'
  | 'hammer-1'
  | 'hammer-2'
  | 'hammer-3';

export interface Piece {
  id: PieceId;
  assetId: string;
  /** Which phase puts this piece at the table edge. */
  phase: Phase;
  /** What the piece is — under it while it waits at the table edge, and under
   *  it again once it is placed (unless its slot names it more precisely). */
  label: string;
}

/** The five draggable pieces, in the order they are needed. */
export const PIECES: Piece[] = [
  { id: 'derrick', assetId: 'ch4.piece.derrick', phase: 'why', label: 'Oil Rig' },
  { id: 'barge', assetId: 'ch4.piece.barge', phase: 'why', label: 'Supply Barge' },
  { id: 'hammer-1', assetId: 'ch4.piece.hammer', phase: 'strike', label: 'Soviet Army' },
  { id: 'hammer-2', assetId: 'ch4.piece.hammer', phase: 'strike', label: 'Soviet Army' },
  { id: 'hammer-3', assetId: 'ch4.piece.hammer', phase: 'close', label: 'Soviet Army' },
];

export const pieceById = (id: PieceId) => PIECES.find((p) => p.id === id)!;

export interface Slot {
  id: string;
  phase: Phase;
  at: MapPoint;
  /** Where a seated piece actually rests, when that differs from the drop
   *  target's centre. The two flank slots need this: their `at` is the ally
   *  piece holding the line, and a hammer seated on the very same point would
   *  stand inside the ally model. The hammer sits just east of the line
   *  instead — the side the Red Army attacked from. */
  seatAt?: MapPoint;
  /** Names the seated piece more precisely than the piece's own label (the two
   *  flank armies become "— North" / "— South"), and nudges the tag clear of
   *  the crowd of tags around the city (map units, from the seat point). */
  seatLabel?: string;
  seatLabelNudge?: MapPoint;
  /** How generous the drop target is, in table units. */
  radius: number;
  /** Piece ids this slot will seat. An empty list is a slot that always
   *  refuses — the centre, which exists to be tried and explained. */
  accepts: PieceId[];
  /** The one line that appears under the board on a correct drop. */
  caption?: string;
  /** Nikolai's line when the wrong thing is put here (or when this slot refuses
   *  everything). Never a bare rejection — always the reason. */
  refuses?: string;
  /** The learning point in trees/ch4.ts that teaches this slot. */
  teachesPointId: string;
}

/**
 * The board's targets. Positions were read off the supplied map: the oil in the
 * Caucasus south-east of the Black Sea, the barge on the river's upper reach,
 * the flanks either side of the city on the front line, and the ring closing
 * west of the city on the German supply route.
 */
export const SLOTS: Slot[] = [
  {
    id: 'oilfield',
    phase: 'why',
    at: [0.7, 0.83],
    radius: 0.62,
    accepts: ['derrick'],
    caption: 'An army cannot move without fuel.',
    refuses:
      'That is the river, not the oil. The oil is away in the south, past the mountains — the Caucasus. That is what the derrick marks.',
    teachesPointId: 'oil',
  },
  {
    id: 'river',
    phase: 'why',
    at: [0.601, 0.267],
    radius: 0.62,
    accepts: ['barge'],
    caption: 'Whoever holds the river holds the supplies.',
    refuses:
      'A barge cannot sail through an oil field. Put it on the river — the Volga is how everything in this country moves.',
    teachesPointId: 'volga',
  },
  {
    id: 'left-flank',
    phase: 'strike',
    at: [0.51, 0.42],
    seatAt: [0.56, 0.39],
    seatLabel: 'Soviet Army — North',
    radius: 0.6,
    accepts: ['hammer-1', 'hammer-2'],
    caption: 'This side is held by Romanians — Germany’s allies, not Germans.',
    teachesPointId: 'flanks',
  },
  {
    id: 'centre',
    phase: 'strike',
    at: [0.621, 0.552],
    radius: 0.66,
    accepts: [],
    refuses:
      'Not there. Their whole Sixth Army is in that city, and it is the strongest thing on this table. Strike the strongest point head-on and it is your army that is destroyed. Look at the sides instead — those are Germany’s allies. Fewer men, less equipment, spread thinner.',
    teachesPointId: 'flanks',
  },
  {
    id: 'right-flank',
    phase: 'strike',
    at: [0.675, 0.74],
    seatAt: [0.735, 0.74],
    seatLabel: 'Soviet Army — South',
    radius: 0.6,
    accepts: ['hammer-1', 'hammer-2'],
    caption: 'This side is held by Hungarians — Germany’s allies, not Germans.',
    teachesPointId: 'flanks',
  },
  {
    id: 'behind',
    phase: 'close',
    at: [0.495, 0.575],
    seatLabelNudge: [-0.09, -0.01],
    radius: 0.66,
    accepts: ['hammer-3'],
    caption: 'The two attacks meet behind the city. The Sixth Army is inside the ring.',
    teachesPointId: 'ring',
  },
];

export const slotById = (id: string) => SLOTS.find((s) => s.id === id)!;

/** What Nikolai says when a piece is let go over open table — a nudge, never a
 *  telling-off. One per phase. */
export const NOWHERE_LINE: Record<Phase, string> = {
  why: 'Not just anywhere. The two places worth marking are the ones glowing.',
  strike: 'Put it on the line, where the front is. The glowing places are your choices.',
  close: 'Behind the city — west of it, across the road their supplies come up.',
  sealed: '',
};

/* ─────────────────────── static scenery (phase 2) ─────────────────────── */

/**
 * The five pieces that land when the front line is drawn. They are the puzzle's
 * information and the player cannot pick them up: three pieces stacked in the
 * centre, one thin piece alone on each side. Every one of them is labelled —
 * the two flank labels are the most important text in the minigame, because
 * without them the player only learns "hit the smaller piece", and with them
 * they learn why the attack worked.
 */
export interface Scenery {
  id: string;
  assetId: string;
  at: MapPoint;
  /** Label, and where to hang it relative to the piece (map units). */
  label?: string;
  labelNudge?: MapPoint;
  /** German pieces dim when the ring seals. */
  german?: boolean;
}

export const SCENERY: Scenery[] = [
  // The city carries no label of its own: "Stalingrad" is one of the map's
  // standing geography labels (GEO_LABELS), on screen from the first frame.
  { id: 'city', assetId: 'ch4.piece.city', at: [0.621, 0.552] },
  // One label for all three German pieces, not three. They cluster tight
  // around the city but hold ~0.6 table units off its centre — the city model
  // is 0.89 units square, so anything nearer stands inside the ruins.
  { id: 'german-1', assetId: 'ch4.piece.german', at: [0.573, 0.481], german: true },
  { id: 'german-2', assetId: 'ch4.piece.german', at: [0.553, 0.58], german: true, label: 'German 6th Army', labelNudge: [-0.075, 0.055] },
  { id: 'german-3', assetId: 'ch4.piece.german', at: [0.595, 0.64], german: true },
  // Both ally tags sit well out to the west, leaving room for the
  // "Soviet Army — North / South" tags that arrive under the placed hammers.
  { id: 'ally-left', assetId: 'ch4.piece.ally', at: [0.51, 0.42], label: 'Romanian Army', labelNudge: [-0.12, 0.05] },
  { id: 'ally-right', assetId: 'ch4.piece.ally', at: [0.675, 0.74], label: 'Hungarian Army', labelNudge: [-0.085, 0.05] },
];

/** The German front line, as it stood in November 1942: north to south, bulging
 *  east around the city. Drawn on cue at the start of phase 2. */
export const FRONT_LINE: MapPoint[] = [
  [0.462, 0.22], [0.478, 0.32], [0.492, 0.385], [0.51, 0.42], [0.545, 0.462],
  [0.58, 0.495], [0.605, 0.53], [0.615, 0.562], [0.612, 0.61], [0.62, 0.66],
  [0.642, 0.705], [0.675, 0.74], [0.7, 0.79], [0.71, 0.85], [0.714, 0.9],
];

/**
 * The ring, as two arms that grow from the river side and meet behind the city
 * — which is the shape of what happened, and the thing the player is meant to
 * be able to picture afterwards. Both lists start at the same point on the east
 * side and end at the same point in the west (the 'behind' slot).
 */
export const RING_NORTH: MapPoint[] = [
  [0.655, 0.552], [0.625, 0.495], [0.57, 0.475], [0.52, 0.505], [0.495, 0.575],
];
export const RING_SOUTH: MapPoint[] = [
  [0.655, 0.552], [0.64, 0.618], [0.585, 0.652], [0.523, 0.63], [0.495, 0.575],
];

/** The curved paths the two flank hammers sweep along as the ring closes:
 *  start (each flank slot's seatAt, so the sweep begins where the hammer
 *  actually stands), a control point that bows them round the outside, and the
 *  meeting point behind the city. */
export const SWEEPS: Record<'left-flank' | 'right-flank', { from: MapPoint; via: MapPoint; to: MapPoint }> = {
  'left-flank': { from: [0.56, 0.39], via: [0.372, 0.452], to: [0.495, 0.575] },
  'right-flank': { from: [0.735, 0.74], via: [0.542, 0.79], to: [0.495, 0.575] },
};

/* ───────────────────────── the objectives panel ───────────────────────── */

/**
 * The five rows of the Objectives panel, which stays on screen throughout the
 * minigame. Ids and labels MUST match `objectives` in src/content/trees/ch4.ts:
 * the panel shows the rows the player already ticked in conversation, and the
 * minigame ticks three more as the board is laid out.
 */
export const OBJECTIVE_ROWS: { id: string; label: string }[] = [
  { id: 'obj-pact', label: 'The Broken Pact' },
  { id: 'obj-why', label: 'Why did Germany choose Stalingrad' },
  { id: 'obj-ruins', label: 'Battle in the Ruins' },
  { id: 'obj-trap', label: 'Operation Uranus' },
  { id: 'obj-turn', label: 'The Turning Point' },
];

/* ────────────────────────────── the summary ───────────────────────────── */

/**
 * End-of-chapter summary — one topic per objective, in the same order as the
 * panel. The narrated take speaks the LINES ONLY (the titles are on screen);
 * its per-topic timings live in src/audio/summaryNarration.ts and were measured
 * against the recording. Editing a line here means re-measuring that take.
 */
export const SUMMARY: SummaryEntry[] = [
  {
    topic: 'The Broken Pact',
    line: 'In 1939 Germany and the Soviet Union promised not to attack each other. In June 1941 Germany broke that promise and invaded.',
  },
  {
    topic: 'Why did Germany choose Stalingrad',
    line: 'The next summer Germany drove south for oil. This city guarded the Volga, the country’s great supply route, and it carried Stalin’s name.',
  },
  {
    topic: 'Battle in the Ruins',
    line: 'The city was bombed to rubble, then fought over house by house for months. In the ruins, German tanks and aircraft counted for far less.',
  },
  {
    topic: 'Operation Uranus',
    line: 'In November the Red Army struck the Romanian and Hungarian armies holding the flanks, not the Germans in the city. The two attacks met behind it and closed the ring.',
  },
  {
    topic: 'The Turning Point',
    line: 'Trapped and unsupplied, the Germans surrendered in February 1943. An entire German army was lost, and Germany never advanced east again.',
  },
];

/* ──────────────────────────────── state ──────────────────────────────── */

/** A label drawn on top of the board, already projected to the screen. Labels
 *  are DOM, never 3D text: they hold one readable size whatever the camera
 *  does, and they follow the easy-read font setting like every other word. */
export interface ScreenLabel {
  id: string;
  text: string;
  /** Percentages of the window. */
  left: number;
  top: number;
  /** Place names on the paper ('geo') read differently from the name tags
   *  under the pieces ('piece'). */
  kind: 'geo' | 'piece';
}

interface UranusState {
  phase: Phase;
  /** slot id → the piece seated in it. */
  placed: Record<string, PieceId>;
  /** Nikolai's last spoken line (a refusal or a nudge), and when it landed. */
  said: { text: string; at: number } | null;
  /** The caption under the board from the last correct drop. */
  caption: { text: string; at: number } | null;
  /** How far the scripted close has got — the scene drives this at milestones. */
  seal: 'idle' | 'sweeping' | 'draining' | 'sealed';
  labels: ScreenLabel[];
  /** Objectives this minigame has ticked (merged with the conversation's). */
  ticked: string[];

  reset: () => void;
  /** Seat a piece, or refuse it and say why. Returns whether it seated. */
  tryDrop: (pieceId: PieceId, slotId: string | null) => boolean;
  say: (text: string) => void;
  setLabels: (labels: ScreenLabel[]) => void;
  setSeal: (seal: UranusState['seal']) => void;
}

const fresh = () => ({
  phase: 'why' as Phase,
  placed: {} as Record<string, PieceId>,
  said: null,
  caption: null,
  seal: 'idle' as const,
  labels: [] as ScreenLabel[],
  ticked: [] as string[],
});

/** Speak one of Nikolai's lines through the same voice the conversation uses.
 *  Fire-and-forget and silent when no voice key is configured; an identical
 *  line twice in a row is not repeated, so a run of sloppy drops never turns
 *  into a stutter. */
let lastSpoken = '';
function speak(text: string) {
  if (!text || text === lastSpoken) return;
  lastSpoken = text;
  voicePlayer.speak(text, 'ch4');
}

export const useUranusStore = create<UranusState>((set, get) => ({
  ...fresh(),

  reset: () => {
    lastSpoken = '';
    voicePlayer.stop();
    set(fresh());
  },

  say: (text) => {
    if (!text) return;
    set({ said: { text, at: performance.now() } });
    speak(text);
  },

  tryDrop: (pieceId, slotId) => {
    const s = get();
    // let go over open table: a nudge toward the glowing places
    if (!slotId) {
      get().say(NOWHERE_LINE[s.phase]);
      return false;
    }
    const slot = slotById(slotId);
    // the wrong thing here, or a slot that refuses everything (the centre)
    if (!slot.accepts.includes(pieceId)) {
      get().say(slot.refuses ?? NOWHERE_LINE[s.phase]);
      return false;
    }

    const placed = { ...s.placed, [slotId]: pieceId };
    // a correct drop clears whatever Nikolai was last explaining
    const next: Partial<UranusState> = {
      placed,
      said: null,
      caption: slot.caption ? { text: slot.caption, at: performance.now() } : s.caption,
    };

    // Phase 1 is done when both places are marked; phase 2 when both flanks
    // are armed. Each hands the player the objective it just taught.
    const done = (ids: string[]) => ids.every((id) => placed[id]);
    if (s.phase === 'why' && done(['oilfield', 'river'])) {
      next.phase = 'strike';
      next.ticked = Array.from(new Set([...s.ticked, 'obj-why']));
    } else if (s.phase === 'strike' && done(['left-flank', 'right-flank'])) {
      next.phase = 'close';
      next.ticked = Array.from(new Set([...s.ticked, 'obj-trap']));
    } else if (s.phase === 'close' && done(['behind'])) {
      next.phase = 'sealed';
      next.seal = 'sweeping';
      next.ticked = Array.from(new Set([...s.ticked, 'obj-turn']));
    }
    set(next);
    return true;
  },

  setLabels: (labels) => set({ labels }),
  setSeal: (seal) => set({ seal }),
}));

/** Which pieces are at the table edge right now. Only ever the phase's own —
 *  nothing else is on the table waiting to be picked up. */
export function trayPieces(phase: Phase, placed: Record<string, PieceId>): Piece[] {
  const seated = new Set(Object.values(placed));
  return PIECES.filter((p) => p.phase === phase && !seated.has(p.id));
}

/** The slots that glow in this phase (a filled one stops glowing). */
export function liveSlots(phase: Phase, placed: Record<string, PieceId>): Slot[] {
  return SLOTS.filter((s) => s.phase === phase && !placed[s.id]);
}
