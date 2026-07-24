import OpenAI from 'openai';

/**
 * Server-only. The key lives in the OPENAI_API_KEY env var (.env.local / Vercel).
 * Created lazily on first use — the OpenAI SDK throws in its constructor when no
 * key is set, and we must not crash at import time (that would break the build
 * and white-screen a keyless deploy). No key → chatComplete throws, and the
 * chat route's try/catch turns it into an in-character retry.
 */
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

/** Two-tier usage: a strong model plays the character, a fast cheap one screens/scores. */
export const CHARACTER_MODEL = 'gpt-4o';
export const FAST_MODEL = 'gpt-4o-mini';

/** Reply length cap — keeps responses subtitle-sized and the budget safe. */
export const REPLY_MAX_TOKENS = 220;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * One-shot chat helper: a system prompt + user/assistant turns → the reply text.
 * Wraps the provider so the route/screening/coverage never touch SDK specifics.
 * Returns '' on an empty/blocked completion (callers supply their own fallback).
 */
export async function chatComplete(opts: {
  model: string;
  system: string;
  messages: ChatTurn[];
  maxTokens: number;
}): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    messages: [{ role: 'system', content: opts.system }, ...opts.messages],
  });
  return res.choices[0]?.message?.content?.trim() ?? '';
}
