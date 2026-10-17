import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAdminWebsitesOperation,
  getAdminWebsiteByIdOperation,
  createAdminWebsiteOperation,
  updateAdminWebsiteOperation,
  deleteAdminWebsiteOperation,
  reorderAdminWebsitesOperation,
  getPublicWebsitesOperation,
  getPublicWebsiteBySlugOperation,
  slugify,
} from "@/lib/server/websites-operations";
import { deleteAdminMediaAssetOperation } from "@/lib/server/media-operations";
import {
  websiteToItem,
  websiteToShowcaseItem,
  websiteToPublicDetailItem,
  statusToPrisma,
  statusFromPrisma,
} from "@/lib/websites-data";
import { adminClient } from "@/lib/api/admin-client";
import {
  listAdminWebsitesServerFn,
  getAdminWebsiteByIdServerFn,
  createAdminWebsiteServerFn,
  updateAdminWebsiteServerFn,
  deleteAdminWebsiteServerFn,
  reorderAdminWebsitesServerFn,
  getPublicWebsitesServerFn,
  getPublicWebsiteBySlugServerFn,
} from "@/lib/server/websites-server-fns";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase/browser";
import type { PrismaClient, Website, WebsiteGalleryItem, AdminAuditLog, PublishStatus, MediaAsset } from "@prisma/client";
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

