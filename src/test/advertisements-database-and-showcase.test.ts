import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAdminAdvertisementsOperation,
  getAdminAdvertisementByIdOperation,
  createAdminAdvertisementOperation,
  updateAdminAdvertisementOperation,
  deleteAdminAdvertisementOperation,
  reorderAdminAdvertisementsOperation,
  getPublicAdvertisementsOperation,
  getPublicAdvertisementBySlugOperation,
  slugify,
} from "@/lib/server/advertisements-operations";
import { deleteAdminMediaAssetOperation } from "@/lib/server/media-operations";
import {
  advertisementToItem,
  advertisementToShowcaseItem,
  advertisementToPublicDetailItem,
  statusToPrisma,
  statusFromPrisma,
} from "@/lib/advertisements-data";
import { adminClient } from "@/lib/api/admin-client";
import {
  listAdminAdvertisementsServerFn,
  getAdminAdvertisementByIdServerFn,
  createAdminAdvertisementServerFn,
  updateAdminAdvertisementServerFn,
  deleteAdminAdvertisementServerFn,
  reorderAdminAdvertisementsServerFn,
  getPublicAdvertisementsServerFn,
  getPublicAdvertisementBySlugServerFn,
} from "@/lib/server/advertisements-server-fns";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase/browser";
import type { PrismaClient, Advertisement, AdminAuditLog, PublishStatus, MediaAsset } from "@prisma/client";
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

