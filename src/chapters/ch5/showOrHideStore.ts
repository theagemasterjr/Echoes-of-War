'use client';
/**
 * Chapter 5 minigame — "Show it or hide it". State, board and every word the
 * player reads or hears.
 *
 * Before the landings the Allies had two jobs on their own coast, and the whole
 * game is telling them apart: some things were built to be SEEN (an army that
 * did not exist, opposite Calais) and some things were hidden (the real one,
 * gathering in the south-west). One question decides every piece — do you want
 * the Germans to see this? — and the board answers it on the French side: what
 * you do on your coast decides where the enemy looks on theirs.
 *
 * There is no score, no timer, no lose state and no penalty. A wrong drop slides
 * home and the player tries again; after two of them on the same piece Grace
 * offers the reasoning, never the answer. The game ends when all eight pieces
 * are placed.
 *
 * The board is the supplied map image (1672 × 941: southern England, the
 * Channel, northern France). Every position below is in MAP COORDINATES — u
 * across (0 = west edge, 1 = east), v down (0 = north edge, 1 = south) — read
 * off that image at its own pixel size, so the paper's aspect ratio must stay
 * exactly the image's or every one of them lands in the wrong place.
 */
import { create } from 'zustand';
import { voicePlayer } from '@/audio/voicePlayer';

/* ────────────────────────────── the board ────────────────────────────── */

/** The source image, and the paper it becomes on the tabletop. `d` is derived
 *  from the image's own aspect — never type a number in here that disagrees
 *  with the file, or the zones drift off their coastlines. */
export const MAP_PX = { w: 1672, h: 941 } as const;
export const MAP = {
  w: 9.6,
  d: (9.6 * MAP_PX.h) / MAP_PX.w,
  z: -1.5,
  y: 0.014,
} as const;

/** The pieces wait in ONE row below the map. Two rows cost too much table
 *  depth — the camera had to pull back far enough to shrink the board, and the
 *  front row's labels landed on the back row's pieces.
 *
 *  The row sits far enough back to leave a clear band between the paper's near
 *  edge and the first piece: that band is where the feedback strip lives, and
 *  it is the only reason this number is not smaller. */
export const TRAY_Z = 2.32;
/**
 * Where every feedback line is drawn, whichever piece earned it: the clear band
 * between the paper's near edge and the first piece in the tray.
 *
 * Above the map looks emptier but is not: the Kent pieces stand tall and their
 * tops rise past the paper's far edge, straight through where a strip up there
 * would sit. So the strip sits at the bottom of the paper instead, just inside
 * its near edge — over the empty southern border, below every piece and label
 * on the board and above the tray. A two-line line is the widest it ever gets
 * and it still clears the first piece in the tray.
 */
export const STRIP_Z = MAP.z + MAP.d / 2 - 0.18;
export const TRAY_GAP = 1.08;

export type MapPoint = readonly [u: number, v: number];

/** A point read off the source image in pixels → map coordinates. */
const px = (x: number, y: number): MapPoint => [x / MAP_PX.w, y / MAP_PX.h];

/** Map coordinates → table coordinates. */
export function mapToWorld([u, v]: MapPoint): [number, number, number] {
  return [(u - 0.5) * MAP.w, MAP.y, MAP.z + (v - 0.5) * MAP.d];
}

/* ──────────────────────────── zones and targets ─────────────────────────── */

export type ZoneId = 'conceal' | 'deceive';

export interface Zone {
  id: ZoneId;
  /** The instruction on the table, above the ring. */
  label: string;
  /** The real place it sits on. */
  subLabel: string;
  /** Centre, read off the outlined region on the map image. */
  at: MapPoint;
  /** Drop radius, in table units. Generous on purpose. */
  radius: number;
  /** The French coast this zone decides. */
  target: TargetId;
  /** Where this zone's column of seated-piece names hangs, relative to the
   *  centre of its ring (map units). Kent's is pushed west so the list runs
   *  down the open Channel instead of over the Pas de Calais marker. */
  listNudge: MapPoint;
  /** Where the zone's own name plate sits — INSIDE the outlined region, near
   *  its top. Read off the map image: the paper is cropped tight and Kent has
   *  no headroom above it, and both points clear the map's own printed place
   *  names ("Kent" at y 240, "South-West England" at y 285–325). */
  labelAt: MapPoint;
}

