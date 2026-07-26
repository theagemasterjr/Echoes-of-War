'use client';
/**
 * Chapter 1 — The Spark. This is the VERTICAL SLICE chapter: the reference
 * example for how a filled-in chapter looks. The chapter's opening (film and
 * mission brief) is content, not code — see src/content/briefs.json and
 * docs/chapter-guide.md.
 */
import type { ChapterModule } from '../types';
import { TimelineMinigame } from './TimelineMinigame';
import { TimelineTableScene } from './TimelineTableScene';

const chapter: ChapterModule = {
  Minigame: TimelineMinigame,
  MinigameScene: TimelineTableScene,
};
export default chapter;
