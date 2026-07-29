import { create } from 'zustand';
import { voicePlayer } from '@/audio/voicePlayer';

/**
 * Chapter 6 minigame — "The Voices". All rules, layout numbers and EVERY word
 * of player-facing text live here; the 3D board (VoicesScene) and the DOM
 * layer (VoicesMinigame) only read this file.
 *
 * The game: four objects stand on the war table, each standing for a person
 * who lived through the same events from a different position. Nine paper
 * slips carry things those people said, dealt one at a time from a stack at
 * the near edge. The player gives each slip to whoever said it. Eight slips
 * have a home. The ninth does not — every piece refuses it, and its place is
 * the centre of the table, under the paper crane. That ending is the reason
 * the minigame exists, and it is deliberately quiet: no celebration, no
 * chime, no confetti. The warm light and the silence are the payoff.
 *
 * ⚠ TONE. This chapter carries the strictest rules in the app (see
 * src/content/trees/ch6.ts TONE_RULES): no casualty figures, no injury
 * detail, no first-person account of the blast, no verdict on whether the
 * bombings were justified. Every line below was written against those rules —
 * edit with the same care. The four figures are fictional composites; no line
 * of text here may name a real individual.
 *
 * All four voices' labels, the slip quotes, the feedback and the nudges are
 * drawn in-game (DOM), never baked into a texture or a model.
 */

/* ── the table ─────────────────────────────────────────────────────── */

/** Where things stand, in table units. Camera is pinned by the registry row's
 *  `minigameCamera`; these numbers are composed for that shot. */
export const BOARD = {
  /** four pieces around a clear centre */
  farZ: -1.85,
  nearZ: 0.15,
  sideX: 2.6,
  /** the slip stack, near edge, closest to the player */
  stackZ: 2.35,
  /** the centre of the table — empty until the very end */
  centre: [0, -0.85] as const,
  /** drop radius around each piece (generous on purpose) and the centre */
  pieceRadius: 1.05,
  centreRadius: 0.8,
  /** kept for reference: the feedback strip is NOT projected from the board —
   *  it lives in the fixed top band (see LabelProjector), the one region that
   *  stays clear of models, labels, stack and card at every window size */
  stripZ: 1.62,
  /** how high a held slip rides */
  lift: 0.3,
} as const;

/* ── the four voices ───────────────────────────────────────────────── */

export type VoiceId = 'soldier' | 'civilian' | 'scientist' | 'leader';

export interface Voice {
  id: VoiceId;
  assetId: string;
  /** table position [x, z] */
  at: readonly [number, number];
  /** label line 1 */
  label: string;
  /** label line 2 — what makes the game solvable rather than guesswork */
  sub: string;
}

export const VOICES: Voice[] = [
  { id: 'soldier', assetId: 'ch6.piece.helmet-pack', at: [-BOARD.sideX, BOARD.farZ], label: 'The soldier', sub: 'An American soldier in the Pacific' },
  { id: 'civilian', assetId: 'ch6.piece.lantern', at: [BOARD.sideX, BOARD.farZ], label: 'The civilian', sub: 'A resident of Hiroshima' },
  { id: 'scientist', assetId: 'ch6.piece.slide-rule', at: [-BOARD.sideX, BOARD.nearZ], label: 'The scientist', sub: 'One of the people who built it' },
  { id: 'leader', assetId: 'ch6.piece.pen-document', at: [BOARD.sideX, BOARD.nearZ], label: 'The leader', sub: 'An Allied leader who decided' },
];

export const voiceById = (id: VoiceId): Voice => VOICES.find((v) => v.id === id)!;

/* ── the nine slips ────────────────────────────────────────────────── */

export type SlipId =
  | 'soldier-europe' | 'soldier-okinawa'
  | 'civilian-allclear' | 'civilian-spared'
  | 'scientist-test' | 'scientist-demo'
  | 'leader-terms' | 'leader-estimates'
  | 'ninth';

export interface Slip {
  id: SlipId;
  /** who said it — null for the ninth, which belongs to no one piece */
  voice: VoiceId | null;
  text: string;
  /** one calm line on a correct placement. The ninth has none: silence is
   *  correct there. */
  feedback: string | null;
}