export type TargetId = 'normandy' | 'calais';

/**
 * The two outlined English regions. Centres and radii were read off the map
 * image with a pixel grid: the south-west region runs roughly x 150–670,
 * y 160–500, and Kent x 1125–1520, y 60–350, so a 150px ring centred in each
 * sits inside its own coastline.
 */
export const ZONES: Zone[] = [
  {
    id: 'conceal',
    label: 'Hide the real one',
    subLabel: 'South-West England',
    at: px(440, 302),
    radius: (150 / MAP_PX.w) * MAP.w,
    target: 'normandy',
    listNudge: [0, 0.13],
    labelAt: px(392, 178),
  },
  {
    id: 'deceive',
    label: 'Make them look here',
    subLabel: 'Kent',
    at: px(1310, 195),
    radius: (150 / MAP_PX.w) * MAP.w,
    target: 'calais',
    listNudge: [-0.105, 0.13],
    labelAt: px(1298, 78),
  },
];

export const zoneById = (id: ZoneId) => ZONES.find((z) => z.id === id)!;

/**
 * The two places on the French coast. Labels only — they are NOT drop targets.
 * A piece let go over one of them simply goes home, with nothing said: a
 * student trying France is asking a fair question, not making a mistake.
 */
export const TARGETS: { id: TargetId; label: string; at: MapPoint }[] = [
  { id: 'normandy', label: 'Normandy', at: px(990, 720) },
  { id: 'calais', label: 'Pas de Calais', at: px(1465, 590) },
];

export const targetById = (id: TargetId) => TARGETS.find((t) => t.id === id)!;

/** How close to a French marker counts as "dropped on France", in table units. */
export const TARGET_RADIUS = (150 / MAP_PX.w) * MAP.w;

/* ──────────────────────────────── the pieces ─────────────────────────────── */

export type PieceId =
  | 'inflatable-tank'
  | 'dummy-landing-craft'
  | 'fake-hq-sign'
  | 'radio-truck'
  | 'camouflage-netting'
  | 'sealed-camp-gate'
  | 'mail-sack'
  | 'blackout-screen';

export interface Piece {
  id: PieceId;
  assetId: string;
  zone: ZoneId;
  /** The name on the table, under the piece, from the moment it appears. Split
   *  in two so it can be drawn as a short name over a thin note and stay
   *  readable in a tray of eight. */
  name: string;
  note: string;
  /** The one line that appears when the piece lands in the right place. */
  feedback: string;
  /** Grace, after two wrong drops on this piece. The reasoning, never the
   *  answer — it re-asks the question rather than settling it. */
  nudge: string;
}

/**
 * Four that were meant to be seen, four that were meant to be hidden. The split
 * is never stated anywhere the player can read it, and the counter never hints
 * at it either.
 */
