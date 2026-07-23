import { create } from 'zustand';
import type { Beat, ChapterId } from '@/chapters/types';
import { useProgressStore } from './progressStore';

export type View =
  | { kind: 'title' }
  | { kind: 'map' }
  | { kind: 'prologue' }
  | { kind: 'chapter'; chapterId: ChapterId; beat: Beat };

export type TransitionPhase = 'idle' | 'out' | 'titleCard' | 'in';

interface AppState {
  view: View;
  /** Where the transition is headed while phase !== 'idle'. */
  pending: View | null;
  phase: TransitionPhase;
  debugOpen: boolean;
  characterTestChapter: ChapterId | null;

  begin: () => void;
  gotoChapter: (id: ChapterId, beat?: Beat, instant?: boolean) => void;
  completePrologue: () => void;
  advanceBeat: () => void;
  completeChapter: () => void;
  returnToMap: (instant?: boolean) => void;
  returnToTitle: () => void;
  setDebugOpen: (open: boolean) => void;
  setCharacterTestChapter: (id: ChapterId | null) => void;
  /** Called by the transition layer as it walks the phases. */
  _commit: () => void;
  _setPhase: (phase: TransitionPhase) => void;
}

const BEAT_ORDER: Beat[] = ['overview', 'conversation', 'minigame'];

export const useAppStore = create<AppState>((set, get) => ({
  view: { kind: 'title' },
  pending: null,
  phase: 'idle',
  debugOpen: false,
  characterTestChapter: null,

  // first BEGIN plays the prologue film; afterwards it goes straight to the map
  begin: () =>
    set({
      pending: useProgressStore.getState().prologueDone ? { kind: 'map' } : { kind: 'prologue' },
      phase: 'out',
    }),

  gotoChapter: (id, beat = 'overview', instant = false) => {
    const target: View = { kind: 'chapter', chapterId: id, beat };
    if (instant) set({ view: target, pending: null, phase: 'idle' });
    else set({ pending: target, phase: 'out' });
  },

  completePrologue: () => {
    useProgressStore.getState().markPrologueDone();
    get().returnToMap();
  },

  advanceBeat: () => {
    const v = get().view;
    if (v.kind !== 'chapter') return;
    const next = BEAT_ORDER[BEAT_ORDER.indexOf(v.beat) + 1];
    if (next) set({ view: { ...v, beat: next } });
  },

  completeChapter: () => {
    const v = get().view;
    if (v.kind !== 'chapter') return;
    useProgressStore.getState().markComplete(v.chapterId);
    get().returnToMap();
  },

  returnToMap: (instant = false) => {
    if (instant) set({ view: { kind: 'map' }, pending: null, phase: 'idle' });
    else set({ pending: { kind: 'map' }, phase: 'out' });
  },

  returnToTitle: () => set({ pending: { kind: 'title' }, phase: 'out' }),

  setDebugOpen: (debugOpen) => set({ debugOpen }),
  setCharacterTestChapter: (characterTestChapter) => set({ characterTestChapter }),

  _commit: () => {
    const p = get().pending;
    if (p) set({ view: p, pending: null });
  },
  _setPhase: (phase) => set({ phase }),
}));
