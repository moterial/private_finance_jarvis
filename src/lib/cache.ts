// ============ Server-Side AI Response Cache ============
// Shared across all users to reduce AI token consumption.
// Uses in-memory cache with TTL, perfect for serverless.

interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes

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
 * Wrap an async function with caching. If the cache has a valid entry, return it.
 * Otherwise execute the function, cache the result, and return it.
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL,
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) {
    console.log(`[Cache] HIT: ${key}`);
    return cached;
  }

  console.log(`[Cache] MISS: ${key}`);
  const result = await fn();
  if (result != null) {
    cacheSet(key, result, ttlMs);
  }
  return result;
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
