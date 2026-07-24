import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { audioManager, type MusicTrackId } from '@/audio/audioManager';

interface SettingsState {
  volume: number; // 0..1
  soundtrack: MusicTrackId;
  setVolume: (v: number) => void;
  setSoundtrack: (t: MusicTrackId) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      volume: 0.8,
      soundtrack: 'main-theme',
      setVolume: (volume) => {
        audioManager.setVolume(volume);
        set({ volume });
      },
      // MusicDirector reacts to this and crossfades to the chosen track.
      setSoundtrack: (soundtrack) => set({ soundtrack }),
    }),
    { name: 'eow-settings-v1' },
  ),
);
