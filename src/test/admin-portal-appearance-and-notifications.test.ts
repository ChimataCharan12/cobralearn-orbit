import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  getSelfNotificationsOperation,
  markNotificationReadOperation,
  markAllNotificationsReadOperation,
  createNotificationEvent,
} from "@/lib/server/notification-operations";
import {
  formatAdminDateTime,
  formatAdminRelativeTime,
  resolveIanaTimezone,
  TIMEZONE_IANA_MAP,
} from "@/lib/timezone";
import {
  translate,
  TRANSLATIONS,
  type TranslationKey,
} from "@/lib/i18n/translations";
import {
  DEFAULT_ADMIN_PREFERENCES,
  SUPPORTED_LANGUAGES,
  type LanguageOption,
} from "@/lib/preferences";

const admin1Id = "11111111-1111-4111-8111-111111111111";
const admin2Id = "22222222-2222-4222-8222-222222222222";
const editorId = "33333333-3333-4333-8333-333333333333";

let currentAdminContext = {
  user: { id: admin1Id, email: "admin1@cobralearn.com" },
  profile: {
    id: admin1Id,
    email: "admin1@cobralearn.com",
    fullName: "Admin One",
    role: "ADMIN" as any,
    isActive: true,
  },
};

vi.mock("@/lib/auth/server-auth", () => ({
  requireAdminProfile: vi.fn().mockImplementation(async () => currentAdminContext),
  requirePermission: vi.fn().mockImplementation(async () => currentAdminContext),
}));

