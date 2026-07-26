'use client';
/**
 * Chapter 4 — Turning the Tide. The chapter's opening (film and mission brief)
 * is content, not code — see src/content/briefs.json and docs/chapter-guide.md.
 *
 * The minigame is "Operation Uranus", played on the war-room table: the camera
 * pulls back from Nikolai to the red-stained map and the player lays the
 * counter-attack out on it in three phases — what Germany came for, where to
 * strike, and closing the ring. The board and the pieces are 3D
 * (UranusTableScene, paired with `minigameCamera` on the registry row); every
 * word the player reads is DOM (UranusMinigame). The rules, the board and all of
 * its text live in uranusStore.ts.
 */
import type { ChapterModule } from '../types';
import { UranusMinigame } from './UranusMinigame';
import { UranusTableScene } from './UranusTableScene';
import { SUMMARY } from './uranusStore';

const chapter: ChapterModule = {
  Minigame: UranusMinigame,
  MinigameScene: UranusTableScene,
  summary: SUMMARY,
};
export default chapter;
