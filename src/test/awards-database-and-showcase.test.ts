import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAdminAwardsOperation,
  getAdminAwardByIdOperation,
  createAdminAwardOperation,
  updateAdminAwardOperation,
  deleteAdminAwardOperation,
  reorderAdminAwardsOperation,
  getPublicAwardsOperation,
  getPublicAwardBySlugOperation,
  slugify,
  validateSafeUrl,
} from "@/lib/server/awards-operations";
import { deleteAdminMediaAssetOperation } from "@/lib/server/media-operations";
import {
  awardToItem,
  awardToShowcaseItem,
  awardToPublicDetailItem,
  statusToPrisma,
  statusFromPrisma,
} from "@/lib/awards-data";
import { adminClient } from "@/lib/api/admin-client";
import {
  listAdminAwardsServerFn,
  getAdminAwardByIdServerFn,
  createAdminAwardServerFn,
  updateAdminAwardServerFn,
  deleteAdminAwardServerFn,
  reorderAdminAwardsServerFn,
  getPublicAwardsServerFn,
  getPublicAwardBySlugServerFn,
} from "@/lib/server/awards-server-fns";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase/browser";
import type { PrismaClient, Award, AdminAuditLog, PublishStatus, MediaAsset } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-client-access-token" } },
        error: null,
      }),
    },
  },
}));