export const SLIPS: Slip[] = [
  // The soldier — his first slip is always dealt first (see shuffleOrder)
  {
    id: 'soldier-europe', voice: 'soldier',
    text: '“We finished the war in Europe and were told we were being sent the other way.”',
    feedback: 'Germany surrendered in May 1945. American units were being moved from Europe towards the Pacific, where the war had not stopped.',
  },
  {
    id: 'soldier-okinawa', voice: 'soldier',
    text: '“I fought on Okinawa. Nobody who was there believed the mainland would be easier.”',
    feedback: 'Okinawa was the last major battle before the bombings, and one of the hardest of the war. It shaped what commanders expected an invasion of Japan to be.',
  },
  // The civilian
  {
    id: 'civilian-allclear', voice: 'civilian',
    text: '“The all-clear had already sounded. We were going to work.”',
    feedback: 'An alert earlier that morning had been lifted. The city was going about an ordinary Monday.',
  },
  {
    id: 'civilian-spared', voice: 'civilian',
    text: '“Other cities had burned for months. Ours had barely been touched.”',
    feedback: 'Hiroshima had been largely spared conventional bombing. That was part of why it was chosen.',
  },
  // The scientist
  {
    id: 'scientist-test', voice: 'scientist',
    text: '“We watched it work once, in a desert, before anyone chose where it would go.”',
    feedback: 'The first and only test took place in New Mexico in July 1945, weeks before Hiroshima.',
  },
  {
    id: 'scientist-demo', voice: 'scientist',
    text: '“Some of us asked whether a demonstration might be enough.”',
    feedback: 'A group of the scientists who built it argued for demonstrating the weapon somewhere uninhabited first. The argument was made, and it was rejected.',
  },
  // The leader
  {
    id: 'leader-terms', voice: 'leader',
    text: '“We set out our terms in July, and told them plainly what refusing would mean.”',
    feedback: 'The Allies demanded surrender in July 1945 and stated the consequences of refusal. Japan’s government gave no formal reply.',
  },
  {
    id: 'leader-estimates', voice: 'leader',
    text: '“Every estimate on my desk said an invasion would cost more than every landing we had already made.”',
    feedback: 'An invasion of Japan was planned for the autumn. The estimates put in front of Allied leaders were larger than anything already attempted.',
  },
  // The ninth. It has no home among the four — that is the point of the whole
  // thing — and no feedback line. See the finale.
  {
    id: 'ninth', voice: null,
    text: '“None of us went back to the world we had before.”',
    feedback: null,
  },
];

export const slipById = (id: SlipId): Slip => SLIPS.find((s) => s.id === id)!;

/* ── wrong-drop nudges ─────────────────────────────────────────────── */

/** Shown when a normal slip lands on the wrong piece: a hint about the PIECE
 *  it was dropped on — position, never scolding, never the answer. The ninth
 *  slip never gets one: its refusals are silent on purpose. */
export const NUDGES: Record<VoiceId, string> = {
  soldier: 'He was waiting for something that never came.',
  civilian: 'She was not told anything. She was simply there.',
  scientist: 'He knew what it could do before he knew where it would go.',
  leader: 'He was never in the city, or on the ship.',
};

/* ── the ending ────────────────────────────────────────────────────── */

/** Fades in only if the player still has not found the centre ~20 s after the
 *  first refusal of the ninth slip. A hint, not an instruction. */
export const NINTH_FALLBACK = 'Some things were not said by one person.';

/** The one line of the finale, after the three-second hold. */
export const FINAL_LINE = 'Four people. One morning. The same sentence.';

/** The standing instruction — one quiet line, taught once. */
export const INSTRUCTION = 'Drag each slip to the person who said it.';
/** Extra teaching line under the first slip only: the no-drag path. */
export const TAP_HINT = 'Or tap the slip, then tap the person.';

/* ── finale timeline (seconds from the ninth slip settling) ────────── */

/** Normal-motion timings. The hold (lights on, nothing moving, NO UI of any
 *  kind) is a full three seconds — that is the payoff, do not shorten it. */
export const FINALE = {
  craneFrom: 0.2, craneTo: 1.8, // the crane rises into the light
  lightsAt: 2.0, //   all four pieces light AT ONCE
  holdTo: 5.0, //     3.0 s of stillness, screen clear of every UI element
  lineAt: 5.0, //     "Four people. One morning. The same sentence."
  continueAt: 7.6, // the continue control fades in
} as const;

/** Reduced motion: the crane and the lights simply appear. The three-second
 *  hold and the line are kept — they are stillness, not motion. */
