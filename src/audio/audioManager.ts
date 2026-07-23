/**
 * Audio layer. This fills in the previously-silent stub with the app's one
 * music bed (id 'main-theme', public/audio/main-theme.mp3): looping playback,
 * smooth fade in/out, and the master volume slider. play()/stop() are still
 * the whole API — callers (MusicDirector, settingsStore) never changed.
 *
 * Autoplay-safe by construction: play() always attempts playback, but if the
 * browser blocks it (no user gesture yet) the rejection is swallowed and a
 * one-time gesture listener retries it. Never throws — a missing/broken audio
 * file degrades to silence, not a crash.
 */

type TrackId = 'main-theme';

const TRACK_SRC: Record<TrackId, string> = {
  'main-theme': '/audio/main-theme.mp3',
};

/** ~1.5-2s fade, per the cinematic transition budget elsewhere in the app. */
const FADE_MS = 1750;

function isTrackId(id: string): id is TrackId {
  return Object.prototype.hasOwnProperty.call(TRACK_SRC, id);
}

class Track {
  private el: HTMLAudioElement | null = null;
  private rafId: number | null = null;
  private target: 'in' | 'out' = 'out';
  private masterVolume = 0.8;

  constructor(private src: string) {}

  private ensure(): HTMLAudioElement | null {
    if (this.el) return this.el;
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    try {
      const el = new Audio(this.src);
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0;
      // Missing/broken file: fail silent, never surface as an app error.
      el.addEventListener('error', () => {});
      this.el = el;
      return el;
    } catch {
      return null;
    }
  }

  private attemptPlay() {
    const el = this.ensure();
    if (!el || !el.paused) return;
    try {
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Blocked by autoplay policy or asset missing — a later gesture
          // (see ensureGestureListener) or the next play() call retries.
        });
      }
    } catch {
      // Some environments throw synchronously instead of rejecting.
    }
  }

  private fadeTo(target: number, then?: () => void) {
    const el = this.ensure();
    if (!el) return;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    const start = el.volume;
    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / FADE_MS);
      const v = start + (target - start) * t;
      if (this.el) this.el.volume = Math.max(0, Math.min(1, v));
      if (t < 1) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.rafId = null;
        then?.();
      }
    };
    this.rafId = requestAnimationFrame(step);
  }

  setVolume(v: number) {
    this.masterVolume = v;
    if (this.target === 'in') this.fadeTo(v);
  }

  play() {
    if (this.target === 'in') return;
    this.target = 'in';
    this.attemptPlay();
    this.fadeTo(this.masterVolume);
  }

  stop() {
    if (this.target === 'out') return;
    this.target = 'out';
    this.fadeTo(0, () => {
      if (this.target === 'out') this.el?.pause();
    });
  }

  /** Retry a play() that autoplay policy blocked, now that a gesture landed. */
  retryIfPending() {
    if (this.target === 'in') this.attemptPlay();
  }

  /** Hard pause for a hidden tab (no fade — rAF is throttled there anyway). */
  suspend() {
    try {
      this.el?.pause();
    } catch {}
  }

  /** Undo suspend() when the tab is visible again. */
  resume() {
    if (this.target === 'in') this.attemptPlay();
  }
}

const tracks = new Map<TrackId, Track>();
function trackFor(id: TrackId): Track {
  let t = tracks.get(id);
  if (!t) {
    t = new Track(TRACK_SRC[id]);
    t.setVolume(audioManager.volume);
    tracks.set(id, t);
  }
  return t;
}

let gestureListenerAttached = false;
function ensureGestureListener() {
  if (gestureListenerAttached || typeof window === 'undefined') return;
  gestureListenerAttached = true;
  const retry = () => tracks.forEach((t) => t.retryIfPending());
  window.addEventListener('pointerdown', retry, { passive: true });
  window.addEventListener('keydown', retry);
}

export const audioManager = {
  volume: 0.8,
  setVolume(v: number) {
    this.volume = v;
    tracks.forEach((t) => t.setVolume(v));
  },
  play(id: string) {
    if (!isTrackId(id)) return;
    ensureGestureListener();
    trackFor(id).play();
  },
  stop(id: string) {
    if (!isTrackId(id)) return;
    trackFor(id).stop();
  },
  /** Tab hidden → silence immediately; tab visible → pick up where we were. */
  suspendAll() {
    tracks.forEach((t) => t.suspend());
  },
  resumeAll() {
    tracks.forEach((t) => t.resume());
  },
};
