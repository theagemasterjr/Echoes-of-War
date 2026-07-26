import type { LearningPoint, ObjectiveDef, StageNode } from '@/conversation/treeTypes';
import { chatComplete, FAST_MODEL } from './openai';

/**
 * Which of the node's still-uncovered learning points has the conversation
 * SO FAR actually covered?
 *
 * Two independent readers, and a point counts if either one is convinced:
 *
 *  1. The cue reader (local, instant, free) — looks only at what the CHARACTER
 *     said and asks "did two different signs of this topic show up in one
 *     answer?". Catches topics discussed in plain kid language, where a grader
 *     might hold out for textbook wording.
 *  2. The grader (a fast model) — reads the whole transcript and judges
 *     substance, catching explanations spread across several turns.
 *
 * Both read the character's answers, never the player's question: asking about
 * the Treaty of Versailles must not tick off the Treaty of Versailles.
 *
 * `objectiveCoverage` further down does the same job for the on-screen
 * Objectives checklist, which is a separate thing from learning points — see
 * the note on ObjectiveDef.
 */

/** Lowercase, strip accents, and flatten punctuation so cue matching is about
 *  the words and never about typography (Wieluń → wielun, “didn’t” → didn t). */
function normalize(text: string): string {
  return ` ${text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/** Does this cue appear as whole words in the normalized text? */
function hasCue(haystack: string, cue: string): boolean {
  const needle = normalize(cue).trim();
  return needle.length > 0 && haystack.includes(` ${needle} `);
}

/** Enough substance for a cue match to mean anything (very short lines like
 *  "The Treaty of Versailles, yes." must not tick a topic off). */
const MIN_REPLY_CHARS = 80;
/** Two different cues in one answer — one stray word is never enough. */
const MIN_CUES = 2;

/** Points whose topic is plainly being explained in this character answer. */
export function cueCoverage(points: LearningPoint[], characterReply: string): string[] {
  if (characterReply.trim().length < MIN_REPLY_CHARS) return [];
  const text = normalize(characterReply);
  return points
    .filter((p) => {
      const hits = new Set<string>();
      for (const cue of p.cues ?? []) {
        if (hasCue(text, cue)) hits.add(cue);
        if (hits.size >= MIN_CUES) return true;
      }
      return false;
    })
    .map((p) => p.id);
}

async function gradedCoverage(
  open: LearningPoint[],
  transcript: string,
): Promise<string[]> {
  try {
    const text = await chatComplete({
      model: FAST_MODEL,
      maxTokens: 150,
      system:
        `You grade an educational dialogue. You are given learning points and the conversation so far. ` +
        `A point counts as covered if the character has explained its substance somewhere in the conversation — ` +
        `the main idea stated in the character's own words, well enough that an attentive kid would take it away. ` +
        `Judge the IDEA, not the vocabulary: everyday phrasing counts just as much as the formal name, and the ` +
        `point's own wording never has to be used. Exact dates and side details are not required, and the ` +
        `explanation may be spread across several turns. ` +
        `If the substance of a point was genuinely discussed, count it — do not withhold credit because it could ` +
        `have been explained more fully. ` +
        `Do NOT count: the player merely asking about it, a vague allusion, or a mention of only the name with no substance. ` +
        `Reply ONLY with a JSON array of the covered ids. Empty array if none. No other text.`,
      messages: [
        {
          role: 'user',
          content:
            `Learning points:\n` +
            open
              .map(
                (p) =>
                  `${p.id}: ${p.text}` +
                  (p.cues?.length ? `\n   (signs this came up: ${p.cues.slice(0, 12).join(', ')})` : ''),
              )
              .join('\n') +
            `\n\nConversation so far:\n${transcript}`,
        },
      ],
    });
    const match = (text || '[]').match(/\[[\s\S]*?\]/);
    const ids: unknown = match ? JSON.parse(match[0]) : [];
    if (!Array.isArray(ids)) return [];
    const valid = new Set(open.map((p) => p.id));
    return ids.filter((i): i is string => typeof i === 'string' && valid.has(i));
  } catch {
    return []; // a failed check just means the point registers on a later turn
  }
}

/**
 * Which of the still-open OBJECTIVES did this one character answer actually
 * cover? This is the second way a row of the on-screen checklist ticks off:
 * the first is the player saying one of its keywords, and this is the
 * character explaining the concept — in whatever words they chose.
 *
 * Judged on MEANING, not wording: a character who describes France
 * surrendering and Britain being left on its own covers "Britain stands
 * alone" without ever saying "armistice". Only this reply is read, so a row
 * ticks off on the turn it was earned.
 *
 * FALSE POSITIVES ARE THE HARD PART, and a prompt alone does not stop them.
 * Asked for ids, a small model happily ticks every topic the reply brushes
 * past: an answer about the Rhineland and Munich came back as "Hitler's rise
 * to power" (his name appears), "Germany invades Poland" (Poland is named in
 * the last clause) and "Germany under the treaty" (the treaty is mentioned).
 * So the model must also QUOTE the sentence that does the explaining, and that
 * quote is checked back against the reply here. A topic it cannot point at in
 * the character's own words does not tick. Failing closed costs nothing — the
 * row ticks off on a later turn instead.
 *
 * Never throws: a failed grading just means the row waits for a later turn.
 */
/** A quote shorter than this cannot be an explanation of anything. */
const MIN_EVIDENCE_CHARS = 40;
/** How much of the quote's own wording must really be in the reply. */
const EVIDENCE_WORD_MATCH = 0.8;

/** Is this quote actually the character's own words, and not a summary the
 *  grader wrote for itself? Verbatim if possible, else near enough. */
