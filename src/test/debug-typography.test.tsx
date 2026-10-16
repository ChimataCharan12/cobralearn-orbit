import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AppearanceProvider } from "@/lib/theme/appearance-context";
import { TypographyTab } from "@/components/appearance/tabs/TypographyTab";
import { ThemeColorsTab } from "@/components/appearance/tabs/ThemeColorsTab";
import { adminClient } from "@/lib/api/admin-client";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import type { AppearanceConfig, AdminRole } from "@prisma/client";

// Mock dependencies
vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    getAppearanceConfig: vi.fn(),
    updateAppearanceConfig: vi.fn(),
    getAdminMedia: vi.fn(),
  },
}));

vi.mock("@/lib/auth/use-admin-profile", () => ({
  useAdminProfile: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("Debug Typography Tab Render", () => {
  const mockAdminProfile = {
    id: "admin-uuid-123",
    email: "admin@cobralearn.com",
    role: "ADMIN" as AdminRole,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAdminProfile as any).mockReturnValue({ profile: mockAdminProfile });
  });

  it("renders TypographyTab without crashing when config is null", async () => {
    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: null,
    });

    render(
      <AppearanceProvider>
        <TypographyTab />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Global Font Architecture")).toBeDefined();
    });
  });

  it("renders TypographyTab when fontHeading and fontBody are null/undefined or atypical in database", async () => {
    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: {
        id: "default",
        themePreset: null,
        brandPrimaryColor: null,
        brandSecondaryColor: null,
        brandAccentColor: null,
        fontHeading: null,
        fontBody: null,
        logoAssetId: null,
        faviconAssetId: null,
        enableGlowEffects: null,
        enableAnimations: null,
      },
    });

    render(
      <AppearanceProvider>
        <TypographyTab />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Global Font Architecture")).toBeDefined();
    });
  });
});
