import Anthropic from '@anthropic-ai/sdk';

/** Server-only. The key lives in the ANTHROPIC_API_KEY env var (Vercel project settings). */
export const anthropic = new Anthropic();

/** Two-tier usage: a strong model plays the character, a fast cheap one does screening/coverage. */
export const CHARACTER_MODEL = 'claude-sonnet-5';
export const FAST_MODEL = 'claude-haiku-4-5-20251001';

/** Reply length cap — keeps responses subtitle-sized and the budget safe. */
export const REPLY_MAX_TOKENS = 400;
