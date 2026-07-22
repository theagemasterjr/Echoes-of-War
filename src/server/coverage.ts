import type { StageNode } from '@/conversation/treeTypes';
import { anthropic, FAST_MODEL } from './anthropic';

/** Which of the node's still-uncovered learning points did this exchange actually cover? */
export async function checkCoverage(
  node: StageNode,
  playerMessage: string,
  characterReply: string,
  alreadyCovered: string[],
): Promise<string[]> {
  const open = node.learningPoints.filter((p) => !alreadyCovered.includes(p.id));
  if (open.length === 0) return [];
  try {
    const res = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 100,
      system:
        `You check whether learning points were substantively covered in one exchange of an educational dialogue. ` +
        `Reply ONLY with a JSON array of the ids that were genuinely covered (mentioned meaningfully, not just brushed past). ` +
        `Empty array if none. No other text.`,
      messages: [
        {
          role: 'user',
          content: `Learning points:\n${open.map((p) => `${p.id}: ${p.text}`).join('\n')}\n\nPlayer asked: ${playerMessage}\n\nCharacter replied: ${characterReply}`,
        },
      ],
    });
    const text = res.content[0]?.type === 'text' ? res.content[0].text : '[]';
    const match = text.match(/\[[\s\S]*?\]/);
    const ids: unknown = match ? JSON.parse(match[0]) : [];
    if (!Array.isArray(ids)) return [];
    const valid = new Set(open.map((p) => p.id));
    return ids.filter((i): i is string => typeof i === 'string' && valid.has(i));
  } catch {
    return []; // a failed check just means the point registers on a later turn
  }
}