vi.mock("@/lib/server/awards-server-fns", () => ({
  listAdminAwardsServerFn: vi.fn().mockImplementation(async () => ({
    awards: [
      {
        id: "award-1",
        name: "Best Tech Platform 2026",
        slug: "best-tech-platform-2026",
        context: "National Tech Summit",
        organization: "Tech Council",
        category: "Institutional",
        description: "Recognized for excellence in web engineering.",
        status: "PUBLISHED",
        showOnHomepage: true,
        displayOrder: 1,
        date: "Apr 2026",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  })),
  getAdminAwardByIdServerFn: vi.fn().mockImplementation(async ({ data }: any) => {
    if (data?.idOrSlug === "award-1" || data?.idOrSlug === "best-tech-platform-2026") {
      return {
        award: {
          id: "award-1",
          name: "Best Tech Platform 2026",
          slug: "best-tech-platform-2026",
          context: "National Tech Summit",
          organization: "Tech Council",
          category: "Institutional",
          description: "Recognized for excellence in web engineering.",
          status: "PUBLISHED",
          date: "Apr 2026",
        },
      };
    }
    return { award: null };
  }),
  createAdminAwardServerFn: vi.fn().mockImplementation(async ({ data }: any) => ({
    award: {
      id: "new-award",
      ...data.payload,
    },
  })),
  updateAdminAwardServerFn: vi.fn().mockImplementation(async ({ data }: any) => ({
    award: {
      id: data.id,
      ...data.payload,
    },
  })),
  deleteAdminAwardServerFn: vi.fn().mockImplementation(async ({ data }: any) => ({
    success: true,
    deletedId: data.id,
  })),
  reorderAdminAwardsServerFn: vi.fn().mockImplementation(async () => ({
    success: true,
  })),
  getPublicAwardsServerFn: vi.fn().mockImplementation(async () => ({
    awards: [
      {
        id: "award-1",
        name: "Best Tech Platform 2026",
        slug: "best-tech-platform-2026",
        context: "National Tech Summit",
        organization: "Tech Council",
        category: "Institutional",
        description: "Recognized for excellence in web engineering.",
        status: "PUBLISHED",
        showOnHomepage: true,
        displayOrder: 1,
        date: "Apr 2026",
        thumbnail: {
          id: "media-1",
          publicUrl: "https://storage.cobralearn.com/media/award-1.jpg",
        },
      },
    ],
  })),
  getPublicAwardBySlugServerFn: vi.fn().mockImplementation(async ({ data }: any) => {
    if (data?.slug === "best-tech-platform-2026") {
      return {
        award: {
          id: "award-1",
          name: "Best Tech Platform 2026",
          slug: "best-tech-platform-2026",
          context: "National Tech Summit",
          organization: "Tech Council",
          category: "Institutional",
          description: "Recognized for excellence in web engineering.",
          status: "PUBLISHED",
          showOnHomepage: true,
          displayOrder: 1,
          date: "Apr 2026",
          thumbnail: {
            id: "media-1",
            publicUrl: "https://storage.cobralearn.com/media/award-1.jpg",
          },
        },
      };
    }
    return { award: null };
  }),
}));

describe("Awards & Achievements Module Implementation and Integration Test Suite", () => {
  const adminUuid = "44444444-4444-4444-4444-444444444444";
  const editorUuid = "55555555-5555-5555-5555-555555555555";
  const inactiveUuid = "66666666-6666-6666-6666-666666666666";

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

  function createAuthRequest(user: User | null): Request {
    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : { message: "Invalid session" },
        }),
      },
    });

    return new Request("https://api.internal/admin/awards", {
      headers: {
        authorization: user ? `Bearer mock-token-for-${user.id}` : "",
      },
    });
  }

  let mockAwards: Award[] = [];
  let mockAuditLogs: AdminAuditLog[] = [];
  let mockMediaAssets: MediaAsset[] = [];

  function createMockPrisma(): PrismaClient {
    const findAwardHelper = (where: any) => {
      let match: Award | undefined;
      if (where.OR) {
        match = mockAwards.find((a) =>
          where.OR.some((clause: any) => (clause.id ? a.id === clause.id : clause.slug ? a.slug === clause.slug : false))
        );
      } else {
        match = mockAwards.find((a) => (where.id ? a.id === where.id : a.slug === where.slug));
      }

      if (!match) return null;
      if (where.status && match.status !== where.status) return null;

      return {
        ...match,
        thumbnail: mockMediaAssets.find((m) => m.id === match.thumbnailId) || null,
      };
    };

    const mockPrismaInstance = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id === adminUuid || where.email === "admin@cobralearn.com") {
            return Promise.resolve({
              id: adminUuid,
              email: "admin@cobralearn.com",
              role: "ADMIN",
              isActive: true,
              fullName: "Admin User",
            });
          }
          if (where.id === editorUuid || where.email === "editor@cobralearn.com") {
            return Promise.resolve({
              id: editorUuid,
              email: "editor@cobralearn.com",
              role: "EDITOR",
              isActive: true,
              fullName: "Staff Editor",
            });
          }
          if (where.id === inactiveUuid || where.email === "inactive@cobralearn.com") {
            return Promise.resolve({
              id: inactiveUuid,
              email: "inactive@cobralearn.com",
              role: "ADMIN",
              isActive: false,
              fullName: "Inactive Admin",
            });
          }
          return Promise.resolve(null);
        }),
      },
      award: {
        findMany: vi.fn().mockImplementation(({ where, orderBy }: any = {}) => {
          let list = [...mockAwards];
          if (where?.status) {
            list = list.filter((a) => a.status === where.status);
          }
          if (where?.category) {
            list = list.filter((a) => a.category === where.category);
          }
          if (where?.showOnHomepage !== undefined) {
            list = list.filter((a) => a.showOnHomepage === where.showOnHomepage);
          }
          const isAsc = Array.isArray(orderBy)
            ? orderBy.some((o: any) => o?.displayOrder === "asc")
            : orderBy?.displayOrder === "asc";
          if (isAsc) {
            list.sort((a, b) => a.displayOrder - b.displayOrder);
          }
          return Promise.resolve(
            list.map((a) => ({
              ...a,
              thumbnail: mockMediaAssets.find((m) => m.id === a.thumbnailId) || null,
            }))
          );
        }),
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(findAwardHelper(where));
        }),
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(findAwardHelper(where));
        }),
        findUniqueOrThrow: vi.fn().mockImplementation(({ where }: any) => {
          const item = findAwardHelper(where);
          if (!item) throw new Error("Award not found");
          return Promise.resolve(item);
        }),
        create: vi.fn().mockImplementation(({ data }: { data: any }) => {
          const newAward: Award = {
            id: `award-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            slug: data.slug,
            name: data.name,
            context: data.context,
            organization: data.organization,
            category: data.category,
            date: data.date,
            description: data.description,
            fullDescription: data.fullDescription || null,
            credentialUrl: data.credentialUrl || null,
            status: data.status,
            showOnHomepage: data.showOnHomepage ?? true,
            displayOrder: data.displayOrder || 0,
            thumbnailId: data.thumbnailId || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockAwards.push(newAward);
          return Promise.resolve(newAward);
        }),
        update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: any }) => {
          const index = mockAwards.findIndex((a) => a.id === where.id);
          if (index === -1) throw new Error("Award not found");
          mockAwards[index] = {
            ...mockAwards[index]!,
            ...data,
            updatedAt: new Date(),
          };
          return Promise.resolve(mockAwards[index]);
        }),
        delete: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          const index = mockAwards.findIndex((a) => a.id === where.id);
          if (index === -1) throw new Error("Award not found");
          const deleted = mockAwards.splice(index, 1)[0];
          return Promise.resolve(deleted);
        }),
        count: vi.fn().mockImplementation(({ where }: any = {}) => {
          if (where?.id?.in) {
            const set = new Set(where.id.in);
            return Promise.resolve(mockAwards.filter((a) => set.has(a.id)).length);
          }
          return Promise.resolve(mockAwards.length);
        }),
      },
      mediaAsset: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          const asset = mockMediaAssets.find((m) => m.id === where.id);
          if (!asset) return Promise.resolve(null);
          return Promise.resolve({
            ...asset,
            awardThumbnails: mockAwards.filter((a) => a.thumbnailId === asset.id),
          });
        }),
        delete: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          const idx = mockMediaAssets.findIndex((m) => m.id === where.id);
          if (idx === -1) throw new Error("Media not found");
          return Promise.resolve(mockMediaAssets.splice(idx, 1)[0]);
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation(({ data }: { data: any }) => {
          const log: AdminAuditLog = {
            id: `log-${Date.now()}`,
            actorId: data.actorId,
            actorEmail: data.actorEmail,
            action: data.action,
            module: data.module,
            entityId: data.entityId || null,
            metadata: data.metadata || null,
            ipAddress: data.ipAddress || null,
            createdAt: new Date(),
          };
          mockAuditLogs.push(log);
          return Promise.resolve(log);
        }),
      },
      $transaction: vi.fn().mockImplementation(async (callback: any) => {
        return await callback(mockPrismaInstance);
      }),
    };

    return mockPrismaInstance as unknown as PrismaClient;
  }

  let prisma: PrismaClient;

  beforeEach(() => {
    mockAwards = [
      {
        id: "award-initial-1",
        slug: "gold-medal-innovation",
        name: "Gold Medal for Innovation",
        context: "National Tech Expo 2026",
        organization: "Ministry of Science & Tech",
        category: "Institutional",
        date: "Jan 2026",
        description: "Awarded top honor for breakthrough digital platforms.",
        fullDescription: "Detailed evaluation criteria and recognition background.",
        credentialUrl: "https://credentials.gov.in/verify/101",
        status: "PUBLISHED",
        showOnHomepage: true,
        displayOrder: 1,
        thumbnailId: "media-thumb-1",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
      {
        id: "award-initial-2",
        slug: "hackathon-champions",
        name: "Global Hackathon Champions",
        context: "HackAI World 2026",
        organization: "Global Dev Foundation",
        category: "Competition",
        date: "Feb 2026",
        description: "1st place across 500 competing international teams.",
        fullDescription: null,
        credentialUrl: null,
        status: "DRAFT",
        showOnHomepage: false,
        displayOrder: 2,
        thumbnailId: "media-thumb-2",
        createdAt: new Date("2026-02-01"),
        updatedAt: new Date("2026-02-01"),
      },
    ];

    mockMediaAssets = [
      {
        id: "media-thumb-1",
        name: "gold-medal.png",
        originalFilename: "gold-medal.png",
        bucket: "media-library",
        storagePath: "awards/gold-medal.png",
        publicUrl: "https://storage.cobralearn.com/awards/gold-medal.png",
        mediaType: "IMAGE",
        category: "AWARDS",
        mimeType: "image/png",
        fileSize: BigInt(1024),
        fileExtension: "png",
        dimensions: "1200x800",
        duration: null,
        altText: "Gold medal",
        description: null,
        tags: ["award"],
        uploadedById: adminUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "media-thumb-2",
        name: "hackathon-trophy.png",
        originalFilename: "hackathon-trophy.png",
        bucket: "media-library",
        storagePath: "awards/hackathon-trophy.png",
        publicUrl: "https://storage.cobralearn.com/awards/hackathon-trophy.png",
        mediaType: "IMAGE",
        category: "AWARDS",
        mimeType: "image/png",
        fileSize: BigInt(2048),
        fileExtension: "png",
        dimensions: "1200x800",
        duration: null,
        altText: "Trophy",
        description: null,
        tags: ["trophy"],
        uploadedById: adminUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockAuditLogs = [];
    prisma = createMockPrisma();
  });

  describe("1. Administrative CRUD & Database Persistence", () => {
    it("listAdminAwardsOperation returns all records (Draft + Published) with thumbnail relations", async () => {
      const req = createAuthRequest(adminUser);
      const res = await listAdminAwardsOperation(req, undefined, prisma);
      expect(res.awards).toHaveLength(2);
      expect(res.awards[0]?.name).toBe("Gold Medal for Innovation");
      expect(res.awards[0]?.thumbnail?.publicUrl).toBe("https://storage.cobralearn.com/awards/gold-medal.png");
    });

    it("getAdminAwardByIdOperation returns an award by id or slug", async () => {
      const req = createAuthRequest(adminUser);
      const byId = await getAdminAwardByIdOperation(req, "award-initial-1", prisma);
      expect(byId.award).not.toBeNull();
      expect(byId.award?.slug).toBe("gold-medal-innovation");

      const bySlug = await getAdminAwardByIdOperation(req, "gold-medal-innovation", prisma);
      expect(bySlug.award?.id).toBe("award-initial-1");
    });

    it("createAdminAwardOperation creates award and records audit log in transaction", async () => {
      const req = createAuthRequest(adminUser);
      const res = await createAdminAwardOperation(
        req,
        {
          name: "Best Community Leadership Award",
          context: "Open Source India",
          organization: "OSF",
          category: "Community",
          description: "Leading the largest student developer chapter.",
          status: "PUBLISHED",
          thumbnailId: "media-thumb-1",
          credentialUrl: "https://osf.org/award/leadership",
        },
        prisma
      );

      expect(res.award.name).toBe("Best Community Leadership Award");
      expect(res.award.slug).toBe("best-community-leadership-award");
      expect(res.award.status).toBe("PUBLISHED");
      expect(res.award.thumbnail?.id).toBe("media-thumb-1");

      const log = mockAuditLogs.find((l) => l.action === "AWARD_CREATED");
      expect(log).toBeDefined();
      expect(log?.module).toBe("AWARDS_CMS");
      expect(log?.actorEmail).toBe("admin@cobralearn.com");
    });

    it("updateAdminAwardOperation modifies fields and updates audit log", async () => {
      const req = createAuthRequest(adminUser);
      const res = await updateAdminAwardOperation(
        req,
        "award-initial-1",
        {
          name: "Gold Medal for Digital Innovation 2026",
          description: "Updated description text.",
        },
        prisma
      );

      expect(res.award.name).toBe("Gold Medal for Digital Innovation 2026");
      expect(res.award.description).toBe("Updated description text.");

      const log = mockAuditLogs.find((l) => l.action === "AWARD_UPDATED");
      expect(log).toBeDefined();
    });

    it("deleteAdminAwardOperation deletes award but preserves referenced MediaAsset", async () => {
      const req = createAuthRequest(adminUser);
      const res = await deleteAdminAwardOperation(req, "award-initial-2", prisma);
      expect(res.success).toBe(true);
      expect(mockAwards.find((a) => a.id === "award-initial-2")).toBeUndefined();

      // MediaAsset is preserved
      const asset = mockMediaAssets.find((m) => m.id === "media-thumb-2");
      expect(asset).toBeDefined();

      const log = mockAuditLogs.find((l) => l.action === "AWARD_DELETED");
      expect(log).toBeDefined();
    });
  });

  describe("2. Validation & Security Boundaries", () => {
    it("rejects creation without a mandatory thumbnail", async () => {
      const req = createAuthRequest(adminUser);
      await expect(
        createAdminAwardOperation(
          req,
          {
            name: "No Thumbnail Award",
            context: "Contest",
            organization: "Org",
            category: "Technical",
            description: "Desc",
            thumbnailId: null,
          },
          prisma
        )
      ).rejects.toThrow("Validation Error: Thumbnail image is required");
    });

    it("rejects non-existent MediaAsset thumbnail reference", async () => {
      const req = createAuthRequest(adminUser);
      await expect(
        createAdminAwardOperation(
          req,
          {
            name: "Missing Asset Award",
            context: "Contest",
            organization: "Org",
            category: "Technical",
            description: "Desc",
            thumbnailId: "non-existent-media-id",
          },
          prisma
        )
      ).rejects.toThrow("does not exist in Media Library");
    });

    it("rejects dangerous URL schemes in credentialUrl", async () => {
      expect(() => validateSafeUrl("javascript:alert(1)", "Credential URL")).toThrow("dangerous protocol scheme");
      expect(() => validateSafeUrl("data:text/html;base64,abc", "Credential URL")).toThrow("dangerous protocol scheme");
      expect(validateSafeUrl("https://verify.org/cert/123", "Credential URL")).toBe("https://verify.org/cert/123");
    });

    it("enforces RBAC: EDITOR can create and update, but is REJECTED from deleting", async () => {
      const editorReq = createAuthRequest(editorUser);

      // EDITOR can create
      const created = await createAdminAwardOperation(
        editorReq,
        {
          name: "Editor Created Award",
          context: "Context",
          organization: "Org",
          category: "Technical",
          description: "Desc",
          thumbnailId: "media-thumb-1",
        },
        prisma
      );
      expect(created.award).toBeDefined();

      // EDITOR cannot delete
      await expect(
        deleteAdminAwardOperation(editorReq, created.award.id, prisma)
      ).rejects.toThrow(/Forbidden|CMS_DELETE/i);
    });

    it("rejects unauthenticated and inactive users", async () => {
      const unauthReq = createAuthRequest(null);
      await expect(listAdminAwardsOperation(unauthReq, undefined, prisma)).rejects.toThrow(/No cookie header provided|Unauthorized/i);

      const inactiveReq = createAuthRequest(inactiveUser);
      await expect(listAdminAwardsOperation(inactiveReq, undefined, prisma)).rejects.toThrow(/deactivated/i);
    });

    it("prevents deleting a MediaAsset still referenced by an award", async () => {
      const req = createAuthRequest(adminUser);
      await expect(
        deleteAdminMediaAssetOperation(req, "media-thumb-1", prisma, { from: () => ({ remove: vi.fn() }) } as any)
      ).rejects.toThrow(/Referential Integrity Error.*thumbnail for Award\(s\)/i);
    });
  });

  describe("3. Reordering & Display Order Persistence", () => {
    it("reorders awards sequentially and logs audit event", async () => {
      const req = createAuthRequest(adminUser);
      const res = await reorderAdminAwardsOperation(
        req,
        ["award-initial-2", "award-initial-1"],
        prisma
      );
      expect(res.success).toBe(true);

      const a2 = mockAwards.find((a) => a.id === "award-initial-2");
      const a1 = mockAwards.find((a) => a.id === "award-initial-1");
      expect(a2?.displayOrder).toBe(1);
      expect(a1?.displayOrder).toBe(2);

      const log = mockAuditLogs.find((l) => l.action === "AWARDS_REORDERED");
      expect(log).toBeDefined();
    });

    it("rejects reordering with duplicate or non-existent IDs", async () => {
      const req = createAuthRequest(adminUser);
      await expect(
        reorderAdminAwardsOperation(req, ["award-initial-1", "award-initial-1"], prisma)
      ).rejects.toThrow("duplicate IDs");

      await expect(
        reorderAdminAwardsOperation(req, ["award-initial-1", "ghost-id"], prisma)
      ).rejects.toThrow("do not exist");
    });
  });

  describe("4. Public Showcase Queries & Detail Integration", () => {
    it("getPublicAwardsOperation strictly returns ONLY published awards", async () => {
      const res = await getPublicAwardsOperation(prisma);
      expect(res.awards).toHaveLength(1);
      expect(res.awards[0]?.status).toBe("PUBLISHED");
      expect(res.awards[0]?.name).toBe("Gold Medal for Innovation");
    });

    it("getPublicAwardBySlugOperation returns published award and rejects draft/archived", async () => {
      // Published slug -> Returns award
      const published = await getPublicAwardBySlugOperation("gold-medal-innovation", prisma);
      expect(published.award).not.toBeNull();
      expect(published.award?.name).toBe("Gold Medal for Innovation");

      // Draft slug -> Returns null (not found for public)
      const draft = await getPublicAwardBySlugOperation("hackathon-champions", prisma);
      expect(draft.award).toBeNull();
    });

    it("mappers correctly produce ShowcaseItem and PublicAwardDetailItem", () => {
      const awWithMedia = {
        ...mockAwards[0]!,
        thumbnail: mockMediaAssets[0],
      };

      const showcaseItem = awardToShowcaseItem(awWithMedia);
      expect(showcaseItem.accent).toBe("gold");
      expect(showcaseItem.title).toBe("Gold Medal for Innovation");
      expect(showcaseItem.image).toBe("https://storage.cobralearn.com/awards/gold-medal.png");
      expect(showcaseItem.published).toBe(true);

      const detailItem = awardToPublicDetailItem(awWithMedia);
      expect(detailItem.organization).toBe("Ministry of Science & Tech");
      expect(detailItem.context).toBe("National Tech Expo 2026");
      expect(detailItem.credentialUrl).toBe("https://credentials.gov.in/verify/101");
      expect(detailItem.category).toBe("Institutional");
    });
  });

  describe("5. Client API Boundaries", () => {
    it("adminClient methods call server functions and return structured responses", async () => {
      const listRes = await adminClient.listAdminAwards();
      expect(listRes.success).toBe(true);
      expect(listRes.data).toHaveLength(1);

      const pubRes = await adminClient.getPublicAwards();
      expect(pubRes.success).toBe(true);
      expect(pubRes.data?.[0]?.name).toBe("Best Tech Platform 2026");

      const pubDetail = await adminClient.getPublicAwardBySlug("best-tech-platform-2026");
      expect(pubDetail.success).toBe(true);
      expect(pubDetail.data?.name).toBe("Best Tech Platform 2026");
    });
  });
});
