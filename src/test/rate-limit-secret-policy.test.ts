import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  getRateLimitSecret,
  validateRateLimitConfig,
  RateLimitConfigurationError,
  hashAccountIdentifier,
  hashIpIdentifier,
  extractTrustedClientIp,
} from "@/lib/server/client-ip";
import {
  consumeRateLimit,
  peekRateLimit,
  resetMemoryRateLimitStore,
  RateLimiterStorageError,
  AUTH_RATE_THRESHOLDS,
} from "@/lib/server/rate-limiter";
import {
  evaluateLoginRateLimitOperation,
  requestPasswordResetOperation,
  recordPasswordResetCompletionOperation,
  changeAdminPasswordOperation,
} from "@/lib/server/auth-rate-limit-operations";
import {
  verifyAndRedeemRecoveryCodeOperation,
  SERVICE_UNAVAILABLE_RECOVERY_ERROR,
} from "@/lib/server/recovery-code-operations";

vi.mock("@/lib/auth/server-auth", () => ({
  requireAal2: vi.fn().mockResolvedValue({
    user: { id: "admin-uuid", email: "admin@cobralearn.in" },
    profile: {
      id: "admin-uuid",
      email: "admin@cobralearn.in",
      role: "super_admin",
      is_active: true,
    },
  }),
  requireAdminProfile: vi.fn().mockResolvedValue({
    id: "admin-uuid",
    email: "admin@cobralearn.in",
    role: "super_admin",
    is_active: true,
  }),
}));

