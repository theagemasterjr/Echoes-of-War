import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChapterId } from '@/chapters/types';

interface ProgressState {
  version: 1;
  prologueDone: boolean;
  completed: ChapterId[];
  markPrologueDone: () => void;
  markComplete: (id: ChapterId) => void;
  reset: () => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      version: 1,
      prologueDone: false,
      completed: [],
      markPrologueDone: () => set({ prologueDone: true }),
      markComplete: (id) =>
        set((s) => (s.completed.includes(id) ? s : { completed: [...s.completed, id] })),
      reset: () => set({ completed: [], prologueDone: false }),
    }),
    { name: 'eow-save-v1' },
  ),
);
