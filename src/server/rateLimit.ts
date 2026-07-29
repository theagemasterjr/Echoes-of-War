/**
 * Cost guard for the public link: generous per-visitor hourly cap + overall
 * daily ceiling. In-memory per serverless instance — resets on cold start,
 * which only makes limits more forgiving; swap for KV if it ever matters.
 */
interface LimiterConfig {
  hourlyPerIp: number;
  dailyGlobal: number;
}

/** Build an independent limiter (its own counters) from a config. */
export function createLimiter({ hourlyPerIp, dailyGlobal }: LimiterConfig) {
  const perIp = new Map<string, { count: number; resetAt: number }>();
  let global = { count: 0, resetAt: 0 };

  return function check(ip: string): 'ok' | 'busy' {
    const now = Date.now();

    if (now > global.resetAt) global = { count: 0, resetAt: now + 24 * 3600_000 };
    if (global.count >= dailyGlobal) return 'busy';

    const entry = perIp.get(ip);
    if (!entry || now > entry.resetAt) {
      perIp.set(ip, { count: 1, resetAt: now + 3600_000 });
      global.count++;
      return 'ok';
    }
    if (entry.count >= hourlyPerIp) return 'busy';
    entry.count++;
    global.count++;
    return 'ok';
  };
}

/** Character chat. Sized so one player can finish the WHOLE game in one
 *  sitting with room to spare: a worst-case playthrough is ~156 requests
 *  (6 chapter intros + ~25 questions a chapter), so 500/hour is ~3x that —
 *  the old 40/hour cut a thorough player off inside chapter two. The global
 *  daily ceiling covers ~15 full playthroughs a day. */
export const checkRateLimit = createLimiter({ hourlyPerIp: 500, dailyGlobal: 2500 });

/** Voice synthesis — separate, higher ceilings (one chat reply → one TTS
 *  call, plus the odd replay), scaled with the chat limiter above. */
export const checkTtsRateLimit = createLimiter({ hourlyPerIp: 1000, dailyGlobal: 5000 });
