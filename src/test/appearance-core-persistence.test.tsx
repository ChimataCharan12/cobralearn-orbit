import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AppearanceProvider, useAppearance, DEFAULT_APPEARANCE_STATE } from "@/lib/theme/appearance-context";
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

function ConsumerTestComponent() {
  const {
    currentValues,
    savedValues,
    updateField,
    saveChanges,
    resetToSaved,
    hasUnsavedChanges,
    isLoading,
    loadError,
    canUpdate,
  } = useAppearance();

  return (
    <div>
      <span data-testid="is-loading">{String(isLoading)}</span>
      <span data-testid="load-error">{loadError || "none"}</span>
      <span data-testid="has-unsaved">{String(hasUnsavedChanges)}</span>
      <span data-testid="can-update">{String(canUpdate)}</span>
      <span data-testid="theme-preset">{currentValues.themePreset}</span>
      <span data-testid="primary-color">{currentValues.brandPrimaryColor}</span>
      <span data-testid="heading-font">{currentValues.fontHeading}</span>
      <span data-testid="animations-enabled">{String(currentValues.enableAnimations)}</span>
      <span data-testid="logo-asset-id">{currentValues.logoAssetId || "none"}</span>

      <button
        onClick={() => updateField("brandPrimaryColor", "#10B981")}
        data-testid="btn-change-color"
      >
        Change Color
      </button>

      <button
        onClick={() => updateField("fontHeading", "Oxanium")}
        data-testid="btn-change-font"
      >
        Change Font
      </button>

      <button onClick={() => resetToSaved()} data-testid="btn-reset">
        Reset
      </button>

      <button onClick={() => saveChanges()} data-testid="btn-save">
        Save
      </button>
    </div>
  );
}

describe("Appearance Phase 1: Core State & Persistence Integration Suite", () => {
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

  it("1. Loads default appearance settings when database row is null", async () => {
    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: null,
    });

    render(
      <AppearanceProvider>
        <ConsumerTestComponent />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("theme-preset").textContent).toBe("dark");
    expect(screen.getByTestId("primary-color").textContent).toBe("#00FF87");
    expect(screen.getByTestId("heading-font").textContent).toBe("Orbitron");
    expect(screen.getByTestId("animations-enabled").textContent).toBe("true");
    expect(screen.getByTestId("has-unsaved").textContent).toBe("false");
  });

  it("2. Loads saved appearance configuration from database response", async () => {
    const persistedMock: AppearanceConfig = {
      id: "default",
      themePreset: "emerald-night",
      brandPrimaryColor: "#10B981",
      brandSecondaryColor: "#06B6D4",
      brandAccentColor: "#F59E0B",
      fontHeading: "Oxanium",
      fontBody: "Rajdhani",
      logoAssetId: "media-logo-1",
      faviconAssetId: "media-fav-1",
      enableGlowEffects: true,
      enableAnimations: false,
      updatedAt: new Date(),
    };

    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: persistedMock,
    });
    (adminClient.getAdminMedia as any).mockResolvedValue({ success: true, data: null });

    render(
      <AppearanceProvider>
        <ConsumerTestComponent />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("theme-preset").textContent).toBe("emerald-night");
    expect(screen.getByTestId("primary-color").textContent).toBe("#10B981");
    expect(screen.getByTestId("heading-font").textContent).toBe("Oxanium");
    expect(screen.getByTestId("animations-enabled").textContent).toBe("false");
    expect(screen.getByTestId("logo-asset-id").textContent).toBe("media-logo-1");
  });

  it("3. Detects unsaved changes when user modifies a field", async () => {
    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: null,
    });

    render(
      <AppearanceProvider>
        <ConsumerTestComponent />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("has-unsaved").textContent).toBe("false");

    fireEvent.click(screen.getByTestId("btn-change-color"));

    expect(screen.getByTestId("primary-color").textContent).toBe("#10B981");
    expect(screen.getByTestId("has-unsaved").textContent).toBe("true");
  });

  it("4. Reset to saved restores previous baseline without network calls", async () => {
    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: null,
    });

    render(
      <AppearanceProvider>
        <ConsumerTestComponent />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    fireEvent.click(screen.getByTestId("btn-change-color"));
    expect(screen.getByTestId("primary-color").textContent).toBe("#10B981");
    expect(screen.getByTestId("has-unsaved").textContent).toBe("true");

    fireEvent.click(screen.getByTestId("btn-reset"));
    expect(screen.getByTestId("primary-color").textContent).toBe("#00FF87");
    expect(screen.getByTestId("has-unsaved").textContent).toBe("false");
  });

  it("5. Successfully saves changes to database via adminClient.updateAppearanceConfig", async () => {
    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: null,
    });
    (adminClient.updateAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: {
        id: "default",
        themePreset: "dark",
        brandPrimaryColor: "#10B981",
        brandSecondaryColor: "#00E5FF",
        brandAccentColor: "#FFB800",
        fontHeading: "Oxanium",
        fontBody: "Rajdhani",
        logoAssetId: null,
        faviconAssetId: null,
        enableGlowEffects: true,
        enableAnimations: true,
        updatedAt: new Date(),
      },
    });

    render(
      <AppearanceProvider>
        <ConsumerTestComponent />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    fireEvent.click(screen.getByTestId("btn-change-color"));
    fireEvent.click(screen.getByTestId("btn-change-font"));
    expect(screen.getByTestId("has-unsaved").textContent).toBe("true");

    fireEvent.click(screen.getByTestId("btn-save"));

    await waitFor(() => {
      expect(adminClient.updateAppearanceConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          brandPrimaryColor: "#10B981",
          fontHeading: "Oxanium",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("has-unsaved").textContent).toBe("false");
    });
  });

  it("6. Rejects save action for EDITOR role due to RBAC governance", async () => {
    (useAdminProfile as any).mockReturnValue({ profile: mockEditorProfile });
    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: true,
      data: null,
    });

    render(
      <AppearanceProvider>
        <ConsumerTestComponent />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("can-update").textContent).toBe("false");

    fireEvent.click(screen.getByTestId("btn-change-color"));
    fireEvent.click(screen.getByTestId("btn-save"));

    expect(adminClient.updateAppearanceConfig).not.toHaveBeenCalled();
  });

  it("7. Handles database load error gracefully and displays error state", async () => {
    (adminClient.getAppearanceConfig as any).mockResolvedValue({
      success: false,
      error: "PostgreSQL connection timeout",
    });

    render(
      <AppearanceProvider>
        <ConsumerTestComponent />
      </AppearanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("load-error").textContent).toBe("PostgreSQL connection timeout");
  });
});
