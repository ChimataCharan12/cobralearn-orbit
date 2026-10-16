import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient, AdminProfile } from "@prisma/client";
import {
  updateSelfPreferencesOperation,
  updateSelfProfileOperation,
} from "@/lib/server/admin-operations";
import {
  DEFAULT_ADMIN_PREFERENCES,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PORTAL_PREFERENCES,
  MAX_PREFERENCES_PAYLOAD_BYTES,
  mergeWithDefaultPreferences,
  updatePreferencesPayloadSchema,
} from "@/lib/preferences";

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
    avatarUrl: null,
    phone: null,
    designation: "Administrator",
    bio: null,
    preferences: null as any,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

vi.mock("@/lib/auth/server-auth", () => ({
  requireAdminProfile: vi.fn().mockImplementation(async () => currentAdminContext),
  requirePermission: vi.fn().mockImplementation(async () => currentAdminContext),
}));

describe("Phase 2B+2C: Persistent Notification & Portal Preferences Suite", () => {
  let mockProfilesDb: Record<string, AdminProfile>;
  let mockAuditLogs: any[];
  let mockPrisma: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuditLogs = [];

    mockProfilesDb = {
      [admin1Id]: {
        id: admin1Id,
        email: "admin1@cobralearn.com",
        fullName: "Admin One",
        role: "ADMIN" as any,
        isActive: true,
        avatarUrl: null,
        phone: "+91 99999 11111",
        designation: "Administrator",
        bio: "Admin 1 Bio",
        preferences: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [admin2Id]: {
        id: admin2Id,
        email: "admin2@cobralearn.com",
        fullName: "Admin Two",
        role: "ADMIN" as any,
        isActive: true,
        avatarUrl: null,
        phone: "+91 99999 22222",
        designation: "Administrator",
        bio: "Admin 2 Bio",
        preferences: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    currentAdminContext.profile = { ...mockProfilesDb[admin1Id] };

    const dbHandler = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(mockProfilesDb[where.id] ? { ...mockProfilesDb[where.id] } : null);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          if (!mockProfilesDb[where.id]) throw new Error("Profile not found");
          mockProfilesDb[where.id] = { ...mockProfilesDb[where.id], ...data };
          if (where.id === currentAdminContext.profile.id) {
            currentAdminContext.profile = { ...mockProfilesDb[where.id] };
          }
          return Promise.resolve({ ...mockProfilesDb[where.id] });
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
  // 1. Canonical Contract & Default Merging Tests
  // =========================================================================
  describe("1. Canonical Contract & Default Merging", () => {
    it("returns canonical defaults when raw preferences are null, undefined, or empty", () => {
      const def1 = mergeWithDefaultPreferences(null);
      expect(def1).toEqual(DEFAULT_ADMIN_PREFERENCES);

      const def2 = mergeWithDefaultPreferences(undefined);
      expect(def2).toEqual(DEFAULT_ADMIN_PREFERENCES);

      const def3 = mergeWithDefaultPreferences({});
      expect(def3).toEqual(DEFAULT_ADMIN_PREFERENCES);
    });

    it("deep merges partial notification preferences with canonical defaults", () => {
      const merged = mergeWithDefaultPreferences({
        notifications: {
          marketingUpdates: true,
          securityAlerts: false,
        },
      });

      expect(merged.notifications.marketingUpdates).toBe(true);
      expect(merged.notifications.securityAlerts).toBe(false);
      // All other notifications must retain canonical defaults
      expect(merged.notifications.emailNotifications).toBe(true);
      expect(merged.notifications.contentUpdates).toBe(true);
      expect(merged.notifications.systemAnnouncements).toBe(true);
      expect(merged.notifications.adminActivities).toBe(true);
      expect(merged.notifications.contactInquiries).toBe(true);
      // Portal retains full canonical defaults
      expect(merged.portal).toEqual(DEFAULT_PORTAL_PREFERENCES);
    });

    it("deep merges partial portal preferences with canonical defaults", () => {
      const merged = mergeWithDefaultPreferences({
        portal: {
          theme: "dark",
          selectedAccent: "purple",
          sidebarCollapse: true,
        },
      });

      expect(merged.portal.theme).toBe("dark");
      expect(merged.portal.selectedAccent).toBe("purple");
      expect(merged.portal.sidebarCollapse).toBe(true);
      // Other portal fields retain defaults
      expect(merged.portal.language).toBe("English");
      expect(merged.portal.timezone).toBe("(GMT+5:30) Asia/Kolkata");
      // Notifications retain full defaults
      expect(merged.notifications).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    });

    it("safely maps legacy flat localStorage preferences into structured preferences", () => {
      const legacyObj = {
        systemAnnouncements: false,
        marketingUpdates: true,
        theme: "light",
        selectedAccent: "cyan",
        sidebarCollapse: true,
        language: "Spanish",
        timezone: "(GMT+0:00) UTC",
      };

      const merged = mergeWithDefaultPreferences(legacyObj);
      expect(merged.notifications.systemAnnouncements).toBe(false);
      expect(merged.notifications.marketingUpdates).toBe(true);
      expect(merged.notifications.emailNotifications).toBe(true); // default
      expect(merged.portal.theme).toBe("dark"); // legacy 'light' normalized to 'dark'
      expect(merged.portal.selectedAccent).toBe("cyan");
      expect(merged.portal.sidebarCollapse).toBe(true);
      expect(merged.portal.language).toBe("Spanish");
      expect(merged.portal.timezone).toBe("(GMT+0:00) UTC");
    });

    it("falls back to canonical defaults when invalid values exist in raw input", () => {
      const badObj = {
        portal: {
          theme: "matrix-green",
          selectedAccent: "neon-pink",
          language: "Latin",
          timezone: "Mars/Olympus_Mons",
        },
      };

      const merged = mergeWithDefaultPreferences(badObj);
      expect(merged.portal.theme).toBe(DEFAULT_PORTAL_PREFERENCES.theme);
      expect(merged.portal.selectedAccent).toBe(DEFAULT_PORTAL_PREFERENCES.selectedAccent);
      expect(merged.portal.language).toBe(DEFAULT_PORTAL_PREFERENCES.language);
      expect(merged.portal.timezone).toBe(DEFAULT_PORTAL_PREFERENCES.timezone);
    });
  });

  // =========================================================================
  // 2. Strict Validation & Unexpected Field Rejection
  // =========================================================================
  describe("2. Strict Validation & Payload Constraints", () => {
    it("rejects unexpected top-level keys in preference payload", () => {
      const invalid = {
        notifications: { emailNotifications: false },
        hackKey: "malicious_injection",
      };

      const res = updatePreferencesPayloadSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it("rejects unexpected keys inside notifications or portal", () => {
      const invalidNotifs = {
        notifications: {
          emailNotifications: true,
          arbitraryKey: 123,
        },
      };
      expect(updatePreferencesPayloadSchema.safeParse(invalidNotifs).success).toBe(false);

      const invalidPortal = {
        portal: {
          theme: "dark",
          customCss: "body { display: none; }",
        },
      };
      expect(updatePreferencesPayloadSchema.safeParse(invalidPortal).success).toBe(false);
    });

    it("rejects payload exceeding the maximum 4 KB size limit", async () => {
      const req = new Request("http://localhost:3000/api/admin/profile/preferences", {
        headers: { authorization: "Bearer token" },
      });

      const oversizedPayload: any = {
        notifications: {
          emailNotifications: true,
        },
        portal: {
          theme: "dark",
        },
        bloat: "A".repeat(5000), // > 4 KB
      };

      await expect(
        updateSelfPreferencesOperation(req, oversizedPayload, mockPrisma)
      ).rejects.toThrow(/exceeds maximum allowed size of 4 KB/i);
    });

    it("rejects non-object payload", async () => {
      const req = new Request("http://localhost:3000/api/admin/profile/preferences", {
        headers: { authorization: "Bearer token" },
      });

      await expect(
        updateSelfPreferencesOperation(req, "invalid-string" as any, mockPrisma)
      ).rejects.toThrow(/must be an object/i);
    });
  });

  // =========================================================================
  // 3. Server Operation: updateSelfPreferencesOperation & Lost-Update Prevention
  // =========================================================================
  describe("3. updateSelfPreferencesOperation & Lost-Update Prevention", () => {
    it("updates preferences and prevents lost updates across section-specific modifications", async () => {
      const req = new Request("http://localhost:3000/api/admin/profile/preferences", {
        headers: { authorization: "Bearer token" },
      });

      // 1. Update from Tab 1 (only notifications section)
      const res1 = await updateSelfPreferencesOperation(
        req,
        {
          notifications: {
            emailNotifications: false,
            contentUpdates: false,
          },
        },
        mockPrisma
      );

      expect(res1.preferences.notifications.emailNotifications).toBe(false);
      expect(res1.preferences.notifications.contentUpdates).toBe(false);
      expect(res1.preferences.portal.theme).toBe("dark"); // default portal dark theme preserved

      // 2. Update from Tab 3 (only portal section: theme and accent)
      const res2 = await updateSelfPreferencesOperation(
        req,
        {
          portal: {
            theme: "dark",
            selectedAccent: "cyan",
          },
        },
        mockPrisma
      );

      // Verify Tab 1's notification updates were NOT lost!
      expect(res2.preferences.notifications.emailNotifications).toBe(false);
      expect(res2.preferences.notifications.contentUpdates).toBe(false);
      // Verify Tab 3's portal updates took effect
      expect(res2.preferences.portal.theme).toBe("dark");
      expect(res2.preferences.portal.selectedAccent).toBe("cyan");

      // 3. Audit log verification
      expect(
        mockAuditLogs.some(
          (l) =>
            l.action === "PREFERENCES_UPDATED" &&
            l.actorId === admin1Id &&
            l.module === "PROFILE_MANAGEMENT"
        )
      ).toBe(true);
    });

    it("rolls back and does not save partial data if database transaction fails", async () => {
      const req = new Request("http://localhost:3000/api/admin/profile/preferences", {
        headers: { authorization: "Bearer token" },
      });

      const failingPrisma = {
        adminProfile: mockPrisma.adminProfile,
        adminAuditLog: mockPrisma.adminAuditLog,
        $transaction: vi.fn().mockRejectedValue(new Error("Database transaction aborted")),
      } as unknown as PrismaClient;

      await expect(
        updateSelfPreferencesOperation(
          req,
          { portal: { theme: "dark" } },
          failingPrisma
        )
      ).rejects.toThrow("Database transaction aborted");

      // Verify DB was not modified
      expect(mockProfilesDb[admin1Id].preferences).toBeNull();
    });
  });

  // =========================================================================
  // 4. Server Operation: updateSelfProfileOperation with Preferences
  // =========================================================================
  describe("4. updateSelfProfileOperation Integration with Preferences", () => {
    it("updates personal details and preferences atomically", async () => {
      const req = new Request("http://localhost:3000/api/admin/profile", {
        headers: { authorization: "Bearer token" },
      });

      const result = await updateSelfProfileOperation(
        req,
        {
          fullName: "Admin One Updated",
          phone: "+91 88888 77777",
          preferences: {
            notifications: {
              emailNotifications: false,
              securityAlerts: true,
            },
          },
        },
        mockPrisma
      );

      expect(result.profile.fullName).toBe("Admin One Updated");
      expect(result.profile.phone).toBe("+91 88888 77777");
      const prefs = mergeWithDefaultPreferences(result.profile.preferences);
      expect(prefs.notifications.emailNotifications).toBe(false);

      // Verify audit log has SELF_PROFILE_UPDATED with preferencesUpdated flag
      const auditLog = mockAuditLogs.find((l) => l.action === "SELF_PROFILE_UPDATED");
      expect(auditLog).toBeDefined();
      expect(auditLog.metadata.preferencesUpdated).toBe(true);
    });

    it("rejects attempt to modify forbidden account fields along with preferences", async () => {
      const req = new Request("http://localhost:3000/api/admin/profile", {
        headers: { authorization: "Bearer token" },
      });

      await expect(
        updateSelfProfileOperation(
          req,
          {
            role: "SUPER_ADMIN",
            preferences: { notifications: { emailNotifications: true } },
          },
          mockPrisma
        )
      ).rejects.toThrow(/Forbidden: Cannot self-assign or elevate administrative role/);
    });
  });

  // =========================================================================
  // 5. Per-Administrator Isolation & Cross-Admin Tampering Prevention
  // =========================================================================
  describe("5. Per-Administrator Isolation & Tampering Safeguards", () => {
    it("guarantees Admin 1 and Admin 2 have isolated preferences", async () => {
      const req1 = new Request("http://localhost:3000/api/admin/profile/preferences", {
        headers: { authorization: "Bearer admin1-token" },
      });

      // Admin 1 sets theme to 'dark'
      await updateSelfPreferencesOperation(
        req1,
        { portal: { theme: "dark", selectedAccent: "purple" } },
        mockPrisma
      );

      // Switch session to Admin 2
      currentAdminContext.profile = { ...mockProfilesDb[admin2Id] };

      const req2 = new Request("http://localhost:3000/api/admin/profile/preferences", {
        headers: { authorization: "Bearer admin2-token" },
      });

      // Admin 2 sets accent to 'orange'
      await updateSelfPreferencesOperation(
        req2,
        { portal: { theme: "dark", selectedAccent: "orange" } },
        mockPrisma
      );

      // Check Admin 1 in DB
      const admin1Prefs = mergeWithDefaultPreferences(mockProfilesDb[admin1Id].preferences);
      expect(admin1Prefs.portal.theme).toBe("dark");
      expect(admin1Prefs.portal.selectedAccent).toBe("purple");

      // Check Admin 2 in DB
      const admin2Prefs = mergeWithDefaultPreferences(mockProfilesDb[admin2Id].preferences);
      expect(admin2Prefs.portal.theme).toBe("dark");
      expect(admin2Prefs.portal.selectedAccent).toBe("orange");

      // Completely isolated accents!
      expect(admin1Prefs.portal.selectedAccent).not.toBe(admin2Prefs.portal.selectedAccent);
    });

    it("derives identity from session and ignores client-supplied spoofed IDs", async () => {
      const req = new Request("http://localhost:3000/api/admin/profile/preferences", {
        method: "POST",
        headers: {
          authorization: "Bearer admin1-token",
          "x-admin-id": admin2Id, // Attacker tries to inject Admin 2's ID
        },
      });

      await updateSelfPreferencesOperation(
        req,
        { portal: { theme: "dark" } },
        mockPrisma
      );

      // Admin 1's preferences were updated
      expect((mockProfilesDb[admin1Id].preferences as any)?.portal?.theme).toBe("dark");
      // Admin 2's preferences remain null (unaffected)
      expect(mockProfilesDb[admin2Id].preferences).toBeNull();
    });
  });
});
