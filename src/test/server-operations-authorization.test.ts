import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCurrentAdminProfileOperation,
  listAdminProfilesOperation,
  updateAdminStatusOperation,
  getGlobalSettingsOperation,
  updateGlobalSettingsOperation,
  getAuditLogsOperation,
  listContactInquiriesOperation,
  updateContactInquiryStatusOperation,
  deleteContactInquiryOperation,
  getPublicWebsiteContentOperation,
  submitPublicContactMessageOperation,
  executeProtectedOperation,
} from "@/lib/server/admin-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminProfile, AdminRole, PrismaClient, SiteSettings, ContactMessage } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Phase 7C — Server-Side Authorization Enforcement Test Suite", () => {
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

  let mockPrisma: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockPrisma = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(mockProfiles[where.id] || null);
        }),
        findMany: vi.fn().mockResolvedValue(Object.values(mockProfiles)),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const existing = mockProfiles[where.id] || { id: where.id, email: "test@example.com", role: "ADMIN" };
          return Promise.resolve({ ...existing, ...data });
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-123" }),
        findMany: vi.fn().mockResolvedValue([
          { id: "log-1", action: "INITIAL_ADMIN_PROVISIONED", module: "AUTH_PROVISIONING" },
        ]),
      },
      siteSettings: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          siteName: "CobraLearn Innotechcore",
          tagline: "Digital Showcase",
        }),
        upsert: vi.fn().mockImplementation(({ update }: any) => {
          return Promise.resolve({
            id: "default",
            siteName: update.siteName || "CobraLearn Innotechcore",
            tagline: update.tagline || "Updated Tagline",
          });
        }),
      },
      contactMessage: {
        findMany: vi.fn().mockResolvedValue([
          { id: "msg-1", fullName: "John Doe", email: "john@example.com", status: "NEW" },
        ]),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          return Promise.resolve({ id: where.id, fullName: "John Doe", email: "john@example.com", status: data.status });
        }),
        delete: vi.fn().mockResolvedValue({ id: "msg-1" }),
        create: vi.fn().mockImplementation(({ data }: any) => {
          return Promise.resolve({ id: "msg-new-999", ...data });
        }),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockPrisma);
      }),
    };
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
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentLevel: user ? "aal2" : null, nextLevel: user ? "aal2" : null },
            error: null,
          }),
        },
      },
    });
  }

  // ==========================================
  // 1. UNAUTHENTICATED REQUESTS REJECTION
  // ==========================================
  describe("1. Unauthenticated Requests Rejection", () => {
    it("Rejects unauthenticated call to getCurrentAdminProfileOperation with 401 error", async () => {
      setupAuthMock(null);
      const req = new Request("http://localhost:3000/api/admin/me", { headers: {} });

      await expect(getCurrentAdminProfileOperation(req, mockPrisma)).rejects.toThrow("No cookie header provided");
    });

    it("Rejects unauthenticated call via executeProtectedOperation HTTP adapter returning 401 status", async () => {
      setupAuthMock(null);
      const req = new Request("http://localhost:3000/api/admin/settings", { headers: {} });

      const response = await executeProtectedOperation(() =>
        getGlobalSettingsOperation(req, mockPrisma)
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("Unauthorized");
    });
  });

  // ==========================================
  // 2. UNPROVISIONED & INACTIVE ADMIN PROFILES
  // ==========================================
  describe("2. Unprovisioned & Inactive AdminProfile Rejection", () => {
    it("Rejects authenticated Supabase user who has no AdminProfile with 403 Forbidden", async () => {
      setupAuthMock(unprovisionedUser);
      const req = new Request("http://localhost:3000/api/admin/me", {
        headers: { authorization: "Bearer valid-token" },
      });

      await expect(getCurrentAdminProfileOperation(req, mockPrisma)).rejects.toThrow(
        "Forbidden: AdminProfile not found for authenticated user"
      );
    });

    it("Rejects deactivated (isActive: false) AdminProfile with 403 Forbidden", async () => {
      setupAuthMock(inactiveUser);
      const req = new Request("http://localhost:3000/api/admin/settings", {
        headers: { authorization: "Bearer valid-token" },
      });

      await expect(getGlobalSettingsOperation(req, mockPrisma)).rejects.toThrow(
        "Forbidden: AdminProfile is deactivated"
      );
    });
  });

  // ==========================================
  // 3. ROLE-BASED PERMISSION ENFORCEMENT ON PROTECTED OPERATIONS
  // ==========================================
  describe("3. Role-Based Permission Enforcement", () => {
    it("listAdminProfilesOperation: allows SUPER_ADMIN and ADMIN, but rejects EDITOR", async () => {
      // Allowed for SUPER_ADMIN
      setupAuthMock(superAdminUser);
      const superReq = new Request("http://localhost:3000/api/admin/users", {
        headers: { authorization: "Bearer super-token" },
      });
      const superResult = await listAdminProfilesOperation(superReq, mockPrisma);
      expect(superResult.profiles.length).toBeGreaterThan(0);

      // Allowed for ADMIN
      setupAuthMock(adminUser);
      const adminReq = new Request("http://localhost:3000/api/admin/users", {
        headers: { authorization: "Bearer admin-token" },
      });
      const adminResult = await listAdminProfilesOperation(adminReq, mockPrisma);
      expect(adminResult.profiles.length).toBeGreaterThan(0);

      // Forbidden for EDITOR
      setupAuthMock(editorUser);
      const editorReq = new Request("http://localhost:3000/api/admin/users", {
        headers: { authorization: "Bearer editor-token" },
      });
      await expect(listAdminProfilesOperation(editorReq, mockPrisma)).rejects.toThrow(
        'Forbidden: Role "EDITOR" lacks required permission: "admin:read"'
      );
    });

    it("updateAdminStatusOperation: allows SUPER_ADMIN, but blocks ADMIN and EDITOR", async () => {
      // Allowed for SUPER_ADMIN
      setupAuthMock(superAdminUser);
      const superReq = new Request("http://localhost:3000/api/admin/users/status", {
        headers: { authorization: "Bearer super-token" },
      });
      const result = await updateAdminStatusOperation(
        superReq,
        { targetAdminId: adminUuid, isActive: false },
        mockPrisma
      );
      expect(result.success).toBe(true);
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: superAdminUuid,
            action: "ADMIN_DEACTIVATED",
          }),
        })
      );

      // Forbidden for ADMIN
      setupAuthMock(adminUser);
      const adminReq = new Request("http://localhost:3000/api/admin/users/status", {
        headers: { authorization: "Bearer admin-token" },
      });
      await expect(
        updateAdminStatusOperation(adminReq, { targetAdminId: editorUuid, isActive: false }, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "ADMIN" lacks required permission: "admin:manage"');
    });

    it("updateGlobalSettingsOperation: allows SUPER_ADMIN, but blocks ADMIN and EDITOR", async () => {
      // Allowed for SUPER_ADMIN
      setupAuthMock(superAdminUser);
      const superReq = new Request("http://localhost:3000/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });
      const updated = await updateGlobalSettingsOperation(
        superReq,
        { settings: { siteName: "CobraLearn Enterprise" } },
        mockPrisma
      );
      expect(updated.siteName).toBe("CobraLearn Enterprise");
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: superAdminUuid,
            action: "SETTINGS_UPDATED",
          }),
        })
      );

      // Forbidden for ADMIN
      setupAuthMock(adminUser);
      const adminReq = new Request("http://localhost:3000/api/admin/settings", {
        headers: { authorization: "Bearer admin-token" },
      });
      await expect(
        updateGlobalSettingsOperation(adminReq, { settings: { siteName: "Tampered" } }, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "ADMIN" lacks required permission: "settings:update"');
    });

    it("deleteContactInquiryOperation: allows ADMIN, but blocks EDITOR", async () => {
      // Allowed for ADMIN
      setupAuthMock(adminUser);
      const adminReq = new Request("http://localhost:3000/api/admin/contact/1", {
        headers: { authorization: "Bearer admin-token" },
      });
      const delResult = await deleteContactInquiryOperation(adminReq, { messageId: "msg-1" }, mockPrisma);
      expect(delResult.success).toBe(true);

      // Forbidden for EDITOR
      setupAuthMock(editorUser);
      const editorReq = new Request("http://localhost:3000/api/admin/contact/1", {
        headers: { authorization: "Bearer editor-token" },
      });
      await expect(
        deleteContactInquiryOperation(editorReq, { messageId: "msg-1" }, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "EDITOR" lacks required permission: "contact:delete"');
    });
  });

  // ==========================================
  // 4. IDENTITY & SPOOFING RESISTANCE
  // ==========================================
  describe("4. Identity & Spoofing Resistance", () => {
    it("Strictly derives actor identity in audit logs from verified session, ignoring spoofed request fields", async () => {
      setupAuthMock(superAdminUser);
      const req = new Request("http://localhost:3000/api/admin/users/status", {
        method: "POST",
        headers: {
          authorization: "Bearer super-token",
          "x-actor-id": "fake-actor-id",
          "x-actor-email": "fake-actor@evil.com",
        },
      });

      await updateAdminStatusOperation(
        req,
        { targetAdminId: editorUuid, isActive: true },
        mockPrisma
      );

      // The audit log MUST record the verified session identity (superAdminUuid), NEVER the spoofed header
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: superAdminUuid,
            actorEmail: "superadmin@cobralearn.com",
            action: "ADMIN_ACTIVATED",
            module: "ADMIN_GOVERNANCE",
            entityId: editorUuid,
            metadata: expect.objectContaining({
              targetEmail: "editor@cobralearn.com",
              changedTo: true,
            }),
          }),
        })
      );
    });
  });

  // ==========================================
  // 5. PUBLIC WEBSITE OPERATIONS SEPARATION
  // ==========================================
  describe("5. Public Operations Separation", () => {
    it("Public website content read succeeds with NO authentication headers", async () => {
      const result = await getPublicWebsiteContentOperation(mockPrisma);
      expect(result.isPublic).toBe(true);
      expect(result.siteName).toBe("CobraLearn Innotechcore");
    });

    it("Public contact form submission succeeds with NO authentication headers", async () => {
      const result = await submitPublicContactMessageOperation(
        {
          fullName: "Public Visitor",
          email: "visitor@example.com",
          subject: "Project Inquiry",
          message: "We would like to hire your team.",
        },
        mockPrisma
      );

      expect(result.success).toBe(true);
      expect(result.id).toBe("msg-new-999");
      expect(mockPrisma.contactMessage.create).toHaveBeenCalledWith({
        data: {
          fullName: "Public Visitor",
          email: "visitor@example.com",
          subject: "Project Inquiry",
          message: "We would like to hire your team.",
          status: "NEW",
        },
      });
    });
  });
});
