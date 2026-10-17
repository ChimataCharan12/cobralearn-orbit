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
  retryAfterSeconds?: number | undefined;
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

/**
 * Error thrown when persistent rate-limiting storage is unavailable in production
 * or when an explicit database client encounters an unrecoverable storage failure.
 */
export class RateLimiterStorageError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = "RateLimiterStorageError";
    Object.setPrototypeOf(this, RateLimiterStorageError.prototype);
  }
}

// Track when background database pruning was last executed
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
 * Prunes expired rows from PostgreSQL table to maintain bounded storage.
 * Executes a non-blocking DML DELETE query (not DDL).
 * Runs at most once every 5 minutes per application process.
 */
async function prunePostgresStore(prisma: any): Promise<void> {
  const now = Date.now();
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
 * Backed by PostgreSQL atomic upsert queries.
 *
 * SAFETY INVARIANTS:
 * 1. Runtime table creation (DDL) is removed. The "_orbit_rate_limits" table is a mandatory
 *    pre-deployment database prerequisite (see docs/database/orbit-rate-limits.sql).
 * 2. In production or when an explicit database client is passed, database storage failures
 *    will NEVER silently degrade to an in-memory store. Instead, RateLimiterStorageError is thrown,
 *    enabling the caller to fail closed and preserve distributed security boundaries.
 * 3. In test/development mode without a configured database or when forceMemoryStore is true,
 *    the process-bounded memory store is preserved.
 */
export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { key, limit, windowSeconds, forceMemoryStore } = options;

  // In memory-forced mode or when testing without explicit database connection
  if (forceMemoryStore || (process.env["VITEST"] && !options.prismaClient)) {
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

  const hasRawQuery = Boolean(prisma && typeof (prisma as any).$queryRawUnsafe === "function");

  // If Prisma queryRaw is unavailable:
  if (!hasRawQuery) {
    if (process.env["NODE_ENV"] === "production") {
      console.error("[RateLimiter] Database client with queryRawUnsafe is unavailable in production. Rejecting silent fallback.");
      throw new RateLimiterStorageError("Rate limiter database connection unavailable.");
    }
    return consumeMemoryRateLimit(key, limit, windowSeconds);
  }

  try {
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

    throw new RateLimiterStorageError("Database rate limiting query returned empty result.");
  } catch (err) {
    if (err instanceof RateLimiterStorageError) {
      throw err;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[RateLimiter] Database rate limiting storage failure:", {
      keyPrefix: key.slice(0, 8),
      error: errMsg,
    });

    // In production or when a database client is explicitly configured:
    // Reject silent in-memory fallback to avoid multi-instance limit dilution.
    if (process.env["NODE_ENV"] === "production" || options.prismaClient) {
      throw new RateLimiterStorageError("Database rate limiting storage failure.", err);
    }

    // Safe dev fallback only in local non-production environments
    console.warn("[RateLimiter] Engaging local development in-memory fallback for key:", key.slice(0, 8));
    return consumeMemoryRateLimit(key, limit, windowSeconds);
  }
}

/**
 * Checks rate-limiting status without incrementing.
 */
export async function peekRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { key, limit, windowSeconds, forceMemoryStore } = options;

  if (forceMemoryStore || (process.env["VITEST"] && !options.prismaClient)) {
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

  const hasRawQuery = Boolean(prisma && typeof (prisma as any).$queryRawUnsafe === "function");

  if (!hasRawQuery) {
    if (process.env["NODE_ENV"] === "production") {
      console.error("[RateLimiter] Database client with queryRawUnsafe is unavailable in production. Rejecting silent fallback.");
      throw new RateLimiterStorageError("Rate limiter database connection unavailable.");
    }
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
  } catch (err) {
    if (err instanceof RateLimiterStorageError) {
      throw err;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[RateLimiter] Database rate limiting peek failure:", {
      keyPrefix: key.slice(0, 8),
      error: errMsg,
    });
    if (process.env["NODE_ENV"] === "production" || options.prismaClient) {
      throw new RateLimiterStorageError("Database rate limiting storage failure.", err);
    }
    return peekMemoryRateLimit(key, limit, windowSeconds);
  }
}

/**
 * Atomically clears or resets a specific rate limit or lock key.
 * Backed by DELETE query on PostgreSQL with in-memory store eviction fallback.
 */
export async function clearRateLimit(options: {
  key: string;
  prismaClient?: PrismaClient;
  forceMemoryStore?: boolean;
}): Promise<void> {
  const { key, forceMemoryStore } = options;
  memoryStore.delete(key);

  if (forceMemoryStore || (process.env["VITEST"] && !options.prismaClient)) {
    return;
  }

  let prisma = options.prismaClient;
  if (!prisma) {
    try {
      const { PrismaClient } = await import("@prisma/client");
      prisma = new PrismaClient();
    } catch {
      // Prisma not available
    }
  }

  if (prisma && typeof (prisma as any).$executeRawUnsafe === "function") {
    try {
      await (prisma as any).$executeRawUnsafe(
        `DELETE FROM "_orbit_rate_limits" WHERE "key" = $1;`,
        key
      );
    } catch (err) {
      console.warn("[RateLimiter] Database clear rate limit warning:", {
        keyPrefix: key.slice(0, 8),
        error: err instanceof Error ? err.message : String(err),
      });
    }
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
  // Single-use Recovery Code Redemption: 5 attempts per account / 15 mins, 15 attempts per IP / 15 mins
  RECOVERY_CODE_ACCOUNT: {
    limit: 5,
    windowSeconds: 15 * 60, // 15 minutes
  },
  RECOVERY_CODE_IP: {
    limit: 15,
    windowSeconds: 15 * 60, // 15 minutes
  },
  // Password Reset Completion: 5 attempts per account / 15 mins, 10 attempts per IP / 15 mins
  RESET_COMPLETION_ACCOUNT: {
    limit: 5,
    windowSeconds: 15 * 60, // 15 minutes
  },
  RESET_COMPLETION_IP: {
    limit: 10,
    windowSeconds: 15 * 60, // 15 minutes
  },
  // Administrator Password Change: 5 attempts per account / 15 mins, 10 attempts per IP / 15 mins
  PASSWORD_CHANGE_ACCOUNT: {
    limit: 5,
    windowSeconds: 15 * 60, // 15 minutes
  },
  PASSWORD_CHANGE_IP: {
    limit: 10,
    windowSeconds: 15 * 60, // 15 minutes
  },
};
