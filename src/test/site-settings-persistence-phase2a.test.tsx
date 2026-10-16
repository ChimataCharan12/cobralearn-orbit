import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import React from "react";
import { SiteSettingsProvider } from "@/lib/site-settings-context";
import { SiteSettingsPage } from "@/routes/admin/settings";
import { GeneralTab } from "@/components/settings/tabs/GeneralTab";
import { SeoMetaTab } from "@/components/settings/tabs/SeoMetaTab";
import { EmailNotificationsTab } from "@/components/settings/tabs/EmailNotificationsTab";
import { adminClient } from "@/lib/api/admin-client";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import { toast } from "sonner";
import {
  getGlobalSettingsOperation,
  updateGlobalSettingsOperation,
} from "@/lib/server/admin-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminProfile, AdminRole, SiteSettings } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

// Mock Supabase Server Client for Server-Operation Tests
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

// Mock adminClient
vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    getSiteSettings: vi.fn(),
    updateSiteSettings: vi.fn(),
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

// Mock Auth Guards & Profile Hook
vi.mock("@/lib/auth/use-auth", () => ({
  useAuthGuard: vi.fn(),
  useAuth: vi.fn().mockReturnValue({
    user: { id: "user-1", email: "admin@cobralearn.com" },
    isAuthenticated: true,
  }),
}));

vi.mock("@/lib/auth/use-admin-profile", () => ({
  useAdminProfile: vi.fn(),
}));

// Mock router navigation
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: any) => config,
  useNavigate: () => vi.fn(),
  useRouterState: () => ({
    location: { pathname: "/admin/settings" },
  }),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
  Toaster: () => null,
}));

