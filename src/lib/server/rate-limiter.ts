import type { PrismaClient } from "@prisma/client";

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
  prismaClient?: PrismaClient;
  forceMemoryStore?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds?: number;
}

/**
 * In-memory fallback bucket structure for transient outages and unit test environments.
 */
interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryBucket>();
const MAX_MEMORY_STORE_SIZE = 10000;

// Track if the PostgreSQL rate-limit table has been initialized
let isTableInitialized = false;
let lastPrunedAt = 0;

/**
 * Resets the in-memory test store (useful in automated tests).
 */
export function resetMemoryRateLimitStore(): void {
  memoryStore.clear();
}

/**
 * Bounded cleanup of expired entries in memory store.
 */
function pruneMemoryStore(): void {
  const now = Date.now();
  for (const [key, bucket] of memoryStore.entries()) {
    if (bucket.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Ensures the PostgreSQL atomic rate-limits table and index exist.
 */
async function ensurePostgresTable(prisma: any): Promise<void> {
  if (isTableInitialized) return;
  try {
    if (typeof prisma.$executeRawUnsafe === "function") {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_orbit_rate_limits" (
          "key" VARCHAR(128) PRIMARY KEY,
          "count" INT NOT NULL DEFAULT 1,
          "reset_at" TIMESTAMPTZ NOT NULL
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "_orbit_rate_limits_reset_at_idx" 
        ON "_orbit_rate_limits"("reset_at");
      `);
      isTableInitialized = true;
    }
  } catch (err) {
    // If table creation fails (e.g. read-only replica or mock), continue to runtime fallback
    console.warn("[RateLimiter] Database table initialization warning:", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Prunes expired rows from PostgreSQL table to maintain bounded storage.
 */
async function prunePostgresStore(prisma: any): Promise<void> {
  const now = Date.now();
  // Run pruning at most once every 5 minutes
  if (now - lastPrunedAt < 5 * 60 * 1000) return;
  lastPrunedAt = now;

  try {
    if (typeof prisma.$executeRawUnsafe === "function") {
      await prisma.$executeRawUnsafe(`
        DELETE FROM "_orbit_rate_limits"
        WHERE "reset_at" < NOW() - INTERVAL '1 hour';
      `);
    }
  } catch {
    // Non-fatal cleanup failure
  }
}

/**
 * Executes rate limiting in the memory store (test or fallback mode).
 */
function consumeMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  let bucket = memoryStore.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (memoryStore.size >= MAX_MEMORY_STORE_SIZE) {
      pruneMemoryStore();
    }
    bucket = {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    };
    memoryStore.set(key, bucket);
  } else {
    bucket.count += 1;
  }

  const allowed = bucket.count <= limit;
  const remaining = Math.max(0, limit - bucket.count);
  const resetDate = new Date(bucket.resetAt);
  const retryAfterSeconds = allowed ? undefined : Math.ceil((bucket.resetAt - now) / 1000);

  return {
    allowed,
    current: bucket.count,
    limit,
    remaining,
    resetAt: resetDate,
    retryAfterSeconds,
  };
}

/**
 * Peeks rate limiting without incrementing (memory store).
 */
function peekMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const bucket = memoryStore.get(key);

  if (!bucket || bucket.resetAt <= now) {
    return {
      allowed: true,
      current: 0,
      limit,
      remaining: limit,
      resetAt: new Date(now + windowSeconds * 1000),
    };
  }

  const allowed = bucket.count < limit;
  const remaining = Math.max(0, limit - bucket.count);
  const retryAfterSeconds = allowed ? undefined : Math.ceil((bucket.resetAt - now) / 1000);

  return {
    allowed,
    current: bucket.count,
    limit,
    remaining,
    resetAt: new Date(bucket.resetAt),
    retryAfterSeconds,
  };
}

/**
 * Atomically consumes a token or increments the rate-limit counter for a given key.
 * Backed by PostgreSQL atomic upsert queries with fallback to bounded memory store.
 */
export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { key, limit, windowSeconds, forceMemoryStore } = options;

  // In memory-forced mode or when testing without explicit database connection
  if (forceMemoryStore || (process.env.VITEST && !options.prismaClient)) {
    return consumeMemoryRateLimit(key, limit, windowSeconds);
  }

  let prisma = options.prismaClient;

  if (!prisma) {
    try {
      const { PrismaClient } = await import("@prisma/client");
      prisma = new PrismaClient();
    } catch {
      // Prisma not available in environment
    }
  }

  // If Prisma queryRaw is unavailable, use test/memory store
  if (!prisma || typeof (prisma as any).$queryRawUnsafe !== "function") {
    return consumeMemoryRateLimit(key, limit, windowSeconds);
  }

  try {
    await ensurePostgresTable(prisma);
    await prunePostgresStore(prisma);

    const resetTimestamp = new Date(Date.now() + windowSeconds * 1000);

    // Atomic PostgreSQL Upsert with sliding window reset
    const result: any[] = await (prisma as any).$queryRawUnsafe(
      `
      INSERT INTO "_orbit_rate_limits" ("key", "count", "reset_at")
      VALUES ($1, 1, $2)
      ON CONFLICT ("key") DO UPDATE
      SET
        "count" = CASE
          WHEN "_orbit_rate_limits"."reset_at" < NOW() THEN 1
          ELSE "_orbit_rate_limits"."count" + 1
        END,
        "reset_at" = CASE
          WHEN "_orbit_rate_limits"."reset_at" < NOW() THEN $2
          ELSE "_orbit_rate_limits"."reset_at"
        END
      RETURNING "count", "reset_at";
      `,
      key,
      resetTimestamp
    );

    if (result && result.length > 0) {
      const current = Number(result[0].count);
      const resetAt = new Date(result[0].reset_at);
      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);
      const nowMs = Date.now();
      const retryAfterSeconds = allowed
        ? undefined
        : Math.max(1, Math.ceil((resetAt.getTime() - nowMs) / 1000));

      return {
        allowed,
        current,
        limit,
        remaining,
        resetAt,
        retryAfterSeconds,
      };
    }

    // Fallback if query returned empty
    return consumeMemoryRateLimit(key, limit, windowSeconds);
  } catch (err) {
    console.error("[RateLimiter] Database rate limiting failed, engaging safe fallback:", {
      keyPrefix: key.slice(0, 8),
      error: err instanceof Error ? err.message : String(err),
    });
    // Resilient fallback: engage memory-bounded limiter
    return consumeMemoryRateLimit(key, limit, windowSeconds);
  }
}

/**
 * Checks rate-limiting status without incrementing.
 */
export async function peekRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { key, limit, windowSeconds, forceMemoryStore } = options;

  if (forceMemoryStore || (process.env.VITEST && !options.prismaClient)) {
    return peekMemoryRateLimit(key, limit, windowSeconds);
  }

  let prisma = options.prismaClient;

  if (!prisma) {
    try {
      const { PrismaClient } = await import("@prisma/client");
      prisma = new PrismaClient();
    } catch {
      // Ignore
    }
  }

  if (!prisma || typeof (prisma as any).$queryRawUnsafe !== "function") {
    return peekMemoryRateLimit(key, limit, windowSeconds);
  }

  try {
    const result: any[] = await (prisma as any).$queryRawUnsafe(
      `
      SELECT "count", "reset_at"
      FROM "_orbit_rate_limits"
      WHERE "key" = $1 AND "reset_at" > NOW();
      `,
      key
    );

    if (result && result.length > 0) {
      const current = Number(result[0].count);
      const resetAt = new Date(result[0].reset_at);
      const allowed = current < limit;
      const remaining = Math.max(0, limit - current);
      const retryAfterSeconds = allowed
        ? undefined
        : Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

      return {
        allowed,
        current,
        limit,
        remaining,
        resetAt,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      current: 0,
      limit,
      remaining: limit,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    };
  } catch {
    return peekMemoryRateLimit(key, limit, windowSeconds);
  }
}

/**
 * Conservative, configurable rate-limiting thresholds for administrative flows.
 */
export const AUTH_RATE_THRESHOLDS = {
  // Login: 5 attempts per account / 15 mins, 20 attempts per IP / 15 mins
  LOGIN_ACCOUNT: {
    limit: 5,
    windowSeconds: 15 * 60, // 15 minutes
  },
  LOGIN_IP: {
    limit: 20,
    windowSeconds: 15 * 60, // 15 minutes
  },
  LOGIN_GLOBAL: {
    limit: 150,
    windowSeconds: 15 * 60,
  },
  // Password Recovery: 3 requests per account / 60 mins, 10 requests per IP / 60 mins
  RECOVERY_ACCOUNT: {
    limit: 3,
    windowSeconds: 60 * 60, // 60 minutes
  },
  RECOVERY_IP: {
    limit: 10,
    windowSeconds: 60 * 60, // 60 minutes
  },
};
