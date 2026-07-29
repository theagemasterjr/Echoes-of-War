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

// Voice on/off (settings toggle, default on). This is THE gate for every
// character line: speak() below returns before it ever calls fetch, so
// switching this off costs zero ElevenLabs tokens — nothing to skip
// downstream, callers never even reach the network.
let enabled = true;

// Voice-mode support: listeners hear when a line starts and (naturally) ends.
// stop() ends silently — a manual stop must not trigger "auto-listen next".
type VoiceEvent = 'start' | 'end';
let playing = false;
let pending = false; // a speak() is fetching audio that has not started yet
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
    // a clip failing MID-play must release the line like a natural end —
    // otherwise the subtitle pacing and the talking animation freeze on it
    el.addEventListener('error', () => {
      if (!playing) return;
      playing = false;
      durationSec = 0;
      emit('end');
    });
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

  /** Settings toggle. Turning it off cuts whatever is speaking right now
   *  (silently — no 'end' event, same as stop()) and every speak() call
   *  after this returns before it fetches anything. */
  setEnabled(v: boolean) {
    enabled = v;
    if (!enabled) this.stop();
  },

  /** Is voice currently allowed to play at all? */
  get enabled() {
    return enabled;
  },

  /** Is a character line playing right now? */
  get speaking() {
    return playing;
  },

  /** Is a line's audio on its way (fetched, not yet playing)? The subtitle
   *  and the talking animation hold for a pending line so words, mouth and
   *  sound land together — and give up waiting the moment this goes false
   *  without playback (the fetch failed, or voice is off). */
  get pending() {
    return pending;
  },

  /** Seconds of the line now playing (0 if unknown) — paces the on-screen text. */
  get durationSec() {
    return durationSec;
  },

  /** How far into the line the voice is, in seconds. The subtitle reads this
   *  every tick and picks the sentence being spoken, so the words track the
   *  voice exactly instead of running on pre-computed timers that drift. */
  get currentTime() {
    if (!el || !playing) return 0;
    const t = el.currentTime;
    return isFinite(t) ? t : 0;
  },

  /** Hear 'start'/'end' of spoken lines (used by voice mode). Returns unsubscribe. */
  subscribe(cb: (e: VoiceEvent) => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  stop() {
    token++;
    playing = false; // silent — no 'end' event for a manual stop
    pending = false;
    durationSec = 0;
    try {
      if (el) el.onended = null; // the pause below must not read as a natural end
      el?.pause();
    } catch {}
    revoke();
  },

  async speak(text: string, chapterId: ChapterId) {
    if (!enabled) return; // voice is off — never fetch, never play
    const audio = ensureEl();
    if (!audio || !text.trim()) return;
    const mine = ++token; // this call owns playback until the next speak/stop
    // A newer line supersedes whatever is still talking: cut it now, and clear
    // the old duration so the incoming subtitle never paces itself to it.
    playing = false;
    pending = true; // the subtitle/animation hold for this line from here on
    durationSec = 0;
    try {
      audio.onended = null;
      audio.pause();
    } catch {}
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
        durationSec = 0;
        emit('end');
      };
      // duration is what the subtitle divides the line by, so take it the
      // moment the header is parsed rather than hoping play() has it
      audio.onloadedmetadata = () => {
        if (mine === token && isFinite(audio.duration)) durationSec = audio.duration;
      };

      await audio.play();
      if (mine === token) {
        if (!durationSec && isFinite(audio.duration)) durationSec = audio.duration;
        pending = false;
        playing = true;
        emit('start');
      }
    } catch {
      // Silent skip — subtitles carry the line regardless.
    } finally {
      // Whatever happened — started, failed, or errored — this call is no
      // longer "on its way", and anyone holding for it may act. A superseded
      // call leaves `pending` alone: it belongs to the newer speak() now.
      if (mine === token) pending = false;
    }
  },
};