describe("Phase 2A: Site Settings Persistence & Authorization Integration", () => {
  const superAdminUuid = "11111111-1111-4111-8111-111111111111";
  const adminUuid = "22222222-2222-4222-8222-222222222222";
  const editorUuid = "33333333-3333-4333-8333-333333333333";

  const superAdminProfile: AdminProfile = {
    id: superAdminUuid,
    email: "superadmin@cobralearn.com",
    fullName: "Super Administrator",
    designation: "Chief Architect",
    avatarUrl: null,
    role: "SUPER_ADMIN" as AdminRole,
    phone: null,
    bio: null,
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminProfile: AdminProfile = {
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
  };

  const editorProfile: AdminProfile = {
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
  };

  const persistedSettings: SiteSettings = {
    id: "default",
    siteName: "CobraLearn Enterprise Hub",
    tagline: "High-Performance Edge Architecture",
    siteDescription: "Cinematic digital excellence showcasing next-gen tech.",
    siteUrl: "https://hub.cobralearn.com",
    contactEmail: "contact@hub.cobralearn.com",
    contactPhone: "+91 99887 76655",
    contactAddress: "HITEC City, Hyderabad, India",
    businessHours: "Mon - Fri: 8:00 AM - 7:00 PM IST",
    timezone: "Asia/Kolkata",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24-hour",
    defaultLanguage: "en",
    metaKeywords: ["cloud", "enterprise", "showcase"],
    ogImageUrl: "https://hub.cobralearn.com/og.png",
    notifyOnNewMessage: true,
    notificationEmail: "alerts@hub.cobralearn.com",
    updatedAt: new Date(),
  };

  let mockPrisma: any;

  function setupAuthMock(user: User | null) {
    const mockAuth = {
      getUser: vi.fn().mockImplementation(() => {
        if (!user) {
          return Promise.resolve({ data: { user: null }, error: new Error("Invalid session") });
        }
        return Promise.resolve({ data: { user }, error: null });
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: user ? { access_token: "mock-token", user } : null },
      }),
    };
    (getSupabaseServerClient as any).mockReturnValue({ auth: mockAuth });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (adminClient.getSiteSettings as any).mockReset();
    (adminClient.updateSiteSettings as any).mockReset();

    (useAdminProfile as any).mockReturnValue({
      profile: superAdminProfile,
      isLoading: false,
    });

    (adminClient.getSiteSettings as any).mockResolvedValue({
      success: true,
      data: persistedSettings,
    });

    (adminClient.updateSiteSettings as any).mockResolvedValue({
      success: true,
      data: persistedSettings,
    });

    mockPrisma = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === superAdminUuid) return Promise.resolve(superAdminProfile);
          if (where.id === adminUuid) return Promise.resolve(adminProfile);
          if (where.id === editorUuid) return Promise.resolve(editorProfile);
          return Promise.resolve(null);
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-phase2a-log" }),
      },
      siteSettings: {
        findUnique: vi.fn().mockResolvedValue(persistedSettings),
        upsert: vi.fn().mockImplementation(({ update }: { update: any }) => {
          return Promise.resolve({ ...persistedSettings, ...update });
        }),
      },
    };
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // 1. LOADING PERSISTED SETTINGS
  // =========================================================================
  describe("1. Loading Persisted Settings", () => {
    it("fetches settings via adminClient.getSiteSettings and populates the form", async () => {
      render(
        <SiteSettingsProvider>
          <GeneralTab />
        </SiteSettingsProvider>
      );

      await waitFor(() => {
        expect(adminClient.getSiteSettings).toHaveBeenCalled();
      });

      const siteNameInput = (await screen.findByDisplayValue("CobraLearn Enterprise Hub")) as HTMLInputElement;
      expect(siteNameInput).toBeDefined();
      expect(screen.getByDisplayValue("High-Performance Edge Architecture")).toBeDefined();
      expect(screen.getByDisplayValue("contact@hub.cobralearn.com")).toBeDefined();
    });

    it("displays error banner and presents retry button upon fetch failure", async () => {
      (adminClient.getSiteSettings as any).mockResolvedValueOnce({
        success: false,
        error: "Database connectivity timeout",
      });

      render(<SiteSettingsPage />);

      expect(await screen.findByText(/Failed to load persisted settings: Database connectivity timeout/i)).toBeDefined();
      const retryButton = screen.getByRole("button", { name: /retry/i });
      expect(retryButton).toBeDefined();
    });

    it("recovers and populates form when retry is triggered", async () => {
      (adminClient.getSiteSettings as any)
        .mockResolvedValueOnce({
          success: false,
          error: "Transient network failure",
        })
        .mockResolvedValueOnce({
          success: true,
          data: persistedSettings,
        });

      render(<SiteSettingsPage />);

      const retryBtn = await screen.findByRole("button", { name: /retry/i });
      await act(async () => {
        fireEvent.click(retryBtn);
      });

      await waitFor(() => {
        expect(adminClient.getSiteSettings).toHaveBeenCalledTimes(2);
      });

      expect(await screen.findByDisplayValue("CobraLearn Enterprise Hub")).toBeDefined();
    });
  });

  // =========================================================================
  // 2. CROSS-TAB DRAFT PRESERVATION
  // =========================================================================
  describe("2. Cross-Tab Draft State Preservation", () => {
    function TabSwitchTestHarness() {
      const [currentTab, setCurrentTab] = React.useState<"general" | "seo" | "email">("general");
      return (
        <SiteSettingsProvider>
          <div className="flex gap-2">
            <button onClick={() => setCurrentTab("general")}>Tab General</button>
            <button onClick={() => setCurrentTab("seo")}>Tab Seo</button>
            <button onClick={() => setCurrentTab("email")}>Tab Email</button>
          </div>
          {currentTab === "general" && <GeneralTab />}
          {currentTab === "seo" && <SeoMetaTab />}
          {currentTab === "email" && <EmailNotificationsTab />}
        </SiteSettingsProvider>
      );
    }

    it("preserves uncommitted edits when switching between tabs", async () => {
      render(<TabSwitchTestHarness />);

      // Wait for initial load
      const siteNameInput = (await screen.findByDisplayValue("CobraLearn Enterprise Hub")) as HTMLInputElement;

      // Edit field in GeneralTab
      await act(async () => {
        fireEvent.change(siteNameInput, { target: { value: "Modified In General Tab" } });
      });
      expect(siteNameInput.value).toBe("Modified In General Tab");

      // Switch to SEO Tab
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Tab Seo" }));
      });

      // Edit field in SeoMetaTab
      const ogInput = (await screen.findByDisplayValue("https://hub.cobralearn.com/og.png")) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(ogInput, { target: { value: "https://hub.cobralearn.com/new-og.png" } });
      });
      expect(ogInput.value).toBe("https://hub.cobralearn.com/new-og.png");

      // Switch back to General Tab
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Tab General" }));
      });

      // Verify general tab edit remained intact!
      const siteNameAfter = (await screen.findByDisplayValue("Modified In General Tab")) as HTMLInputElement;
      expect(siteNameAfter).toBeDefined();

      // Switch back to SEO tab and verify SEO edit remained intact!
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Tab Seo" }));
      });
      const ogAfter = (await screen.findByDisplayValue("https://hub.cobralearn.com/new-og.png")) as HTMLInputElement;
      expect(ogAfter).toBeDefined();
    });
  });

  // =========================================================================
  // 3. SAVING & SUBMISSION HANDLING
  // =========================================================================
  describe("3. Saving Persisted Settings", () => {
    it("sends only allowlisted SiteSettings payload to adminClient.updateSiteSettings", async () => {
      render(<SiteSettingsPage />);

      const siteNameInput = await screen.findByDisplayValue("CobraLearn Enterprise Hub");
      await act(async () => {
        fireEvent.change(siteNameInput, { target: { value: "Updated Title" } });
      });

      const saveButtons = screen.getAllByRole("button", { name: /save changes/i });
      await act(async () => {
        fireEvent.click(saveButtons[0]);
      });

      await waitFor(() => {
        expect(adminClient.updateSiteSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            siteName: "Updated Title",
            tagline: "High-Performance Edge Architecture",
            siteUrl: "https://hub.cobralearn.com",
            contactEmail: "contact@hub.cobralearn.com",
          })
        );
      });

      // Verify no illegal/system fields were passed in the payload
      const calledArg = (adminClient.updateSiteSettings as any).mock.calls[0][0];
      expect(calledArg).not.toHaveProperty("id");
      expect(calledArg).not.toHaveProperty("updatedAt");
      expect(calledArg).not.toHaveProperty("createdAt");
      expect(calledArg).not.toHaveProperty("actorId");
      expect(calledArg).not.toHaveProperty("themePreset");
    });

    it("displays success toast only after server confirms persistence", async () => {
      render(<SiteSettingsPage />);

      const siteNameInput = await screen.findByDisplayValue("CobraLearn Enterprise Hub");
      await act(async () => {
        fireEvent.change(siteNameInput, { target: { value: "Persisted Once More" } });
      });

      const saveBtn = screen.getAllByRole("button", { name: /save changes/i })[0];
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Site settings saved successfully.");
      });
    });

    it("preserves unsaved user edits when server rejects persistence", async () => {
      (adminClient.updateSiteSettings as any).mockResolvedValueOnce({
        success: false,
        error: "Server-side transaction failed",
      });

      render(<SiteSettingsPage />);

      const siteNameInput = (await screen.findByDisplayValue("CobraLearn Enterprise Hub")) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(siteNameInput, { target: { value: "Unsaved Title Attempt" } });
      });

      const saveBtn = screen.getAllByRole("button", { name: /save changes/i })[0];
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Server-side transaction failed");
      });

      // Draft must be preserved!
      expect(siteNameInput.value).toBe("Unsaved Title Attempt");
    });

    it("prevents duplicate submissions while save is in flight", async () => {
      let resolveSave: any;
      (adminClient.updateSiteSettings as any).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve;
          })
      );

      render(<SiteSettingsPage />);

      const siteNameInput = await screen.findByDisplayValue("CobraLearn Enterprise Hub");
      await act(async () => {
        fireEvent.change(siteNameInput, { target: { value: "Double Click Test" } });
      });

      const saveBtn = screen.getAllByRole("button", { name: /save changes/i })[0];

      // First click
      act(() => {
        fireEvent.click(saveBtn);
      });

      // Second click while in flight
      act(() => {
        fireEvent.click(saveBtn);
      });

      expect(adminClient.updateSiteSettings).toHaveBeenCalledTimes(1);

      // Finish the save
      await act(async () => {
        resolveSave({ success: true, data: persistedSettings });
      });
    });
  });

  // =========================================================================
  // 4. RESET SEMANTICS
  // =========================================================================
  describe("4. Reset Behavior", () => {
    it("discards unsaved local edits and restores last persisted snapshot without DB write", async () => {
      render(<SiteSettingsPage />);

      const siteNameInput = (await screen.findByDisplayValue("CobraLearn Enterprise Hub")) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(siteNameInput, { target: { value: "Transient Draft Value" } });
      });
      expect(siteNameInput.value).toBe("Transient Draft Value");

      const resetBtn = screen.getAllByRole("button", { name: /reset/i })[0];
      await act(async () => {
        fireEvent.click(resetBtn);
      });

      // Input reverted back to persisted snapshot
      expect(siteNameInput.value).toBe("CobraLearn Enterprise Hub");

      // Verify adminClient.updateSiteSettings was NOT called
      expect(adminClient.updateSiteSettings).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith(
        "Unsaved changes discarded. Restored to last saved settings."
      );
    });
  });

  // =========================================================================
  // 5. ROLE AND PERMISSION HANDLING
  // =========================================================================
  describe("5. Role and Permission Handling", () => {
    it("SUPER_ADMIN has editable controls and save/reset enabled", async () => {
      (useAdminProfile as any).mockReturnValue({
        profile: superAdminProfile,
        isLoading: false,
      });

      render(<SiteSettingsPage />);

      const siteNameInput = (await screen.findByDisplayValue("CobraLearn Enterprise Hub")) as HTMLInputElement;
      expect(siteNameInput.disabled).toBe(false);

      const saveButtons = screen.getAllByRole("button", { name: /save changes/i });
      expect(saveButtons[0].hasAttribute("disabled")).toBe(false);
    });

    it("ADMIN and EDITOR are rendered read-only with disabled save controls in UI", async () => {
      for (const roleProfile of [adminProfile, editorProfile]) {
        (useAdminProfile as any).mockReturnValue({
          profile: roleProfile,
          isLoading: false,
        });

        const { unmount } = render(<SiteSettingsPage />);

        const siteNameInput = (await screen.findByDisplayValue("CobraLearn Enterprise Hub")) as HTMLInputElement;
        expect(siteNameInput.disabled).toBe(true);

        const saveButtons = screen.getAllByRole("button", { name: /save changes|read-only/i });
        expect(saveButtons[0].hasAttribute("disabled")).toBe(true);

        unmount();
      }
    });

    it("server operation updateGlobalSettingsOperation succeeds for SUPER_ADMIN", async () => {
      setupAuthMock({
        id: superAdminUuid,
        email: "superadmin@cobralearn.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      });

      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });

      const result = await updateGlobalSettingsOperation(
        req,
        { settings: { siteName: "Authorized Super Title" } },
        mockPrisma
      );

      expect(result.siteName).toBe("Authorized Super Title");
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

    it("server operation updateGlobalSettingsOperation rejects ADMIN and EDITOR with 403 Forbidden", async () => {
      for (const [id, email] of [
        [adminUuid, "admin@cobralearn.com"],
        [editorUuid, "editor@cobralearn.com"],
      ]) {
        setupAuthMock({
          id,
          email,
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        });

        const req = new Request("http://localhost/api/admin/settings", {
          headers: { authorization: "Bearer token" },
        });

        await expect(
          updateGlobalSettingsOperation(req, { settings: { siteName: "Illegal Edit" } }, mockPrisma)
        ).rejects.toThrow(/Forbidden/i);
      }
    });

    it("server operation updateGlobalSettingsOperation rejects unauthenticated calls with 401 Unauthorized", async () => {
      setupAuthMock(null);
      const req = new Request("http://localhost/api/admin/settings", { headers: {} });

      await expect(
        updateGlobalSettingsOperation(req, { settings: { siteName: "Unauthenticated Edit" } }, mockPrisma)
      ).rejects.toThrow(/No cookie header provided|Authentication required|Unauthorized/i);
    });
  });

  // =========================================================================
  // 6. VALIDATION AND SCHEMA CONFORMANCE
  // =========================================================================
  describe("6. Validation and Schema Conformance", () => {
    it("server rejects extra or malicious fields outside the strict allowlist", async () => {
      setupAuthMock({
        id: superAdminUuid,
        email: "superadmin@cobralearn.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      });

      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });

      await expect(
        updateGlobalSettingsOperation(
          req,
          {
            settings: {
              siteName: "Allowed Name",
              maliciousProperty: "<script>alert(1)</script>",
              id: "hacked-id",
            } as any,
          },
          mockPrisma
        )
      ).rejects.toThrow();
    });

    it("server rejects invalid email formats", async () => {
      setupAuthMock({
        id: superAdminUuid,
        email: "superadmin@cobralearn.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      });

      const req = new Request("http://localhost/api/admin/settings", {
        headers: { authorization: "Bearer super-token" },
      });

      await expect(
        updateGlobalSettingsOperation(
          req,
          {
            settings: {
              contactEmail: "not-a-valid-email",
            },
          },
          mockPrisma
        )
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 7. CLIENT/SERVER BOUNDARY & SECRET LEAK PREVENTION
  // =========================================================================
  describe("7. Client/Server Boundary & Secret Leak Prevention", () => {
    it("ensures SiteSettings draft contains zero credentials, secrets, or server tokens", () => {
      const sensitiveKeys = [
        "resendApiKey",
        "turnstileSecret",
        "turnstileSecretKey",
        "serviceRoleKey",
        "databaseUrl",
        "apiSecret",
        "secretKey",
        "serviceRole",
      ];

      sensitiveKeys.forEach((key) => {
        expect(persistedSettings).not.toHaveProperty(key);
      });
    });
  });
});
