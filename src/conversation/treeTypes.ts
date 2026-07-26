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
  /** Pre-written in-character lines returned WITHOUT an AI call when input screening trips. */
  deflections: {
    abusive: string;
    aiProbe: string;
    busy: string;
  };
  entryNodeId: string;
  nodes: Record<string, StageNode>;
  /** Learner-facing objectives shown as a checklist; each checks off the instant
   *  the player's own message mentions one of its keywords. */
  objectives?: ObjectiveDef[];
}

/**
 * One row of the on-screen Objectives panel. It checks off two ways, and
 * either is enough — a row never un-checks once ticked:
 *  1. the PLAYER says one of its keywords (client-side, instant);
 *  2. the CHARACTER'S answer actually covers the concept, in whatever words
 *     they choose (graded server-side against the row's label — see
 *     server/coverage.objectiveCoverage).
 */
export interface ObjectiveDef {
  id: string;
  label: string;
  /** Lowercase phrases; if the player's own message contains any of them, the objective checks off instantly. */
  keywords: string[];
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
  /** Objective ids already ticked off on screen — only the rest get graded. */
  objectivesDone?: string[];
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
  /** Objectives this reply actually explained — they tick off alongside the
   *  ones the player's own words already ticked. */
  objectivesCovered?: string[];
}
