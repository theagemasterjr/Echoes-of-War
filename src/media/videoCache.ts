'use client';
/**
 * Films are downloaded *before* the player reaches them, so a chapter's intro
 * never opens on a black screen that stutters while it buffers.
 *
 * The trick: each film gets one hidden <video> element that starts buffering
 * early. When the beat finally plays, `claimVideo` hands that same, already
 * filled element to the player — no second download, no waiting. Files are
 * fetched one at a time so they never fight each other (or the 3D models) for
 * bandwidth, and a claimed film always jumps the queue.
 *
 * Nothing here can break playback: if a film hasn't finished buffering (or was
 * never queued), the player still gets a working element and streams it the
 * old way.
 */
import { create } from 'zustand';

type Status = 'queued' | 'loading' | 'ready' | 'failed';

interface Entry {
  el: HTMLVideoElement;
  status: Status;
}

const entries = new Map<string, Entry>();
let queue: string[] = [];
/** the one file currently downloading in the background (null = slot free) */
let downloading: string | null = null;
/** the queue idles until the page itself has finished loading */
let started = false;

/** Give up waiting on a file after this and let the next one have the pipe. */
const SLOT_TIMEOUT_MS = 45_000;

function ensure(src: string): Entry {
  let entry = entries.get(src);
  if (entry) return entry;
  const el = document.createElement('video');
  el.preload = 'auto';
  el.playsInline = true;
  el.setAttribute('playsinline', ''); // iOS honours the attribute, not the prop
  entry = { el, status: 'queued' };
  entries.set(src, entry);
  return entry;
}

/** Start the actual download for a file that's only been reserved so far. */
function begin(src: string) {
  const entry = ensure(src);
  if (entry.status !== 'queued') return;
  entry.status = 'loading';
  downloading = src;

  const freeSlot = () => {
    if (downloading === src) {
      downloading = null;
      pump();
    }
  };
  const settle = (status: Status) => {
    if (entry.status === 'loading') entry.status = status;
    clearTimeout(timer);
    freeSlot();
  };
  const timer = setTimeout(freeSlot, SLOT_TIMEOUT_MS);

  // "can play through" = the browser reckons it can run the whole film without
  // stopping to buffer. That's exactly the point where the next one may start.
  entry.el.addEventListener('canplaythrough', () => settle('ready'), { once: true });
  entry.el.addEventListener('error', () => settle('failed'), { once: true });
  entry.el.src = src;
  entry.el.load();
}

function pump() {
  if (!started || downloading) return;
  const next = queue.shift();
  if (next) begin(next);
}

/** Let the background downloads run — called once the page has settled. */
export function startPreloading() {
  if (started || typeof window === 'undefined') return;
  const go = () => {
    started = true;
    pump();
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

/** Queue a film to be fetched quietly in the background. Safe to call often. */
export function preloadVideo(src: string) {
  if (typeof document === 'undefined' || entries.has(src) || queue.includes(src)) return;
  ensure(src);
  queue.push(src);
  pump();
}

/** Move a film to the front of the queue — used when the player hovers a
 *  chapter marker, so the film they're about to open loads first. */
export function prioritizeVideo(src: string) {
  const i = queue.indexOf(src);
  if (i > 0) queue.unshift(...queue.splice(i, 1));
}

/**
 * Hand the buffered element over for playback, starting its download right
 * away if the queue hadn't reached it yet.
 */
export function claimVideo(src: string): Entry {
  const entry = ensure(src);
  queue = queue.filter((s) => s !== src);
  if (entry.status === 'queued') begin(src);
  return entry;
}

/** Playback finished with this element — park it, still buffered, for replays. */
export function releaseVideo(src: string) {
  const entry = entries.get(src);
  if (!entry) return;
  entry.el.pause();
  entry.el.muted = false;
  try {
    entry.el.currentTime = 0;
  } catch {
    /* not seekable yet — nothing to rewind */
  }
}

/** True while a fullscreen film is actually playing. The 3D canvas pauses
 *  itself while this is on, so nothing competes with the film for the GPU. */
export const useVideoPlayback = create<{
  playing: boolean;
  setPlaying: (playing: boolean) => void;
}>((set) => ({
  playing: false,
  setPlaying: (playing) => set({ playing }),
}));