export const FINALE_REDUCED = {
  craneFrom: 0, craneTo: 0.01,
  lightsAt: 0.2,
  holdTo: 3.2,
  lineAt: 3.2,
  continueAt: 5.2,
} as const;

/** ~20 s after the first refusal, the fallback line fades in. */
export const NINTH_HINT_MS = 20000;
/** The quiet beat between the eighth slip settling and the ninth appearing. */
export const NINTH_DEAL_MS = 1600;

/* ── shuffle ───────────────────────────────────────────────────────── */

/** The soldier's first slip is always dealt first, to teach the mechanic on
 *  the easiest one. The remaining seven shuffle. The ninth is always last. */
export function shuffleOrder(rand: () => number = Math.random): SlipId[] {
  const middle: SlipId[] = [
    'soldier-okinawa', 'civilian-allclear', 'civilian-spared',
    'scientist-test', 'scientist-demo', 'leader-terms', 'leader-estimates',
  ];
  for (let i = middle.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [middle[i], middle[j]] = [middle[j], middle[i]];
  }
  return ['soldier-europe', ...middle, 'ninth'];
}

/* ── screen labels (projected by the scene, drawn by the DOM) ──────── */

export interface ScreenLabel {
  id: string;
  /** Bold first line. */
  text: string;
  /** Thin second line, when the label has one. */
  note?: string;
  left: number;
  top: number;
  /** fade-in order as the game opens, left to right */
  order: number;
}

/* ── the store ─────────────────────────────────────────────────────── */

export type Stage = 'play' | 'ninth' | 'finale';

export type DropTarget = VoiceId | 'centre' | null;
export type DropResult = 'placed' | 'wrong' | 'ignored' | 'finale';

interface VoicesState {
  /** Deal order, shuffled once per visit; slips are dealt one at a time. */
  order: SlipId[];
  /** How many slips are seated (the current slip is order[placedCount]). */
  placedCount: number;
  /** Whether the ninth slip has been dealt yet (stage 'ninth'). */
  stage: Stage;
  /** The slip that just bounced, so the scene can shake it. */
  refused: { id: SlipId; at: number } | null;
  /** The line a correct placement earned. */
  feedback: { text: string; at: number } | null;
  /** The nudge a wrong drop earned (normal slips only — never the ninth). */
  nudge: { text: string; at: number } | null;
  /** Tap-to-place: the current slip is picked up, waiting for a second tap. */
  selected: boolean;
  /** When the board reached the ninth-slip stage (all eight placed) — the
   *  centre glow's clock: it appears the moment the eighth slip is placed,
   *  showing where the last one belongs. */
  ninthAt: number | null;
  /** When the ninth slip was first refused — the ~20 s clock for the
   *  fallback line. */
  ninthRefusedAt: number | null;
  /** When the ninth slip settled at the centre — the finale clock's zero. */
  finaleAt: number | null;
  labels: ScreenLabel[];
  /** Where the feedback strip sits, as a percentage down the window. */
  stripTop: number;

  reset: () => void;
  /** Seat the current slip, bounce it, or ignore it. */
  tryDrop: (target: DropTarget) => DropResult;
  setSelected: (v: boolean) => void;
  setLabels: (labels: ScreenLabel[], stripTop: number) => void;
  /** Debug only (typed "ninth" in the minigame): jump straight to the
   *  ninth-slip state so the ending can be tested without playing the board. */
  jumpToNinth: () => void;
}

const fresh = () => ({
  order: shuffleOrder(),
  placedCount: 0,
  stage: 'play' as Stage,
  refused: null,
  feedback: null,
  nudge: null,
  selected: false,
  ninthAt: null,
  ninthRefusedAt: null,
  finaleAt: null,
  labels: [] as ScreenLabel[],
  stripTop: 66,
});

/** Dr. Hale's chapter voice reads the slips, feedback and nudges. Silent
 *  and harmless when no voice is configured — the text is on screen either
 *  way — and the same line is never spoken twice in a row. */
let lastSpoken = '';
export function speak(text: string) {
  if (!text || text === lastSpoken) return;
  lastSpoken = text;
  voicePlayer.speak(text.replace(/[“”]/g, ''), 'ch6');
}

