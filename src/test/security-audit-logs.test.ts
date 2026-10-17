import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  emergencyMfaResetOperation,
  completeMfaReenrollmentOperation,
  reconcileMfaRecoveryOperation,
  updateSiteSettingsOperation,
  updateAppearanceConfigOperation,
} from "@/lib/server/admin-operations";
import {
  verifyAndRedeemRecoveryCodeOperation,
  redeemRecoveryCodeOperation,
  generateRecoveryCodesOperation,
} from "@/lib/server/recovery-code-operations";
import { humanizeAction } from "@/lib/server/dashboard-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PrismaClient, AdminProfile, AdminRole } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import { hashRecoveryCode, generateSaltHex } from "@/lib/server/recovery-code-crypto";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Phase 6.5 — Security Audit Logs Test Suite", () => {
  const superAdminUuid = "11111111-1111-4111-8111-111111111111";
  const regularAdminUuid = "22222222-2222-4222-8222-222222222222";
  const targetAdminUuid = "33333333-3333-4333-8333-333333333333";

  const superAdminUser: User = {
    id: superAdminUuid,
    email: "super@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const targetAdminUser: User = {
    id: targetAdminUuid,
    email: "target@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  let mockProfilesDb: Record<string, AdminProfile>;
  let auditLogsCreated: any[];
  let mockPrisma: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    auditLogsCreated = [];

    mockProfilesDb = {
      [superAdminUuid]: {
        id: superAdminUuid,
        email: "super@cobralearn.com",
        fullName: "Chief Super Admin",
        designation: "CTO",
        role: "SUPER_ADMIN" as AdminRole,
        isActive: true,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
        phone: "+91 99999 00001",
        bio: "Root Admin",
        avatarUrl: null,
        preferences: {},
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [regularAdminUuid]: {
        id: regularAdminUuid,
        email: "admin@cobralearn.com",
        fullName: "Regular Operations Admin",
        designation: "Ops",
        role: "ADMIN" as AdminRole,
        isActive: true,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
        phone: "+91 99999 00002",
        bio: "Operations",
        avatarUrl: null,
        preferences: {},
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [targetAdminUuid]: {
        id: targetAdminUuid,
        email: "target@cobralearn.com",
        fullName: "Target Admin",
        designation: "Editor",
        role: "ADMIN" as AdminRole,
        isActive: true,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
        phone: "+91 99999 00003",
        bio: "Target for recovery",
        avatarUrl: null,
        preferences: {},
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const prismaMockHandler: any = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          const profile = mockProfilesDb[where.id] || Object.values(mockProfilesDb).find((p) => p.email === where.email);
          return Promise.resolve(profile ? { ...profile } : null);
        }),
        findMany: vi.fn().mockImplementation(({ where }: any) => {
          let list = Object.values(mockProfilesDb);
          if (where?.role) list = list.filter((p) => p.role === where.role);
          if (where?.isActive !== undefined) list = list.filter((p) => p.isActive === where.isActive);
          return Promise.resolve(list.map((p) => ({ ...p })));
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          if (!mockProfilesDb[where.id]) throw new Error("Record not found");
          mockProfilesDb[where.id] = { ...mockProfilesDb[where.id], ...data };
          return Promise.resolve({ ...mockProfilesDb[where.id] });
        }),
        updateMany: vi.fn().mockImplementation(({ where, data }: any) => {
          let count = 0;
          for (const id of Object.keys(mockProfilesDb)) {
            const p = mockProfilesDb[id];
            if (where.id && p.id !== where.id) continue;
            if (where.mfaRecoveryPending !== undefined && p.mfaRecoveryPending !== where.mfaRecoveryPending) continue;
            if (where.isActive !== undefined && p.isActive !== where.isActive) continue;
            mockProfilesDb[id] = { ...p, ...data };
            count++;
          }
          return Promise.resolve({ count });
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          const log = { id: `log-${Date.now()}-${Math.random()}`, ...data, createdAt: new Date() };
          auditLogsCreated.push(log);
          return Promise.resolve(log);
        }),
      },
      adminMfaRecovery: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          return Promise.resolve({ id: "rec-test-uuid", ...data });
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({ id: "rec-test-uuid" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      siteSettings: {
        upsert: vi.fn().mockImplementation(({ create, update }: any) => {
          return Promise.resolve({ id: "default", ...create, ...update, updatedAt: new Date() });
        }),
      },
      appearanceConfig: {
        upsert: vi.fn().mockImplementation(({ create, update }: any) => {
          return Promise.resolve({ id: "default", ...create, ...update, updatedAt: new Date() });
        }),
      },
      adminNotification: {
        create: vi.fn().mockResolvedValue({ id: "notif-1" }),
      },
      adminRecoveryCode: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 8 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      rateLimitCounter: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ key: "test", count: 1, resetAt: new Date(Date.now() + 60000) }),
        create: vi.fn().mockResolvedValue({ key: "test", count: 1, resetAt: new Date(Date.now() + 60000) }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    mockPrisma = {
      ...prismaMockHandler,
      $transaction: vi.fn(async (cb: any) => {
        if (typeof cb === "function") {
          return cb(prismaMockHandler);
        }
        return Promise.all(cb);
      }),
    };
  });

  function setupAuth(user: User, assuranceLevel: "aal1" | "aal2" = "aal2") {
    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : { message: "User not found" },
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: user ? { user, access_token: `token-${user.id}` } : null },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: {
              currentLevel: assuranceLevel,
              nextLevel: assuranceLevel,
              currentAuthenticationMethods: assuranceLevel === "aal2" ? [{ method: "totp" }] : [],
            },
            error: null,
          }),
        },
      },
    });

    return new Request("https://portal.cobralearn.com/api/test", {
      headers: {
        authorization: `Bearer token-${user.id}`,
        "x-forwarded-for": "198.51.100.42",
      },
    });
  }

  // =========================================================================
  // 1. Masked IP Attribution for Emergency MFA Lifecycle Events
  // =========================================================================
  describe("1. Masked IP Attribution for Emergency MFA Lifecycle Events", () => {
    it("attaches masked IP address to MFA_RECOVERY_REQUESTED and MFA_RECOVERY_FACTOR_DELETED", async () => {
      const req = setupAuth(superAdminUser, "aal2");

      const mockSupabaseAdmin = {
        auth: {
          admin: {
            mfa: {
              listFactors: vi.fn().mockResolvedValue({
                data: {
                  factors: [
                    {
                      id: "factor-123",
                      factor_type: "totp",
                      status: "verified",
                      created_at: new Date(Date.now() - 60000).toISOString(),
                    },
                  ],
                },
                error: null,
              }),
              deleteFactor: vi.fn().mockResolvedValue({
                data: { id: "factor-123" },
                error: null,
              }),
            },
          },
        },
      };

      const result = await emergencyMfaResetOperation(
        req,
        {
          targetId: targetAdminUuid,
          expectedEmail: "target@cobralearn.com",
          justification: "Lost hardware authenticator during overseas travel.",
        },
        mockPrisma,
        mockSupabaseAdmin
      );

      expect(result.status).toBe("FACTOR_DELETED");

      // Verify MFA_RECOVERY_REQUESTED has masked IP
      const reqLog = auditLogsCreated.find((l) => l.action === "MFA_RECOVERY_REQUESTED");
      expect(reqLog).toBeDefined();
      expect(reqLog.ipAddress).toBe("198.51.100.***");
      expect(reqLog.actorId).toBe(superAdminUuid);

      // Verify MFA_RECOVERY_FACTOR_DELETED has masked IP
      const delLog = auditLogsCreated.find((l) => l.action === "MFA_RECOVERY_FACTOR_DELETED");
      expect(delLog).toBeDefined();
      expect(delLog.ipAddress).toBe("198.51.100.***");
      expect(delLog.actorId).toBe(superAdminUuid);
    });

    it("attaches masked IP address to MFA_RECOVERY_COMPLETED", async () => {
      mockProfilesDb[targetAdminUuid].mfaRecoveryPending = true;
      mockProfilesDb[targetAdminUuid].mfaRecoveryAt = new Date(Date.now() - 10000);

      mockPrisma.adminMfaRecovery.findFirst.mockResolvedValue({
        id: "rec-active-123",
        targetId: targetAdminUuid,
        status: "FACTOR_DELETED",
        factorId: "old-factor-deleted",
        initiatedAt: new Date(Date.now() - 10000),
      });

      const req = setupAuth(targetAdminUser, "aal1");

      const mockSupabaseAdmin = {
        auth: {
          admin: {
            mfa: {
              listFactors: vi.fn().mockResolvedValue({
                data: {
                  factors: [
                    {
                      id: "new-factor-456",
                      factor_type: "totp",
                      status: "verified",
                      created_at: new Date().toISOString(),
                    },
                  ],
                },
                error: null,
              }),
            },
          },
        },
      };

      const result = await completeMfaReenrollmentOperation(req, mockPrisma, mockSupabaseAdmin);
      expect(result.success).toBe(true);

      const completeLog = auditLogsCreated.find((l) => l.action === "MFA_RECOVERY_COMPLETED");
      expect(completeLog).toBeDefined();
      expect(completeLog.ipAddress).toBe("198.51.100.***");
      expect(completeLog.actorId).toBe(targetAdminUuid);
    });

    it("attaches masked IP address to MFA_RECOVERY_RECONCILED", async () => {
      mockPrisma.adminMfaRecovery.findUnique.mockResolvedValue({
        id: "rec-reconcile-123",
        targetId: targetAdminUuid,
        targetEmail: "target@cobralearn.com",
        status: "RECONCILIATION_REQUIRED",
        factorId: "factor-test-123",
        initiatedAt: new Date(Date.now() - 60000),
      });

      const req = setupAuth(superAdminUser, "aal2");

      const mockSupabaseAdmin = {
        auth: {
          admin: {
            mfa: {
              listFactors: vi.fn().mockResolvedValue({
                data: { factors: [] }, // Confirmed deleted from Supabase
                error: null,
              }),
            },
          },
        },
      };

      const result = await reconcileMfaRecoveryOperation(
        req,
        {
          recoveryId: "rec-reconcile-123",
          notes: "Confirmed factor absent in identity provider.",
        },
        mockPrisma,
        mockSupabaseAdmin
      );

      expect(result.status).toBe("FACTOR_DELETED");

      const reconcileLog = auditLogsCreated.find((l) => l.action === "MFA_RECOVERY_RECONCILED");
      expect(reconcileLog).toBeDefined();
      expect(reconcileLog.ipAddress).toBe("198.51.100.***");
      expect(reconcileLog.actorId).toBe(superAdminUuid);
    });
  });

  // =========================================================================
  // 2. Masked IP Attribution for Settings and Appearance Updates
  // =========================================================================
  describe("2. Masked IP Attribution for Settings and Appearance Changes", () => {
    it("records masked IP on SETTINGS_UPDATED", async () => {
      const req = setupAuth(superAdminUser, "aal2");

      await updateSiteSettingsOperation(
        req,
        {
          settings: {
            siteName: "CobraLearn Orbit Portal Secure",
          },
        },
        mockPrisma
      );

      const log = auditLogsCreated.find((l) => l.action === "SETTINGS_UPDATED");
      expect(log).toBeDefined();
      expect(log.ipAddress).toBe("198.51.100.***");
      expect(log.actorId).toBe(superAdminUuid);
    });

    it("records masked IP on APPEARANCE_UPDATED", async () => {
      const req = setupAuth(superAdminUser, "aal2");

      await updateAppearanceConfigOperation(
        req,
        {
          appearance: {
            themePreset: "dark",
          },
        },
        mockPrisma
      );

      const log = auditLogsCreated.find((l) => l.action === "APPEARANCE_UPDATED");
      expect(log).toBeDefined();
      expect(log.ipAddress).toBe("198.51.100.***");
      expect(log.actorId).toBe(superAdminUuid);
    });
  });

  // =========================================================================
  // 3 & 5. Failed Recovery Code Redemption Emits Safe Audit Log
  // =========================================================================
  describe("3 & 5. Invalid Recovery-Code Redemption & Zero Secret Leakage", () => {
    it("emits auth:recovery_code_redeem_failed with masked IP, actorId, and zero secrets", async () => {
      const salt = generateSaltHex();
      const storedHash = await hashRecoveryCode("1111-2222-3333", salt);

      mockPrisma.adminRecoveryCode.findMany.mockResolvedValue([
        { id: "code-rec-1", codeHash: storedHash, codeSalt: salt, isUsed: false },
      ]);

      const req = new Request("https://portal.cobralearn.com/api/recovery/redeem", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.195",
        },
      });

      const submittedWrongCode = "9999-8888-7777";
      const result = await verifyAndRedeemRecoveryCodeOperation(
        req,
        { adminId: targetAdminUuid, code: submittedWrongCode },
        mockPrisma
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid or already redeemed");

      // Verify audit log emitted
      const failLog = auditLogsCreated.find((l) => l.action === "auth:recovery_code_redeem_failed");
      expect(failLog).toBeDefined();
      expect(failLog.actorId).toBe(targetAdminUuid);
      expect(failLog.actorEmail).toBe("target@cobralearn.com");
      expect(failLog.ipAddress).toBe("203.0.113.***");
      expect(failLog.metadata).toEqual({ reason: "invalid_code" });

      // Requirement 5: Zero secret leakage - must not contain the submitted code, hash, or salt
      const serialized = JSON.stringify(failLog);
      expect(serialized).not.toContain(submittedWrongCode);
      expect(serialized).not.toContain(storedHash);
      expect(serialized).not.toContain(salt);
    });

    it("redeemRecoveryCodeOperation alias behaves identically", async () => {
      expect(redeemRecoveryCodeOperation).toBe(verifyAndRedeemRecoveryCodeOperation);
    });
  });

  // =========================================================================
  // 4. Rate-Limited Recovery Code Redemption Emits Safe Throttling Event
  // =========================================================================
  describe("4. Rate-Limited Recovery-Code Redemption", () => {
    it("emits auth:recovery_code_throttled with masked IP and truncated hash", async () => {
      // Mock $queryRawUnsafe to return high count exceeding the rate limit threshold
      mockPrisma.$queryRawUnsafe = vi.fn().mockResolvedValue([
        { count: 99, reset_at: new Date(Date.now() + 60000) },
      ]);

      const req = new Request("https://portal.cobralearn.com/api/recovery/redeem", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.0.2.77",
        },
      });

      const submittedCode = "AAAA-BBBB-CCCC";
      const result = await verifyAndRedeemRecoveryCodeOperation(
        req,
        { adminId: targetAdminUuid, code: submittedCode },
        mockPrisma
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Too many");

      const throttleLog = auditLogsCreated.find((l) => l.action === "auth:recovery_code_throttled");
      expect(throttleLog).toBeDefined();
      expect(throttleLog.actorEmail).toBe("security-gate@cobralearn.internal");
      expect(throttleLog.ipAddress).toBe("192.0.2.***");
      expect(throttleLog.metadata.reason).toBe("rate_limit_exceeded");
      expect(throttleLog.metadata.retryAfterSeconds).toBeGreaterThan(0);

      // Must NOT contain submitted code
      expect(JSON.stringify(throttleLog)).not.toContain(submittedCode);
    });
  });

  // =========================================================================
  // 6. Ambiguous Provider Errors Use Controlled Reason Codes
  // =========================================================================
  describe("6. Ambiguous Provider Errors Use Controlled Reason Codes", () => {
    it("records provider_deletion_ambiguous without stringifying raw error objects", async () => {
      const req = setupAuth(superAdminUser, "aal2");

      const mockSupabaseAdmin = {
        auth: {
          admin: {
            mfa: {
              listFactors: vi.fn()
                .mockResolvedValueOnce({
                  data: {
                    factors: [
                      {
                        id: "factor-ambiguous-999",
                        factor_type: "totp",
                        status: "verified",
                        created_at: new Date(Date.now() - 60000).toISOString(),
                      },
                    ],
                  },
                  error: null,
                })
                .mockRejectedValueOnce(new Error("504 Gateway Timeout on recheck")),
              // Ambiguous deletion: throws a network/gateway timeout error
              deleteFactor: vi.fn().mockRejectedValue(new Error("504 Gateway Timeout: https://supabase.internal/auth/v1/factors/factor-ambiguous-999?secret_key=xyz")),
            },
          },
        },
      };

      const result = await emergencyMfaResetOperation(
        req,
        {
          targetId: targetAdminUuid,
          expectedEmail: "target@cobralearn.com",
          justification: "Testing ambiguous deletion error sanitization.",
        },
        mockPrisma,
        mockSupabaseAdmin
      );

      expect(result.status).toBe("RECONCILIATION_REQUIRED");

      const ambLog = auditLogsCreated.find((l) => l.action === "MFA_RECOVERY_RECONCILIATION_REQUIRED");
      expect(ambLog).toBeDefined();
      expect(ambLog.metadata.reason).toBe("provider_deletion_ambiguous");
      expect(ambLog.ipAddress).toBe("198.51.100.***");

      // Verify raw URL or secret does not leak into audit metadata
      const serialized = JSON.stringify(ambLog);
      expect(serialized).not.toContain("504 Gateway Timeout");
      expect(serialized).not.toContain("secret_key");
      expect(serialized).not.toContain("https://");
    });
  });

  // =========================================================================
  // 7. Dashboard Humanization for auth:* Events
  // =========================================================================
  describe("7. Dashboard Humanization for auth:* Events", () => {
    it("correctly maps all Phase 6.5 namespaced events to readable human labels", () => {
      expect(humanizeAction("auth:password_changed")).toBe("Password Changed");
      expect(humanizeAction("auth:password_reset_requested")).toBe("Password Reset Requested");
      expect(humanizeAction("auth:password_reset_completed")).toBe("Password Reset Completed");
      expect(humanizeAction("auth:password_reset_completion_failed")).toBe("Password Reset Completion Failed");
      expect(humanizeAction("auth:recovery_codes_generated")).toBe("Recovery Codes Generated");
      expect(humanizeAction("auth:recovery_code_redeemed")).toBe("Recovery Code Redeemed");
      expect(humanizeAction("auth:recovery_code_redeem_failed")).toBe("Recovery Code Redemption Failed");
      expect(humanizeAction("auth:recovery_code_throttled")).toBe("Recovery Code Throttled");
      expect(humanizeAction("auth:login_throttled")).toBe("Login Throttled");
      expect(humanizeAction("auth:recovery_throttled")).toBe("Recovery Throttled");
    });

    it("preserves fallback humanization for unmapped actions", () => {
      expect(humanizeAction("PROJECT_CREATE")).toBe("Project Created");
      expect(humanizeAction("UNKNOWN_CUSTOM_ACTION")).toBe("Unknown Custom Action");
    });
  });

  // =========================================================================
  // 8 & 9. Actor Identity is Server-Derived & Metadata Excludes Sensitive Data
  // =========================================================================
  describe("8 & 9. Server-Derived Actor Identity and Zero Sensitive Data in Metadata", () => {
    it("ignores spoofed client headers (x-actor-id, x-actor-email) during settings updates", async () => {
      const req = new Request("https://portal.cobralearn.com/api/settings", {
        headers: {
          authorization: `Bearer token-${superAdminUuid}`,
          "x-actor-id": "spoofed-hacker-id",
          "x-actor-email": "hacker@evil.corp",
          "x-forwarded-for": "198.51.100.99",
        },
      });

      setupAuth(superAdminUser, "aal2");

      await updateSiteSettingsOperation(
        req,
        { settings: { siteName: "Legitimate Update" } },
        mockPrisma
      );

      const log = auditLogsCreated.find((l) => l.action === "SETTINGS_UPDATED");
      expect(log.actorId).toBe(superAdminUuid); // Must be verified server UUID
      expect(log.actorEmail).toBe("super@cobralearn.com");
      expect(log.ipAddress).toBe("198.51.100.***");
    });

    it("verifies recovery code generation metadata contains only code count, zero plaintext codes or hashes", async () => {
      setupAuth(superAdminUser, "aal2");

      const req = new Request("https://portal.cobralearn.com/api/recovery/generate", {
        method: "POST",
        headers: {
          authorization: `Bearer token-${superAdminUuid}`,
          "x-forwarded-for": "198.51.100.88",
        },
      });

      let insertedRecords: any[] = [];
      const mockTx = {
        adminRecoveryCode: {
          deleteMany: vi.fn().mockResolvedValue({ count: 8 }),
          createMany: vi.fn().mockImplementation(async ({ data }: any) => {
            insertedRecords = data;
            return { count: data.length };
          }),
        },
      };

      const mockPrismaWithTx = {
        ...mockPrisma,
        $transaction: vi.fn(async (cb: any) => cb(mockTx)),
      };

      const result = await generateRecoveryCodesOperation(req, mockPrismaWithTx);
      expect(result.success).toBe(true);
      expect(result.codes).toHaveLength(8);

      const genLog = auditLogsCreated.find((l) => l.action === "auth:recovery_codes_generated");
      expect(genLog).toBeDefined();
      expect(genLog.metadata).toEqual({ count: 8 });
      expect(genLog.ipAddress).toBe("198.51.100.***");

      // Verify metadata does NOT contain any generated codes
      for (const code of result.codes!) {
        expect(JSON.stringify(genLog.metadata)).not.toContain(code);
      }
    });
  });

  // =========================================================================
  // 10. Existing Security Invariants Remain Compatible
  // =========================================================================
  describe("10. Backward and Cross-Phase Compatibility", () => {
    it("ensures AAL2 requirement remains enforced on sensitive operations", async () => {
      // Setup aal1 instead of aal2
      const req = setupAuth(superAdminUser, "aal1");

      await expect(
        updateSiteSettingsOperation(req, { settings: { siteName: "Hack" } }, mockPrisma)
      ).rejects.toThrow("Forbidden: AAL2_REQUIRED");

      await expect(
        updateAppearanceConfigOperation(req, { appearance: { themePreset: "light" } }, mockPrisma)
      ).rejects.toThrow("Forbidden: AAL2_REQUIRED");
    });
  });
});