describe("Phase 6 — RATE_LIMIT_SECRET Policy & Security Fail-Closed Regression Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetMemoryRateLimitStore();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // =========================================================================
  // Category 1: Secret Configuration Tests (Requirements 1 - 8)
  // =========================================================================

  it("1. A valid dedicated production secret is accepted", () => {
    process.env["NODE_ENV"] = "production";
    process.env["RATE_LIMIT_SECRET"] = "production-high-entropy-secret-with-at-least-32-chars-long";

    const secret = getRateLimitSecret();
    expect(secret).toBe("production-high-entropy-secret-with-at-least-32-chars-long");
    expect(() => validateRateLimitConfig()).not.toThrow();
  });

  it("2. Missing RATE_LIMIT_SECRET in production is rejected safely", () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["RATE_LIMIT_SECRET"];

    expect(() => getRateLimitSecret()).toThrowError(RateLimitConfigurationError);
    expect(() => getRateLimitSecret()).toThrow(/RATE_LIMIT_SECRET.*missing or empty.*production/i);
    expect(() => validateRateLimitConfig()).toThrowError(RateLimitConfigurationError);
  });

  it("3. An empty or whitespace-only production secret is rejected", () => {
    process.env["NODE_ENV"] = "production";

    process.env["RATE_LIMIT_SECRET"] = "";
    expect(() => getRateLimitSecret()).toThrowError(RateLimitConfigurationError);

    process.env["RATE_LIMIT_SECRET"] = "     \t   \n  ";
    expect(() => getRateLimitSecret()).toThrowError(RateLimitConfigurationError);
  });

  it("4. An insufficient-strength production secret is rejected (< 32 chars)", () => {
    process.env["NODE_ENV"] = "production";
    process.env["RATE_LIMIT_SECRET"] = "short-key-12345"; // 15 characters

    expect(() => getRateLimitSecret()).toThrowError(RateLimitConfigurationError);
    expect(() => getRateLimitSecret()).toThrow(/insufficient entropy/i);
  });

  it("5. Production configuration never falls back to SUPABASE_SERVICE_ROLE_KEY", () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["RATE_LIMIT_SECRET"];
    process.env["SUPABASE_SERVICE_ROLE_KEY"] =
      "mock-service-role-key-that-is-longer-than-32-characters";

    // When RATE_LIMIT_SECRET is missing, MUST NOT fallback to service role key
    expect(() => getRateLimitSecret()).toThrowError(RateLimitConfigurationError);

    // Furthermore, explicitly attempting to reuse SUPABASE_SERVICE_ROLE_KEY as RATE_LIMIT_SECRET is rejected
    process.env["RATE_LIMIT_SECRET"] = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    expect(() => getRateLimitSecret()).toThrowError(RateLimitConfigurationError);
    expect(() => getRateLimitSecret()).toThrow(/must not reuse SUPABASE_SERVICE_ROLE_KEY/i);
  });

  it("6. Production configuration never falls back to a hardcoded or static salt", () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["RATE_LIMIT_SECRET"];
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];

    // Must not return default static salt
    expect(() => getRateLimitSecret()).toThrowError(RateLimitConfigurationError);

    // Explicitly providing the static default salt in production must also be rejected
    process.env["RATE_LIMIT_SECRET"] = "orbit-rate-limit-default-salt-v1";
    expect(() => getRateLimitSecret()).toThrowError(RateLimitConfigurationError);
    expect(() => getRateLimitSecret()).toThrow(/cannot use static or development fallback/i);
  });

  it("7. Development/test configuration follows the explicitly intended policy", () => {
    // In test environment without explicit RATE_LIMIT_SECRET, safe test fallback is used
    process.env["NODE_ENV"] = "test";
    delete process.env["RATE_LIMIT_SECRET"];
    const testSecret = getRateLimitSecret();
    expect(testSecret).toBe("orbit-test-rate-limit-secret-32-bytes-mock-key-for-testing-only");

    // In development environment without explicit RATE_LIMIT_SECRET, safe dev fallback is used
    process.env["NODE_ENV"] = "development";
    delete process.env["RATE_LIMIT_SECRET"];
    const devSecret = getRateLimitSecret();
    expect(devSecret).toBe("orbit-dev-rate-limit-secret-local-development-only-not-for-prod");

    // In test/dev with explicit RATE_LIMIT_SECRET, explicit secret is honored
    process.env["RATE_LIMIT_SECRET"] = "custom-test-secret-explicitly-configured";
    expect(getRateLimitSecret()).toBe("custom-test-secret-explicitly-configured");
  });

  it("8. Test configuration cannot cause production to bypass validation", () => {
    // Even if VITEST is active, if NODE_ENV is production, production checks MUST NOT be bypassed
    process.env["NODE_ENV"] = "production";
    process.env["VITEST"] = "true";
    delete process.env["RATE_LIMIT_SECRET"];

    expect(() => getRateLimitSecret()).toThrowError(RateLimitConfigurationError);

    process.env["RATE_LIMIT_SECRET"] = "short";
    expect(() => getRateLimitSecret()).toThrowError(RateLimitConfigurationError);
  });

  // =========================================================================
  // Category 2: Rate Limiting & Fail-Closed Behavior (Requirements 9 - 14)
  // =========================================================================

  it("9. Rate limiting works when a valid dedicated secret is supplied", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["RATE_LIMIT_SECRET"] = "a-secure-production-random-secret-key-32bytes";

    const hashEmail = hashAccountIdentifier("admin@cobralearn.in");
    const hashIp = hashIpIdentifier("203.0.113.50");

    expect(hashEmail).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp).toMatch(/^[0-9a-f]{32}$/);

    const dummyRequest = new Request("https://api.internal/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.50" },
    });

    const result = await evaluateLoginRateLimitOperation(dummyRequest, {
      email: "admin@cobralearn.in",
      peek: true,
    });

    expect(result.allowed).toBe(true);
  });

  it("10. Failure to initialize the rate limiter does not permit a protected operation to proceed without its required rate limit (fail closed on secret derivation failure)", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["RATE_LIMIT_SECRET"]; // Missing secret throws in production

    const dummyRequest = new Request("https://api.internal/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.50" },
    });

    // 10a. Login evaluation fails closed
    const loginResult = await evaluateLoginRateLimitOperation(dummyRequest, {
      email: "admin@cobralearn.in",
    });
    expect(loginResult.allowed).toBe(false);
    expect(loginResult.message).toContain("Rate limit evaluation unavailable");

    // 10b. Password reset request fails closed
    const resetResult = await requestPasswordResetOperation(dummyRequest, {
      email: "admin@cobralearn.in",
    });
    expect(resetResult.success).toBe(false);
    expect(resetResult.message).toContain("temporarily unavailable");

    // 10c. Password reset completion fails closed
    const compResult = await recordPasswordResetCompletionOperation(dummyRequest, {
      accessToken: "mock-token",
    });
    expect(compResult.success).toBe(false);
    expect(compResult.message).toContain("temporarily unavailable");

    // 10d. Password change fails closed
    const changeResult = await changeAdminPasswordOperation(dummyRequest, {
      currentPassword: "OldPassword123!",
      newPassword: "SecurePassword123!",
    });
    expect(changeResult.success).toBe(false);
    expect(changeResult.message).toContain("temporarily unavailable");

    // 10e. Recovery code verification fails closed
    const recoveryResult = await verifyAndRedeemRecoveryCodeOperation(
      dummyRequest,
      { adminId: "admin-uuid", code: "ABCD-EFGH-IJKL" },
      { adminRecoveryCode: {} } as unknown as PrismaClient,
    );
    expect(recoveryResult.success).toBe(false);
    expect(recoveryResult.error).toBe(SERVICE_UNAVAILABLE_RECOVERY_ERROR);
  });

  it("11. Failure to access rate-limit storage does not silently allow the protected operation", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["RATE_LIMIT_SECRET"] = "a-secure-production-random-secret-key-32bytes";

    const failingPrismaMock = {
      $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("Database connection pool exhausted")),
    } as unknown as PrismaClient;

    const dummyRequest = new Request("https://api.internal/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.50" },
    });

    const result = await evaluateLoginRateLimitOperation(
      dummyRequest,
      { email: "admin@cobralearn.in" },
      failingPrismaMock,
    );

    // Fail closed: must NOT allow login attempt if database storage fails
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Rate limit evaluation unavailable. Request rejected.");
  });

  it("12. Existing rate-limit thresholds, reset behavior, and normal request behavior remain intact", async () => {
    process.env["NODE_ENV"] = "test";
    process.env["RATE_LIMIT_SECRET"] = "valid-test-secret-at-least-32-chars-entropy-test";

    // Ensure thresholds are defined and non-zero
    expect(AUTH_RATE_THRESHOLDS.LOGIN_IP.limit).toBe(20);
    expect(AUTH_RATE_THRESHOLDS.LOGIN_IP.windowSeconds).toBe(900);
    expect(AUTH_RATE_THRESHOLDS.LOGIN_ACCOUNT.limit).toBe(5);
    expect(AUTH_RATE_THRESHOLDS.LOGIN_GLOBAL.limit).toBe(150);

    // Consume up to limit
    const key = "test:threshold:key";
    for (let i = 1; i <= 5; i++) {
      const res = await consumeRateLimit({ key, limit: 5, windowSeconds: 60 });
      expect(res.allowed).toBe(true);
      expect(res.current).toBe(i);
      expect(res.remaining).toBe(5 - i);
    }

    // 6th consumption must exceed limit
    const exceededRes = await consumeRateLimit({ key, limit: 5, windowSeconds: 60 });
    expect(exceededRes.allowed).toBe(false);
    expect(exceededRes.current).toBe(6);
    expect(exceededRes.remaining).toBe(0);
    expect(exceededRes.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("13. Existing IP handling and HMAC/key derivation remain compatible with the intended security design", () => {
    process.env["NODE_ENV"] = "production";
    process.env["RATE_LIMIT_SECRET"] = "cryptographically-random-dedicated-hmac-secret-32-bytes";

    // Case normalization produces matching hashes
    const hash1 = hashAccountIdentifier("User.Admin@CobraLearn.in");
    const hash2 = hashAccountIdentifier("user.admin@cobralearn.in");
    const hash3 = hashAccountIdentifier("different.user@cobralearn.in");
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);

    // Sensitive identifiers are not present in hash output
    expect(hash1).not.toContain("User");
    expect(hash1).not.toContain("cobralearn");
    expect(hash1).not.toContain("@");

    // IP extraction respects proxy hierarchy
    const cfReq = { "cf-connecting-ip": "198.51.100.99", "x-forwarded-for": "10.0.0.1" };
    expect(extractTrustedClientIp(cfReq)).toBe("198.51.100.99");
  });

  it("14. Existing authentication and recovery workflows do not regress", async () => {
    process.env["NODE_ENV"] = "test";
    process.env["RATE_LIMIT_SECRET"] = "test-session-secret-at-least-32-characters-entropy";

    const dummyRequest = new Request("https://api.internal/auth/login", {
      headers: { "cf-connecting-ip": "198.51.100.42" },
    });

    // Peeking login rate limit
    const peekResult = await evaluateLoginRateLimitOperation(dummyRequest, {
      email: "valid.admin@cobralearn.in",
      peek: true,
    });
    expect(peekResult.allowed).toBe(true);

    // Password reset with invalid email returns generic success immediately
    const resetResult = await requestPasswordResetOperation(dummyRequest, {
      email: "invalid-syntax",
    });
    expect(resetResult.success).toBe(true);
    expect(resetResult.message).toContain("password reset link has been dispatched");
  });
});
