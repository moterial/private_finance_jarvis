// ============ Server-Side AI Response Cache ============
// Shared across all users to reduce AI token consumption.
// Uses in-memory cache with TTL + request deduplication.
// If user A triggers an AI call and user B requests the same data,
// user B awaits user A's in-flight promise instead of making a new call.

interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>(); // deduplication map

const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get a value from cache. Returns undefined if expired or missing.
 */
export function cacheGet<T = any>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

/**
 * Set a value in cache with optional TTL (default: 10 minutes).
 */
export function cacheSet<T = any>(key: string, data: T, ttlMs: number = DEFAULT_TTL): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Wrap an async function with caching + request deduplication.
 * - If cache has a valid entry → return it instantly.
 * - If another caller is already fetching the same key → wait for that result.
 * - Otherwise → execute fn, cache the result, return it.
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL,
): Promise<T> {
  // 1. Check cache
  const cached = cacheGet<T>(key);
  if (cached !== undefined) {
    console.log(`[Cache] HIT: ${key}`);
    return cached;
  }

  // 2. Check if another request is already in-flight for this key
  const existing = inflight.get(key);
  if (existing) {
    console.log(`[Cache] DEDUP (waiting for in-flight): ${key}`);
    return existing as Promise<T>;
  }

  // 3. Execute and deduplicate
  console.log(`[Cache] MISS: ${key}`);
  const promise = fn().then(result => {
    if (result != null) {
      cacheSet(key, result, ttlMs);
    }
    inflight.delete(key);
    return result;
  }).catch(err => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
}

/**
 * Generate a cache key from components.
 */
export function cacheKey(...parts: (string | number | undefined)[]): string {
  return parts.filter(Boolean).join(':');
}

/**
 * Clear all expired entries. Called periodically.
 */
export function cleanupCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) cache.delete(key);
  }
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupCache, 5 * 60 * 1000);
}

/** Cache stats for debugging */
export function getCacheStats() {
  let valid = 0;
  const now = Date.now();
  for (const entry of cache.values()) {
    if (now < entry.expiresAt) valid++;
  }
  return { total: cache.size, valid, expired: cache.size - valid };
}
