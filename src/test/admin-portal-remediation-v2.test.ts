import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitPublicContactMessageOperation } from "@/lib/server/contact-operations";
import {
  getSelfNotificationsOperation,
  createNotificationEvent,
} from "@/lib/server/notification-operations";
import {
  translate,
  TRANSLATIONS,
  type TranslationKey,
} from "@/lib/i18n/translations";
import {
  mergeWithDefaultPreferences,
  SUPPORTED_LANGUAGES,
  SUPPORTED_THEMES,
  DEFAULT_PORTAL_PREFERENCES,
} from "@/lib/preferences";

const adminId1 = "11111111-aaaa-4111-8111-111111111111";
const adminId2 = "22222222-bbbb-4222-8222-222222222222";

let currentAuthAdmin = {
  user: { id: adminId1, email: "admin1@cobralearn.com" },
  profile: {
    id: adminId1,
    email: "admin1@cobralearn.com",
    fullName: "Admin One",
    role: "ADMIN" as any,
    isActive: true,
  },
};

vi.mock("@/lib/auth/server-auth", () => ({
  requireAdminProfile: vi.fn().mockImplementation(async () => currentAuthAdmin),
  requirePermission: vi.fn().mockImplementation(async () => currentAuthAdmin),
}));

describe("Admin Portal Remediation Verification Suite", () => {
  describe("Phase 1: Sidebar Layout & Collapse Architecture", () => {
    it("ensures default preferences specify false for sidebarCollapse and can be toggled", () => {
      const prefs = mergeWithDefaultPreferences();
      expect(prefs.portal.sidebarCollapse).toBe(false);

      const collapsedPrefs = mergeWithDefaultPreferences({
        portal: { sidebarCollapse: true },
      });
      expect(collapsedPrefs.portal.sidebarCollapse).toBe(true);
    });
  });

  describe("Phase 2: Dark Theme Exclusive & Normalization of Legacy Light Preferences", () => {
    it("only supports 'dark' as a valid theme option", () => {
      expect(SUPPORTED_THEMES).toEqual(["dark"]);
      expect(DEFAULT_PORTAL_PREFERENCES.theme).toBe("dark");
    });

    it("safely normalizes legacy 'light' preference to 'dark' without database migration", () => {
      const legacyRawPrefs = {
        portal: {
          theme: "light",
          selectedAccent: "emerald",
        },
      };

      const normalized = mergeWithDefaultPreferences(legacyRawPrefs);
      expect(normalized.portal.theme).toBe("dark");
      expect(normalized.portal.selectedAccent).toBe("emerald");
    });

    it("safely normalizes legacy 'system' or corrupted preference to 'dark'", () => {
      const legacySystemPrefs = {
        portal: {
          theme: "system",
        },
      };

      const normalized = mergeWithDefaultPreferences(legacySystemPrefs);
      expect(normalized.portal.theme).toBe("dark");

      const corruptedPrefs = {
        portal: {
          theme: "neon-cyan",
        },
      };
      const normalizedCorrupted = mergeWithDefaultPreferences(corruptedPrefs);
      expect(normalizedCorrupted.portal.theme).toBe("dark");
    });
  });

  describe("Phase 3: Complete 5-Language Localization Parity", () => {
    it("has 100% key parity across English, Hindi, Spanish, French, and German", () => {
      const englishKeys = Object.keys(TRANSLATIONS.English) as TranslationKey[];
      expect(englishKeys.length).toBeGreaterThan(45);

      for (const lang of SUPPORTED_LANGUAGES) {
        const langDict = TRANSLATIONS[lang];
        expect(langDict, `Dictionary for ${lang} must exist`).toBeDefined();

        for (const key of englishKeys) {
          const translatedValue = langDict[key];
          expect(
            translatedValue,
            `Key "${key}" is missing or empty in language "${lang}"`
          ).toBeTruthy();
          expect(typeof translatedValue).toBe("string");
          expect(translatedValue.trim().length).toBeGreaterThan(0);
        }

        // Verify no extra unknown keys in this language
        const langKeys = Object.keys(langDict);
        expect(langKeys.length).toBe(englishKeys.length);
      }
    });

    it("translates new notifications, profile, and dashboard keys correctly in Hindi", () => {
      expect(translate("nav.notifications", "Hindi")).toBe("सूचनाएं");
      expect(translate("notif.markAllRead", "Hindi")).toBe("सभी को पढ़ा हुआ चिह्नित करें");
      expect(translate("dashboard.welcomeBack", "Hindi")).toBe("वापसी पर स्वागत है,");
      expect(translate("pref.saveBtn", "Hindi")).toBe("प्राथमिकताएं सहेजें");
    });

    it("falls back safely to English when language is null or unknown", () => {
      expect(translate("nav.notifications", null)).toBe("Notifications");
      expect(translate("nav.notifications", "Esperanto" as any)).toBe("Notifications");
    });
  });

  describe("Phase 4: Contact Inquiry In-App Notification Dispatch", () => {
    let mockNotificationsDb: any[];
    let mockProfilesDb: any[];
    let mockPrisma: any;

    beforeEach(() => {
      mockNotificationsDb = [];
      mockProfilesDb = [
        {
          id: adminId1,
          email: "admin1@cobralearn.com",
          fullName: "Admin One",
          role: "ADMIN",
          isActive: true,
          preferences: {
            notifications: {
              contactInquiries: true, // Opted IN
            },
          },
        },
        {
          id: adminId2,
          email: "admin2@cobralearn.com",
          fullName: "Admin Two",
          role: "ADMIN",
          isActive: true,
          preferences: {
            notifications: {
              contactInquiries: false, // Opted OUT
            },
          },
        },
      ];

      mockPrisma = {
        contactConfig: {
          findFirst: vi.fn().mockResolvedValue({
            id: "cfg-1",
            spamProtectionEnabled: false,
            rateLimitPerHour: 100,
            autoReplyEnabled: false,
          }),
        },
        contactMessage: {
          findFirst: vi.fn().mockResolvedValue(null),
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockImplementation(async ({ data }: any) => ({
            id: "msg-123",
            ...data,
            createdAt: new Date(),
          })),
        },
        adminProfile: {
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
          findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
            return mockProfilesDb.find((p) => p.id === where.id) || null;
          }),
        },
        adminNotification: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return (
              mockNotificationsDb.find((n) => {
                if (where.adminId && n.adminId !== where.adminId) return false;
                if (where.eventKey && n.eventKey !== where.eventKey) return false;
                return true;
              }) || null
            );
          }),
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            const notif = {
              id: `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              ...data,
              isRead: false,
              readAt: null,
              createdAt: new Date(),
            };
            mockNotificationsDb.push(notif);
            return notif;
          }),
          findMany: vi.fn().mockImplementation(async ({ where }: any) => {
            return mockNotificationsDb.filter((n) => {
              if (where.adminId && n.adminId !== where.adminId) return false;
              if (where.category && n.category !== where.category) return false;
              if (where.isRead !== undefined && n.isRead !== where.isRead) return false;
              return true;
            });
          }),
          count: vi.fn().mockImplementation(async ({ where }: any) => {
            return mockNotificationsDb.filter((n) => {
              if (where.adminId && n.adminId !== where.adminId) return false;
              if (where.category && n.category !== where.category) return false;
              if (where.isRead !== undefined && n.isRead !== where.isRead) return false;
              return true;
            }).length;
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback: any) => {
          return callback(mockPrisma);
        }),
      };
    });

    it("dispatches CONTACT_INQUIRY notification upon public contact submission (fixing the dead code bug)", async () => {
      const submission = {
        fullName: "Alice Visitor",
        email: "alice@example.com",
        subject: "General Inquiry",
        message: "Hello, I am interested in CobraLearn showcase.",
      };

      const result = await submitPublicContactMessageOperation(
        submission,
        { clientIp: "127.0.0.1" },
        mockPrisma as any
      );

      expect(result.success).toBe(true);
      expect(result.id).toBe("msg-123");

      // Verify that notification was created for Admin 1 (opted IN) and NOT Admin 2 (opted OUT)
      expect(mockNotificationsDb.length).toBe(1);
      const notif = mockNotificationsDb[0];
      expect(notif.adminId).toBe(adminId1);
      expect(notif.category).toBe("CONTACT_INQUIRY");
      expect(notif.title).toBe("New Contact Inquiry");
      expect(notif.message).toContain("Alice Visitor");
      expect(notif.link).toBe("/admin/contact/messages");
      expect(notif.eventKey).toBe("contact:inquiry:msg-123");
    });

    it("persists contact message successfully even if notification creation encounters an error", async () => {
      // Break notification creation intentionally
      mockPrisma.adminNotification.create.mockRejectedValueOnce(
        new Error("Database connection glitch during notification insertion")
      );

      const submission = {
        fullName: "Bob Resilient",
        email: "bob@example.com",
        subject: "Resilience Test",
        message: "Message should succeed regardless of notification errors.",
      };

      const result = await submitPublicContactMessageOperation(
        submission,
        { clientIp: "127.0.0.1" },
        mockPrisma as any
      );

      // Contact submission MUST still succeed!
      expect(result.success).toBe(true);
      expect(result.id).toBe("msg-123");
    });
  });

  describe("Phase 5: Category-Filtered Notification Retrieval", () => {
    let mockNotificationsDb: any[];
    let mockPrisma: any;

    beforeEach(() => {
      mockNotificationsDb = [
        {
          id: "n-1",
          adminId: adminId1,
          category: "CONTACT_INQUIRY",
          title: "Inquiry 1",
          message: "Msg 1",
          isRead: false,
          createdAt: new Date(),
        },
        {
          id: "n-2",
          adminId: adminId1,
          category: "CONTENT_UPDATE",
          title: "Update 1",
          message: "Msg 2",
          isRead: false,
          createdAt: new Date(),
        },
        {
          id: "n-3",
          adminId: adminId1,
          category: "SECURITY_ALERT",
          title: "Security 1",
          message: "Msg 3",
          isRead: true,
          createdAt: new Date(),
        },
      ];

      mockPrisma = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({ id: adminId1, role: "ADMIN", isActive: true }),
        },
        adminNotification: {
          findMany: vi.fn().mockImplementation(async ({ where }: any) => {
            return mockNotificationsDb.filter((n) => {
              if (where.adminId && n.adminId !== where.adminId) return false;
              if (where.category && n.category !== where.category) return false;
              if (where.isRead !== undefined && n.isRead !== where.isRead) return false;
              return true;
            });
          }),
          count: vi.fn().mockImplementation(async ({ where }: any) => {
            return mockNotificationsDb.filter((n) => {
              if (where.adminId && n.adminId !== where.adminId) return false;
              if (where.category && n.category !== where.category) return false;
              if (where.isRead !== undefined && n.isRead !== where.isRead) return false;
              return true;
            }).length;
          }),
        },
      };
    });

    it("filters notifications by category when requested", async () => {
      const mockReq = new Request("http://localhost:3000/api/notifications");

      // All notifications
      const allRes = await getSelfNotificationsOperation(
        mockReq,
        { limit: 10 },
        mockPrisma as any
      );
      expect(allRes.notifications.length).toBe(3);

      // Filter CONTACT_INQUIRY
      const contactRes = await getSelfNotificationsOperation(
        mockReq,
        { category: "CONTACT_INQUIRY", limit: 10 },
        mockPrisma as any
      );
      expect(contactRes.notifications.length).toBe(1);
      expect(contactRes.notifications[0].category).toBe("CONTACT_INQUIRY");

      // Filter CONTENT_UPDATE
      const contentRes = await getSelfNotificationsOperation(
        mockReq,
        { category: "CONTENT_UPDATE", limit: 10 },
        mockPrisma as any
      );
      expect(contentRes.notifications.length).toBe(1);
      expect(contentRes.notifications[0].category).toBe("CONTENT_UPDATE");
    });
  });
});
