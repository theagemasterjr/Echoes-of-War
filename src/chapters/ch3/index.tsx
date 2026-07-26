'use client';
/**
 * Chapter 3 — A World at War. The chapter's opening (film and mission brief)
 * is content, not code — see src/content/briefs.json and docs/chapter-guide.md.
 * The minigame is "Letters of December": four identical sealed documents on
 * the war-room table each round, one of them the real one (lettersStore.ts for
 * the rules and content, LetterTableScene.tsx for the table, and
 * LettersMinigame.tsx for every word the player reads).
 */
import type { ChapterModule } from '../types';
import { LettersMinigame } from './LettersMinigame';
import { LetterTableScene } from './LetterTableScene';

const chapter: ChapterModule = {
  Minigame: LettersMinigame,
  MinigameScene: LetterTableScene,
};
export default chapter;
