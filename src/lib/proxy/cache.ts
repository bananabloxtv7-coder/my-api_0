/**
 * In-memory cache for the provider/key/endpoint/model graph.
 *
 * The gateway needs this data on every proxied request to do routing + key
 * rotation. Hitting the database on every request (and especially on every
 * key rotation attempt) adds latency that compounds. We cache the graph for a
 * short TTL and invalidate it immediately when the user mutates anything.
 *
 * Cache is per-user.
 */

import { db } from "@/lib/db";

export interface CachedKey {
  id: string;
  encryptedKey: string;
  name: string | null;
  isActive: boolean;
  status: string;
  cooldownUntil: Date | null;
  lastUsedAt: Date | null;
  totalErrors: number;
  totalSuccess: number;
  totalRequests: number;
  lastError: string | null;
}

export interface CachedProvider {
  id: string;
  name: string;
  baseUrl: string;
  authHeader: string;
  authScheme: string;
  protocol: string;
  priority: number;
  timeoutMs: number;
  endpoints: Array<{ id: string; type: string; path: string; method: string }>;
  models: Array<{ id: string; name: string }>;
  apiKeys: CachedKey[];
}

interface CacheEntry {
  data: CachedProvider[];
  fetchedAt: number;
  version: number;
}

const TTL_MS = 1_000; // 1s — short TTL so admin edits (key reset/disable) are
                      // picked up fast even across Vercel serverless instances.
const cache = new Map<string, CacheEntry>();
const versions = new Map<string, number>();

/**
 * In-flight key tracking: when a request starts using a key, we mark it
 * "in-flight" so concurrent requests skip it and go to the next key
 * immediately. This prevents N concurrent requests from all hammering the
 * same dead key simultaneously.
 *
 * Entries auto-expire after 30s as a safety net (in case a request hangs).
 */
const IN_FLIGHT_TTL_MS = 30_000;
const inFlight = new Map<string, number>(); // keyId -> expiresAt

/** Mark a key as in-flight (being tried right now). */
export function markKeyInFlight(keyId: string): void {
  inFlight.set(keyId, Date.now() + IN_FLIGHT_TTL_MS);
}

/** Clear the in-flight marker (request finished, success or fail). */
export function clearKeyInFlight(keyId: string): void {
  inFlight.delete(keyId);
}

/** Check if a key is currently in-flight (being tried by another request). */
export function isKeyInFlight(keyId: string): boolean {
  const expiresAt = inFlight.get(keyId);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    inFlight.delete(keyId);
    return false;
  }
  return true;
}

// Periodic cleanup of stale in-flight entries
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, exp] of inFlight) {
      if (now > exp) inFlight.delete(k);
    }
  }, 60_000).unref?.();
}

/** Mark a user's cache as stale. Call after any provider/key/endpoint/model mutation. */
export function invalidateUserCache(userId: string): void {
  versions.set(userId, (versions.get(userId) ?? 0) + 1);
  cache.delete(userId);
}

/**
 * Synchronously update a single key's state in the in-memory cache.
 *
 * This is the KEY to rocket-fast rotation: when a key fails during a request,
 * we mark it disabled/cooldown in memory IMMEDIATELY (no DB round-trip, no
 * await) so the very next request in the same burst skips it. The DB write
 * happens in the background via markKeyBackground().
 *
 * Without this, a burst of requests within the 5s cache TTL would all try
 * the same dead key (wasting an HTTP call each time) before the cache
 * refreshes from DB.
 */
export function markKeyStateInCache(
  userId: string,
  keyId: string,
  updates: Partial<Pick<CachedKey, "status" | "isActive" | "cooldownUntil" | "lastError" | "lastUsedAt" | "totalErrors" | "totalSuccess" | "totalRequests">>
): void {
  const entry = cache.get(userId);
  if (!entry) return;
  for (const provider of entry.data) {
    for (const key of provider.apiKeys) {
      if (key.id === keyId) {
        Object.assign(key, updates);
        return;
      }
    }
  }
}

/**
 * Reset sibling keys in the same provider back to "active" when one key
 * succeeds. This clears any transient cooldown (rate_limit, error) on the
 * OTHER keys so they get retried on the next request.
 *
 * Why: if key A had a transient 5xx and got a 5s cooldown, but key B
 * succeeds, we don't want key A to stay in cooldown — it might work fine
 * next time. Only the succeeded key's ID is excluded from the reset.
 *
 * Note: disabled keys (auth failure) are NOT reset — they stay disabled.
 */
export function resetProviderKeysInCache(
  userId: string,
  providerId: string,
  exceptKeyId: string
): void {
  const entry = cache.get(userId);
  if (!entry) return;
  for (const provider of entry.data) {
    if (provider.id !== providerId) continue;
    for (const key of provider.apiKeys) {
      if (key.id === exceptKeyId) continue;
      // Reset ALL non-disabled keys to active — including those with an
      // active cooldown (503, rate_limit, timeout). A successful sibling
      // request means the provider is working, so transient errors on
      // other keys should be cleared immediately. Only truly disabled
      // keys (401 unauthorized) stay disabled.
      if (key.status !== "disabled" && key.status !== "exhausted") {
        key.status = "active";
        key.cooldownUntil = null;
        key.lastError = null;
      }
    }
    return;
  }
}

/** Fetch the cached provider graph, refreshing from DB if stale or invalidated. */
export async function getCachedProviders(userId: string): Promise<CachedProvider[]> {
  const version = versions.get(userId) ?? 0;
  const entry = cache.get(userId);
  const now = Date.now();

  if (entry && entry.version === version && now - entry.fetchedAt < TTL_MS) {
    return entry.data;
  }

  const providers = await db.provider.findMany({
    where: {
      userId,
      isActive: true,
      apiKeys: { some: { isActive: true } },
    },
    include: {
      endpoints: true,
      models: { where: { isActive: true } },
      apiKeys: { where: { isActive: true } },
    },
    orderBy: { priority: "desc" },
  });

  const graph: CachedProvider[] = providers.map((p) => ({
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    authHeader: p.authHeader,
    authScheme: p.authScheme,
    protocol: p.protocol ?? "transparent",
    priority: p.priority,
    timeoutMs: p.timeoutMs,
    endpoints: p.endpoints.map((e) => ({
      id: e.id,
      type: e.type,
      path: e.path,
      method: e.method,
    })),
    models: p.models.map((m) => ({ id: m.id, name: m.name })),
    apiKeys: p.apiKeys.map((k) => ({
      id: k.id,
      encryptedKey: k.encryptedKey,
      name: k.name,
      isActive: k.isActive,
      status: k.status,
      cooldownUntil: k.cooldownUntil,
      lastUsedAt: k.lastUsedAt,
      totalErrors: k.totalErrors,
      totalSuccess: k.totalSuccess,
      totalRequests: k.totalRequests,
      lastError: k.lastError,
    })),
  }));

  cache.set(userId, { data: graph, fetchedAt: now, version });
  return graph;
}
