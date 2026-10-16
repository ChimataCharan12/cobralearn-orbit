import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AdminProfile, MediaAsset } from "@prisma/client";
import {
  updateAdminMediaAssetOperation,
  type UpdateMediaPayload,
} from "@/lib/server/media-operations";
import { updateAdminMediaServerFn } from "@/lib/server/media-server-fns";
import { adminClient } from "@/lib/api/admin-client";
import { getSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-browser-token" } },
      }),
    },
  },
}));

vi.mock("@/lib/server/media-server-fns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/media-server-fns")>();
  return {
    ...actual,
    updateAdminMediaServerFn: vi.fn(),
  };
});

describe("Media Metadata Update Server Operation (B3.4 Stage 1)", () => {
  const superAdminProfile: AdminProfile = {
    id: "user-super-1",
    email: "superadmin@cobralearn.com",
    fullName: "Super Admin",
    designation: null,
    role: "SUPER_ADMIN",
    isActive: true,
    avatarUrl: null,
    bio: null,
    phone: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminProfile: AdminProfile = {
    id: "user-admin-1",
    email: "admin@cobralearn.com",
    fullName: "Admin User",
    designation: null,
    role: "ADMIN",
    isActive: true,
    avatarUrl: null,
    bio: null,
    phone: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const editorProfile: AdminProfile = {
    id: "user-editor-1",
    email: "editor@cobralearn.com",
    fullName: "Editor User",
    designation: null,
    role: "EDITOR",
    isActive: true,
    avatarUrl: null,
    bio: null,
    phone: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const inactiveProfile: AdminProfile = {
    id: "user-inactive-1",
    email: "inactive@cobralearn.com",
    fullName: "Inactive Admin",
    designation: null,
    role: "ADMIN",
    isActive: false,
    avatarUrl: null,
    bio: null,
    phone: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfiles: Record<string, AdminProfile> = {
    [superAdminProfile.id]: superAdminProfile,
    [adminProfile.id]: adminProfile,
    [editorProfile.id]: editorProfile,
    [inactiveProfile.id]: inactiveProfile,
  };

  const existingAsset: MediaAsset = {
    id: "asset-123",
    name: "Original Asset Name",
    originalFilename: "original-file.png",
    bucket: "media-library",
    storagePath: "projects/original-file.png",
    publicUrl: "https://storage.cobralearn.com/media-library/projects/original-file.png",
    mediaType: "IMAGE",
    category: "PROJECTS",
    mimeType: "image/png",
    fileSize: BigInt(102400),
    fileExtension: "png",
    dimensions: "1920x1080",
    duration: null,
    altText: "Original Alt",
    description: "Original Description",
    tags: ["initial", "sample"],
    uploadedById: adminProfile.id,
    createdAt: new Date("2026-10-01T12:00:00Z"),
    updatedAt: new Date("2026-10-01T12:00:00Z"),
  };

  let mockPrisma: any;

  function setupAuthUser(profile: AdminProfile | null) {
    if (!profile) {
      vi.mocked(getSupabaseServerClient).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }),
        },
      } as any);
      return;
    }

    vi.mocked(getSupabaseServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: profile.id,
              email: profile.email,
            },
          },
          error: null,
        }),
      },
    } as any);
  }

  beforeEach(() => {
    vi.restoreAllMocks();

    mockPrisma = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(mockProfiles[where.id] || null);
        }),
      },
      mediaAsset: {
        findUnique: vi.fn().mockResolvedValue({ ...existingAsset }),
        update: vi.fn().mockImplementation(({ data }: { data: any }) => {
          return Promise.resolve({
            ...existingAsset,
            ...data,
            updatedAt: new Date(),
          });
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockPrisma);
      }),
    };
  });

  // 1. Success by authorized roles
  it("allows SUPER_ADMIN and ADMIN to update metadata and updates audit log", async () => {
    for (const profile of [superAdminProfile, adminProfile]) {
      setupAuthUser(profile);
      const req = new Request("https://api.internal/admin/media/asset-123", {
        headers: { Authorization: `Bearer token-${profile.role}` },
      });

      const payload: UpdateMediaPayload = {
        name: `Updated by ${profile.role}`,
        category: "WEBSITES",
        altText: "New Alt Text",
        description: "New Description",
        tags: ["brand", "updated"],
      };

      const result = await updateAdminMediaAssetOperation(req, "asset-123", payload, mockPrisma);

      expect(result.asset.name).toBe(`Updated by ${profile.role}`);
      expect(result.asset.category).toBe("WEBSITES");
      expect(result.asset.altText).toBe("New Alt Text");
      expect(result.asset.description).toBe("New Description");
      expect(result.asset.tags).toEqual(["brand", "updated"]);

      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: profile.id,
            actorEmail: profile.email,
            action: "MEDIA_UPDATED",
            module: "MEDIA_CMS",
            entityId: "asset-123",
            metadata: {
              previous: {
                name: existingAsset.name,
                category: existingAsset.category,
                altText: existingAsset.altText,
                description: existingAsset.description,
                tags: existingAsset.tags,
              },
              updated: {
                name: `Updated by ${profile.role}`,
                category: "WEBSITES",
                altText: "New Alt Text",
                description: "New Description",
                tags: ["brand", "updated"],
              },
            },
          }),
        })
      );
    }
  });

  // 2. Editor permission behavior
  it("allows EDITOR role to update media metadata (possesses MEDIA_UPDATE)", async () => {
    setupAuthUser(editorProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-editor" },
    });

    const payload: UpdateMediaPayload = {
      name: "Editor Revised Name",
      description: "Editor updated this description",
    };

    const result = await updateAdminMediaAssetOperation(req, "asset-123", payload, mockPrisma);
    expect(result.asset.name).toBe("Editor Revised Name");
    expect(result.asset.description).toBe("Editor updated this description");
  });

  // 3. Unauthenticated and inactive-admin rejection
  it("rejects unauthenticated requests", async () => {
    setupAuthUser(null);
    const req = new Request("https://api.internal/admin/media/asset-123");

    await expect(
      updateAdminMediaAssetOperation(req, "asset-123", { name: "Test" }, mockPrisma)
    ).rejects.toThrow(/Unauthorized|No cookie header provided/);
  });

  it("rejects inactive administrators", async () => {
    setupAuthUser(inactiveProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-inactive" },
    });

    await expect(
      updateAdminMediaAssetOperation(req, "asset-123", { name: "Test" }, mockPrisma)
    ).rejects.toThrow("Forbidden: AdminProfile is deactivated");
  });

  // 4. Missing asset handling & invalid ID
  it("rejects missing asset with Not Found", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/nonexistent", {
      headers: { Authorization: "Bearer token-admin" },
    });

    mockPrisma.mediaAsset.findUnique = vi.fn().mockResolvedValue(null);

    await expect(
      updateAdminMediaAssetOperation(req, "nonexistent", { name: "Test" }, mockPrisma)
    ).rejects.toThrow("Not Found: Media asset does not exist");
  });

  it("rejects empty or whitespace asset ID", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/", {
      headers: { Authorization: "Bearer token-admin" },
    });

    await expect(
      updateAdminMediaAssetOperation(req, "   ", { name: "Test" }, mockPrisma)
    ).rejects.toThrow("Validation Error: Media asset ID is required");
  });

  // 5. Empty/oversized names
  it("rejects empty or whitespace name", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    await expect(
      updateAdminMediaAssetOperation(req, "asset-123", { name: "   " }, mockPrisma)
    ).rejects.toThrow("Validation Error: Media asset name is required");
  });

  it("rejects name exceeding 255 characters", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    await expect(
      updateAdminMediaAssetOperation(req, "asset-123", { name: "A".repeat(256) }, mockPrisma)
    ).rejects.toThrow("Validation Error: Media asset name exceeds maximum length of 255 characters");
  });

  // 6. Invalid category
  it("rejects invalid category with allowed list", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    await expect(
      updateAdminMediaAssetOperation(req, "asset-123", { category: "NONEXISTENT_CATEGORY" }, mockPrisma)
    ).rejects.toThrow(
      'Validation Error: Invalid media category "NONEXISTENT_CATEGORY". Allowed: ADVERTISEMENTS, WEBSITES, AWARDS, PROJECTS, GENERAL'
    );
  });

  it("accepts valid category in title-case or uppercase", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    const result = await updateAdminMediaAssetOperation(req, "asset-123", { category: "Websites" }, mockPrisma);
    expect(result.asset.category).toBe("WEBSITES");
  });

  // 7. Alt-text and description length validation
  it("rejects alt-text exceeding 500 characters", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    await expect(
      updateAdminMediaAssetOperation(req, "asset-123", { altText: "A".repeat(501) }, mockPrisma)
    ).rejects.toThrow("Validation Error: Alt text exceeds maximum length of 500 characters");
  });

  it("clears alt-text when null or empty string is provided", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    const result = await updateAdminMediaAssetOperation(req, "asset-123", { altText: "" }, mockPrisma);
    expect(result.asset.altText).toBeNull();
  });

  it("rejects description exceeding 2000 characters", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    await expect(
      updateAdminMediaAssetOperation(req, "asset-123", { description: "B".repeat(2001) }, mockPrisma)
    ).rejects.toThrow("Validation Error: Description exceeds maximum length of 2000 characters");
  });

  it("clears description when null or empty string is provided", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    const result = await updateAdminMediaAssetOperation(req, "asset-123", { description: null }, mockPrisma);
    expect(result.asset.description).toBeNull();
  });

  // 8. Tags validation: invalid tags, duplicates, and count limits
  it("rejects non-array tags", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    await expect(
      updateAdminMediaAssetOperation(req, "asset-123", { tags: "invalid" as any }, mockPrisma)
    ).rejects.toThrow("Validation Error: Tags must be an array of strings");
  });

  it("rejects tag exceeding 50 characters", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    await expect(
      updateAdminMediaAssetOperation(req, "asset-123", { tags: ["valid", "T".repeat(51)] }, mockPrisma)
    ).rejects.toThrow("Validation Error: Tag exceeds maximum length of 50 characters");
  });

  it("rejects more than 20 tags", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    const tooManyTags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    await expect(
      updateAdminMediaAssetOperation(req, "asset-123", { tags: tooManyTags }, mockPrisma)
    ).rejects.toThrow("Validation Error: Maximum of 20 tags allowed");
  });

  it("trims and deduplicates tags case-insensitively", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    const result = await updateAdminMediaAssetOperation(
      req,
      "asset-123",
      { tags: ["  react  ", "REACT", "typescript", " Typescript ", ""] },
      mockPrisma
    );

    expect(result.asset.tags).toEqual(["react", "typescript"]);
  });

  // 9. Attempts to mutate immutable fields
  it("strictly rejects attempts to modify immutable fields", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    const immutableTestCases = [
      { id: "new-id" },
      { bucket: "other-bucket" },
      { storagePath: "hack/path.png" },
      { publicUrl: "https://malicious.url" },
      { originalFilename: "renamed.exe" },
      { mimeType: "image/svg+xml" },
      { fileSize: 999 },
      { fileExtension: "exe" },
      { mediaType: "VIDEO" },
      { dimensions: "4000x4000" },
      { duration: "10:00" },
      { uploadedById: "hacker" },
      { createdAt: new Date() },
    ];

    for (const testPayload of immutableTestCases) {
      const field = Object.keys(testPayload)[0];
      await expect(
        updateAdminMediaAssetOperation(req, "asset-123", testPayload as any, mockPrisma)
      ).rejects.toThrow(`Validation Error: Attempt to modify immutable field "${field}"`);
    }
  });

  // 10. Audit log and transaction failure behavior
  it("rolls back atomic transaction if audit logging fails", async () => {
    setupAuthUser(adminProfile);
    const req = new Request("https://api.internal/admin/media/asset-123", {
      headers: { Authorization: "Bearer token-admin" },
    });

    mockPrisma.adminAuditLog.create = vi.fn().mockRejectedValue(new Error("Database connection lost"));

    await expect(
      updateAdminMediaAssetOperation(req, "asset-123", { name: "Fail Test" }, mockPrisma)
    ).rejects.toThrow("Database connection lost");
  });

  // 11. Client response and error handling
  it("adminClient.updateAdminMedia returns { success: true, data } on success", async () => {
    const updatedMock = {
      ...existingAsset,
      name: "Client Updated",
    };

    vi.mocked(updateAdminMediaServerFn).mockResolvedValue({
      asset: updatedMock,
    } as any);

    const res = await adminClient.updateAdminMedia("asset-123", { name: "Client Updated" });
    expect(res.success).toBe(true);
    expect(res.data?.name).toBe("Client Updated");
  });

  it("adminClient.updateAdminMedia returns { success: false, error } on server failure", async () => {
    vi.mocked(updateAdminMediaServerFn).mockRejectedValue(new Error("Validation Error: Media asset name is required"));

    const res = await adminClient.updateAdminMedia("asset-123", { name: "" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Validation Error: Media asset name is required");
  });
});
