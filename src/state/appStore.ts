import { create } from 'zustand';
import type { Beat, ChapterId } from '@/chapters/types';
import { chapterMeta } from '@/chapters/registry';
import { hasBrief } from '@/content/briefs';
import { useProgressStore } from './progressStore';

export type View =
  | { kind: 'title' }
  | { kind: 'map' }
  | { kind: 'prologue' }
  | { kind: 'chapter'; chapterId: ChapterId; beat: Beat }
  /** The end-of-game screen — shown once chapter 6 completes, before the map. */
  | { kind: 'ending' };

export type TransitionPhase = 'idle' | 'out' | 'titleCard' | 'in';

interface AppState {
  view: View;
  /** Where the transition is headed while phase !== 'idle'. */
  pending: View | null;
  phase: TransitionPhase;
  debugOpen: boolean;
  characterTestChapter: ChapterId | null;
  /** Debug only: show this chapter's real summary screen over everything. */
  summaryChapter: ChapterId | null;

  begin: () => void;
  gotoChapter: (id: ChapterId, beat?: Beat, instant?: boolean) => void;
  completePrologue: () => void;
  advanceBeat: () => void;
  completeChapter: () => void;
  returnToMap: (instant?: boolean) => void;
  returnToTitle: () => void;
  setDebugOpen: (open: boolean) => void;
  setCharacterTestChapter: (id: ChapterId | null) => void;
  setSummaryChapter: (id: ChapterId | null) => void;
  /** Called by the transition layer as it walks the phases. */
  _commit: () => void;
  _setPhase: (phase: TransitionPhase) => void;
}

/** The one chapter flow, shared by all six: intro film → mission brief →
 *  live conversation → minigame. */
export const BEAT_ORDER: Beat[] = ['intro', 'brief', 'conversation', 'minigame'];

/** The beats a chapter actually runs. A chapter with no intro film, or no
 *  mission brief written yet, simply skips that beat — adding either one later
 *  is a content edit, never a code change. */
export function beatsFor(id: ChapterId): Beat[] {
  return BEAT_ORDER.filter(
    (b) => (b !== 'intro' || !!chapterMeta(id).introVideo) && (b !== 'brief' || hasBrief(id)),
  );
}

export const useAppStore = create<AppState>((set, get) => ({
  view: { kind: 'title' },
  pending: null,
  phase: 'idle',
  debugOpen: false,
  characterTestChapter: null,
  summaryChapter: null,

  // first BEGIN plays the prologue film; afterwards it goes straight to the map
  begin: () =>
    set({
      pending: useProgressStore.getState().prologueDone ? { kind: 'map' } : { kind: 'prologue' },
      phase: 'out',
    }),

  gotoChapter: (id, beat, instant = false) => {
    const target: View = { kind: 'chapter', chapterId: id, beat: beat ?? beatsFor(id)[0] };
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
    const beats = beatsFor(v.chapterId);
    const next = beats[beats.indexOf(v.beat) + 1];
    if (next) set({ view: { ...v, beat: next } });
  },

  completeChapter: () => {
    const v = get().view;
    if (v.kind !== 'chapter') return;
    useProgressStore.getState().markComplete(v.chapterId);
    // Finishing the LAST chapter earns the ending — the whole game looked
    // back at once, and the congratulations — before the map returns.
    if (v.chapterId === 'ch6') set({ pending: { kind: 'ending' }, phase: 'out' });
    else get().returnToMap();
  },

  returnToMap: (instant = false) => {
    if (instant) set({ view: { kind: 'map' }, pending: null, phase: 'idle' });
    else set({ pending: { kind: 'map' }, phase: 'out' });
  },

  returnToTitle: () => set({ pending: { kind: 'title' }, phase: 'out' }),

  setDebugOpen: (debugOpen) => set({ debugOpen }),
  setCharacterTestChapter: (characterTestChapter) => set({ characterTestChapter }),
  setSummaryChapter: (summaryChapter) => set({ summaryChapter }),

  _commit: () => {
    const p = get().pending;
    if (p) set({ view: p, pending: null });
  },
  _setPhase: (phase) => set({ phase }),
}));
