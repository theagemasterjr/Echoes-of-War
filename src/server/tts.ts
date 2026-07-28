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
  // 'JBFqnCBsd6RMkjVDRZzb' = ElevenLabs stock "George" (British male).
  // TODO(founder): verify this voice id in your ElevenLabs library (a wrong id
  // just means silence) and pick the young-British-male voice you like —
  // setting ELEVENLABS_VOICE_CH2 overrides it without a code change.
  ch2: process.env.ELEVENLABS_VOICE_CH2 ?? 'JBFqnCBsd6RMkjVDRZzb',
  // 'bIHbv24MWmeRgasZH58o' = ElevenLabs stock "Will" (American, young, male,
  // relaxed/conversational) — a good fit for nineteen-year-old Ray Doyle.
  // Verified against this account: it is in the voice library and synthesizes
  // (200, audio/mpeg) with TTS_MODEL below.
  // Was 'TxGEqnHWrfWFTfGW9XjX', which is why ch3 was silent: that id is no
  // longer the old stock "Josh" — it now resolves to a PROFESSIONAL voice
  // ("Craig") that this account does not have access to, so every synthesis
  // came back 402 and the `!res.ok` guard below returned null (silence) while
  // the chat text kept working. Only stock/premade voices listed under
  // GET /v1/voices are safe here. Setting ELEVENLABS_VOICE_CH3 overrides this
  // without a code change — but check any replacement id the same way.
  ch3: process.env.ELEVENLABS_VOICE_CH3 ?? 'bIHbv24MWmeRgasZH58o',
  // 'IKne3meq5aSn9XLyUdCD' = ElevenLabs stock "Charlie" (young male) — the
  // closest young-male premade to nineteen-year-old Nikolai, and deliberately
  // NOT ch3's "Will" (the two would otherwise blur together). Verified against
  // this account: it is listed under GET /v1/voices as premade.
  // TODO(founder): audition it — "Roger" (CwhRBWXzGAHq8TQ4Fs17) and "Eric"
  // (cjVigY5qzO86Huf0OWal) are calmer, older-sounding alternates on this
  // account. Setting ELEVENLABS_VOICE_CH4 overrides without a code change;
  // only stock/premade voices listed under GET /v1/voices are safe here — see
  // the ch3 note above for what a professional voice id costs you (silence,
  // with no error on screen).
  ch4: process.env.ELEVENLABS_VOICE_CH4 ?? 'IKne3meq5aSn9XLyUdCD',
  // 'pFZP5JQG7iQjIQuC4Bku' = ElevenLabs stock "Lily" (British female, warm) —
  // Sister Grace Ellery. Deliberately NOT ch2's "George" (the other British
  // voice here) and not any voice another chapter uses; she must sound clearly
  // different from Tom. TODO(founder): audition it ("Alice",
  // Xb7hH8MSUJpSbSDYk0k2, is a crisper British female alternate) and verify
  // the id is listed as premade under GET /v1/voices on this account — a
  // wrong or professional-tier id is silent subtitles with no on-screen
  // error (see the ch3 note). ELEVENLABS_VOICE_CH5 overrides without a code
  // change.
  ch5: process.env.ELEVENLABS_VOICE_CH5 ?? 'pFZP5JQG7iQjIQuC4Bku',
  // 'nPczCjzI2devNBz1zQrb' = ElevenLabs stock "Brian" (mature male, deep and
  // calm) — Dr Kenzo Arita, who is forty-four and speaks quietly. Deliberately
  // the only older male voice here: ch2 "George", ch3 "Will" and ch4 "Charlie"
  // are all young men and would blur into each other and into him.
  // TODO(founder): audition it — "Eric" (cjVigY5qzO86Huf0OWal) and "Roger"
  // (CwhRBWXzGAHq8TQ4Fs17) are the other calm middle-aged premades — and verify
  // the id is listed as premade under GET /v1/voices on this account. A wrong
  // or professional-tier id is silent subtitles with no on-screen error (see
  // the ch3 note above). ELEVENLABS_VOICE_CH6 overrides without a code change.
  ch6: process.env.ELEVENLABS_VOICE_CH6 ?? 'nPczCjzI2devNBz1zQrb',
};

export function voiceFor(chapterId: ChapterId): string | undefined {
  return VOICE_IDS[chapterId];
}

/**
 * Why the last synthesis failed. The player never sees this — voice is
 * optional and failing silently is deliberate — but a silent character is
 * otherwise indistinguishable from a broken one, and this is the difference
 * between "the key ran out" and hours of guessing. Read by /api/tts.
 */
let lastFailure: string | null = null;
export const lastTtsFailure = () => lastFailure;

function noteFailure(reason: string) {
  lastFailure = reason;
  console.warn(`[tts] ${reason}`);
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
    if (!res.ok) {
      // The player still just gets silent subtitles, but "the voice is gone"
      // must never again be a mystery: record why. Every past silence (an
      // exhausted key, a voice the account can't use, a mistyped key) showed
      // up here as a status code and a one-line reason.
      noteFailure(`ElevenLabs ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) {
      noteFailure('ElevenLabs returned an empty clip');
      return null;
    }
    cacheSet(key, buf);
    writeCacheFile(file, Buffer.from(buf)); // fire-and-forget
    return buf;
  } catch (err) {
    noteFailure(`could not reach ElevenLabs: ${(err as Error)?.message ?? 'unknown'}`);
    return null;
  }
}
