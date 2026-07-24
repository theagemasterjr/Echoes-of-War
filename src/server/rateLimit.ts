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

/** Character chat — unchanged limits and behavior. */
export const checkRateLimit = createLimiter({ hourlyPerIp: 40, dailyGlobal: 800 });

/** Voice synthesis — separate, higher ceilings (one chat reply → one TTS call). */
export const checkTtsRateLimit = createLimiter({ hourlyPerIp: 80, dailyGlobal: 1600 });
