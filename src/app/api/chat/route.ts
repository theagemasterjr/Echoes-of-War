import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { ChatRequest, ChatResponse } from '@/conversation/treeTypes';
import { TREES } from '@/server/trees';
import { chatComplete, CHARACTER_MODEL, REPLY_MAX_TOKENS } from '@/server/openai';
import { buildCharacterSystem, buildIntroInstruction } from '@/server/prompts';
import { screenInput } from '@/server/screening';
import { checkCoverage } from '@/server/coverage';
import { classifyIntent } from '@/server/intent';
import { checkRateLimit } from '@/server/rateLimit';
import { readCacheFile, writeCacheFile } from '@/server/diskCache';

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
  const covered = (body.coveredPointIds ?? []).filter((id) => typeof id === 'string');
  const base = {
    newlyCoveredIds: [] as string[],
    advanceTo: null,
    canContinue: false,
    guidedQuestions: node.guidedQuestions,
    nodeId,
    objectives: tree.objectives ?? [],
  } satisfies Omit<ChatResponse, 'reply'>;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (checkRateLimit(ip) === 'busy') {
    return NextResponse.json({ ...base, reply: tree.deflections.busy, screened: 'busy' });
  }

  try {
    if (body.intro) {
      // A scripted greeting on the tree costs nothing: no text call, and its
      // unchanging wording means the voice line caches after one synthesis.
      if (tree.intro) {
        return NextResponse.json({ ...base, reply: tree.intro });
      }
      // The greeting is the same every visit — generate it once ever and
      // reuse it (saves both the text call and, downstream, its voice call).
      // Keyed on the character's own prompt, so the moment a founder edits the
      // persona in the tree the old greeting is dropped and a fresh one is
      // generated — otherwise a renamed character keeps introducing herself
      // by her previous name forever.
      const system = buildCharacterSystem(tree, node, covered);
      const instruction = buildIntroInstruction(tree);
      const key = createHash('sha1').update(`${system}\n${instruction}`).digest('hex').slice(0, 12);
      const file = `intro-${body.chapterId}-${key}.txt`;
      const cached = await readCacheFile(file);
      if (cached && cached.byteLength) {
        return NextResponse.json({ ...base, reply: cached.toString('utf8') });
      }
      const reply =
        (await chatComplete({
          model: CHARACTER_MODEL,
          maxTokens: REPLY_MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: instruction }],
        })) || '…';
      if (reply !== '…') writeCacheFile(file, reply);
      return NextResponse.json({ ...base, reply });
    }

    const message = String(body.message ?? '').slice(0, 600);
    if (!message.trim()) return NextResponse.json({ error: 'empty message' }, { status: 400 });

    const verdict = await screenInput(message);
    if (verdict !== 'ok') {
      const reply = verdict === 'abusive' ? tree.deflections.abusive : tree.deflections.aiProbe;
      return NextResponse.json({ ...base, reply, screened: verdict });
    }

    // the character reads only the recent exchange; the coverage grader reads
    // much further back, so a point explained early still gets credited even
    // if an earlier check missed it
    const fullHistory = (body.history ?? []).slice(-60);
    const rawHistory = fullHistory.slice(-12);
    const history = rawHistory.map((m) => ({
      role: m.role === 'player' ? ('user' as const) : ('assistant' as const),
      content: String(m.text).slice(0, 1000),
    }));

    // The character's reply and the intent classification of the player's
    // question run side by side — the classifier (see server/intent.ts) is
    // what ticks an Objectives row however the player words the question,
    // and running it in parallel means it costs no latency at all.
    const [reply, intentObjectiveIds] = await Promise.all([
      chatComplete({
        model: CHARACTER_MODEL,
        maxTokens: REPLY_MAX_TOKENS,
        system: buildCharacterSystem(tree, node, covered),
        messages: [...history, { role: 'user', content: message }],
      }).then((r) => r || '…'),
      classifyIntent(message, tree.objectives ?? []),
    ]);

    // Grade the node's learning points (what lights up CONTINUE). The on-screen
    // objectives are NOT graded here — a row only ever ticks off client-side,
    // the instant the player's own words hit one of its keywords.
    const newlyCoveredIds = await checkCoverage(node, fullHistory, message, reply, covered);
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
      nodeId: nextNodeId,
      objectives: tree.objectives ?? [],
      intentObjectiveIds,
    };
    return NextResponse.json(response);
  } catch (e) {
    console.error('[eow] chat pipeline failed:', e);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
