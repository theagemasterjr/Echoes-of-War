// Works out where each written line falls inside a single narration recording.
//
// The founders record a chapter's whole mission brief in one take on the
// ElevenLabs website (the voice library's "Elderon" is not reachable from the
// API on a free plan, but the site exports it fine). This finds the line
// boundaries in that recording so the words can be typed on screen in time
// with the voice — the recording itself is never re-encoded or cut.
//
// How: convert to mono PCM with macOS's own afconvert, find every stretch of
// near-silence, then pick which of those stretches are the line breaks. The
// pick is not "the longest pauses" — a dramatic pause mid-sentence is often
// longer than a line break. It is the combination that makes every line read
// at the most similar speed, measured in characters per second, which is what
// actually distinguishes a break between lines from a pause inside one.
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const WINDOW_S = 0.02; // energy is measured in 20ms windows
const QUIET_FRACTION = 0.02; // "silent" = under 2% of the recording's peak
const MIN_GAP_S = 0.25; // shorter dips are breaths, not pauses

/** Mono 16-bit PCM at 16kHz — plenty for finding silence. */
async function toPcm(mp3Path) {
  const wav = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'eow-brief-')), 'a.wav');
  try {
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', mp3Path, wav], {
      stdio: 'pipe',
    });
  } catch (e) {
    throw new Error(
      `Could not read ${path.basename(mp3Path)} with afconvert (macOS audio tool): ${e.message}`,
    );
  }
  const buf = await fs.readFile(wav);
  await fs.rm(path.dirname(wav), { recursive: true, force: true });

  let off = 12;
  while (off < buf.length - 8) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') return { buf, offset: off + 8, samples: Math.floor(size / 2), rate: 16000 };
    off += 8 + size + (size % 2);
  }
  throw new Error('no PCM data found in the converted audio');
}

/** Stretches of near-silence, plus where speech starts and stops overall. */
function findQuietStretches({ buf, offset, samples, rate }) {
  const win = Math.floor(rate * WINDOW_S);
  const level = [];
  for (let i = 0; i + win <= samples; i += win) {
    let sum = 0;
    for (let k = 0; k < win; k++) {
      const v = buf.readInt16LE(offset + (i + k) * 2) / 32768;
      sum += v * v;
    }
    level.push(Math.sqrt(sum / win));
  }
  const threshold = Math.max(...level) * QUIET_FRACTION;

  const quiet = [];
  let runStart = -1;
  for (let i = 0; i <= level.length; i++) {
    const isQuiet = i < level.length && level[i] < threshold;
    if (isQuiet && runStart < 0) runStart = i;
    if (!isQuiet && runStart >= 0) {
      quiet.push({ start: runStart * WINDOW_S, end: i * WINDOW_S });
      runStart = -1;
    }
  }
  const total = level.length * WINDOW_S;
  const leading = quiet.length && quiet[0].start === 0 ? quiet[0].end : 0;
  const last = quiet[quiet.length - 1];
  const trailing = last && last.end >= total - 1e-9 ? last.start : total;
  return {
    total,
    speechStart: leading,
    speechEnd: trailing,
    gaps: quiet.filter(
      (q) => q.end - q.start >= MIN_GAP_S && q.start > leading && q.end < trailing,
    ),
  };
}

/**
 * Choose which gaps are the line breaks: the split where every line comes out
 * closest to the share of the speaking time its length deserves.
 * Straightforward dynamic programming over the candidate gaps.
 */
function chooseBreaks(lines, gaps, speechStart, speechEnd) {
  const need = lines.length - 1;
  if (need === 0) return [];
  if (gaps.length < need) {
    throw new Error(
      `found only ${gaps.length} pause(s) in the recording but need ${need} to separate ` +
        `${lines.length} lines — is this the right file, and does it read every line?`,
    );
  }
  const chars = lines.map((l) => l.length);
  const totalChars = chars.reduce((a, b) => a + b, 0);
  const totalSpeech = speechEnd - speechStart;
  const want = chars.map((c) => (c / totalChars) * totalSpeech);

  // cost of line `li` running from `from` to `to`
  const cost = (li, from, to) => {
    const got = to - from;
    if (got <= 0.15) return Infinity; // no line is a fifth of a second long
    const ratio = got / want[li];
    return (ratio - 1) ** 2; // symmetric-ish penalty for too fast / too slow
  };

  // best[li][gi] = cheapest way to place lines li.. given line li starts after gap gi-1
  const G = gaps.length;
  const memo = new Map();
  const solve = (li, startTime, gi) => {
    if (li === lines.length - 1) return { cost: cost(li, startTime, speechEnd), picks: [] };
    const key = `${li}|${gi}`;
    const hit = memo.get(key);
    if (hit) return hit;
    let best = { cost: Infinity, picks: [] };
    // leave enough gaps for the lines that still have to be placed
    for (let g = gi; g <= G - (lines.length - 1 - li); g++) {
      const here = cost(li, startTime, gaps[g].start);
      if (!isFinite(here)) continue;
      const rest = solve(li + 1, gaps[g].end, g + 1);
      const total = here + rest.cost;
      if (total < best.cost) best = { cost: total, picks: [g, ...rest.picks] };
    }
    memo.set(key, best);
    return best;
  };

  const { cost: total, picks } = solve(0, speechStart, 0);
  if (!isFinite(total)) throw new Error('could not fit the written lines to the recording');
  return picks;
}

/**
 * Per-line { text, start, end } for a single-take narration file.
 * Times are seconds into the recording; the silence between lines is left in
 * the audio, so the screen simply holds the last line while the voice pauses.
 */
export async function segmentNarration(mp3Path, lines) {
  const pcm = await toPcm(mp3Path);
  const { gaps, speechStart, speechEnd, total } = findQuietStretches(pcm);
  const picks = chooseBreaks(lines, gaps, speechStart, speechEnd);

  const round = (n) => Math.round(n * 1000) / 1000;
  const out = [];
  let from = speechStart;
  lines.forEach((text, i) => {
    const to = i === lines.length - 1 ? speechEnd : gaps[picks[i]].start;
    out.push({ text, start: round(from), end: round(to) });
    if (i < lines.length - 1) from = gaps[picks[i]].end;
  });
  return { lines: out, duration: round(total) };
}
