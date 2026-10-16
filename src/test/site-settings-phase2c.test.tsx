import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SiteSettingsProvider } from "@/lib/site-settings-context";
import { SiteSettingsPage } from "@/routes/admin/settings";
import { GeneralTab } from "@/components/settings/tabs/GeneralTab";
import { SeoMetaTab } from "@/components/settings/tabs/SeoMetaTab";
import { IntegrationsTab } from "@/components/settings/tabs/IntegrationsTab";
import { EmailNotificationsTab } from "@/components/settings/tabs/EmailNotificationsTab";
import { SecurityTab } from "@/components/settings/tabs/SecurityTab";
import { AnalyticsTab } from "@/components/settings/tabs/AnalyticsTab";
import { MaintenanceTab } from "@/components/settings/tabs/MaintenanceTab";
import { AdvancedTab } from "@/components/settings/tabs/AdvancedTab";
import { toast } from "sonner";
import type { AdminProfile, AdminRole } from "@prisma/client";

// Mock Supabase Server Client
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

// Mock adminClient
vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    getSiteSettings: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: "default-settings",
        siteName: "CobraLearn Innotechcore",
        tagline: "Architecting Digital Reality",
        siteDescription: "Platform for digital experiences.",
        siteUrl: "https://cobralearn.in",
        contactEmail: "support@cobralearn.in",
        contactPhone: "+91 98765 43210",
        contactAddress: "Tech Hub, Bangalore",
        businessHours: "Mon - Fri: 9:00 AM - 6:00 PM IST",
        defaultLanguage: "en",
        timezone: "Asia/Kolkata",
        dateFormat: "DD/MM/YYYY",
        timeFormat: "12-hour",
        metaKeywords: ["technology", "innovation"],
        ogImageUrl: null,
        notifyOnNewMessage: true,
        notificationEmail: "admin@cobralearn.in",
        sessionTimeoutMinutes: 60,
        enforceMfa: false,
        updatedAt: new Date().toISOString(),
      },
    }),
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

