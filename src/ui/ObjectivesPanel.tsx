'use client';
/**
 * The Objectives panel. A row is either open or ticked — nothing in between.
 * It lands with a gold flash the instant the player says the words (or, a beat
 * later, when the character finishes teaching that row), so the player catches
 * it happening out of the corner of an eye. Once ticked, a row stays ticked.
 *
 * Shared, because the panel outlives the conversation: chapter 4's war-table
 * minigame keeps it on screen and ticks the last three rows as the board is laid
 * out. It takes a plain list of rows, so a minigame can show them without the
 * conversation engine being involved.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export function ObjectivesPanel({
  objectives,
  doneIds,
}: {
  objectives: { id: string; label: string }[];
  doneIds: string[];
}) {
  const doneSet = useMemo(() => new Set(doneIds), [doneIds]);
  // which row just completed — drives the one-off celebration
  const [justDone, setJustDone] = useState<string | null>(null);
  const seen = useRef<string[]>([]);
  useEffect(() => {
    const fresh = doneIds.find((id) => !seen.current.includes(id));
    seen.current = doneIds;
    if (!fresh) return;
    setJustDone(fresh);
    const t = setTimeout(() => setJustDone(null), 1600);
    return () => clearTimeout(t);
  }, [doneIds]);

  return (
    <div className="absolute left-4 top-16 hidden w-56 rounded-md border border-stone-800 bg-stone-950/70 p-4 backdrop-blur-sm md:block">
      <div className="text-[10px] uppercase tracking-widest text-amber-200/70">Objectives</div>
      <ul className="mt-3 space-y-2.5">
        {objectives.map((o) => {
          const done = doneSet.has(o.id);
          const celebrating = justDone === o.id;
          return (
            <motion.li
              key={o.id}
              animate={celebrating ? { scale: [1, 1.045, 1] } : { scale: 1 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="text-xs leading-snug"
            >
              <div className="flex items-start gap-2">
                <span className="relative mt-px shrink-0 text-sm">
                  <motion.span
                    animate={{ color: done ? '#fcd34d' : '#57534e' }}
                    transition={{ duration: 0.4 }}
                  >
                    {done ? '✓' : '○'}
                  </motion.span>
                  {celebrating && (
                    /* a single ring pushing outward from the new tick */
                    <motion.span
                      initial={{ opacity: 0.85, scale: 0.5 }}
                      animate={{ opacity: 0, scale: 2.6 }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full border border-amber-300"
                    />
                  )}
                </span>
                <motion.span
                  animate={{ color: done ? '#fde68a' : '#a8a29e' }}
                  transition={{ duration: 0.5 }}
                  style={celebrating ? { textShadow: '0 0 14px rgba(252,211,77,0.65)' } : undefined}
                >
                  {o.label}
                </motion.span>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
