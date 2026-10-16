import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MediaLoadingState } from "@/components/media/MediaLoadingState";
import { searchGlobalAdminOperation } from "@/lib/server/search-operations";
import { createAdminProjectOperation, updateAdminProjectOperation, deleteAdminProjectOperation } from "@/lib/server/projects-operations";
import { createAdminWebsiteOperation, updateAdminWebsiteOperation, deleteAdminWebsiteOperation } from "@/lib/server/websites-operations";
import { createAdminAdvertisementOperation, updateAdminAdvertisementOperation, deleteAdminAdvertisementOperation } from "@/lib/server/advertisements-operations";
import { createAdminAwardOperation, updateAdminAwardOperation, deleteAdminAwardOperation } from "@/lib/server/awards-operations";
import { getSelfNotificationsOperation, createNotificationEvent } from "@/lib/server/notification-operations";
import { submitPublicContactMessageOperation } from "@/lib/server/contact-operations";

const admin1Id = "11111111-1111-4111-8111-111111111111";
const admin2Id = "22222222-2222-4222-8222-222222222222";
const editorId = "33333333-3333-4333-8333-333333333333";

let currentAuthContext = {
  user: { id: admin1Id, email: "admin1@cobralearn.com" },
  profile: {
    id: admin1Id,
    email: "admin1@cobralearn.com",
    fullName: "Admin One",
    role: "SUPER_ADMIN" as const,
    isActive: true,
    preferences: null,
  },
};

vi.mock("@/lib/auth/server-auth", () => ({
  requireAdminProfile: vi.fn().mockImplementation(async () => currentAuthContext),
  requirePermission: vi.fn().mockImplementation(async () => currentAuthContext),
  requireRole: vi.fn().mockImplementation(async () => currentAuthContext),
}));

