'use client';
/**
 * The chapter summary — its own black screen of film titles. The narrator
 * reads what the chapter taught, a topic lands as it is spoken, and when the
 * take ends they are all on screen with the finish button beneath them (see
 * audio/summaryNarration for the recording and its timings).
 *
 * ONE screen, two ways in: every chapter's minigame renders it when the
 * timeline is solved, and the debug menu jumps straight to it. A tester
 * therefore sees exactly what a player sees — same black, same reveal, same
 * recording — because it is the same component.
 *
 * The narration hook starts the take on mount and hands the voice back on the
 * way out, so this component is only ever mounted while the summary is up.
 */
import { motion, useReducedMotion } from 'framer-motion';
import type { ChapterId, SummaryEntry } from '@/chapters/types';
import { chapterMeta } from '@/chapters/registry';
import { useSummaryNarration } from '@/audio/summaryNarration';

export function ChapterSummary({
  chapterId,
  summary,
  onFinish,
  finishLabel = 'FINISH CHAPTER →',
}: {
  chapterId: ChapterId;
  summary: SummaryEntry[];
  onFinish: () => void;
  /** Wording of the button under the last topic. */
  finishLabel?: string;
}) {
  // mounted only while the summary is on screen, so the take starts right here
  const reveal = useSummaryNarration(chapterId, summary.length, true);
  const reduced = useReducedMotion() ?? false;

  return (
    <div
      className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center overflow-y-auto bg-black px-6 py-10"
      role="region"
      aria-label="Chapter summary"
      aria-live="polite"
    >
      <div className="w-full max-w-2xl">
        <div className="text-center text-[10px] uppercase tracking-[0.35em] text-amber-200/50">
          Chapter {chapterMeta(chapterId).index} · Summary
        </div>
        <h2 className="mt-3 text-center text-2xl font-light tracking-wide text-stone-100">
          What you learned
        </h2>
        <ul className="mt-10 space-y-7">
          {summary.map((s, i) => {
            const shown = i < reveal.revealed;
            const speaking = i === reveal.current && !reveal.finished;
            return (
              <motion.li
                key={s.topic}
                initial={false}
                animate={{
                  opacity: shown ? (speaking || reveal.finished ? 1 : 0.4) : 0,
                  y: shown || reduced ? 0 : 10,
                }}
                transition={{ duration: reduced ? 0 : 0.7, ease: 'easeOut' }}
                aria-hidden={!shown}
              >
                <div
                  className={`text-[11px] uppercase tracking-[0.25em] ${
                    speaking ? 'text-amber-200' : 'text-amber-200/70'
                  }`}
                >
                  {s.topic}
                </div>
                <p className="mt-1.5 text-base leading-relaxed text-stone-200">{s.line}</p>
              </motion.li>
            );
          })}
        </ul>
        {reveal.finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.9 }}
            className="mt-12 flex justify-center"
          >
            <button
              autoFocus
              onClick={onFinish}
              className="rounded-sm border border-amber-200/50 px-8 py-3 text-xs tracking-[0.3em] text-amber-100 transition hover:bg-amber-200/10"
            >
              {finishLabel}
            </button>
          </motion.div>
        )}
      </div>

      {!reveal.finished && (
        <button
          onClick={reveal.skip}
          className="absolute bottom-6 right-6 rounded-sm border border-stone-700/70 px-5 py-2 text-[10px] uppercase tracking-[0.25em] text-stone-500 transition hover:border-amber-200/40 hover:text-amber-100/80"
        >
          Skip →
        </button>
      )}
    </div>
  );
}
