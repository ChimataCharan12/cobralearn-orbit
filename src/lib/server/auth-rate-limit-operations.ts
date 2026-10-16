import type { PrismaClient } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractTrustedClientIp,
  hashAccountIdentifier,
  hashIpIdentifier,
  maskIpAddress,
} from "@/lib/server/client-ip";
import {
  consumeRateLimit,
  peekRateLimit,
  AUTH_RATE_THRESHOLDS,
  type RateLimitResult,
} from "@/lib/server/rate-limiter";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export interface EvaluateLoginPayload {
  email: string;
  peek?: boolean;
}

export interface EvaluateLoginResult {
  allowed: boolean;
  message?: string;
  retryAfterSeconds?: number;
}

export interface RequestPasswordResetPayload {
  email: string;
  redirectTo?: string;
}

export interface RequestPasswordResetResult {
  success: boolean;
  message: string;
}

let defaultPrisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient | undefined> {
  if (process.env.VITEST) {
    return undefined;
  }
  if (!defaultPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

/**
 * Evaluates rate limits for an administrator login attempt before/during authentication.
 * Checks IP-level, global-level, and privacy-preserving account-level rate limits.
 * Supports peek checks to evaluate cooldown without consuming attempts.
 * If exceeded, records a throttled event in AdminAuditLog without leaking sensitive data.
 */
export async function evaluateLoginRateLimitOperation(
  request: Request,
  payload: EvaluateLoginPayload,
  prismaClient?: PrismaClient
): Promise<EvaluateLoginResult> {
  const prisma = prismaClient || (await getPrisma());
  const clientIp = extractTrustedClientIp(request.headers);

  const cleanEmail = (payload?.email || "").trim().toLowerCase();
  const isPeek = Boolean(payload?.peek);
  const limiterFn = isPeek ? peekRateLimit : consumeRateLimit;

  const accountHash = cleanEmail ? hashAccountIdentifier(cleanEmail) : "";
  const ipHash = hashIpIdentifier(clientIp);

  const accountKey = cleanEmail ? `login:act:${accountHash}` : null;
  const ipKey = `login:ip:${ipHash}`;
  const globalKey = `login:global`;

  // Evaluate IP, Global, and Account limits concurrently
  const promises: Promise<RateLimitResult>[] = [
    limiterFn({
      key: ipKey,
      limit: AUTH_RATE_THRESHOLDS.LOGIN_IP.limit,
      windowSeconds: AUTH_RATE_THRESHOLDS.LOGIN_IP.windowSeconds,
      prismaClient: prisma,
    }),
    limiterFn({
      key: globalKey,
      limit: AUTH_RATE_THRESHOLDS.LOGIN_GLOBAL.limit,
      windowSeconds: AUTH_RATE_THRESHOLDS.LOGIN_GLOBAL.windowSeconds,
      prismaClient: prisma,
    }),
  ];

  if (accountKey) {
    promises.push(
      limiterFn({
        key: accountKey,
        limit: AUTH_RATE_THRESHOLDS.LOGIN_ACCOUNT.limit,
        windowSeconds: AUTH_RATE_THRESHOLDS.LOGIN_ACCOUNT.windowSeconds,
        prismaClient: prisma,
      })
    );
  }

  const results = await Promise.all(promises);
  const ipResult = results[0];
  const globalResult = results[1];
  const accountResult = accountKey
    ? results[2]
    : { allowed: true, current: 0, limit: 5, remaining: 5, resetAt: new Date(), retryAfterSeconds: undefined };

  if (!accountResult.allowed || !ipResult.allowed || !globalResult.allowed) {
    const retryAfter = Math.max(
      accountResult.retryAfterSeconds || 0,
      ipResult.retryAfterSeconds || 0,
      globalResult.retryAfterSeconds || 0,
      1
    );

    // Record throttled event to AdminAuditLog (skip during peek checks)
    if (!isPeek) {
      try {
        if (prisma && typeof prisma.adminAuditLog?.create === "function") {
          let reason = "ip_limit_exceeded";
          if (!accountResult.allowed) reason = "account_limit_exceeded";
          else if (!globalResult.allowed) reason = "global_limit_exceeded";

          await prisma.adminAuditLog.create({
            data: {
              actorEmail: "security-gate@cobralearn.internal",
              action: "auth:login_throttled",
              module: "auth_abuse_protection",
              entityId: accountHash ? accountHash.slice(0, 16) : "ip_gate",
              metadata: {
                reason,
                retryAfterSeconds: retryAfter,
              },
              ipAddress: maskIpAddress(clientIp),
            },
          });
        }
      } catch (err) {
        console.warn("[RateLimiter] Failed to record login throttle audit log:", err instanceof Error ? err.message : String(err));
      }
    }

    return {
      allowed: false,
      message: "Too many login attempts. Please try again later.",
      retryAfterSeconds: retryAfter,
    };
  }

  return { allowed: true };
}

/**
 * Handles password-recovery requests with strict server-side rate limiting.
 * Enforces:
 * - Privacy-preserving account-level and IP-level limits
 * - Generic responses preventing account enumeration
 * - Validation of redirect destinations (no open redirects)
 * - Safe test mode (never sends live emails in tests)
 * - Bounded audit logging without sensitive tokens or recovery URLs
 */
export async function requestPasswordResetOperation(
  request: Request,
  payload: RequestPasswordResetPayload,
  prismaClient?: PrismaClient,
  supabaseClientOverride?: SupabaseClient
): Promise<RequestPasswordResetResult> {
  const prisma = prismaClient || (await getPrisma());
  const clientIp = extractTrustedClientIp(request.headers);

  const cleanEmail = (payload?.email || "").trim().toLowerCase();

  // Generic client confirmation text (same for valid, invalid, existing, or non-existing accounts)
  const genericSuccessMessage =
    "If an account is associated with this email, a password reset link has been dispatched.";

  // If email syntax is completely invalid, return generic response without triggering rate limiter or Supabase
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return {
      success: true,
      message: genericSuccessMessage,
    };
  }

  const accountHash = hashAccountIdentifier(cleanEmail);
  const ipHash = hashIpIdentifier(clientIp);

  const accountKey = `recov:act:${accountHash}`;
  const ipKey = `recov:ip:${ipHash}`;

  // Evaluate rate limits
  const [accountResult, ipResult] = await Promise.all([
    consumeRateLimit({
      key: accountKey,
      limit: AUTH_RATE_THRESHOLDS.RECOVERY_ACCOUNT.limit,
      windowSeconds: AUTH_RATE_THRESHOLDS.RECOVERY_ACCOUNT.windowSeconds,
      prismaClient: prisma,
    }),
    consumeRateLimit({
      key: ipKey,
      limit: AUTH_RATE_THRESHOLDS.RECOVERY_IP.limit,
      windowSeconds: AUTH_RATE_THRESHOLDS.RECOVERY_IP.windowSeconds,
      prismaClient: prisma,
    }),
  ]);

  if (!accountResult.allowed || !ipResult.allowed) {
    // Record throttled recovery event
    try {
      if (typeof prisma.adminAuditLog?.create === "function") {
        await prisma.adminAuditLog.create({
          data: {
            actorEmail: "security-gate@cobralearn.internal",
            action: "auth:recovery_throttled",
            module: "auth_abuse_protection",
            entityId: accountHash.slice(0, 16),
            metadata: {
              reason: !accountResult.allowed ? "account_limit_exceeded" : "ip_limit_exceeded",
            },
            ipAddress: maskIpAddress(clientIp),
          },
        });
      }
    } catch {
      // Non-fatal audit log failure
    }

    // Return generic success or rate-limit message.
    // For anti-enumeration, return generic success message with slight delay or generic rate limit.
    return {
      success: true,
      message: genericSuccessMessage,
    };
  }

  // Determine safe redirect destination
  const defaultRedirectPath = "/auth/callback?type=recovery&next=/admin/reset-password";
  let targetRedirect = defaultRedirectPath;
  if (payload.redirectTo) {
    targetRedirect = safeRedirect(payload.redirectTo, defaultRedirectPath);
  }

  // Construct absolute redirect URL safely
  let absoluteRedirect = targetRedirect;
  try {
    const origin = request.headers.get("origin") || request.headers.get("referer");
    if (origin) {
      const parsedOrigin = new URL(origin).origin;
      absoluteRedirect = `${parsedOrigin}${targetRedirect}`;
    }
  } catch {
    // Fall back to relative or default
  }

  // Dispatch password reset via Supabase Admin Client
  // Skip live email dispatch in test or mock environments
  if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
    try {
      const supabase = supabaseClientOverride || getSupabaseAdminClient();
      await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: absoluteRedirect,
      });
    } catch (err) {
      console.error("[requestPasswordResetOperation] Non-fatal Supabase reset error:", err instanceof Error ? err.message : String(err));
    }
  }

  return {
    success: true,
    message: genericSuccessMessage,
  };
}
