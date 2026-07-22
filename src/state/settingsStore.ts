import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { audioManager } from '@/audio/audioManager';

interface SettingsState {
  volume: number; // 0..1
  setVolume: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      volume: 0.8,
      setVolume: (volume) => {
        audioManager.setVolume(volume);
        set({ volume });
      },
    }),
    { name: 'eow-settings-v1' },
  ),
);
