import { createHash } from 'crypto';
import type { ChapterId } from '@/chapters/types';
import { readCacheFile, writeCacheFile } from './diskCache';

/**
 * Server-only ElevenLabs text-to-speech. Strictly additive to the app: ANY
 * failure — missing key, missing voice, network error, non-200 — returns null,
 * and the caller degrades to silent subtitles. Unlike the chat provider this reads
 * the env key inside the call (no module-level throw), so a deploy without an
 * ElevenLabs key still boots and runs the conversation.
 */

const TTS_MODEL = 'eleven_flash_v2_5';

/** Per-chapter voice. Founders pick real voices via env; a stock voice stands in. */
const VOICE_IDS: Partial<Record<ChapterId, string>> = {
  // 'cgSgspJ2msm6clMCkdW9' = ElevenLabs stock "Jessica" (young, bright, warm female — founder's pick).
  ch1: process.env.ELEVENLABS_VOICE_CH1 ?? 'cgSgspJ2msm6clMCkdW9',
};

export function voiceFor(chapterId: ChapterId): string | undefined {
  return VOICE_IDS[chapterId];
}

// Small FIFO cache so intros, deflections and REPEAT are free (no re-synth).
const CACHE_MAX = 40;
const cache = new Map<string, ArrayBuffer>();

function cacheGet(key: string): ArrayBuffer | undefined {
  return cache.get(key);
}
function cacheSet(key: string, buf: ArrayBuffer) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, buf);
}

/**
 * Synthesize `text` for a chapter's voice. Returns the mp3 bytes, or null on
 * any failure. Buffered (not streamed) — replies are ≤110 words, so the whole
 * clip fits in one short response. (Streaming alternative: hit the
 * `/stream` endpoint and pipe its body straight through as a ReadableStream —
 * lower time-to-first-byte, more moving parts; not worth it at this length.)
 */
export async function synthesize(
  text: string,
  chapterId: ChapterId,
): Promise<ArrayBuffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = voiceFor(chapterId);
  if (!apiKey || !voiceId) return null;

  const clean = text.trim();
  if (!clean) return null;

  const key = `${voiceId}|${clean}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  // Disk cache: fixed lines (intro, deflections, chapter summary) are
  // synthesized exactly once ever and saved — repeats are free.
  const file = `${createHash('sha1').update(key).digest('hex')}.mp3`;
  const onDisk = await readCacheFile(file);
  if (onDisk && onDisk.byteLength) {
    const buf = new Uint8Array(onDisk).slice().buffer;
    cacheSet(key, buf);
    return buf;
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text: clean, model_id: TTS_MODEL }),
      },
    );
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) return null;
    cacheSet(key, buf);
    writeCacheFile(file, Buffer.from(buf)); // fire-and-forget
    return buf;
  } catch {
    return null;
  }
}
