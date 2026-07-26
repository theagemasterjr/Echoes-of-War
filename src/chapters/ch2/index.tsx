'use client';
/**
 * Chapter 2 — Standing Alone. Second worked chapter (chapter 1 is the
 * original reference). The chapter's opening (film and mission brief) is
 * content, not code — see src/content/briefs.json and docs/chapter-guide.md.
 * The minigame is a 2D card timeline over the shared staging; a chapter-owned
 * 3D scene (like ch1's tabletop) can replace it later without touching this
 * export shape.
 */
import type { ChapterModule } from '../types';
import { BattleTimelineMinigame } from './BattleTimelineMinigame';

const chapter: ChapterModule = {
  Minigame: BattleTimelineMinigame,
};
export default chapter;
