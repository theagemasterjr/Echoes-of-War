import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { audioManager, type MusicTrackId } from '@/audio/audioManager';
import { voicePlayer } from '@/audio/voicePlayer';
import { setNarrationVoiceEnabled } from '@/audio/narrationPlayer';

/** Reading typeface. 'default' is the game's Inter; 'lexend' is the
 *  easy-read (dyslexia-friendly) face applied to every word on screen. */
export type ReadingFont = 'default' | 'lexend';
/** Root text scale. 'large' bumps the root font-size, so every rem-based
 *  Tailwind size grows with it. */
export type TextSize = 'normal' | 'large';

interface SettingsState {
  volume: number; // 0..1
  soundtrack: MusicTrackId;
  readingFont: ReadingFont;
  textSize: TextSize;
  /** Character voice / narration on or off (default on). Off skips all
   *  playback AND never fetches TTS — see voicePlayer.speak / narrationAudio. */
  voiceEnabled: boolean;
  /** Caption text alongside spoken dialogue (default on). Forced on
   *  regardless of this flag whenever voiceEnabled is off — see ConversationUI. */
  subtitlesEnabled: boolean;
  setVolume: (v: number) => void;
  setSoundtrack: (t: MusicTrackId) => void;
  setReadingFont: (f: ReadingFont) => void;
  setTextSize: (s: TextSize) => void;
  setVoiceEnabled: (v: boolean) => void;
  setSubtitlesEnabled: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      volume: 0.8,
      soundtrack: 'main-theme',
      readingFont: 'default',
      textSize: 'normal',
      voiceEnabled: true,
      subtitlesEnabled: true,
      setVolume: (volume) => {
        audioManager.setVolume(volume);
        voicePlayer.setVolume(volume);
        set({ volume });
      },
      // MusicDirector reacts to this and crossfades to the chosen track.
      setSoundtrack: (soundtrack) => set({ soundtrack }),
      // UiLayer mirrors these onto <html> as data attributes; globals.css does
      // the rest, so nothing else in the game has to know about them.
      setReadingFont: (readingFont) => set({ readingFont }),
      setTextSize: (textSize) => set({ textSize }),
      // The one switch for every character voice + recorded narration: cuts
      // whatever is speaking now and stops speak()/narrationAudio() from ever
      // starting another line while it's off.
      setVoiceEnabled: (voiceEnabled) => {
        voicePlayer.setEnabled(voiceEnabled);
        setNarrationVoiceEnabled(voiceEnabled);
        set({ voiceEnabled });
      },
      setSubtitlesEnabled: (subtitlesEnabled) => set({ subtitlesEnabled }),
    }),
    {
      name: 'eow-settings-v1',
      // v1: 'main-theme-2' was removed — a saved pick of it must fall back to
      // the one real track, or returning players would get silence forever
      // (audioManager.play() no-ops on unknown ids).
      version: 1,
      migrate: (state) => {
        const s = state as Partial<SettingsState>;
        if (s.soundtrack !== 'main-theme') s.soundtrack = 'main-theme';
        return s as SettingsState;
      },
    },
  ),
);
