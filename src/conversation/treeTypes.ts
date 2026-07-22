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
}

export interface StageNode {
  id: string;
  /** Shown only in the debug character-test screen. */
  title: string;
  objective: string;
  learningPoints: { id: string; text: string }[];
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
  progress: { covered: number; total: number };
  screened?: 'abusive' | 'ai_probe' | 'busy';
  nodeId: string;
}