describe("CobraLearn Admin Portal — Global Loading, Search & Notifications", () => {
  describe("Phase 2: Global Loading Experience & Progress Integrity", () => {
    it("renders indeterminate progress bar by default and NEVER displays fabricated 68%", () => {
      render(React.createElement(MediaLoadingState, {}));

      // Fabricated percentage 68% must NOT be present
      expect(screen.queryByText(/68%/)).toBeNull();
      expect(screen.queryByText(/68/)).toBeNull();

      // Indeterminate progress bar shimmer must be rendered
      const indeterminateBar = screen.getByTestId("indeterminate-progress-bar");
      expect(indeterminateBar).toBeDefined();

      // Title should be displayed
      expect(screen.getByText("Loading Media Assets...")).toBeDefined();
    });

    it("displays genuine numeric percentage only when explicit progress number is provided", () => {
      render(React.createElement(MediaLoadingState, { title: "Uploading asset...", progress: 42 }));

      expect(screen.getByText("42%")).toBeDefined();
      expect(screen.queryByTestId("indeterminate-progress-bar")).toBeNull();
    });
  });

  describe("Phase 3: Cross-Module Global Search", () => {
    let mockPrisma: any;

    beforeEach(() => {
      currentAuthContext = {
        user: { id: admin1Id, email: "admin1@cobralearn.com" },
        profile: {
          id: admin1Id,
          email: "admin1@cobralearn.com",
          fullName: "Admin One",
          role: "SUPER_ADMIN" as const,
          isActive: true,
          preferences: null,
        },
      };

      mockPrisma = {
        project: {
          findMany: vi.fn().mockResolvedValue([
            { id: "proj-1", name: "Cobra Learn Platform", slug: "cobra-learn", status: "PUBLISHED", category: "Web App", description: "EdTech Platform" },
          ]),
        },
        website: {
          findMany: vi.fn().mockResolvedValue([
            { id: "web-1", name: "Cobra Showcase Website", slug: "cobra-showcase", status: "PUBLISHED", category: "Portfolio", description: "Showcase site" },
          ]),
        },
        advertisement: {
          findMany: vi.fn().mockResolvedValue([
            { id: "ad-1", name: "Winter Campaign Banner", slug: "winter-banner", brand: "Cobra", status: "PUBLISHED", campaign: "Winter Launch" },
          ]),
        },
        award: {
          findMany: vi.fn().mockResolvedValue([
            { id: "aw-1", name: "Excellence in EdTech 2026", slug: "excellence-edtech", status: "PUBLISHED", organization: "Web Awards", year: 2026 },
          ]),
        },
        mediaAsset: {
          findMany: vi.fn().mockResolvedValue([
            { id: "media-1", originalName: "cobra-banner.png", title: "Cobra Header", mimeType: "image/png", fileSize: 204800, publicUrl: "https://storage/cobra.png" },
          ]),
        },
        contactMessage: {
          findMany: vi.fn().mockResolvedValue([
            { id: "msg-1", fullName: "Alice Student", email: "alice@example.com", subject: "Course Inquiry about Cobra", status: "NEW", createdAt: new Date() },
          ]),
        },
      };
    });

    it("returns empty result if query length is less than 2 characters", async () => {
      const dummyReq = new Request("https://api.internal/admin/search?q=a");
      const res = await searchGlobalAdminOperation(dummyReq, "a", mockPrisma);

      expect(res.totalCount).toBe(0);
      expect(res.groups).toEqual([]);
    });

    it("searches across all CMS entities, media assets, messages, and settings for authorized Super Admin", async () => {
      const dummyReq = new Request("https://api.internal/admin/search?q=Cobra");
      const res = await searchGlobalAdminOperation(dummyReq, "Cobra", mockPrisma);

      expect(res.totalCount).toBeGreaterThan(0);
      const categoryNames = res.groups.map((g) => g.category);
      expect(categoryNames).toContain("projects");
      expect(categoryNames).toContain("websites");
      expect(categoryNames).toContain("advertisements");
      expect(categoryNames).toContain("awards");
      expect(categoryNames).toContain("media");
      expect(categoryNames).toContain("messages");
      expect(categoryNames).toContain("settings");
    });

    it("strictly hides Contact Messages from users without CONTACT_READ permission", async () => {
      currentAuthContext = {
        user: { id: "viewer-1", email: "viewer@cobralearn.com" },
        profile: {
          id: "viewer-1",
          email: "viewer@cobralearn.com",
          fullName: "Viewer User",
          role: "VIEWER" as any,
          isActive: true,
          preferences: null,
        },
      };

      const dummyReq = new Request("https://api.internal/admin/search?q=Cobra");
      const res = await searchGlobalAdminOperation(dummyReq, "Cobra", mockPrisma);

      const categoryNames = res.groups.map((g) => g.category);
      expect(categoryNames).not.toContain("messages");
      expect(mockPrisma.contactMessage.findMany).not.toHaveBeenCalled();
    });
  });

  describe("Phase 4: CMS Lifecycle Content Notifications across all 4 Modules", () => {
    let mockNotificationsDb: any[];
    let mockPrisma: any;

    beforeEach(() => {
      mockNotificationsDb = [];

      currentAuthContext = {
        user: { id: admin1Id, email: "admin1@cobralearn.com" },
        profile: {
          id: admin1Id,
          email: "admin1@cobralearn.com",
          fullName: "Admin One",
          role: "SUPER_ADMIN" as const,
          isActive: true,
          preferences: null,
        },
      };

      mockPrisma = {
        $transaction: vi.fn().mockImplementation(async (cb: any) => cb(mockPrisma)),
        mediaAsset: {
          findUnique: vi.fn().mockResolvedValue({ id: "thumb-1" }),
          findMany: vi.fn().mockResolvedValue([{ id: "thumb-1" }]),
        },
        adminProfile: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: admin1Id,
              email: "admin1@cobralearn.com",
              fullName: "Admin One",
              role: "SUPER_ADMIN",
              isActive: true,
              preferences: { notifications: { contentUpdates: true } },
            },
            {
              id: admin2Id,
              email: "admin2@cobralearn.com",
              fullName: "Admin Two",
              role: "ADMIN",
              isActive: true,
              preferences: { notifications: { contentUpdates: false } }, // Opted out!
            },
          ]),
          findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
            if (where.id === admin1Id) {
              return { id: admin1Id, role: "SUPER_ADMIN", isActive: true, preferences: { notifications: { contentUpdates: true } } };
            }
            return null;
          }),
        },
        adminNotification: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return mockNotificationsDb.find((n) => n.adminId === where.adminId && n.eventKey === where.eventKey) || null;
          }),
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            const notif = { id: `notif-${mockNotificationsDb.length + 1}`, ...data, isRead: false, createdAt: new Date() };
            mockNotificationsDb.push(notif);
            return notif;
          }),
        },
        adminAuditLog: {
          create: vi.fn().mockResolvedValue({ id: "audit-1" }),
        },
      };
    });

    it("Projects: Draft creation does NOT dispatch notification, but publishing draft dispatches 'Project Published'", async () => {
      // 1. Create a Project as DRAFT
      let projectRecord = {
        id: "proj-1",
        name: "NextGen LMS",
        slug: "nextgen-lms",
        description: "LMS description",
        status: "DRAFT" as const,
        thumbnailId: "thumb-1",
        category: "Tech",
        publishedAt: null,
      };

      mockPrisma.project = {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(projectRecord),
        update: vi.fn().mockImplementation(async ({ data }: any) => {
          projectRecord = { ...projectRecord, ...data };
          return projectRecord;
        }),
      };
      mockPrisma.projectGalleryItem = {
        create: vi.fn().mockResolvedValue({ id: "gal-1" }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      };

      const dummyReq = new Request("https://api.internal/admin/projects", { method: "POST" });
      await createAdminProjectOperation(
        dummyReq,
        {
          name: "NextGen LMS",
          description: "LMS description",
          thumbnailId: "thumb-1",
          status: "DRAFT",
        },
        mockPrisma
      );

      // Verify NO notification created for draft creation
      expect(mockNotificationsDb.length).toBe(0);

      // 2. Publish the drafted project
      mockPrisma.project.findUnique = vi.fn().mockResolvedValue(projectRecord);
      await updateAdminProjectOperation(
        dummyReq,
        "proj-1",
        { status: "PUBLISHED" },
        mockPrisma
      );

      // Verify "Project Published" notification was dispatched
      expect(mockNotificationsDb.length).toBe(1);
      expect(mockNotificationsDb[0].title).toBe("Project Published");
      expect(mockNotificationsDb[0].adminId).toBe(admin1Id); // Opted-in recipient
      expect(mockNotificationsDb[0].eventKey).toBe("project:published:proj-1");

      // Verify opted-out Admin Two did NOT receive notification
      const admin2Notifs = mockNotificationsDb.filter((n) => n.adminId === admin2Id);
      expect(admin2Notifs.length).toBe(0);
    });

    it("Websites: Publishing a website generates 'Website Published' notification with valid name and no 'undefined'", async () => {
      let websiteRecord = {
        id: "web-100",
        name: "Cobra Academy",
        slug: "cobra-academy",
        url: "https://academy.cobralearn.com",
        description: "Academy portal",
        status: "DRAFT" as const,
        thumbnailId: "thumb-1",
        publishedAt: null,
      };

      mockPrisma.website = {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(websiteRecord),
        findUniqueOrThrow: vi.fn().mockImplementation(async () => websiteRecord),
        create: vi.fn().mockResolvedValue(websiteRecord),
        update: vi.fn().mockImplementation(async ({ data }: any) => {
          websiteRecord = { ...websiteRecord, ...data };
          return websiteRecord;
        }),
      };
      mockPrisma.websiteGalleryItem = {
        create: vi.fn().mockResolvedValue({ id: "gal-w1" }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      };

      const dummyReq = new Request("https://api.internal/admin/websites", { method: "PUT" });
      await updateAdminWebsiteOperation(
        dummyReq,
        "web-100",
        { status: "PUBLISHED", url: "https://academy.cobralearn.com" },
        mockPrisma
      );

      expect(mockNotificationsDb.length).toBe(1);
      const notif = mockNotificationsDb[0];
      expect(notif.title).toBe("Website Published");
      expect(notif.message).toContain('published website "Cobra Academy"');
      expect(notif.message).not.toContain("undefined");
      expect(notif.link).toBe("/admin/websites");
      expect(notif.eventKey).toBe("website:published:web-100");
    });

    it("Advertisements: Activation/publishing generates 'Advertisement Published' notification", async () => {
      let adRecord = {
        id: "ad-200",
        name: "Summer Sale 2026",
        slug: "summer-sale-2026",
        campaign: "Summer Promo",
        brand: "Cobra",
        description: "Summer sale",
        status: "DRAFT" as const,
        thumbnailId: "thumb-1",
        publishedAt: null,
      };

      mockPrisma.advertisement = {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(adRecord),
        findUniqueOrThrow: vi.fn().mockImplementation(async () => adRecord),
        create: vi.fn().mockResolvedValue(adRecord),
        update: vi.fn().mockImplementation(async ({ data }: any) => {
          adRecord = { ...adRecord, ...data };
          return adRecord;
        }),
      };

      const dummyReq = new Request("https://api.internal/admin/advertisements", { method: "PUT" });
      await updateAdminAdvertisementOperation(
        dummyReq,
        "ad-200",
        { status: "PUBLISHED" },
        mockPrisma
      );

      expect(mockNotificationsDb.length).toBe(1);
      const notif = mockNotificationsDb[0];
      expect(notif.title).toBe("Advertisement Published");
      expect(notif.message).toContain('published advertisement "Summer Sale 2026"');
      expect(notif.eventKey).toBe("advertisement:published:ad-200");
    });

    it("Awards: Publishing generates 'Award Published' notification and draft edits generate NO notification", async () => {
      let awardRecord = {
        id: "aw-300",
        name: "Best Tech Stack 2026",
        slug: "best-tech-stack-2026",
        organization: "Tech Council",
        category: "Architecture",
        description: "Best tech stack award",
        status: "DRAFT" as const,
        thumbnailId: "thumb-1",
        publishedAt: null,
      };

      mockPrisma.award = {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(awardRecord),
        findUniqueOrThrow: vi.fn().mockImplementation(async () => awardRecord),
        update: vi.fn().mockImplementation(async ({ data }: any) => {
          awardRecord = { ...awardRecord, ...data };
          return awardRecord;
        }),
      };

      const dummyReq = new Request("https://api.internal/admin/awards", { method: "PUT" });
      
      // Draft edit without status change to PUBLISHED:
      await updateAdminAwardOperation(
        dummyReq,
        "aw-300",
        { description: "Updated draft description" },
        mockPrisma
      );
      expect(mockNotificationsDb.length).toBe(0);

      // Now publish:
      await updateAdminAwardOperation(
        dummyReq,
        "aw-300",
        { status: "PUBLISHED" },
        mockPrisma
      );

      expect(mockNotificationsDb.length).toBe(1);
      const notif = mockNotificationsDb[0];
      expect(notif.title).toBe("Award Published");
      expect(notif.message).toContain('published award "Best Tech Stack 2026"');
      expect(notif.eventKey).toBe("award:published:aw-300");
    });

    it("Deduplication: suppresses duplicate dispatch with the same eventKey", async () => {
      // First dispatch
      const count1 = await createNotificationEvent(
        {
          category: "CONTENT_UPDATE",
          title: "Project Published",
          message: "Published project",
          eventKey: "project:published:dup-1",
        },
        mockPrisma
      );
      expect(count1).toBe(1);
      expect(mockNotificationsDb.length).toBe(1);

      // Second dispatch with same eventKey
      const count2 = await createNotificationEvent(
        {
          category: "CONTENT_UPDATE",
          title: "Project Published",
          message: "Published project",
          eventKey: "project:published:dup-1",
        },
        mockPrisma
      );
      expect(count2).toBe(0);
      expect(mockNotificationsDb.length).toBe(1); // Still 1!
    });
  });

  describe("Phase 5: Notification Preferences Wiring", () => {
    let mockNotificationsDb: any[];
    let mockPrisma: any;

    beforeEach(() => {
      mockNotificationsDb = [];
      mockPrisma = {
        adminProfile: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: admin1Id,
              email: "admin1@cobralearn.com",
              role: "SUPER_ADMIN",
              isActive: true,
              preferences: {
                notifications: {
                  contactInquiries: true,
                  contentUpdates: false,
                  securityAlerts: true,
                  adminActivities: false,
                },
              },
            },
            {
              id: admin2Id,
              email: "admin2@cobralearn.com",
              role: "ADMIN",
              isActive: true,
              preferences: {
                notifications: {
                  contactInquiries: false,
                  contentUpdates: true,
                  securityAlerts: false,
                  adminActivities: true,
                },
              },
            },
          ]),
          findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
            if (where.id === admin1Id) {
              return { id: admin1Id, role: "SUPER_ADMIN", isActive: true };
            }
            return null;
          }),
        },
        adminNotification: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            const notif = { id: `notif-${mockNotificationsDb.length + 1}`, ...data, isRead: false, createdAt: new Date() };
            mockNotificationsDb.push(notif);
            return notif;
          }),
        },
      };
    });

    it("respects category preferences: CONTACT_INQUIRY sent only to opted-in admin", async () => {
      await createNotificationEvent(
        {
          category: "CONTACT_INQUIRY",
          title: "New Inquiry",
          message: "Hello world",
        },
        mockPrisma
      );

      // Admin 1 has contactInquiries: true, Admin 2 has contactInquiries: false
      expect(mockNotificationsDb.length).toBe(1);
      expect(mockNotificationsDb[0].adminId).toBe(admin1Id);
    });

    it("respects category preferences: CONTENT_UPDATE sent only to opted-in admin", async () => {
      await createNotificationEvent(
        {
          category: "CONTENT_UPDATE",
          title: "Project Published",
          message: "New project",
        },
        mockPrisma
      );

      // Admin 1 has contentUpdates: false, Admin 2 has contentUpdates: true
      expect(mockNotificationsDb.length).toBe(1);
      expect(mockNotificationsDb[0].adminId).toBe(admin2Id);
    });

    it("respects category preferences: ADMIN_ACTIVITY sent only to opted-in admin", async () => {
      await createNotificationEvent(
        {
          category: "ADMIN_ACTIVITY",
          title: "Settings Changed",
          message: "Changed settings",
        },
        mockPrisma
      );

      // Admin 1 has adminActivities: false, Admin 2 has adminActivities: true
      expect(mockNotificationsDb.length).toBe(1);
      expect(mockNotificationsDb[0].adminId).toBe(admin2Id);
    });

    it("respects category preferences: SECURITY_ALERT sent only to opted-in admin", async () => {
      await createNotificationEvent(
        {
          category: "SECURITY_ALERT",
          title: "Security Warning",
          message: "Role updated",
        },
        mockPrisma
      );

      // Admin 1 has securityAlerts: true, Admin 2 has securityAlerts: false
      expect(mockNotificationsDb.length).toBe(1);
      expect(mockNotificationsDb[0].adminId).toBe(admin1Id);
    });
  });
});
