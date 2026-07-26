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
 * Falls back to muted playback when the browser blocks sound, and reports
 * failure so the caller can show its own "couldn't play" frame.
 */
export function BufferedVideo({
  src, className, elementRef, onEnded, onError, onMuted,
}: {
  src: string;
  className?: string;
  /** filled with the live element, for callers that need to mute/pause it */
  elementRef?: React.MutableRefObject<HTMLVideoElement | null>;
  onEnded: () => void;
  onError: () => void;
  /** the browser refused sound — the caller offers a one-tap unmute */
  onMuted: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // held in a ref so swapping callbacks never restarts the film
  const cbs = useRef({ onEnded, onError, onMuted });
  cbs.current = { onEnded, onError, onMuted };

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

    // sound first; browsers that block it get muted playback + an unmute button
    el.play().catch(() => {
      el.muted = true;
      cbs.current.onMuted();
      el.play().catch(() => cbs.current.onError());
    });

    return () => {
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
