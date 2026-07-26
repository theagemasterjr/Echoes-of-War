'use client';
import { useEffect } from 'react';
import { CHAPTERS } from '@/chapters/registry';
import { useProgressStore } from '@/state/progressStore';
import { preloadVideo, startPreloading } from './videoCache';

/** The opening film — kept here rather than in a chapter row because it belongs
 *  to the title screen. Keep in sync with UiLayer's PrologueVideo. */
export const PROLOGUE_VIDEO = '/video/prologue.mp4';

/**
 * Downloads the films quietly in the background while the player is still on
 * the title screen or reading the map, so every film is ready before its beat
 * arrives. Renders nothing.
 */
export function VideoPreloader() {
  const prologueDone = useProgressStore((s) => s.prologueDone);

  useEffect(() => {
    // hold off until the page itself has finished loading, so the war room
    // and its models get the bandwidth first
    startPreloading();
  }, []);

  useEffect(() => {
    // the opening film comes first — it plays within seconds of BEGIN — unless
    // this player has already seen it
    if (!prologueDone) preloadVideo(PROLOGUE_VIDEO);
    for (const chapter of CHAPTERS) {
      if (chapter.introVideo) preloadVideo(chapter.introVideo);
    }
  }, [prologueDone]);

  return null;
}
