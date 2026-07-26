'use client';
import { useEffect, useRef } from 'react';
import { claimVideo, releaseVideo, useVideoPlayback } from './videoCache';
import { useSettingsStore } from '@/state/settingsStore';

/**
 * Plays a film using the copy already buffered by `videoCache` — so the picture
 * starts on the first frame instead of spinning while it downloads. The element
 * is created outside React (it has to outlive this component to stay buffered),
 * so it's slotted into the host div by hand rather than rendered as JSX.
 *
 * Films always play WITH SOUND. There is no muted fallback and no "sound on"
 * button anywhere in the game: every film is reached by a click (a chapter pin,
 * a continue button), which is exactly the permission browsers ask for, so the
 * first play() succeeds. The two retry paths below are safety nets, not the
 * normal route — and neither of them ever mutes the picture.
 */
export function BufferedVideo({
  src, className, elementRef, onEnded, onError,
}: {
  src: string;
  className?: string;
  /** filled with the live element, for callers that need to pause it */
  elementRef?: React.MutableRefObject<HTMLVideoElement | null>;
  onEnded: () => void;
  onError: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // held in a ref so swapping callbacks never restarts the film
  const cbs = useRef({ onEnded, onError });
  cbs.current = { onEnded, onError };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const { setPlaying } = useVideoPlayback.getState();
    const entry = claimVideo(src);
    const el = entry.el;

    if (entry.status === 'failed' || el.error) {
      cbs.current.onError();
      return;
    }

    el.className = className ?? '';
    el.muted = false;
    // films obey the game's volume like everything else — otherwise turning
    // the sound down silences the narration and the character voices while
    // the films keep playing at full blast, which reads as a broken game
    el.volume = useSettingsStore.getState().volume;
    try {
      el.currentTime = 0; // rewind, in case this is a replay
    } catch {
      /* not seekable yet — it starts at 0 anyway */
    }
    host.appendChild(el);
    if (elementRef) elementRef.current = el;

    const handleEnded = () => {
      setPlaying(false);
      cbs.current.onEnded();
    };
    const handleError = () => {
      setPlaying(false);
      cbs.current.onError();
    };
    const handlePlaying = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    el.addEventListener('ended', handleEnded);
    el.addEventListener('error', handleError);
    el.addEventListener('playing', handlePlaying);
    el.addEventListener('pause', handlePause);

    // ---- start it, with sound, and keep trying with sound ------------------
    let cancelled = false;
    /** listeners the retry paths install; all torn down on unmount */
    let onCanPlay: (() => void) | null = null;
    let onGesture: (() => void) | null = null;

    const clearGesture = () => {
      if (!onGesture) return;
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      onGesture = null;
    };
    const clearCanPlay = () => {
      if (!onCanPlay) return;
      el.removeEventListener('canplay', onCanPlay);
      onCanPlay = null;
    };

    const attempt = (retriesLeft: number) => {
      if (cancelled) return;
      el.muted = false; // never, ever silently
      el.play().catch((err: unknown) => {
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? '';
        if (name === 'NotAllowedError') {
          // the browser wants a gesture it can point at — take the next one
          if (onGesture) return;
          onGesture = () => {
            clearGesture();
            attempt(retriesLeft);
          };
          window.addEventListener('pointerdown', onGesture, { once: true });
          window.addEventListener('keydown', onGesture, { once: true });
          return;
        }
        // AbortError / load race: the source was still settling. Wait until the
        // element says it can play and ask again — once.
        if (retriesLeft > 0) {
          if (onCanPlay) return;
          onCanPlay = () => {
            clearCanPlay();
            attempt(retriesLeft - 1);
          };
          el.addEventListener('canplay', onCanPlay, { once: true });
          return;
        }
        cbs.current.onError();
      });
    };
    attempt(1);

    return () => {
      cancelled = true;
      clearGesture();
      clearCanPlay();
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('error', handleError);
      el.removeEventListener('playing', handlePlaying);
      el.removeEventListener('pause', handlePause);
      setPlaying(false);
      el.remove();
      if (elementRef) elementRef.current = null;
      releaseVideo(src);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
