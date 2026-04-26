// Tiny cache facade. Uses Upstash Redis when configured, in-memory LRU otherwise.

import { Redis } from "@upstash/redis";

type CacheValue = unknown;

const memory = new Map<string, { v: unknown; exp: number }>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = getRedis();

function purgeMemory(): void {
  if (memory.size <= 5_000) return;
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.exp < now) memory.delete(k);
  }
  if (memory.size > 5_000) {
    const overflow = memory.size - 5_000;
    let i = 0;
    for (const k of memory.keys()) {
      if (i++ >= overflow) break;
      memory.delete(k);
    }
  }
}

export async function cacheGet<T = CacheValue>(key: string): Promise<T | null> {
  if (redis) {
    try {
      const v = await redis.get<T>(key);
      return v ?? null;
    } catch (err) {
      console.warn("[cache] upstash get failed, falling back to memory:", err);
    }
  }
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.exp < Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.v as T;
}

export async function cacheSet<T = CacheValue>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (redis) {
    try {
      await redis.set(key, value as object, { ex: ttlSeconds });
      return;
    } catch (err) {
      console.warn("[cache] upstash set failed, falling back to memory:", err);
    }
  }
  memory.set(key, { v: value, exp: Date.now() + ttlSeconds * 1000 });
  purgeMemory();
}

export async function cacheDel(key: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch {
      /* fall through */
    }
  }
  memory.delete(key);
}

export function isRedisConfigured(): boolean {
  return redis !== null;
}