export const PIECES: Piece[] = [
  {
    id: 'inflatable-tank',
    assetId: 'ch5.piece.inflatable-tank',
    zone: 'deceive',
    name: 'Inflatable tank',
    note: 'rubber, left in an open field',
    feedback:
      'Left in an open field where German reconnaissance planes would photograph it. They reported an armoured division massing opposite Calais.',
    nudge: 'Nobody hides a tank in an open field. So ask yourself why anyone would leave one where it can be seen.',
  },
  {
    id: 'dummy-landing-craft',
    assetId: 'ch5.piece.dummy-landing-craft',
    zone: 'deceive',
    name: 'Dummy landing craft',
    note: 'plywood and canvas',
    feedback:
      'Plywood and canvas, moored in the Kent estuaries. From the air it read as a fleet waiting to sail for the shortest crossing.',
    nudge: 'Plywood will not cross the Channel. Think about who this one was built for — us, or someone looking down at it.',
  },
  {
    id: 'fake-hq-sign',
    assetId: 'ch5.piece.fake-hq-sign',
    zone: 'deceive',
    name: 'Headquarters sign',
    note: 'for an army that doesn’t exist',
    feedback:
      'A headquarters sign for an army that existed only on paper. German intelligence marked that army on their own maps and kept it there.',
    nudge: 'A sign is for reading. The question is who was meant to read this one.',
  },
  {
    id: 'radio-truck',
    assetId: 'ch5.piece.radio-truck',
    zone: 'deceive',
    name: 'Radio truck',
    note: 'broadcasting loud fake orders',
    feedback:
      'Busy orders sent in the clear from Kent, day after day. German listening stations counted the traffic and placed a whole army behind it.',
    nudge: 'Orders sent loud and in the clear are meant to be overheard. Ask who was listening.',
  },
  {
    id: 'camouflage-netting',
    assetId: 'ch5.piece.camouflage-netting',
    zone: 'conceal',
    name: 'Camouflage netting',
    note: 'over the real supply dumps',
    feedback:
      'Netting over the real supply dumps in the south-west. From above, the fuel and ammunition for the real landing looked like empty fields.',
    nudge: 'Netting goes over things. Ask what happens to whatever is underneath it.',
  },
  {
    id: 'sealed-camp-gate',
    assetId: 'ch5.piece.sealed-camp-gate',
    zone: 'conceal',
    name: 'Sealed camp',
    note: 'nobody in or out once briefed',
    feedback:
      'Once the men were told where they were going, nobody left the camps. What they knew could not travel out with them.',
    nudge: 'Once a man knows the plan, everything he says outside the gate carries it. Ask what the gate is for.',
  },
  {
    id: 'mail-sack',
    assetId: 'ch5.piece.mail-sack',
    zone: 'conceal',
    name: 'Censored post',
    note: 'letters home held back',
    feedback:
      'Letters home held back until after the landings. One careless line about where a unit was going could have undone the whole plan.',
    nudge: 'A letter home is a small thing until it says where you are going. Ask where this one was allowed to travel.',
  },
  {
    id: 'blackout-screen',
    assetId: 'ch5.piece.blackout-screen',
    zone: 'conceal',
    name: 'Blackout',
    note: 'the real ports load in darkness',
    feedback:
      'The real ports loaded at night behind blackout screens. What Germany could not see, it could not count.',
    nudge: 'Work in the dark and nobody can count what you loaded. Ask whether that is showing or hiding.',
  },
];

export const pieceById = (id: PieceId) => PIECES.find((p) => p.id === id)!;

/** The standing question. On screen from the moment the minigame opens, and it
 *  never leaves — it is the only rule the player needs. */
export const QUESTION = 'Ask one question about every piece: do you want the Germans to see this?';

/** The counter. Deliberately says how many are DONE and nothing else: never how
 *  many belong in a zone, never how many a zone still wants. */
export const counterText = (placed: number) => `${placed} of ${PIECES.length} placed`;

/* ─────────────────────── the German side of the map ─────────────────────── */

/**
 * The pin's walk along the French coast, read off the map: it starts undecided,
 * midway between the two French places, and every piece the player puts in the
 * deception zone nudges it further toward Calais. It only ever travels part of
 * the way while the game is being played — the last leg belongs to the payoff.
 */
export const PIN_PATH: MapPoint[] = [
  px(1245, 675), px(1300, 655), px(1355, 625), px(1410, 600), px(1462, 585),
];
/** The pin is named on the table like everything else — grey and anonymous. */
export const PIN_LABEL = 'German command';
/** How far along that path four correct deception drops take it. */
export const PIN_PLAY_MAX = 0.6;
export const pinTravel = (deceivePlaced: number) =>
  (PIN_PLAY_MAX * Math.min(deceivePlaced, 4)) / 4;

/**
 * Grey German division markers, spread along the French coast where they began
 * — some of them opposite Normandy. In the payoff they all slide north-east and
 * gather at Calais, which is what leaves the Normandy coast empty.
 */
export const DIVISIONS: { id: string; from: MapPoint; to: MapPoint }[] = [
  { id: 'div-1', from: px(905, 720), to: px(1420, 560) },
  { id: 'div-2', from: px(1015, 735), to: px(1470, 585) },
  { id: 'div-3', from: px(1125, 740), to: px(1420, 620) },
  { id: 'div-4', from: px(1235, 700), to: px(1475, 645) },
  { id: 'div-5', from: px(1335, 650), to: px(1500, 600) },
];

/** The Allied pieces that come ashore at Normandy once the coast is empty:
 *  from the Channel onto the beach. Markers moving on a map — nothing else. */
export const LANDINGS: { id: string; from: MapPoint; to: MapPoint }[] = [
  { id: 'land-1', from: px(880, 545), to: px(890, 690) },
  { id: 'land-2', from: px(945, 565), to: px(955, 705) },
  { id: 'land-3', from: px(1010, 585), to: px(1020, 715) },
  { id: 'land-4', from: px(1075, 605), to: px(1085, 720) },
];

