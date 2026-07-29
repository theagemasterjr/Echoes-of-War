'use client';
/**
 * Chapter 5 — The Road Back. The chapter's opening (film and mission brief) is
 * content, not code — see src/content/briefs.json and docs/chapter-guide.md.
 *
 * The minigame is "Show it or hide it", played on the war-room table: the camera
 * pulls back from Ted to the Channel map and the player sorts eight pieces
 * into the two English regions by asking one question about each — do you want
 * the Germans to see this? The board and the pieces are 3D (ShowOrHideScene,
 * paired with `minigameCamera` on the registry row); every word the player reads
 * is DOM (ShowOrHideMinigame). The rules, the board and all of its text live in
 * showOrHideStore.ts.
 *
 * Part 1's temporary bridge is gone: the minigame beat now plays the real game,
 * which shows <ChapterSummary> itself when it ends, the way chapter 4 does. The
 * shared beat order (appStore.beatsFor) runs intro → brief → conversation →
 * minigame, so the flow is conversation → minigame → summary with no
 * chapter-specific routing anywhere.
 */
import type { ChapterModule } from '../types';
import { ShowOrHideMinigame } from './ShowOrHideMinigame';
import { ShowOrHideScene } from './ShowOrHideScene';
import { SUMMARY } from './summary';

const chapter: ChapterModule = {
  Minigame: ShowOrHideMinigame,
  MinigameScene: ShowOrHideScene,
  summary: SUMMARY,
};
export default chapter;
