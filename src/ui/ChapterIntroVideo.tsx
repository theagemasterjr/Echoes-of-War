'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChapterId } from '@/chapters/types';
import { chapterMeta } from '@/chapters/registry';

/**
 * Chapter intro film — the beat between the overview panel and the live
 * conversation. Clones the PrologueVideo autoplay ladder (sound → muted +
 * one-tap unmute → placeholder frame). When the chapter has no `introVideo`
 * (or the file 404s), a styled "coming soon" frame stands in with CONTINUE.
 * SKIP always advances; onEnded advances once. Beat swaps are instant (no
 * transition phase), so this fades itself in.
 */
export function ChapterIntroVideo({
  chapterId, onAdvance,
}: {
  chapterId: ChapterId;
  onAdvance: () => void;
}) {
  const meta = chapterMeta(chapterId);
  const src = meta.introVideo;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  // no file supplied, or playback failed → show the placeholder frame
  const [failed, setFailed] = useState(!src);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onAdvance();
  };

  useEffect(() => {
    if (!src) return;
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => setFailed(true));
    });
  }, [src]);

  const unmute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    v.play().catch(() => {});
  };

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {failed ? (
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.4em] text-amber-200/60">
            Chapter {meta.index} · Intro Film
          </div>
          <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-stone-400">
            Coming soon — the opening film for this chapter will play here.
          </p>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={src}
          className="absolute inset-0 h-full w-full object-contain"
          playsInline
          autoPlay
          preload="auto"
          onEnded={finish}
          onError={() => setFailed(true)}
        />
      )}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.4em] text-amber-200/60">
        {meta.title} · {meta.dates}
      </div>
      {muted && !failed && (
        <button
          onClick={unmute}
          className="absolute bottom-6 left-6 rounded-sm border border-amber-200/40 bg-black/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-amber-100/90 backdrop-blur-sm transition hover:bg-amber-200/10"
        >
          ♪ Sound on
        </button>
      )}
      <button
        onClick={finish}
        className="absolute right-6 bottom-6 rounded-sm border border-amber-200/40 bg-black/50 px-8 py-2.5 text-sm tracking-[0.25em] text-amber-100/90 backdrop-blur-sm transition hover:bg-amber-200/10"
      >
        {failed ? 'CONTINUE →' : 'SKIP →'}
      </button>
    </motion.div>
  );
}
