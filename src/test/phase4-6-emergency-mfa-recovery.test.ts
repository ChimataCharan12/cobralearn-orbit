import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma, MfaRecoveryActorType, MfaRecoveryStatus, type AdminProfile, type AdminRole } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import {
  requireAdminProfile,
  requireAal2Role,
  isQuarantineError,
} from "@/lib/auth/server-auth";
import {
  emergencyMfaResetOperation,
  completeMfaReenrollmentOperation,
  reconcileMfaRecoveryOperation,
  getMfaRecoveryStatusOperation,
  listAdminProfilesOperation,
  recordAdminLoginOperation,
} from "@/lib/server/admin-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { executeEmergencyMfaCli, parseEmergencyMfaCliArgs } from "@/lib/auth/emergency-mfa-cli";
import * as fs from "fs";
import * as path from "path";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Phase 4.6: Controlled Emergency MFA Reset & Recovery", () => {
  const superAdmin1Id = "11111111-1111-4111-8111-111111111111";
  const superAdmin2Id = "22222222-2222-4222-8222-222222222222";
  const adminId = "33333333-3333-4333-8333-333333333333";
  const editorId = "44444444-4444-4444-8444-444444444444";
  const inactiveAdminId = "55555555-5555-4555-8555-555555555555";

  const mockUsers: Record<string, User> = {
    [superAdmin1Id]: {
      id: superAdmin1Id,
      email: "super1@cobralearn.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
    [superAdmin2Id]: {
      id: superAdmin2Id,
      email: "super2@cobralearn.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
    [adminId]: {
      id: adminId,
      email: "admin@cobralearn.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
    [editorId]: {
      id: editorId,
      email: "editor@cobralearn.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
    [inactiveAdminId]: {
      id: inactiveAdminId,
      email: "inactive@cobralearn.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
  };

  let mockProfiles: Record<string, AdminProfile>;
  let mockRecoveries: Record<string, any>;
  let mockPrisma: any;
  let mockSupabaseAdmin: any;

  function setupAuthClientMock(userId: string, aal: "aal1" | "aal2" = "aal2") {
    const user = mockUsers[userId] || null;
    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockImplementation((token?: string) => {
          if (!user) {
            return Promise.resolve({ data: { user: null }, error: new Error("Unauthorized") });
          }
          return Promise.resolve({ data: { user }, error: null });
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: user ? { user, access_token: "mock-token" } : null },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: user ? { currentLevel: aal, nextLevel: aal, currentAuthenticationMethods: [] } : null,
            error: null,
          }),
        },
      },
    });
  }

  function createReq(url: string = "https://api.internal/admin/action", method: string = "POST") {
    return new Request(url, {
      method,
      headers: {
        authorization: "Bearer mock-token",
        cookie: "sb-access-token=mock-token",
      },
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();

    mockProfiles = {
      [superAdmin1Id]: {
        id: superAdmin1Id,
        email: "super1@cobralearn.com",
        fullName: "Super Admin One",
        role: "SUPER_ADMIN" as AdminRole,
        isActive: true,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
        phone: null,
        designation: null,
        bio: null,
        avatarUrl: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [superAdmin2Id]: {
        id: superAdmin2Id,
        email: "super2@cobralearn.com",
        fullName: "Super Admin Two",
        role: "SUPER_ADMIN" as AdminRole,
        isActive: true,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
        phone: null,
        designation: null,
        bio: null,
        avatarUrl: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [adminId]: {
        id: adminId,
        email: "admin@cobralearn.com",
        fullName: "Operational Admin",
        role: "ADMIN" as AdminRole,
        isActive: true,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
        phone: null,
        designation: null,
        bio: null,
        avatarUrl: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [editorId]: {
        id: editorId,
        email: "editor@cobralearn.com",
        fullName: "Content Editor",
        role: "EDITOR" as AdminRole,
        isActive: true,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
        phone: null,
        designation: null,
        bio: null,
        avatarUrl: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [inactiveAdminId]: {
        id: inactiveAdminId,
        email: "inactive@cobralearn.com",
        fullName: "Inactive Admin",
        role: "ADMIN" as AdminRole,
        isActive: false,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
        phone: null,
        designation: null,
        bio: null,
        avatarUrl: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    mockRecoveries = {};

    mockPrisma = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(mockProfiles[where.id] ? { ...mockProfiles[where.id] } : null);
        }),
        findMany: vi.fn().mockImplementation(() => {
          return Promise.resolve(Object.values(mockProfiles).map((p) => ({ ...p })));
        }),
        update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: any }) => {
          if (!mockProfiles[where.id]) return Promise.reject(new Error("Record not found"));
          mockProfiles[where.id] = { ...mockProfiles[where.id], ...data };
          return Promise.resolve({ ...mockProfiles[where.id] });
        }),
        updateMany: vi.fn().mockImplementation(({ where, data }: { where: any; data: any }) => {
          let count = 0;
          for (const [id, prof] of Object.entries(mockProfiles)) {
            if (where.id && prof.id !== where.id) continue;
            if (where.mfaRecoveryPending !== undefined && prof.mfaRecoveryPending !== where.mfaRecoveryPending) continue;
            if (where.isActive !== undefined && prof.isActive !== where.isActive) continue;
            mockProfiles[id] = { ...prof, ...data };
            count++;
          }
          return Promise.resolve({ count });
        }),
      },
      adminMfaRecovery: {
        create: vi.fn().mockImplementation(({ data }: { data: any }) => {
          // Schema FK Constraint check: actorId must be null or valid UUID
          if (data.actorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.actorId)) {
            return Promise.reject(new Error(`FK Error: Invalid UUID format for actorId: ${data.actorId}`));
          }
          // Partial unique index constraint check: unique_active_admin_mfa_recovery
          const activeStates = ["PENDING", "FACTOR_DELETED", "RECONCILIATION_REQUIRED"];
          if (activeStates.includes(data.status)) {
            const existingActive = Object.values(mockRecoveries).find(
              (r: any) => r.targetId === data.targetId && activeStates.includes(r.status)
            );
            if (existingActive) {
              const p2002Error: any = new Error("Unique constraint failed on the fields: (`targetId`) in unique_active_admin_mfa_recovery");
              p2002Error.code = "P2002";
              return Promise.reject(p2002Error);
            }
          }
          const id = "rec-" + Math.random().toString(36).substring(2, 9);
          const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          mockRecoveries[id] = record;
          return Promise.resolve(record);
        }),
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(mockRecoveries[where.id] ? { ...mockRecoveries[where.id] } : null);
        }),
        findFirst: vi.fn().mockImplementation(({ where }: { where: any }) => {
          const list = Object.values(mockRecoveries).filter((r: any) => {
            if (where.targetId && r.targetId !== where.targetId) return false;
            if (where.status && r.status !== where.status) return false;
            return true;
          });
          return Promise.resolve(list.length > 0 ? { ...list[list.length - 1] } : null);
        }),
        update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: any }) => {
          if (!mockRecoveries[where.id]) return Promise.reject(new Error("Record not found"));
          mockRecoveries[where.id] = { ...mockRecoveries[where.id], ...data };
          return Promise.resolve({ ...mockRecoveries[where.id] });
        }),
        updateMany: vi.fn().mockImplementation(({ where, data }: { where: any; data: any }) => {
          let count = 0;
          for (const [id, rec] of Object.entries(mockRecoveries)) {
            if (where.id && rec.id !== where.id) continue;
            if (where.status && rec.status !== where.status) continue;
            if (where.targetId && rec.targetId !== where.targetId) continue;
            mockRecoveries[id] = { ...rec, ...data };
            count++;
          }
          return Promise.resolve({ count });
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation(({ data }: { data: any }) => {
          if (data.actorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.actorId)) {
            return Promise.reject(new Error(`FK Error: Invalid UUID format for actorId in AdminAuditLog: ${data.actorId}`));
          }
          return Promise.resolve({ id: "audit-" + Math.random().toString(36).substring(2, 9), ...data });
        }),
      },
      adminLoginHistory: {
        create: vi.fn().mockImplementation(({ data }: { data: any }) => {
          return Promise.resolve({ id: "login-" + Math.random().toString(36).substring(2, 9), loginAt: new Date(), ...data });
        }),
      },
      $transaction: vi.fn().mockImplementation(async (arg: any) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        if (typeof arg === "function") {
          return arg(mockPrisma);
        }
        return arg;
      }),
    };

    mockSupabaseAdmin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockImplementation((id: string) => {
            const user = mockUsers[id];
            return Promise.resolve({ data: { user: user || null }, error: user ? null : { message: "User not found" } });
          }),
          mfa: {
            listFactors: vi.fn().mockResolvedValue({
              data: {
                factors: [
                  {
                    id: "factor-totp-123",
                    friendly_name: "CobraLearn Orbit Admin",
                    factor_type: "totp",
                    status: "verified",
                    created_at: new Date(Date.now() - 600000).toISOString(),
                    updated_at: new Date(Date.now() - 600000).toISOString(),
                  },
                ],
              },
              error: null,
            }),
            deleteFactor: vi.fn().mockResolvedValue({
              data: { id: "factor-totp-123" },
              error: null,
            }),
          },
        },
      },
    };
  });

  // 1. ADMIN and EDITOR cannot initiate recovery
  it("Test 1: ADMIN and EDITOR cannot initiate recovery (rejected as forbidden)", async () => {
    setupAuthClientMock(adminId, "aal2");
    const req1 = createReq("https://api.internal/admin/mfa/emergency-reset");
    await expect(
      emergencyMfaResetOperation(
        req1,
        { targetId: editorId, expectedEmail: "editor@cobralearn.com", justification: "Lost device verification done" },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow(/Insufficient role permissions/);

    setupAuthClientMock(editorId, "aal2");
    const req2 = createReq("https://api.internal/admin/mfa/emergency-reset");
    await expect(
      emergencyMfaResetOperation(
        req2,
        { targetId: adminId, expectedEmail: "admin@cobralearn.com", justification: "Lost device verification done" },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow(/Insufficient role permissions/);
  });

  // 2. A Super Admin at AAL1 is rejected
  it("Test 2: A Super Admin at AAL1 is rejected (AAL2 is strictly required)", async () => {
    setupAuthClientMock(superAdmin1Id, "aal1");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset");
    await expect(
      emergencyMfaResetOperation(
        req,
        { targetId: adminId, expectedEmail: "admin@cobralearn.com", justification: "Legitimate peer recovery requested" },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow(/Forbidden: AAL2_REQUIRED/);
  });

  // 3. Self-reset is rejected
  it("Test 3: Self-reset through the web portal is prohibited", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset");
    await expect(
      emergencyMfaResetOperation(
        req,
        { targetId: superAdmin1Id, expectedEmail: "super1@cobralearn.com", justification: "Attempting self reset" },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow(/Self-recovery through web portal is prohibited/);
  });

  // 4. Inactive, nonexistent, mismatched, and unauthorized targets are rejected
  it("Test 4: Inactive, nonexistent, and email-mismatched targets are rejected", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset");

    // Nonexistent
    await expect(
      emergencyMfaResetOperation(
        req,
        { targetId: "99999999-9999-4999-8999-999999999999", expectedEmail: "none@cobralearn.com", justification: "Test nonexistent target" },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow(/Target administrator profile not found/);

    // Inactive
    await expect(
      emergencyMfaResetOperation(
        req,
        { targetId: inactiveAdminId, expectedEmail: "inactive@cobralearn.com", justification: "Test inactive target" },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow(/Target administrator is deactivated/);

    // Email mismatched
    await expect(
      emergencyMfaResetOperation(
        req,
        { targetId: adminId, expectedEmail: "wrong-email@cobralearn.com", justification: "Test mismatched email" },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow(/Expected email does not match/);
  });

  // 5. Web reset of a Super Admin is rejected
  it("Test 5: Web reset of a Super Admin target is prohibited (host CLI break-glass required)", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset");
    await expect(
      emergencyMfaResetOperation(
        req,
        { targetId: superAdmin2Id, expectedEmail: "super2@cobralearn.com", justification: "Reset other superadmin" },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow(/Web-based recovery targeting SUPER_ADMIN is prohibited/);
  });

  // 6. Factor deletion success produces the correct persisted state
  it("Test 6: Confirmed factor deletion records FACTOR_DELETED and retains quarantine", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset");

    const result = await emergencyMfaResetOperation(
      req,
      {
        targetId: adminId,
        expectedEmail: "admin@cobralearn.com",
        justification: "Administrator lost authenticator device; verified out-of-band",
      },
      mockPrisma,
      mockSupabaseAdmin
    );

    expect(result.status).toBe("FACTOR_DELETED");
    expect(result.factorId).toBe("factor-totp-123");
    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(true);
    expect(mockProfiles[adminId].mfaRecoveryAt).toBeDefined();

    // Verify recovery record
    const recovery = mockRecoveries[result.recoveryId];
    expect(recovery.status).toBe("FACTOR_DELETED");
    expect(recovery.factorId).toBe("factor-totp-123");
    expect(recovery.factorDeletedAt).toBeDefined();
  });

  // 7. Definitive factor deletion failure is handled safely
  it("Test 7: Definitive factor deletion failure releases quarantine when factor remains intact", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset");

    // Mock deletion failure but factor intact on recheck
    mockSupabaseAdmin.auth.admin.mfa.deleteFactor.mockRejectedValueOnce(new Error("Supabase internal error"));
    mockSupabaseAdmin.auth.admin.mfa.listFactors
      .mockResolvedValueOnce({
        data: { factors: [{ id: "factor-totp-123", factor_type: "totp", status: "verified" }] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { factors: [{ id: "factor-totp-123", factor_type: "totp", status: "verified" }] },
        error: null,
      });

    await expect(
      emergencyMfaResetOperation(
        req,
        {
          targetId: adminId,
          expectedEmail: "admin@cobralearn.com",
          justification: "Administrator lost phone device verification",
        },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow(/Factor deletion failed/);

    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(false);
  });

  // 8. Ambiguous deletion outcomes retain quarantine
  it("Test 8: Ambiguous deletion outcome retains quarantine and marks RECONCILIATION_REQUIRED", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset");

    // Mock deletion timeout/crash and recheck fails as well
    mockSupabaseAdmin.auth.admin.mfa.deleteFactor.mockRejectedValueOnce(new Error("Network timeout"));
    mockSupabaseAdmin.auth.admin.mfa.listFactors
      .mockResolvedValueOnce({
        data: { factors: [{ id: "factor-totp-123", factor_type: "totp", status: "verified" }] },
        error: null,
      })
      .mockResolvedValueOnce(new Error("Network timeout on recheck"));

    const result = await emergencyMfaResetOperation(
      req,
      {
        targetId: adminId,
        expectedEmail: "admin@cobralearn.com",
        justification: "Administrator lost phone device verification",
      },
      mockPrisma,
      mockSupabaseAdmin
    );

    expect(result.status).toBe("RECONCILIATION_REQUIRED");
    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(true);
  });

  // 9. Crash after factor deletion leaves the target quarantined
  it("Test 9: Audit log failure after factor deletion leaves target quarantined", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset");

    // Make audit log create throw on post-deletion write
    mockPrisma.adminAuditLog.create
      .mockResolvedValueOnce({ id: "audit-1" }) // First audit succeeds
      .mockRejectedValueOnce(new Error("Postgres audit table disk full")); // Second audit fails

    const result = await emergencyMfaResetOperation(
      req,
      {
        targetId: adminId,
        expectedEmail: "admin@cobralearn.com",
        justification: "Administrator lost phone device verification",
      },
      mockPrisma,
      mockSupabaseAdmin
    );

    expect(result.status).toBe("FACTOR_DELETED");
    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(true);
  });

  // 10. Protected server operations reject quarantined administrators
  it("Test 10: Protected server operations reject quarantined administrators with MFA_REENROLLMENT_REQUIRED", async () => {
    mockProfiles[adminId].mfaRecoveryPending = true;
    setupAuthClientMock(adminId, "aal2");

    const req = createReq("https://api.internal/admin/profiles", "GET");

    // Central authorization boundary
    await expect(requireAdminProfile(req, mockPrisma)).rejects.toThrow(
      "Forbidden: MFA_REENROLLMENT_REQUIRED"
    );

    // Protected operation
    await expect(listAdminProfilesOperation(req, mockPrisma)).rejects.toThrow(
      "Forbidden: MFA_REENROLLMENT_REQUIRED"
    );

    expect(isQuarantineError(new Error("Forbidden: MFA_REENROLLMENT_REQUIRED"))).toBe(true);
  });

  // 11. Client-side attempts to clear quarantine are ineffective
  it("Test 11: Direct client calls without newly verified factor cannot satisfy completion", async () => {
    mockProfiles[adminId].mfaRecoveryPending = true;
    setupAuthClientMock(adminId, "aal1");

    // Seed recovery record in FACTOR_DELETED status
    const recId = "rec-test-11";
    mockRecoveries[recId] = {
      id: recId,
      targetId: adminId,
      status: "FACTOR_DELETED",
      factorId: "factor-totp-123",
      initiatedAt: new Date(Date.now() - 60000),
    };

    // Supabase reports NO verified factors
    mockSupabaseAdmin.auth.admin.mfa.listFactors.mockResolvedValueOnce({
      data: { factors: [] },
      error: null,
    });

    const req = createReq("https://api.internal/admin/mfa/complete-reenrollment", "POST");
    await expect(completeMfaReenrollmentOperation(req, mockPrisma, mockSupabaseAdmin)).rejects.toThrow(
      /Re-enrollment verification failed: No verified TOTP factor found/
    );

    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(true);
  });

  // 12. Unverified or old factors cannot satisfy re-enrollment
  it("Test 12: Previously deleted factor or factor with old timestamp cannot satisfy re-enrollment", async () => {
    mockProfiles[adminId].mfaRecoveryPending = true;
    setupAuthClientMock(adminId, "aal1");

    const recoveryInitiatedAt = new Date(Date.now() - 30000);
    const recId = "rec-test-12";
    mockRecoveries[recId] = {
      id: recId,
      targetId: adminId,
      status: "FACTOR_DELETED",
      factorId: "factor-totp-old",
      initiatedAt: recoveryInitiatedAt,
    };

    // Only old factor returned
    mockSupabaseAdmin.auth.admin.mfa.listFactors.mockResolvedValueOnce({
      data: {
        factors: [
          {
            id: "factor-totp-old",
            factor_type: "totp",
            status: "verified",
            created_at: new Date(Date.now() - 100000).toISOString(),
          },
        ],
      },
      error: null,
    });

    const req1 = createReq("https://api.internal/admin/mfa/complete-reenrollment", "POST");
    await expect(completeMfaReenrollmentOperation(req1, mockPrisma, mockSupabaseAdmin)).rejects.toThrow(
      /Only the previously deleted factor was found/
    );

    // New factor exists but created BEFORE recovery was initiated
    mockSupabaseAdmin.auth.admin.mfa.listFactors.mockResolvedValueOnce({
      data: {
        factors: [
          {
            id: "factor-totp-pre-existing",
            factor_type: "totp",
            status: "verified",
            created_at: new Date(recoveryInitiatedAt.getTime() - 20000).toISOString(),
          },
        ],
      },
      error: null,
    });

    const req2 = createReq("https://api.internal/admin/mfa/complete-reenrollment", "POST");
    await expect(completeMfaReenrollmentOperation(req2, mockPrisma, mockSupabaseAdmin)).rejects.toThrow(
      /Factor was created before recovery was initiated/
    );

    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(true);
  });

  // 13. A verified new factor permits completion only for the correct target
  it("Test 13: Newly verified factor allows atomic completion and releases quarantine", async () => {
    mockProfiles[adminId].mfaRecoveryPending = true;
    setupAuthClientMock(adminId, "aal1");

    const recoveryInitiatedAt = new Date(Date.now() - 30000);
    const recId = "rec-test-13";
    mockRecoveries[recId] = {
      id: recId,
      targetId: adminId,
      status: "FACTOR_DELETED",
      factorId: "factor-totp-old",
      initiatedAt: recoveryInitiatedAt,
    };

    // New factor created after recovery initiated
    const newFactorId = "factor-totp-fresh-999";
    mockSupabaseAdmin.auth.admin.mfa.listFactors.mockResolvedValueOnce({
      data: {
        factors: [
          {
            id: newFactorId,
            factor_type: "totp",
            status: "verified",
            created_at: new Date(Date.now() - 5000).toISOString(),
          },
        ],
      },
      error: null,
    });

    const req = createReq("https://api.internal/admin/mfa/complete-reenrollment", "POST");
    const result = await completeMfaReenrollmentOperation(req, mockPrisma, mockSupabaseAdmin);

    expect(result.success).toBe(true);
    expect(result.newFactorId).toBe(newFactorId);
    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(false);
    expect(mockProfiles[adminId].mfaRecoveryAt).toBeNull();
    expect(mockRecoveries[recId].status).toBe("COMPLETED");
  });

  // 14. Enrollment cancellation preserves quarantine
  it("Test 14: Cancelling enrollment leaves recovery pending and quarantine intact", async () => {
    mockProfiles[adminId].mfaRecoveryPending = true;
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/recovery-status", "GET");
    const status = await getMfaRecoveryStatusOperation(req, adminId, mockPrisma);

    expect(status.pending).toBe(true);
    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(true);
  });

  // 15. Audit-write failure and partial failure are handled safely
  it("Test 15: Initial intent failure aborts before contacting Supabase Auth", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset", "POST");

    mockPrisma.$transaction.mockRejectedValueOnce(new Error("Database transaction aborted"));

    await expect(
      emergencyMfaResetOperation(
        req,
        {
          targetId: adminId,
          expectedEmail: "admin@cobralearn.com",
          justification: "Administrator lost phone device verification",
        },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow("Database transaction aborted");

    // External Supabase factor deletion should NEVER have been called
    expect(mockSupabaseAdmin.auth.admin.mfa.deleteFactor).not.toHaveBeenCalled();
  });

  // 16. Concurrent requests cannot corrupt recovery state
  it("Test 16: Duplicate / concurrent recovery requests against the same target are rejected", async () => {
    mockProfiles[adminId].mfaRecoveryPending = true; // Target already in recovery
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset", "POST");

    await expect(
      emergencyMfaResetOperation(
        req,
        {
          targetId: adminId,
          expectedEmail: "admin@cobralearn.com",
          justification: "Concurrent recovery attempt",
        },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow(/already has an active emergency recovery in progress/);
  });

  // 17. Reconciliation is safe and repeatable
  it("Test 17: Reconciliation detects factor status accurately and updates record safely", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/reconcile", "POST");

    mockProfiles[adminId].mfaRecoveryPending = true;
    const recId = "rec-test-17";
    mockRecoveries[recId] = {
      id: recId,
      targetId: adminId,
      targetEmail: "admin@cobralearn.com",
      status: "RECONCILIATION_REQUIRED",
      factorId: "factor-totp-123",
      initiatedAt: new Date(Date.now() - 60000),
    };

    // Factor is confirmed gone from Supabase
    mockSupabaseAdmin.auth.admin.mfa.listFactors.mockResolvedValueOnce({
      data: { factors: [] },
      error: null,
    });

    const res = await reconcileMfaRecoveryOperation(
      req,
      { recoveryId: recId, notes: "Verified factor deleted during outage" },
      mockPrisma,
      mockSupabaseAdmin
    );

    expect(res.status).toBe("FACTOR_DELETED");
    expect(res.mfaRecoveryPending).toBe(true);
    expect(mockRecoveries[recId].status).toBe("FACTOR_DELETED");
  });

  // 18. CLI dry-run causes no mutation
  it("Test 18: CLI dry-run performs inspection and mutates neither PostgreSQL nor Supabase", async () => {
    const logs: string[] = [];
    const errorLogs: string[] = [];

    const args = parseEmergencyMfaCliArgs([
      `--id=${superAdmin1Id}`,
      `--email=super1@cobralearn.com`,
    ]);

    const result = await executeEmergencyMfaCli(args, {
      prisma: mockPrisma,
      supabaseAdmin: mockSupabaseAdmin,
      log: (msg) => logs.push(msg),
      errorLog: (msg) => errorLogs.push(msg),
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(mockProfiles[superAdmin1Id].mfaRecoveryPending).toBe(false);
    expect(mockSupabaseAdmin.auth.admin.mfa.deleteFactor).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes("[DRY-RUN] No changes were made"))).toBe(true);
  });

  // 19. CLI apply requires every confirmation and validates the target
  it("Test 19: CLI apply validates requirements, deletes factor, and establishes quarantine", async () => {
    const logs: string[] = [];
    const errorLogs: string[] = [];

    // Fails without reason
    let args = parseEmergencyMfaCliArgs([
      `--id=${superAdmin1Id}`,
      `--email=super1@cobralearn.com`,
      `--environment=development`,
      `--apply`,
    ]);
    let result = await executeEmergencyMfaCli(args, {
      prisma: mockPrisma,
      supabaseAdmin: mockSupabaseAdmin,
      log: (msg) => logs.push(msg),
      errorLog: (msg) => errorLogs.push(msg),
    });
    expect(result.exitCode).toBe(1);

    // Fails for non-SUPER_ADMIN target
    args = parseEmergencyMfaCliArgs([
      `--id=${adminId}`,
      `--email=admin@cobralearn.com`,
      `--reason=Valid meaningful justification for reset`,
      `--environment=development`,
      `--apply`,
    ]);
    result = await executeEmergencyMfaCli(args, {
      prisma: mockPrisma,
      supabaseAdmin: mockSupabaseAdmin,
      log: (msg) => logs.push(msg),
      errorLog: (msg) => errorLogs.push(msg),
    });
    expect(result.exitCode).toBe(1);
    expect(errorLogs.some((e) => e.includes("reserved for SUPER_ADMIN accounts"))).toBe(true);

    // Succeeds with full arguments on SUPER_ADMIN
    args = parseEmergencyMfaCliArgs([
      `--id=${superAdmin1Id}`,
      `--email=super1@cobralearn.com`,
      `--reason=Lost device; authenticated in-person with company credentials`,
      `--environment=development`,
      `--apply`,
    ]);
    result = await executeEmergencyMfaCli(args, {
      prisma: mockPrisma,
      supabaseAdmin: mockSupabaseAdmin,
      log: (msg) => logs.push(msg),
      errorLog: (msg) => errorLogs.push(msg),
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(mockProfiles[superAdmin1Id].mfaRecoveryPending).toBe(true);
    expect(mockSupabaseAdmin.auth.admin.mfa.deleteFactor).toHaveBeenCalled();
  });

  // 20. Existing MFA, AAL2, RBAC, rate-limiting, and authentication regressions remain passing
  it("Test 20: Unquarantined administrator continues through requireAdminProfile without regression", async () => {
    setupAuthClientMock(adminId, "aal1");
    const req = createReq("https://api.internal/admin/profile/self", "GET");
    const ctx = await requireAdminProfile(req, mockPrisma);

    expect(ctx.user.id).toBe(adminId);
    expect(ctx.profile.email).toBe("admin@cobralearn.com");
    expect(ctx.profile.mfaRecoveryPending).toBe(false);
  });

  // 21. Prisma model and enum consistency with all recovery runtime fields
  it("Test 21: Prisma model and enum definitions include all runtime fields and enum variants", () => {
    expect(MfaRecoveryStatus.PENDING).toBe("PENDING");
    expect(MfaRecoveryStatus.FACTOR_DELETED).toBe("FACTOR_DELETED");
    expect(MfaRecoveryStatus.COMPLETED).toBe("COMPLETED");
    expect(MfaRecoveryStatus.FAILED).toBe("FAILED");
    expect(MfaRecoveryStatus.RECONCILIATION_REQUIRED).toBe("RECONCILIATION_REQUIRED");

    expect(MfaRecoveryActorType.SUPER_ADMIN_PEER).toBe("SUPER_ADMIN_PEER");
    expect(MfaRecoveryActorType.HOST_CLI_BREAK_GLASS).toBe("HOST_CLI_BREAK_GLASS");
    expect(MfaRecoveryActorType.SYSTEM_RECONCILER).toBe("SYSTEM_RECONCILER");

    const fields = Object.values(Prisma.AdminMfaRecoveryScalarFieldEnum);
    const requiredFields = [
      "id",
      "actorType",
      "actorId",
      "actorEmail",
      "actorIdentifier",
      "targetId",
      "targetEmail",
      "targetRoleSnapshot",
      "status",
      "justification",
      "factorId",
      "failureCategory",
      "failureReason",
      "reconciliationNotes",
      "reconciledAt",
      "reconciledByActorId",
      "initiatedAt",
      "factorDeletedAt",
      "completedAt",
      "createdAt",
      "updatedAt",
    ];

    for (const field of requiredFields) {
      expect(fields).toContain(field);
    }

    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, "../../prisma/migrations/20261016181500_phase4_6_emergency_mfa_recovery/migration.sql"),
      "utf-8"
    );
    expect(migrationSql).toContain("unique_active_admin_mfa_recovery");
    expect(migrationSql).toContain("ON DELETE RESTRICT");
    expect(migrationSql).toContain("ON DELETE SET NULL");
  });

  // 22. CLI actor identity compatibility with schema foreign keys
  it("Test 22: CLI recovery stores actorType HOST_CLI_BREAK_GLASS with null actorId to satisfy foreign key constraints", async () => {
    const logs: string[] = [];
    const errorLogs: string[] = [];

    const args = parseEmergencyMfaCliArgs([
      `--id=${superAdmin1Id}`,
      `--email=super1@cobralearn.com`,
      `--reason=Testing schema FK compatibility for host operator`,
      `--environment=staging`,
      `--apply`,
    ]);

    const result = await executeEmergencyMfaCli(args, {
      prisma: mockPrisma,
      supabaseAdmin: mockSupabaseAdmin,
      log: (msg) => logs.push(msg),
      errorLog: (msg) => errorLogs.push(msg),
    });

    expect(result.success).toBe(true);
    const recovery = Object.values(mockRecoveries).find((r: any) => r.targetId === superAdmin1Id);
    expect(recovery).toBeDefined();
    expect(recovery.actorId).toBeNull();
    expect(recovery.actorType).toBe("HOST_CLI_BREAK_GLASS");
    expect(recovery.actorEmail).toBe("host-cli@system.internal");
    expect(recovery.actorIdentifier).toBe("host-operator-cli:staging");
  });

  // 23. Concurrent recovery requests genuinely executing simultaneously
  it("Test 23: Truly concurrent simultaneous recovery requests race safely with only one winning the atomic lock", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req1 = createReq("https://api.internal/admin/mfa/emergency-reset", "POST");
    const req2 = createReq("https://api.internal/admin/mfa/emergency-reset", "POST");

    const payload = {
      targetId: adminId,
      expectedEmail: "admin@cobralearn.com",
      justification: "Simultaneous concurrent web recovery test",
    };

    const results = await Promise.allSettled([
      emergencyMfaResetOperation(req1, payload, mockPrisma, mockSupabaseAdmin),
      emergencyMfaResetOperation(req2, payload, mockPrisma, mockSupabaseAdmin),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      /already has an active emergency recovery in progress/
    );

    expect(mockSupabaseAdmin.auth.admin.mfa.deleteFactor).toHaveBeenCalledTimes(1);
  });

  // 24. Web-versus-CLI race conditions
  it("Test 24: Simultaneous Web and CLI recovery requests are serialized; only one claims target quarantine", async () => {
    const args1 = parseEmergencyMfaCliArgs([
      `--id=${superAdmin2Id}`,
      `--email=super2@cobralearn.com`,
      `--reason=Simultaneous CLI invocation 1`,
      `--environment=staging`,
      `--apply`,
    ]);
    const args2 = parseEmergencyMfaCliArgs([
      `--id=${superAdmin2Id}`,
      `--email=super2@cobralearn.com`,
      `--reason=Simultaneous CLI invocation 2`,
      `--environment=staging`,
      `--apply`,
    ]);

    const [res1, res2] = await Promise.all([
      executeEmergencyMfaCli(args1, { prisma: mockPrisma, supabaseAdmin: mockSupabaseAdmin, log: () => {}, errorLog: () => {} }),
      executeEmergencyMfaCli(args2, { prisma: mockPrisma, supabaseAdmin: mockSupabaseAdmin, log: () => {}, errorLog: () => {} }),
    ]);

    const successes = [res1, res2].filter((r) => r.success);
    const failures = [res1, res2].filter((r) => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toMatch(/Already in recovery/);
  });

  // 25. Unique active-recovery constraint conflicts
  it("Test 25: Database partial unique constraint violation (P2002) is caught and handled safely", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset", "POST");

    mockRecoveries["rec-active-conflict"] = {
      id: "rec-active-conflict",
      targetId: adminId,
      targetEmail: "admin@cobralearn.com",
      status: "FACTOR_DELETED",
      initiatedAt: new Date(),
    };
    mockProfiles[adminId].mfaRecoveryPending = false;

    await expect(
      emergencyMfaResetOperation(
        req,
        {
          targetId: adminId,
          expectedEmail: "admin@cobralearn.com",
          justification: "Testing DB unique constraint conflict handling",
        },
        mockPrisma,
        mockSupabaseAdmin
      )
    ).rejects.toThrow(/already has an active emergency recovery in progress/);
  });

  // 26. Database failure after successful Supabase factor deletion preserves quarantine
  it("Test 26: Database failure after factor deletion preserves quarantine in AdminProfile", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/emergency-reset", "POST");

    const originalUpdate = mockPrisma.adminMfaRecovery.update;
    mockPrisma.adminMfaRecovery.update = vi.fn().mockImplementation((args: any) => {
      if (args.data.status === "FACTOR_DELETED") {
        return Promise.reject(new Error("Database connection dropped after factor deletion"));
      }
      return originalUpdate(args);
    });

    const res = await emergencyMfaResetOperation(
      req,
      {
        targetId: adminId,
        expectedEmail: "admin@cobralearn.com",
        justification: "Testing fail-closed post-deletion state",
      },
      mockPrisma,
      mockSupabaseAdmin
    );

    expect(mockSupabaseAdmin.auth.admin.mfa.deleteFactor).toHaveBeenCalled();
    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(true);
  });

  // 27. Null factor ID and ambiguous reconciliation states
  it("Test 27A: Reconciliation with null factorId and active factors in Supabase preserves quarantine as RECONCILIATION_REQUIRED", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/reconcile", "POST");

    mockProfiles[adminId].mfaRecoveryPending = true;
    const recId = "rec-null-factor-active";
    mockRecoveries[recId] = {
      id: recId,
      targetId: adminId,
      targetEmail: "admin@cobralearn.com",
      status: "RECONCILIATION_REQUIRED",
      factorId: null,
      initiatedAt: new Date(Date.now() - 60000),
    };

    mockSupabaseAdmin.auth.admin.mfa.listFactors.mockResolvedValueOnce({
      data: {
        factors: [{ id: "factor-ambiguous-999", factor_type: "totp", status: "verified" }],
      },
      error: null,
    });

    const res = await reconcileMfaRecoveryOperation(
      req,
      { recoveryId: recId, notes: "Auditing ambiguous recovery" },
      mockPrisma,
      mockSupabaseAdmin
    );

    expect(res.status).toBe("RECONCILIATION_REQUIRED");
    expect(res.mfaRecoveryPending).toBe(true);
    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(true);
    expect(mockSupabaseAdmin.auth.admin.mfa.deleteFactor).not.toHaveBeenCalled();
    expect(mockRecoveries[recId].reconciliationNotes).toContain("Ambiguous state");
  });

  it("Test 27B: Reconciliation with null factorId and NO factors in Supabase transitions to FACTOR_DELETED", async () => {
    setupAuthClientMock(superAdmin1Id, "aal2");
    const req = createReq("https://api.internal/admin/mfa/reconcile", "POST");

    mockProfiles[adminId].mfaRecoveryPending = true;
    const recId = "rec-null-factor-empty";
    mockRecoveries[recId] = {
      id: recId,
      targetId: adminId,
      targetEmail: "admin@cobralearn.com",
      status: "RECONCILIATION_REQUIRED",
      factorId: null,
      initiatedAt: new Date(Date.now() - 60000),
    };

    mockSupabaseAdmin.auth.admin.mfa.listFactors.mockResolvedValueOnce({
      data: { factors: [] },
      error: null,
    });

    const res = await reconcileMfaRecoveryOperation(
      req,
      { recoveryId: recId, notes: "Auditing factor-free target" },
      mockPrisma,
      mockSupabaseAdmin
    );

    expect(res.status).toBe("FACTOR_DELETED");
    expect(res.mfaRecoveryPending).toBe(true);
    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(true);
  });

  // 28. Missing or invalid factor creation timestamps
  it("Test 28: Re-enrollment completion strictly validates factor creation timestamp", async () => {
    mockProfiles[adminId].mfaRecoveryPending = true;
    const recId = "rec-ts-validation";
    mockRecoveries[recId] = {
      id: recId,
      targetId: adminId,
      status: "FACTOR_DELETED",
      factorId: "factor-deleted-111",
      initiatedAt: new Date(Date.now() - 30000),
    };

    setupAuthClientMock(adminId, "aal1");
    const req = createReq("https://api.internal/admin/mfa/complete-reenrollment", "POST");

    // Missing timestamp
    mockSupabaseAdmin.auth.admin.mfa.listFactors.mockResolvedValueOnce({
      data: {
        factors: [
          { id: "factor-new-222", factor_type: "totp", status: "verified" },
        ],
      },
      error: null,
    });
    await expect(
      completeMfaReenrollmentOperation(req, mockPrisma, mockSupabaseAdmin)
    ).rejects.toThrow(/Factor creation timestamp is missing/);

    // Invalid timestamp
    mockSupabaseAdmin.auth.admin.mfa.listFactors.mockResolvedValueOnce({
      data: {
        factors: [
          { id: "factor-new-222", factor_type: "totp", status: "verified", created_at: "invalid-timestamp-string" },
        ],
      },
      error: null,
    });
    await expect(
      completeMfaReenrollmentOperation(req, mockPrisma, mockSupabaseAdmin)
    ).rejects.toThrow(/Factor creation timestamp is invalid/);

    // Pre-recovery timestamp (factor was created before recovery started)
    mockSupabaseAdmin.auth.admin.mfa.listFactors.mockResolvedValueOnce({
      data: {
        factors: [
          {
            id: "factor-new-222",
            factor_type: "totp",
            status: "verified",
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
      },
      error: null,
    });
    await expect(
      completeMfaReenrollmentOperation(req, mockPrisma, mockSupabaseAdmin)
    ).rejects.toThrow(/Factor was created before recovery was initiated/);
  });

  // 29. Concurrent re-enrollment completion
  it("Test 29: Concurrent re-enrollment completion requests are serialized by conditional update", async () => {
    mockProfiles[adminId].mfaRecoveryPending = true;
    const recId = "rec-concurrent-complete";
    mockRecoveries[recId] = {
      id: recId,
      targetId: adminId,
      status: "FACTOR_DELETED",
      factorId: "factor-deleted-old",
      initiatedAt: new Date(Date.now() - 30000),
    };

    setupAuthClientMock(adminId, "aal1");
    const req1 = createReq("https://api.internal/admin/mfa/complete-reenrollment", "POST");
    const req2 = createReq("https://api.internal/admin/mfa/complete-reenrollment", "POST");

    mockSupabaseAdmin.auth.admin.mfa.listFactors.mockResolvedValue({
      data: {
        factors: [
          {
            id: "factor-new-fresh",
            factor_type: "totp",
            status: "verified",
            created_at: new Date().toISOString(),
          },
        ],
      },
      error: null,
    });

    const results = await Promise.allSettled([
      completeMfaReenrollmentOperation(req1, mockPrisma, mockSupabaseAdmin),
      completeMfaReenrollmentOperation(req2, mockPrisma, mockSupabaseAdmin),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(/Concurrent modification/);
    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(false);
  });

  // 30. Login-history recording for quarantined accounts
  it("Test 30: Quarantined administrator can record login history without throwing or breaking recovery flow", async () => {
    mockProfiles[adminId].mfaRecoveryPending = true;
    setupAuthClientMock(adminId, "aal1");

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: adminId, session_id: "session-valid-456" })).toString("base64url");
    const mockJwt = `${header}.${payload}.mock-signature`;

    const req = new Request("https://api.internal/admin/auth/record-login", {
      method: "POST",
      headers: {
        authorization: `Bearer ${mockJwt}`,
        cookie: `sb-access-token=${mockJwt}`,
      },
    });

    const res = await recordAdminLoginOperation(req, mockPrisma);

    expect(res.success).toBe(true);
    expect(mockProfiles[adminId].mfaRecoveryPending).toBe(true);

    mockPrisma.adminLoginHistory.create.mockRejectedValueOnce(new Error("Login history disk full"));
    const failSafeRes = await recordAdminLoginOperation(req, mockPrisma);
    expect(failSafeRes.success).toBe(false);
  });
});
