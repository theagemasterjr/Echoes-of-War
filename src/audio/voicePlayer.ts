'use client';
/**
 * Character voice playback (ElevenLabs TTS via /api/tts). Sibling of
 * audioManager and holds the same fail-silent doctrine: every step is
 * try/caught, any non-200 or error is a silent skip, and a missing voice key
 * simply means no voice — never a crash and never a blocked conversation.
 *
 * Always downstream of a click (the player sent a message or pressed a chip),
 * so autoplay policy does not block it. Never queues retries — stale speech
 * over a newer line is worse than silence.
 */
import type { ChapterId } from '@/chapters/types';

let el: HTMLAudioElement | null = null;
let url: string | null = null;
let volume = 0.8;
let token = 0; // bumps on every speak()/stop() so stale fetches drop their result

// Voice-mode support: listeners hear when a line starts and (naturally) ends.
// stop() ends silently — a manual stop must not trigger "auto-listen next".
type VoiceEvent = 'start' | 'end';
let playing = false;
let durationSec = 0; // length of the line now playing — paces the on-screen text
const listeners = new Set<(e: VoiceEvent) => void>();
function emit(e: VoiceEvent) {
  listeners.forEach((l) => {
    try {
      l(e);
    } catch {}
  });
}

function ensureEl(): HTMLAudioElement | null {
  if (el) return el;
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  try {
    el = new Audio();
    el.preload = 'auto';
    el.addEventListener('error', () => {});
    return el;
  } catch {
    return null;
  }
}

function revoke() {
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
    url = null;
  }
}

export const voicePlayer = {
  setVolume(v: number) {
    volume = Math.max(0, Math.min(1, v));
    if (el) el.volume = volume;
  },

  /** Is a character line playing right now? */
  get speaking() {
    return playing;
  },

  /** Seconds of the line now playing (0 if unknown) — paces the on-screen text. */
  get durationSec() {
    return durationSec;
  },

  /** Hear 'start'/'end' of spoken lines (used by voice mode). Returns unsubscribe. */
  subscribe(cb: (e: VoiceEvent) => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  stop() {
    token++;
    playing = false; // silent — no 'end' event for a manual stop
    try {
      el?.pause();
    } catch {}
    revoke();
  },

  async speak(text: string, chapterId: ChapterId) {
    const audio = ensureEl();
    if (!audio || !text.trim()) return;
    const mine = ++token; // this call owns playback until the next speak/stop
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chapterId, text: text.slice(0, 700) }),
      });
      if (!res.ok || mine !== token) return; // no voice, error, or superseded
      const blob = await res.blob();
      if (mine !== token) return;

      revoke();
      url = URL.createObjectURL(blob);
      audio.src = url;
      audio.volume = volume;

      audio.onended = () => {
        playing = false;
        emit('end');
      };

      await audio.play();
      if (mine === token) {
        durationSec = isFinite(audio.duration) ? audio.duration : 0;
        playing = true;
        emit('start');
      }
    } catch {
      // Silent skip — subtitles carry the line regardless.
    }
  },
};
