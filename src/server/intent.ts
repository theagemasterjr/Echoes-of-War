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
 *      of the war must tick nothing.
 *   2. AT MOST ONE objective per message, ever. A question is about the one
 *      thing it is most about; a model asked for "all that apply" starts
 *      handing out ticks for passing mentions. One row per turn also means a
 *      player can watch each tick land and know which question earned it.
 *   3. Misses are acceptable (the client's keyword pass still stands behind
 *      it); wrong ticks are not.
 *   4. It must never take the conversation down: any error → [].
 *
 * The last thing the character said rides along as context, because kids ask
 * follow-ups ("why did they do that?", "and what happened after?") that mean
 * nothing on their own — the classifier reads the question THROUGH the
 * context, but it is still only ever the player's own question being judged.
 *
 * Cost: one FAST_MODEL call of ~450 prompt tokens and ~4 output tokens per
 * player message — fractions of a cent per full playthrough.
 */
export async function classifyIntent(
  message: string,
  objectives: ObjectiveDef[],
  lastCharacterLine = '',
): Promise<string[]> {
  if (!objectives.length || !message.trim()) return [];

  // Numbered menu, so the model answers with a digit and never mangles ids.
  // Each objective is its label plus example phrasings drawn from its own
  // keyword list — the clearest cheap description of what it means.
  const menu = objectives
    .map((o, i) => {
      const examples = (o.keywords ?? []).slice(0, 10).join('; ');
      return `${i + 1}. ${o.label}${examples ? ` — e.g. ${examples}` : ''}`;
    })
    .join('\n');

  const system = `You classify one player question from an educational World War Two game against the chapter's learning objectives.

Objectives:
${menu}

Answer with ONE number — the single objective the question is clearly and directly asking about — or exactly "NONE".

Rules, in order:
- NEVER more than one number. If the question touches several objectives, pick the ONE it is most about; if none stands out, answer NONE.
- A question is "about" an objective only when an answer to it would teach that objective. Merely containing one of its words is not enough.
- Greetings, thanks, small talk, questions about the character personally (their name, age, feelings, daily life), meta questions about the game, and questions about other parts of the war are all NONE.
- A follow-up like "why?", "how?", "what happened next?" takes its meaning from what the character just said (given below) — classify what the follow-up is really asking about.
- When in doubt, answer NONE. A wrong match is worse than a miss.

Format: reply with the bare number or NONE. Nothing else.`;

  const context = lastCharacterLine.trim()
    ? `The character just said: "${lastCharacterLine.slice(0, 500)}"\n\nThe player now asks: "${message.slice(0, 400)}"`
    : `The player asks: "${message.slice(0, 400)}"`;

  try {
    const raw = await chatComplete({
      model: FAST_MODEL,
      maxTokens: 6,
      system,
      messages: [{ role: 'user', content: context }],
    });
    if (!raw || /none/i.test(raw)) return [];
    // one row per turn, no matter what came back: only the FIRST number counts
    const m = raw.match(/\d+/);
    const n = m ? Number(m[0]) : 0;
    return n >= 1 && n <= objectives.length ? [objectives[n - 1].id] : [];
  } catch {
    // classification must never take the conversation down
    return [];
  }
}
