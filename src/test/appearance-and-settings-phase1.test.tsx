import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  getGlobalSettingsOperation,
  updateGlobalSettingsOperation,
  getAppearanceConfigOperation,
  updateAppearanceConfigOperation,
} from "@/lib/server/admin-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminProfile, AdminRole, AppearanceConfig, SiteSettings } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";

// Import tabs for UI verification
import { IntegrationsTab } from "@/components/settings/tabs/IntegrationsTab";
import { EmailNotificationsTab } from "@/components/settings/tabs/EmailNotificationsTab";
import { MaintenanceTab } from "@/components/settings/tabs/MaintenanceTab";
import { SecurityTab } from "@/components/settings/tabs/SecurityTab";
import { SeoMetaTab } from "@/components/settings/tabs/SeoMetaTab";
import { AdvancedTab } from "@/components/settings/tabs/AdvancedTab";
import { AnalyticsTab } from "@/components/settings/tabs/AnalyticsTab";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    getSettingsEnvironmentStatus: vi.fn().mockResolvedValue({
      success: true,
      data: {
        resendConfigured: true,
        turnstileConfigured: false,
        cdnConfigured: false,
        analyticsConfigured: false,
      },
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("Phase 1: Appearance & Site Settings Security, RBAC & Misleading-Control Remediation", () => {
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
      fullName: "Super Administrator",
      designation: "Principal Architect",
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
      designation: "Platform Admin",
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
      designation: "Copywriter",
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
          return Promise.resolve({ data: { user: null }, error: new Error("Invalid session") });
        }
        return Promise.resolve({ data: { user }, error: null });
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: user ? { access_token: "mock-token", user } : null },
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: user ? "aal2" : null, nextLevel: user ? "aal2" : null },
          error: null,
        }),
      },
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
        create: vi.fn().mockResolvedValue({ id: "audit-phase1-log" }),
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
            id: "default",
            siteName: update?.siteName || create?.siteName || "CobraLearn Innotechcore",
            tagline: update?.tagline || create?.tagline || "Digital Showcase",
          });
        }),
      },
      appearanceConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          themePreset: "dark",
          brandPrimaryColor: "#00FF87",
          brandSecondaryColor: "#00E5FF",
          brandAccentColor: "#FFB800",
          fontHeading: "Orbitron",
          fontBody: "Rajdhani",
          enableGlowEffects: true,
          enableAnimations: true,
        }),
        upsert: vi.fn().mockImplementation(({ update, create }: any) => {
          return Promise.resolve({
            id: "default",
            themePreset: update?.themePreset || create?.themePreset || "dark",
            brandPrimaryColor: update?.brandPrimaryColor || create?.brandPrimaryColor || "#00FF87",
            brandSecondaryColor: update?.brandSecondaryColor || create?.brandSecondaryColor || "#00E5FF",
            brandAccentColor: update?.brandAccentColor || create?.brandAccentColor || "#FFB800",
            fontHeading: update?.fontHeading || create?.fontHeading || "Orbitron",
            fontBody: update?.fontBody || create?.fontBody || "Rajdhani",
            enableGlowEffects: true,
            enableAnimations: true,
          });
        }),
      },
    };
  });

  // =========================================================================
  // 1-7. SERVER-SIDE AUTHORIZATION & PERMISSION TESTS
  // =========================================================================
  describe("Server-Side RBAC Enforcement on Operations", () => {
    it("Requirement 1: EDITOR cannot update Site Settings (rejected with 403 Forbidden)", async () => {
      setupAuthMock(editorUser);
      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer editor-token" },
      });

      await expect(
        updateGlobalSettingsOperation(req, { settings: { siteName: "Tampered" } }, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "EDITOR" lacks required permission: "settings:update"');
    });

    it("Requirement 2: ADMIN cannot update Site Settings (rejected with 403 Forbidden)", async () => {
      setupAuthMock(adminUser);
      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer admin-token" },
      });

      await expect(
        updateGlobalSettingsOperation(req, { settings: { siteName: "Tampered" } }, mockPrisma)
      ).rejects.toThrow('Forbidden: Role "ADMIN" lacks required permission: "settings:update"');
    });

    it("Requirement 3: Only SUPER_ADMIN can update Site Settings and record audit log", async () => {
      setupAuthMock(superAdminUser);
      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });

      const result = await updateGlobalSettingsOperation(
        req,
        { settings: { siteName: "CobraLearn Global Systems" } },
        mockPrisma
      );

      expect(result.siteName).toBe("CobraLearn Global Systems");
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: superAdminUuid,
            action: "SETTINGS_UPDATED",
            module: "GLOBAL_SETTINGS",
          }),
        })
      );
    });

    it("Requirement 4: EDITOR cannot update Appearance settings (rejected with 403 Forbidden)", async () => {
      setupAuthMock(editorUser);
      const req = new Request("http://localhost/api/admin/appearance", {
        headers: { authorization: "Bearer editor-token" },
      });

      await expect(
        updateAppearanceConfigOperation(
          req,
          { appearance: { brandPrimaryColor: "#FF0000" } },
          mockPrisma
        )
      ).rejects.toThrow('Forbidden: Role "EDITOR" lacks required permission: "appearance:update"');
    });

    it("Requirement 5: ADMIN and SUPER_ADMIN can update Appearance settings", async () => {
      // 5a. ADMIN is permitted
      setupAuthMock(adminUser);
      const adminReq = new Request("http://localhost/api/admin/appearance", {
        headers: { authorization: "Bearer admin-token" },
      });

      const adminResult = await updateAppearanceConfigOperation(
        adminReq,
        { appearance: { brandPrimaryColor: "#10B981" } },
        mockPrisma
      );
      expect(adminResult.brandPrimaryColor).toBe("#10B981");
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: adminUuid,
            action: "APPEARANCE_UPDATED",
            module: "APPEARANCE",
          }),
        })
      );

      // 5b. SUPER_ADMIN is permitted
      setupAuthMock(superAdminUser);
      const superReq = new Request("http://localhost/api/admin/appearance", {
        headers: { authorization: "Bearer super-token" },
      });

      const superResult = await updateAppearanceConfigOperation(
        superReq,
        { appearance: { themePreset: "emerald-night" } },
        mockPrisma
      );
      expect(superResult.themePreset).toBe("emerald-night");
    });

    it("Requirement 6: Direct unauthorized calls fail closed on server even without cookie", async () => {
      setupAuthMock(null);
      const req = new Request("http://localhost/api/admin/settings", { headers: {} });

      await expect(getGlobalSettingsOperation(req, mockPrisma)).rejects.toThrow();
    });

    it("Requirement 7: Read access follows permission map (SUPER_ADMIN, ADMIN, EDITOR permitted)", async () => {
      // 7a. Settings Read
      for (const user of [superAdminUser, adminUser, editorUser]) {
        setupAuthMock(user);
        const req = new Request("http://localhost/api/admin/settings", {
          headers: { authorization: "Bearer valid-token" },
        });
        const settings = await getGlobalSettingsOperation(req, mockPrisma);
        expect(settings?.siteName).toBe("CobraLearn Innotechcore");
      }

      // 7b. Appearance Read
      for (const user of [superAdminUser, adminUser, editorUser]) {
        setupAuthMock(user);
        const req = new Request("http://localhost/api/admin/appearance", {
          headers: { authorization: "Bearer valid-token" },
        });
        const appearance = await getAppearanceConfigOperation(req, mockPrisma);
        expect(appearance?.brandPrimaryColor).toBe("#00FF87");
      }
    });
  });

  // =========================================================================
  // 8. CLIENT-SIDE SECRET ENTRY REMOVAL
  // =========================================================================
  describe("Client-Side Secret Entry Removal & Environment Status", () => {
    it("Requirement 8: Integration UI contains no client-side secret inputs for Resend, Turnstile, or CDN tokens", async () => {
      render(<IntegrationsTab />);

      await waitFor(() => {
        // Confirm server environment indicator is rendered
        expect(screen.getByText("RESEND_API_KEY:")).toBeDefined();
        expect(screen.getByText("Configured in Server Env")).toBeDefined();
      });

      // Verify that NO password input or secret input exists for API keys
      const passwordInputs = screen.queryAllByPlaceholderText(/re_/i);
      expect(passwordInputs.length).toBe(0);

      // Verify descriptive notice is rendered
      expect(
        screen.getByText(/External provider secrets are managed securely on the server via environment variables/i)
      ).toBeDefined();
    });
  });

  // =========================================================================
  // 9-13. MISLEADING CONTROL REMEDIATION IN UI
  // =========================================================================
  describe("Misleading Control & Fake Action Remediation", () => {
    it("Requirement 9: Test connection diagnostics and test email buttons do not claim false success", () => {
      // 9a. Integrations diagnostics
      const { unmount } = render(<IntegrationsTab />);
      const diagBtn = screen.getByRole("button", { name: /diagnostics/i });
      fireEvent.click(diagBtn);
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("diagnostic tests require server-side healthcheck endpoint"));
      unmount();

      // 9b. EmailNotificationsTab test email
      render(<EmailNotificationsTab />);
      const testEmailBtn = screen.getByRole("button", { name: /send test email/i });
      fireEvent.click(testEmailBtn);
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("Direct email dispatch requires configured server-side mail transport"));
    });

    it("Requirement 10: Maintenance mode cannot claim public traffic is blocked", () => {
      render(<MaintenanceTab />);
      const toggleLabel = screen.getByText(/enable maintenance/i);
      const toggleBtn = toggleLabel.closest("div")?.parentElement?.querySelector("button") || toggleLabel;
      fireEvent.click(toggleBtn);

      const confirmBtn = screen.getByRole("button", { name: /enable maintenance mode/i });
      fireEvent.click(confirmBtn);

      // Verify false success/warning is NOT emitted
      expect(toast.warning).not.toHaveBeenCalledWith(expect.stringContaining("Public traffic will see the maintenance screen"));
      // Verify honest status is emitted
      expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/public traffic routing is not currently gated/i));
    });

    it("Requirement 11: Remote session termination does not claim remote revocation", () => {
      render(<SecurityTab />);
      const terminateBtn = screen.getByRole("button", { name: /^terminate$/i });
      fireEvent.click(terminateBtn);

      expect(toast.success).not.toHaveBeenCalledWith("Remote session revoked.");
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("Remote session revocation is managed via Supabase Auth"));
    });

    it("Requirement 12: Simulated backup, restore, cache purge, and sitemap actions do not claim successful execution", () => {
      // 12a. MaintenanceTab Refresh Content Indices & Export
      const { unmount: unmountMaint } = render(<MaintenanceTab />);
      const refreshBtn = screen.getByRole("button", { name: /refresh indices/i });
      fireEvent.click(refreshBtn);
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("Static content indexing is handled automatically"));

      const exportBtn = screen.getByRole("button", { name: /export json/i });
      fireEvent.click(exportBtn);
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("Configuration export is managed via database backups"));
      unmountMaint();

      // 12b. SeoMetaTab Regenerate Sitemap
      const { unmount: unmountSeo } = render(<SeoMetaTab />);
      const regenBtn = screen.getByRole("button", { name: /regenerate/i });
      fireEvent.click(regenBtn);
      expect(toast.success).not.toHaveBeenCalledWith(expect.stringContaining("148 URLs indexed"));
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("XML sitemap generation is handled dynamically"));
      unmountSeo();

      // 12c. AdvancedTab Export Site Archive
      render(<AdvancedTab />);
      const exportArchiveBtn = screen.getByRole("button", { name: /export site archive/i });
      fireEvent.click(exportArchiveBtn);
      expect(toast.success).not.toHaveBeenCalledWith(expect.stringContaining("Generating complete site archive"));
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("Full site archive generation is managed through Supabase database backups"));
    });

    it("Requirement 13: Analytics tab labels telemetry as sample preview data", () => {
      render(<AnalyticsTab />);
      expect(screen.getByText("Coming Soon — Version 2")).toBeDefined();
      expect(screen.getByText(/Illustrative sample telemetry/i)).toBeDefined();
      expect(screen.getByText(/Live analytics provider telemetry integration is scheduled for Version 2/i)).toBeDefined();
    });

    it("Requirement 14: Existing layouts and navigation remain intact", () => {
      render(<IntegrationsTab />);
      expect(screen.getByText("Web Analytics & Telemetry")).toBeDefined();
      expect(screen.getByText("Communication & Email Services")).toBeDefined();
      expect(screen.getByText("Map Providers & Geolocation")).toBeDefined();
      expect(screen.getByText("Bot Protection & Edge CDN")).toBeDefined();
    });
  });
});
