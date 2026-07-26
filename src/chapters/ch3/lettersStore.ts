'use client';
/**
 * Chapter 3 "Letters of December" minigame state — shared between the 3D
 * tabletop scene (inside the Canvas) and the DOM HUD (banner, the opened
 * letter, the score screen).
 *
 * Three rounds, one per thing Ray has just explained: why Japan went to war,
 * what Japan's target was, why America joined the war. Each round lays FOUR
 * sealed documents on the war-room table. They are the same registry prop
 * rendered four times, so nothing about a document's look can leak the answer
 * — the only way to tell them apart is to open one and read it. Exactly one is
 * historically accurate; the other three are convincing fakes, each wrong in
 * one specific, teachable way. Score = rounds got right on the FIRST commit.
 *
 * The history these documents rest on, which every line here must hold to:
 * Japan's decision was driven by the oil embargo and asset freeze, the failed
 * talks in Washington, and its war in China — the Tripartite Pact did not
 * oblige Japan to attack anyone and Germany gave no order. The strike force
 * flew from aircraft carriers north of Oahu, not from Japan. The target was
 * the US Pacific Fleet, not Honolulu's civilians, and no invasion force came.
 * America's 8 December declaration named Japan only; Germany and Italy
 * declared war on America on 11 December, and America answered the same day.
 */
import { create } from 'zustand';

export interface LetterDoc {
  id: string;
  /** The one historically accurate document in its round. */
  real: boolean;
  /** The document's full text — what the player reads, and what the voice
   *  reads aloud. Verbatim content: never reword without a history check. */
  text: string;
  /** Wrong documents only: the one calm line that teaches what is off. */
  correction?: string;
}

export interface LetterRound {
  id: string;
  /** Small label above the banner ("Round 1 of 3" is added by the HUD). */
  eyebrow: string;
  /** The question the round asks, shown across the top of the table. */
  banner: string;
  /**
   * The ONE registry asset all four documents in this round use. Rendering the
   * same prop four times is the point: identical props mean the player must
   * read to decide. Swapping the model is a registry edit, never a code edit.
   */
  assetId: string;
  docs: LetterDoc[];
  /** Shown when the real one is committed — why it is the true document. */
  why: string;
  /** The round's heading on the score screen, above its takeaway line. */
  topic: string;
  /** One plain line for the score screen's takeaway list. */
  takeaway: string;
  /**
   * The learning point in src/content/trees/ch3.ts this round tests. NOTHING
   * in this minigame may exist without one: the player is only ever asked
   * about things the character has already explained.
   */
  teachesPointId: string;
}

