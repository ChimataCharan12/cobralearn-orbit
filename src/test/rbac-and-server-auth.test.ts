import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminPermissions, canPerform, getRolePermissions, type AdminPermission } from "@/lib/auth/rbac";
import {
  requireAuthenticatedUser,
  requireAdminProfile,
  requireRole,
  requirePermission,
} from "@/lib/auth/server-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminProfile, AdminRole, PrismaClient } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Phase 7B — Centralized RBAC Foundation & Server-Side Authorization", () => {
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

  const profiles: Record<string, AdminProfile> = {
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
      fullName: "Deactivated Admin",
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

  let mockPrisma: PrismaClient;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockPrisma = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(profiles[where.id] || null);
        }),
      },
    } as unknown as PrismaClient;
  });

  function setupAuthMock(user: User | null, error: Error | null = null) {
    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: user ? { user, access_token: "mock-token" } : null },
          error,
        }),
      },
    });
  }

  // ==========================================
  // SECTION 1: Pure RBAC Permission Matrix Tests
  // ==========================================
  describe("1. Pure RBAC Permission Evaluator (canPerform & getRolePermissions)", () => {
    const allPermissions = Object.values(AdminPermissions);

    it("SUPER_ADMIN possesses all permissions without exception", () => {
      for (const perm of allPermissions) {
        expect(canPerform("SUPER_ADMIN", perm)).toBe(true);
      }
      const granted = getRolePermissions("SUPER_ADMIN");
      expect(granted.length).toBe(allPermissions.length);
      expect(granted).toEqual(expect.arrayContaining(allPermissions));
    });

    it("ADMIN possesses content, media, contact, appearance, audit logs, but NOT admin management or settings modification", () => {
      // Allowed for ADMIN
      expect(canPerform("ADMIN", AdminPermissions.CMS_CREATE)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.CMS_READ)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.CMS_UPDATE)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.CMS_DELETE)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.MEDIA_UPLOAD)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.MEDIA_READ)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.MEDIA_UPDATE)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.MEDIA_DELETE)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.CONTACT_READ)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.CONTACT_UPDATE)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.CONTACT_DELETE)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.SETTINGS_READ)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.APPEARANCE_READ)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.APPEARANCE_UPDATE)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.ADMIN_READ)).toBe(true);
      expect(canPerform("ADMIN", AdminPermissions.AUDIT_LOG_READ)).toBe(true);

      // Forbidden for ADMIN
      expect(canPerform("ADMIN", AdminPermissions.ADMIN_MANAGE)).toBe(false);
      expect(canPerform("ADMIN", AdminPermissions.ROLE_ASSIGN)).toBe(false);
      expect(canPerform("ADMIN", AdminPermissions.SETTINGS_UPDATE)).toBe(false);
    });

    it("EDITOR possesses CMS create/read/update and Media upload/read/update, but CANNOT delete or access governance/audit", () => {
      // Allowed for EDITOR
      expect(canPerform("EDITOR", AdminPermissions.CMS_CREATE)).toBe(true);
      expect(canPerform("EDITOR", AdminPermissions.CMS_READ)).toBe(true);
      expect(canPerform("EDITOR", AdminPermissions.CMS_UPDATE)).toBe(true);
      expect(canPerform("EDITOR", AdminPermissions.MEDIA_UPLOAD)).toBe(true);
      expect(canPerform("EDITOR", AdminPermissions.MEDIA_READ)).toBe(true);
      expect(canPerform("EDITOR", AdminPermissions.MEDIA_UPDATE)).toBe(true);
      expect(canPerform("EDITOR", AdminPermissions.CONTACT_READ)).toBe(true);
      expect(canPerform("EDITOR", AdminPermissions.SETTINGS_READ)).toBe(true);
      expect(canPerform("EDITOR", AdminPermissions.APPEARANCE_READ)).toBe(true);

      // Forbidden for EDITOR
      expect(canPerform("EDITOR", AdminPermissions.CMS_DELETE)).toBe(false);
      expect(canPerform("EDITOR", AdminPermissions.MEDIA_DELETE)).toBe(false);
      expect(canPerform("EDITOR", AdminPermissions.CONTACT_UPDATE)).toBe(false);
      expect(canPerform("EDITOR", AdminPermissions.CONTACT_DELETE)).toBe(false);
      expect(canPerform("EDITOR", AdminPermissions.SETTINGS_UPDATE)).toBe(false);
      expect(canPerform("EDITOR", AdminPermissions.APPEARANCE_UPDATE)).toBe(false);
      expect(canPerform("EDITOR", AdminPermissions.ADMIN_READ)).toBe(false);
      expect(canPerform("EDITOR", AdminPermissions.ADMIN_MANAGE)).toBe(false);
      expect(canPerform("EDITOR", AdminPermissions.ROLE_ASSIGN)).toBe(false);
      expect(canPerform("EDITOR", AdminPermissions.AUDIT_LOG_READ)).toBe(false);
    });

    it("Fails closed (returns false / empty array) for unknown or invalid roles", () => {
      expect(canPerform("GUEST" as any, AdminPermissions.CMS_READ)).toBe(false);
      expect(canPerform("" as any, AdminPermissions.CMS_READ)).toBe(false);
      expect(getRolePermissions("UNKNOWN" as any)).toEqual([]);
    });
  });

  // ==========================================
  // SECTION 2: Server-side Identity & Profile Resolution
  // ==========================================
  describe("2. Server-side requireAdminProfile Resolution", () => {
    it("Resolves valid active SUPER_ADMIN profile with canonical Supabase User identity", async () => {
      setupAuthMock(superAdminUser);
      const req = new Request("http://localhost:3000/api/admin/metrics", {
        headers: { cookie: "sb-access-token=mock-token" },
      });

      const context = await requireAdminProfile(req, mockPrisma);
      expect(context.user.id).toBe(superAdminUuid);
      expect(context.profile.id).toBe(superAdminUuid);
      expect(context.profile.role).toBe("SUPER_ADMIN");
      expect(context.profile.isActive).toBe(true);
    });

    it("Resolves valid active ADMIN and EDITOR profiles", async () => {
      setupAuthMock(adminUser);
      const adminReq = new Request("http://localhost:3000/api/admin/metrics", {
        headers: { authorization: "Bearer valid-admin-token" },
      });

      const adminContext = await requireAdminProfile(adminReq, mockPrisma);
      expect(adminContext.profile.role).toBe("ADMIN");
      expect(adminContext.profile.isActive).toBe(true);

      setupAuthMock(editorUser);
      const editorReq = new Request("http://localhost:3000/api/admin/metrics", {
        headers: { authorization: "Bearer valid-editor-token" },
      });

      const editorContext = await requireAdminProfile(editorReq, mockPrisma);
      expect(editorContext.profile.role).toBe("EDITOR");
      expect(editorContext.profile.isActive).toBe(true);
    });

    it("Rejects unauthenticated request (missing cookies/headers) with Unauthorized error", async () => {
      setupAuthMock(null);
      const req = new Request("http://localhost:3000/api/admin/metrics", {
        headers: {},
      });

      await expect(requireAdminProfile(req, mockPrisma)).rejects.toThrow("No cookie header provided");
    });

    it("Rejects expired or invalid session token", async () => {
      setupAuthMock(null, new Error("JWT expired"));
      const req = new Request("http://localhost:3000/api/admin/metrics", {
        headers: { authorization: "Bearer expired-token" },
      });

      await expect(requireAdminProfile(req, mockPrisma)).rejects.toThrow();
    });

    it("Fails closed when authenticated Supabase user has no matching AdminProfile", async () => {
      setupAuthMock(unprovisionedUser);
      const req = new Request("http://localhost:3000/api/admin/metrics", {
        headers: { authorization: "Bearer valid-unprovisioned-token" },
      });

      await expect(requireAdminProfile(req, mockPrisma)).rejects.toThrow(
        "Forbidden: AdminProfile not found for authenticated user"
      );
    });

    it("Fails closed when AdminProfile exists but isActive is false", async () => {
      setupAuthMock(inactiveUser);
      const req = new Request("http://localhost:3000/api/admin/metrics", {
        headers: { authorization: "Bearer valid-inactive-token" },
      });

      await expect(requireAdminProfile(req, mockPrisma)).rejects.toThrow(
        "Forbidden: AdminProfile is deactivated"
      );
    });

    it("Fails closed if Prisma database query throws an error", async () => {
      setupAuthMock(superAdminUser);
      const failingPrisma = {
        adminProfile: {
          findUnique: vi.fn().mockRejectedValue(new Error("Database connection failure")),
        },
      } as unknown as PrismaClient;

      const req = new Request("http://localhost:3000/api/admin/metrics", {
        headers: { authorization: "Bearer token" },
      });

      await expect(requireAdminProfile(req, failingPrisma)).rejects.toThrow("Database connection failure");
    });
  });

  // ==========================================
  // SECTION 3: Server-side Authorization Helpers (requireRole & requirePermission)
  // ==========================================
  describe("3. Server-side requireRole and requirePermission Helpers", () => {
    it("requireRole succeeds when user's role is in allowedRoles list", async () => {
      setupAuthMock(adminUser);
      const req = new Request("http://localhost:3000/api/admin/content", {
        headers: { authorization: "Bearer admin-token" },
      });

      const ctx = await requireRole(req, ["ADMIN", "SUPER_ADMIN"], mockPrisma);
      expect(ctx.profile.role).toBe("ADMIN");
    });

    it("requireRole throws Forbidden when user's role is not in allowedRoles list", async () => {
      setupAuthMock(editorUser);
      const req = new Request("http://localhost:3000/api/admin/users", {
        headers: { authorization: "Bearer editor-token" },
      });

      await expect(requireRole(req, ["SUPER_ADMIN"], mockPrisma)).rejects.toThrow(
        'Forbidden: Insufficient role permissions. Required: [SUPER_ADMIN], Actual: EDITOR'
      );
    });

    it("requirePermission allows SUPER_ADMIN to execute ADMIN_MANAGE", async () => {
      setupAuthMock(superAdminUser);
      const req = new Request("http://localhost:3000/api/admin/users", {
        headers: { authorization: "Bearer super-token" },
      });

      const ctx = await requirePermission(req, AdminPermissions.ADMIN_MANAGE, mockPrisma);
      expect(ctx.profile.role).toBe("SUPER_ADMIN");
    });

    it("requirePermission blocks ADMIN from executing ADMIN_MANAGE or SETTINGS_UPDATE", async () => {
      setupAuthMock(adminUser);
      const req = new Request("http://localhost:3000/api/admin/users", {
        headers: { authorization: "Bearer admin-token" },
      });

      await expect(
        requirePermission(req, AdminPermissions.ADMIN_MANAGE, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "ADMIN" lacks required permission: "admin:manage"');

      await expect(
        requirePermission(req, AdminPermissions.SETTINGS_UPDATE, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "ADMIN" lacks required permission: "settings:update"');
    });

    it("requirePermission allows ADMIN to execute CMS_DELETE, but blocks EDITOR from CMS_DELETE", async () => {
      setupAuthMock(adminUser);
      const adminReq = new Request("http://localhost:3000/api/admin/content", {
        headers: { authorization: "Bearer admin-token" },
      });

      const adminCtx = await requirePermission(adminReq, AdminPermissions.CMS_DELETE, mockPrisma);
      expect(adminCtx.profile.role).toBe("ADMIN");

      setupAuthMock(editorUser);
      const editorReq = new Request("http://localhost:3000/api/admin/content", {
        headers: { authorization: "Bearer editor-token" },
      });

      await expect(
        requirePermission(editorReq, AdminPermissions.CMS_DELETE, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "EDITOR" lacks required permission: "cms:delete"');
    });
  });

  // ==========================================
  // SECTION 4: Anti-Spoofing & Canonical Identity Derivation
  // ==========================================
  describe("4. Identity & Role Spoofing Resistance", () => {
    it("Ignores client-supplied x-user-id and derives UUID strictly from verified Supabase token", async () => {
      setupAuthMock(editorUser); // Verified JWT is EDITOR
      const req = new Request("http://localhost:3000/api/admin/manage-admins", {
        headers: {
          authorization: "Bearer editor-token",
          "x-user-id": superAdminUuid, // Spoofing attempt
          "x-user-role": "SUPER_ADMIN", // Spoofing attempt
        },
      });

      // Attempting to perform ADMIN_MANAGE should fail based on the verified JWT identity (editorUser)
      await expect(
        requirePermission(req, AdminPermissions.ADMIN_MANAGE, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "EDITOR" lacks required permission: "admin:manage"');

      // Verify Prisma was queried using the verified JWT's user.id (editorUuid), not the spoofed x-user-id
      expect(mockPrisma.adminProfile.findUnique).toHaveBeenCalledWith({
        where: { id: editorUuid },
      });
      expect(mockPrisma.adminProfile.findUnique).not.toHaveBeenCalledWith({
        where: { id: superAdminUuid },
      });
    });

    it("Ignores client-supplied request body UUID or role tampering during server authorization", async () => {
      setupAuthMock(adminUser);
      const req = new Request("http://localhost:3000/api/admin/settings", {
        method: "POST",
        headers: {
          authorization: "Bearer admin-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: superAdminUuid,
          role: "SUPER_ADMIN",
          settings: { siteName: "Hacked" },
        }),
      });

      // Attempting SETTINGS_UPDATE must evaluate based on adminUser's actual Prisma profile (ADMIN)
      await expect(
        requirePermission(req, AdminPermissions.SETTINGS_UPDATE, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "ADMIN" lacks required permission: "settings:update"');
    });
  });
});
