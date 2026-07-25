'use client';
/**
 * Client half of the conversation engine: a store that talks to /api/chat and
 * applies the server's node/coverage decisions. All guardrails, tree logic and
 * model calls live server-side — this never sees the API key or the tree.
 */
import { create } from 'zustand';
import type { ChapterId } from '@/chapters/types';
import type { ChatRequest, ChatResponse, ObjectiveDef } from './treeTypes';
import { voicePlayer } from '@/audio/voicePlayer';

export interface ConvoMessage {
  role: 'player' | 'character';
  text: string;
}

interface ConvoState {
  chapterId: ChapterId | null;
  nodeId: string;
  covered: string[];
  turnsInNode: number;
  messages: ConvoMessage[];
  guided: string[];
  objectives: ObjectiveDef[];
  progress: { covered: number; total: number };
  status: 'idle' | 'sending' | 'error';
  canContinue: boolean;
  lastRequest: ChatRequest | null;

  start: (chapterId: ChapterId) => void;
  send: (text: string) => void;
  retry: () => void;
  reset: () => void;
}

async function post(req: ChatRequest): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`chat ${res.status}`);
  return res.json();
}

export const useConversation = create<ConvoState>((set, get) => {
  const dispatch = async (req: ChatRequest) => {
    set({ status: 'sending', lastRequest: req });
    try {
      const r = await post(req);
      const s = get();
      // the player may have left for another chapter while this was in flight
      if (s.chapterId !== req.chapterId) return;
      const movedNode = r.advanceTo !== null && r.advanceTo !== s.nodeId;
      set({
        status: 'idle',
        nodeId: r.nodeId,
        covered: Array.from(new Set([...s.covered, ...r.newlyCoveredIds])),
        turnsInNode: movedNode ? 0 : req.intro ? s.turnsInNode : s.turnsInNode + 1,
        messages: [...s.messages, { role: 'character', text: r.reply }],
        guided: r.guidedQuestions,
        objectives: r.objectives ?? s.objectives,
        progress: r.progress,
        canContinue: s.canContinue || r.canContinue,
      });
      // fire-and-forget voice — deflections get voiced too (in character);
      // fully additive, silent when no voice key is configured
      voicePlayer.speak(r.reply, req.chapterId);
    } catch {
      set({ status: 'error' });
    }
  };

  return {
    chapterId: null,
    nodeId: '',
    covered: [],
    turnsInNode: 0,
    messages: [],
    guided: [],
    objectives: [],
    progress: { covered: 0, total: 1 },
    status: 'idle',
    canContinue: false,
    lastRequest: null,

    start: (chapterId) => {
      voicePlayer.stop();
      get().reset();
      set({ chapterId });
      dispatch({
        chapterId, nodeId: '', coveredPointIds: [], turnsInNode: 0,
        history: [], message: '', intro: true,
      });
    },

    send: (text) => {
      const s = get();
      // 'error' state must go through retry() — a fresh send would put two
      // consecutive player turns in the history and break the API call
      if (!s.chapterId || s.status !== 'idle' || !text.trim()) return;
      // send plenty of history: the character only reads the recent turns, but
      // the coverage grader reads far back so nothing explained early is lost
      const history = s.messages.slice(-60);
      set({ messages: [...s.messages, { role: 'player', text }] });
      dispatch({
        chapterId: s.chapterId, nodeId: s.nodeId, coveredPointIds: s.covered,
        turnsInNode: s.turnsInNode, history, message: text,
      });
    },

    retry: () => {
      const req = get().lastRequest;
      if (req) dispatch(req);
    },

    reset: () => {
      voicePlayer.stop();
      set({
        chapterId: null, nodeId: '', covered: [], turnsInNode: 0, messages: [],
        guided: [], objectives: [], progress: { covered: 0, total: 1 }, status: 'idle',
        canContinue: false, lastRequest: null,
      });
    },
  };
});
