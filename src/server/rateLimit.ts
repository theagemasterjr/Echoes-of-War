/**
 * Cost guard for the public link: generous per-visitor hourly cap + overall
 * daily ceiling. ponytail: in-memory per serverless instance — resets on cold
 * start, which only makes limits more forgiving; swap for KV if it ever matters.
 */
const HOURLY_PER_IP = 40;
const DAILY_GLOBAL = 800;

const perIp = new Map<string, { count: number; resetAt: number }>();
let global = { count: 0, resetAt: 0 };

export function checkRateLimit(ip: string): 'ok' | 'busy' {
  const now = Date.now();

  if (now > global.resetAt) global = { count: 0, resetAt: now + 24 * 3600_000 };
  if (global.count >= DAILY_GLOBAL) return 'busy';

  const entry = perIp.get(ip);
  if (!entry || now > entry.resetAt) {
    perIp.set(ip, { count: 1, resetAt: now + 3600_000 });
    global.count++;
    return 'ok';
  }
  if (entry.count >= HOURLY_PER_IP) return 'busy';
  entry.count++;
  global.count++;
  return 'ok';
}
