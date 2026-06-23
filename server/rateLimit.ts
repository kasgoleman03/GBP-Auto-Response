/**
 * Minimal fixed-window rate limiter for the webhook endpoint.
 *
 * In-memory and per-isolate (ephemeral on serverless), so it throttles bursts
 * within a warm instance rather than enforcing a hard global limit. For a strict
 * cross-region limit, back this with Vercel KV / Upstash Redis — same interface.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);
  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    windows.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}
