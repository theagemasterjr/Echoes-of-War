// Pre-generates the fixed spoken lines (chapter summary + deflections) ONCE,
// saving them into .tts-cache/ with the same names src/server/tts.ts uses —
// so live use never re-bills ElevenLabs for them.
// Texts are copies of src/chapters/ch1/TimelineMinigame.tsx (SUMMARY) and
// src/content/trees/ch1.ts (deflections); if those change, the cache simply
// re-fills itself once on next play — no need to keep this file in sync.
// Run: node scripts/prewarm-tts.mjs
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const env = Object.fromEntries(
  (await fs.readFile('.env.local', 'utf8'))
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const KEY = env.ELEVENLABS_API_KEY;
const VOICE = env.ELEVENLABS_VOICE_CH1 || 'cgSgspJ2msm6clMCkdW9';
if (!KEY) throw new Error('ELEVENLABS_API_KEY missing from .env.local');

// Must match src/server/tts.ts exactly.
const MODEL = 'eleven_flash_v2_5';
const FORMAT = 'mp3_22050_32';

const LINES = [
  // chapter summary (TimelineMinigame SUMMARY_SPOKEN)
  'The Treaty of Versailles. The treaty ended World War I and punished Germany. Many Germans felt it was unfair. ' +
    'Germany under the treaty. When the Great Depression hit, jobs vanished. Angry, struggling people turned to extreme leaders. ' +
    'Hitler’s rise to power. Hitler took power in 1933, rebuilt the army, and took land step by step — and no one stopped him. ' +
    'How Poland was conquered. After a deal with the Soviet Union, Germany invaded Poland on 1 September 1939. Britain and France declared war. World War II had begun.',
  // ch1 deflections
  'He straightens the papers on the desk. “I have read the news through shelling tonight. I will not trade insults. Ask me what is happening here, and I will tell you plainly.”',
  '“A strange question for a night like this. I am a man at a microphone in Warsaw, and the war will not wait for riddles. Ask me what you really want to know.”',
  '“The lines are overloaded — half the city is trying to place a call at once. Give it a little while, then ask me again.”',
];

const DIR = path.join(process.cwd(), '.tts-cache');
await fs.mkdir(DIR, { recursive: true });

for (const text of LINES) {
  const clean = text.trim();
  const file = createHash('sha1').update(`${VOICE}|${clean}`).digest('hex') + '.mp3';
  const dest = path.join(DIR, file);
  try {
    await fs.access(dest);
    console.log('already cached:', clean.slice(0, 50) + '…');
    continue;
  } catch {}
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=${FORMAT}`,
    {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: clean, model_id: MODEL }),
    },
  );
  if (!res.ok) {
    console.error('FAILED', res.status, clean.slice(0, 50) + '…');
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  console.log('saved', file, `(${Math.round(buf.byteLength / 1024)}kB):`, clean.slice(0, 50) + '…');
}