export const ROUNDS: LetterRound[] = [
  {
    id: 'r1',
    eyebrow: 'Tokyo · 1 December 1941',
    banner: `Four copies of a secret government paper were found in Tokyo, dated 1 December 1941. Only one is real. Which document gives Japan's true reasons for war?`,
    assetId: 'ch3.doc.decree',
    teachesPointId: 'oil',
    why: 'Japan chose war for its own reasons: no oil, talks that had failed, and a war in China it could not stop feeding.',
    topic: 'Why Japan went to war',
    takeaway:
      'Japan struck because America had cut off its oil, the talks in Washington had failed, and its war in China had to be fed.',
    docs: [
      {
        id: 'r1-real',
        real: true,
        text: `IMPERIAL GOVERNMENT OF JAPAN — STRICTLY SECRET. 1 December 1941. The Council has resolved on war with the United States, Britain and the Netherlands. America has frozen our funds and cut off the oil on which our fleet and industry depend. Our reserves shrink by the day, while our war in China consumes more of everything. The talks in Washington have failed: America demands we abandon what we have taken. To the south lie the oil and rubber our empire requires. One force can stop us from seizing them — the American Pacific Fleet. It must be struck before it can sail.`,
      },
      {
        id: 'r1-a',
        real: false,
        text: `IMPERIAL GOVERNMENT OF JAPAN — STRICTLY SECRET. 1 December 1941. Under the terms of our pact with Germany and Italy, Berlin has commanded the Empire to open war upon the United States at once. Our treaty leaves us no choice: when Germany calls, Japan must answer. Our armies will therefore march not for Japan's needs but for Germany's victory in Europe, and the Führer's staff shall direct the timing of our attack. All questions of oil, trade and the China war are secondary to our obligations to Berlin.`,
        correction: `The pact with Germany didn't order Japan to attack anyone — Japan decided on war for its own reasons: the oil embargo and its empire in Asia.`,
      },
      {
        id: 'r1-b',
        real: false,
        text: `IMPERIAL GOVERNMENT OF JAPAN — STRICTLY SECRET. 1 December 1941. Our agents confirm that an American invasion fleet will land troops on our home islands within six weeks. Their armies gather in Hawaii for the conquest of Japan itself. We do not choose this war; it has been forced upon us by an enemy already at our gates. We strike now only so that American soldiers never set foot upon our sacred soil. There is no question of oil, trade or territory — this is a war of pure self-defense against imminent invasion.`,
        correction:
          'America had no plan to invade Japan in 1941 — it was pressuring Japan with an oil embargo, not an invasion fleet.',
      },
      {
        id: 'r1-c',
        real: false,
        text: `IMPERIAL GOVERNMENT OF JAPAN — STRICTLY SECRET. 1 December 1941. The hour has come for the Empire's greatest undertaking: the conquest and occupation of the United States of America. Our soldiers shall raise our flag first over Hawaii, then over California, and march at last upon Washington itself. Oil and trade matter nothing beside this destiny. Let every commander prepare his men for a long campaign across the American continent, for we shall not rest until all of North America lies within the Empire.`,
        correction:
          'Japan never planned to conquer America — it wanted to knock out the Pacific Fleet, seize resource-rich territory in Asia, and force America to accept it.',
      },
    ],
  },
  {
    id: 'r2',
    eyebrow: 'First Air Fleet · 7 December 1941',
    banner:
      'Four strike-mission folders were prepared for the pilots of the carrier fleet, 7 December 1941. Only one is the real briefing. Which one names the true plan and target?',
    assetId: 'ch3.doc.folder',
    teachesPointId: 'sunday',
    why: 'The carriers waited north of Oahu, and their planes struck the warships and airfields at Pearl Harbor.',
    topic: 'What Japan’s target was',
    takeaway:
      'The target was the American Pacific Fleet at anchor in Pearl Harbor, hit by planes flown from carriers north of Oahu.',
    docs: [
      {
        id: 'r2-real',
        real: true,
        text: `FIRST AIR FLEET — STRIKE ORDER. 7 December 1941. At dawn our carriers will hold position some two hundred miles north of the island of Oahu. All squadrons will launch at first light and fly south. Your target is the United States Pacific Fleet, lying at anchor at Pearl Harbor, Hawaii. Priority to the battleships along their moorings, then the airfields, so no fighter rises to meet you. It is Sunday morning; the fleet rests in harbor. Strike hard, return to the carriers, and the Pacific is open to the Empire.`,
      },
      {
        id: 'r2-a',
        real: false,
        text: `FIRST AIR FLEET — STRIKE ORDER. 7 December 1941. Squadrons will take off from airfields in the home islands of Japan and fly without stopping across the whole Pacific Ocean. Your target is the American naval yards at San Francisco, on the coast of California. After bombing, continue inland and land at captured airstrips in the American desert. No carriers take part in this operation; the entire strike flies from Japan itself. Fuel discipline is essential on the twelve-thousand-kilometer route.`,
        correction: `No plane of 1941 could fly from Japan to America and back — that's why the real strike launched from aircraft carriers sailed close to Hawaii.`,
      },
      {
        id: 'r2-b',
        real: false,
        text: `FIRST AIR FLEET — STRIKE ORDER. 7 December 1941. Our carriers now stand off the coast of Central America. At first light all squadrons will launch against the Panama Canal, the great waterway joining the Atlantic and Pacific oceans. Destroy its locks and gates so completely that no American warship may pass between the two oceans for years. The American battle fleet itself is to be ignored entirely; it is the Canal, not the ships, that this Empire fears. Return to the carriers upon completion.`,
        correction: `The target was the Pacific Fleet itself at Pearl Harbor, Hawaii — sink the ships and the canal wouldn't matter.`,
      },
      {
        id: 'r2-c',
        real: false,
        text: `FIRST AIR FLEET — STRIKE ORDER. 7 December 1941. At dawn, launch all squadrons against the city of Honolulu. Your targets are its streets, markets and homes; the warships in the harbor nearby are to be left untouched. The purpose of this raid is terror alone — to break the spirit of the American people so completely that their government surrenders within the week. Behind the bombers, troop ships carry an army that will land and occupy the Hawaiian islands permanently for the Empire.`,
        correction:
          'The raid was aimed at warships and military airfields, not the city — and no invasion force came to occupy Hawaii.',
      },
    ],
  },
  {
    id: 'r3',
    eyebrow: 'Washington · December 1941',
    banner: `Four declarations of war were printed in Washington in December 1941. Only one is the real one. Which is America's true declaration?`,
    assetId: 'ch3.doc.envelope',
    teachesPointId: 'infamy',
    why: 'Congress declared war on Japan the day after the attack — Germany and Italy declared war on America three days later.',
    topic: 'Why America joined the war',
    takeaway:
      'America declared war because Japan attacked Pearl Harbor — and on 8 December it declared war on Japan alone.',
    docs: [
      {
        id: 'r3-real',
        real: true,
        text: `JOINT RESOLUTION OF THE CONGRESS OF THE UNITED STATES. 8 December 1941. Whereas on yesterday's date, 7 December 1941, the Empire of Japan committed unprovoked and dastardly attacks upon the United States at Pearl Harbor, Hawaii, and upon its forces across the Pacific: the Congress hereby declares that a state of war exists between the United States and the Empire of Japan. The President is directed to carry the war to victory with all the resources of the country. Passed by the Senate and the House with but a single vote against.`,
      },
      {
        id: 'r3-a',
        real: false,
        text: `JOINT RESOLUTION OF THE CONGRESS OF THE UNITED STATES. 8 December 1941. In answer to the attack upon Pearl Harbor, the Congress hereby declares war this same day upon the Empire of Japan, upon Germany, and upon Italy together, judging the three powers to be one enemy from the first hour. Let no separate declarations follow, for all three states stand condemned by yesterday's attack alike, and American arms shall move against Berlin and Rome as swiftly as against Tokyo.`,
        correction:
          'On December 8 America declared war on Japan only — Germany and Italy declared war on America three days later, on December 11, and America answered them the same day.',
      },
      {
        id: 'r3-b',
        real: false,
        text: `JOINT RESOLUTION OF THE CONGRESS OF THE UNITED STATES. 8 December 1941. Whereas German submarines have this month sunk the passenger liners of neutral America upon the Atlantic, drowning her citizens at sea, and whereas no attack of any kind has occurred upon American territory: the Congress declares war upon Germany alone. Of Japan this resolution says nothing, for the Empire of Japan has offered the United States no injury, and the Pacific remains at perfect peace.`,
        correction: `America's declaration answered a direct attack on American soil — Pearl Harbor — not sinkings at sea, and the Pacific was anything but at peace.`,
      },
      {
        id: 'r3-c',
        real: false,
        text: `JOINT RESOLUTION OF THE CONGRESS OF THE UNITED STATES. 3 September 1939. Whereas Germany has invaded the nation of Poland, the Congress declares that a state of war exists between the United States and Germany, effective this day, alongside the declarations of Britain and France. America enters this European war at its very first hour, two years before any quarrel with Japan, whose empire remains a friend of the United States.`,
        correction:
          'America stayed out of the war in 1939 — it joined more than two years later, only after Japan attacked Pearl Harbor.',
      },
    ],
  },
];

