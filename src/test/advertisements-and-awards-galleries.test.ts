import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAdminAdvertisementOperation,
  updateAdminAdvertisementOperation,
  getAdminAdvertisementByIdOperation,
  getPublicAdvertisementBySlugOperation,
} from "@/lib/server/advertisements-operations";
import {
  createAdminAwardOperation,
  updateAdminAwardOperation,
  getAdminAwardByIdOperation,
  getPublicAwardBySlugOperation,
} from "@/lib/server/awards-operations";
import { deleteAdminMediaAssetOperation } from "@/lib/server/media-operations";
import { advertisementToItem, advertisementToPublicDetailItem } from "@/lib/advertisements-data";
import { awardToItem, awardToPublicDetailItem } from "@/lib/awards-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PrismaClient,
  Advertisement,
  Award,
  AdvertisementGalleryItem,
  AwardGalleryItem,
  MediaAsset,
  AdminAuditLog,
} from "@prisma/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Persistent Galleries: Advertisements & Awards Modules Only", () => {
  const adminUuid = "44444444-4444-4444-4444-444444444444";
  const editorUuid = "55555555-5555-5555-5555-555555555555";

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

  function createAuthRequest(user: User | null): Request {
    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : { message: "Invalid session" },
        }),
      },
    });

    return new Request("https://api.internal/admin/gallery-test", {
      headers: {
        authorization: user ? `Bearer mock-token-for-${user.id}` : "",
      },
    });
  }

  let mockMediaAssets: MediaAsset[] = [];
  let mockAdvertisements: Advertisement[] = [];
  let mockAdGalleryItems: AdvertisementGalleryItem[] = [];
  let mockAwards: Award[] = [];
  let mockAwardGalleryItems: AwardGalleryItem[] = [];
  let mockAuditLogs: AdminAuditLog[] = [];

  beforeEach(() => {
    vi.clearAllMocks();

    mockMediaAssets = [
      {
        id: "media-thumb-ad",
        name: "ad-thumb.png",
        originalFilename: "ad-thumb.png",
        mimeType: "image/png",
        size: 1024,
        bucket: "media-library",
        storagePath: "ads/ad-thumb.png",
        publicUrl: "https://cdn.example.com/ads/ad-thumb.png",
        category: "ADVERTISEMENTS",
        altText: "Ad Thumbnail",
        tags: ["banner"],
        description: null,
        width: 800,
        height: 600,
        uploadedById: adminUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "media-thumb-aw",
        name: "aw-thumb.png",
        originalFilename: "aw-thumb.png",
        mimeType: "image/png",
        size: 1024,
        bucket: "media-library",
        storagePath: "awards/aw-thumb.png",
        publicUrl: "https://cdn.example.com/awards/aw-thumb.png",
        category: "AWARDS",
        altText: "Award Certificate",
        tags: ["certificate"],
        description: null,
        width: 800,
        height: 600,
        uploadedById: adminUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ...[1, 2, 3, 4, 5, 6].map((i) => ({
        id: `media-gallery-${i}`,
        name: `gallery-image-${i}.png`,
        originalFilename: `gallery-image-${i}.png`,
        mimeType: "image/png",
        size: 2048,
        bucket: "media-library",
        storagePath: `gallery/gallery-image-${i}.png`,
        publicUrl: `https://cdn.example.com/gallery/gallery-image-${i}.png`,
        category: "ADVERTISEMENTS" as const,
        altText: `Gallery item ${i}`,
        tags: [],
        description: null,
        width: 1200,
        height: 800,
        uploadedById: adminUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    ];

    mockAdvertisements = [];
    mockAdGalleryItems = [];
    mockAwards = [];
    mockAwardGalleryItems = [];
    mockAuditLogs = [];
  });

  function createMockPrisma(): PrismaClient {
    const prismaInstance: any = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          if (where.userId === adminUuid || where.id === adminUuid || where.email === "admin@cobralearn.com") {
            return Promise.resolve({
              id: adminUuid,
              userId: adminUuid,
              email: "admin@cobralearn.com",
              role: "ADMIN",
              isActive: true,
              fullName: "Admin User",
            });
          }
          if (where.userId === editorUuid || where.id === editorUuid || where.email === "editor@cobralearn.com") {
            return Promise.resolve({
              id: editorUuid,
              userId: editorUuid,
              email: "editor@cobralearn.com",
              role: "EDITOR",
              isActive: true,
              fullName: "Editor User",
            });
          }
          return Promise.resolve(null);
        }),
      },
      mediaAsset: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          const match = mockMediaAssets.find((m) => m.id === where.id);
          if (!match) return Promise.resolve(null);
          return Promise.resolve({
            ...match,
            projectThumbnails: [],
            projectGalleryItems: [],
            websiteThumbnails: [],
            websiteGalleryItems: [],
            advertisementThumbnails: mockAdvertisements
              .filter((a) => a.thumbnailId === match.id)
              .map((a) => ({ id: a.id, name: a.name })),
            awardThumbnails: mockAwards
              .filter((a) => a.thumbnailId === match.id)
              .map((a) => ({ id: a.id, name: a.name })),
            advertisementGalleryItems: mockAdGalleryItems
              .filter((g) => g.mediaId === match.id)
              .map((g) => {
                const parent = mockAdvertisements.find((a) => a.id === g.advertisementId);
                return {
                  id: g.id,
                  advertisementId: g.advertisementId,
                  advertisement: { id: g.advertisementId, name: parent?.name || "Advertisement" },
                };
              }),
            awardGalleryItems: mockAwardGalleryItems
              .filter((g) => g.mediaId === match.id)
              .map((g) => {
                const parent = mockAwards.find((a) => a.id === g.awardId);
                return {
                  id: g.id,
                  awardId: g.awardId,
                  award: { id: g.awardId, name: parent?.name || "Award" },
                };
              }),
            appearanceLogos: [],
            appearanceFavicons: [],
            homepageSections: [],
          });
        }),
        findMany: vi.fn().mockImplementation(({ where }: any) => {
          const ids: string[] = where?.id?.in || [];
          const matches = mockMediaAssets.filter((m) => ids.includes(m.id));
          return Promise.resolve(matches);
        }),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          const idx = mockMediaAssets.findIndex((m) => m.id === where.id);
          if (idx === -1) return Promise.reject(new Error("MediaAsset not found"));
          const [deleted] = mockMediaAssets.splice(idx, 1);
          return Promise.resolve(deleted);
        }),
      },
      advertisement: {
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          const idOrSlug = where?.OR?.[0]?.id || where?.slug;
          let match = mockAdvertisements.find(
            (a) => a.id === idOrSlug || a.slug === idOrSlug
          );
          if (where?.status && match && match.status !== where.status) {
            match = undefined;
          }
          if (!match) return Promise.resolve(null);
          const gallery = mockAdGalleryItems
            .filter((g) => g.advertisementId === match.id)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((g) => ({
              ...g,
              media: mockMediaAssets.find((m) => m.id === g.mediaId) || null,
            }));
          return Promise.resolve({
            ...match,
            thumbnail: mockMediaAssets.find((m) => m.id === match.thumbnailId) || null,
            gallery,
          });
        }),
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          const match = mockAdvertisements.find((a) =>
            where.id ? a.id === where.id : a.slug === where.slug
          );
          if (!match) return Promise.resolve(null);
          const gallery = mockAdGalleryItems
            .filter((g) => g.advertisementId === match.id)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((g) => ({
              ...g,
              media: mockMediaAssets.find((m) => m.id === g.mediaId) || null,
            }));
          return Promise.resolve({
            ...match,
            thumbnail: mockMediaAssets.find((m) => m.id === match.thumbnailId) || null,
            gallery,
          });
        }),
        findUniqueOrThrow: vi.fn().mockImplementation(({ where }: any) => {
          const match = mockAdvertisements.find((a) =>
            where.id ? a.id === where.id : a.slug === where.slug
          );
          if (!match) throw new Error("Advertisement not found");
          const gallery = mockAdGalleryItems
            .filter((g) => g.advertisementId === match.id)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((g) => ({
              ...g,
              media: mockMediaAssets.find((m) => m.id === g.mediaId) || null,
            }));
          return Promise.resolve({
            ...match,
            thumbnail: mockMediaAssets.find((m) => m.id === match.thumbnailId) || null,
            gallery,
          });
        }),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const newAd: Advertisement = {
            id: `ad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: data.name,
            slug: data.slug,
            campaign: data.campaign,
            brand: data.brand,
            description: data.description,
            fullDescription: data.fullDescription ?? null,
            campaignType: data.campaignType ?? null,
            startDate: data.startDate ?? null,
            endDate: data.endDate ?? null,
            date: data.date ?? "Oct 2026",
            campaignUrl: data.campaignUrl ?? null,
            status: data.status ?? "DRAFT",
            featured: data.featured ?? false,
            showOnHomepage: data.showOnHomepage ?? false,
            displayOrder: data.displayOrder ?? 1,
            thumbnailId: data.thumbnailId ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockAdvertisements.push(newAd);
          return Promise.resolve(newAd);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = mockAdvertisements.findIndex((a) => a.id === where.id);
          if (idx === -1) return Promise.reject(new Error("Advertisement not found"));
          mockAdvertisements[idx] = {
            ...mockAdvertisements[idx]!,
            ...data,
            updatedAt: new Date(),
          };
          return Promise.resolve(mockAdvertisements[idx]!);
        }),
      },
      advertisementGalleryItem: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          const item: AdvertisementGalleryItem = {
            id: `ad-gal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            advertisementId: data.advertisementId,
            mediaId: data.mediaId,
            displayOrder: data.displayOrder,
          };
          mockAdGalleryItems.push(item);
          return Promise.resolve(item);
        }),
        deleteMany: vi.fn().mockImplementation(({ where }: any) => {
          if (where.advertisementId) {
            mockAdGalleryItems = mockAdGalleryItems.filter(
              (g) => g.advertisementId !== where.advertisementId
            );
          }
          return Promise.resolve({ count: 1 });
        }),
      },
      award: {
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          const idOrSlug = where?.OR?.[0]?.id || where?.slug;
          let match = mockAwards.find(
            (a) => a.id === idOrSlug || a.slug === idOrSlug
          );
          if (where?.status && match && match.status !== where.status) {
            match = undefined;
          }
          if (!match) return Promise.resolve(null);
          const gallery = mockAwardGalleryItems
            .filter((g) => g.awardId === match.id)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((g) => ({
              ...g,
              media: mockMediaAssets.find((m) => m.id === g.mediaId) || null,
            }));
          return Promise.resolve({
            ...match,
            thumbnail: mockMediaAssets.find((m) => m.id === match.thumbnailId) || null,
            gallery,
          });
        }),
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          const match = mockAwards.find((a) =>
            where.id ? a.id === where.id : a.slug === where.slug
          );
          if (!match) return Promise.resolve(null);
          const gallery = mockAwardGalleryItems
            .filter((g) => g.awardId === match.id)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((g) => ({
              ...g,
              media: mockMediaAssets.find((m) => m.id === g.mediaId) || null,
            }));
          return Promise.resolve({
            ...match,
            thumbnail: mockMediaAssets.find((m) => m.id === match.thumbnailId) || null,
            gallery,
          });
        }),
        findUniqueOrThrow: vi.fn().mockImplementation(({ where }: any) => {
          const match = mockAwards.find((a) =>
            where.id ? a.id === where.id : a.slug === where.slug
          );
          if (!match) throw new Error("Award not found");
          const gallery = mockAwardGalleryItems
            .filter((g) => g.awardId === match.id)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((g) => ({
              ...g,
              media: mockMediaAssets.find((m) => m.id === g.mediaId) || null,
            }));
          return Promise.resolve({
            ...match,
            thumbnail: mockMediaAssets.find((m) => m.id === match.thumbnailId) || null,
            gallery,
          });
        }),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const newAward: Award = {
            id: `aw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: data.name,
            slug: data.slug,
            context: data.context,
            organization: data.organization,
            category: data.category,
            description: data.description,
            fullDescription: data.fullDescription ?? null,
            credentialUrl: data.credentialUrl ?? null,
            status: data.status ?? "DRAFT",
            date: data.date ?? "Oct 2026",
            displayOrder: data.displayOrder ?? 1,
            showOnHomepage: data.showOnHomepage ?? true,
            thumbnailId: data.thumbnailId ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockAwards.push(newAward);
          return Promise.resolve(newAward);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = mockAwards.findIndex((a) => a.id === where.id);
          if (idx === -1) return Promise.reject(new Error("Award not found"));
          mockAwards[idx] = {
            ...mockAwards[idx]!,
            ...data,
            updatedAt: new Date(),
          };
          return Promise.resolve(mockAwards[idx]!);
        }),
      },
      awardGalleryItem: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          const item: AwardGalleryItem = {
            id: `aw-gal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            awardId: data.awardId,
            mediaId: data.mediaId,
            displayOrder: data.displayOrder,
          };
          mockAwardGalleryItems.push(item);
          return Promise.resolve(item);
        }),
        deleteMany: vi.fn().mockImplementation(({ where }: any) => {
          if (where.awardId) {
            mockAwardGalleryItems = mockAwardGalleryItems.filter(
              (g) => g.awardId !== where.awardId
            );
          }
          return Promise.resolve({ count: 1 });
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          const log: AdminAuditLog = {
            id: `log-${Date.now()}`,
            userId: data.actorId || data.userId,
            action: data.action,
            entityType: data.module || data.entityType,
            entityId: data.entityId,
            details: data.metadata || data.details,
            ipAddress: data.ipAddress ?? null,
            userAgent: data.userAgent ?? null,
            createdAt: new Date(),
          };
          mockAuditLogs.push(log);
          return Promise.resolve(log);
        }),
      },
      $transaction: vi.fn().mockImplementation(async (callback: any) => {
        return callback(prismaInstance);
      }),
    };

    return prismaInstance;
  }

  // ── SECTION 1: Advertisement Gallery Operations ──

  describe("1. Advertisement Gallery Persistence & Validations", () => {
    it("creates an advertisement with up to 5 gallery images in sequential display order", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const res = await createAdminAdvertisementOperation(
        req,
        {
          name: "Global AI Hackathon Promo",
          campaign: "Hackathons 2026",
          brand: "CobraLearn Tech",
          description: "Promoting upcoming multi-track hackathon.",
          thumbnailId: "media-thumb-ad",
          galleryMediaIds: ["media-gallery-1", "media-gallery-2", "media-gallery-3"],
          status: "DRAFT",
        },
        prisma
      );

      expect(res.advertisement).toBeDefined();
      expect(mockAdGalleryItems).toHaveLength(3);
      expect(mockAdGalleryItems.map((g) => g.mediaId)).toEqual([
        "media-gallery-1",
        "media-gallery-2",
        "media-gallery-3",
      ]);
      expect(mockAdGalleryItems.map((g) => g.displayOrder)).toEqual([0, 1, 2]);
    });

    it("rejects an advertisement with more than 5 gallery images (excluding thumbnail)", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminAdvertisementOperation(
          req,
          {
            name: "Too Many Gallery Images",
            campaign: "Overload",
            brand: "CobraLearn",
            description: "Testing strict 5-image boundary.",
            thumbnailId: "media-thumb-ad",
            galleryMediaIds: [
              "media-gallery-1",
              "media-gallery-2",
              "media-gallery-3",
              "media-gallery-4",
              "media-gallery-5",
              "media-gallery-6",
            ],
            status: "DRAFT",
          },
          prisma
        )
      ).rejects.toThrow(/maximum of 5 gallery images/i);

      expect(mockAdvertisements).toHaveLength(0);
      expect(mockAdGalleryItems).toHaveLength(0);
    });

    it("rejects duplicate MediaAsset IDs in gallery payload", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminAdvertisementOperation(
          req,
          {
            name: "Duplicate Gallery IDs",
            campaign: "Duplicates",
            brand: "CobraLearn",
            description: "Testing duplicate rejection.",
            thumbnailId: "media-thumb-ad",
            galleryMediaIds: ["media-gallery-1", "media-gallery-2", "media-gallery-1"],
            status: "DRAFT",
          },
          prisma
        )
      ).rejects.toThrow(/duplicate/i);
    });

    it("rejects invalid or non-existent MediaAsset IDs in gallery payload", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminAdvertisementOperation(
          req,
          {
            name: "Invalid Media ID",
            campaign: "Invalid",
            brand: "CobraLearn",
            description: "Testing non-existent media lookup.",
            thumbnailId: "media-thumb-ad",
            galleryMediaIds: ["non-existent-media-uuid"],
            status: "DRAFT",
          },
          prisma
        )
      ).rejects.toThrow(/not found/i);
    });

    it("updates an advertisement gallery: adds, removes, and reorders images atomically", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      // Create initial ad with 2 gallery images
      const createRes = await createAdminAdvertisementOperation(
        req,
        {
          name: "Summer Coding Bootcamp",
          campaign: "Summer 2026",
          brand: "CobraLearn",
          description: "Comprehensive summer immersion.",
          thumbnailId: "media-thumb-ad",
          galleryMediaIds: ["media-gallery-1", "media-gallery-2"],
          status: "DRAFT",
        },
        prisma
      );

      const adId = createRes.advertisement.id;

      // Update to swap order and replace media-gallery-2 with media-gallery-3 & 4
      const updateRes = await updateAdminAdvertisementOperation(
        req,
        adId,
        {
          galleryMediaIds: ["media-gallery-4", "media-gallery-1", "media-gallery-3"],
        },
        prisma
      );

      expect(updateRes.advertisement).toBeDefined();
      expect(mockAdGalleryItems).toHaveLength(3);
      expect(mockAdGalleryItems.map((g) => g.mediaId)).toEqual([
        "media-gallery-4",
        "media-gallery-1",
        "media-gallery-3",
      ]);
      expect(mockAdGalleryItems.map((g) => g.displayOrder)).toEqual([0, 1, 2]);

      // Verify that thumbnail remains completely untouched
      const adInDb = mockAdvertisements.find((a) => a.id === adId);
      expect(adInDb?.thumbnailId).toBe("media-thumb-ad");
    });

    it("reloads persisted gallery items in correct order via getAdminAdvertisementByIdOperation", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const createRes = await createAdminAdvertisementOperation(
        req,
        {
          name: "Spring Tech Workshop",
          campaign: "Workshops",
          brand: "CobraLearn",
          description: "Hands-on engineering workshop.",
          thumbnailId: "media-thumb-ad",
          galleryMediaIds: ["media-gallery-2", "media-gallery-1"],
          status: "PUBLISHED",
        },
        prisma
      );

      const adId = createRes.advertisement.id;
      const getRes = await getAdminAdvertisementByIdOperation(req, adId, prisma);

      expect(getRes.advertisement).toBeDefined();
      expect(getRes.advertisement!.gallery).toHaveLength(2);
      expect(getRes.advertisement!.gallery![0].mediaId).toBe("media-gallery-2");
      expect(getRes.advertisement!.gallery![1].mediaId).toBe("media-gallery-1");
    });
  });

  // ── SECTION 2: Award Gallery Operations ──

  describe("2. Award Gallery Persistence & Validations", () => {
    it("creates an award with up to 5 gallery images in sequential display order", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const res = await createAdminAwardOperation(
        req,
        {
          name: "National Tech Innovation Award",
          context: "Annual Engineering Summit",
          organization: "Govt Science Council",
          category: "Institutional",
          description: "Recognized for excellence in interactive education.",
          thumbnailId: "media-thumb-aw",
          galleryMediaIds: ["media-gallery-1", "media-gallery-2"],
          status: "DRAFT",
        },
        prisma
      );

      expect(res.award).toBeDefined();
      expect(mockAwardGalleryItems).toHaveLength(2);
      expect(mockAwardGalleryItems.map((g) => g.mediaId)).toEqual([
        "media-gallery-1",
        "media-gallery-2",
      ]);
      expect(mockAwardGalleryItems.map((g) => g.displayOrder)).toEqual([0, 1]);
    });

    it("rejects an award with more than 5 gallery images", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminAwardOperation(
          req,
          {
            name: "Exceeded Limit Award",
            context: "Limit Testing",
            organization: "Audit Committee",
            category: "Technical",
            description: "Exceeding 5 gallery images.",
            thumbnailId: "media-thumb-aw",
            galleryMediaIds: [
              "media-gallery-1",
              "media-gallery-2",
              "media-gallery-3",
              "media-gallery-4",
              "media-gallery-5",
              "media-gallery-6",
            ],
            status: "DRAFT",
          },
          prisma
        )
      ).rejects.toThrow(/maximum of 5 gallery images/i);

      expect(mockAwards).toHaveLength(0);
      expect(mockAwardGalleryItems).toHaveLength(0);
    });

    it("rejects duplicate and invalid MediaAsset IDs for awards", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      // Duplicates
      await expect(
        createAdminAwardOperation(
          req,
          {
            name: "Duplicate Award Media",
            context: "Testing",
            organization: "Audit",
            category: "Technical",
            description: "Duplicate media test.",
            thumbnailId: "media-thumb-aw",
            galleryMediaIds: ["media-gallery-1", "media-gallery-1"],
            status: "DRAFT",
          },
          prisma
        )
      ).rejects.toThrow(/duplicate/i);

      // Invalid ID
      await expect(
        createAdminAwardOperation(
          req,
          {
            name: "Invalid Award Media",
            context: "Testing",
            organization: "Audit",
            category: "Technical",
            description: "Invalid media test.",
            thumbnailId: "media-thumb-aw",
            galleryMediaIds: ["unknown-id"],
            status: "DRAFT",
          },
          prisma
        )
      ).rejects.toThrow(/not found/i);
    });

    it("updates award gallery images, allows clearing gallery, and preserves certificate thumbnail", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const createRes = await createAdminAwardOperation(
        req,
        {
          name: "Best Educational Platform",
          context: "Global EdTech Summit",
          organization: "EdTech World",
          category: "Institutional",
          description: "Outstanding interactive curriculum.",
          thumbnailId: "media-thumb-aw",
          galleryMediaIds: ["media-gallery-1", "media-gallery-2"],
          status: "DRAFT",
        },
        prisma
      );

      const awardId = createRes.award.id;

      // Update to empty gallery
      const updateRes = await updateAdminAwardOperation(
        req,
        awardId,
        {
          galleryMediaIds: [],
        },
        prisma
      );

      expect(updateRes.award).toBeDefined();
      expect(mockAwardGalleryItems).toHaveLength(0);

      // Certificate thumbnail remains intact
      const awardInDb = mockAwards.find((a) => a.id === awardId);
      expect(awardInDb?.thumbnailId).toBe("media-thumb-aw");
    });
  });

  // ── SECTION 3: Media Deletion Protection ──

  describe("3. Media Deletion Protection for Galleries", () => {
    it("blocks deletion of a MediaAsset referenced by an Advertisement gallery with 409 Conflict", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      // Attach media-gallery-1 to an advertisement
      await createAdminAdvertisementOperation(
        req,
        {
          name: "Banner Campaign",
          campaign: "Spring",
          brand: "CobraLearn",
          description: "Campaign ad.",
          thumbnailId: "media-thumb-ad",
          galleryMediaIds: ["media-gallery-1"],
          status: "DRAFT",
        },
        prisma
      );

      // Attempt to delete media-gallery-1
      const storageMock: any = {
        storage: {
          from: vi.fn().mockReturnValue({
            remove: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        },
      };
      await expect(
        deleteAdminMediaAssetOperation(req, "media-gallery-1", prisma, storageMock)
      ).rejects.toThrow(/gallery item in.*Advertisement/i);

      // Asset still exists in database
      expect(mockMediaAssets.some((m) => m.id === "media-gallery-1")).toBe(true);
    });

    it("blocks deletion of a MediaAsset referenced by an Award gallery with 409 Conflict", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);
      const storageMock: any = {
        storage: {
          from: vi.fn().mockReturnValue({
            remove: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        },
      };

      // Attach media-gallery-2 to an award
      await createAdminAwardOperation(
        req,
        {
          name: "Innovation Trophy",
          context: "Tech Summit",
          organization: "Council",
          category: "Institutional",
          description: "Trophy award.",
          thumbnailId: "media-thumb-aw",
          galleryMediaIds: ["media-gallery-2"],
          status: "DRAFT",
        },
        prisma
      );

      // Attempt to delete media-gallery-2
      await expect(
        deleteAdminMediaAssetOperation(req, "media-gallery-2", prisma, storageMock)
      ).rejects.toThrow(/gallery item in.*Award/i);

      expect(mockMediaAssets.some((m) => m.id === "media-gallery-2")).toBe(true);
    });

    it("allows deletion of MediaAsset once removed from gallery", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);
      const storageMock: any = {
        storage: {
          from: vi.fn().mockReturnValue({
            remove: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        },
      };

      const createRes = await createAdminAdvertisementOperation(
        req,
        {
          name: "Removable Asset Campaign",
          campaign: "Spring",
          brand: "CobraLearn",
          description: "Temporary gallery item.",
          thumbnailId: "media-thumb-ad",
          galleryMediaIds: ["media-gallery-5"],
          status: "DRAFT",
        },
        prisma
      );

      const adId = createRes.advertisement.id;

      // Remove from ad gallery
      await updateAdminAdvertisementOperation(
        req,
        adId,
        {
          galleryMediaIds: [],
        },
        prisma
      );

      // Now deletion succeeds
      const delRes = await deleteAdminMediaAssetOperation(req, "media-gallery-5", prisma, storageMock);
      expect(delRes.success).toBe(true);
      expect(mockMediaAssets.some((m) => m.id === "media-gallery-5")).toBe(false);
    });
  });

  // ── SECTION 4: Public Visibility & Detail Mapping ──

  describe("4. Public Detail Rendering & Data Mapping", () => {
    it("public detail fetches published ad gallery in persisted order", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const createRes = await createAdminAdvertisementOperation(
        req,
        {
          name: "Public Workshop Launch",
          campaign: "Workshops 2026",
          brand: "CobraLearn",
          description: "Public workshop showcase.",
          thumbnailId: "media-thumb-ad",
          galleryMediaIds: ["media-gallery-3", "media-gallery-1"],
          status: "PUBLISHED",
        },
        prisma
      );

      const slug = createRes.advertisement.slug;
      const publicRes = await getPublicAdvertisementBySlugOperation(slug, prisma);

      expect(publicRes.advertisement).toBeDefined();
      expect(publicRes.advertisement.gallery).toHaveLength(2);
      expect(publicRes.advertisement.gallery![0].mediaId).toBe("media-gallery-3");
      expect(publicRes.advertisement.gallery![1].mediaId).toBe("media-gallery-1");

      // Verify public detail mapper maps gallery items
      const detailItem = advertisementToPublicDetailItem(publicRes.advertisement);
      expect(detailItem.gallery).toBeDefined();
      expect(detailItem.gallery).toHaveLength(2);
      expect(detailItem.gallery![0].url).toBe("https://cdn.example.com/gallery/gallery-image-3.png");
    });

    it("public detail blocks draft or archived advertisements from public detail query", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const createRes = await createAdminAdvertisementOperation(
        req,
        {
          name: "Draft Secret Ad",
          campaign: "Secret",
          brand: "CobraLearn",
          description: "Not yet published.",
          thumbnailId: "media-thumb-ad",
          galleryMediaIds: ["media-gallery-1"],
          status: "DRAFT",
        },
        prisma
      );

      const slug = createRes.advertisement.slug;
      const publicRes = await getPublicAdvertisementBySlugOperation(slug, prisma);
      expect(publicRes.advertisement).toBeNull();
    });

    it("public detail fetches published award gallery in persisted order", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const createRes = await createAdminAwardOperation(
        req,
        {
          name: "Gold Trophy 2026",
          context: "Tech Summit",
          organization: "Council",
          category: "Institutional",
          description: "Top honors in computing education.",
          thumbnailId: "media-thumb-aw",
          galleryMediaIds: ["media-gallery-2", "media-gallery-4"],
          status: "PUBLISHED",
        },
        prisma
      );

      const slug = createRes.award.slug;
      const publicRes = await getPublicAwardBySlugOperation(slug, prisma);

      expect(publicRes.award).toBeDefined();
      expect(publicRes.award.gallery).toHaveLength(2);
      expect(publicRes.award.gallery![0].mediaId).toBe("media-gallery-2");
      expect(publicRes.award.gallery![1].mediaId).toBe("media-gallery-4");

      const detailItem = awardToPublicDetailItem(publicRes.award);
      expect(detailItem.gallery).toBeDefined();
      expect(detailItem.gallery).toHaveLength(2);
      expect(detailItem.gallery![0].url).toBe("https://cdn.example.com/gallery/gallery-image-2.png");
    });

    it("public detail blocks draft awards from public route", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const createRes = await createAdminAwardOperation(
        req,
        {
          name: "Draft Award Trophy",
          context: "Internal",
          organization: "Internal Org",
          category: "Technical",
          description: "Draft award item.",
          thumbnailId: "media-thumb-aw",
          galleryMediaIds: ["media-gallery-1"],
          status: "DRAFT",
        },
        prisma
      );

      const slug = createRes.award.slug;
      const publicRes = await getPublicAwardBySlugOperation(slug, prisma);
      expect(publicRes.award).toBeNull();
    });
  });

  // ── SECTION 5: Authorization & RBAC ──

  describe("5. RBAC & Server Authorization", () => {
    it("allows EDITOR role to create and update advertisements and awards with galleries", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(editorUser);

      const adRes = await createAdminAdvertisementOperation(
        req,
        {
          name: "Editor Campaign Ad",
          campaign: "Spring",
          brand: "CobraLearn",
          description: "Created by editor.",
          thumbnailId: "media-thumb-ad",
          galleryMediaIds: ["media-gallery-1"],
          status: "DRAFT",
        },
        prisma
      );
      expect(adRes.advertisement).toBeDefined();

      const awRes = await createAdminAwardOperation(
        req,
        {
          name: "Editor Created Award",
          context: "Spring Tech",
          organization: "Org",
          category: "Community",
          description: "Created by editor.",
          thumbnailId: "media-thumb-aw",
          galleryMediaIds: ["media-gallery-2"],
          status: "DRAFT",
        },
        prisma
      );
      expect(awRes.award).toBeDefined();
    });

    it("rejects unauthenticated requests to create or update galleries with 401 Unauthorized", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(null);

      await expect(
        createAdminAdvertisementOperation(
          req,
          {
            name: "Unauth Ad",
            campaign: "Hacking",
            brand: "None",
            description: "Should fail.",
            thumbnailId: "media-thumb-ad",
            galleryMediaIds: ["media-gallery-1"],
            status: "DRAFT",
          },
          prisma
        )
      ).rejects.toThrow(/unauthorized|authentication|no cookie/i);

      await expect(
        createAdminAwardOperation(
          req,
          {
            name: "Unauth Award",
            context: "Hacking",
            organization: "None",
            category: "Technical",
            description: "Should fail.",
            thumbnailId: "media-thumb-aw",
            galleryMediaIds: ["media-gallery-1"],
            status: "DRAFT",
          },
          prisma
        )
      ).rejects.toThrow(/unauthorized|authentication|no cookie/i);
    });
  });
});
