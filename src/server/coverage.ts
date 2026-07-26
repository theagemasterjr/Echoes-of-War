import type { LearningPoint, StageNode } from '@/conversation/treeTypes';
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
 * The on-screen Objectives checklist is a separate thing and is never graded
 * here. A row ticks off client-side: on the player's own words, or once every
 * learning point that row maps to has been covered by the grading above (see
 * the note on ObjectiveDef).
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
