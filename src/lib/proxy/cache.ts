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

const TTL_MS = 5_000; // 5s — picks up admin edits fast, serves bursts instantly.
const cache = new Map<string, CacheEntry>();
const versions = new Map<string, number>();

/** Mark a user's cache as stale. Call after any provider/key/endpoint/model mutation. */
export function invalidateUserCache(userId: string): void {
  versions.set(userId, (versions.get(userId) ?? 0) + 1);
  cache.delete(userId);
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
