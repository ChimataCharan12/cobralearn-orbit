import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PrismaClient, AdminProfile, AdminRole, SiteSettings } from "@prisma/client";
import type { User, Session } from "@supabase/supabase-js";
import {
  requireAal2,
  requireAal2Permission,
  requireAal2Role,
  getAssuranceLevelForRequest,
  extractAccessTokenFromRequest,
  requireAdminProfile,
} from "@/lib/auth/server-auth";
import { AdminPermissions } from "@/lib/auth/rbac";
import {
  assignAdminRoleOperation,
  updateAdminStatusOperation,
  updateGlobalSettingsOperation,
  updateAppearanceConfigOperation,
  getAuditLogsOperation,
  deleteContactInquiryOperation,
  getCurrentAdminProfileOperation,
  getGlobalSettingsOperation,
  listAdminProfilesOperation,
  executeProtectedOperation,
} from "@/lib/server/admin-operations";
import { deleteAdminProjectOperation } from "@/lib/server/projects-operations";
import { deleteAdminMediaAssetOperation } from "@/lib/server/media-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Phase 4.3: Authoritative Server-Side AAL2 Enforcement", () => {
  const superAdminUuid = "11111111-1111-4111-8111-111111111111";
  const adminUuid = "22222222-2222-4222-8222-222222222222";
  const editorUuid = "33333333-3333-4333-8333-333333333333";
  const inactiveUuid = "44444444-4444-4444-8444-444444444444";
  const unprovisionedUuid = "55555555-5555-4555-8555-555555555555";

  const superAdminUser: User = {
    id: superAdminUuid,
    email: "superadmin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const adminUser: User = {
    id: adminUuid,
    email: "admin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const editorUser: User = {
    id: editorUuid,
    email: "editor@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const inactiveUser: User = {
    id: inactiveUuid,
    email: "inactive@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const unprovisionedUser: User = {
    id: unprovisionedUuid,
    email: "unprovisioned@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const mockProfiles: Record<string, AdminProfile> = {
    [superAdminUuid]: {
      id: superAdminUuid,
      email: "superadmin@cobralearn.com",
      fullName: "Super Admin",
      role: "SUPER_ADMIN" as AdminRole,
      isActive: true,
      phone: null,
      designation: null,
      bio: null,
      avatarUrl: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    [adminUuid]: {
      id: adminUuid,
      email: "admin@cobralearn.com",
      fullName: "Operations Admin",
      role: "ADMIN" as AdminRole,
      isActive: true,
      phone: null,
      designation: null,
      bio: null,
      avatarUrl: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    [editorUuid]: {
      id: editorUuid,
      email: "editor@cobralearn.com",
      fullName: "Content Editor",
      role: "EDITOR" as AdminRole,
      isActive: true,
      phone: null,
      designation: null,
      bio: null,
      avatarUrl: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    [inactiveUuid]: {
      id: inactiveUuid,
      email: "inactive@cobralearn.com",
      fullName: "Deactivated Administrator",
      role: "ADMIN" as AdminRole,
      isActive: false,
      phone: null,
      designation: null,
      bio: null,
      avatarUrl: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  let mockPrisma: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockPrisma = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(mockProfiles[where.id] || null);
        }),
        findMany: vi.fn().mockImplementation(() => {
          return Promise.resolve(Object.values(mockProfiles).filter((p) => p.isActive));
        }),
        update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: any }) => {
          const profile = mockProfiles[where.id];
          return Promise.resolve(profile ? { ...profile, ...data } : null);
        }),
      },
      siteSettings: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          siteName: "CobraLearn Enterprise",
          updatedAt: new Date(),
        }),
        upsert: vi.fn().mockImplementation(({ update }: { update: any }) => {
          return Promise.resolve({ id: "default", siteName: "CobraLearn Enterprise", ...update });
        }),
      },
      appearanceConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          brandPrimaryColor: "#00FF87",
        }),
        upsert: vi.fn().mockImplementation(({ update }: { update: any }) => {
          return Promise.resolve({ id: "default", brandPrimaryColor: "#00FF87", ...update });
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-log-uuid" }),
        findMany: vi.fn().mockResolvedValue([{ id: "audit-1", action: "SETTINGS_UPDATED" }]),
      },
      contactMessage: {
        findUnique: vi.fn().mockResolvedValue({ id: "msg-123", email: "visitor@example.com" }),
        delete: vi.fn().mockResolvedValue({ id: "msg-123" }),
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({ id: "proj-123", name: "Orbit Project" }),
        delete: vi.fn().mockResolvedValue({ id: "proj-123" }),
      },
      mediaAsset: {
        findUnique: vi.fn().mockResolvedValue({
          id: "media-123",
          filename: "logo.png",
          storagePath: "media/logo.png",
          projectThumbnails: [],
          projectGalleryItems: [],
          websiteThumbnails: [],
          websiteGalleryItems: [],
          advertisementThumbnails: [],
          advertisementGalleryItems: [],
          awardThumbnails: [],
          awardGalleryItems: [],
        }),
        delete: vi.fn().mockResolvedValue({ id: "media-123" }),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockPrisma);
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to configure the Supabase mock with specific user and assurance level.
   */
  function setupServerAuthMock(options: {
    user: User | null;
    currentLevel?: "aal1" | "aal2" | null;
    nextLevel?: "aal1" | "aal2" | null;
    error?: Error | null;
  }) {
    const { user, currentLevel = "aal1", nextLevel = "aal1", error = null } = options;

    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockImplementation((token?: string) => {
          if (error || !user) {
            return Promise.resolve({ data: { user: null }, error: error || new Error("Unauthorized") });
          }
          return Promise.resolve({ data: { user }, error: null });
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: user ? { user, access_token: "mock-valid-token" } : null },
          error: error || null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: user ? { currentLevel, nextLevel, currentAuthenticationMethods: [] } : null,
            error: error || null,
          }),
        },
      },
    });
  }

  // =========================================================================
  // 1. Central AAL2 Helper Unit Tests (requireAal2, requireAal2Permission, requireAal2Role)
  // =========================================================================
  describe("1. Central AAL2 Helper Unit Tests", () => {
    it("requireAal2 succeeds when user is active admin with verified AAL2 session", async () => {
      setupServerAuthMock({ user: superAdminUser, currentLevel: "aal2", nextLevel: "aal2" });
      const req = new Request("http://localhost:3000/api/admin/action", {
        headers: { authorization: "Bearer aal2-verified-token" },
      });

      const context = await requireAal2(req, mockPrisma);
      expect(context.user.id).toBe(superAdminUuid);
      expect(context.profile.role).toBe("SUPER_ADMIN");
      expect(context.profile.isActive).toBe(true);
    });

    it("requireAal2 rejects AAL1 (password-only) session with Forbidden: AAL2_REQUIRED", async () => {
      setupServerAuthMock({ user: superAdminUser, currentLevel: "aal1", nextLevel: "aal2" });
      const req = new Request("http://localhost:3000/api/admin/action", {
        headers: { authorization: "Bearer aal1-password-only-token" },
      });

      await expect(requireAal2(req, mockPrisma)).rejects.toThrow("Forbidden: AAL2_REQUIRED");
    });

    it("requireAal2 rejects session when user has no verified factor and currentLevel is aal1", async () => {
      setupServerAuthMock({ user: superAdminUser, currentLevel: "aal1", nextLevel: "aal1" });
      const req = new Request("http://localhost:3000/api/admin/action", {
        headers: { authorization: "Bearer aal1-token" },
      });

      await expect(requireAal2(req, mockPrisma)).rejects.toThrow("Forbidden: AAL2_REQUIRED");
    });

    it("requireAal2 rejects unauthenticated or invalid session before checking assurance", async () => {
      setupServerAuthMock({ user: null, error: new Error("Invalid JWT token") });
      const req = new Request("http://localhost:3000/api/admin/action", {
        headers: { authorization: "Bearer forged-or-expired-token" },
      });

      await expect(requireAal2(req, mockPrisma)).rejects.toThrow(/Unauthorized|No cookie header provided/i);
    });

    it("requireAal2 rejects deactivated administrator even with valid AAL2 token", async () => {
      setupServerAuthMock({ user: inactiveUser, currentLevel: "aal2", nextLevel: "aal2" });
      const req = new Request("http://localhost:3000/api/admin/action", {
        headers: { authorization: "Bearer aal2-deactivated-token" },
      });

      await expect(requireAal2(req, mockPrisma)).rejects.toThrow("Forbidden: AdminProfile is deactivated");
    });

    it("requireAal2 rejects unprovisioned user even with valid AAL2 token", async () => {
      setupServerAuthMock({ user: unprovisionedUser, currentLevel: "aal2", nextLevel: "aal2" });
      const req = new Request("http://localhost:3000/api/admin/action", {
        headers: { authorization: "Bearer aal2-unprovisioned-token" },
      });

      await expect(requireAal2(req, mockPrisma)).rejects.toThrow("Forbidden: AdminProfile not found for authenticated user");
    });
  });

  // =========================================================================
  // 2. AAL2 + RBAC Invariant: AAL2 never grants permissions beyond user's role
  // =========================================================================
  describe("2. AAL2 + RBAC Invariants", () => {
    it("requireAal2Permission succeeds when user has AAL2 AND required permission", async () => {
      setupServerAuthMock({ user: superAdminUser, currentLevel: "aal2", nextLevel: "aal2" });
      const req = new Request("http://localhost:3000/api/admin/action", {
        headers: { authorization: "Bearer super-aal2-token" },
      });

      const context = await requireAal2Permission(req, AdminPermissions.ROLE_ASSIGN, mockPrisma);
      expect(context.profile.role).toBe("SUPER_ADMIN");
    });

    it("requireAal2Permission rejects user with AAL2 if role lacks required permission", async () => {
      setupServerAuthMock({ user: editorUser, currentLevel: "aal2", nextLevel: "aal2" });
      const req = new Request("http://localhost:3000/api/admin/action", {
        headers: { authorization: "Bearer editor-aal2-token" },
      });

      // EDITOR has AAL2, but lacks ROLE_ASSIGN permission
      await expect(
        requireAal2Permission(req, AdminPermissions.ROLE_ASSIGN, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "EDITOR" lacks required permission: "role:assign"');
    });

    it("requireAal2Role rejects user with AAL2 if role is not in allowedRoles", async () => {
      setupServerAuthMock({ user: adminUser, currentLevel: "aal2", nextLevel: "aal2" });
      const req = new Request("http://localhost:3000/api/admin/action", {
        headers: { authorization: "Bearer admin-aal2-token" },
      });

      await expect(
        requireAal2Role(req, ["SUPER_ADMIN"], mockPrisma)
      ).rejects.toThrow('Forbidden: Insufficient role permissions. Required: [SUPER_ADMIN], Actual: ADMIN');
    });

    it("requireAal2Role succeeds when user has AAL2 and matches allowed role", async () => {
      setupServerAuthMock({ user: superAdminUser, currentLevel: "aal2", nextLevel: "aal2" });
      const req = new Request("http://localhost:3000/api/admin/action", {
        headers: { authorization: "Bearer super-aal2-token" },
      });

      const context = await requireAal2Role(req, ["SUPER_ADMIN"], mockPrisma);
      expect(context.profile.role).toBe("SUPER_ADMIN");
    });
  });

  // =========================================================================
  // 3. Enforcement on Reviewed High-Risk Operations
  // =========================================================================
  describe("3. Reviewed High-Risk Operations Enforcement", () => {
    describe("assignAdminRoleOperation (SUPER_ADMIN only)", () => {
      it("rejects AAL1 request with Forbidden: AAL2_REQUIRED", async () => {
        setupServerAuthMock({ user: superAdminUser, currentLevel: "aal1" });
        const req = new Request("http://localhost:3000/api/admin/roles", {
          headers: { authorization: "Bearer super-aal1-token" },
        });

        await expect(
          assignAdminRoleOperation(req, { targetAdminId: adminUuid, newRole: "SUPER_ADMIN" }, mockPrisma)
        ).rejects.toThrow("Forbidden: AAL2_REQUIRED");
      });

      it("allows AAL2 request for SUPER_ADMIN", async () => {
        setupServerAuthMock({ user: superAdminUser, currentLevel: "aal2" });
        const req = new Request("http://localhost:3000/api/admin/roles", {
          headers: { authorization: "Bearer super-aal2-token" },
        });

        const res = await assignAdminRoleOperation(
          req,
          { targetAdminId: adminUuid, newRole: "SUPER_ADMIN" },
          mockPrisma
        );
        expect(res.success).toBe(true);
      });
    });

    describe("updateAdminStatusOperation (SUPER_ADMIN only)", () => {
      it("rejects AAL1 request with Forbidden: AAL2_REQUIRED", async () => {
        setupServerAuthMock({ user: superAdminUser, currentLevel: "aal1" });
        const req = new Request("http://localhost:3000/api/admin/status", {
          headers: { authorization: "Bearer super-aal1-token" },
        });

        await expect(
          updateAdminStatusOperation(req, { targetAdminId: adminUuid, isActive: false }, mockPrisma)
        ).rejects.toThrow("Forbidden: AAL2_REQUIRED");
      });

      it("allows AAL2 request for SUPER_ADMIN", async () => {
        setupServerAuthMock({ user: superAdminUser, currentLevel: "aal2" });
        const req = new Request("http://localhost:3000/api/admin/status", {
          headers: { authorization: "Bearer super-aal2-token" },
        });

        const res = await updateAdminStatusOperation(
          req,
          { targetAdminId: adminUuid, isActive: false },
          mockPrisma
        );
        expect(res.success).toBe(true);
      });
    });

    describe("updateGlobalSettingsOperation (SETTINGS_UPDATE)", () => {
      it("rejects AAL1 request with Forbidden: AAL2_REQUIRED", async () => {
        setupServerAuthMock({ user: superAdminUser, currentLevel: "aal1" });
        const req = new Request("http://localhost:3000/api/admin/settings", {
          headers: { authorization: "Bearer super-aal1-token" },
        });

        await expect(
          updateGlobalSettingsOperation(req, { settings: { siteName: "Hacked Site" } }, mockPrisma)
        ).rejects.toThrow("Forbidden: AAL2_REQUIRED");
      });

      it("returns HTTP 403 Forbidden with sanitized error when executed via executeProtectedOperation", async () => {
        setupServerAuthMock({ user: superAdminUser, currentLevel: "aal1" });
        const req = new Request("http://localhost:3000/api/admin/settings", {
          headers: { authorization: "Bearer super-aal1-token" },
        });

        const response = await executeProtectedOperation(() =>
          updateGlobalSettingsOperation(req, { settings: { siteName: "Hacked Site" } }, mockPrisma)
        );

        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.error).toBe("Forbidden: AAL2_REQUIRED");
      });

      it("allows AAL2 request for SUPER_ADMIN", async () => {
        setupServerAuthMock({ user: superAdminUser, currentLevel: "aal2" });
        const req = new Request("http://localhost:3000/api/admin/settings", {
          headers: { authorization: "Bearer super-aal2-token" },
        });

        const res = await updateGlobalSettingsOperation(
          req,
          { settings: { siteName: "CobraLearn Enterprise" } },
          mockPrisma
        );
        expect(res.siteName).toBe("CobraLearn Enterprise");
      });
    });

    describe("updateAppearanceConfigOperation (APPEARANCE_UPDATE)", () => {
      it("rejects AAL1 request with Forbidden: AAL2_REQUIRED", async () => {
        setupServerAuthMock({ user: adminUser, currentLevel: "aal1" });
        const req = new Request("http://localhost:3000/api/admin/appearance", {
          headers: { authorization: "Bearer admin-aal1-token" },
        });

        await expect(
          updateAppearanceConfigOperation(req, { appearance: { brandPrimaryColor: "#FF0000" } }, mockPrisma)
        ).rejects.toThrow("Forbidden: AAL2_REQUIRED");
      });

      it("allows AAL2 request for ADMIN", async () => {
        setupServerAuthMock({ user: adminUser, currentLevel: "aal2" });
        const req = new Request("http://localhost:3000/api/admin/appearance", {
          headers: { authorization: "Bearer admin-aal2-token" },
        });

        const res = await updateAppearanceConfigOperation(
          req,
          { appearance: { brandPrimaryColor: "#00FF87" } },
          mockPrisma
        );
        expect(res.brandPrimaryColor).toBe("#00FF87");
      });
    });

    describe("getAuditLogsOperation (AUDIT_LOG_READ)", () => {
      it("rejects AAL1 request with Forbidden: AAL2_REQUIRED", async () => {
        setupServerAuthMock({ user: adminUser, currentLevel: "aal1" });
        const req = new Request("http://localhost:3000/api/admin/audit-logs", {
          headers: { authorization: "Bearer admin-aal1-token" },
        });

        await expect(getAuditLogsOperation(req, {}, mockPrisma)).rejects.toThrow("Forbidden: AAL2_REQUIRED");
      });

      it("allows AAL2 request for ADMIN", async () => {
        setupServerAuthMock({ user: adminUser, currentLevel: "aal2" });
        const req = new Request("http://localhost:3000/api/admin/audit-logs", {
          headers: { authorization: "Bearer admin-aal2-token" },
        });

        const res = await getAuditLogsOperation(req, {}, mockPrisma);
        expect(res.logs).toHaveLength(1);
      });
    });

    describe("deleteContactInquiryOperation (CONTACT_DELETE)", () => {
      it("rejects AAL1 request with Forbidden: AAL2_REQUIRED", async () => {
        setupServerAuthMock({ user: adminUser, currentLevel: "aal1" });
        const req = new Request("http://localhost:3000/api/admin/contact/delete", {
          headers: { authorization: "Bearer admin-aal1-token" },
        });

        await expect(
          deleteContactInquiryOperation(req, { messageId: "msg-123" }, mockPrisma)
        ).rejects.toThrow("Forbidden: AAL2_REQUIRED");
      });

      it("allows AAL2 request for ADMIN", async () => {
        setupServerAuthMock({ user: adminUser, currentLevel: "aal2" });
        const req = new Request("http://localhost:3000/api/admin/contact/delete", {
          headers: { authorization: "Bearer admin-aal2-token" },
        });

        const res = await deleteContactInquiryOperation(req, { messageId: "msg-123" }, mockPrisma);
        expect(res.success).toBe(true);
      });
    });

    describe("deleteAdminProjectOperation (CMS_DELETE)", () => {
      it("rejects AAL1 request with Forbidden: AAL2_REQUIRED", async () => {
        setupServerAuthMock({ user: adminUser, currentLevel: "aal1" });
        const req = new Request("http://localhost:3000/api/admin/projects/delete", {
          headers: { authorization: "Bearer admin-aal1-token" },
        });

        await expect(
          deleteAdminProjectOperation(req, "proj-123", mockPrisma)
        ).rejects.toThrow("Forbidden: AAL2_REQUIRED");
      });

      it("allows AAL2 request for ADMIN", async () => {
        setupServerAuthMock({ user: adminUser, currentLevel: "aal2" });
        const req = new Request("http://localhost:3000/api/admin/projects/delete", {
          headers: { authorization: "Bearer admin-aal2-token" },
        });

        const res = await deleteAdminProjectOperation(req, "proj-123", mockPrisma);
        expect(res.success).toBe(true);
      });
    });

    describe("deleteAdminMediaAssetOperation (MEDIA_DELETE)", () => {
      it("rejects AAL1 request with Forbidden: AAL2_REQUIRED", async () => {
        setupServerAuthMock({ user: adminUser, currentLevel: "aal1" });
        const req = new Request("http://localhost:3000/api/admin/media/delete", {
          headers: { authorization: "Bearer admin-aal1-token" },
        });

        await expect(
          deleteAdminMediaAssetOperation(req, "media-123", mockPrisma)
        ).rejects.toThrow("Forbidden: AAL2_REQUIRED");
      });

      it("allows AAL2 request for ADMIN", async () => {
        setupServerAuthMock({ user: adminUser, currentLevel: "aal2" });
        const req = new Request("http://localhost:3000/api/admin/media/delete", {
          headers: { authorization: "Bearer admin-aal2-token" },
        });

        const mockStorage = {
          from: vi.fn().mockReturnValue({
            remove: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };

        const res = await deleteAdminMediaAssetOperation(req, "media-123", mockPrisma, mockStorage as any);
        expect(res.success).toBe(true);
      });
    });
  });

  // =========================================================================
  // 4. Non-AAL2 Operations Retain Intended Behavior
  // =========================================================================
  describe("4. Non-AAL2 Operations Retain Normal Behavior with AAL1", () => {
    it("getCurrentAdminProfileOperation succeeds with AAL1 session", async () => {
      setupServerAuthMock({ user: superAdminUser, currentLevel: "aal1" });
      const req = new Request("http://localhost:3000/api/admin/me", {
        headers: { authorization: "Bearer aal1-token" },
      });

      const context = await getCurrentAdminProfileOperation(req, mockPrisma);
      expect(context.profile.id).toBe(superAdminUuid);
      expect(context.profile.role).toBe("SUPER_ADMIN");
    });

    it("getGlobalSettingsOperation (read-only) succeeds with AAL1 session", async () => {
      setupServerAuthMock({ user: editorUser, currentLevel: "aal1" });
      const req = new Request("http://localhost:3000/api/admin/settings", {
        headers: { authorization: "Bearer aal1-token" },
      });

      const settings = await getGlobalSettingsOperation(req, mockPrisma);
      expect(settings.siteName).toBe("CobraLearn Enterprise");
    });

    it("listAdminProfilesOperation (read-only) succeeds with AAL1 session", async () => {
      setupServerAuthMock({ user: adminUser, currentLevel: "aal1" });
      const req = new Request("http://localhost:3000/api/admin/users", {
        headers: { authorization: "Bearer aal1-token" },
      });

      const result = await listAdminProfilesOperation(req, mockPrisma);
      expect(result.profiles.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 5. Security & Error Sanitization
  // =========================================================================
  describe("5. Security & Error Sanitization", () => {
    it("never exposes bearer tokens or sensitive secrets in error message", async () => {
      setupServerAuthMock({ user: superAdminUser, currentLevel: "aal1" });
      const sensitiveToken = "secret-super-sensitive-token-xyz-123456789";
      const req = new Request("http://localhost:3000/api/admin/settings", {
        headers: { authorization: `Bearer ${sensitiveToken}` },
      });

      const response = await executeProtectedOperation(() =>
        updateGlobalSettingsOperation(req, { settings: { siteName: "Test" } }, mockPrisma)
      );

      const body = await response.json();
      expect(body.error).not.toContain(sensitiveToken);
      expect(body.error).toBe("Forbidden: AAL2_REQUIRED");
    });

    it("extractAccessTokenFromRequest extracts token from Authorization header", () => {
      const req = new Request("http://localhost/api", {
        headers: { authorization: "Bearer my-secret-jwt-token" },
      });
      expect(extractAccessTokenFromRequest(req)).toBe("my-secret-jwt-token");
    });

    it("extractAccessTokenFromRequest extracts token from sb-access-token cookie", () => {
      const req = new Request("http://localhost/api", {
        headers: { cookie: "other=123; sb-access-token=cookie-jwt-token; theme=dark" },
      });
      expect(extractAccessTokenFromRequest(req)).toBe("cookie-jwt-token");
    });

    it("extractAccessTokenFromRequest returns null when no token present", () => {
      const req = new Request("http://localhost/api", {
        headers: { cookie: "theme=dark" },
      });
      expect(extractAccessTokenFromRequest(req)).toBeNull();
    });
  });
});
