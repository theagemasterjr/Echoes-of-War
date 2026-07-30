'use client';
/**
 * Wires the main theme to the view/transition state machine. No visual
 * output — mounted once alongside the other always-on layers in App.tsx.
 *
 * Plays (looping) on the title screen and the war-room map; fades out the
 * moment a chapter is chosen (or entered directly, e.g. via debug jump) and
 * fades back in the moment the player heads back to the map. Keying off
 * `pending ?? view` (rather than the committed view alone) means the fade
 * starts as soon as the player acts, not after the transition finishes —
 * it's already silent by the time a chapter's black overlay lifts.
 */
import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { useSettingsStore } from '@/state/settingsStore';
import { audioManager, MUSIC_TRACK_IDS } from './audioManager';
import { voicePlayer } from './voicePlayer';
import { setNarrationVoiceEnabled } from './narrationPlayer';

export function MusicDirector() {
  const view = useAppStore((s) => s.view);
  const pending = useAppStore((s) => s.pending);
  const volume = useSettingsStore((s) => s.volume);
  const soundtrack = useSettingsStore((s) => s.soundtrack);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);

  const effectiveView = pending ?? view;
  // the theme belongs to the title screen and the map. It fades the moment a
  // chapter is chosen: the intro film carries its own sound, the mission
  // brief's narration needs the room to itself, and the ending screen is the
  // founder's recorded farewell — only that voice plays there.
  const shouldPlay =
    effectiveView.kind !== 'prologue' &&
    effectiveView.kind !== 'chapter' &&
    effectiveView.kind !== 'ending';

  useEffect(() => {
    // fade out whichever track isn't selected (covers switching in settings)
    MUSIC_TRACK_IDS.forEach((id) => {
      if (id !== soundtrack) audioManager.stop(id);
    });
    if (shouldPlay) audioManager.play(soundtrack);
    else audioManager.stop(soundtrack);
  }, [shouldPlay, soundtrack]);

  // Keep the audio layer's live volume in sync with the persisted setting,
  // including on first mount (zustand's persist rehydration bypasses the
  // setVolume action, so this also covers "the slider value the player left
  // it at last time").
  useEffect(() => {
    audioManager.setVolume(volume);
    voicePlayer.setVolume(volume);
  }, [volume]);

  // Same rehydration gap as volume above: persist sets voiceEnabled directly
  // on load without going through setVoiceEnabled, so the audio layer's
  // module-level flags (voicePlayer, narrationPlayer) need this to catch up —
  // including a saved "off" from a previous visit.
  useEffect(() => {
    voicePlayer.setEnabled(voiceEnabled);
    setNarrationVoiceEnabled(voiceEnabled);
  }, [voiceEnabled]);

  // Pause the moment the tab is hidden; resume when it's visible again.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) audioManager.suspendAll();
      else audioManager.resumeAll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return null;
}
