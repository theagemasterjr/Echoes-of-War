import { NextRequest, NextResponse } from 'next/server';
import type { ChatRequest, ChatResponse } from '@/conversation/treeTypes';
import { TREES, totalLearningPoints } from '@/server/trees';
import { anthropic, CHARACTER_MODEL, REPLY_MAX_TOKENS } from '@/server/anthropic';
import { buildCharacterSystem, buildIntroInstruction } from '@/server/prompts';
import { screenInput } from '@/server/screening';
import { checkCoverage } from '@/server/coverage';
import { checkRateLimit } from '@/server/rateLimit';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const tree = TREES[body.chapterId];
  if (!tree) return NextResponse.json({ error: 'unknown chapter' }, { status: 400 });

  const nodeId = body.nodeId && tree.nodes[body.nodeId] ? body.nodeId : tree.entryNodeId;
  const node = tree.nodes[nodeId];
  const total = totalLearningPoints(tree);
  const covered = (body.coveredPointIds ?? []).filter((id) => typeof id === 'string');
  const base = {
    newlyCoveredIds: [] as string[],
    advanceTo: null,
    canContinue: false,
    guidedQuestions: node.guidedQuestions,
    progress: { covered: covered.length, total },
    nodeId,
  } satisfies Omit<ChatResponse, 'reply'>;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (checkRateLimit(ip) === 'busy') {
    return NextResponse.json({ ...base, reply: tree.deflections.busy, screened: 'busy' });
  }

  try {
    if (body.intro) {
      const res = await anthropic.messages.create({
        model: CHARACTER_MODEL,
        max_tokens: REPLY_MAX_TOKENS,
        system: buildCharacterSystem(tree, node, covered),
        messages: [{ role: 'user', content: buildIntroInstruction(tree) }],
      });
      const reply = res.content[0]?.type === 'text' ? res.content[0].text : '…';
      return NextResponse.json({ ...base, reply });
    }

    const message = String(body.message ?? '').slice(0, 600);
    if (!message.trim()) return NextResponse.json({ error: 'empty message' }, { status: 400 });

    const verdict = await screenInput(message);
    if (verdict !== 'ok') {
      const reply = verdict === 'abusive' ? tree.deflections.abusive : tree.deflections.aiProbe;
      return NextResponse.json({ ...base, reply, screened: verdict });
    }

    const history = (body.history ?? []).slice(-12).map((m) => ({
      role: m.role === 'player' ? ('user' as const) : ('assistant' as const),
      content: String(m.text).slice(0, 1000),
    }));

    const res = await anthropic.messages.create({
      model: CHARACTER_MODEL,
      max_tokens: REPLY_MAX_TOKENS,
      system: buildCharacterSystem(tree, node, covered),
      messages: [...history, { role: 'user', content: message }],
    });
    const reply = res.content[0]?.type === 'text' ? res.content[0].text : '…';

    const newlyCoveredIds = await checkCoverage(node, message, reply, covered);
    const merged = [...new Set([...covered, ...newlyCoveredIds])];

    const nodeCovered = node.learningPoints.filter((p) => merged.includes(p.id)).length;
    const turns = (body.turnsInNode ?? 0) + 1;
    const met =
      node.advance.condition === 'allPoints'
        ? nodeCovered === node.learningPoints.length
        : node.advance.condition === 'minPoints'
          ? nodeCovered >= (node.advance.minPoints ?? node.learningPoints.length)
          : turns >= (node.advance.minTurns ?? 1);

    const advanceTo = met ? node.advance.to : null;
    const nextNodeId = advanceTo ?? nodeId;

    const response: ChatResponse = {
      reply,
      newlyCoveredIds,
      advanceTo,
      canContinue: met && node.advance.to === null,
      guidedQuestions: tree.nodes[nextNodeId].guidedQuestions,
      progress: { covered: merged.length, total },
      nodeId: nextNodeId,
    };
    return NextResponse.json(response);
  } catch (e) {
    console.error('[eow] chat pipeline failed:', e);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
