import { NextRequest, NextResponse } from 'next/server';
import type { ChapterId } from '@/chapters/types';
import { lastTtsFailure, synthesize, voiceFor } from '@/server/tts';
import { checkTtsRateLimit } from '@/server/rateLimit';

export const maxDuration = 30;

const CHAPTERS: ChapterId[] = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6'];

export async function POST(req: NextRequest) {
  let body: { chapterId?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const chapterId = body.chapterId as ChapterId;
  const text = String(body.text ?? '');
  if (!CHAPTERS.includes(chapterId)) {
    return NextResponse.json({ error: 'unknown chapter' }, { status: 400 });
  }
  if (!text.trim() || text.length > 700) {
    return NextResponse.json({ error: 'bad text' }, { status: 400 });
  }

  // Voice is optional infrastructure — no key or no voice configured is a clean,
  // expected 503, not an error. The client falls back to silent subtitles.
  if (!process.env.ELEVENLABS_API_KEY || !voiceFor(chapterId)) {
    return NextResponse.json({ error: 'voice unavailable' }, { status: 503 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (checkTtsRateLimit(ip) === 'busy') {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  }

  const buf = await synthesize(text, chapterId);
  if (!buf) {
    // the reason travels only while developing — the live site says no more
    // than it has to, and the player degrades to silent subtitles either way
    return NextResponse.json(
      process.env.NODE_ENV === 'production'
        ? { error: 'synth failed' }
        : { error: 'synth failed', reason: lastTtsFailure() },
      { status: 502 },
    );
  }

  return new Response(buf, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}