/** Where the beachhead spreads from, and how wide it gets (table units). */
export const BEACHHEAD = { at: px(985, 730), radius: 0.95 } as const;

/* ─────────────────────────── the payoff, in seconds ─────────────────────── */

/**
 * The scripted close, timed from the eighth piece locking in. The player cannot
 * skip it and gives it no input; it must not outstay ten seconds.
 */
export const PAYOFF = {
  pinFrom: 0.2, pinTo: 2.0,
  divisionsFrom: 1.6, divisionsTo: 4.0,
  /** the beat where the Normandy coast is visibly bare, and simply held */
  emptyFrom: 4.0, emptyTo: 4.6,
  holdTo: 5.8,
  ashoreFrom: 5.8, ashoreTo: 7.8,
  beachheadFrom: 7.6, beachheadTo: 9.2,
  done: 9.6,
} as const;

/* ───────────────────────────── the closing card ──────────────────────────── */

export const CLOSING_CARD =
  'Germany kept its strongest reserves waiting at Calais for seven weeks after the landings — still expecting the real invasion.';

/* ──────────────────────────────── the shuffle ────────────────────────────── */

/**
 * A tray order that never looks pre-sorted. Three things are rejected: any run
 * of three or more pieces belonging to the same zone (which also rules out all
 * four of one type together), a strictly alternating pattern, and — implied by
 * the first — the sorted arrangements themselves. Everything else is fair.
 */
export function shufflePieces(rand: () => number = Math.random): Piece[] {
  const looksArranged = (order: Piece[]) => {
    let run = 1;
    let alternating = true;
    for (let i = 1; i < order.length; i++) {
      if (order[i].zone === order[i - 1].zone) {
        run++;
        alternating = false;
        if (run >= 3) return true;
      } else {
        run = 1;
      }
    }
    return alternating;
  };

  // fixed ceiling rather than `while (true)`: a shuffle can never hang the game
  for (let attempt = 0; attempt < 200; attempt++) {
    const order = PIECES.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (!looksArranged(order)) return order;
  }
  // unreachable in practice; a valid order exists in roughly nine draws in ten
  return PIECES.slice();
}

/* ──────────────────────────────── the state ──────────────────────────────── */

/** A label drawn over the board, already projected to the screen. Labels are
 *  DOM, never 3D text: one readable size whatever the camera does, and they
 *  follow the easy-read font setting like every other word in the game. */
export interface ScreenLabel {
  id: string;
  /** Bold first line. */
  text: string;
  /** Thin second line, when the label has one. */
  note?: string;
  left: number;
  top: number;
  kind: 'piece' | 'zone' | 'target' | 'pin';
  /** Targets dim as the real landing is concealed. */
  dim?: number;
  /** Row in a zone's list of placed pieces. Four name tags cannot fit inside one
   *  ring without landing on each other, so a seated piece is named in a tidy
   *  column under its zone instead of on top of the pile. */
  row?: number;
}

export type Stage = 'play' | 'payoff' | 'card';

interface ShowOrHideState {
  /** Tray order, shuffled once per visit. */
  order: PieceId[];
  /** piece id → the zone it is locked into. */
  placed: Partial<Record<PieceId, ZoneId>>;
  /** How many times each piece has been dropped in the wrong zone. */
  wrong: Partial<Record<PieceId, number>>;
  /** The piece that just bounced, so the scene can shake it. */
  refused: { id: PieceId; at: number } | null;
  /** The line a correct drop earned. */
  feedback: { text: string; at: number } | null;
  /** Grace's hint, after two wrong drops on one piece. */
  nudge: { text: string; at: number } | null;
  stage: Stage;
  labels: ScreenLabel[];
  /** Where the feedback strip sits, as a percentage down the window. Measured
   *  by the scene from the clear band between the paper's near edge and the
   *  first piece in the tray, so the strip follows the board at any window
   *  size instead of guessing a fixed offset. */
  stripTop: number;

  reset: () => void;
  /** Seat a piece, bounce it, or ignore it. Returns what happened. */
  tryDrop: (pieceId: PieceId, zoneId: ZoneId | null, onFrance: boolean) => DropResult;
  setStage: (stage: Stage) => void;
  setLabels: (labels: ScreenLabel[], stripTop: number) => void;
}

