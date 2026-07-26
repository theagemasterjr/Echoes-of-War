'use client';
/**
 * Chapter 4 — Turning the Tide. The chapter's opening (film and mission brief)
 * is content, not code — see src/content/briefs.json and docs/chapter-guide.md.
 * The minigame is a plain 2D timeline: eight moments from the battle, shuffled,
 * to be put back in order (timelineStore.ts for the content and the rules,
 * TurningPointMinigame.tsx for every word the player reads).
 *
 * No MinigameScene and no `minigameCamera` on the registry row — this chapter
 * uses the shared DOM staging on purpose, so the founder can replace the game
 * later without unpicking a 3D scene.
 */
import type { ChapterModule } from '../types';
import { TurningPointMinigame } from './TurningPointMinigame';
import { SUMMARY } from './timelineStore';

const chapter: ChapterModule = {
  Minigame: TurningPointMinigame,
  summary: SUMMARY,
};
export default chapter;
