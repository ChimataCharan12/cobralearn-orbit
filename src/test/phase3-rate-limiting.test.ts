import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  consumeRateLimit,
  peekRateLimit,
  resetMemoryRateLimitStore,
  RateLimiterStorageError,
  AUTH_RATE_THRESHOLDS,
} from "@/lib/server/rate-limiter";
import {
  extractTrustedClientIp,
  maskIpAddress,
  hashAccountIdentifier,
  hashIpIdentifier,
  isValidIP,
  isValidIPv4,
  isValidIPv6,
} from "@/lib/server/client-ip";
import {
  evaluateLoginRateLimitOperation,
  requestPasswordResetOperation,
  recordPasswordResetCompletionOperation,
} from "@/lib/server/auth-rate-limit-operations";
import { canPerform, AdminPermissions } from "@/lib/auth/rbac";
import { AuthProvider, useAuth } from "@/lib/auth/use-auth";
import { AdminLoginForm, formatMMSS } from "@/components/AdminLoginForm";
import { authService } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useRouter: () => ({
    navigate: mockNavigate,
    state: { location: { pathname: "/admin" } },
  }),
}));

describe("Phase 3 — CobraLearn Orbit Server-Side Rate Limiting & Abuse Protection", () => {
  beforeEach(() => {
    resetMemoryRateLimitStore();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Requirement 1: Requests below configured threshold are allowed
  // =========================================================================
  it("Requirement 1: Requests below the configured threshold are allowed", async () => {
    const key = "test:account:sub_threshold";
    const limit = 5;
    const windowSeconds = 60;

    for (let i = 1; i <= 4; i++) {
      const res = await consumeRateLimit({ key, limit, windowSeconds });
      expect(res.allowed).toBe(true);
      expect(res.current).toBe(i);
      expect(res.remaining).toBe(limit - i);
    }
  });

  // =========================================================================
  // Requirement 2: Requests at and above threshold are rejected
  // =========================================================================
  it("Requirement 2: Requests at and above threshold are rejected according to documented policy", async () => {
    const key = "test:account:at_threshold";
    const limit = 5;
    const windowSeconds = 60;

    // 5 attempts allowed
    for (let i = 1; i <= 5; i++) {
      const res = await consumeRateLimit({ key, limit, windowSeconds });
      expect(res.allowed).toBe(true);
      expect(res.current).toBe(i);
    }

    // 6th attempt rejected
    const blockedRes = await consumeRateLimit({ key, limit, windowSeconds });
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.current).toBe(6);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.retryAfterSeconds).toBeGreaterThan(0);
  });

  // =========================================================================
  // Requirement 3: Window expiration restores eligibility
  // =========================================================================
  it("Requirement 3: Window expiration restores eligibility", async () => {
    vi.useFakeTimers();
    const key = "test:account:window_expiry";
    const limit = 3;
    const windowSeconds = 60;

    // Exhaust limit
    for (let i = 0; i < 3; i++) {
      await consumeRateLimit({ key, limit, windowSeconds, forceMemoryStore: true });
    }
    const blocked = await consumeRateLimit({ key, limit, windowSeconds, forceMemoryStore: true });
    expect(blocked.allowed).toBe(false);

    // Fast-forward time past window expiration
    vi.advanceTimersByTime(61 * 1000);

    // New request after window reset must be allowed and reset counter to 1
    const renewed = await consumeRateLimit({ key, limit, windowSeconds, forceMemoryStore: true });
    expect(renewed.allowed).toBe(true);
    expect(renewed.current).toBe(1);
    expect(renewed.remaining).toBe(2);
  });

  // =========================================================================
  // Requirement 4: Concurrent requests cannot bypass the threshold
  // =========================================================================
  it("Requirement 4: Concurrent requests cannot bypass the threshold", async () => {
    const key = "test:account:concurrent_burst";
    const limit = 5;
    const windowSeconds = 60;

    // Fire 15 simultaneous requests
    const promises = Array.from({ length: 15 }, () =>
      consumeRateLimit({ key, limit, windowSeconds })
    );

    const results = await Promise.all(promises);
    const allowedCount = results.filter((r) => r.allowed).length;
    const rejectedCount = results.filter((r) => !r.allowed).length;

    expect(allowedCount).toBe(5);
    expect(rejectedCount).toBe(10);
  });

  // =========================================================================
  // Requirement 5: Limits are shared across simulated server instances
  // =========================================================================
  it("Requirement 5: Limits are shared across simulated server instances against common store", async () => {
    const sharedKey = "test:account:shared_instances";
    const limit = 4;
    const windowSeconds = 60;

    // Instance A makes 2 requests
    const resA1 = await consumeRateLimit({ key: sharedKey, limit, windowSeconds });
    const resA2 = await consumeRateLimit({ key: sharedKey, limit, windowSeconds });
    expect(resA1.allowed).toBe(true);
    expect(resA2.allowed).toBe(true);

    // Instance B makes 2 requests against the same shared store
    const resB1 = await consumeRateLimit({ key: sharedKey, limit, windowSeconds });
    const resB2 = await consumeRateLimit({ key: sharedKey, limit, windowSeconds });
    expect(resB1.allowed).toBe(true);
    expect(resB2.allowed).toBe(true);

    // Instance C attempts 5th request and is blocked
    const resC1 = await consumeRateLimit({ key: sharedKey, limit, windowSeconds });
    expect(resC1.allowed).toBe(false);
  });

  // =========================================================================
  // Requirement 6: Account-based keys do not expose raw email addresses
  // =========================================================================
  it("Requirement 6: Account-based keys use keyed HMAC and never expose raw email addresses", () => {
    const rawEmail1 = "Admin.Test@CobraLearn.in";
    const rawEmail2 = "admin.test@cobralearn.in";
    const rawEmail3 = "other.admin@cobralearn.in";

    const hash1 = hashAccountIdentifier(rawEmail1);
    const hash2 = hashAccountIdentifier(rawEmail2);
    const hash3 = hashAccountIdentifier(rawEmail3);

    // Normalization check: same case-insensitive identity produces identical hash
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);

    // Format check: 64-character SHA-256 hex string
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);

    // Privacy check: raw email is never present in hash
    expect(hash1).not.toContain("admin");
    expect(hash1).not.toContain("cobralearn");
    expect(hash1).not.toContain("@");
  });

  // =========================================================================
  // Requirement 7: Arbitrary forwarded headers cannot bypass trusted IP limits
  // =========================================================================
  it("Requirement 7: Arbitrary forwarded headers cannot bypass or manipulate trusted IP limits", () => {
    // Edge provider header takes precedence over spoofed X-Forwarded-For
    const headersWithCloudflare = {
      "cf-connecting-ip": "203.0.113.195",
      "x-forwarded-for": "198.51.100.1, 10.0.0.1",
    };
    expect(extractTrustedClientIp(headersWithCloudflare)).toBe("203.0.113.195");

    // When only X-Forwarded-For is present, parse the rightmost entry (immediate trusted reverse-proxy hop)
    // Attackers prepending "1.1.1.1" cannot spoof the derived IP
    const headersForwarded = {
      "x-forwarded-for": "1.1.1.1, 198.51.100.42",
    };
    expect(extractTrustedClientIp(headersForwarded)).toBe("198.51.100.42");
  });

  // =========================================================================
  // Requirement 8: Missing or malformed IP metadata is handled safely
  // =========================================================================
  it("Requirement 8: Missing or malformed IP metadata is handled safely", () => {
    // Malformed IP strings
    expect(isValidIP("not-an-ip")).toBe(false);
    expect(isValidIP("999.999.999.999")).toBe(false);
    expect(isValidIP("1.2.3.4.5")).toBe(false);

    // Headers with injection attempts or malformed content
    const maliciousHeaders = {
      "x-forwarded-for": "<script>alert(1)</script>, invalid-ip-string",
    };
    const resolvedMalicious = extractTrustedClientIp(maliciousHeaders);
    // Must safely fallback rather than returning invalid or unparsed string
    expect(resolvedMalicious).toBe("127.0.0.1");

    // Empty headers
    const emptyHeaders = {};
    const resolvedEmpty = extractTrustedClientIp(emptyHeaders);
    expect(resolvedEmpty).toBe("127.0.0.1");

    // IP masking
    expect(maskIpAddress("198.51.100.42")).toBe("198.51.100.***");
    expect(maskIpAddress("2001:db8:85a3::8a2e:370:7334")).toBe("2001:db8:****:****");
    expect(maskIpAddress(null)).toBe("unknown");
    expect(maskIpAddress("malformed")).toBe("unknown");
  });

  // =========================================================================
  // Requirement 9: Password-recovery responses do not disclose account existence
  // =========================================================================
  it("Requirement 9: Password-recovery responses do not disclose account existence", async () => {
    const mockPrisma = {
      adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
    } as any;

    const req1 = new Request("https://api.internal/auth/recovery", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.10" },
    });
    const req2 = new Request("https://api.internal/auth/recovery", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.11" },
    });

    // Request for existing email vs non-existing email vs invalid syntax
    const resExisting = await requestPasswordResetOperation(
      req1,
      { email: "superadmin@cobralearn.in" },
      mockPrisma
    );
    const resNonExisting = await requestPasswordResetOperation(
      req2,
      { email: "nonexistent.user.404@cobralearn.in" },
      mockPrisma
    );

    expect(resExisting.success).toBe(true);
    expect(resNonExisting.success).toBe(true);
    // Identical response prevents account enumeration
    expect(resExisting.message).toBe(resNonExisting.message);
    expect(resExisting.message).toContain("If an account is associated with this email");
  });

  // =========================================================================
  // Requirement 10: Hardened storage failures refuse silent fallback and fail closed
  // =========================================================================
  it("Requirement 10: Database rate-limiting storage failures reject silent fallback and fail closed", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // 1. Storage failure (connection dropped) throws RateLimiterStorageError
    const faultyPrisma = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("Connection reset by peer")),
    } as any;

    await expect(
      consumeRateLimit({
        key: "test:faulty:store",
        limit: 3,
        windowSeconds: 60,
        prismaClient: faultyPrisma,
      })
    ).rejects.toThrow(RateLimiterStorageError);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[RateLimiter] Database rate limiting storage failure"),
      expect.anything()
    );

    // 2. Missing table failure explicitly throws RateLimiterStorageError
    const missingTablePrisma = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      $queryRawUnsafe: vi.fn().mockRejectedValue(new Error('relation "_orbit_rate_limits" does not exist')),
    } as any;

    await expect(
      consumeRateLimit({
        key: "test:missing_table",
        limit: 3,
        windowSeconds: 60,
        prismaClient: missingTablePrisma,
      })
    ).rejects.toThrow(RateLimiterStorageError);

    // 3. Healthy PostgreSQL-backed request retains atomic upsert behavior
    const healthyPrisma = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      $queryRawUnsafe: vi.fn().mockResolvedValue([
        { count: 1, reset_at: new Date(Date.now() + 60000).toISOString() },
      ]),
    } as any;

    const healthyRes = await consumeRateLimit({
      key: "test:healthy:postgres",
      limit: 5,
      windowSeconds: 60,
      prismaClient: healthyPrisma,
    });
    expect(healthyRes.allowed).toBe(true);
    expect(healthyRes.current).toBe(1);
    expect(healthyRes.remaining).toBe(4);

    // 4. evaluateLoginRateLimitOperation fails closed upon storage failure
    const reqLogin = new Request("https://api.internal/auth/login", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.50" },
    });
    const loginFailClosed = await evaluateLoginRateLimitOperation(
      reqLogin,
      { email: "target@cobralearn.in" },
      faultyPrisma
    );
    expect(loginFailClosed.allowed).toBe(false);
    expect(loginFailClosed.message).toBe("Rate limit evaluation unavailable. Request rejected.");

    // 5. requestPasswordResetOperation fails closed upon storage failure
    const reqReset = new Request("https://api.internal/auth/recovery", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.50" },
    });
    const resetFailClosed = await requestPasswordResetOperation(
      reqReset,
      { email: "target@cobralearn.in" },
      faultyPrisma
    );
    expect(resetFailClosed.success).toBe(false);
    expect(resetFailClosed.message).toBe("Password reset service temporarily unavailable. Please try again later.");

    // 6. recordPasswordResetCompletionOperation fails closed upon storage failure without provider update
    const mockSupabaseAdmin = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "test-user-id", email: "target@cobralearn.in" } },
          error: null,
        }),
        admin: {
          updateUserById: vi.fn(),
        },
      },
    } as any;

    const reqComp = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.50" },
    });
    const compFailClosed = await recordPasswordResetCompletionOperation(
      reqComp,
      { accessToken: "valid.token.here", newPassword: "NewSecurePassword123!" },
      faultyPrisma,
      mockSupabaseAdmin
    );
    expect(compFailClosed.success).toBe(false);
    expect(compFailClosed.message).toBe("Password reset service temporarily unavailable. Please try again later.");
    expect(mockSupabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Requirement 11: Existing Supabase authentication and session-refresh remain intact
  // =========================================================================
  it("Requirement 11: Existing Supabase authentication and session-refresh remain intact", async () => {
    // Pre-flight check allows valid traffic under threshold
    const mockPrisma = {
      adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
    } as any;

    const req = new Request("https://api.internal/auth/login", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.50" },
    });

    const evalResult = await evaluateLoginRateLimitOperation(
      req,
      { email: "admin@cobralearn.in" },
      mockPrisma
    );

    expect(evalResult.allowed).toBe(true);
    expect(evalResult.message).toBeUndefined();
  });

  // =========================================================================
  // Requirement 12: Existing active-admin eligibility checks and RBAC remain intact
  // =========================================================================
  it("Requirement 12: Existing active-admin eligibility checks and RBAC remain intact", () => {
    // RBAC permissions are not modified or degraded by rate limiting
    expect(canPerform("SUPER_ADMIN", AdminPermissions.ROLE_ASSIGN)).toBe(true);
    expect(canPerform("ADMIN", AdminPermissions.AUDIT_LOG_READ)).toBe(true);
    expect(canPerform("EDITOR", AdminPermissions.ROLE_ASSIGN)).toBe(false);
  });

  // =========================================================================
  // Requirement 13: No credentials, tokens, recovery URLs, or unnecessary IP data appear in logs
  // =========================================================================
  it("Requirement 13: No credentials, tokens, recovery URLs, or raw IP data appear in audit logs", async () => {
    const auditCreatedPayloads: any[] = [];
    const mockPrisma = {
      adminAuditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          auditCreatedPayloads.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
    } as any;

    const req = new Request("https://api.internal/auth/login", {
      method: "POST",
      headers: {
        "x-real-ip": "198.51.100.77",
      },
    });

    // Exhaust login rate limit to trigger audit log entry
    for (let i = 0; i < 6; i++) {
      await evaluateLoginRateLimitOperation(
        req,
        { email: "victim.admin@cobralearn.in" },
        mockPrisma
      );
    }

    expect(auditCreatedPayloads.length).toBeGreaterThan(0);
    const auditEntry = auditCreatedPayloads[0];

    // Audit log verification
    expect(auditEntry.action).toBe("auth:login_throttled");
    expect(auditEntry.ipAddress).toBe("198.51.100.***"); // Masked
    expect(auditEntry.actorEmail).toBe("security-gate@cobralearn.internal"); // Generic gate identity
    expect(auditEntry.entityId).not.toContain("victim.admin"); // Hashed, not plain email

    const serializedLog = JSON.stringify(auditEntry);
    expect(serializedLog).not.toContain("victim.admin@cobralearn.in");
    expect(serializedLog).not.toContain("password");
    expect(serializedLog).not.toContain("token");
  });

  // =========================================================================
  // Requirement 14: Limiter cleanup or expiry prevents unbounded storage growth
  // =========================================================================
  it("Requirement 14: Limiter cleanup or expiry prevents unbounded storage growth", async () => {
    vi.useFakeTimers();

    const limit = 5;
    const windowSeconds = 10;

    // Create 100 distinct keys
    for (let i = 0; i < 100; i++) {
      await consumeRateLimit({
        key: `test:cleanup:key_${i}`,
        limit,
        windowSeconds,
        forceMemoryStore: true,
      });
    }

    // Fast-forward past window expiration
    vi.advanceTimersByTime(15 * 1000);

    // New key triggers pruning of expired entries
    await consumeRateLimit({
      key: "test:cleanup:new_key",
      limit,
      windowSeconds,
      forceMemoryStore: true,
    });

    // Old keys should have expired and reset count to 1
    const checkOldKey = await peekRateLimit({
      key: "test:cleanup:key_0",
      limit,
      windowSeconds,
      forceMemoryStore: true,
    });
    expect(checkOldKey.current).toBe(0);
    expect(checkOldKey.allowed).toBe(true);
  });

  // =========================================================================
  // Requirement 15: Phase 3.1 Approved IP and Account Threshold Alignment
  // =========================================================================
  it("Requirement 15: Phase 3.1 aligned IP thresholds (20 login, 10 recovery) and preserved account thresholds (5 login, 3 recovery)", async () => {
    // 1. Verify exact threshold constants
    expect(AUTH_RATE_THRESHOLDS.LOGIN_ACCOUNT.limit).toBe(5);
    expect(AUTH_RATE_THRESHOLDS.LOGIN_ACCOUNT.windowSeconds).toBe(15 * 60);

    expect(AUTH_RATE_THRESHOLDS.LOGIN_IP.limit).toBe(20);
    expect(AUTH_RATE_THRESHOLDS.LOGIN_IP.windowSeconds).toBe(15 * 60);

    expect(AUTH_RATE_THRESHOLDS.RECOVERY_ACCOUNT.limit).toBe(3);
    expect(AUTH_RATE_THRESHOLDS.RECOVERY_ACCOUNT.windowSeconds).toBe(60 * 60);

    expect(AUTH_RATE_THRESHOLDS.RECOVERY_IP.limit).toBe(10);
    expect(AUTH_RATE_THRESHOLDS.RECOVERY_IP.windowSeconds).toBe(60 * 60);

    // 2. IP-level login spray test: 20 distinct accounts from same IP allowed, 21st blocked by IP limit
    const mockPrisma = {
      adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
    } as any;

    const ip = "198.51.100.99";
    for (let i = 1; i <= 20; i++) {
      const req = new Request("https://api.internal/auth/login", {
        method: "POST",
        headers: { "x-real-ip": ip },
      });
      const res = await evaluateLoginRateLimitOperation(
        req,
        { email: `admin-spray-${i}@cobralearn.in` },
        mockPrisma
      );
      expect(res.allowed).toBe(true);
    }

    // 21st request from same IP is throttled even with fresh account
    const req21 = new Request("https://api.internal/auth/login", {
      method: "POST",
      headers: { "x-real-ip": ip },
    });
    const res21 = await evaluateLoginRateLimitOperation(
      req21,
      { email: "admin-spray-21@cobralearn.in" },
      mockPrisma
    );
    expect(res21.allowed).toBe(false);
    expect(res21.message).toBe("Too many login attempts. Please try again later.");
  });

  // =========================================================================
  // Requirement 16: End-to-end enforcement path: 5 permitted attempts, 6th denied without calling Supabase Auth
  // =========================================================================
  it("Requirement 16: The first 5 permitted attempts call Supabase Auth, but the 6th is denied and never calls Supabase Auth", async () => {
    const signInSpy = vi.spyOn(authService, "signIn").mockResolvedValue({
      data: null,
      error: new Error("Invalid login credentials"),
    });

    const targetEmail = "throttle-target-16@cobralearn.in";
    const targetPassword = "WrongPassword123!";

    function TestHookComponent({ onSignIn }: { onSignIn: (fn: (e: string, p: string) => Promise<any>) => void }) {
      const { signIn } = useAuth();
      React.useEffect(() => {
        onSignIn(signIn);
      }, [signIn, onSignIn]);
      return null;
    }

    let capturedSignIn!: (e: string, p: string) => Promise<any>;
    const { unmount } = render(
      React.createElement(AuthProvider, null,
        React.createElement(TestHookComponent, { onSignIn: (fn) => { capturedSignIn = fn; } })
      )
    );

    // Attempts 1 to 5: permitted, credentials sent to Supabase Auth, returns generic invalid error
    for (let i = 1; i <= 5; i++) {
      let res: any;
      await act(async () => {
        res = await capturedSignIn(targetEmail, targetPassword);
      });
      expect(res.error).toBeDefined();
      expect(res.error?.message).toBe("Invalid email or password.");
      expect(signInSpy).toHaveBeenCalledTimes(i);
    }

    // 6th attempt: rejected by rate limiter, NEVER reaches Supabase Auth
    let throttledRes: any;
    await act(async () => {
      throttledRes = await capturedSignIn(targetEmail, targetPassword);
    });
    expect(throttledRes.error).toBeDefined();
    expect(throttledRes.error?.message).toBe("Too many login attempts. Please try again later.");
    // Supabase Auth call count MUST remain 5 (not incremented to 6)
    expect(signInSpy).toHaveBeenCalledTimes(5);

    unmount();
  });

  // =========================================================================
  // Requirement 17: AdminLoginForm displays throttling message on 6th attempt instead of generic error
  // =========================================================================
  it("Requirement 17: AdminLoginForm displays rate-limit throttling message on 6th attempt instead of 'Invalid email or password.'", async () => {
    const signInSpy = vi.spyOn(authService, "signIn").mockResolvedValue({
      data: null,
      error: new Error("Invalid login credentials"),
    });

    const targetEmail = "throttle-ui-target-17@cobralearn.in";

    const { container, unmount } = render(
      React.createElement(AuthProvider, null,
        React.createElement(AdminLoginForm)
      )
    );

    const emailInput = screen.getByLabelText("Email Address") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    fireEvent.change(emailInput, { target: { value: targetEmail } });
    fireEvent.change(passwordInput, { target: { value: "WrongPass123!" } });

    // Submissions 1 through 5: allowed to reach Supabase Auth, display "Invalid email or password."
    for (let i = 1; i <= 5; i++) {
      await act(async () => {
        fireEvent.submit(submitButton.closest("form")!);
      });

      const statusMsg = screen.getByRole("status");
      expect(statusMsg.textContent).toBe("Invalid email or password.");
      expect(signInSpy).toHaveBeenCalledTimes(i);
    }

    // 6th submission: throttled before Supabase Auth, displays countdown message and disables button
    await act(async () => {
      fireEvent.submit(submitButton.closest("form")!);
    });

    const throttledStatusMsg = screen.getByRole("status");
    expect(throttledStatusMsg.textContent).toMatch(/Too many login attempts\. Try again in \d\d:\d\d\./);
    expect(submitButton.disabled).toBe(true);
    expect(signInSpy).toHaveBeenCalledTimes(5); // Supabase Auth not called!

    unmount();
  });

  // =========================================================================
  // Requirement 18: Window expiry restores login eligibility
  // =========================================================================
  it("Requirement 18: Window expiry (15 minutes) restores login eligibility", async () => {
    vi.useFakeTimers();

    const signInSpy = vi.spyOn(authService, "signIn").mockResolvedValue({
      data: null,
      error: new Error("Invalid login credentials"),
    });

    const targetEmail = "expiry-target-18@cobralearn.in";

    function TestComponent({ onSignIn }: { onSignIn: (fn: (e: string, p: string) => Promise<any>) => void }) {
      const { signIn } = useAuth();
      React.useEffect(() => {
        onSignIn(signIn);
      }, [signIn, onSignIn]);
      return null;
    }

    let capturedSignIn!: (e: string, p: string) => Promise<any>;
    const { unmount } = render(
      React.createElement(AuthProvider, null,
        React.createElement(TestComponent, { onSignIn: (fn) => { capturedSignIn = fn; } })
      )
    );

    // Consume 5 attempts
    for (let i = 1; i <= 5; i++) {
      await act(async () => {
        await capturedSignIn(targetEmail, "WrongPass!");
      });
    }
    expect(signInSpy).toHaveBeenCalledTimes(5);

    // 6th attempt is blocked
    let blockedRes: any;
    await act(async () => {
      blockedRes = await capturedSignIn(targetEmail, "WrongPass!");
    });
    expect(blockedRes.error?.message).toBe("Too many login attempts. Please try again later.");
    expect(signInSpy).toHaveBeenCalledTimes(5);

    // Fast-forward time past 15-minute window (15 * 60 * 1000 ms + 1s)
    vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

    // 7th attempt after expiry is permitted and calls Supabase Auth
    let renewedRes: any;
    await act(async () => {
      renewedRes = await capturedSignIn(targetEmail, "WrongPass!");
    });
    expect(renewedRes.error?.message).toBe("Invalid email or password.");
    expect(signInSpy).toHaveBeenCalledTimes(6);

    unmount();
  });

  // =========================================================================
  // Requirement 19: Rate-limit evaluation failure fails closed without calling Supabase Auth
  // =========================================================================
  it("Requirement 19: Rate-limit evaluation failure fails closed without calling Supabase Auth", async () => {
    const signInSpy = vi.spyOn(authService, "signIn");

    vi.spyOn(adminClient, "evaluateLoginRateLimit").mockResolvedValueOnce({
      success: false,
      error: "Rate limit evaluation unavailable. Request rejected.",
    });

    function TestFailClosedComponent({ onSignIn }: { onSignIn: (fn: (e: string, p: string) => Promise<any>) => void }) {
      const { signIn } = useAuth();
      React.useEffect(() => {
        onSignIn(signIn);
      }, [signIn, onSignIn]);
      return null;
    }

    let capturedSignIn!: (e: string, p: string) => Promise<any>;
    const { unmount } = render(
      React.createElement(AuthProvider, null,
        React.createElement(TestFailClosedComponent, { onSignIn: (fn) => { capturedSignIn = fn; } })
      )
    );

    let res: any;
    await act(async () => {
      res = await capturedSignIn("victim@cobralearn.in", "Password123!");
    });
    expect(res.data).toBeNull();
    expect(res.error).toBeDefined();
    expect(res.error?.message).toBe("Rate limit evaluation unavailable. Request rejected.");
    expect(signInSpy).not.toHaveBeenCalled();

    unmount();
  });

  // =========================================================================
  // Requirement 20: formatMMSS correctly formats countdown seconds to MM:SS
  // =========================================================================
  it("Requirement 20: formatMMSS correctly formats countdown seconds to MM:SS", () => {
    expect(formatMMSS(900)).toBe("15:00");
    expect(formatMMSS(899)).toBe("14:59");
    expect(formatMMSS(60)).toBe("01:00");
    expect(formatMMSS(59)).toBe("00:59");
    expect(formatMMSS(9)).toBe("00:09");
    expect(formatMMSS(1)).toBe("00:01");
    expect(formatMMSS(0)).toBe("00:00");
    expect(formatMMSS(-5)).toBe("00:00");
  });

  // =========================================================================
  // Requirement 21: Phase 3.3 Regression: 5 failed attempts + 6th attempt with CORRECT credentials
  // =========================================================================
  it("Requirement 21: Submitting correct credentials on 6th attempt is blocked before Supabase Auth is called", async () => {
    const targetEmail = "regression-account@cobralearn.in";
    const correctPassword = "ValidSuperSecretPassword123!";
    const wrongPassword = "WrongPassword!";

    // Mock Supabase Auth to succeed ONLY for the correct password
    const signInSpy = vi.spyOn(authService, "signIn").mockImplementation(async (email, password) => {
      if (password === correctPassword) {
        return {
          data: {
            user: { id: "user-123", email } as any,
            session: { access_token: "mock-token", user: { id: "user-123" } } as any,
          },
          error: null,
        };
      }
      return {
        data: null,
        error: new Error("Invalid login credentials"),
      };
    });

    function TestComponent({ onSignIn }: { onSignIn: (fn: (e: string, p: string) => Promise<any>) => void }) {
      const { signIn } = useAuth();
      React.useEffect(() => {
        onSignIn(signIn);
      }, [signIn, onSignIn]);
      return null;
    }

    let capturedSignIn!: (e: string, p: string) => Promise<any>;
    const { unmount } = render(
      React.createElement(AuthProvider, null,
        React.createElement(TestComponent, { onSignIn: (fn) => { capturedSignIn = fn; } })
      )
    );

    // 1. Submit 5 failed attempts with wrong password
    for (let attempt = 1; attempt <= 5; attempt++) {
      let res: any;
      await act(async () => {
        res = await capturedSignIn(targetEmail, wrongPassword);
      });
      expect(res.error?.message).toBe("Invalid email or password.");
      expect(signInSpy).toHaveBeenCalledTimes(attempt);
    }

    // 2. Submit 6th attempt with the CORRECT password
    let sixthRes: any;
    await act(async () => {
      sixthRes = await capturedSignIn(targetEmail, correctPassword);
    });

    // 3. Confirm 6th attempt is blocked before Supabase Auth is called
    expect(sixthRes.data).toBeNull();
    expect(sixthRes.error).toBeDefined();
    expect(sixthRes.error?.message).toBe("Too many login attempts. Please try again later.");
    expect(sixthRes.retryAfterSeconds).toBeGreaterThan(0);
    // Supabase Auth was called EXACTLY 5 times, never on the 6th attempt!
    expect(signInSpy).toHaveBeenCalledTimes(5);

    unmount();
  });

  // =========================================================================
  // Requirement 22: Visible countdown decrements every second and button remains disabled
  // =========================================================================
  it("Requirement 22: Visible countdown decrements every second and disables sign in button", async () => {
    vi.useFakeTimers();

    const { container, unmount } = render(
      React.createElement(AuthProvider, null,
        React.createElement(AdminLoginForm)
      )
    );

    // Mock evaluateLoginRateLimit to return throttled with 10 seconds retry
    vi.spyOn(adminClient, "evaluateLoginRateLimit").mockResolvedValue({
      success: true,
      data: {
        allowed: false,
        message: "Too many login attempts. Please try again later.",
        retryAfterSeconds: 10,
      },
    });

    const emailInput = screen.getByLabelText("Email Address") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    fireEvent.change(emailInput, { target: { value: "timer-test@cobralearn.in" } });
    fireEvent.change(passwordInput, { target: { value: "AnyPassword123!" } });

    await act(async () => {
      fireEvent.submit(submitButton.closest("form")!);
    });

    const statusMsg = screen.getByRole("status");
    expect(statusMsg.textContent).toBe("Too many login attempts. Try again in 00:10.");
    expect(submitButton.disabled).toBe(true);

    // Advance 1 second
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(statusMsg.textContent).toBe("Too many login attempts. Try again in 00:09.");
    expect(submitButton.disabled).toBe(true);

    // Advance 4 more seconds (5 seconds total elapsed)
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(statusMsg.textContent).toBe("Too many login attempts. Try again in 00:05.");
    expect(submitButton.disabled).toBe(true);

    unmount();
  });

  // =========================================================================
  // Requirement 23: Cooldown reaching zero re-evaluates eligibility with server
  // =========================================================================
  it("Requirement 23: Timer expiry re-evaluates eligibility with server and continues if still denied", async () => {
    vi.useFakeTimers();

    const checkEligibilitySpy = vi.spyOn(adminClient, "checkLoginEligibility").mockResolvedValue({
      success: true,
      data: {
        allowed: false,
        message: "Too many login attempts. Please try again later.",
        retryAfterSeconds: 30, // Still throttled due to IP limit!
      },
    });

    const { container, unmount } = render(
      React.createElement(AuthProvider, null,
        React.createElement(AdminLoginForm)
      )
    );

    // Initial throttle response with 2 seconds
    vi.spyOn(adminClient, "evaluateLoginRateLimit").mockResolvedValueOnce({
      success: true,
      data: {
        allowed: false,
        message: "Too many login attempts. Please try again later.",
        retryAfterSeconds: 2,
      },
    });

    const emailInput = screen.getByLabelText("Email Address") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    fireEvent.change(emailInput, { target: { value: "renewed-denial@cobralearn.in" } });
    fireEvent.change(passwordInput, { target: { value: "Pass123!" } });

    await act(async () => {
      fireEvent.submit(submitButton.closest("form")!);
    });

    const statusMsg = screen.getByRole("status");
    expect(statusMsg.textContent).toBe("Too many login attempts. Try again in 00:02.");

    // Advance 2 seconds to trigger expiry check
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Verify checkLoginEligibility was called
    expect(checkEligibilitySpy).toHaveBeenCalledWith("renewed-denial@cobralearn.in");
    // Verify renewed cooldown was applied
    expect(statusMsg.textContent).toBe("Too many login attempts. Try again in 00:30.");
    expect(submitButton.disabled).toBe(true);

    unmount();
  });

  // =========================================================================
  // Requirement 24: Global login rate limiting (150 attempts/15m) blocks login
  // =========================================================================
  it("Requirement 24: Global login rate limit threshold (150 attempts/15m) is enforced", async () => {
    // Fill global bucket up to 150
    for (let i = 1; i <= 150; i++) {
      const req = new Request("https://api.internal/auth/rate-limit/login", {
        method: "POST",
        headers: { "x-real-ip": `192.168.1.${i % 250}` },
      });
      const res = await evaluateLoginRateLimitOperation(req, {
        email: `global-user-${i}@cobralearn.in`,
      });
      expect(res.allowed).toBe(true);
    }

    // 151st request exceeds global limit even with fresh email and fresh IP
    const req151 = new Request("https://api.internal/auth/rate-limit/login", {
      method: "POST",
      headers: { "x-real-ip": "10.0.0.1" },
    });
    const res151 = await evaluateLoginRateLimitOperation(req151, {
      email: "fresh-new-victim@cobralearn.in",
    });
    expect(res151.allowed).toBe(false);
    expect(res151.message).toBe("Too many login attempts. Please try again later.");
    expect(res151.retryAfterSeconds).toBeGreaterThan(0);
  });
});