const mockSuperAdminProfile: AdminProfile = {
  id: "superadmin-uuid",
  email: "superadmin@cobralearn.com",
  fullName: "Super Admin",
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

vi.mock("@/lib/auth/use-admin-profile", () => ({
  useAdminProfile: () => ({
    profile: mockSuperAdminProfile,
    isLoading: false,
    error: null,
  }),
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

describe("Phase 2C: Site Settings UI Harmonization and Coming-Soon Status Polish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Redundant Local Action Bars Removal", () => {
    it("IntegrationsTab has no local Save Changes or Reset Defaults buttons", () => {
      render(
        <SiteSettingsProvider>
          <IntegrationsTab />
        </SiteSettingsProvider>
      );
      expect(screen.queryByRole("button", { name: /save changes/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /reset defaults/i })).toBeNull();
    });

    it("SecurityTab has no local Save Changes or Reset Defaults buttons", () => {
      render(
        <SiteSettingsProvider>
          <SecurityTab />
        </SiteSettingsProvider>
      );
      expect(screen.queryByRole("button", { name: /save changes/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /reset defaults/i })).toBeNull();
    });

    it("MaintenanceTab has no local Save Changes or Reset Defaults buttons", () => {
      render(
        <SiteSettingsProvider>
          <MaintenanceTab />
        </SiteSettingsProvider>
      );
      expect(screen.queryByRole("button", { name: /save changes/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /reset defaults/i })).toBeNull();
    });

    it("AdvancedTab has no local Save Changes button", () => {
      render(
        <SiteSettingsProvider>
          <AdvancedTab />
        </SiteSettingsProvider>
      );
      expect(screen.queryByRole("button", { name: /save changes/i })).toBeNull();
    });
  });

  describe("Global Action Bar Preservation", () => {
    it("SiteSettingsPage renders the global authoritative Save Changes and Reset Changes buttons", async () => {
      render(<SiteSettingsPage />);

      // The global action bar is in the footer
      const saveBtn = await screen.findByRole("button", { name: /save changes/i });
      const resetBtn = screen.getByRole("button", { name: /reset changes/i });

      expect(saveBtn).toBeInTheDocument();
      expect(resetBtn).toBeInTheDocument();
    });

    it("renders all 8 settings tabs navigation options", () => {
      render(<SiteSettingsPage />);

      expect(screen.getByRole("button", { name: /general/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /seo & meta/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /integrations/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /email & notifications/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /security/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /analytics/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /maintenance/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /advanced/i })).toBeInTheDocument();
    });
  });

  describe("Coming Soon — Version 2 Status Polish & Non-Misleading Feedback", () => {
    it("IntegrationsTab displays Coming Soon badges and non-misleading action feedback", () => {
      render(
        <SiteSettingsProvider>
          <IntegrationsTab />
        </SiteSettingsProvider>
      );

      const badges = screen.getAllByText(/Coming Soon — Version 2/i);
      expect(badges.length).toBeGreaterThanOrEqual(3); // Analytics, Maps, Bot Protection

      // Diagnostics action
      const diagBtn = screen.getByRole("button", { name: /diagnostics/i });
      fireEvent.click(diagBtn);
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("Version 2")
      );
      expect(toast.success).not.toHaveBeenCalled();

      // Purge CDN action
      const purgeBtn = screen.getByRole("button", { name: /purge cdn cache/i });
      fireEvent.click(purgeBtn);
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("Version 2")
      );
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("SecurityTab displays Coming Soon badges and non-misleading session revocation feedback", () => {
      render(
        <SiteSettingsProvider>
          <SecurityTab />
        </SiteSettingsProvider>
      );

      const badges = screen.getAllByText(/Coming Soon — Version 2/i);
      expect(badges.length).toBeGreaterThanOrEqual(4);

      // Terminate session buttons
      const terminateBtns = screen.getAllByRole("button", { name: /terminate/i });
      fireEvent.click(terminateBtns[0]);
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("Supabase")
      );
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("MaintenanceTab displays Coming Soon badges and non-misleading maintenance feedback", () => {
      render(
        <SiteSettingsProvider>
          <MaintenanceTab />
        </SiteSettingsProvider>
      );

      const badges = screen.getAllByText(/Coming Soon — Version 2/i);
      expect(badges.length).toBeGreaterThanOrEqual(5);

      // Refresh indices button
      const refreshIndicesBtn = screen.getByRole("button", { name: /refresh indices/i });
      fireEvent.click(refreshIndicesBtn);
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("Version 2")
      );
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("AdvancedTab displays Coming Soon badges and non-misleading data portability feedback", () => {
      render(
        <SiteSettingsProvider>
          <AdvancedTab />
        </SiteSettingsProvider>
      );

      const badges = screen.getAllByText(/Coming Soon — Version 2/i);
      expect(badges.length).toBeGreaterThanOrEqual(3);

      // Export site archive
      const exportBtn = screen.getByRole("button", { name: /export site archive/i });
      fireEvent.click(exportBtn);
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("Version 2")
      );
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("GeneralTab displays Coming Soon on Logo/Favicon and informs user about Version 2 media linking", () => {
      render(
        <SiteSettingsProvider>
          <GeneralTab />
        </SiteSettingsProvider>
      );

      expect(screen.getAllByText(/Coming Soon — Version 2/i).length).toBeGreaterThanOrEqual(2);

      const changeLogoBtn = screen.getByRole("button", { name: /change logo/i });
      fireEvent.click(changeLogoBtn);
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("Version 2")
      );
    });

    it("EmailNotificationsTab displays Coming Soon on Templates and informs user on test email", () => {
      render(
        <SiteSettingsProvider>
          <EmailNotificationsTab />
        </SiteSettingsProvider>
      );

      expect(screen.getAllByText(/Coming Soon — Version 2/i).length).toBeGreaterThanOrEqual(2);

      const sendTestBtn = screen.getByRole("button", { name: /send test email/i });
      fireEvent.click(sendTestBtn);
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("Version 2")
      );
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("AnalyticsTab displays Coming Soon indicator for live telemetry", () => {
      render(
        <SiteSettingsProvider>
          <AnalyticsTab />
        </SiteSettingsProvider>
      );

      expect(screen.getByText(/Coming Soon — Version 2/i)).toBeInTheDocument();
    });
  });
});
