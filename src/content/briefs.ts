import type { ChapterId } from '@/chapters/types';
import data from './briefs.json';

/**
 * Mission briefs — the narrated black screen between a chapter's intro film
 * and its conversation. The text lives in briefs.json (the founders' editing
 * surface); the spoken audio is pre-generated into public/audio/brief by
 * `npm run build:briefs` and simply played back. Nothing here calls a voice
 * API at runtime.
 *
 * Every chapter uses this same screen. A chapter with no entry in briefs.json
 * skips the brief and goes straight from its film into the conversation.
 */
export interface MissionBrief {
  lines: string[];
  /** Wording on the final button. */
  accept: string;
}

const CHAPTERS = data.chapters as Partial<
  Record<ChapterId, { lines: string[]; accept?: string }>
>;

export function briefFor(chapterId: ChapterId): MissionBrief | null {
  const entry = CHAPTERS[chapterId];
  const lines = (entry?.lines ?? []).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return { lines, accept: entry?.accept?.trim() || 'I ACCEPT' };
}

export function hasBrief(chapterId: ChapterId): boolean {
  return briefFor(chapterId) !== null;
}

/**
 * What scripts/build-brief-audio.mjs leaves behind. A chapter's narration is
 * held one of two ways, and the screen plays whichever it finds:
 *
 * - `track` — one hand-recorded take of the whole brief, with each line's
 *   start/end time inside it. The silence between lines is part of the
 *   recording, so the screen simply holds while the narrator pauses.
 * - per-line `file`s — one clip per line, generated through the API, each
 *   with a time for every character.
 */
export interface BriefAudioLine {
  text: string;
  /** Per-line clip (API path). */
  file?: string;
  /** Seconds of speech in this clip (API path). */
  duration?: number;
  /** Start time of each character of `text` (API path) — drives the typing. */
  charStarts?: number[];
  /** Seconds into the single take where this line starts / ends (take path). */
  start?: number;
  end?: number;
}

export interface BriefAudioChapter {
  /** Present when the chapter is one hand-recorded take. */
  track?: string;
  trackHash?: string;
  duration?: number;
  voiceName?: string;
  lines: BriefAudioLine[];
}

export interface BriefAudioManifest {
  version: 1;
  voiceId: string;
  voiceName: string;
  chapters: Partial<Record<ChapterId, BriefAudioChapter>>;
}

export const BRIEF_MANIFEST_URL = '/audio/brief/manifest.json';

/** Silence held between spoken lines, so the briefing never feels rushed. */
export const BRIEF_LINE_GAP_MS = 850;
/** Reading pace used when a line has no audio (voice not generated yet). */
export const BRIEF_SILENT_CPS = 26;
