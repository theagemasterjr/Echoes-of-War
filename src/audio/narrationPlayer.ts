'use client';
/**
 * The mission-brief narrator's voice.
 *
 * Browsers only let a page make sound the player asked for. The briefing screen
 * is a problem for that rule: it opens by itself when the intro film ends, so
 * nothing the player did is "responsible" for the sound, and some browsers
 * (Safari especially, and Chrome when the page has seen little interaction)
 * simply refuse — the words then type themselves out in silence.
 *
 * The fix is to claim permission early: one audio element is created up front
 * and, on the player's very FIRST tap or key press anywhere in the game, it is
 * quietly played for a fraction of a second of silence. That is enough for the
 * browser to treat this element as one the player asked for, so the briefing
 * can speak later without needing a button of its own.
 *
 * Everything here fails silently. If the unlock does not take, the briefing
 * still runs and offers sound with a tap.
 */

/** ~0.03s of silence. Playing this is what earns the permission. */
const SILENCE =
  'data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YcgAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

let el: HTMLAudioElement | null = null;
let unlocked = false;

/** The one element every mission brief plays through. */
export function narrationAudio(): HTMLAudioElement | null {
  if (el) return el;
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  try {
    el = new Audio();
    el.preload = 'auto';
    // in the document so it behaves like any other player and can be inspected
    el.setAttribute('data-narration', '');
    el.style.display = 'none';
    document.body.appendChild(el);
  } catch {
    el = null;
  }
  return el;
}

export const narrationIsUnlocked = () => unlocked;

/**
 * Who currently owns the narrator's voice.
 *
 * A screen claims it while it is up and releases it on the way out. The
 * release is deliberately deferred a moment: React mounts a screen, tears it
 * down and mounts it again while developing, and a release that took effect
 * straight away would silence the very briefing that had just started. A
 * screen that comes back reclaims it and the stop never happens; a screen the
 * player really left stops a moment later, which no one can hear.
 */
let owner = 0;
let stopping: ReturnType<typeof setTimeout> | null = null;

export function claimNarration(): number {
  if (stopping) {
    clearTimeout(stopping);
    stopping = null;
  }
  return ++owner;
}

export function releaseNarration(token: number) {
  if (stopping) clearTimeout(stopping);
  stopping = setTimeout(() => {
    stopping = null;
    if (token === owner) narrationAudio()?.pause();
  }, 120);
}

const EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

function stopListening() {
  EVENTS.forEach((e) => window.removeEventListener(e, unlock, true));
}

function unlock() {
  if (unlocked) return stopListening();
  const a = narrationAudio();
  if (!a) return;
  // don't disturb a briefing that is already speaking
  if (!a.paused) {
    unlocked = true;
    return stopListening();
  }
  const wasMuted = a.muted;
  a.muted = true;
  a.src = SILENCE;
  a.play().then(
    () => {
      a.pause();
      a.muted = wasMuted;
      // Leave the element EMPTY, not holding the silence. A briefing that
      // later points it at a real file would otherwise be swapping the source
      // out from under a loaded clip, and the browser cancels the play request
      // that goes with it — the permission survives, but nothing is heard.
      a.removeAttribute('src');
      a.load();
      unlocked = true;
      stopListening();
    },
    () => {
      a.muted = wasMuted; // no permission yet — a later tap may still earn it
    },
  );
}

if (typeof window !== 'undefined') {
  EVENTS.forEach((e) => window.addEventListener(e, unlock, true));
}
