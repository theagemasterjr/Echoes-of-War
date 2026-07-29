import type { ChapterId } from '@/chapters/types';

/**
 * The constraint tree is a chapter character's entire definition: persona,
 * knowledge boundaries, and the staged route the conversation must travel.
 * Founders edit these files (src/content/trees/*) — never engine code.
 * Nodes are pure data, so a future feature can generate a node from
 * conversation history without touching the engine.
 */
export interface ConstraintTree {
  version: 1;
  chapterId: ChapterId;
  persona: {
    name: string;
    role: string;
    date: string;
    location: string;
    /** Diction, tone, emotional register instructions. */
    voice: string;
    background: string;
  };
  knowledge: {
    knows: string[];
    doesNotKnow: string[];
    /** How to stay in character when probed at the boundaries. */
    deflectionStyle: string;
  };
  /** Pre-written in-character greeting returned WITHOUT an AI call when the
   *  chapter opens (same wording every visit, so its voice audio caches too).
   *  Omit it and the server falls back to generating one with the model. */
  intro?: string;
  /** Pre-written in-character lines returned WITHOUT an AI call when input screening trips. */
  deflections: {
    abusive: string;
    aiProbe: string;
    busy: string;
  };
  entryNodeId: string;
  nodes: Record<string, StageNode>;
  /** Learner-facing objectives shown as a checklist; each checks off from the
   *  player's own words, and (where the row lists `pointIds`) from the
   *  character's answers too. */
  objectives?: ObjectiveDef[];
}

/**
 * One row of the on-screen Objectives panel. It checks off two ways, and a row
 * never un-checks once ticked:
 *
 *  1. The PLAYER says one of its `keywords` (client-side, instant). The lists
 *     are broad on purpose — every everyday way a kid might put the idea, not
 *     just the textbook words.
 *  2. The CHARACTER covers every learning point in `pointIds` (the same
 *     coverage the engine already grades — see server/coverage.ts, which judges
 *     substance, so an idea explained in wording nobody listed still counts).
 *     This is what catches the player who asks in words no keyword list
 *     predicted. Omit `pointIds` and the row is keyword-only, exactly as
 *     chapters 1–3 behave.
 */
export interface ObjectiveDef {
  id: string;
  label: string;
  /** Lowercase phrases; if the player's own message contains any of them, the objective checks off instantly. */
  keywords: string[];
  /** Learning-point ids belonging to this row; the row ticks once ALL of them
   *  are covered by the character's answers. */
  pointIds?: string[];
}

/** One thing the player should come away understanding. */
export interface LearningPoint {
  id: string;
  text: string;
  /**
   * Everyday words, names and phrasings that show this topic is genuinely
   * being discussed — synonyms and related terms, not just the textbook name.
   * Two different cues in one answer from the character count as covered, so
   * a kid never has to say "Treaty of Versailles" to tick it off, and one
   * stray word can never tick it off by itself.
   */
  cues: string[];
}

export interface StageNode {
  id: string;
  /** Shown only in the debug character-test screen. */
  title: string;
  objective: string;
  learningPoints: LearningPoint[];
  guidedQuestions: string[];
  /** Extra system-prompt rules while this node is active. */
  behaviorRules: string[];
  advance: {
    /** null = final node; meeting the condition completes the conversation. */
    to: string | null;
    condition: 'allPoints' | 'minPoints' | 'minTurns';
    minPoints?: number;
    minTurns?: number;
  };
}

/** POST /api/chat request. The tree itself is resolved server-side. */
export interface ChatRequest {
  chapterId: ChapterId;
  nodeId: string;
  coveredPointIds: string[];
  turnsInNode: number;
  history: { role: 'player' | 'character'; text: string }[];
  message: string;
  /** First call of a conversation: character introduces itself. */
  intro?: boolean;
}

export interface ChatResponse {
  reply: string;
  newlyCoveredIds: string[];
  /** Node to move to, if the current node's advance condition was met. */
  advanceTo: string | null;
  /** True once the final node's condition is met — the player may leave when ready. */
  canContinue: boolean;
  guidedQuestions: string[];
  screened?: 'abusive' | 'ai_probe' | 'busy';
  nodeId: string;
  /** The chapter's objectives — rides every response so the checklist is self-healing. */
  objectives?: ObjectiveDef[];
  /** Objectives the PLAYER'S message was classified as asking about (see
   *  server/intent.ts) — the accurate second pass behind the instant
   *  client-side keyword match. Absent/empty means "none matched". */
  intentObjectiveIds?: string[];
}
