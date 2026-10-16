import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  updateGlobalSettingsOperation,
  updateAppearanceConfigOperation,
  updateSiteSettingsSchema,
  updateAppearanceConfigSchema,
  evaluateSettingsEnvironmentStatus,
  getSettingsEnvironmentStatus,
} from "@/lib/server/admin-operations";
import {
  normalizeAuthError,
  getSettingsServerFnInputSchema,
  updateGlobalSettingsServerFnInputSchema,
  updateAppearanceConfigServerFnInputSchema,
} from "@/lib/server/settings-server-fns";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminProfile, AdminRole, AppearanceConfig, SiteSettings } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Phase 1.1: Security Hardening & Strict Validation Test Suite", () => {
  const superAdminUuid = "11111111-1111-4111-8111-111111111111";
  const adminUuid = "22222222-2222-4222-8222-222222222222";
  const editorUuid = "33333333-3333-4333-8333-333333333333";

  const makeUser = (id: string, email: string): User => ({
    id,
    email,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  });

  const superAdminUser = makeUser(superAdminUuid, "super@cobralearn.com");
  const adminUser = makeUser(adminUuid, "admin@cobralearn.com");
  const editorUser = makeUser(editorUuid, "editor@cobralearn.com");

  const mockProfiles: Record<string, AdminProfile> = {
    [superAdminUuid]: {
      id: superAdminUuid,
      email: "super@cobralearn.com",
      fullName: "Super Admin",
      designation: "Architect",
      avatarUrl: null,
      role: "SUPER_ADMIN" as AdminRole,
      phone: null,
      bio: null,
      isActive: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    [adminUuid]: {
      id: adminUuid,
      email: "admin@cobralearn.com",
      fullName: "Standard Admin",
      designation: "Admin",
      avatarUrl: null,
      role: "ADMIN" as AdminRole,
      phone: null,
      bio: null,
      isActive: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    [editorUuid]: {
      id: editorUuid,
      email: "editor@cobralearn.com",
      fullName: "Content Editor",
      designation: "Editor",
      avatarUrl: null,
      role: "EDITOR" as AdminRole,
      phone: null,
      bio: null,
      isActive: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  let mockPrisma: any;

  function setupAuthMock(user: User | null) {
    const mockAuth = {
      getUser: vi.fn().mockImplementation((token?: string) => {
        if (!user) {
          return Promise.resolve({ data: { user: null }, error: new Error("No session") });
        }
        return Promise.resolve({ data: { user }, error: null });
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: user ? { access_token: "valid-test-token", user } : null },
      }),
    };
    (getSupabaseServerClient as any).mockReturnValue({ auth: mockAuth });
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(mockProfiles[where.id] || null);
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-test-log" }),
      },
      siteSettings: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          siteName: "CobraLearn Innotechcore",
          tagline: "Digital Showcase",
          siteUrl: "https://cobralearn.com",
        }),
        upsert: vi.fn().mockImplementation(({ update, create }: any) => {
          return Promise.resolve({
            id: create?.id || "default",
            ...update,
          });
        }),
      },
      appearanceConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          themePreset: "dark",
          brandPrimaryColor: "#00FF87",
        }),
        upsert: vi.fn().mockImplementation(({ update, create }: any) => {
          return Promise.resolve({
            id: create?.id || "default",
            ...update,
          });
        }),
      },
    };
  });

  // =========================================================================
  // 1. SITE SETTINGS RUNTIME VALIDATION & SINGLETON PROTECTION
  // =========================================================================
  describe("1. Site Settings Runtime Validation & Singleton Protection", () => {
    it("allows SUPER_ADMIN to update valid supported fields and records audit log", async () => {
      setupAuthMock(superAdminUser);
      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });

      const result = await updateGlobalSettingsOperation(
        req,
        {
          settings: {
            siteName: "CobraLearn Global",
            tagline: "Building the Future",
            siteUrl: "https://cobralearn.in",
            contactEmail: "hello@cobralearn.in",
            notifyOnNewMessage: false,
            notificationEmail: "alerts@cobralearn.in",
            metaKeywords: ["innovation", "portal"],
            ogImageUrl: "/static/og.png",
          },
        },
        mockPrisma
      );

      expect(result.siteName).toBe("CobraLearn Global");
      expect(mockPrisma.siteSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "default" },
          create: expect.objectContaining({ id: "default", siteName: "CobraLearn Global" }),
          update: expect.objectContaining({ siteName: "CobraLearn Global" }),
        })
      );
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: superAdminUuid,
            action: "SETTINGS_UPDATED",
          }),
        })
      );
    });

    it("rejects an attempted id override and protects the singleton ID", async () => {
      setupAuthMock(superAdminUser);
      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });

      // Attempting to supply id in settings payload
      await expect(
        updateGlobalSettingsOperation(
          req,
          { settings: { id: "attacker-custom-id", siteName: "Tampered" } as any },
          mockPrisma
        )
      ).rejects.toThrow(/Cannot modify singleton settings ID|Unrecognized key.*id/i);

      // Verify that upsert was NEVER called with attacker's ID
      expect(mockPrisma.siteSettings.upsert).not.toHaveBeenCalled();
    });

    it("rejects an attempted updatedAt override", async () => {
      setupAuthMock(superAdminUser);
      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });

      await expect(
        updateGlobalSettingsOperation(
          req,
          { settings: { updatedAt: new Date(), siteName: "Tampered" } as any },
          mockPrisma
        )
      ).rejects.toThrow(/Cannot modify system timestamps|Unrecognized key.*updatedAt/i);
    });

    it("rejects unexpected arbitrary fields outside the schema", async () => {
      setupAuthMock(superAdminUser);
      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });

      await expect(
        updateGlobalSettingsOperation(
          req,
          { settings: { unknownMaliciousProperty: "injection", siteName: "Test" } as any },
          mockPrisma
        )
      ).rejects.toThrow(/Unrecognized field provided in Site Settings update payload/i);
    });

    it("rejects invalid field formats (invalid URL, invalid email, empty siteName)", async () => {
      setupAuthMock(superAdminUser);
      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });

      // Invalid siteUrl
      await expect(
        updateGlobalSettingsOperation(
          req,
          { settings: { siteUrl: "not-a-valid-url" } },
          mockPrisma
        )
      ).rejects.toThrow(/Invalid site URL format/i);

      // Invalid contactEmail
      await expect(
        updateGlobalSettingsOperation(
          req,
          { settings: { contactEmail: "not-an-email" } },
          mockPrisma
        )
      ).rejects.toThrow(/Invalid contact email format/i);

      // Empty siteName
      await expect(
        updateGlobalSettingsOperation(
          req,
          { settings: { siteName: "   " } },
          mockPrisma
        )
      ).rejects.toThrow(/Site name cannot be empty/i);
    });

    it("supports valid nullable fields (ogImageUrl: null, notificationEmail: null)", async () => {
      setupAuthMock(superAdminUser);
      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });

      const result = await updateGlobalSettingsOperation(
        req,
        {
          settings: {
            ogImageUrl: null,
            notificationEmail: null,
          },
        },
        mockPrisma
      );

      expect(mockPrisma.siteSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ ogImageUrl: null, notificationEmail: null }),
        })
      );
    });

    it("safely handles an empty update object without altering unrelated fields", async () => {
      setupAuthMock(superAdminUser);
      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });

      await updateGlobalSettingsOperation(req, { settings: {} }, mockPrisma);

      expect(mockPrisma.siteSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {},
          create: expect.objectContaining({ id: "default" }),
        })
      );
    });
  });

  // =========================================================================
  // 2. APPEARANCE CONFIG RUNTIME VALIDATION & SINGLETON PROTECTION
  // =========================================================================
  describe("2. Appearance Config Runtime Validation & Singleton Protection", () => {
    it("allows ADMIN and SUPER_ADMIN to update supported appearance fields", async () => {
      setupAuthMock(adminUser);
      const req = new Request("http://localhost/api/admin/appearance", {
        headers: { authorization: "Bearer admin-token" },
      });

      const result = await updateAppearanceConfigOperation(
        req,
        {
          appearance: {
            themePreset: "midnight",
            brandPrimaryColor: "#06B6D4",
            brandSecondaryColor: "#3B82F6",
            brandAccentColor: "#F59E0B",
            fontHeading: "Inter",
            fontBody: "Roboto",
            enableGlowEffects: false,
            enableAnimations: true,
            logoAssetId: "asset-123",
            faviconAssetId: null,
          },
        },
        mockPrisma
      );

      expect(mockPrisma.appearanceConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "default" },
          create: expect.objectContaining({
            id: "default",
            themePreset: "midnight",
            brandPrimaryColor: "#06B6D4",
          }),
          update: expect.objectContaining({
            themePreset: "midnight",
            brandPrimaryColor: "#06B6D4",
            faviconAssetId: null,
          }),
        })
      );
    });

    it("rejects an attempted id or updatedAt override on appearance", async () => {
      setupAuthMock(adminUser);
      const req = new Request("http://localhost/api/admin/appearance", {
        headers: { authorization: "Bearer admin-token" },
      });

      await expect(
        updateAppearanceConfigOperation(
          req,
          { appearance: { id: "custom-id", themePreset: "dark" } as any },
          mockPrisma
        )
      ).rejects.toThrow(/Cannot modify singleton appearance ID|Unrecognized key.*id/i);
    });

    it("rejects unexpected arbitrary fields on appearance", async () => {
      setupAuthMock(adminUser);
      const req = new Request("http://localhost/api/admin/appearance", {
        headers: { authorization: "Bearer admin-token" },
      });

      await expect(
        updateAppearanceConfigOperation(
          req,
          { appearance: { customCssInjection: "body { display: none; }" } as any },
          mockPrisma
        )
      ).rejects.toThrow(/Unrecognized field provided in Appearance update payload/i);
    });

    it("rejects invalid color formats (non-hex colors)", async () => {
      setupAuthMock(adminUser);
      const req = new Request("http://localhost/api/admin/appearance", {
        headers: { authorization: "Bearer admin-token" },
      });

      // Named color rejected
      await expect(
        updateAppearanceConfigOperation(
          req,
          { appearance: { brandPrimaryColor: "neon-green" } },
          mockPrisma
        )
      ).rejects.toThrow(/Brand primary color must be a valid hex color code/i);

      // Invalid hex code rejected
      await expect(
        updateAppearanceConfigOperation(
          req,
          { appearance: { brandSecondaryColor: "#ZZZZZZ" } },
          mockPrisma
        )
      ).rejects.toThrow(/Brand secondary color must be a valid hex color code/i);
    });
  });

  // =========================================================================
  // 3. SAFE ERROR HANDLING & INFORMATION REDACTION
  // =========================================================================
  describe("3. Safe Error Handling & Information Redaction", () => {
    it("preserves 401 Unauthorized errors", () => {
      expect(() => normalizeAuthError(new Error("No cookie header provided"))).toThrow(
        "Unauthorized: Valid administrative session required"
      );
      expect(() => normalizeAuthError(new Error("Unauthorized: Session expired"))).toThrow(
        "Unauthorized: Valid administrative session required"
      );
    });

    it("preserves 403 Forbidden errors and redacts potential tokens", () => {
      expect(() =>
        normalizeAuthError(new Error('Forbidden: Role "EDITOR" lacks required permission: "settings:update"'))
      ).toThrow('Forbidden: Role "EDITOR" lacks required permission: "settings:update"');

      // Sensitive token in message is redacted
      expect(() =>
        normalizeAuthError(new Error("Forbidden: Token eyJhbGciOi.eyJzdWIi.signature rejected"))
      ).toThrow(/Forbidden: Token \[REDACTED_TOKEN\] rejected/);
    });

    it("preserves 400 Validation Error messages", () => {
      expect(() => normalizeAuthError(new Error("Validation Error: Invalid URL"))).toThrow(
        "Validation Error: Invalid URL"
      );
    });

    it("formats ZodError into client-safe Validation Error", () => {
      const zodErr = new z.ZodError([
        { code: "invalid_type", expected: "string", received: "number", path: ["siteName"], message: "Expected string" },
      ]);
      expect(() => normalizeAuthError(zodErr)).toThrow(
        /Validation Error: Invalid input parameters \(siteName: Expected string\)/
      );
    });

    it("redacts unexpected database and internal errors to generic 500 error", () => {
      const rawDbErr = new Error("P2002: Unique constraint failed on postgresql://user:pass@host:5432/db");
      expect(() => normalizeAuthError(rawDbErr)).toThrow(
        "Internal server error: An unexpected error occurred while processing the request"
      );

      // Verify connection string is NOT exposed
      try {
        normalizeAuthError(rawDbErr);
      } catch (e: any) {
        expect(e.message).not.toContain("postgresql://");
        expect(e.message).not.toContain("P2002");
      }
    });
  });

  // =========================================================================
  // 4. ENVIRONMENT STATUS SEMANTICS (TURNSTILE VERIFICATION SECRET)
  // =========================================================================
  describe("4. Environment Status Semantics & Turnstile Verification", () => {
    const origEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...origEnv };
    });

    it("returns turnstileConfigured: true when TURNSTILE_SECRET_KEY is present on server", () => {
      process.env.TURNSTILE_SECRET_KEY = "0x4AAAAAA_test_secret_key";
      delete process.env.VITE_TURNSTILE_SITE_KEY;

      const status = evaluateSettingsEnvironmentStatus();

      expect(status.turnstileConfigured).toBe(true);
      expect(typeof status.turnstileConfigured).toBe("boolean");
    });

    it("returns turnstileConfigured: false when only VITE_TURNSTILE_SITE_KEY exists without server secret", () => {
      delete process.env.TURNSTILE_SECRET_KEY;
      process.env.VITE_TURNSTILE_SITE_KEY = "0x4AAAAAA_public_site_key";

      const status = evaluateSettingsEnvironmentStatus();

      // Public site key alone must NEVER report backend as configured
      expect(status.turnstileConfigured).toBe(false);
    });

    it("returns turnstileConfigured: false when server secret is absent", () => {
      delete process.env.TURNSTILE_SECRET_KEY;
      delete process.env.VITE_TURNSTILE_SITE_KEY;

      const status = evaluateSettingsEnvironmentStatus();

      expect(status.turnstileConfigured).toBe(false);
    });

    it("returns only approved boolean status fields and no secret fragments", () => {
      process.env.RESEND_API_KEY = "re_test_key_123";
      process.env.TURNSTILE_SECRET_KEY = "turnstile_sec_456";
      process.env.CLOUDFLARE_API_TOKEN = "cf_token_789";

      const status = evaluateSettingsEnvironmentStatus();

      const keys = Object.keys(status);
      expect(keys.sort()).toEqual([
        "analyticsConfigured",
        "cdnConfigured",
        "resendConfigured",
        "turnstileConfigured",
      ].sort());

      for (const [key, value] of Object.entries(status)) {
        expect(typeof value).toBe("boolean");
      }

      // Verify secrets are never leaked
      const serialized = JSON.stringify(status);
      expect(serialized).not.toContain("re_test_key_123");
      expect(serialized).not.toContain("turnstile_sec_456");
      expect(serialized).not.toContain("cf_token_789");
    });

    it("rejects unauthenticated requests to getSettingsEnvironmentStatus", async () => {
      setupAuthMock(null);
      const req = new Request("https://internal.cobralearn.portal/api/admin/settings/env-status", {
        headers: { authorization: "Bearer invalid-token" },
      });

      await expect(
        getSettingsEnvironmentStatus(req, mockPrisma)
      ).rejects.toThrow(/No cookie header provided|Unauthorized/);
    });

    it("allows authenticated admin to read getSettingsEnvironmentStatus", async () => {
      setupAuthMock(superAdminUser);
      process.env.TURNSTILE_SECRET_KEY = "sec_abc";
      const req = new Request("https://internal.cobralearn.portal/api/admin/settings/env-status", {
        headers: { authorization: "Bearer valid-token" },
      });

      const result = await getSettingsEnvironmentStatus(req, mockPrisma);
      expect(result.status).toBeDefined();
      expect(result.status.turnstileConfigured).toBe(true);
      expect(typeof result.status.turnstileConfigured).toBe("boolean");
    });
  });

  // =========================================================================
  // 5. SERVER FUNCTION WRAPPER VALIDATION AT BOUNDARY
  // Note: TanStack Start createServerFn wrappers require the TanStack Start HTTP
  // server runtime (AsyncLocalStorage context) to execute end-to-end. Their input
  // validation schemas are tested directly here at the runtime validator boundary.
  // =========================================================================
  describe("5. Server Function Wrapper Input Validation Schemas", () => {
    it("updateGlobalSettingsServerFnInputSchema rejects unexpected fields (id override)", () => {
      const parsed = updateGlobalSettingsServerFnInputSchema.safeParse({
        settings: { id: "tampered" },
      });
      expect(parsed.success).toBe(false);
    });

    it("updateAppearanceConfigServerFnInputSchema rejects invalid hex color at validator boundary", () => {
      const parsed = updateAppearanceConfigServerFnInputSchema.safeParse({
        appearance: { brandPrimaryColor: "not-a-hex" },
      });
      expect(parsed.success).toBe(false);
    });

    it("getSettingsServerFnInputSchema rejects unexpected input fields", () => {
      const parsed = getSettingsServerFnInputSchema.safeParse({
        unexpectedKey: "malicious-input",
      });
      expect(parsed.success).toBe(false);
    });
  });
});
