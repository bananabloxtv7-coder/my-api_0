/**
 * Simple in-memory token-bucket rate limiter.
 * Suitable for single-instance deployments. For multi-instance, swap with
 * an Upstash Redis implementation.
 */

interface Bucket {
  tokens: number;
  last: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000; // 1 minute

interface RateLimitOptions {
  key: string;
  limit: number; // max requests per window
  windowMs?: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetMs: number;
}

export function rateLimit({
  key,
  limit,
  windowMs = WINDOW_MS,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket) {
    buckets.set(key, { tokens: limit - 1, last: now });
    return { ok: true, remaining: limit - 1, limit, resetMs: windowMs };
  }

  const elapsed = now - bucket.last;
  const refill = (elapsed / windowMs) * limit;
  bucket.tokens = Math.min(limit, bucket.tokens + refill);
  bucket.last = now;

  if (bucket.tokens < 1) {
    const resetMs = Math.ceil((1 - bucket.tokens) * windowMs);
    return { ok: false, remaining: 0, limit, resetMs };
  }

  bucket.tokens -= 1;
  return { ok: true, remaining: Math.floor(bucket.tokens), limit, resetMs: 0 };
}

/** Clean up stale buckets periodically (cheap GC). */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (now - b.last > WINDOW_MS * 2) buckets.delete(k);
    }
  }, 120_000).unref?.();
}
