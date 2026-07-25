import type { StageNode } from '@/conversation/treeTypes';
import { chatComplete, FAST_MODEL } from './openai';

/**
 * Which of the node's still-uncovered learning points has the conversation
 * SO FAR actually covered? Reads the whole recent transcript, not just the
 * last exchange — a point explained across two turns, or missed by an earlier
 * check, still registers. Only the character clearly explaining a point
 * counts; a passing half-mention does not.
 */
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
  try {
    const text = await chatComplete({
      model: FAST_MODEL,
      maxTokens: 150,
      system:
        `You grade an educational dialogue. You are given learning points and the conversation so far. ` +
        `A point counts as covered if the character has explained its substance somewhere in the conversation — ` +
        `the main idea stated in the character's own words, well enough that an attentive kid would take it away. ` +
        `The exact wording never matters, dates and side details are not required, and the explanation may be spread across several turns. ` +
        `If the substance of a point was genuinely discussed, count it — do not withhold credit because it could have been explained more fully. ` +
        `Do NOT count: the player merely asking about it, a vague allusion, or a mention of only the name with no substance. ` +
        `Reply ONLY with a JSON array of the covered ids. Empty array if none. No other text.`,
      messages: [
        {
          role: 'user',
          content: `Learning points:\n${open.map((p) => `${p.id}: ${p.text}`).join('\n')}\n\nConversation so far:\n${transcript}`,
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