/** A line that is in no hurry: if the voice is mid-sentence, wait for it to
 *  finish (plus a small breath) instead of cutting it off. A new speak() —
 *  the player acted — always outranks whatever is waiting here. Without this,
 *  the next slip's quote used to interrupt the feedback line halfway through,
 *  on a timer, while the player was doing nothing. */
let waitingLine: string | null = null;
let waitingSub: (() => void) | null = null;
function speakWhenQuiet(text: string) {
  if (!text) return;
  if (!voicePlayer.speaking) {
    speak(text);
    return;
  }
  waitingLine = text;
  if (!waitingSub) {
    waitingSub = voicePlayer.subscribe((e) => {
      if (e !== 'end' || !waitingLine) return;
      const line = waitingLine;
      waitingLine = null;
      setTimeout(() => {
        if (!voicePlayer.speaking) speak(line);
      }, 650);
    });
  }
}

export const useVoicesStore = create<VoicesState>((set, get) => ({
  ...fresh(),

  reset: () => {
    lastSpoken = '';
    waitingLine = null;
    voicePlayer.stop();
    set(fresh());
  },

  tryDrop: (target) => {
    const s = get();
    if (s.finaleAt) return 'ignored';
    const slipId = s.order[s.placedCount];
    if (!slipId) return 'ignored';
    const slip = slipById(slipId);

    // open table: the slip just goes home, with nothing said
    if (!target) {
      set({ selected: false });
      return 'ignored';
    }

    /* ── the ninth slip ── */
    if (s.stage === 'ninth') {
      if (target === 'centre') {
        // the crane rises, the slip settles beneath it, the finale begins
        waitingLine = null;
        set({ finaleAt: performance.now(), selected: false, feedback: null, nudge: null });
        voicePlayer.stop();
        return 'finale';
      }
      // every piece refuses it — the same shake as a wrong drop, but with no
      // nudge line at all. Silence is correct here. The first refusal starts
      // the centre glow (and the ~20 s fallback clock).
      set({
        refused: { id: slipId, at: performance.now() },
        selected: false,
        ninthRefusedAt: s.ninthRefusedAt ?? performance.now(),
      });
      return 'wrong';
    }

    /* ── the eight ordinary slips ── */
    if (target === 'centre') {
      // nothing stands at the centre during play; the slip goes quietly home
      set({ selected: false });
      return 'ignored';
    }
    if (slip.voice !== target) {
      const nudge = NUDGES[target];
      set({
        refused: { id: slipId, at: performance.now() },
        nudge: { text: nudge, at: performance.now() },
        selected: false,
      });
      speak(nudge);
      return 'wrong';
    }

    const placedCount = s.placedCount + 1;
    waitingLine = null; // the player acted — whatever was waiting is stale
    set({
      placedCount,
      selected: false,
      refused: null,
      feedback: slip.feedback ? { text: slip.feedback, at: performance.now() } : null,
      nudge: null,
    });
    if (slip.feedback) speak(slip.feedback);
    if (placedCount === 8) {
      // brief pause; the board is quiet; then the ninth appears at the stack.
      // Its quote waits for the feedback line to finish — never cuts it off.
      setTimeout(() => {
        const now = get();
        if (now.placedCount === 8 && now.stage === 'play' && !now.finaleAt) {
          set({ stage: 'ninth', ninthAt: performance.now(), feedback: null, nudge: null });
          speakWhenQuiet(slipById('ninth').text);
        }
      }, NINTH_DEAL_MS);
    } else {
      // read the next slip to the player once the feedback has been said in
      // full — the wait is for the voice, not a fixed timer (a fixed timer is
      // what used to cut long feedback lines off mid-sentence)
      const next = get().order[placedCount];
      if (next && next !== 'ninth') setTimeout(() => {
        const now = get();
        if (now.placedCount === placedCount && !now.finaleAt) speakWhenQuiet(slipById(next).text);
      }, 2600); // by now the feedback clip is playing (or has failed silently)
    }
    return 'placed';
  },

  setSelected: (selected) => {
    if (get().finaleAt) return;
    set({ selected });
  },

  setLabels: (labels, stripTop) => set({ labels, stripTop }),

  jumpToNinth: () => {
    const s = get();
    if (s.stage !== 'play' || s.finaleAt) return;
    waitingLine = null;
    voicePlayer.stop();
    set({
      placedCount: 8,
      stage: 'ninth',
      ninthAt: performance.now(),
      selected: false,
      refused: null,
      feedback: null,
      nudge: null,
    });
  },
}));