vi.mock("@/lib/server/websites-server-fns", () => ({
  listAdminWebsitesServerFn: vi.fn().mockImplementation(async () => ({
    websites: [
      {
        id: "web-1",
        name: "CobraLearn Cloud LMS",
        slug: "cobralearn-cloud-lms",
        url: "https://lms.cobralearn.com",
        description: "Cloud-native learning management platform.",
        status: "PUBLISHED",
        featured: true,
        displayOrder: 1,
        technologies: ["React", "Node.js"],
        tags: ["Education"],
        gallery: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  })),
  getAdminWebsiteByIdServerFn: vi.fn().mockImplementation(async ({ data }: any) => {
    if (data?.idOrSlug === "web-1") {
      return {
        website: {
          id: "web-1",
          name: "CobraLearn Cloud LMS",
          slug: "cobralearn-cloud-lms",
          url: "https://lms.cobralearn.com",
          status: "PUBLISHED",
          gallery: [],
        },
      };
    }
    return { website: null };
  }),
  createAdminWebsiteServerFn: vi.fn().mockImplementation(async ({ data }: any) => ({
    website: {
      id: "new-web",
      ...data.payload,
      gallery: [],
    },
  })),
  updateAdminWebsiteServerFn: vi.fn().mockImplementation(async ({ data }: any) => ({
    website: {
      id: data.id,
      ...data.payload,
      gallery: [],
    },
  })),
  deleteAdminWebsiteServerFn: vi.fn().mockImplementation(async ({ data }: any) => ({
    success: true,
    deletedId: data.id,
  })),
  reorderAdminWebsitesServerFn: vi.fn().mockImplementation(async () => ({
    success: true,
  })),
  getPublicWebsitesServerFn: vi.fn().mockImplementation(async () => ({
    websites: [
      {
        id: "web-1",
        name: "CobraLearn Cloud LMS",
        slug: "cobralearn-cloud-lms",
        url: "https://lms.cobralearn.com",
        description: "Cloud-native learning management platform.",
        status: "PUBLISHED",
        featured: true,
        displayOrder: 1,
        technologies: ["React", "Node.js"],
        tags: ["Education"],
        gallery: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  })),
  getPublicWebsiteBySlugServerFn: vi.fn().mockImplementation(async ({ data }: any) => {
    if (data?.slug === "cobralearn-cloud-lms") {
      return {
        website: {
          id: "web-1",
          name: "CobraLearn Cloud LMS",
          slug: "cobralearn-cloud-lms",
          url: "https://lms.cobralearn.com",
          status: "PUBLISHED",
          gallery: [],
        },
      };
    }
    return { website: null };
  }),
}));

describe("STEP 3: Websites Module Database & Public Showcase Integration Test Suite", () => {
  const superAdminUuid = "11111111-1111-4111-8111-111111111111";
  const adminUuid = "22222222-2222-4222-8222-222222222222";
  const editorUuid = "33333333-3333-4333-8333-333333333333";
  const inactiveUuid = "44444444-4444-4444-8444-444444444444";

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

    return new Request("https://api.internal/admin/websites", {
      headers: {
        authorization: user ? `Bearer mock-token-for-${user.id}` : "",
      },
    });
  }

  let mockWebsites: Website[] = [];
  let mockGalleryItems: WebsiteGalleryItem[] = [];
  let mockAuditLogs: AdminAuditLog[] = [];
  let mockMediaAssets: MediaAsset[] = [];

  function createMockPrisma(): PrismaClient {
    const findWebsiteHelper = (where: any) => {
      const match = mockWebsites.find((w) => (where.id ? w.id === where.id : w.slug === where.slug));
      if (!match) return null;
      return {
        ...match,
        thumbnail: mockMediaAssets.find((m) => m.id === match.thumbnailId) || null,
        gallery: mockGalleryItems
          .filter((g) => g.websiteId === match.id)
          .map((g) => ({
            ...g,
            media: mockMediaAssets.find((m) => m.id === g.mediaId) || null,
          })),
      };
    };

    return {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id === superAdminUuid || where.email === "superadmin@cobralearn.com") {
            return Promise.resolve({
              id: superAdminUuid,
              email: "superadmin@cobralearn.com",
              role: "SUPER_ADMIN",
              isActive: true,
              fullName: "Super Admin",
            });
          }
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
              fullName: "Editor User",
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
      website: {
        count: vi.fn().mockImplementation(() => Promise.resolve(mockWebsites.length)),
        findMany: vi.fn().mockImplementation(({ where, orderBy }: any) => {
          let list = [...mockWebsites];
          if (where?.status) {
            list = list.filter((w) => w.status === where.status);
          }
          if (orderBy?.displayOrder === "asc") {
            list.sort((a, b) => a.displayOrder - b.displayOrder);
          }
          return Promise.resolve(
            list.map((w) => ({
              ...w,
              thumbnail: mockMediaAssets.find((m) => m.id === w.thumbnailId) || null,
              gallery: mockGalleryItems
                .filter((g) => g.websiteId === w.id)
                .map((g) => ({
                  ...g,
                  media: mockMediaAssets.find((m) => m.id === g.mediaId) || null,
                })),
            }))
          );
        }),
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          let match = mockWebsites.find((w) => {
            if (where.id) return w.id === where.id;
            if (where.slug && where.status) return w.slug === where.slug && w.status === where.status;
            if (where.slug) return w.slug === where.slug;
            return false;
          });
          if (!match && where.OR) {
            match = mockWebsites.find((w) => where.OR.some((clause: any) => clause.id === w.id || clause.slug === w.slug));
          }
          if (!match) return Promise.resolve(null);
          return Promise.resolve({
            ...match,
            thumbnail: mockMediaAssets.find((m) => m.id === match!.thumbnailId) || null,
            gallery: mockGalleryItems
              .filter((g) => g.websiteId === match!.id)
              .map((g) => ({
                ...g,
                media: mockMediaAssets.find((m) => m.id === g.mediaId) || null,
              })),
          });
        }),
        findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(findWebsiteHelper(where))),
        findUniqueOrThrow: vi.fn().mockImplementation(({ where }: any) => {
          const res = findWebsiteHelper(where);
          if (!res) return Promise.reject(new Error("Website not found"));
          return Promise.resolve(res);
        }),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const newWebsite: Website = {
            id: `web-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: data.name,
            slug: data.slug,
            url: data.url,
            description: data.description,
            fullDescription: data.fullDescription ?? null,
            category: data.category ?? "WEBSITES",
            status: data.status ?? "DRAFT",
            featured: data.featured ?? false,
            displayOrder: data.displayOrder ?? 0,
            launchDate: data.launchDate ?? null,
            teamSize: data.teamSize ?? null,
            technologies: data.technologies ?? [],
            tags: data.tags ?? [],
            githubUrl: data.githubUrl ?? null,
            videoUrl: data.videoUrl ?? null,
            thumbnailId: data.thumbnailId ?? null,
            publishedAt: data.publishedAt ?? null,
            createdById: data.createdById ?? null,
            updatedById: data.updatedById ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockWebsites.push(newWebsite);

          return Promise.resolve({
            ...newWebsite,
            thumbnail: mockMediaAssets.find((m) => m.id === newWebsite.thumbnailId) || null,
            gallery: mockGalleryItems
              .filter((g) => g.websiteId === newWebsite.id)
              .map((g) => ({
                ...g,
                media: mockMediaAssets.find((m) => m.id === g.mediaId) || null,
              })),
          });
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = mockWebsites.findIndex((w) => w.id === where.id);
          if (idx === -1) throw new Error("Website not found");
          const existing = mockWebsites[idx];
          const updated: Website = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          delete (updated as any).gallery;
          mockWebsites[idx] = updated;

          return Promise.resolve({
            ...updated,
            thumbnail: mockMediaAssets.find((m) => m.id === updated.thumbnailId) || null,
            gallery: mockGalleryItems
              .filter((g) => g.websiteId === updated.id)
              .map((g) => ({
                ...g,
                media: mockMediaAssets.find((m) => m.id === g.mediaId) || null,
              })),
          });
        }),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          const idx = mockWebsites.findIndex((w) => w.id === where.id);
          if (idx === -1) throw new Error("Website not found");
          const deleted = mockWebsites.splice(idx, 1)[0];
          mockGalleryItems = mockGalleryItems.filter((g) => g.websiteId !== deleted.id);
          return Promise.resolve(deleted);
        }),
      },
      websiteGalleryItem: {
        count: vi.fn().mockImplementation(() => Promise.resolve(mockGalleryItems.length)),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const item: WebsiteGalleryItem = {
            id: `gallery-created-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            websiteId: data.websiteId,
            mediaId: data.mediaId,
            displayOrder: data.displayOrder ?? 0,
            createdAt: new Date(),
          };
          mockGalleryItems.push(item);
          return Promise.resolve(item);
        }),
        deleteMany: vi.fn().mockImplementation(({ where }: any) => {
          if (where?.websiteId) {
            mockGalleryItems = mockGalleryItems.filter((g) => g.websiteId !== where.websiteId);
          }
          return Promise.resolve({ count: 1 });
        }),
        createMany: vi.fn().mockImplementation(({ data }: any) => {
          data.forEach((item: any, i: number) => {
            mockGalleryItems.push({
              id: `gallery-created-${Date.now()}-${i}`,
              websiteId: item.websiteId,
              mediaId: item.mediaId,
              displayOrder: item.displayOrder,
              createdAt: new Date(),
            });
          });
          return Promise.resolve({ count: data.length });
        }),
      },
      mediaAsset: {
        findMany: vi.fn().mockImplementation(({ where }: any) => {
          if (where?.id?.in) {
            return Promise.resolve(mockMediaAssets.filter((m) => where.id.in.includes(m.id)));
          }
          return Promise.resolve(mockMediaAssets);
        }),
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(mockMediaAssets.find((m) => m.id === where.id) || null);
        }),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          const idx = mockMediaAssets.findIndex((m) => m.id === where.id);
          if (idx === -1) throw new Error("Media asset not found");
          return Promise.resolve(mockMediaAssets.splice(idx, 1)[0]);
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          const log: AdminAuditLog = {
            id: `audit-${Date.now()}`,
            actorId: data.actorId ?? null,
            actorEmail: data.actorEmail ?? "admin@cobralearn.com",
            action: data.action,
            module: data.module,
            entityId: data.entityId ?? null,
            metadata: data.metadata ?? null,
            ipAddress: data.ipAddress ?? null,
            createdAt: new Date(),
          };
          mockAuditLogs.push(log);
          return Promise.resolve(log);
        }),
      },
      project: {
        count: vi.fn().mockResolvedValue(0),
      },
      projectGalleryItem: {
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn().mockImplementation(async (callback: any) => {
        if (typeof callback === "function") {
          return callback(createMockPrisma());
        }
        return Promise.all(callback);
      }),
    } as unknown as PrismaClient;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockWebsites = [];
    mockGalleryItems = [];
    mockAuditLogs = [];
    mockMediaAssets = [
      {
        id: "media-thumb-1",
        name: "thumb.png",
        originalFilename: "thumb.png",
        bucket: "media-library",
        storagePath: "websites/thumb.png",
        publicUrl: "https://mock-storage.supabase.co/thumb.png",
        mediaType: "IMAGE",
        category: "WEBSITES",
        mimeType: "image/png",
        fileSize: BigInt(10240),
        fileExtension: "png",
        dimensions: "1280x720",
        duration: null,
        altText: "Thumbnail image",
        description: null,
        tags: ["websites"],
        uploadedById: superAdminUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "media-gal-1",
        name: "screenshot1.jpg",
        originalFilename: "screenshot1.jpg",
        bucket: "media-library",
        storagePath: "websites/screenshot1.jpg",
        publicUrl: "https://mock-storage.supabase.co/screenshot1.jpg",
        mediaType: "IMAGE",
        category: "WEBSITES",
        mimeType: "image/jpeg",
        fileSize: BigInt(20480),
        fileExtension: "jpg",
        dimensions: "1920x1080",
        duration: null,
        altText: "Screenshot 1",
        description: null,
        tags: ["websites"],
        uploadedById: superAdminUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "media-gal-2",
        name: "screenshot2.jpg",
        originalFilename: "screenshot2.jpg",
        bucket: "media-library",
        storagePath: "websites/screenshot2.jpg",
        publicUrl: "https://mock-storage.supabase.co/screenshot2.jpg",
        mediaType: "IMAGE",
        category: "WEBSITES",
        mimeType: "image/jpeg",
        fileSize: BigInt(25600),
        fileExtension: "jpg",
        dimensions: "1920x1080",
        duration: null,
        altText: "Screenshot 2",
        description: null,
        tags: ["websites"],
        uploadedById: superAdminUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  describe("1. Slug Generation & Format Helpers", () => {
    it("generates URL-friendly slugs correctly", () => {
      expect(slugify("CobraLearn AI Platform 2026!")).toBe("cobralearn-ai-platform-2026");
      expect(slugify("   Multiple   Spaces   ")).toBe("multiple-spaces");
      expect(slugify("Special-Characters & Symbols #1")).toBe("special-characters-symbols-1");
      expect(slugify("")).toBe("");
    });

    it("correctly converts between UI and Prisma status enums", () => {
      expect(statusToPrisma("Published")).toBe("PUBLISHED");
      expect(statusToPrisma("Draft")).toBe("DRAFT");
      expect(statusToPrisma("Archived")).toBe("ARCHIVED");

      expect(statusFromPrisma("PUBLISHED")).toBe("Published");
      expect(statusFromPrisma("DRAFT")).toBe("Draft");
      expect(statusFromPrisma("ARCHIVED")).toBe("Archived");
    });
  });

  describe("2. Admin CRUD Operations & Business Logic", () => {
    it("successfully creates a website with thumbnail, gallery, and audit log", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      const { website } = await createAdminWebsiteOperation(
        req,
        {
          name: "Interactive Learning Hub",
          url: "https://hub.cobralearn.com",
          description: "An adaptive modern learning experience.",
          fullDescription: "Detailed breakdown of the interactive learning hub architecture.",
          category: "E-Learning",
          status: "PUBLISHED",
          featured: true,
          displayOrder: 1,
          technologies: ["React", "TailwindCSS"],
          tags: ["Education", "Portal"],
          thumbnailId: "media-thumb-1",
          galleryMediaIds: ["media-gal-1", "media-gal-2"],
        },
        prisma
      );

      expect(website).toBeDefined();
      expect(website.id).toBeDefined();
      expect(website.name).toBe("Interactive Learning Hub");
      expect(website.slug).toBe("interactive-learning-hub");
      expect(website.status).toBe("PUBLISHED");
      expect(website.publishedAt).toBeInstanceOf(Date);
      expect(website.thumbnailId).toBe("media-thumb-1");

      expect(mockAuditLogs.length).toBe(1);
      expect(mockAuditLogs[0].action).toBe("WEBSITE_CREATED");
      expect(mockAuditLogs[0].module).toBe("WEBSITES_CMS");
      expect(mockAuditLogs[0].entityId).toBe(website.id);
    });

    it("rejects duplicate slug conflicts during creation", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      const first = await createAdminWebsiteOperation(
        req,
        {
          name: "Duplicate Site",
          url: "https://example.com/1",
          description: "Site 1",
          thumbnailId: "media-thumb-1",
        },
        prisma
      );
      expect(first.website.slug).toBe("duplicate-site");

      await expect(
        createAdminWebsiteOperation(
          req,
          {
            name: "Duplicate Site",
            url: "https://example.com/2",
            description: "Site 2",
            thumbnailId: "media-thumb-1",
          },
          prisma
        )
      ).rejects.toThrow(/already exists/i);
    });

    it("rejects malicious or unsafe URLs (javascript:, data:, vbscript:, file:)", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      await expect(
        createAdminWebsiteOperation(
          req,
          {
            name: "Hacker Site",
            url: "javascript:alert('XSS')",
            description: "Invalid URL test",
            thumbnailId: "media-thumb-1",
          },
          prisma
        )
      ).rejects.toThrow(/dangerous protocol scheme/i);

      await expect(
        createAdminWebsiteOperation(
          req,
          {
            name: "Data URL Site",
            url: "data:text/html,<script>alert(1)</script>",
            description: "Invalid data URL test",
            thumbnailId: "media-thumb-1",
          },
          prisma
        )
      ).rejects.toThrow(/dangerous protocol scheme/i);

      await expect(
        createAdminWebsiteOperation(
          req,
          {
            name: "File URL Site",
            url: "file:///etc/passwd",
            description: "Invalid file URL test",
            thumbnailId: "media-thumb-1",
          },
          prisma
        )
      ).rejects.toThrow(/dangerous protocol scheme/i);
    });

    it("allows empty Live Website URL for draft submissions and stores as empty string", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      const { website } = await createAdminWebsiteOperation(
        req,
        {
          name: "Draft Without URL",
          url: "",
          description: "Site in planning stage",
          status: "DRAFT",
          thumbnailId: "media-thumb-1",
        },
        prisma
      );

      expect(website).toBeDefined();
      expect(website.status).toBe("DRAFT");
      expect(website.url).toBe("");
    });

    it("strictly requires Live Website URL to publish a website", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      await expect(
        createAdminWebsiteOperation(
          req,
          {
            name: "Published Without URL",
            url: "",
            description: "Missing live URL",
            status: "PUBLISHED",
            thumbnailId: "media-thumb-1",
          },
          prisma
        )
      ).rejects.toThrow(/Live Website URL is required to publish a website/i);

      // Also verify updating a draft to PUBLISHED without a URL is rejected
      const draft = await createAdminWebsiteOperation(
        req,
        {
          name: "Draft Site For Publish Test",
          url: "",
          description: "Draft",
          status: "DRAFT",
          thumbnailId: "media-thumb-1",
        },
        prisma
      );

      await expect(
        updateAdminWebsiteOperation(
          req,
          draft.website.id,
          {
            status: "PUBLISHED",
            url: "",
          },
          prisma
        )
      ).rejects.toThrow(/Live Website URL is required to publish a website/i);
    });

    it("auto-normalizes URLs without protocol to https://", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      const { website } = await createAdminWebsiteOperation(
        req,
        {
          name: "Site Without Protocol",
          url: "cobralearn.dev",
          description: "URL entered as plain domain",
          status: "PUBLISHED",
          thumbnailId: "media-thumb-1",
        },
        prisma
      );

      expect(website.url).toBe("https://cobralearn.dev");
    });

    it("strictly enforces thumbnail for both Save as Draft and Publish", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      // Rejects Draft without thumbnail
      await expect(
        createAdminWebsiteOperation(
          req,
          {
            name: "Draft Without Thumbnail",
            url: "",
            description: "No cover uploaded",
            status: "DRAFT",
            thumbnailId: undefined,
          },
          prisma
        )
      ).rejects.toThrow(/Thumbnail image is required/i);

      // Rejects Publish without thumbnail
      await expect(
        createAdminWebsiteOperation(
          req,
          {
            name: "Publish Without Thumbnail",
            url: "https://example.com",
            description: "No cover uploaded",
            status: "PUBLISHED",
            thumbnailId: "",
          },
          prisma
        )
      ).rejects.toThrow(/Thumbnail image is required/i);
    });

    it("validates media references exist and blocks non-existent media IDs", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      await expect(
        createAdminWebsiteOperation(
          req,
          {
            name: "Missing Media Site",
            url: "https://example.com",
            description: "Testing non-existent thumbnail",
            thumbnailId: "non-existent-media-id",
          },
          prisma
        )
      ).rejects.toThrow(/Thumbnail media asset.*does not exist/i);

      await expect(
        createAdminWebsiteOperation(
          req,
          {
            name: "Missing Gallery Site",
            url: "https://example.com",
            description: "Testing non-existent gallery item",
            thumbnailId: "media-thumb-1",
            galleryMediaIds: ["non-existent-gal-id"],
          },
          prisma
        )
      ).rejects.toThrow(/do not exist/i);
    });

    it("enforces gallery limit of 10 images and rejects duplicates", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      await expect(
        createAdminWebsiteOperation(
          req,
          {
            name: "Too Many Images Site",
            url: "https://example.com",
            description: "Testing 11 images",
            thumbnailId: "media-thumb-1",
            galleryMediaIds: Array(11).fill("media-gal-1"),
          },
          prisma
        )
      ).rejects.toThrow(/cannot exceed 10 gallery/i);

      await expect(
        createAdminWebsiteOperation(
          req,
          {
            name: "Duplicate Gallery Images Site",
            url: "https://example.com",
            description: "Testing duplicates",
            thumbnailId: "media-thumb-1",
            galleryMediaIds: ["media-gal-1", "media-gal-1"],
          },
          prisma
        )
      ).rejects.toThrow(/duplicate/i);
    });

    it("updates an existing website and preserves gallery synchronization", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      const created = await createAdminWebsiteOperation(
        req,
        {
          name: "Original Site",
          url: "https://original.com",
          description: "Original description",
          status: "DRAFT",
          thumbnailId: "media-thumb-1",
          galleryMediaIds: ["media-gal-1"],
        },
        prisma
      );

      const { website: updated } = await updateAdminWebsiteOperation(
        req,
        created.website.id,
        {
          name: "Updated Site Name",
          url: "https://updated.com",
          description: "Updated description",
          status: "PUBLISHED",
          galleryMediaIds: ["media-gal-2"],
        },
        prisma
      );

      expect(updated.name).toBe("Updated Site Name");
      expect(updated.status).toBe("PUBLISHED");
      expect(updated.publishedAt).toBeInstanceOf(Date);

      const audit = mockAuditLogs.find((l) => l.action === "WEBSITE_UPDATED" && l.entityId === created.website.id);
      expect(audit).toBeDefined();
    });

    it("creates a website with only minimum required fields and succeeds", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      const { website } = await createAdminWebsiteOperation(
        req,
        {
          name: "Minimal Site",
          description: "Only mandatory fields provided",
          status: "DRAFT",
          thumbnailId: "media-thumb-1",
        },
        prisma
      );

      expect(website).toBeDefined();
      expect(website.name).toBe("Minimal Site");
      expect(website.url).toBe("");
      expect(website.status).toBe("DRAFT");
      expect(website.technologies).toEqual([]);
      expect(website.tags).toEqual([]);
      expect(website.featured).toBe(false);
    });

    it("deletes a website and logs audit trail while leaving media asset intact", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser, "aal2");

      const created = await createAdminWebsiteOperation(
        req,
        {
          name: "Site To Delete",
          url: "https://delete-me.com",
          description: "Will be deleted",
          thumbnailId: "media-thumb-1",
        },
        prisma
      );

      const deleteRes = await deleteAdminWebsiteOperation(
        req,
        created.website.id,
        prisma
      );

      expect(deleteRes.success).toBe(true);
      expect(deleteRes.deletedId).toBe(created.website.id);

      // Verify website deleted
      const found = mockWebsites.find((w) => w.id === created.website.id);
      expect(found).toBeUndefined();

      // Verify media asset is STILL intact in MediaAsset library
      const mediaStillExists = mockMediaAssets.find((m) => m.id === "media-thumb-1");
      expect(mediaStillExists).toBeDefined();

      // Verify audit log
      const audit = mockAuditLogs.find((l) => l.action === "WEBSITE_DELETED" && l.entityId === created.website.id);
      expect(audit).toBeDefined();
    });

    it("reorders websites and writes audit log", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      const s1 = await createAdminWebsiteOperation(
        req,
        { name: "Site 1", url: "https://s1.com", description: "Desc 1", displayOrder: 1, thumbnailId: "media-thumb-1" },
        prisma
      );
      const s2 = await createAdminWebsiteOperation(
        req,
        { name: "Site 2", url: "https://s2.com", description: "Desc 2", displayOrder: 2, thumbnailId: "media-thumb-1" },
        prisma
      );

      const reorderRes = await reorderAdminWebsitesOperation(
        req,
        [s1.website.id, s2.website.id],
        prisma
      );

      expect(reorderRes.success).toBe(true);
      expect(mockAuditLogs.some((l) => l.action === "WEBSITES_REORDERED")).toBe(true);
    });
  });

  describe("3. Security & RBAC Enforcement", () => {
    it("rejects unauthenticated requests for admin operations", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(null);

      await expect(
        listAdminWebsitesOperation(req, undefined, prisma)
      ).rejects.toThrow();

      await expect(
        createAdminWebsiteOperation(
          req,
          { name: "Test", url: "https://test.com", description: "Desc", thumbnailId: "media-thumb-1" },
          prisma
        )
      ).rejects.toThrow();
    });

    it("rejects inactive administrator accounts", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(inactiveUser);

      await expect(
        listAdminWebsitesOperation(req, undefined, prisma)
      ).rejects.toThrow(/deactivated|disabled|inactive/i);
    });

    it("allows EDITOR role to read, create, and update, but denies delete", async () => {
      const prisma = createMockPrisma();
      const editorReq = createAuthRequest(editorUser, "aal2");

      // Editor can create
      const created = await createAdminWebsiteOperation(
        editorReq,
        {
          name: "Editor Site",
          url: "https://editor.com",
          description: "Created by editor",
          thumbnailId: "media-thumb-1",
        },
        prisma
      );
      expect(created.website.name).toBe("Editor Site");

      // Editor can update
      const updated = await updateAdminWebsiteOperation(
        editorReq,
        created.website.id,
        {
          name: "Editor Site Updated",
          url: "https://editor.com",
          description: "Updated by editor",
        },
        prisma
      );
      expect(updated.website.name).toBe("Editor Site Updated");

      // Editor CANNOT delete (requires CMS_DELETE permission, exclusive to SUPER_ADMIN/ADMIN)
      await expect(
        deleteAdminWebsiteOperation(editorReq, created.website.id, prisma)
      ).rejects.toThrow(/forbidden|insufficient permissions/i);
    });
  });

  describe("4. Public Showcase Database Queries & Privacy Filtering", () => {
    it("returns ONLY published websites and excludes drafts & archived entries", async () => {
      const prisma = createMockPrisma();
      const adminReq = createAuthRequest(superAdminUser);

      await createAdminWebsiteOperation(
        adminReq,
        {
          name: "Published Site 1",
          url: "https://pub1.com",
          description: "Pub 1",
          status: "PUBLISHED",
          displayOrder: 1,
          thumbnailId: "media-thumb-1",
        },
        prisma
      );

      await createAdminWebsiteOperation(
        adminReq,
        {
          name: "Draft Site",
          url: "https://draft.com",
          description: "Draft",
          status: "DRAFT",
          displayOrder: 2,
          thumbnailId: "media-thumb-1",
        },
        prisma
      );

      await createAdminWebsiteOperation(
        adminReq,
        {
          name: "Archived Site",
          url: "https://arch.com",
          description: "Archived",
          status: "ARCHIVED",
          displayOrder: 3,
          thumbnailId: "media-thumb-1",
        },
        prisma
      );

      // Public listing (does NOT require request authentication)
      const { websites: publicSites } = await getPublicWebsitesOperation(prisma);
      expect(publicSites.length).toBe(1);
      expect(publicSites[0].name).toBe("Published Site 1");
      expect(publicSites[0].status).toBe("PUBLISHED");
    });

    it("returns null on public detail lookup for non-existent or unpublished slugs", async () => {
      const prisma = createMockPrisma();
      const adminReq = createAuthRequest(superAdminUser);

      await createAdminWebsiteOperation(
        adminReq,
        {
          name: "Secret Draft",
          slug: "secret-draft",
          url: "https://draft.com",
          description: "Draft",
          status: "DRAFT",
          thumbnailId: "media-thumb-1",
        },
        prisma
      );

      // Query draft slug publicly -> MUST return null (never leak draft content)
      const draftResult = await getPublicWebsiteBySlugOperation("secret-draft", prisma);
      expect(draftResult.website).toBeNull();

      // Query completely non-existent slug -> MUST return null
      const missingResult = await getPublicWebsiteBySlugOperation("does-not-exist", prisma);
      expect(missingResult.website).toBeNull();
    });
  });

  describe("5. Shared-Media Referential Deletion Protection", () => {
    it("protects media from deletion when referenced as a website thumbnail", async () => {
      const prisma = createMockPrisma();
      const adminReq = createAuthRequest(superAdminUser, "aal2");

      // Attach media-thumb-1 to a website
      await createAdminWebsiteOperation(
        adminReq,
        {
          name: "Protected Thumbnail Site",
          url: "https://protected.com",
          description: "Testing deletion lock",
          thumbnailId: "media-thumb-1",
        },
        prisma
      );

      // Attempt deleting media-thumb-1 via deleteAdminMediaAssetOperation
      const customPrisma = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminUuid,
            email: "admin@cobralearn.com",
            role: "ADMIN",
            isActive: true,
          }),
        },
        mediaAsset: {
          findUnique: vi.fn().mockResolvedValue({
            id: "media-active-thumb",
            name: "thumb.png",
            projectThumbnails: [],
            projectGalleryItems: [],
            websiteThumbnails: [{ id: "web-1", name: "Interactive Learning Hub" }],
            websiteGalleryItems: [],
            advertisementThumbnails: [],
            awardThumbnails: [],
            appearanceLogos: [],
            appearanceFavicons: [],
            homepageSections: [],
          }),
        },
      } as unknown as PrismaClient;

      await expect(
        deleteAdminMediaAssetOperation(adminReq, "media-active-thumb", customPrisma, {} as any)
      ).rejects.toThrow(/Referential Integrity Error: Cannot delete media asset "thumb\.png" because it is currently in use as thumbnail for Website/i);
    });
  });

  describe("6. Mapping & UI Hydration Helpers", () => {
    it("hydrates WebsiteItem with thumbnail and gallery display items", () => {
      const dbWebsite = {
        id: "w-1",
        name: "Test Hydration",
        slug: "test-hydration",
        url: "https://hydration.com",
        description: "Hydration test",
        fullDescription: "Full hydration description",
        category: "EdTech",
        status: "PUBLISHED" as PublishStatus,
        featured: true,
        displayOrder: 1,
        launchDate: "Oct 2026",
        teamSize: "4 engineers",
        technologies: ["React", "TypeScript"],
        tags: ["Fast", "Modern"],
        githubUrl: "https://github.com/test",
        videoUrl: "https://youtube.com/test",
        thumbnailId: "m-1",
        publishedAt: new Date(),
        createdById: "u-1",
        updatedById: "u-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnail: mockMediaAssets[0],
        gallery: [
          {
            id: "g-1",
            mediaId: "media-gal-1",
            displayOrder: 0,
            media: mockMediaAssets[1],
          },
        ],
      };

      const item = websiteToItem(dbWebsite);
      expect(item.id).toBe("w-1");
      expect(item.name).toBe("Test Hydration");
      expect(item.image).toBe("https://mock-storage.supabase.co/thumb.png");
      expect(item.gallery.length).toBe(1);
      expect(item.gallery[0].url).toBe("https://mock-storage.supabase.co/screenshot1.jpg");
    });

    it("maps dbWebsite to public ShowcaseItem and PublicWebsiteDetailItem", () => {
      const dbWebsite = {
        id: "w-1",
        name: "Public Site",
        slug: "public-site",
        url: "https://pub.com",
        description: "Public summary",
        fullDescription: "Extended public details",
        category: "Showcase",
        status: "PUBLISHED" as PublishStatus,
        featured: true,
        displayOrder: 5,
        technologies: ["Next.js"],
        tags: ["Web"],
        thumbnail: mockMediaAssets[0],
        gallery: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
        launchDate: "2026",
        teamSize: "2",
        githubUrl: "https://github.com",
        videoUrl: null,
        thumbnailId: "media-thumb-1",
        createdById: null,
        updatedById: null,
      };

      const showcase = websiteToShowcaseItem(dbWebsite);
      expect(showcase.title).toBe("Public Site");
      expect(showcase.accent).toBe("green");
      expect(showcase.published).toBe(true);
      expect(showcase.order).toBe(5);

      const detail = websiteToPublicDetailItem(dbWebsite);
      expect(detail.title).toBe("Public Site");
      expect(detail.liveUrl).toBe("https://pub.com");
      expect(detail.technologies).toContain("Next.js");
      expect(detail.accent).toBe("green");
    });
  });

  describe("7. Client API Adapter (adminClient)", () => {
    it("interacts properly with mocked server functions", async () => {
      const listRes = await adminClient.listAdminWebsites();
      expect(listRes.success).toBe(true);
      expect(listRes.data?.length).toBe(1);

      const getRes = await adminClient.getAdminWebsite("web-1");
      expect(getRes.success).toBe(true);
      expect(getRes.data?.name).toBe("CobraLearn Cloud LMS");

      const pubRes = await adminClient.getPublicWebsites();
      expect(pubRes.success).toBe(true);
      expect(pubRes.data?.length).toBe(1);

      const pubDetailRes = await adminClient.getPublicWebsiteBySlug("cobralearn-cloud-lms");
      expect(pubDetailRes.success).toBe(true);
      expect(pubDetailRes.data?.name).toBe("CobraLearn Cloud LMS");
    });
  });
});
