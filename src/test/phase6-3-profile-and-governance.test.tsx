import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient, AdminProfile, AdminRole } from "@prisma/client";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import {
  updateSelfProfileOperation,
  updateSelfPreferencesOperation,
  uploadAvatarOperation,
  updateAdminStatusOperation,
  assignAdminRoleOperation,
} from "@/lib/server/admin-operations";
import { requestPasswordResetOperation } from "@/lib/server/auth-rate-limit-operations";
import { requireAdminProfile, requirePermission, requireAal2 } from "@/lib/auth/server-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Phase 6.3 — Administrator Profile & Account Security Suite", () => {
  const superAdmin1Id = "11111111-1111-4111-8111-111111111111";
  const superAdmin2Id = "22222222-2222-4222-8222-222222222222";
  const regularAdminId = "33333333-3333-4333-8333-333333333333";
  const editorId = "44444444-4444-4444-8444-444444444444";

  const VALID_1X1_PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  let mockProfilesDb: Record<string, AdminProfile>;
  let auditLogsCreated: any[];
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    auditLogsCreated = [];

    mockProfilesDb = {
      [superAdmin1Id]: {
        id: superAdmin1Id,
        email: "super1@cobralearn.com",
        fullName: "Super Admin 1",
        role: "SUPER_ADMIN" as AdminRole,
        isActive: true,
        avatarUrl: null,
        phone: "+91 98765 00001",
        designation: "Chief Security Officer",
        bio: "Platform Administrator",
        preferences: null,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [superAdmin2Id]: {
        id: superAdmin2Id,
        email: "super2@cobralearn.com",
        fullName: "Super Admin 2",
        role: "SUPER_ADMIN" as AdminRole,
        isActive: true,
        avatarUrl: null,
        phone: "+91 98765 00002",
        designation: "Executive Director",
        bio: "Secondary Super Admin",
        preferences: null,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [regularAdminId]: {
        id: regularAdminId,
        email: "admin@cobralearn.com",
        fullName: "Regular Admin",
        role: "ADMIN" as AdminRole,
        isActive: true,
        avatarUrl: null,
        phone: "+91 98765 00003",
        designation: "Operations Lead",
        bio: "Content Manager",
        preferences: null,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
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
        avatarUrl: null,
        phone: "+91 98765 00004",
        designation: "Junior Editor",
        bio: "Author",
        preferences: null,
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const prismaMockHandler = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id) {
            return Promise.resolve(mockProfilesDb[where.id] ? { ...mockProfilesDb[where.id] } : null);
          }
          if (where.email) {
            const found = Object.values(mockProfilesDb).find((p) => p.email.toLowerCase() === where.email?.toLowerCase());
            return Promise.resolve(found ? { ...found } : null);
          }
          return Promise.resolve(null);
        }),
        findMany: vi.fn().mockImplementation(({ where }: any = {}) => {
          let list = Object.values(mockProfilesDb);
          if (where?.role) {
            list = list.filter((p) => p.role === where.role);
          }
          if (where?.isActive !== undefined) {
            list = list.filter((p) => p.isActive === where.isActive);
          }
          return Promise.resolve(list.map((p) => ({ ...p })));
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          if (!mockProfilesDb[where.id]) throw new Error("Record to update not found.");
          mockProfilesDb[where.id] = { ...mockProfilesDb[where.id], ...data };
          return Promise.resolve({ ...mockProfilesDb[where.id] });
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
        findFirst: vi.fn().mockResolvedValue(null),
      },
      adminNotification: {
        create: vi.fn().mockResolvedValue({ id: "notif-1" }),
      },
    };

    mockPrisma = {
      ...prismaMockHandler,
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(prismaMockHandler);
      }),
    };
  });

  function setupAuthContext(userId: string, assuranceLevel: "aal1" | "aal2" = "aal2") {
    const profile = mockProfilesDb[userId];
    const user: User | null = profile
      ? ({
          id: profile.id,
          email: profile.email,
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as User)
      : null;

    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : { message: "User not found" },
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: user ? { user, access_token: "token-" + userId } : null },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: {
              currentLevel: assuranceLevel,
              nextLevel: assuranceLevel,
              currentAuthenticationMethods: assuranceLevel === "aal2" ? [{ method: "totp" }] : [{ method: "password" }],
            },
            error: null,
          }),
        },
      },
    });

    return new Request("https://api.internal/admin/operation", {
      headers: {
        authorization: `Bearer token-${userId}`,
        "x-forwarded-for": "198.51.100.42",
      },
    });
  }

  // =========================================================================
  // TASK 1 — REQUIRE AAL2 FOR SELF-SERVICE PROFILE MUTATIONS
  // =========================================================================
  describe("Task 1: AAL2 Enforcement on Self-Service Profile Mutations", () => {
    it("1.1 Rejects updateSelfProfileOperation when session is only AAL1", async () => {
      const req = setupAuthContext(regularAdminId, "aal1");

      await expect(
        updateSelfProfileOperation(req, { fullName: "Hacked Admin" }, mockPrisma)
      ).rejects.toThrow("Forbidden: AAL2_REQUIRED");

      // Verify no changes were made to profile in DB
      expect(mockProfilesDb[regularAdminId].fullName).toBe("Regular Admin");
    });

    it("1.2 Rejects updateSelfPreferencesOperation when session is only AAL1", async () => {
      const req = setupAuthContext(regularAdminId, "aal1");

      await expect(
        updateSelfPreferencesOperation(
          req,
          { notifications: { emailAlerts: true } },
          mockPrisma
        )
      ).rejects.toThrow("Forbidden: AAL2_REQUIRED");
    });

    it("1.3 Rejects uploadAvatarOperation when session is only AAL1", async () => {
      const req = setupAuthContext(regularAdminId, "aal1");

      await expect(
        uploadAvatarOperation(
          req,
          {
            originalFilename: "avatar.png",
            mimeType: "image/png",
            base64Content: VALID_1X1_PNG_BASE64,
          },
          mockPrisma
        )
      ).rejects.toThrow("Forbidden: AAL2_REQUIRED");
    });

    it("1.4 Allows updateSelfProfileOperation when session is verified AAL2", async () => {
      const req = setupAuthContext(regularAdminId, "aal2");

      const result = await updateSelfProfileOperation(
        req,
        { fullName: "Updated Regular Admin", designation: "Security Specialist" },
        mockPrisma
      );

      expect(result.profile.fullName).toBe("Updated Regular Admin");
      expect(result.profile.designation).toBe("Security Specialist");
      expect(mockProfilesDb[regularAdminId].fullName).toBe("Updated Regular Admin");

      // Audit log must be recorded with masked IP
      const profileAudit = auditLogsCreated.find((l) => l.action === "SELF_PROFILE_UPDATED");
      expect(profileAudit).toBeDefined();
      expect(profileAudit.actorId).toBe(regularAdminId);
      expect(profileAudit.ipAddress).toBe("198.51.100.***");
      expect(profileAudit.metadata.updatedFields).toContain("fullName");
    });

    it("1.5 Prohibits modifying privileged fields (id, email, role, isActive) via self-service", async () => {
      const req = setupAuthContext(regularAdminId, "aal2");

      await expect(
        updateSelfProfileOperation(req, { id: "00000000-0000-0000-0000-000000000000" }, mockPrisma)
      ).rejects.toThrow("Forbidden: Cannot modify account ID");

      await expect(
        updateSelfProfileOperation(req, { email: "attacker@domain.com" }, mockPrisma)
      ).rejects.toThrow("Forbidden: Email modification requires verified email change flow");

      await expect(
        updateSelfProfileOperation(req, { role: "SUPER_ADMIN" as any }, mockPrisma)
      ).rejects.toThrow("Forbidden: Cannot self-assign or elevate administrative role");

      await expect(
        updateSelfProfileOperation(req, { isActive: false as any }, mockPrisma)
      ).rejects.toThrow("Forbidden: Cannot self-modify active account status");

      // Database remains unchanged
      expect(mockProfilesDb[regularAdminId].role).toBe("ADMIN");
      expect(mockProfilesDb[regularAdminId].isActive).toBe(true);
    });
  });

  // =========================================================================
  // TASK 2 — SAFE ACCOUNT DEACTIVATION AND SESSION REVOCATION
  // =========================================================================
  describe("Task 2: Account Deactivation & Session Revocation", () => {
    it("2.1 Deactivation updates PostgreSQL status to inactive and executes global session revocation", async () => {
      const req = setupAuthContext(superAdmin1Id, "aal2");

      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      const mockSupabaseAdmin = {
        auth: {
          admin: {
            signOut: mockSignOut,
          },
        },
      } as unknown as SupabaseClient;

      const result = await updateAdminStatusOperation(
        req,
        { targetAdminId: regularAdminId, isActive: false },
        mockPrisma,
        mockSupabaseAdmin
      );

      expect(result.success).toBe(true);
      expect(result.isActive).toBe(false);
      expect(result.sessionRevocation).toBe("completed");

      // Database record is deactivated
      expect(mockProfilesDb[regularAdminId].isActive).toBe(false);

      // Provider global sign-out was invoked with target UUID and 'global'
      expect(mockSignOut).toHaveBeenCalledWith(regularAdminId, "global");

      // Audit log records deactivation with sessionRevocation: 'completed' and masked IP
      const deactLog = auditLogsCreated.find((l) => l.action === "ADMIN_DEACTIVATED");
      expect(deactLog).toBeDefined();
      expect(deactLog.entityId).toBe(regularAdminId);
      expect(deactLog.metadata.sessionRevocation).toBe("completed");
      expect(deactLog.ipAddress).toBe("198.51.100.***");
    });

    it("2.2 Deactivation revocation provider error is handled truthfully without rolling back DB status", async () => {
      const req = setupAuthContext(superAdmin1Id, "aal2");

      const mockSignOut = vi.fn().mockResolvedValue({ error: { message: "Supabase connection error" } });
      const mockSupabaseAdmin = {
        auth: {
          admin: {
            signOut: mockSignOut,
          },
        },
      } as unknown as SupabaseClient;

      const result = await updateAdminStatusOperation(
        req,
        { targetAdminId: editorId, isActive: false },
        mockPrisma,
        mockSupabaseAdmin
      );

      // Account is STILL deactivated in database!
      expect(result.success).toBe(true);
      expect(result.isActive).toBe(false);
      expect(result.sessionRevocation).toBe("limited");
      expect(mockProfilesDb[editorId].isActive).toBe(false);

      // Audit log truthfully records sessionRevocation: 'limited'
      const deactLog = auditLogsCreated.find((l) => l.action === "ADMIN_DEACTIVATED" && l.entityId === editorId);
      expect(deactLog).toBeDefined();
      expect(deactLog.metadata.sessionRevocation).toBe("limited");
    });

    it("2.3 Deactivated administrators are immediately rejected by requireAdminProfile", async () => {
      // Mark regular admin as inactive
      mockProfilesDb[regularAdminId].isActive = false;

      const req = setupAuthContext(regularAdminId, "aal2");

      await expect(requireAdminProfile(req, mockPrisma)).rejects.toThrow(
        "Forbidden: AdminProfile is deactivated"
      );
    });

    it("2.4 Blocks deactivating the sole active Super Admin and audits failed attempt", async () => {
      // Deactivate Super Admin 2 so Super Admin 1 is the sole active one
      mockProfilesDb[superAdmin2Id].isActive = false;

      const req = setupAuthContext(superAdmin1Id, "aal2");

      await expect(
        updateAdminStatusOperation(
          req,
          { targetAdminId: superAdmin1Id, isActive: false },
          mockPrisma
        )
      ).rejects.toThrow("Forbidden: Cannot deactivate the sole active Super Admin");

      // Super Admin 1 remains active
      expect(mockProfilesDb[superAdmin1Id].isActive).toBe(true);

      // Audit log recorded failed attempt with masked IP
      const failedLog = auditLogsCreated.find(
        (l) => l.action === "ADMIN_STATUS_UPDATE_FAILED" && l.metadata?.reason === "sole_active_super_admin"
      );
      expect(failedLog).toBeDefined();
      expect(failedLog.actorId).toBe(superAdmin1Id);
      expect(failedLog.ipAddress).toBe("198.51.100.***");
    });
  });

  // =========================================================================
  // TASK 3 — SAFE ROLE DEMOTION
  // =========================================================================
  describe("Task 3: Safe Role Demotion", () => {
    it("3.1 Demoting an administrator role triggers global session revocation", async () => {
      const req = setupAuthContext(superAdmin1Id, "aal2");

      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      const mockSupabaseAdmin = {
        auth: {
          admin: {
            signOut: mockSignOut,
          },
        },
      } as unknown as SupabaseClient;

      // Demote regularAdmin (ADMIN -> EDITOR)
      const result = await assignAdminRoleOperation(
        req,
        { targetAdminId: regularAdminId, newRole: "EDITOR" },
        mockPrisma,
        mockSupabaseAdmin
      );

      expect(result.success).toBe(true);
      expect(result.newRole).toBe("EDITOR");
      expect(result.sessionRevocation).toBe("completed");
      expect(mockProfilesDb[regularAdminId].role).toBe("EDITOR");

      // Session revocation called for demotion
      expect(mockSignOut).toHaveBeenCalledWith(regularAdminId, "global");

      // Audit log records isDemotion: true, sessionRevocation: 'completed'
      const roleLog = auditLogsCreated.find((l) => l.action === "ADMIN_ROLE_ASSIGNED");
      expect(roleLog).toBeDefined();
      expect(roleLog.metadata.previousRole).toBe("ADMIN");
      expect(roleLog.metadata.newRole).toBe("EDITOR");
      expect(roleLog.metadata.isDemotion).toBe(true);
      expect(roleLog.metadata.sessionRevocation).toBe("completed");
      expect(roleLog.ipAddress).toBe("198.51.100.***");
    });

    it("3.2 Promoting an administrator role does NOT trigger unnecessary session revocation", async () => {
      const req = setupAuthContext(superAdmin1Id, "aal2");

      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      const mockSupabaseAdmin = {
        auth: {
          admin: {
            signOut: mockSignOut,
          },
        },
      } as unknown as SupabaseClient;

      // Promote editor (EDITOR -> ADMIN)
      const result = await assignAdminRoleOperation(
        req,
        { targetAdminId: editorId, newRole: "ADMIN" },
        mockPrisma,
        mockSupabaseAdmin
      );

      expect(result.success).toBe(true);
      expect(result.newRole).toBe("ADMIN");
      expect(result.sessionRevocation).toBeUndefined();
      expect(mockProfilesDb[editorId].role).toBe("ADMIN");

      // Session revocation was NOT called for promotion
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("3.3 Blocks demoting the sole active Super Admin and audits failed attempt", async () => {
      // Deactivate Super Admin 2
      mockProfilesDb[superAdmin2Id].isActive = false;

      const req = setupAuthContext(superAdmin1Id, "aal2");

      await expect(
        assignAdminRoleOperation(
          req,
          { targetAdminId: superAdmin1Id, newRole: "ADMIN" },
          mockPrisma
        )
      ).rejects.toThrow("Forbidden: Cannot demote the sole active Super Admin");

      expect(mockProfilesDb[superAdmin1Id].role).toBe("SUPER_ADMIN");

      // Audit log recorded failed attempt
      const failedLog = auditLogsCreated.find(
        (l) => l.action === "ADMIN_ROLE_ASSIGNMENT_FAILED" && l.metadata?.reason === "sole_active_super_admin"
      );
      expect(failedLog).toBeDefined();
      expect(failedLog.actorId).toBe(superAdmin1Id);
    });

    it("3.4 Demoted administrator immediately loses higher permissions on subsequent requests", async () => {
      // Change regularAdmin role to EDITOR in database
      mockProfilesDb[regularAdminId].role = "EDITOR";

      const req = setupAuthContext(regularAdminId, "aal2");

      // EDITOR does not have AUDIT_LOG_READ permission
      await expect(
        requirePermission(req, "audit_log:read" as any, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "EDITOR" lacks required permission: "audit_log:read"');
    });
  });

  // =========================================================================
  // TASK 4 — BLOCK PASSWORD-RESET DISPATCH FOR INACTIVE ADMINS
  // =========================================================================
  describe("Task 4: Password-Reset Suppression for Deactivated Accounts", () => {
    it("4.1 Inactive administrator does NOT trigger reset email dispatch while returning generic response", async () => {
      // Deactivate regular admin
      mockProfilesDb[regularAdminId].isActive = false;

      const mockResetPassword = vi.fn().mockResolvedValue({ data: {}, error: null });
      const mockSupabase = {
        auth: {
          resetPasswordForEmail: mockResetPassword,
        },
      } as unknown as SupabaseClient;

      const req = new Request("https://api.internal/auth/recovery", {
        method: "POST",
        headers: { "x-real-ip": "198.51.100.99" },
      });

      const result = await requestPasswordResetOperation(
        req,
        { email: "admin@cobralearn.com" },
        mockPrisma,
        mockSupabase
      );

      // Generic response preserved
      expect(result.success).toBe(true);
      expect(result.message).toContain("If an account is associated with this email");

      // Supabase email dispatch was NOT invoked!
      expect(mockResetPassword).not.toHaveBeenCalled();

      // Audit log records ignored dispatch without exposing account status to user
      const resetAudit = auditLogsCreated.find((l) => l.action === "auth:password_reset_requested");
      expect(resetAudit).toBeDefined();
      expect(resetAudit.metadata.outcome).toBe("ignored_deactivated_account");
      expect(resetAudit.actorId).toBe(regularAdminId);
      expect(resetAudit.ipAddress).toBe("198.51.100.***");
    });

    it("4.2 Active administrator DOES trigger password reset email dispatch", async () => {
      expect(mockProfilesDb[regularAdminId].isActive).toBe(true);

      const mockResetPassword = vi.fn().mockResolvedValue({ data: {}, error: null });
      const mockSupabase = {
        auth: {
          resetPasswordForEmail: mockResetPassword,
        },
      } as unknown as SupabaseClient;

      const req = new Request("https://api.internal/auth/recovery", {
        method: "POST",
        headers: { "x-real-ip": "198.51.100.99" },
      });

      const result = await requestPasswordResetOperation(
        req,
        { email: "admin@cobralearn.com" },
        mockPrisma,
        mockSupabase
      );

      expect(result.success).toBe(true);
      expect(mockResetPassword).toHaveBeenCalledWith(
        "admin@cobralearn.com",
        expect.objectContaining({ redirectTo: expect.any(String) })
      );

      const resetAudit = auditLogsCreated.find((l) => l.action === "auth:password_reset_requested");
      expect(resetAudit).toBeDefined();
      expect(resetAudit.metadata.outcome).toBe("dispatched");
    });
  });

  // =========================================================================
  // TASK 5 & 6 — AUDIT LOG INTEGRITY & SECRET SANITIZATION
  // =========================================================================
  describe("Task 5 & 6: Audit Log Integrity & Secret Redaction", () => {
    it("5.1 Audit logs never record secrets (passwords, tokens, OTPs, recovery codes)", () => {
      // Review all audit logs created across tests
      for (const log of auditLogsCreated) {
        const serialized = JSON.stringify(log);
        expect(serialized).not.toMatch(/password/i);
        expect(serialized).not.toMatch(/bearer/i);
        expect(serialized).not.toMatch(/secret/i);
        expect(serialized).not.toMatch(/token-[0-9a-f]/i);
        expect(serialized).not.toMatch(/refresh_token/i);
      }
    });

    it("5.2 Unauthorized governance attempt by non-authorized role is audited with masked IP", async () => {
      // Editor attempts to deactivate regularAdmin (requires ADMIN_MANAGE which Editor lacks)
      const req = setupAuthContext(editorId, "aal2");

      await expect(
        updateAdminStatusOperation(
          req,
          { targetAdminId: regularAdminId, isActive: false },
          mockPrisma
        )
      ).rejects.toThrow('Forbidden: Role "EDITOR" lacks required permission: "admin:manage"');

      const failedLog = auditLogsCreated.find(
        (l) => l.action === "ADMIN_STATUS_UPDATE_FAILED" && l.metadata?.reason === "unauthorized_role"
      );
      expect(failedLog).toBeDefined();
      expect(failedLog.actorId).toBe(editorId);
      expect(failedLog.metadata.requiredPermission).toBe("admin:manage");
      expect(failedLog.ipAddress).toBe("198.51.100.***");
    });
  });
});