vi.mock("@/lib/server/advertisements-server-fns", () => ({
  listAdminAdvertisementsServerFn: vi.fn().mockImplementation(async () => ({
    advertisements: [
      {
        id: "ad-1",
        name: "Spring Tech Workshop",
        slug: "spring-tech-workshop",
        campaign: "Workshop 2026",
        brand: "CobraLearn",
        description: "Hands-on engineering workshop for builders.",
        status: "PUBLISHED",
        featured: false,
        showOnHomepage: true,
        displayOrder: 1,
        date: "Apr 2026",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  })),
  getAdminAdvertisementByIdServerFn: vi.fn().mockImplementation(async ({ data }: any) => {
    if (data?.idOrSlug === "ad-1" || data?.idOrSlug === "spring-tech-workshop") {
      return {
        advertisement: {
          id: "ad-1",
          name: "Spring Tech Workshop",
          slug: "spring-tech-workshop",
          campaign: "Workshop 2026",
          brand: "CobraLearn",
          description: "Hands-on engineering workshop for builders.",
          status: "PUBLISHED",
          date: "Apr 2026",
        },
      };
    }
    return { advertisement: null };
  }),
  createAdminAdvertisementServerFn: vi.fn().mockImplementation(async ({ data }: any) => ({
    advertisement: {
      id: "new-ad",
      ...data.payload,
    },
  })),
  updateAdminAdvertisementServerFn: vi.fn().mockImplementation(async ({ data }: any) => ({
    advertisement: {
      id: data.id,
      ...data.payload,
    },
  })),
  deleteAdminAdvertisementServerFn: vi.fn().mockImplementation(async () => ({
    success: true,
  })),
  reorderAdminAdvertisementsServerFn: vi.fn().mockImplementation(async () => ({
    success: true,
  })),
  getPublicAdvertisementsServerFn: vi.fn().mockImplementation(async () => ({
    advertisements: [
      {
        id: "ad-pub-1",
        name: "Public Ad",
        slug: "public-ad",
        campaign: "Camp",
        brand: "Brand",
        description: "Desc",
        status: "PUBLISHED",
        showOnHomepage: true,
        displayOrder: 1,
        date: "Oct 2026",
      },
    ],
  })),
  getPublicAdvertisementBySlugServerFn: vi.fn().mockImplementation(async ({ data }: any) => {
    if (data?.slug === "public-ad") {
      return {
        advertisement: {
          id: "ad-pub-1",
          name: "Public Ad",
          slug: "public-ad",
          status: "PUBLISHED",
          campaign: "Camp",
          brand: "Brand",
          description: "Desc",
          date: "Oct 2026",
        },
      };
    }
    return { advertisement: null };
  }),
}));

describe("Advertisements Database Operations & Showcase Integration", () => {
  const adminUuid = "00000000-0000-4000-a000-000000000001";
  const editorUuid = "00000000-0000-4000-a000-000000000002";
  const inactiveUuid = "00000000-0000-4000-a000-000000000003";

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
      const match = mockAdvertisements.find((a) => (where.id ? a.id === where.id : a.slug === where.slug));
      if (!match) return null;
      return {
        ...match,
        thumbnail: mockMediaAssets.find((m) => m.id === match.thumbnailId) || null,
      };
    };

    const mockPrismaInstance = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id?: string; userId?: string; email?: string } }) => {
          if (where.id === adminUuid || where.userId === adminUuid || where.email === "admin@cobralearn.com") {
            return Promise.resolve({
              id: adminUuid,
              userId: adminUuid,
              email: "admin@cobralearn.com",
              role: "ADMIN",
              isActive: true,
              fullName: "Admin User",
            });
          }
          if (where.id === editorUuid || where.userId === editorUuid || where.email === "editor@cobralearn.com") {
            return Promise.resolve({
              id: editorUuid,
              userId: editorUuid,
              email: "editor@cobralearn.com",
              role: "EDITOR",
              isActive: true,
              fullName: "Staff Editor",
            });
          }
          if (where.id === inactiveUuid || where.userId === inactiveUuid || where.email === "inactive@cobralearn.com") {
            return Promise.resolve({
              id: inactiveUuid,
              userId: inactiveUuid,
              email: "inactive@cobralearn.com",
              role: "ADMIN",
              isActive: false,
              fullName: "Inactive Admin",
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
          let match = mockAdvertisements.find((a) => {
            if (where.id) return a.id === where.id;
            if (where.slug && where.status) return a.slug === where.slug && a.status === where.status;
            if (where.slug) return a.slug === where.slug;
            return false;
          });
          if (!match && where.OR) {
            match = mockAdvertisements.find((a) => where.OR.some((clause: any) => clause.id === a.id || clause.slug === a.slug));
          }
          if (!match) return Promise.resolve(null);
          return Promise.resolve({
            ...match,
            thumbnail: mockMediaAssets.find((m) => m.id === match!.thumbnailId) || null,
          });
        }),
        findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(findAdHelper(where))),
        findUniqueOrThrow: vi.fn().mockImplementation(({ where }: any) => {
          const res = findAdHelper(where);
          if (!res) return Promise.reject(new Error("Advertisement not found"));
          return Promise.resolve(res);
        }),
        count: vi.fn().mockImplementation(({ where }: any = {}) => {
          if (where?.id?.in) {
            return Promise.resolve(mockAdvertisements.filter((a) => where.id.in.includes(a.id)).length);
          }
          return Promise.resolve(mockAdvertisements.length);
        }),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const newAd: Advertisement = {
            id: `ad-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
          return Promise.resolve({
            ...newAd,
            thumbnail: mockMediaAssets.find((m) => m.id === newAd.thumbnailId) || null,
          });
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = mockAdvertisements.findIndex((a) => a.id === where.id);
          if (idx === -1) return Promise.reject(new Error("Advertisement not found"));
          mockAdvertisements[idx] = {
            ...mockAdvertisements[idx]!,
            ...data,
            updatedAt: new Date(),
          };
          return Promise.resolve({
            ...mockAdvertisements[idx]!,
            thumbnail: mockMediaAssets.find((m) => m.id === mockAdvertisements[idx]!.thumbnailId) || null,
          });
        }),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          const idx = mockAdvertisements.findIndex((a) => a.id === where.id);
          if (idx === -1) return Promise.reject(new Error("Advertisement not found"));
          const [deleted] = mockAdvertisements.splice(idx, 1);
          return Promise.resolve(deleted);
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
            awardThumbnails: [],
            appearanceLogos: [],
            appearanceFavicons: [],
            homepageSections: [],
          });
        }),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          const idx = mockMediaAssets.findIndex((m) => m.id === where.id);
          if (idx === -1) return Promise.reject(new Error("MediaAsset not found"));
          const [deleted] = mockMediaAssets.splice(idx, 1);
          return Promise.resolve(deleted);
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          const log: AdminAuditLog = {
            id: `audit-${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          mockAuditLogs.push(log);
          return Promise.resolve(log);
        }),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback(mockPrismaInstance);
      }),
    } as unknown as PrismaClient;

    return mockPrismaInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdvertisements = [];
    mockAuditLogs = [];
    mockMediaAssets = [
      {
        id: "media-ad-thumb-1",
        name: "workshop-banner.jpg",
        originalFilename: "workshop-banner.jpg",
        bucket: "media-library",
        storagePath: "media/advertisements/workshop-banner.jpg",
        publicUrl: "https://storage.cobralearn.com/media/advertisements/workshop-banner.jpg",
        mediaType: "IMAGE",
        category: "ADVERTISEMENTS",
        mimeType: "image/jpeg",
        fileSize: BigInt(102400),
        fileExtension: "jpg",
        dimensions: null,
        duration: null,
        description: null,
        altText: "Workshop Banner",
        tags: ["workshop"],
        uploadedById: adminUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  describe("Slug generation utility", () => {
    it("converts campaign title to lowercase kebab-case slug", () => {
      expect(slugify("Summer Hackathon 2026!")).toBe("summer-hackathon-2026");
      expect(slugify("  Special @ Offer & Discount  ")).toBe("special-offer-discount");
      expect(slugify("---Already---Dashed---")).toBe("already-dashed");
    });
  });

  describe("URL Safety Validation", () => {
    it("rejects dangerous schemes in campaignUrl on create", async () => {
      const mockPrisma = createMockPrisma();
      const dangerousUrls = [
        "javascript:alert(1)",
        "JAVASCRIPT:malicious()",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
        "file:///etc/passwd",
      ];

      for (const dangerousUrl of dangerousUrls) {
        const req = createAuthRequest(adminUser);
        await expect(
          createAdminAdvertisementOperation(
            req,
            {
              name: "Exploit Ad",
              campaign: "Hack",
              brand: "Evil",
              description: "Bad url",
              campaignUrl: dangerousUrl,
              thumbnailId: "media-ad-thumb-1",
            },
            mockPrisma
          )
        ).rejects.toThrow(/dangerous protocol scheme/i);
      }
    });

    it("accepts valid http and https campaign URLs", async () => {
      const mockPrisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const res = await createAdminAdvertisementOperation(
        req,
        {
          name: "Safe Campaign",
          campaign: "Safe",
          brand: "Brand",
          description: "Valid link",
          campaignUrl: "https://example.com/promo",
          thumbnailId: "media-ad-thumb-1",
        },
        mockPrisma
      );

      expect(res.advertisement.id).toBeDefined();
      expect(res.advertisement.campaignUrl).toBe("https://example.com/promo");
    });
  });

  describe("Mandatory Thumbnail Enforcement", () => {
    it("rejects advertisement creation without thumbnailId", async () => {
      const mockPrisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminAdvertisementOperation(
          req,
          {
            name: "No Thumb Ad",
            campaign: "Camp",
            brand: "Brand",
            description: "No thumb provided",
            thumbnailId: null as any,
          },
          mockPrisma
        )
      ).rejects.toThrow(/Thumbnail image is required/i);
    });

    it("rejects advertisement creation when thumbnailId does not exist in MediaAsset table", async () => {
      const mockPrisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminAdvertisementOperation(
          req,
          {
            name: "Ghost Thumb Ad",
            campaign: "Camp",
            brand: "Brand",
            description: "Thumb points to ghost",
            thumbnailId: "nonexistent-media-id",
          },
          mockPrisma
        )
      ).rejects.toThrow(/Thumbnail media asset.*does not exist/i);
    });
  });

  describe("Create Advertisement & Audit Logging", () => {
    it("creates an advertisement with auto-generated unique slug and logs audit event", async () => {
      const mockPrisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const res = await createAdminAdvertisementOperation(
        req,
        {
          name: "Hackathon",
          campaign: "Annual Hack",
          brand: "CobraLearn",
          description: "Join our hackathon",
          thumbnailId: "media-ad-thumb-1",
        },
        mockPrisma
      );

      expect(res.advertisement.slug).toBe("hackathon");
      expect(mockAuditLogs).toHaveLength(1);
      expect(mockAuditLogs[0]!.action).toBe("ADVERTISEMENT_CREATED");
      expect(mockAuditLogs[0]!.module).toBe("ADVERTISEMENTS_CMS");
      expect(mockAuditLogs[0]!.actorId).toBe(adminUuid);
    });
  });

  describe("Update Advertisement", () => {
    it("updates advertisement fields and records audit log", async () => {
      const mockPrisma = createMockPrisma();
      const createReq = createAuthRequest(adminUser);

      const created = await createAdminAdvertisementOperation(
        createReq,
        {
          name: "Summer Sale",
          campaign: "Summer 2026",
          brand: "CobraLearn",
          description: "Summer deals",
          thumbnailId: "media-ad-thumb-1",
        },
        mockPrisma
      );

      const updateReq = createAuthRequest(adminUser);
      const res = await updateAdminAdvertisementOperation(
        updateReq,
        created.advertisement.id,
        {
          name: "Mega Summer Sale",
          status: "PUBLISHED",
        },
        mockPrisma
      );

      expect(res.advertisement.name).toBe("Mega Summer Sale");
      expect(res.advertisement.status).toBe("PUBLISHED");

      const updateAudit = mockAuditLogs.find((l) => l.action === "ADVERTISEMENT_UPDATED");
      expect(updateAudit).toBeDefined();
      expect(updateAudit!.entityId).toBe(created.advertisement.id);
    });
  });

  describe("Delete Advertisement & Referenced Asset Protection", () => {
    it("deletes advertisement and records audit log without deleting referenced MediaAsset", async () => {
      const mockPrisma = createMockPrisma();
      const createReq = createAuthRequest(adminUser);

      const created = await createAdminAdvertisementOperation(
        createReq,
        {
          name: "Ad To Delete",
          campaign: "Campaign",
          brand: "Brand",
          description: "Will be deleted",
          thumbnailId: "media-ad-thumb-1",
        },
        mockPrisma
      );

      const deleteReq = createAuthRequest(adminUser);
      const res = await deleteAdminAdvertisementOperation(deleteReq, created.advertisement.id, mockPrisma);

      expect(res.success).toBe(true);
      expect(mockAdvertisements).toHaveLength(0);
      // MediaAsset is preserved
      expect(mockMediaAssets).toHaveLength(1);

      const deleteAudit = mockAuditLogs.find((l) => l.action === "ADVERTISEMENT_DELETED");
      expect(deleteAudit).toBeDefined();
    });

    it("protects MediaAsset from deletion when referenced by an advertisement", async () => {
      const mockPrisma = createMockPrisma();
      const createReq = createAuthRequest(adminUser);

      await createAdminAdvertisementOperation(
        createReq,
        {
          name: "Workshop Ad",
          campaign: "Workshop",
          brand: "Brand",
          description: "Using banner",
          thumbnailId: "media-ad-thumb-1",
        },
        mockPrisma
      );

      const deleteMediaReq = createAuthRequest(adminUser);
      await expect(
        deleteAdminMediaAssetOperation(deleteMediaReq, "media-ad-thumb-1", mockPrisma, {} as any)
      ).rejects.toThrow(/Referential Integrity Error: Cannot delete media asset.*because it is currently in use as thumbnail for Advertisement/i);
    });
  });

  describe("Reordering Operations & Boundaries", () => {
    it("reorders advertisements transactionally and updates displayOrder sequentially", async () => {
      const mockPrisma = createMockPrisma();
      const createReq = createAuthRequest(adminUser);

      const ad1 = await createAdminAdvertisementOperation(
        createReq,
        { name: "Ad 1", campaign: "C1", brand: "B1", description: "D1", thumbnailId: "media-ad-thumb-1" },
        mockPrisma
      );
      const ad2 = await createAdminAdvertisementOperation(
        createReq,
        { name: "Ad 2", campaign: "C2", brand: "B2", description: "D2", thumbnailId: "media-ad-thumb-1" },
        mockPrisma
      );

      const reorderReq = createAuthRequest(adminUser);
      const res = await reorderAdminAdvertisementsOperation(
        reorderReq,
        [ad2.advertisement.id, ad1.advertisement.id],
        mockPrisma
      );

      expect(res.success).toBe(true);

      const listReq = createAuthRequest(adminUser);
      const listRes = await listAdminAdvertisementsOperation(listReq, mockPrisma);
      expect(listRes.advertisements[0]!.id).toBe(ad2.advertisement.id);
      expect(listRes.advertisements[1]!.id).toBe(ad1.advertisement.id);
    });
  });

  describe("RBAC & Permissions Enforcement", () => {
    it("rejects non-permitted actions when user has insufficient role (e.g. EDITOR cannot delete)", async () => {
      const mockPrisma = createMockPrisma();
      const createReq = createAuthRequest(adminUser);

      const created = await createAdminAdvertisementOperation(
        createReq,
        { name: "Ad", campaign: "C", brand: "B", description: "D", thumbnailId: "media-ad-thumb-1" },
        mockPrisma
      );

      const editorDeleteReq = createAuthRequest(editorUser);
      await expect(
        deleteAdminAdvertisementOperation(editorDeleteReq, created.advertisement.id, mockPrisma)
      ).rejects.toThrow(/lacks required permission: "cms:delete"/i);
    });

    it("rejects requests without active admin profile", async () => {
      const mockPrisma = createMockPrisma();
      const inactiveReq = createAuthRequest(inactiveUser);

      await expect(
        listAdminAdvertisementsOperation(inactiveReq, mockPrisma)
      ).rejects.toThrow(/Forbidden: AdminProfile is deactivated/);
    });
  });

  describe("Public Showcase Visibility Filtering", () => {
    it("excludes draft and archived advertisements from public showcase queries", async () => {
      const mockPrisma = createMockPrisma();
      const createReq = createAuthRequest(adminUser);

      const draftAd = await createAdminAdvertisementOperation(
        createReq,
        { name: "Draft Ad", campaign: "C", brand: "B", description: "D", thumbnailId: "media-ad-thumb-1", status: "DRAFT" },
        mockPrisma
      );
      const publishedAd = await createAdminAdvertisementOperation(
        createReq,
        { name: "Live Ad", campaign: "C", brand: "B", description: "D", thumbnailId: "media-ad-thumb-1", status: "PUBLISHED" },
        mockPrisma
      );

      const publicAds = await getPublicAdvertisementsOperation(mockPrisma);

      expect(publicAds.advertisements).toHaveLength(1);
      expect(publicAds.advertisements[0]!.id).toBe(publishedAd.advertisement.id);
    });

    it("getPublicAdvertisementBySlug excludes unpublished records", async () => {
      const mockPrisma = createMockPrisma();
      const createReq = createAuthRequest(adminUser);

      const draftAd = await createAdminAdvertisementOperation(
        createReq,
        { name: "Secret Ad", campaign: "C", brand: "B", description: "D", thumbnailId: "media-ad-thumb-1", status: "DRAFT" },
        mockPrisma
      );

      const res = await getPublicAdvertisementBySlugOperation(draftAd.advertisement.slug, mockPrisma);
      expect(res.advertisement).toBeNull();
    });
  });

  describe("Data Mappers & Status Conversions", () => {
    it("converts between Prisma status and UI status strings", () => {
      expect(statusToPrisma("Published")).toBe("PUBLISHED");
      expect(statusToPrisma("Draft")).toBe("DRAFT");
      expect(statusToPrisma("Archived")).toBe("ARCHIVED");

      expect(statusFromPrisma("PUBLISHED")).toBe("Published");
      expect(statusFromPrisma("DRAFT")).toBe("Draft");
      expect(statusFromPrisma("ARCHIVED")).toBe("Archived");
    });

    it("maps database advertisement to showcase item", () => {
      const dbAd: any = {
        id: "ad-map-1",
        name: "Showcase Ad",
        slug: "showcase-ad",
        description: "Ad description",
        status: "PUBLISHED",
        displayOrder: 3,
        thumbnail: mockMediaAssets[0],
      };

      const showcase = advertisementToShowcaseItem(dbAd);
      expect(showcase.id).toBe("ad-map-1");
      expect(showcase.title).toBe("Showcase Ad");
      expect(showcase.accent).toBe("red");
      expect(showcase.image).toBe(mockMediaAssets[0]!.publicUrl);
    });

    it("maps database advertisement to public detail item", () => {
      const dbAd: any = {
        id: "ad-map-2",
        name: "Full Detail Ad",
        slug: "full-detail-ad",
        campaign: "Flagship Campaign",
        brand: "CobraLearn",
        description: "Summary",
        fullDescription: "Long detailed copy",
        campaignUrl: "https://example.com",
        status: "PUBLISHED",
        displayOrder: 1,
        date: "Oct 2026",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        thumbnail: mockMediaAssets[0],
      };

      const detail = advertisementToPublicDetailItem(dbAd);
      expect(detail.id).toBe("ad-map-2");
      expect(detail.title).toBe("Full Detail Ad");
      expect(detail.campaign).toBe("Flagship Campaign");
      expect(detail.brand).toBe("CobraLearn");
      expect(detail.campaignUrl).toBe("https://example.com");
      expect(detail.fullDescription).toBe("Long detailed copy");
    });
  });

  describe("Admin Client Adapter", () => {
    it("calls server functions and returns standard response shapes", async () => {
      const listRes = await adminClient.listAdminAdvertisements();
      expect(listRes.success).toBe(true);
      expect(listRes.data).toHaveLength(1);

      const getRes = await adminClient.getAdminAdvertisement("ad-1");
      expect(getRes.success).toBe(true);
      expect(getRes.data?.id).toBe("ad-1");

      const createRes = await adminClient.createAdminAdvertisement({
        name: "New Client Ad",
        campaign: "Camp",
        brand: "Brand",
        description: "Desc",
      });
      expect(createRes.success).toBe(true);

      const updateRes = await adminClient.updateAdminAdvertisement("ad-1", {
        name: "Updated Name",
      });
      expect(updateRes.success).toBe(true);

      const deleteRes = await adminClient.deleteAdminAdvertisement("ad-1");
      expect(deleteRes.success).toBe(true);

      const reorderRes = await adminClient.reorderAdminAdvertisements(["ad-1"]);
      expect(reorderRes.success).toBe(true);

      const pubRes = await adminClient.getPublicAdvertisements();
      expect(pubRes.success).toBe(true);
      expect(pubRes.data).toHaveLength(1);

      const pubSlugRes = await adminClient.getPublicAdvertisementBySlug("public-ad");
      expect(pubSlugRes.success).toBe(true);
      expect(pubSlugRes.data?.slug).toBe("public-ad");
    });
  });
});
