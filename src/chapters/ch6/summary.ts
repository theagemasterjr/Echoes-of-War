import type { SummaryEntry } from '../types';

/**
 * Chapter 6 closing summary — nine topics, per the founders' Part 1 spec.
 * The narrator reads the LINES only; the topic titles are on screen and are
 * not spoken. The lines below match the founders' recording
 * (public/audio/summary/ch6.mp3) word for word — transcribed with Whisper and
 * pinned to the take; the reveal timings live in src/audio/summaryNarration.ts
 * (TAKES.ch6) and were measured off that recording. Editing a line here means
 * re-recording and re-measuring that take.
 *
 * (The recording opens with a spoken "Chapter 6. The Cost of Victory." header
 * before the first topic — the timing row accounts for it; nothing here needs
 * to.)
 *
 * ⚠ TONE — this chapter's rules bind these lines hardest of all: no casualty
 * figures anywhere, no graphic description, no verdict on whether the
 * bombings were justified, no triumph. The final row leaves the question with
 * the player — that is the chapter's designed ending, not an evasion.
 */
export const SUMMARY: SummaryEntry[] = [
  {
    topic: 'The War Goes On',
    line: 'Germany surrendered in May. Japan did not.',
  },
  {
    topic: 'The Demand',
    line: 'In July, the Allies set out their terms and demanded surrender. Japan’s government gave no reply.',
  },
  {
    topic: 'The Invasion That Never Came',
    line: 'An invasion of Japan was planned for the autumn. Japan was preparing to meet it, down to training civilians. Both sides expected it to be worse than anything that had come before.',
  },
  {
    topic: 'No Easy Way',
    line: 'There was no option left that was not terrible. Invade. Continue the blockade and the bombing. Or use a weapon that had been tested exactly once.',
  },
  {
    topic: 'The Argument',
    line: 'Some of the scientists who built it asked for a demonstration instead.',
  },
  {
    topic: 'The Sixth of August',
    line: 'One aircraft. One bomb. A quarter past eight in the morning. A single plane had never meant anything, so nobody took shelter.',
  },
  {
    topic: 'The End of the War',
    line: 'A second bomb fell on Nagasaki. On the 15th of August, Japan’s surrender was announced. The war was over.',
  },
  {
    topic: 'The Illness After',
    line: 'The harm did not end that morning. In the weeks that followed, people who had walked away from the blast fell ill from something no doctor had ever treated.',
  },
  {
    topic: 'The World After',
    line: 'No nuclear weapon has been used in war since — but the world that came after was one where they existed, and where more than one country would build them. Whether there was another way is a question people have argued over ever since. It is a fair question to keep asking.',
  },
];
