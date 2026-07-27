import type { SummaryEntry } from '../types';

/**
 * Chapter 5 closing summary — four topics, one per objective row, in the
 * order the Objectives panel lists them. The narrator reads the LINES only;
 * the topic titles are on screen and are not spoken. The lines below match
 * the founder's recording (public/audio/summary/ch5.mp3) word for word — the
 * reveal timings live in src/audio/summaryNarration.ts (TAKES.ch5) and were
 * measured off that recording. Edit a line and the take must be re-recorded
 * and re-timed.
 */
export const SUMMARY: SummaryEntry[] = [
  {
    topic: 'The Second Front',
    line: 'Western Europe had been occupied for four years, while in the east the Soviet Union carried the weight of the fighting. The Allies had to come back — and Germany had spent years fortifying the coast, waiting for them.',
  },
  {
    topic: 'The Great Build-Up',
    line: 'Britain filled with men and supplies, whole harbours were built in pieces and towed across the sea, and in the end the date came down to a short break in a storm.',
  },
  {
    topic: 'The Deception',
    line: 'Calais was the obvious place to land, so the Allies made Germany certain that was where it would come. Germany kept its strongest divisions waiting there for seven weeks after the landings.',
  },
  {
    topic: 'D-Day',
    line: 'On the 6th of June, airborne troops landed in darkness, and five beaches were taken at first light. Holding that ground mattered more than taking it, and Germany was now fighting on two fronts at once.',
  },
];
