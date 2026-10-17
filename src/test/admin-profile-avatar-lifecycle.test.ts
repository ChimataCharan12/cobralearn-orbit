import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient, AdminProfile } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  uploadAvatarOperation,
  updateSelfProfileOperation,
  extractAvatarStoragePath,
  safelyCleanupPreviousAvatar,
} from "@/lib/server/admin-operations";
import { DEFAULT_MEDIA_BUCKET } from "@/lib/server/media-operations";

// Valid 1x1 PNG base64 for upload testing
const VALID_1X1_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const admin1Id = "11111111-1111-4111-8111-111111111111";
const admin2Id = "22222222-2222-4222-8222-222222222222";

let currentAdminContext = {
  user: { id: admin1Id, email: "admin1@cobralearn.com" },
  profile: {
    id: admin1Id,
    email: "admin1@cobralearn.com",
    fullName: "Admin One",
    role: "ADMIN" as any,
    isActive: true,
    avatarUrl: null as string | null,
    phone: null,
    designation: "Administrator",
    bio: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

vi.mock("@/lib/auth/server-auth", () => ({
  requireAdminProfile: vi.fn().mockImplementation(async () => currentAdminContext),
  requirePermission: vi.fn().mockImplementation(async () => currentAdminContext),
  requireAal2: vi.fn().mockImplementation(async () => currentAdminContext),
}));

describe("Phase 1: Admin Avatar Lifecycle & Storage Cleanup Suite", () => {
  let mockStorageRemove: ReturnType<typeof vi.fn>;
  let mockStorageUpload: ReturnType<typeof vi.fn>;
  let mockStorageGetPublicUrl: ReturnType<typeof vi.fn>;
  let mockStorageClient: SupabaseClient;

  let mockProfileInDb: AdminProfile;
  let mockAuditLogs: any[];
  let mockPrisma: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockStorageRemove = vi.fn().mockResolvedValue({ data: [{ name: "removed" }], error: null });
    mockStorageUpload = vi.fn().mockResolvedValue({ data: { path: "new-path" }, error: null });
    mockStorageGetPublicUrl = vi.fn().mockImplementation((path: string) => ({
      data: {
        publicUrl: `https://test-project.supabase.co/storage/v1/object/public/media-library/${path}`,
      },
    }));

    mockStorageClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockStorageUpload,
          remove: mockStorageRemove,
          getPublicUrl: mockStorageGetPublicUrl,
        }),
      },
    } as unknown as SupabaseClient;

    mockProfileInDb = {
      id: admin1Id,
      email: "admin1@cobralearn.com",
      fullName: "Admin One",
      role: "ADMIN" as any,
      isActive: true,
      avatarUrl: `https://test-project.supabase.co/storage/v1/object/public/media-library/avatars/${admin1Id}/old-avatar-123.png`,
      phone: "+91 99999 11111",
      designation: "Administrator",
      bio: "Active system admin",
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    currentAdminContext.profile = { ...mockProfileInDb };
    mockAuditLogs = [];

    const dbHandler = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === admin1Id) {
            return Promise.resolve({ ...mockProfileInDb });
          }
          return Promise.resolve(null);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          if (where.id === admin1Id) {
            mockProfileInDb = { ...mockProfileInDb, ...data };
            currentAdminContext.profile = { ...mockProfileInDb };
            return Promise.resolve({ ...mockProfileInDb });
          }
          throw new Error("Profile not found");
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          const log = { id: `log-${Date.now()}`, ...data, createdAt: new Date() };
          mockAuditLogs.push(log);
          return Promise.resolve(log);
        }),
      },
    };

    mockPrisma = {
      ...dbHandler,
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(dbHandler);
      }),
    };
  });

  // =========================================================================
  // 1. extractAvatarStoragePath Security & Path Isolation
  // =========================================================================
  describe("1. extractAvatarStoragePath Security & Isolation", () => {
    it("safely extracts valid Supabase storage URLs for the authenticated administrator", () => {
      const url = `https://my-ref.supabase.co/storage/v1/object/public/media-library/avatars/${admin1Id}/1728000000-abcdef123456.png`;
      const path = extractAvatarStoragePath(url, admin1Id);
      expect(path).toBe(`avatars/${admin1Id}/1728000000-abcdef123456.png`);
    });

    it("safely extracts short/test URLs containing avatars/{adminId}/", () => {
      const url = `https://storage.supabase.co/avatars/${admin1Id}/test-image.png`;
      const path = extractAvatarStoragePath(url, admin1Id);
      expect(path).toBe(`avatars/${admin1Id}/test-image.png`);
    });

    it("safely extracts relative paths inside bucket", () => {
      const url = `avatars/${admin1Id}/photo.webp`;
      const path = extractAvatarStoragePath(url, admin1Id);
      expect(path).toBe(`avatars/${admin1Id}/photo.webp`);
    });

    it("rejects avatar objects belonging to a different administrator", () => {
      const foreignUrl = `https://my-ref.supabase.co/storage/v1/object/public/media-library/avatars/${admin2Id}/avatar.png`;
      const path = extractAvatarStoragePath(foreignUrl, admin1Id);
      expect(path).toBeNull();
    });

    it("strictly rejects path traversal attempts (.. and URL encoded)", () => {
      const traversal1 = `https://my-ref.supabase.co/storage/v1/object/public/media-library/avatars/${admin1Id}/../${admin2Id}/target.png`;
      expect(extractAvatarStoragePath(traversal1, admin1Id)).toBeNull();

      const traversal2 = `avatars/${admin1Id}/%2e%2e/%2e%2e/etc/passwd`;
      expect(extractAvatarStoragePath(traversal2, admin1Id)).toBeNull();

      const traversal3 = `avatars/${admin1Id}/..\\windows\\system32`;
      expect(extractAvatarStoragePath(traversal3, admin1Id)).toBeNull();
    });

    it("rejects non-storage external URLs and third-party avatars", () => {
      expect(extractAvatarStoragePath("https://lh3.googleusercontent.com/a/random", admin1Id)).toBeNull();
      expect(extractAvatarStoragePath("https://avatars.githubusercontent.com/u/123", admin1Id)).toBeNull();
      expect(extractAvatarStoragePath("https://example.com/avatar.png", admin1Id)).toBeNull();
    });

    it("rejects objects stored in a non-media-library bucket", () => {
      const wrongBucketUrl = `https://my-ref.supabase.co/storage/v1/object/public/private-vault/avatars/${admin1Id}/file.png`;
      expect(extractAvatarStoragePath(wrongBucketUrl, admin1Id, DEFAULT_MEDIA_BUCKET)).toBeNull();
    });

    it("rejects subdirectories deeper than avatars/{adminId}/<filename>", () => {
      const nestedUrl = `avatars/${admin1Id}/nested/folder/avatar.png`;
      expect(extractAvatarStoragePath(nestedUrl, admin1Id)).toBeNull();
    });

    it("rejects invalid, empty, or malicious characters in filename", () => {
      expect(extractAvatarStoragePath(`avatars/${admin1Id}/;rm -rf;`, admin1Id)).toBeNull();
      expect(extractAvatarStoragePath(`avatars/${admin1Id}/`, admin1Id)).toBeNull();
      expect(extractAvatarStoragePath(null, admin1Id)).toBeNull();
      expect(extractAvatarStoragePath(undefined, admin1Id)).toBeNull();
      expect(extractAvatarStoragePath("", admin1Id)).toBeNull();
    });
  });

  // =========================================================================
  // 2. Successful Avatar Replacement & Old-Object Cleanup
  // =========================================================================
  describe("2. Avatar Replacement & Old-Object Storage Cleanup", () => {
    it("cleans up old avatar storage object after successful upload and DB commit", async () => {
      const oldStoragePath = `avatars/${admin1Id}/old-avatar-123.png`;
      mockProfileInDb.avatarUrl = `https://test-project.supabase.co/storage/v1/object/public/media-library/${oldStoragePath}`;
      currentAdminContext.profile.avatarUrl = mockProfileInDb.avatarUrl;

      const req = new Request("http://localhost:3000/api/admin/profile/avatar", {
        headers: { authorization: "Bearer token" },
      });

      const result = await uploadAvatarOperation(
        req,
        {
          originalFilename: "new-profile.png",
          mimeType: "image/png",
          base64Content: VALID_1X1_PNG_BASE64,
        },
        mockPrisma,
        mockStorageClient
      );

      // 1. Verify upload succeeded and DB was updated with new URL
      expect(result.avatarUrl).toMatch(new RegExp(`avatars/${admin1Id}/\\d+-[a-f0-9]+\\.png$`));
      expect(mockProfileInDb.avatarUrl).toBe(result.avatarUrl);

      // 2. Verify storage.remove was called for the OLD avatar
      expect(mockStorageRemove).toHaveBeenCalledTimes(1);
      expect(mockStorageRemove).toHaveBeenCalledWith([oldStoragePath]);

      // 3. Verify storage.remove was NEVER called for the NEW avatar
      const removedArgs = mockStorageRemove.mock.calls[0][0];
      expect(removedArgs).not.toContain(result.avatarUrl);

      // 4. Verify audit log includes previousAvatarUrl metadata
      const auditLog = mockAuditLogs.find((l) => l.action === "AVATAR_UPDATED");
      expect(auditLog).toBeDefined();
      expect(auditLog.metadata.previousAvatarUrl).toBe(
        `https://test-project.supabase.co/storage/v1/object/public/media-library/${oldStoragePath}`
      );
    });

    it("does not call storage remove if the admin had no previous avatar (initial upload)", async () => {
      mockProfileInDb.avatarUrl = null;
      currentAdminContext.profile.avatarUrl = null;

      const req = new Request("http://localhost:3000/api/admin/profile/avatar", {
        headers: { authorization: "Bearer token" },
      });

      const result = await uploadAvatarOperation(
        req,
        {
          originalFilename: "first-avatar.png",
          mimeType: "image/png",
          base64Content: VALID_1X1_PNG_BASE64,
        },
        mockPrisma,
        mockStorageClient
      );

      expect(result.avatarUrl).toBeDefined();
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Avatar Removal & Old-Object Cleanup
  // =========================================================================
  describe("3. Avatar Removal & Old-Object Storage Cleanup", () => {
    it("cleans up storage object when administrator clears avatarUrl to null", async () => {
      const oldStoragePath = `avatars/${admin1Id}/old-avatar-123.png`;
      mockProfileInDb.avatarUrl = `https://test-project.supabase.co/storage/v1/object/public/media-library/${oldStoragePath}`;
      currentAdminContext.profile.avatarUrl = mockProfileInDb.avatarUrl;

      const req = new Request("http://localhost:3000/api/admin/profile", {
        headers: { authorization: "Bearer token" },
      });

      const { profile } = await updateSelfProfileOperation(
        req,
        { avatarUrl: null },
        mockPrisma,
        mockStorageClient
      );

      // 1. Verify DB is cleared
      expect(profile.avatarUrl).toBeNull();
      expect(mockProfileInDb.avatarUrl).toBeNull();

      // 2. Verify physical storage cleanup was executed
      expect(mockStorageRemove).toHaveBeenCalledTimes(1);
      expect(mockStorageRemove).toHaveBeenCalledWith([oldStoragePath]);

      // 3. Verify audit log metadata
      const auditLog = mockAuditLogs.find((l) => l.action === "SELF_PROFILE_UPDATED");
      expect(auditLog).toBeDefined();
      expect(auditLog.metadata.avatarRemoved).toBe(true);
      expect(auditLog.metadata.previousAvatarUrl).toBe(
        `https://test-project.supabase.co/storage/v1/object/public/media-library/${oldStoragePath}`
      );
    });

    it("does not attempt storage cleanup if avatar was already null", async () => {
      mockProfileInDb.avatarUrl = null;
      currentAdminContext.profile.avatarUrl = null;

      const req = new Request("http://localhost:3000/api/admin/profile", {
        headers: { authorization: "Bearer token" },
      });

      const { profile } = await updateSelfProfileOperation(
        req,
        { avatarUrl: null },
        mockPrisma,
        mockStorageClient
      );

      expect(profile.avatarUrl).toBeNull();
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. Failed Database Update Preserving Old Avatar (Rollback Test)
  // =========================================================================
  describe("4. Failed Database Update Preserves Old Avatar", () => {
    it("on upload: rolls back new storage upload and preserves old avatar if DB update fails", async () => {
      const oldStoragePath = `avatars/${admin1Id}/preserve-me.png`;
      mockProfileInDb.avatarUrl = `https://test-project.supabase.co/storage/v1/object/public/media-library/${oldStoragePath}`;
      currentAdminContext.profile.avatarUrl = mockProfileInDb.avatarUrl;

      const failingPrisma = {
        adminProfile: mockPrisma.adminProfile,
        adminAuditLog: mockPrisma.adminAuditLog,
        $transaction: vi.fn().mockRejectedValue(new Error("Database deadlock / constraint violation")),
      } as unknown as PrismaClient;

      const req = new Request("http://localhost:3000/api/admin/profile/avatar", {
        headers: { authorization: "Bearer token" },
      });

      await expect(
        uploadAvatarOperation(
          req,
          {
            originalFilename: "new-attempt.png",
            mimeType: "image/png",
            base64Content: VALID_1X1_PNG_BASE64,
          },
          failingPrisma,
          mockStorageClient
        )
      ).rejects.toThrow("Database deadlock / constraint violation");

      // Verify compensating rollback removed the newly uploaded file
      expect(mockStorageRemove).toHaveBeenCalledTimes(1);
      const rolledBackPath = mockStorageRemove.mock.calls[0][0][0];
      expect(rolledBackPath).toMatch(new RegExp(`^avatars/${admin1Id}/\\d+-[a-f0-9]+\\.png$`));

      // Verify old avatar was NEVER deleted!
      expect(mockStorageRemove).not.toHaveBeenCalledWith([oldStoragePath]);

      // DB profile remains unchanged
      expect(mockProfileInDb.avatarUrl).toBe(
        `https://test-project.supabase.co/storage/v1/object/public/media-library/${oldStoragePath}`
      );
    });

    it("on removal: does not delete storage object if DB update fails", async () => {
      const oldStoragePath = `avatars/${admin1Id}/do-not-delete.png`;
      mockProfileInDb.avatarUrl = `https://test-project.supabase.co/storage/v1/object/public/media-library/${oldStoragePath}`;
      currentAdminContext.profile.avatarUrl = mockProfileInDb.avatarUrl;

      const failingPrisma = {
        adminProfile: mockPrisma.adminProfile,
        adminAuditLog: mockPrisma.adminAuditLog,
        $transaction: vi.fn().mockRejectedValue(new Error("Database write failure")),
      } as unknown as PrismaClient;

      const req = new Request("http://localhost:3000/api/admin/profile", {
        headers: { authorization: "Bearer token" },
      });

      await expect(
        updateSelfProfileOperation(req, { avatarUrl: null }, failingPrisma, mockStorageClient)
      ).rejects.toThrow("Database write failure");

      // Storage remove must NOT be called because DB update failed
      expect(mockStorageRemove).not.toHaveBeenCalled();
      expect(mockProfileInDb.avatarUrl).toBe(
        `https://test-project.supabase.co/storage/v1/object/public/media-library/${oldStoragePath}`
      );
    });
  });

  // =========================================================================
  // 5. Resilient Handling of Storage Cleanup Failures
  // =========================================================================
  describe("5. Storage Cleanup Failure Tolerance", () => {
    it("handles storage service removal error without corrupting profile record on upload", async () => {
      const oldStoragePath = `avatars/${admin1Id}/old-to-delete.png`;
      mockProfileInDb.avatarUrl = `https://test-project.supabase.co/storage/v1/object/public/media-library/${oldStoragePath}`;
      currentAdminContext.profile.avatarUrl = mockProfileInDb.avatarUrl;

      // Mock storage remove returning error
      mockStorageRemove.mockResolvedValueOnce({
        data: null,
        error: { message: "Storage bucket temporarily unavailable" },
      });

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const req = new Request("http://localhost:3000/api/admin/profile/avatar", {
        headers: { authorization: "Bearer token" },
      });

      const result = await uploadAvatarOperation(
        req,
        {
          originalFilename: "new.png",
          mimeType: "image/png",
          base64Content: VALID_1X1_PNG_BASE64,
        },
        mockPrisma,
        mockStorageClient
      );

      // Operation succeeds and returns committed profile despite storage cleanup error
      expect(result.avatarUrl).toBeDefined();
      expect(result.profile.avatarUrl).toBe(result.avatarUrl);
      expect(mockProfileInDb.avatarUrl).toBe(result.avatarUrl);

      // Warning was logged
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Avatar Cleanup] Storage cleanup failed")
      );
    });

    it("handles storage exception gracefully without corrupting profile record on removal", async () => {
      const oldStoragePath = `avatars/${admin1Id}/old-avatar.png`;
      mockProfileInDb.avatarUrl = `https://test-project.supabase.co/storage/v1/object/public/media-library/${oldStoragePath}`;
      currentAdminContext.profile.avatarUrl = mockProfileInDb.avatarUrl;

      // Mock storage remove throwing network exception
      mockStorageRemove.mockRejectedValueOnce(new Error("Socket closed abruptly"));

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const req = new Request("http://localhost:3000/api/admin/profile", {
        headers: { authorization: "Bearer token" },
      });

      const { profile } = await updateSelfProfileOperation(
        req,
        { avatarUrl: null },
        mockPrisma,
        mockStorageClient
      );

      // Database profile is safely updated to null
      expect(profile.avatarUrl).toBeNull();
      expect(mockProfileInDb.avatarUrl).toBeNull();

      // Warning was logged
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Avatar Cleanup] Storage cleanup exception")
      );
    });
  });

  // =========================================================================
  // 6. Repeated and Concurrent Operations Protection
  // =========================================================================
  describe("6. Active Avatar Reference Safeguard & Idempotency", () => {
    it("never deletes storage object if it is still referenced by the active administrator profile", async () => {
      const activeStoragePath = `avatars/${admin1Id}/active-avatar.png`;
      const activeUrl = `https://test-project.supabase.co/storage/v1/object/public/media-library/${activeStoragePath}`;
      mockProfileInDb.avatarUrl = activeUrl;

      // Calling safelyCleanupPreviousAvatar directly with the currently active avatar URL
      const cleanupResult = await safelyCleanupPreviousAvatar({
        previousAvatarUrl: activeUrl,
        adminId: admin1Id,
        prisma: mockPrisma,
        storage: mockStorageClient,
      });

      // Cleanup aborted safely!
      expect(cleanupResult.cleaned).toBe(false);
      expect(cleanupResult.warning).toContain("storage path is still referenced by active profile");
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it("idempotent repeated removals do not delete anything on second invocation", async () => {
      const oldStoragePath = `avatars/${admin1Id}/old.png`;
      mockProfileInDb.avatarUrl = `https://test-project.supabase.co/storage/v1/object/public/media-library/${oldStoragePath}`;
      currentAdminContext.profile.avatarUrl = mockProfileInDb.avatarUrl;

      const req = new Request("http://localhost:3000/api/admin/profile", {
        headers: { authorization: "Bearer token" },
      });

      // 1st removal: deletes old avatar
      await updateSelfProfileOperation(req, { avatarUrl: null }, mockPrisma, mockStorageClient);
      expect(mockStorageRemove).toHaveBeenCalledTimes(1);

      // 2nd removal: avatarUrl is already null in DB
      await updateSelfProfileOperation(req, { avatarUrl: null }, mockPrisma, mockStorageClient);
      expect(mockStorageRemove).toHaveBeenCalledTimes(1); // Not called again!
    });
  });
});
