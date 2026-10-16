import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React, { useState } from "react";
import { AppearanceProvider, useAppearance } from "@/lib/theme/appearance-context";
import { TypographyTab } from "@/components/appearance/tabs/TypographyTab";
import { ThemeColorsTab } from "@/components/appearance/tabs/ThemeColorsTab";
import { AppearanceTabs, type AppearanceTabId } from "@/components/appearance/AppearanceTabs";
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

// Integration Container simulating AppearancePage tab switching
function AppearanceTabSwitchContainer() {
  const [activeTab, setActiveTab] = useState<AppearanceTabId>("theme-colors");
  const { hasUnsavedChanges, isSaving, saveChanges, resetToSaved } = useAppearance();

  return (
    <div>
      <AppearanceTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <div data-testid="active-tab-id">{activeTab}</div>
      <div data-testid="has-unsaved">{String(hasUnsavedChanges)}</div>

      <div className="tab-content">
        {activeTab === "theme-colors" && <ThemeColorsTab />}
        {activeTab === "typography" && <TypographyTab />}
      </div>
    </div>
  );
}

describe("Typography Tab Crash Regression & Tab Switching Integration Suite", () => {
  const mockAdminProfile = {
    id: "admin-uuid-123",
    email: "admin@cobralearn.com",
    role: "ADMIN" as AdminRole,
    isActive: true,
  };

  const mockEditorProfile = {
    id: "editor-uuid-456",
    email: "editor@cobralearn.com",
    role: "EDITOR" as AdminRole,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAdminProfile as any).mockReturnValue({ profile: mockAdminProfile });
  });

  it("1. Opening Appearance route and rendering Typography tab directly does not throw", async () => {
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
    expect(screen.getByText(/Primary Heading Font/i)).toBeDefined();
    expect(screen.getByText(/Primary Body Font/i)).toBeDefined();
  });

  it("2. Switching to Typography tab and back to Theme & Colors works seamlessly", async () => {
    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: null,
    });

    render(
      <AppearanceProvider>
        <AppearanceTabSwitchContainer />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("active-tab-id").textContent).toBe("theme-colors");
    });
    expect(screen.getByText("Theme System")).toBeDefined();

    // Click Typography Tab
    const typographyTabBtn = screen.getByRole("button", { name: /typography/i });
    fireEvent.click(typographyTabBtn);

    await waitFor(() => {
      expect(screen.getByTestId("active-tab-id").textContent).toBe("typography");
    });
    expect(screen.getByText("Global Font Architecture")).toBeDefined();

    // Click Theme & Colors Tab back
    const themeTabBtn = screen.getByRole("button", { name: /theme & colors/i });
    fireEvent.click(themeTabBtn);

    await waitFor(() => {
      expect(screen.getByTestId("active-tab-id").textContent).toBe("theme-colors");
    });
    expect(screen.getByText("Theme System")).toBeDefined();
  });

  it("3. Rendering when configuration is absent in database uses default fonts without crashing", async () => {
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
      expect(screen.getByText(/Active: Orbitron/i)).toBeDefined();
      expect(screen.getByText(/Active: Rajdhani/i)).toBeDefined();
    });
  });

  it("4. Rendering when persisted configuration exists loads custom fonts accurately", async () => {
    const customConfig: AppearanceConfig = {
      id: "default",
      themePreset: "custom",
      brandPrimaryColor: "#00FF87",
      brandSecondaryColor: "#00E5FF",
      brandAccentColor: "#FFB800",
      fontHeading: "Space Grotesk",
      fontBody: "Inter",
      logoAssetId: null,
      faviconAssetId: null,
      enableGlowEffects: true,
      enableAnimations: true,
      updatedAt: new Date(),
    };

    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: customConfig,
    });

    render(
      <AppearanceProvider>
        <TypographyTab />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Active: Space Grotesk/i)).toBeDefined();
      expect(screen.getByText(/Active: Inter/i)).toBeDefined();
    });
  });

  it("5. API failure does not crash the Typography tab component", async () => {
    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: false,
      error: "Database unreachable",
    });

    render(
      <AppearanceProvider>
        <TypographyTab />
      </AppearanceProvider>
    );

    // Default fallback values are safely rendered despite error
    await waitFor(() => {
      expect(screen.getByText("Global Font Architecture")).toBeDefined();
    });
  });

  it("6. Maintaining unsaved changes across tab switches (Theme -> Typography -> Theme)", async () => {
    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: null,
    });

    render(
      <AppearanceProvider>
        <AppearanceTabSwitchContainer />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("active-tab-id").textContent).toBe("theme-colors");
    });

    // Apply preset in Theme Colors
    const midnightPreset = screen.getByText("Midnight Cyber");
    fireEvent.click(midnightPreset);

    expect(screen.getByTestId("has-unsaved").textContent).toBe("true");

    // Switch to Typography Tab
    fireEvent.click(screen.getByRole("button", { name: /typography/i }));

    await waitFor(() => {
      expect(screen.getByTestId("active-tab-id").textContent).toBe("typography");
    });
    // Unsaved flag remains preserved across tab switch!
    expect(screen.getByTestId("has-unsaved").textContent).toBe("true");

    // Change heading font in Typography Tab
    const selects = screen.getAllByRole("combobox");
    const headingSelect = selects[0];
    fireEvent.change(headingSelect, { target: { value: "Oxanium" } });

    expect(screen.getByText(/Active: Oxanium/i)).toBeDefined();
    expect(screen.getByTestId("has-unsaved").textContent).toBe("true");

    // Switch back to Theme Colors
    fireEvent.click(screen.getByRole("button", { name: /theme & colors/i }));

    await waitFor(() => {
      expect(screen.getByTestId("active-tab-id").textContent).toBe("theme-colors");
    });
    expect(screen.getByTestId("has-unsaved").textContent).toBe("true");
  });

  it("7. Ensures EDITOR users cannot persist changes (Save button hidden or disabled)", async () => {
    (useAdminProfile as any).mockReturnValue({ profile: mockEditorProfile });
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

    // Save Typography button should not be present for EDITOR role
    const saveBtn = screen.queryByRole("button", { name: /save typography/i });
    expect(saveBtn).toBeNull();
  });
});
