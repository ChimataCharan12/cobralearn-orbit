import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCurrentAdminProfileOperation,
  updateSelfProfileOperation,
  listAdminProfilesOperation,
  updateAdminStatusOperation,
  assignAdminRoleOperation,
} from "@/lib/server/admin-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminProfile, AdminRole, PrismaClient } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Phase 7D — Admin Profile Management & Audit Logging Test Suite", () => {
  const superAdmin1Uuid = "11111111-1111-4111-8111-111111111111";
  const superAdmin2Uuid = "22222222-2222-4222-8222-222222222222";
  const adminUuid = "33333333-3333-4333-8333-333333333333";
  const editorUuid = "44444444-4444-4444-8444-444444444444";

  const superAdminUser1: User = {
    id: superAdmin1Uuid,
    email: "super1@cobralearn.com",
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

  let mockProfiles: Record<string, AdminProfile>;
  let auditLogsCreated: any[];
  let mockPrisma: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    auditLogsCreated = [];

    mockProfiles = {
      [superAdmin1Uuid]: {
        id: superAdmin1Uuid,
        email: "super1@cobralearn.com",
        fullName: "Super Admin One",
        role: "SUPER_ADMIN" as AdminRole,
        isActive: true,
        phone: "+91 98765 00001",
        designation: "Chief Technology Officer",
        bio: "Lead Architect",
        avatarUrl: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [superAdmin2Uuid]: {
        id: superAdmin2Uuid,
        email: "super2@cobralearn.com",
        fullName: "Super Admin Two",
        role: "SUPER_ADMIN" as AdminRole,
        isActive: true,
        phone: "+91 98765 00002",
        designation: "Managing Director",
        bio: "Executive Overseer",
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
        phone: "+91 98765 00003",
        designation: "Operations Manager",
        bio: "Site Coordinator",
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
        phone: "+91 98765 00004",
        designation: "Staff Editor",
        bio: "Content Specialist",
        avatarUrl: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const prismaMockHandler = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(mockProfiles[where.id] ? { ...mockProfiles[where.id] } : null);
        }),
        findMany: vi.fn().mockImplementation(({ where }: any = {}) => {
          let list = Object.values(mockProfiles);
          if (where?.role) {
            list = list.filter((p) => p.role === where.role);
          }
          if (where?.isActive !== undefined) {
            list = list.filter((p) => p.isActive === where.isActive);
          }
          return Promise.resolve(list.map((p) => ({ ...p })));
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          if (!mockProfiles[where.id]) throw new Error("Record to update not found.");
          mockProfiles[where.id] = { ...mockProfiles[where.id], ...data };
          return Promise.resolve({ ...mockProfiles[where.id] });
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          const log = { id: `log-${Date.now()}`, ...data, createdAt: new Date() };
          auditLogsCreated.push(log);
          return Promise.resolve(log);
        }),
      },
    };

    mockPrisma = {
      ...prismaMockHandler,
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(prismaMockHandler);
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
      },
    });
  }

  // ==========================================
  // 1. SELF-PROFILE UPDATES & FORBIDDEN FIELDS
  // ==========================================
  describe("1. Self-Service Profile Updates & Forbidden Fields", () => {
    it("Allows authenticated administrator to update permitted self-service fields", async () => {
      setupAuthMock(adminUser);
      const req = new Request("http://localhost:3000/api/admin/profile", {
        headers: { authorization: "Bearer admin-token" },
      });

      const { profile } = await updateSelfProfileOperation(
        req,
        {
          fullName: "Operations Admin Senior",
          phone: "+91 99999 88888",
          designation: "Senior Lead Operations",
          bio: "Updated coordinator bio",
          avatarUrl: "https://example.com/avatar.png",
        },
        mockPrisma
      );

      expect(profile.fullName).toBe("Operations Admin Senior");
      expect(profile.phone).toBe("+91 99999 88888");
      expect(profile.designation).toBe("Senior Lead Operations");
      expect(profile.bio).toBe("Updated coordinator bio");
      expect(profile.avatarUrl).toBe("https://example.com/avatar.png");

      // Verify audit log
      expect(auditLogsCreated.some((l) => l.action === "SELF_PROFILE_UPDATED" && l.actorId === adminUuid)).toBe(true);
    });

    it("Rejects self-service attempts to modify forbidden fields (id, email, role, isActive)", async () => {
      setupAuthMock(editorUser);
      const req = new Request("http://localhost:3000/api/admin/profile", {
        headers: { authorization: "Bearer editor-token" },
      });

      // Tampering with role (privilege escalation attempt)
      await expect(
        updateSelfProfileOperation(req, { role: "SUPER_ADMIN" }, mockPrisma)
      ).rejects.toThrow("Forbidden: Cannot self-assign or elevate administrative role");

      // Tampering with email
      await expect(
        updateSelfProfileOperation(req, { email: "attacker@evil.com" }, mockPrisma)
      ).rejects.toThrow("Forbidden: Email modification requires verified email change flow");

      // Tampering with ID
      await expect(
        updateSelfProfileOperation(req, { id: superAdmin1Uuid }, mockPrisma)
      ).rejects.toThrow("Forbidden: Cannot modify account ID");

      // Tampering with active status
      await expect(
        updateSelfProfileOperation(req, { isActive: false }, mockPrisma)
      ).rejects.toThrow("Forbidden: Cannot self-modify active account status");
    });
  });

  // ==========================================
  // 2. UNAUTHORIZED ADMINISTRATOR LISTING
  // ==========================================
  describe("2. Administrator Listing Authorization", () => {
    it("Allows SUPER_ADMIN and ADMIN to list administrators, but rejects EDITOR", async () => {
      // Allowed for SUPER_ADMIN
      setupAuthMock(superAdminUser1);
      const superReq = new Request("http://localhost:3000/api/admin/users", {
        headers: { authorization: "Bearer super-token" },
      });
      const superRes = await listAdminProfilesOperation(superReq, mockPrisma);
      expect(superRes.profiles.length).toBe(4);

      // Forbidden for EDITOR
      setupAuthMock(editorUser);
      const editorReq = new Request("http://localhost:3000/api/admin/users", {
        headers: { authorization: "Bearer editor-token" },
      });
      await expect(listAdminProfilesOperation(editorReq, mockPrisma)).rejects.toThrow(
        'Forbidden: Role "EDITOR" lacks required permission: "admin:read"'
      );
    });
  });

  // ==========================================
  // 3. ROLE ASSIGNMENT & PRIVILEGE ESCALATION SAFEGUARDS
  // ==========================================
  describe("3. Role Assignment & Privilege Escalation Safeguards", () => {
    it("SUPER_ADMIN can assign valid roles to other administrators", async () => {
      setupAuthMock(superAdminUser1);
      const req = new Request("http://localhost:3000/api/admin/users/role", {
        headers: { authorization: "Bearer super-token" },
      });

      const result = await assignAdminRoleOperation(
        req,
        { targetAdminId: editorUuid, newRole: "ADMIN" },
        mockPrisma
      );

      expect(result.success).toBe(true);
      expect(result.newRole).toBe("ADMIN");
      expect(
        auditLogsCreated.some(
          (l) =>
            l.action === "ADMIN_ROLE_ASSIGNED" &&
            l.actorId === superAdmin1Uuid &&
            l.metadata.newRole === "ADMIN"
        )
      ).toBe(true);
    });

    it("Rejects non-SUPER_ADMIN (ADMIN or EDITOR) from attempting to assign roles", async () => {
      setupAuthMock(adminUser);
      const req = new Request("http://localhost:3000/api/admin/users/role", {
        headers: { authorization: "Bearer admin-token" },
      });

      await expect(
        assignAdminRoleOperation(req, { targetAdminId: editorUuid, newRole: "SUPER_ADMIN" }, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "ADMIN" lacks required permission: "role:assign"');
    });

    it("Rejects invalid or unrecognized role strings", async () => {
      setupAuthMock(superAdminUser1);
      const req = new Request("http://localhost:3000/api/admin/users/role", {
        headers: { authorization: "Bearer super-token" },
      });

      await expect(
        assignAdminRoleOperation(req, { targetAdminId: editorUuid, newRole: "ROOT_SUPERUSER" as any }, mockPrisma)
      ).rejects.toThrow("Forbidden: Invalid role assignment parameters");
    });
  });

  // ==========================================
  // 4. FINAL ACTIVE SUPER ADMIN PROTECTION (DEACTIVATION & DEMOTION)
  // ==========================================
  describe("4. Final Active Super Admin Protection", () => {
    it("Succeeds when deactivating one Super Admin if another active Super Admin exists", async () => {
      // Initially we have superAdmin1 and superAdmin2 active (count = 2)
      setupAuthMock(superAdminUser1);
      const req = new Request("http://localhost:3000/api/admin/users/status", {
        headers: { authorization: "Bearer super-token" },
      });

      const result = await updateAdminStatusOperation(
        req,
        { targetAdminId: superAdmin2Uuid, isActive: false },
        mockPrisma
      );

      expect(result.success).toBe(true);
      expect(result.isActive).toBe(false);
    });

    it("Blocks deactivating the final active Super Admin", async () => {
      // Leave only superAdmin1 active
      delete mockProfiles[superAdmin2Uuid];

      setupAuthMock(superAdminUser1);
      const req = new Request("http://localhost:3000/api/admin/users/status", {
        headers: { authorization: "Bearer super-token" },
      });

      await expect(
        updateAdminStatusOperation(req, { targetAdminId: superAdmin1Uuid, isActive: false }, mockPrisma)
      ).rejects.toThrow("Forbidden: Cannot deactivate the sole active Super Admin");
    });

    it("Blocks demoting the final active Super Admin to ADMIN or EDITOR", async () => {
      // Leave only superAdmin1 active
      delete mockProfiles[superAdmin2Uuid];

      setupAuthMock(superAdminUser1);
      const req = new Request("http://localhost:3000/api/admin/users/role", {
        headers: { authorization: "Bearer super-token" },
      });

      await expect(
        assignAdminRoleOperation(req, { targetAdminId: superAdmin1Uuid, newRole: "ADMIN" }, mockPrisma)
      ).rejects.toThrow("Forbidden: Cannot demote the sole active Super Admin");
    });
  });

  // ==========================================
  // 5. AUDIT LOGGING & TRANSACTIONAL INTEGRITY
  // ==========================================
  describe("5. Audit Logging & Transactional Integrity", () => {
    it("Rolls back the mutation and does not claim success if transaction fails", async () => {
      setupAuthMock(superAdminUser1);
      const req = new Request("http://localhost:3000/api/admin/users/role", {
        headers: { authorization: "Bearer super-token" },
      });

      const failingPrisma = {
        adminProfile: mockPrisma.adminProfile,
        adminAuditLog: mockPrisma.adminAuditLog,
        $transaction: vi.fn().mockRejectedValue(new Error("Database transaction lock timeout")),
      } as unknown as PrismaClient;

      await expect(
        assignAdminRoleOperation(req, { targetAdminId: editorUuid, newRole: "ADMIN" }, failingPrisma)
      ).rejects.toThrow("Database transaction lock timeout");
    });

    it("Ignores client-supplied spoofed headers and records verified session actor in audit logs", async () => {
      setupAuthMock(superAdminUser1);
      const req = new Request("http://localhost:3000/api/admin/users/status", {
        method: "POST",
        headers: {
          authorization: "Bearer super-token",
          "x-actor-id": "spoofed-hacker-id",
          "x-actor-email": "hacker@anonymous.com",
        },
      });

      await updateAdminStatusOperation(
        req,
        { targetAdminId: adminUuid, isActive: false },
        mockPrisma
      );

      const auditEntry = auditLogsCreated.find((l) => l.action === "ADMIN_DEACTIVATED");
      expect(auditEntry).toBeDefined();
      expect(auditEntry.actorId).toBe(superAdmin1Uuid); // Must match verified session!
      expect(auditEntry.actorEmail).toBe("super1@cobralearn.com");
    });
  });
});
