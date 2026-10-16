import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDashboardDataOperation,
  formatBytes,
  formatRelativeTime,
  formatFullTimestamp,
  isValidHttpUrl,
} from "@/lib/server/dashboard-operations";
import { normalizeAuthError } from "@/lib/server/dashboard-server-fns";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminProfile, PrismaClient } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Dashboard Phase 1 — Operations, Aggregations & Security Suite", () => {
  const adminId = "11111111-1111-4111-8111-111111111111";
  const editorId = "22222222-2222-4222-8222-222222222222";
  const inactiveId = "33333333-3333-4333-8333-333333333333";

  const adminUser: User = {
    id: adminId,
    email: "admin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const editorUser: User = {
    id: editorId,
    email: "editor@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const inactiveUser: User = {
    id: inactiveId,
    email: "inactive@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const adminProfile: AdminProfile = {
    id: adminId,
    email: "admin@cobralearn.com",
    fullName: "Chief Admin",
    designation: "Lead Administrator",
    avatarUrl: null,
    role: "ADMIN",
    phone: null,
    bio: null,
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  const editorProfile: AdminProfile = {
    id: editorId,
    email: "editor@cobralearn.com",
    fullName: "Content Editor",
    designation: "Showcase Editor",
    avatarUrl: null,
    role: "EDITOR",
    phone: null,
    bio: null,
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  const inactiveProfile: AdminProfile = {
    id: inactiveId,
    email: "inactive@cobralearn.com",
    fullName: "Deactivated Admin",
    designation: null,
    avatarUrl: null,
    role: "ADMIN",
    phone: null,
    bio: null,
    isActive: false,
    lastLoginAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  function setupAuthMock(user: User | null) {
    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : { message: "No valid session" },
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: user ? { access_token: "mock-token" } : null },
          error: null,
        }),
      },
    });
  }

  function createRequest(cookie = "sb-access-token=mock-token") {
    return new Request("https://internal.cobralearn.portal/api/admin/dashboard", {
      headers: { cookie },
    });
  }

  function createMockPrisma(overrides: Partial<any> = {}): PrismaClient {
    return {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === adminId) return Promise.resolve(adminProfile);
          if (where.id === editorId) return Promise.resolve(editorProfile);
          if (where.id === inactiveId) return Promise.resolve(inactiveProfile);
          return Promise.resolve(null);
        }),
      },
      project: {
        count: vi.fn().mockResolvedValue(10),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "p1",
            name: "Cyber Vision",
            tags: ["AI", "Vision"],
            status: "PUBLISHED",
            thumbnail: { publicUrl: "https://media.test/thumb1.jpg" },
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({ updatedAt: new Date("2026-10-12T10:00:00Z") }),
      },
      website: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ updatedAt: new Date("2026-10-11T12:00:00Z") }),
      },
      advertisement: {
        count: vi.fn().mockResolvedValue(4),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ad1",
            name: "Fall Campaign",
            status: "DRAFT",
            thumbnail: null,
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({ updatedAt: new Date("2026-10-10T14:00:00Z") }),
      },
      award: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ updatedAt: new Date("2026-10-09T08:00:00Z") }),
      },
      mediaAsset: {
        count: vi.fn().mockResolvedValue(42),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { fileSize: 104857600n }, // 100 MB
        }),
      },
      siteSettings: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          siteUrl: "https://cobralearn.com",
        }),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "log-1",
            actorId: adminId,
            actorEmail: "admin@cobralearn.com",
            action: "PROJECT_CREATE",
            module: "projects",
            entityId: "p1",
            metadata: { name: "Cyber Vision" },
            createdAt: new Date("2026-10-12T10:00:00Z"),
          },
        ]),
      },
      ...overrides,
    } as unknown as PrismaClient;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Utility & Helper Formatting", () => {
    it("formats raw byte counts accurately without overflow or NaN", () => {
      expect(formatBytes(0)).toBe("0 MB");
      expect(formatBytes(-100)).toBe("0 MB");
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1572864)).toBe("1.5 MB");
      expect(formatBytes(1073741824)).toBe("1.0 GB");
    });

    it("formats relative times for audit activity", () => {
      const now = new Date("2026-10-12T12:00:00Z");
      expect(formatRelativeTime(new Date("2026-10-12T11:59:45Z"), now)).toBe("Just now");
      expect(formatRelativeTime(new Date("2026-10-12T11:55:00Z"), now)).toBe("5m ago");
      expect(formatRelativeTime(new Date("2026-10-12T09:00:00Z"), now)).toBe("3h ago");
      expect(formatRelativeTime(new Date("2026-10-11T12:00:00Z"), now)).toBe("Yesterday");
      expect(formatRelativeTime(new Date("2026-10-09T12:00:00Z"), now)).toBe("3d ago");
    });

    it("formats full timestamp string cleanly", () => {
      const date = new Date("2026-10-12T10:30:00Z");
      const formatted = formatFullTimestamp(date);
      expect(formatted).toContain("2026");
      expect(formatted).toContain("Oct");
    });
  });

  describe("2. Summary Statistics & 30-Day Comparison Aggregations", () => {
    it("computes accurate counts and comparison deltas across all content models", async () => {
      setupAuthMock(adminUser);

      // Mock specific count queries based on call filters
      const projectCountMock = vi.fn().mockImplementation((args?: any) => {
        if (!args) return Promise.resolve(15); // total
        if (args.where?.status === "PUBLISHED") return Promise.resolve(10);
        if (args.where?.status === "DRAFT") return Promise.resolve(5);
        if (args.where?.createdAt?.gte && !args.where?.createdAt?.lt) return Promise.resolve(6); // current 30d
        if (args.where?.createdAt?.lt) return Promise.resolve(2); // prev 30d
        return Promise.resolve(0);
      });

      const prisma = createMockPrisma({
        project: {
          count: projectCountMock,
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      });

      const res = await getDashboardDataOperation(createRequest(), prisma);

      expect(res.stats.projects.total).toBe(15);
      expect(res.stats.projects.published).toBe(10);
      expect(res.stats.projects.draft).toBe(5);
      expect(res.stats.projects.current30Days).toBe(6);
      expect(res.stats.projects.prev30Days).toBe(2);
      expect(res.stats.projects.delta).toBe(4); // 6 - 2 = +4
      expect(res.stats.projects.comparisonText).toBe("+4 vs prev 30d");
    });

    it("handles zero previous period count without division or runtime errors", async () => {
      setupAuthMock(adminUser);

      const projectCountMock = vi.fn().mockImplementation((args?: any) => {
        if (!args) return Promise.resolve(3);
        if (args.where?.status === "PUBLISHED") return Promise.resolve(3);
        if (args.where?.status === "DRAFT") return Promise.resolve(0);
        if (args.where?.createdAt?.gte && !args.where?.createdAt?.lt) return Promise.resolve(3);
        if (args.where?.createdAt?.lt) return Promise.resolve(0); // prev 30d = 0
        return Promise.resolve(0);
      });

      const prisma = createMockPrisma({
        project: {
          count: projectCountMock,
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      });

      const res = await getDashboardDataOperation(createRequest(), prisma);

      expect(res.stats.projects.delta).toBe(3);
      expect(res.stats.projects.comparisonText).toBe("+3 vs prev 30d");
    });

    it("handles completely empty database gracefully with zeroes and honest labels", async () => {
      setupAuthMock(adminUser);

      const emptyCount = vi.fn().mockResolvedValue(0);
      const prisma = createMockPrisma({
        project: { count: emptyCount, findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
        website: { count: emptyCount, findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
        advertisement: { count: emptyCount, findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
        award: { count: emptyCount, findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
        mediaAsset: { count: emptyCount, aggregate: vi.fn().mockResolvedValue({ _sum: { fileSize: null } }) },
        adminAuditLog: { findMany: vi.fn().mockResolvedValue([]) },
        siteSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      });

      const res = await getDashboardDataOperation(createRequest(), prisma);

      expect(res.stats.projects.total).toBe(0);
      expect(res.stats.projects.comparisonText).toBe("0 new in last 30d");
      expect(res.mediaStats.totalFiles).toBe(0);
      expect(res.mediaStats.formattedText).toBe("0 files (0 MB)");
      expect(res.websiteStatus.lastUpdatedText).toBe("No content updates yet");
      expect(res.websiteStatus.statusLabel).toBe("Not Configured");
      expect(res.websiteStatus.statusSubtext).toBe("Showcase URL has not been configured in site settings.");
      expect(res.websiteStatus.siteUrl).toBe("");
      expect(res.websiteStatus.isConfigured).toBe(false);
      expect(res.recentActivity).toEqual([]);
      expect(res.recentProjects).toEqual([]);
    });
  });

  describe("3. Media Telemetry & Website Configuration", () => {
    it("calculates media asset count and BigInt bytes correctly", async () => {
      setupAuthMock(adminUser);

      const prisma = createMockPrisma({
        mediaAsset: {
          count: vi.fn().mockResolvedValue(15),
          aggregate: vi.fn().mockResolvedValue({
            _sum: { fileSize: 52428800n }, // 50 MB
          }),
        },
      });

      const res = await getDashboardDataOperation(createRequest(), prisma);

      expect(res.mediaStats.totalFiles).toBe(15);
      expect(res.mediaStats.totalBytes).toBe(52428800);
      expect(res.mediaStats.formattedText).toBe("15 files (50.0 MB)");
    });

    it("retrieves configured siteUrl from SiteSettings and resolves latest update", async () => {
      setupAuthMock(adminUser);

      const prisma = createMockPrisma({
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            siteUrl: "https://showcase.cobralearn.com",
          }),
        },
        project: {
          count: vi.fn().mockResolvedValue(1),
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue({ updatedAt: new Date("2026-10-12T14:30:00Z") }),
        },
        website: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      });

      const res = await getDashboardDataOperation(createRequest(), prisma);

      expect(res.websiteStatus.siteUrl).toBe("https://showcase.cobralearn.com");
      expect(res.websiteStatus.statusLabel).toBe("Showcase Configured");
      expect(res.websiteStatus.lastUpdatedText).toContain("Oct 12, 2026");
    });

    it("formats singular '1 file' correctly when mediaAsset count is 1", async () => {
      setupAuthMock(adminUser);

      const prisma = createMockPrisma({
        mediaAsset: {
          count: vi.fn().mockResolvedValue(1),
          aggregate: vi.fn().mockResolvedValue({
            _sum: { fileSize: 2048000n }, // ~1.95 MB
          }),
        },
      });

      const res = await getDashboardDataOperation(createRequest(), prisma);

      expect(res.mediaStats.totalFiles).toBe(1);
      expect(res.mediaStats.formattedText).toBe("1 file (2.0 MB)");
    });

    it("rejects unsafe url schemes (javascript:, data:) and unconfigured urls honestly", async () => {
      setupAuthMock(adminUser);

      // 1. javascript: scheme
      const prismaXss = createMockPrisma({
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            siteUrl: "javascript:alert('xss')",
          }),
        },
      });
      const resXss = await getDashboardDataOperation(createRequest(), prismaXss);
      expect(resXss.websiteStatus.statusLabel).toBe("Not Configured");
      expect(resXss.websiteStatus.siteUrl).toBe("");
      expect(resXss.websiteStatus.isConfigured).toBe(false);

      // 2. data: scheme
      const prismaData = createMockPrisma({
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            siteUrl: "data:text/html,<script>alert(1)</script>",
          }),
        },
      });
      const resData = await getDashboardDataOperation(createRequest(), prismaData);
      expect(resData.websiteStatus.statusLabel).toBe("Not Configured");
      expect(resData.websiteStatus.siteUrl).toBe("");

      // 3. blank or non-URL string
      const prismaInvalid = createMockPrisma({
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            siteUrl: "   ",
          }),
        },
      });
      const resInvalid = await getDashboardDataOperation(createRequest(), prismaInvalid);
      expect(resInvalid.websiteStatus.statusLabel).toBe("Not Configured");
      expect(resInvalid.websiteStatus.siteUrl).toBe("");

      // 4. valid HTTP url
      const prismaHttp = createMockPrisma({
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            siteUrl: "http://localhost:3000",
          }),
        },
      });
      const resHttp = await getDashboardDataOperation(createRequest(), prismaHttp);
      expect(resHttp.websiteStatus.statusLabel).toBe("Showcase Configured");
      expect(resHttp.websiteStatus.siteUrl).toBe("http://localhost:3000");
      expect(resHttp.websiteStatus.isConfigured).toBe(true);
    });

    it("includes SiteSettings.updatedAt when determining latest update timestamp", async () => {
      setupAuthMock(adminUser);

      // SiteSettings was updated MORE recently than project
      const prisma = createMockPrisma({
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            siteUrl: "https://showcase.cobralearn.com",
            updatedAt: new Date("2026-10-14T18:00:00Z"),
          }),
        },
        project: {
          count: vi.fn().mockResolvedValue(1),
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue({ updatedAt: new Date("2026-10-10T12:00:00Z") }),
        },
        website: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
        advertisement: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
        award: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      });

      const res = await getDashboardDataOperation(createRequest(), prisma);

      expect(res.websiteStatus.lastUpdatedText).toContain("Oct 14, 2026");
    });
  });

  describe("4. Role-Based Activity Access & Isolation", () => {
    it("allows ADMIN and SUPER_ADMIN to query global audit activity", async () => {
      setupAuthMock(adminUser);

      const findManyMock = vi.fn().mockResolvedValue([
        {
          id: "log-1",
          actorId: "other-admin",
          actorEmail: "colleague@cobralearn.com",
          action: "WEBSITE_UPDATE",
          module: "websites",
          entityId: "w1",
          metadata: { name: "Main Portal" },
          createdAt: new Date(),
        },
      ]);

      const prisma = createMockPrisma({
        adminAuditLog: { findMany: findManyMock },
      });

      const res = await getDashboardDataOperation(createRequest(), prisma);

      // Verify global query called with empty where
      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          take: 8,
          orderBy: { createdAt: "desc" },
        })
      );
      expect(res.recentActivity.length).toBe(1);
      expect(res.recentActivity[0].title).toBe("Website Updated");
      expect(res.recentActivity[0].item).toBe("Main Portal");
      expect(res.recentActivity[0].dot).toBe("green");
    });

    it("restricts EDITOR role to self-scoped activity only (actorId = editorId)", async () => {
      setupAuthMock(editorUser);

      const findManyMock = vi.fn().mockResolvedValue([
        {
          id: "log-2",
          actorId: editorId,
          actorEmail: "editor@cobralearn.com",
          action: "PROJECT_DELETE",
          module: "projects",
          entityId: "p2",
          metadata: { title: "Draft Project" },
          createdAt: new Date(),
        },
      ]);

      const prisma = createMockPrisma({
        adminAuditLog: { findMany: findManyMock },
      });

      const res = await getDashboardDataOperation(createRequest(), prisma);

      // Verify EDITOR query strictly scoped to their own actorId
      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { actorId: editorId },
          take: 8,
          orderBy: { createdAt: "desc" },
        })
      );
      expect(res.recentActivity.length).toBe(1);
      expect(res.recentActivity[0].title).toBe("Project Deleted");
      expect(res.recentActivity[0].item).toBe("Draft Project");
      expect(res.recentActivity[0].dot).toBe("red");
    });

    it("sanitizes sensitive metadata and falls back gracefully when fields are absent", async () => {
      setupAuthMock(adminUser);

      const findManyMock = vi.fn().mockResolvedValue([
        {
          id: "log-3",
          actorId: adminId,
          actorEmail: "admin@cobralearn.com",
          action: "UNKNOWN_CUSTOM_ACTION",
          module: "governance",
          entityId: "gov-12345",
          metadata: { internalIp: "10.0.0.1", token: "secret" }, // No name or title
          createdAt: new Date(),
        },
      ]);

      const prisma = createMockPrisma({
        adminAuditLog: { findMany: findManyMock },
      });

      const res = await getDashboardDataOperation(createRequest(), prisma);

      expect(res.recentActivity[0].title).toBe("Unknown Custom Action");
      expect(res.recentActivity[0].item).toBe("governance"); // Safe module fallback
      expect((res.recentActivity[0] as any).internalIp).toBeUndefined();
      expect((res.recentActivity[0] as any).token).toBeUndefined();
    });
  });

  describe("5. Authentication & Access Enforcement", () => {
    it("fails closed when request has no authenticated session", async () => {
      setupAuthMock(null);
      const prisma = createMockPrisma();

      await expect(getDashboardDataOperation(createRequest(""), prisma)).rejects.toThrow(
        /No cookie header provided|No valid Supabase session|Unauthorized/
      );
    });

    it("fails closed when administrator profile is deactivated", async () => {
      setupAuthMock(inactiveUser);
      const prisma = createMockPrisma();

      await expect(getDashboardDataOperation(createRequest(), prisma)).rejects.toThrow(
        /Forbidden: AdminProfile is deactivated/
      );
    });

    it("fails closed when administrator profile does not exist in database", async () => {
      const ghostUser: User = { ...adminUser, id: "ghost-uuid" };
      setupAuthMock(ghostUser);
      const prisma = createMockPrisma();

      await expect(getDashboardDataOperation(createRequest(), prisma)).rejects.toThrow(
        /Forbidden: AdminProfile not found for authenticated user/
      );
    });

    it("redacts internal server/database exceptions while preserving auth errors in server function", () => {
      // 1. Raw database exception containing sensitive connection string
      const dbError = new Error("P2002: Unique constraint failed on postgresql://user:secret@db.internal:5432");
      expect(() => normalizeAuthError(dbError)).toThrow(
        "Internal server error: An unexpected error occurred while processing the request"
      );

      // Verify secrets are never exposed in message
      try {
        normalizeAuthError(dbError);
      } catch (e: any) {
        expect(e.message).not.toContain("secret");
        expect(e.message).not.toContain("db.internal");
      }

      // 2. Preserves 401 Unauthorized
      expect(() => normalizeAuthError(new Error("Unauthorized: Valid administrative session required"))).toThrow(
        "Unauthorized: Valid administrative session required"
      );

      // 3. Preserves 403 Forbidden (with token redaction)
      expect(() => normalizeAuthError(new Error("Forbidden: Permission denied for token eyJhbGciOi.secret.signature"))).toThrow(
        /Forbidden: Permission denied/
      );
    });
  });
});