export type DropResult = 'placed' | 'wrong' | 'ignored';

const fresh = () => ({
  order: shufflePieces().map((p) => p.id),
  placed: {} as Partial<Record<PieceId, ZoneId>>,
  wrong: {} as Partial<Record<PieceId, number>>,
  refused: null,
  feedback: null,
  nudge: null,
  stage: 'play' as Stage,
  labels: [] as ScreenLabel[],
  stripTop: 62,
});

/** Grace's hints go through the same voice the conversation uses. Silent and
 *  harmless when no voice is configured for the chapter — the hint is on screen
 *  either way — and the same line is never spoken twice in a row. */
let lastSpoken = '';
function speak(text: string) {
  if (!text || text === lastSpoken) return;
  lastSpoken = text;
  voicePlayer.speak(text, 'ch5');
}

export const useShowOrHideStore = create<ShowOrHideState>((set, get) => ({
  ...fresh(),

  reset: () => {
    lastSpoken = '';
    voicePlayer.stop();
    set(fresh());
  },

  tryDrop: (pieceId, zoneId, onFrance) => {
    const s = get();
    if (s.placed[pieceId] || s.stage !== 'play') return 'ignored';

    // France, or open table: nothing happened. No message, no shake, and it
    // does not count against the player.
    if (!zoneId) {
      if (onFrance) set({ refused: null });
      return 'ignored';
    }

    const piece = pieceById(pieceId);
    if (piece.zone !== zoneId) {
      const wrongCount = (s.wrong[pieceId] ?? 0) + 1;
      set({
        wrong: { ...s.wrong, [pieceId]: wrongCount },
        refused: { id: pieceId, at: performance.now() },
        // the second miss on one piece earns the reasoning, never the answer
        nudge: wrongCount >= 2 ? { text: piece.nudge, at: performance.now() } : s.nudge,
      });
      if (wrongCount >= 2) speak(piece.nudge);
      return 'wrong';
    }

    const placed = { ...s.placed, [pieceId]: zoneId };
    const done = Object.keys(placed).length === PIECES.length;
    set({
      placed,
      refused: null,
      nudge: null,
      feedback: { text: piece.feedback, at: performance.now() },
      stage: done ? 'payoff' : 'play',
    });
    return 'placed';
  },

  setStage: (stage) => set({ stage }),
  setLabels: (labels, stripTop) => set({ labels, stripTop }),
}));

/* ────────────────────────────── board queries ────────────────────────────── */

/** The pieces still waiting below the map, in their shuffled order. */
export function trayPieces(order: PieceId[], placed: Partial<Record<PieceId, ZoneId>>): Piece[] {
  return order.filter((id) => !placed[id]).map(pieceById);
}

/** Where a tray piece sits: one row, centred, left to right. */
export function traySeat(index: number, count: number = PIECES.length): { x: number; z: number } {
  return { x: (index - (count - 1) / 2) * TRAY_GAP, z: TRAY_Z };
}

/** Where a placed piece stands inside its zone: a 2 × 2 cluster, in the order
 *  the player filled it, so nothing ever lands on top of anything else. */
export function zoneSeat(zone: Zone, indexInZone: number): [number, number, number] {
  const gap = zone.radius * 0.95;
  const col = indexInZone % 2;
  const row = Math.floor(indexInZone / 2) % 2;
  const [x, y, z] = mapToWorld(zone.at);
  // pushed into the lower half of the ring: the pieces stand tall, and the
  // zone's name plate now sits inside the region above them
  return [x + (col - 0.5) * gap, y, z + (row - 0.5) * gap + 0.34];
}

/** How many pieces are already seated in a zone (drives the cluster order). */
export function countIn(placed: Partial<Record<PieceId, ZoneId>>, zone: ZoneId): number {
  return Object.values(placed).filter((z) => z === zone).length;
}

/** The order a piece was seated within its zone. */
export function seatIndex(
  order: PieceId[],
  placed: Partial<Record<PieceId, ZoneId>>,
  pieceId: PieceId,
): number {
  const zone = placed[pieceId];
  if (!zone) return 0;
  // seat order follows the tray order, so a piece never jumps seats when a
  // later one lands beside it
  return order.filter((id) => placed[id] === zone).indexOf(pieceId);
}
