import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAdminAdvertisementOperation,
  updateAdminAdvertisementOperation,
  deleteAdminAdvertisementOperation,
  reorderAdminAdvertisementsOperation,
  getPublicAdvertisementsOperation,
  getPublicAdvertisementBySlugOperation,
} from "@/lib/server/advertisements-operations";
import { deleteAdminMediaAssetOperation } from "@/lib/server/media-operations";
import {
  advertisementToItem,
  advertisementToShowcaseItem,
  advertisementToPublicDetailItem,
  statusToPrisma,
} from "@/lib/advertisements-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PrismaClient, Advertisement, AdminAuditLog, MediaAsset } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Advertisements Public Integration Audit & Invariant Verification", () => {
  const adminUuid = "11111111-1111-1111-1111-111111111111";

  const adminUser: User = {
    id: adminUuid,
    email: "admin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  function createAuthRequest(user: User | null, currentLevel: "aal1" | "aal2" = "aal1"): Request {
    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : { message: "Invalid session" },
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: user ? { currentLevel, nextLevel: currentLevel, currentAuthenticationMethods: [] } : null,
            error: null,
          }),
        },
      },
    });

    return new Request("https://api.internal/admin/advertisements", {
      headers: {
        authorization: user ? `Bearer mock-token-for-${user.id}` : "",
      },
    });
  }

  let mockAdvertisements: Advertisement[] = [];
  let mockAuditLogs: AdminAuditLog[] = [];
  let mockMediaAssets: MediaAsset[] = [];

  function createMockPrisma(): PrismaClient {
    const findAdHelper = (where: any) => {
      let match: Advertisement | undefined;
      if (where.OR) {
        match = mockAdvertisements.find((a) =>
          where.OR.some((clause: any) => (clause.id ? a.id === clause.id : clause.slug ? a.slug === clause.slug : false))
        );
      } else {
        match = mockAdvertisements.find((a) => (where.id ? a.id === where.id : a.slug === where.slug));
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
          return Promise.resolve(null);
        }),
      },
      advertisement: {
        findMany: vi.fn().mockImplementation(({ where, orderBy }: any = {}) => {
          let list = [...mockAdvertisements];
          if (where?.status) {
            list = list.filter((a) => a.status === where.status);
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
          return Promise.resolve(findAdHelper(where));
        }),
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(findAdHelper(where));
        }),
        findUniqueOrThrow: vi.fn().mockImplementation(({ where }: any) => {
          const item = findAdHelper(where);
          if (!item) throw new Error("Advertisement not found");
          return Promise.resolve(item);
        }),
        create: vi.fn().mockImplementation(({ data }: { data: any }) => {
          const newAd: Advertisement = {
            id: `ad-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            slug: data.slug,
            name: data.name,
            campaign: data.campaign,
            brand: data.brand,
            campaignType: data.campaignType || null,
            description: data.description,
            fullDescription: data.fullDescription || null,
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            date: data.date,
            campaignUrl: data.campaignUrl || null,
            status: data.status,
            featured: data.featured ?? false,
            showOnHomepage: data.showOnHomepage ?? false,
            displayOrder: data.displayOrder || 0,
            thumbnailId: data.thumbnailId || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockAdvertisements.push(newAd);
          return Promise.resolve(newAd);
        }),
        update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: any }) => {
          const index = mockAdvertisements.findIndex((a) => a.id === where.id);
          if (index === -1) throw new Error("Advertisement not found");
          mockAdvertisements[index] = {
            ...mockAdvertisements[index]!,
            ...data,
            updatedAt: new Date(),
          };
          return Promise.resolve(mockAdvertisements[index]);
        }),
        delete: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          const index = mockAdvertisements.findIndex((a) => a.id === where.id);
          if (index === -1) throw new Error("Advertisement not found");
          const deleted = mockAdvertisements.splice(index, 1)[0];
          return Promise.resolve(deleted);
        }),
        count: vi.fn().mockImplementation(({ where }: any = {}) => {
          if (where?.id?.in) {
            const set = new Set(where.id.in);
            return Promise.resolve(mockAdvertisements.filter((a) => set.has(a.id)).length);
          }
          return Promise.resolve(mockAdvertisements.length);
        }),
      },
      mediaAsset: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          const asset = mockMediaAssets.find((m) => m.id === where.id);
          if (!asset) return Promise.resolve(null);
          return Promise.resolve({
            ...asset,
            advertisementThumbnails: mockAdvertisements.filter((a) => a.thumbnailId === asset.id),
          });
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
    mockMediaAssets = [
      {
        id: "media-ad-banner-1",
        name: "ai-bootcamp-banner.png",
        originalFilename: "ai-bootcamp-banner.png",
        bucket: "media-library",
        storagePath: "advertisements/ai-bootcamp-banner.png",
        publicUrl: "https://storage.cobralearn.com/media-library/advertisements/ai-bootcamp-banner.png",
        mediaType: "IMAGE",
        category: "ADVERTISEMENTS",
        mimeType: "image/png",
        fileSize: BigInt(2048),
        fileExtension: "png",
        dimensions: "1280x720",
        duration: null,
        altText: "AI Bootcamp Banner",
        description: null,
        tags: ["ai", "campaign"],
        uploadedById: adminUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockAdvertisements = [
      {
        id: "ad-persisted-1",
        slug: "ai-engineering-bootcamp-2026",
        name: "AI Engineering Bootcamp 2026",
        campaign: "Summer Learning Drive",
        brand: "CobraLearn Innotech",
        campaignType: "Workshop",
        description: "Intensive hands-on AI systems cohort.",
        fullDescription: "Comprehensive 8-week bootcamp covering LLMs, agents, and cloud architecture.",
        startDate: "Jun 2026",
        endDate: "Aug 2026",
        date: "Jun 2026",
        campaignUrl: "https://cobralearn.com/bootcamp",
        status: "PUBLISHED",
        featured: true,
        showOnHomepage: true,
        displayOrder: 1,
        thumbnailId: "media-ad-banner-1",
        createdAt: new Date("2026-05-01"),
        updatedAt: new Date("2026-05-01"),
      },
    ];

    mockAuditLogs = [];
    prisma = createMockPrisma();
  });

  it("AUDIT CHECK 1: End-to-end data flow (Admin creation -> Prisma persistence -> Public showcase query)", async () => {
    const req = createAuthRequest(adminUser);

    // 1. Admin creates a published campaign
    const createdRes = await createAdminAdvertisementOperation(
      req,
      {
        name: "NextGen Fullstack Fellowship",
        campaign: "Fellowship 2026",
        brand: "CobraLearn Tech",
        description: "Selective fellowship for high-impact developers.",
        fullDescription: "Fullstack web and systems engineering mentorship.",
        campaignUrl: "https://cobralearn.com/fellowship",
        status: "PUBLISHED",
        thumbnailId: "media-ad-banner-1",
        displayOrder: 2,
        showOnHomepage: true,
      },
      prisma
    );

    expect(createdRes.advertisement.slug).toBe("nextgen-fullstack-fellowship");

    // 2. Query public showcase endpoint
    const publicRes = await getPublicAdvertisementsOperation(prisma);
    expect(publicRes.advertisements).toHaveLength(2);

    // 3. Map to public showcase items
    const showcaseItems = publicRes.advertisements.map(advertisementToShowcaseItem);
    expect(showcaseItems[1]?.title).toBe("NextGen Fullstack Fellowship");
    expect(showcaseItems[1]?.slug).toBe("nextgen-fullstack-fellowship");
    expect(showcaseItems[1]?.accent).toBe("red");
    expect(showcaseItems[1]?.image).toBe("https://storage.cobralearn.com/media-library/advertisements/ai-bootcamp-banner.png");
    expect(showcaseItems[1]?.published).toBe(true);

    // 4. Query public detail route by slug
    const detailRes = await getPublicAdvertisementBySlugOperation("nextgen-fullstack-fellowship", prisma);
    expect(detailRes.advertisement).not.toBeNull();
    const publicDetail = advertisementToPublicDetailItem(detailRes.advertisement!);
    expect(publicDetail.brand).toBe("CobraLearn Tech");
    expect(publicDetail.campaign).toBe("Fellowship 2026");
    expect(publicDetail.liveUrl).toBe("https://cobralearn.com/fellowship");
    expect(publicDetail.fullDescription).toBe("Fullstack web and systems engineering mentorship.");
  });

  it("AUDIT CHECK 2: Thumbnail & Asset Integrity (Real MediaAsset preserved, no mock fallback)", async () => {
    const publicRes = await getPublicAdvertisementsOperation(prisma);
    const item = advertisementToShowcaseItem(publicRes.advertisements[0]!);
    expect(item.image).toBe("https://storage.cobralearn.com/media-library/advertisements/ai-bootcamp-banner.png");
    expect(item.image).not.toContain("thumb-ad.jpg");
    expect(item.image).not.toContain("placeholder");

    // Deletion protection for referenced asset
    const req = createAuthRequest(adminUser, "aal2");
    await expect(
      deleteAdminMediaAssetOperation(req, "media-ad-banner-1", prisma, { from: () => ({ remove: vi.fn() }) } as any)
    ).rejects.toThrow(/Referential Integrity Error.*thumbnail for Advertisement\(s\)/i);
  });

  it("AUDIT CHECK 3: Publication Lifecycle (Draft and Archived strictly hidden from public)", async () => {
    const req = createAuthRequest(adminUser);

    // Unpublish to DRAFT
    await updateAdminAdvertisementOperation(
      req,
      "ad-persisted-1",
      { status: "DRAFT" },
      prisma
    );

    // Public list must now be empty
    const publicList = await getPublicAdvertisementsOperation(prisma);
    expect(publicList.advertisements).toHaveLength(0);

    // Public detail route for slug must return null (404)
    const publicDetail = await getPublicAdvertisementBySlugOperation("ai-engineering-bootcamp-2026", prisma);
    expect(publicDetail.advertisement).toBeNull();

    // Transition to ARCHIVED
    await updateAdminAdvertisementOperation(
      req,
      "ad-persisted-1",
      { status: "ARCHIVED" },
      prisma
    );

    const archivedDetail = await getPublicAdvertisementBySlugOperation("ai-engineering-bootcamp-2026", prisma);
    expect(archivedDetail.advertisement).toBeNull();
  });

  it("AUDIT CHECK 4: Empty state integrity (No fallback to INITIAL_ADVERTISEMENTS)", async () => {
    mockAdvertisements = [];
    const publicRes = await getPublicAdvertisementsOperation(prisma);
    expect(publicRes.advertisements).toEqual([]);
    const showcaseItems = publicRes.advertisements.map(advertisementToShowcaseItem);
    expect(showcaseItems).toHaveLength(0);
  });

  it("AUDIT CHECK 5: Reordering persistence", async () => {
    // Add second ad
    mockAdvertisements.push({
      id: "ad-persisted-2",
      slug: "ad-second",
      name: "Second Ad",
      campaign: "C2",
      brand: "B2",
      campaignType: null,
      description: "D2",
      fullDescription: null,
      startDate: null,
      endDate: null,
      date: "2026",
      campaignUrl: null,
      status: "PUBLISHED",
      featured: false,
      showOnHomepage: true,
      displayOrder: 2,
      thumbnailId: "media-ad-banner-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = createAuthRequest(adminUser);
    const reorderRes = await reorderAdminAdvertisementsOperation(
      req,
      ["ad-persisted-2", "ad-persisted-1"],
      prisma
    );
    expect(reorderRes.success).toBe(true);

    const publicList = await getPublicAdvertisementsOperation(prisma);
    expect(publicList.advertisements[0]?.id).toBe("ad-persisted-2");
    expect(publicList.advertisements[1]?.id).toBe("ad-persisted-1");
  });
});
