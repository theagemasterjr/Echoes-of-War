'use client';
/**
 * Chapter 3 — A World at War. Third worked chapter (chapters 1 and 2 are the
 * reference examples). The chapter's opening (film and mission brief) is
 * content, not code — see src/content/briefs.json and docs/chapter-guide.md.
 * The minigame is a 2D card timeline over the shared staging; a chapter-owned
 * 3D scene (like ch1's tabletop) can replace it later without touching this
 * export shape.
 */
import type { ChapterModule } from '../types';
import { PathToWarMinigame } from './PathToWarMinigame';

const chapter: ChapterModule = {
  Minigame: PathToWarMinigame,
};
export default chapter;
