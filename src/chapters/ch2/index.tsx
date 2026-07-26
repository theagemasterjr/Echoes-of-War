'use client';
/**
 * Chapter 2 — Standing Alone. Second worked chapter (chapter 1 is the
 * original reference). The chapter's opening (film and mission brief) is
 * content, not code — see src/content/briefs.json and docs/chapter-guide.md.
 * The minigame is "Match the Piece to the Moment": five described boxes and
 * five game pieces on the war-room table, played in the chapter's own 3D scene
 * (paired with `minigameCamera` on its registry row).
 */
import type { ChapterModule } from '../types';
import { MatchMinigame } from './MatchMinigame';
import { MatchTableScene } from './MatchTableScene';

const chapter: ChapterModule = {
  Minigame: MatchMinigame,
  MinigameScene: MatchTableScene,
};
export default chapter;