export const docById = (id: string): LetterDoc =>
  ROUNDS.flatMap((r) => r.docs).find((d) => d.id === id)!;

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

/** Which document lies in which slot, left → right. Reshuffled for every round
 *  and every replay, so the real one's place on the table is never learnable. */
const dealt = (roundIndex: number) => shuffle(ROUNDS[roundIndex].docs.map((d) => d.id));

interface LettersState {
  /** 0-based round the player is on. */
  roundIndex: number;
  /** Doc ids in table order (left → right) for the current round. */
  slots: string[];
  /** The document lifted off the table and being read, if any. */
  openId: string | null;
  /** Committed-and-wrong this round: dimmed, ringed red, un-committable. */
  ruledOut: string[];
  /** The last document ruled out — its correction stays on screen. */
  lastWrongId: string | null;
  /** Set once the real document has been committed this round. */
  solvedId: string | null;
  /** Commits made this round — only the first one can score. */
  attempts: number;
  /** Rounds got right on the first commit, out of ROUNDS.length. */
  score: number;
  /** 'rounds' while playing, 'score' once round 3 has been answered. */
  stage: 'rounds' | 'score';

  open: (id: string) => void;
  close: () => void;
  /** Commit to a document as the real one. Wrong commits never end the round. */
  commit: (id: string) => void;
  /** Leave a solved round: the next round, or the score screen after the last. */
  nextRound: () => void;
  reset: () => void;
}

const freshRound = (roundIndex: number) => ({
  roundIndex,
  slots: dealt(roundIndex),
  openId: null,
  ruledOut: [] as string[],
  lastWrongId: null,
  solvedId: null,
  attempts: 0,
});

const fresh = () => ({ ...freshRound(0), score: 0, stage: 'rounds' as const });

export const useLettersStore = create<LettersState>((set, get) => ({
  ...fresh(),

  open: (id) => {
    if (get().stage !== 'rounds') return;
    set({ openId: id });
  },

  close: () => set({ openId: null }),

  commit: (id) => {
    const s = get();
    // a solved round, a ruled-out document and the score screen all ignore
    // commits — the player can still read anything they like
    if (s.stage !== 'rounds' || s.solvedId || s.ruledOut.includes(id)) return;
    const doc = docById(id);
    const attempts = s.attempts + 1;
    if (doc.real) {
      set({
        solvedId: id,
        attempts,
        openId: null,
        // ONLY the first commit of a round can score
        score: s.score + (attempts === 1 ? 1 : 0),
      });
    } else {
      set({ ruledOut: [...s.ruledOut, id], lastWrongId: id, attempts });
    }
  },

  nextRound: () => {
    const s = get();
    if (s.roundIndex >= ROUNDS.length - 1) {
      set({ stage: 'score', openId: null });
      return;
    }
    set(freshRound(s.roundIndex + 1));
  },

  reset: () => set(fresh()),
}));
