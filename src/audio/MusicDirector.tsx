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

export function MusicDirector() {
  const view = useAppStore((s) => s.view);
  const pending = useAppStore((s) => s.pending);
  const volume = useSettingsStore((s) => s.volume);
  const soundtrack = useSettingsStore((s) => s.soundtrack);

  const effectiveView = pending ?? view;
  // music carries through title, map AND the chapter showcase — it fades for
  // the prologue film (which has its own soundtrack) and once the player
  // commits to the conversation (or the minigame after it)
  const shouldPlay =
    effectiveView.kind !== 'prologue' &&
    (effectiveView.kind !== 'chapter' || effectiveView.beat === 'overview');

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
  }, [volume]);

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
