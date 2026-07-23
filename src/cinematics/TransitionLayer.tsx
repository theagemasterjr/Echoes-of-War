'use client';
/**
 * The single reusable transition: fade to black → (title card) → fade in.
 * It drives the appStore phase machine; the CameraDirector reacts to the same
 * phases for the 3D dive. Also doubles as the anti-white-screen shield while
 * lazy chapter code loads under the black.
 */
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/state/appStore';
import { chapterMeta } from '@/chapters/registry';

const OUT_MS = 1200;
const TITLE_MS = 2300;

export function TransitionLayer() {
  const phase = useAppStore((s) => s.phase);
  const pending = useAppStore((s) => s.pending);
  const view = useAppStore((s) => s.view);

  // the open-air camera glide down to the map: title → map (return visits) or
  // prologue film → map (first visit) — no black for these
  const glideToMap =
    (view.kind === 'title' || view.kind === 'prologue') && pending?.kind === 'map';
  const enteringChapter = pending?.kind === 'chapter' && pending.beat === 'overview';

  useEffect(() => {
    const { _commit, _setPhase } = useAppStore.getState();
    if (phase === 'out') {
      // the map→chapter dive is a slow, smooth zoom — keep in sync with
      // SceneRouter's DIVE_S and the .zoom-dive CSS duration (both 2.2s).
      // glideToMap = title/film fade (0.9s) + camera glide (1.0s delay + 1.7s)
      const ms = glideToMap ? 2750 : enteringChapter ? 2200 : OUT_MS;
      const t = setTimeout(() => {
        _commit();
        // map → chapter rides the zoom-dive straight into the showcase —
        // no black, no title card (the side panel carries the chapter info)
        _setPhase('in');
      }, ms);
      return () => clearTimeout(t);
    }
    if (phase === 'titleCard') {
      const t = setTimeout(() => _setPhase('in'), TITLE_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'in') {
      const t = setTimeout(() => _setPhase('idle'), 900);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // the map→chapter zoom replaces the black fade entirely
  const black = phase === 'titleCard' || (phase === 'out' && !glideToMap && !enteringChapter);
  const card =
    phase === 'titleCard' && view.kind === 'chapter' ? chapterMeta(view.chapterId) : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <motion.div
        className="absolute inset-0 bg-black"
        initial={false}
        animate={{ opacity: black ? 1 : 0 }}
        transition={{ duration: phase === 'in' ? 0.9 : 1.1, ease: 'easeInOut' }}
      />
      <AnimatePresence>
        {card && (
          <motion.div
            key={card.id}
            className="absolute inset-0 flex flex-col items-center justify-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="text-xs uppercase tracking-[0.4em] text-amber-200/60">
              Chapter {card.index} · {card.dates}
            </div>
            <h1 className="mt-3 text-5xl font-light tracking-wide text-stone-100">{card.title}</h1>
            <div className="mt-3 text-sm text-stone-400">{card.subtitle}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