function evidenceHolds(evidence: string, reply: string): boolean {
  if (evidence.trim().length < MIN_EVIDENCE_CHARS) return false;
  const hay = normalize(reply);
  const needle = normalize(evidence).trim();
  if (hay.includes(needle)) return true;
  // the grader trimmed or joined a clause — accept if nearly every content
  // word it quoted really is in the reply
  const words = needle.split(' ').filter((w) => w.length > 3);
  if (words.length < 4) return false;
  const found = words.filter((w) => hay.includes(` ${w} `)).length;
  return found / words.length >= EVIDENCE_WORD_MATCH;
}

/** The graded rows, read leniently: quotes are long, so a reply cut off at the
 *  token cap must still yield the rows that did arrive whole rather than
 *  nothing at all. */
function parseRows(text: string): { id?: unknown; quote?: unknown }[] {
  const whole = (text || '').match(/\[[\s\S]*\]/);
  if (whole) {
    try {
      const rows: unknown = JSON.parse(whole[0]);
      if (Array.isArray(rows)) return rows.filter((r) => !!r && typeof r === 'object');
    } catch {
      /* truncated or malformed — fall through to picking off objects */
    }
  }
  const out: { id?: unknown; quote?: unknown }[] = [];
  for (const m of (text || '').matchAll(/\{[^{}]*\}/g)) {
    try {
      const row: unknown = JSON.parse(m[0]);
      if (row && typeof row === 'object') out.push(row);
    } catch {}
  }
  return out;
}

export async function objectiveCoverage(
  open: ObjectiveDef[],
  characterReply: string,
): Promise<string[]> {
  if (open.length === 0) return [];
  // too short to have explained anything — the same bar the cue reader uses
  if (characterReply.trim().length < MIN_REPLY_CHARS) return [];
  try {
    const text = await chatComplete({
      model: FAST_MODEL,
      maxTokens: 700,
      system:
        `You check ONE reply from a historical character against a list of learning objectives, and ` +
        `say which of them this reply TAUGHT.\n\n` +
        `An objective is taught when the reply says something real about its topic — what happened, ` +
        `why it happened, or what it changed — enough that an attentive child would come away ` +
        `understanding it. The explanation may run across several sentences, and an objective made of ` +
        `several steps is taught once the reply has walked through them.\n\n` +
        `Judge the MEANING, not the vocabulary. The objective's own wording never has to appear, and ` +
        `plain everyday phrasing teaches just as well as the formal name. A reply that describes ` +
        `France surrendering and Britain being left on its own teaches "Britain stands alone" without ` +
        `ever using the word "armistice".\n\n` +
        `But a topic is NOT taught when the reply merely brushes past it: a name dropped, a date ` +
        `given, a country named, a topic promised for later — with nothing actually said about it. ` +
        `"Hitler is in charge over there" does not teach how Hitler came to power. "This left Poland ` +
        `in danger" does not teach the invasion of Poland. Naming the treaty does not teach what the ` +
        `treaty did.\n\n` +
        `So for each objective ask: does this reply EXPLAIN it, or does it only MENTION it? ` +
        `Explaining counts, however plainly it is put. Mentioning never counts, however many of the ` +
        `topic's words happen to appear.\n\n` +
        `For every objective you count, QUOTE the part of the reply that teaches it — one sentence, ` +
        `or two or three consecutive sentences — copied EXACTLY, word for word, from the reply. If ` +
        `you cannot quote such a passage, it is not taught. List each objective at most once.\n\n` +
        `Reply ONLY with a JSON array of objects: [{"id":"...","quote":"..."}]. Empty array if none. ` +
        `No other text.`,
      messages: [
        {
          role: 'user',
          content:
            `Objectives:\n` +
            open
              .map(
                (o) =>
                  `${o.id}: ${o.label}` +
                  (o.keywords?.length
                    ? `\n   (the kind of thing this objective covers: ${o.keywords
                        .slice(0, 14)
                        .join(', ')})`
                    : ''),
              )
              .join('\n') +
            `\n\nThe character's reply:\n${characterReply.slice(0, 2000)}`,
        },
      ],
    });
    const valid = new Set(open.map((o) => o.id));
    const out = new Set<string>();
    for (const row of parseRows(text)) {
      const { id, quote } = row;
      if (typeof id !== 'string' || !valid.has(id)) continue;
      if (typeof quote !== 'string' || !evidenceHolds(quote, characterReply)) continue;
      out.add(id);
    }
    return [...out];
  } catch {
    return []; // a failed check just means the row ticks off on a later turn
  }
}

export async function checkCoverage(
  node: StageNode,
  history: { role: 'player' | 'character'; text: string }[],
  playerMessage: string,
  characterReply: string,
  alreadyCovered: string[],
): Promise<string[]> {
  const open = node.learningPoints.filter((p) => !alreadyCovered.includes(p.id));
  if (open.length === 0) return [];

  const transcript = [
    ...history.map((m) => ({ role: m.role, text: String(m.text).slice(0, 1000) })),
    { role: 'player' as const, text: playerMessage },
    { role: 'character' as const, text: characterReply },
  ]
    .map((m) => `${m.role === 'player' ? 'Player' : 'Character'}: ${m.text}`)
    .join('\n');

  // the cue reader answers instantly; the grader is the slow half, so they run
  // together and the point counts if either is convinced
  const [byCues, byGrader] = await Promise.all([
    Promise.resolve(cueCoverage(open, characterReply)),
    gradedCoverage(open, transcript),
  ]);
  return [...new Set([...byCues, ...byGrader])];
}
