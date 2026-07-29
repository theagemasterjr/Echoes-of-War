import type { SummaryEntry } from '../types';

/**
 * Chapter 6 closing summary — four topics, one per objective row, in the
 * order the Objectives panel lists them (the same format every other chapter
 * uses). The narrator reads the LINES only; the topic titles are on screen
 * and are not spoken.
 *
 * ⚠ NO RECORDING IS WIRED for this wording yet. The previous take was
 * retired when the summary was rewritten to the standard walk-the-objectives
 * format (founder request, 2026-07-29); until the new recording lands at
 * public/audio/summary/ch6.mp3 with a timed TAKES.ch6 row in
 * src/audio/summaryNarration.ts (measure with
 * scripts/lib/narration-segments.mjs), the screen shows the whole summary at
 * once, silently — the shared screen's designed fallback.
 *
 * ⚠ TONE — this chapter's rules bind these lines hardest of all: no casualty
 * figures anywhere, no graphic description, no verdict on whether the
 * bombings were justified, no triumph. See TONE_RULES in
 * src/content/trees/ch6.ts.
 */
export const SUMMARY: SummaryEntry[] = [
  {
    topic: 'Why the War Continues',
    line: 'Germany surrendered in May 1945 and the war in Europe ended, but the war in the Pacific went on. In July the Allies set out their terms and demanded surrender, and Japan’s government gave no reply.',
  },
  {
    topic: 'The Impossible Choice',
    line: 'An invasion of Japan was planned for the autumn, and Japan was preparing to resist it — down to training ordinary people. After the fighting on Okinawa, every way left of ending the war carried an enormous cost.',
  },
  {
    topic: 'The Atomic Bomb',
    line: 'The bomb had been built in secret over several years and tested exactly once, in the New Mexico desert. Hiroshima had been largely spared bombing, which was part of why it was chosen. On the morning of the 6th of August, a single plane dropped a single bomb, and almost nobody was in shelter.',
  },
  {
    topic: 'The Effect of the Bomb',
    line: 'A second bomb fell on Nagasaki, and the Soviet Union declared war on Japan the same week. Japan announced its surrender on the 15th of August. The harm did not end there — in the weeks that followed, people who had survived fell ill with a sickness doctors did not yet understand.',
  },
];