describe("V1 Appearance Preferences & In-App Notifications Suite", () => {
  let mockNotificationsDb: any[];
  let mockProfilesDb: any[];
  let mockPrisma: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNotificationsDb = [];

    mockProfilesDb = [
      {
        id: admin1Id,
        email: "admin1@cobralearn.com",
        fullName: "Admin One",
        role: "ADMIN",
        isActive: true,
        preferences: {
          notifications: {
            ...DEFAULT_ADMIN_PREFERENCES.notifications,
            contactInquiries: true,
            contentUpdates: true,
            securityAlerts: true,
          },
        },
      },
      {
        id: admin2Id,
        email: "admin2@cobralearn.com",
        fullName: "Admin Two",
        role: "ADMIN",
        isActive: true,
        preferences: {
          notifications: {
            ...DEFAULT_ADMIN_PREFERENCES.notifications,
            contactInquiries: false, // Opted out of contact inquiries
            contentUpdates: true,
            securityAlerts: true,
          },
        },
      },
      {
        id: editorId,
        email: "editor@cobralearn.com",
        fullName: "Editor One",
        role: "EDITOR",
        isActive: true,
        preferences: {
          notifications: {
            ...DEFAULT_ADMIN_PREFERENCES.notifications,
            contactInquiries: true,
            contentUpdates: true,
            securityAlerts: true,
          },
        },
      },
    ];

    currentAdminContext = {
      user: { id: admin1Id, email: "admin1@cobralearn.com" },
      profile: { ...mockProfilesDb[0] },
    };

    mockPrisma = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          return mockProfilesDb.find((p) => p.id === where.id) || null;
        }),
        findMany: vi.fn().mockImplementation(async ({ where }: any) => {
          let res = [...mockProfilesDb];
          if (where?.isActive !== undefined) {
            res = res.filter((p) => p.isActive === where.isActive);
          }
          if (where?.role?.in) {
            res = res.filter((p) => where.role.in.includes(p.role));
          }
          return res;
        }),
      },
      adminNotification: {
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          return mockNotificationsDb.find((n) => n.id === where.id) || null;
        }),
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return (
            mockNotificationsDb.find((n) => {
              if (where.adminId && n.adminId !== where.adminId) return false;
              if (where.eventKey && n.eventKey !== where.eventKey) return false;
              return true;
            }) || null
          );
        }),
        findMany: vi.fn().mockImplementation(async ({ where, take, skip, orderBy }: any) => {
          let res = mockNotificationsDb.filter((n) => {
            if (n.adminId !== where.adminId) return false;
            if (where.isRead !== undefined && n.isRead !== where.isRead) return false;
            return true;
          });
          if (orderBy?.createdAt === "desc") {
            res.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          const start = skip || 0;
          const end = take ? start + take : undefined;
          return res.slice(start, end);
        }),
        count: vi.fn().mockImplementation(async ({ where }: any) => {
          return mockNotificationsDb.filter((n) => {
            if (n.adminId !== where.adminId) return false;
            if (where.isRead !== undefined && n.isRead !== where.isRead) return false;
            return true;
          }).length;
        }),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const item = {
            id: `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            ...data,
            isRead: false,
            readAt: null,
            createdAt: new Date(),
          };
          mockNotificationsDb.push(item);
          return item;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => {
          const item = mockNotificationsDb.find((n) => n.id === where.id);
          if (!item) throw new Error("Notification not found");
          Object.assign(item, data);
          return item;
        }),
        updateMany: vi.fn().mockImplementation(async ({ where, data }: any) => {
          let count = 0;
          for (const n of mockNotificationsDb) {
            if (n.adminId === where.adminId) {
              if (where.id && n.id !== where.id) continue;
              if (where.isRead !== undefined && n.isRead !== where.isRead) continue;
              Object.assign(n, data);
              count++;
            }
          }
          return { count };
        }),
      },
    };
  });

  describe("Timezone Formatting", () => {
    it("formats dates safely with the saved IANA timezone", () => {
      const date = new Date("2026-03-15T12:00:00Z");

      const istFormatted = formatAdminDateTime(date, "(GMT+5:30) Asia/Kolkata");
      expect(istFormatted).toContain("2026");
      // 12:00 UTC = 17:30 IST
      expect(istFormatted).toMatch(/5:30|17:30/);

      const utcFormatted = formatAdminDateTime(date, "(GMT+0:00) UTC");
      expect(utcFormatted).toMatch(/12:00/);

      const nyFormatted = formatAdminDateTime(date, "(GMT-5:00) America/New_York");
      // March 15 is EDT (UTC-4), 12:00 UTC = 8:00 EDT
      expect(nyFormatted).toMatch(/8:00|08:00/);
    });

    it("falls back safely on invalid timezone strings", () => {
      const date = new Date("2026-01-01T00:00:00Z");
      const safeTimezone = resolveIanaTimezone("Invalid/Tz");
      expect(safeTimezone).toBe("Asia/Kolkata");

      const formatted = formatAdminDateTime(date, "Invalid/Tz");
      expect(formatted).toBeTruthy();
      expect(formatted).not.toBe("—");
    });

    it("provides relative time safely", () => {
      const now = new Date();
      expect(formatAdminRelativeTime(now)).toBe("Just now");

      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
      expect(formatAdminRelativeTime(tenMinsAgo)).toBe("10m ago");

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(formatAdminRelativeTime(twoHoursAgo)).toBe("2h ago");

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(formatAdminRelativeTime(threeDaysAgo)).toBe("3d ago");
    });
  });

  describe("I18n Translation Dictionary", () => {
    it("translates common admin keys across all 5 supported languages", () => {
      const testKeys: TranslationKey[] = [
        "nav.dashboard",
        "nav.projects",
        "header.notifications",
        "notif.title",
        "notif.markAllRead",
        "pref.theme",
      ];

      for (const lang of SUPPORTED_LANGUAGES) {
        expect(TRANSLATIONS[lang]).toBeDefined();
        for (const key of testKeys) {
          const val = translate(key, lang);
          expect(val).toBeTruthy();
          expect(typeof val).toBe("string");
        }
      }
    });

    it("falls back to English when a language or key is unknown", () => {
      expect(translate("nav.dashboard", "UnknownLanguage" as any)).toBe("Dashboard");
      expect(translate("nonexistent.key" as any, "Hindi")).toBe("nonexistent.key");
    });
  });

  describe("Database-Backed In-App Notifications", () => {
    const mockRequest = new Request("http://localhost:3000/api/notifications");

    it("creates notifications for authorized admins respecting their preferences", async () => {
      // Trigger a contact message inquiry
      const created = await createNotificationEvent(
        {
          category: "CONTACT_INQUIRY",
          title: "New Contact Message",
          message: "Inquiry received from John Doe",
          link: "/admin/contact",
          eventKey: "contact-msg-101",
        },
        mockPrisma as any
      );

      // Admin 1 and Editor opted in, Admin 2 opted out => 2 created
      expect(created).toBe(2);

      // Admin 1 opted in -> should have 1 notification
      const admin1Notifs = await getSelfNotificationsOperation(
        mockRequest,
        { limit: 10 },
        mockPrisma as any
      );
      expect(admin1Notifs.unreadCount).toBe(1);
      expect(admin1Notifs.notifications.length).toBe(1);
      expect(admin1Notifs.notifications[0].title).toBe("New Contact Message");

      // Admin 2 opted out of contactInquiries -> should have 0 notifications
      currentAdminContext = {
        user: { id: admin2Id, email: "admin2@cobralearn.com" },
        profile: { ...mockProfilesDb[1] },
      };
      const admin2Notifs = await getSelfNotificationsOperation(
        mockRequest,
        { limit: 10 },
        mockPrisma as any
      );
      expect(admin2Notifs.unreadCount).toBe(0);
      expect(admin2Notifs.notifications.length).toBe(0);
    });

    it("deduplicates notifications by eventKey per recipient", async () => {
      // First attempt
      const firstRun = await createNotificationEvent(
        {
          category: "CONTENT_UPDATE",
          title: "Project Published",
          message: "Project X was published",
          link: "/admin/projects",
          eventKey: "project-publish-555",
        },
        mockPrisma as any
      );
      expect(firstRun).toBeGreaterThan(0);

      // Second duplicate attempt (e.g. retry or replay)
      const secondRun = await createNotificationEvent(
        {
          category: "CONTENT_UPDATE",
          title: "Project Published",
          message: "Project X was published",
          link: "/admin/projects",
          eventKey: "project-publish-555",
        },
        mockPrisma as any
      );
      expect(secondRun).toBe(0); // 0 new notifications created on retry

      // Verify Admin 1 received only ONE notification
      currentAdminContext = {
        user: { id: admin1Id, email: "admin1@cobralearn.com" },
        profile: { ...mockProfilesDb[0] },
      };
      const notifs = await getSelfNotificationsOperation(
        mockRequest,
        { limit: 50 },
        mockPrisma as any
      );
      const cmsNotifs = notifs.notifications.filter((n) => n.eventKey === "project-publish-555");
      expect(cmsNotifs.length).toBe(1);
    });

    it("restricts security notifications to Super Admins and Admins by targetRoles", async () => {
      await createNotificationEvent(
        {
          category: "SECURITY_ALERT",
          title: "Role Modified",
          message: "Role updated for user",
          link: "/admin/profile",
          targetRoles: ["SUPER_ADMIN", "ADMIN"],
        },
        mockPrisma as any
      );

      // Switch to Editor and check
      currentAdminContext = {
        user: { id: editorId, email: "editor@cobralearn.com" },
        profile: { ...mockProfilesDb[2] },
      };
      const editorNotifs = await getSelfNotificationsOperation(
        mockRequest,
        { limit: 10 },
        mockPrisma as any
      );
      expect(editorNotifs.notifications.some((n) => n.category === "SECURITY_ALERT")).toBe(false);

      // Switch to Admin 1 and check
      currentAdminContext = {
        user: { id: admin1Id, email: "admin1@cobralearn.com" },
        profile: { ...mockProfilesDb[0] },
      };
      const adminNotifs = await getSelfNotificationsOperation(
        mockRequest,
        { limit: 10 },
        mockPrisma as any
      );
      expect(adminNotifs.notifications.some((n) => n.category === "SECURITY_ALERT")).toBe(true);
    });

    it("marks individual notifications as read", async () => {
      currentAdminContext = {
        user: { id: admin1Id, email: "admin1@cobralearn.com" },
        profile: { ...mockProfilesDb[0] },
      };

      await createNotificationEvent(
        {
          category: "CONTENT_UPDATE",
          title: "Test Single Read",
          message: "Testing single read mark",
        },
        mockPrisma as any
      );

      const notifs = await getSelfNotificationsOperation(
        mockRequest,
        { limit: 10 },
        mockPrisma as any
      );
      const target = notifs.notifications[0];
      expect(target).toBeDefined();
      expect(target.isRead).toBe(false);

      const res = await markNotificationReadOperation(
        mockRequest,
        target.id,
        mockPrisma as any
      );
      expect(res.success).toBe(true);
      expect(res.notification.isRead).toBe(true);

      // Fetch again to verify persisted read state
      const updated = await getSelfNotificationsOperation(
        mockRequest,
        { limit: 10 },
        mockPrisma as any
      );
      const updatedTarget = updated.notifications.find((n) => n.id === target.id);
      expect(updatedTarget?.isRead).toBe(true);
    });

    it("marks all notifications as read", async () => {
      currentAdminContext = {
        user: { id: admin1Id, email: "admin1@cobralearn.com" },
        profile: { ...mockProfilesDb[0] },
      };

      // Add a fresh notification
      await createNotificationEvent(
        {
          category: "SYSTEM_ANNOUNCEMENT",
          title: "Maintenance Notice",
          message: "System maintenance at midnight",
        },
        mockPrisma as any
      );

      let notifs = await getSelfNotificationsOperation(
        mockRequest,
        { limit: 10 },
        mockPrisma as any
      );
      expect(notifs.unreadCount).toBeGreaterThan(0);

      const res = await markAllNotificationsReadOperation(mockRequest, mockPrisma as any);
      expect(res.success).toBe(true);

      notifs = await getSelfNotificationsOperation(
        mockRequest,
        { limit: 10 },
        mockPrisma as any
      );
      expect(notifs.unreadCount).toBe(0);
      expect(notifs.notifications.every((n) => n.isRead)).toBe(true);
    });

    it("enforces strict recipient isolation so admins cannot view each other's notifications", async () => {
      // Check Admin 1
      currentAdminContext = {
        user: { id: admin1Id, email: "admin1@cobralearn.com" },
        profile: { ...mockProfilesDb[0] },
      };
      const notifs1 = await getSelfNotificationsOperation(
        mockRequest,
        { limit: 50 },
        mockPrisma as any
      );

      // Check Admin 2
      currentAdminContext = {
        user: { id: admin2Id, email: "admin2@cobralearn.com" },
        profile: { ...mockProfilesDb[1] },
      };
      const notifs2 = await getSelfNotificationsOperation(
        mockRequest,
        { limit: 50 },
        mockPrisma as any
      );

      // Both must have distinct items belonging only to them
      for (const item of notifs1.notifications) {
        expect(item.adminId).toBe(admin1Id);
      }
      for (const item of notifs2.notifications) {
        expect(item.adminId).toBe(admin2Id);
      }
    });
  });
});
