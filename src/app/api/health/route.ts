import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    ok: true,
    hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
