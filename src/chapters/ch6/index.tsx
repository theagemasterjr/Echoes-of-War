'use client';
/**
 * Chapter 6 — The Cost of Victory. The chapter's opening (film and mission
 * brief) is content, not code — see src/content/briefs.json and
 * docs/chapter-guide.md.
 *
 * The minigame is "The Voices", played on the war table: four pieces stand
 * for four people who lived through the same events from different positions,
 * and the player gives nine paper slips to whoever said them. Eight have a
 * home; the ninth is refused by everyone and belongs to the centre, under the
 * paper crane. The board and pieces are 3D (VoicesScene, paired with
 * `minigameCamera` on the registry row); every word the player reads is DOM
 * (VoicesMinigame). The rules, the layout and ALL of the text live in
 * voicesStore.ts.
 *
 * Part 1's temporary bridge is gone: the minigame beat now plays the real
 * game, which shows <ChapterSummary> itself when it ends, the way chapters 4
 * and 5 do.
 */
import type { ChapterModule } from '../types';
import { VoicesMinigame } from './VoicesMinigame';
import { VoicesScene } from './VoicesScene';
import { SUMMARY } from './summary';

const chapter: ChapterModule = {
  Minigame: VoicesMinigame,
  MinigameScene: VoicesScene,
  summary: SUMMARY,
};
export default chapter;
