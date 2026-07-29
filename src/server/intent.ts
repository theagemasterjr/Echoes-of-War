import type { ObjectiveDef } from '@/conversation/treeTypes';
import { chatComplete, FAST_MODEL } from './openai';

/**
 * Which of the chapter's objectives is the PLAYER'S question actually about?
 *
 * The Objectives panel used to tick only on exact keyword phrases in the
 * player's message, which missed anything worded a way nobody predicted
 * ("what was life like in germany after the treaty" has no listed phrase in
 * it, but it is plainly the Germany-under-the-treaty objective). This asks
 * the fast model to classify the INTENT of every question instead, and the
 * route runs it in parallel with the character's reply, so it adds no
 * latency and only ever widens what the keywords already caught.
 *
 * The contract, in order of importance:
 *   1. NO FALSE POSITIVES. "NONE" is a first-class answer — greetings,
 *      small talk, off-topic questions, and questions about some other part
 *      of the war must tick nothing. The prompt says so twice and the
 *      temperature-free small model is good at this shape.
 *   2. Misses are acceptable (the client's keyword pass and the coverage
 *      grader still stand behind it); wrong ticks are not.
 *   3. It must never take the conversation down: any error → [].
 *
 * Cost: one FAST_MODEL call of ~350 prompt tokens and ~8 output tokens per
 * player message — fractions of a cent per full playthrough.
 */
export async function classifyIntent(
  message: string,
  objectives: ObjectiveDef[],
): Promise<string[]> {
  if (!objectives.length || !message.trim()) return [];

  // Numbered menu, so the model answers with digits and never mangles ids.
  // Each objective is its label plus a few example phrasings drawn from its
  // own keyword list — the clearest cheap description of what it means.
  const menu = objectives
    .map((o, i) => {
      const examples = (o.keywords ?? []).slice(0, 6).join('; ');
      return `${i + 1}. ${o.label}${examples ? ` (e.g. ${examples})` : ''}`;
    })
    .join('\n');

  const system = `You classify one player question from an educational World War Two game against the chapter's learning objectives.

Objectives:
${menu}

Reply with ONLY the number(s) of the objective(s) the question is clearly and directly asking about, comma-separated (e.g. "2" or "1,3").
If the question is not clearly about any objective — a greeting, small talk, a question about the character personally, or any other topic — reply exactly "NONE".
When in doubt, reply "NONE". A wrong match is worse than a miss.`;

  try {
    const raw = await chatComplete({
      model: FAST_MODEL,
      maxTokens: 12,
      system,
      messages: [{ role: 'user', content: message.slice(0, 400) }],
    });
    if (/none/i.test(raw)) return [];
    const picked = new Set<number>();
    for (const m of raw.matchAll(/\d+/g)) {
      const n = Number(m[0]);
      if (n >= 1 && n <= objectives.length) picked.add(n - 1);
    }
    return [...picked].map((i) => objectives[i].id);
  } catch {
    // classification must never take the conversation down
    return [];
  }
}
