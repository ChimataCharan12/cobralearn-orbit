import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  DEFAULT_PUBLIC_APPEARANCE_CONFIG,
  generatePublicAppearanceCss,
  sanitizeColor,
  sanitizeFont,
  sanitizeAssetUrl,
  type PublicAppearanceConfig,
} from "@/lib/public-appearance";
import { getPublicAppearanceConfigOperation } from "@/lib/server/admin-operations";
import {
  PublicAppearanceProvider,
  usePublicAppearance,
} from "@/lib/theme/public-appearance-context";
import { BrandMark } from "@/components/public/BrandMark";

// Mock router Link component
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

// Mock server function for testing adminClient.getPublicAppearanceConfig
vi.mock("@/lib/server/settings-server-fns", () => ({
  getPublicAppearanceConfigServerFn: vi.fn(),
  getGlobalSettingsServerFn: vi.fn(),
  updateGlobalSettingsServerFn: vi.fn(),
  getAppearanceConfigServerFn: vi.fn(),
  updateAppearanceConfigServerFn: vi.fn(),
  getSettingsEnvironmentStatusServerFn: vi.fn(),
  getPublicSiteSettingsServerFn: vi.fn(),
}));

import { getPublicAppearanceConfigServerFn } from "@/lib/server/settings-server-fns";
import { adminClient } from "@/lib/api/admin-client";

describe("Phase 2: Public-Site Runtime Appearance Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Public Appearance Server Operation & Security Boundaries", () => {
    it("returns only allowlisted public fields with resolved asset URLs and no secrets/internal IDs", async () => {
      const mockPrisma = {
        appearanceConfig: {
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            themePreset: "cyberpunk",
            brandPrimaryColor: "#10B981",
            brandSecondaryColor: "#06B6D4",
            brandAccentColor: "#F59E0B",
            fontHeading: "Orbitron",
            fontBody: "Rajdhani",
            enableAnimations: false,
            enableGlowEffects: false,
            logoAssetId: "asset-logo-123",
            faviconAssetId: "asset-fav-456",
            updatedAt: new Date(),
            // Relations resolved by include
            logoAsset: {
              id: "asset-logo-123",
              publicUrl: "https://cdn.example.com/branding/custom-logo.png",
              bucket: "media-library",
            },
            faviconAsset: {
              id: "asset-fav-456",
              publicUrl: "https://cdn.example.com/branding/custom-favicon.png",
              bucket: "media-library",
            },
          }),
        },
      } as any;

      const result = await getPublicAppearanceConfigOperation(mockPrisma);

      // Verify exact allowlisted public fields
      expect(result).toEqual({
        themePreset: "cyberpunk",
        brandPrimaryColor: "#10B981",
        brandSecondaryColor: "#06B6D4",
        brandAccentColor: "#F59E0B",
        fontHeading: "Orbitron",
        fontBody: "Rajdhani",
        enableAnimations: false,
        enableGlowEffects: false,
        logoUrl: "https://cdn.example.com/branding/custom-logo.png",
        faviconUrl: "https://cdn.example.com/branding/custom-favicon.png",
      });

      // Verify no sensitive internal fields or IDs are leaked
      expect((result as any).id).toBeUndefined();
      expect((result as any).updatedAt).toBeUndefined();
      expect((result as any).logoAssetId).toBeUndefined();
      expect((result as any).faviconAssetId).toBeUndefined();
      expect((result as any).logoAsset).toBeUndefined();
      expect((result as any).faviconAsset).toBeUndefined();
    });

    it("falls back to safe default appearance configuration when database row is absent", async () => {
      const mockPrisma = {
        appearanceConfig: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as any;

      const result = await getPublicAppearanceConfigOperation(mockPrisma);
      expect(result).toEqual(DEFAULT_PUBLIC_APPEARANCE_CONFIG);
      expect(result.brandPrimaryColor).toBe("#00FF87");
      expect(result.brandSecondaryColor).toBe("#00E5FF");
      expect(result.brandAccentColor).toBe("#FFB800");
      expect(result.fontHeading).toBe("Orbitron");
      expect(result.fontBody).toBe("Rajdhani");
      expect(result.enableAnimations).toBe(true);
      expect(result.enableGlowEffects).toBe(true);
      expect(result.logoUrl).toBeNull();
      expect(result.faviconUrl).toBeNull();
    });

    it("falls back to safe default appearance configuration on database query failure", async () => {
      const mockPrisma = {
        appearanceConfig: {
          findUnique: vi.fn().mockRejectedValue(new Error("Connection reset")),
        },
      } as any;

      const result = await getPublicAppearanceConfigOperation(mockPrisma);
      expect(result).toEqual(DEFAULT_PUBLIC_APPEARANCE_CONFIG);
    });

    it("adminClient.getPublicAppearanceConfig returns safe defaults when server function throws", async () => {
      vi.mocked(getPublicAppearanceConfigServerFn).mockRejectedValue(new Error("Network failed"));

      const res = await adminClient.getPublicAppearanceConfig();
      expect(res.success).toBe(true);
      expect(res.data).toEqual(DEFAULT_PUBLIC_APPEARANCE_CONFIG);
    });
  });

  describe("2. Color and Font Sanitization", () => {
    it("sanitizes valid 3, 4, 6, and 8 digit hex colors", () => {
      expect(sanitizeColor("#FFF", "#000")).toBe("#FFF");
      expect(sanitizeColor("#00ff87", "#000")).toBe("#00ff87");
      expect(sanitizeColor("#00E5FFAA", "#000")).toBe("#00E5FFAA");
    });

    it("rejects malicious or invalid color strings and falls back to default", () => {
      expect(sanitizeColor("red; } body { display:none }", "#00FF87")).toBe("#00FF87");
      expect(sanitizeColor("javascript:alert(1)", "#00FF87")).toBe("#00FF87");
      expect(sanitizeColor("rgb(0, 255, 0)", "#00FF87")).toBe("#00FF87");
      expect(sanitizeColor("", "#00FF87")).toBe("#00FF87");
      expect(sanitizeColor(null, "#00FF87")).toBe("#00FF87");
      expect(sanitizeColor(undefined, "#00FF87")).toBe("#00FF87");
    });

    it("validates supported font families and rejects arbitrary strings", () => {
      expect(sanitizeFont("Orbitron", "Rajdhani")).toBe("Orbitron");
      expect(sanitizeFont("Oxanium", "Rajdhani")).toBe("Oxanium");
      expect(sanitizeFont("Rajdhani", "Rajdhani")).toBe("Rajdhani");
      expect(sanitizeFont("Space Grotesk", "Rajdhani")).toBe("Space Grotesk");
      expect(sanitizeFont("Inter", "Rajdhani")).toBe("Inter");

      expect(sanitizeFont("Comic Sans MS", "Orbitron")).toBe("Orbitron");
      expect(sanitizeFont("<script>", "Orbitron")).toBe("Orbitron");
      expect(sanitizeFont(null, "Orbitron")).toBe("Orbitron");
    });

    it("sanitizes asset URLs accepting root-relative and https URLs only", () => {
      expect(sanitizeAssetUrl("/uploads/logo.png")).toBe("/uploads/logo.png");
      expect(sanitizeAssetUrl("https://cdn.example.com/fav.ico")).toBe("https://cdn.example.com/fav.ico");
      expect(sanitizeAssetUrl("javascript:alert(1)")).toBeNull();
      expect(sanitizeAssetUrl("data:text/html,...")).toBeNull();
      expect(sanitizeAssetUrl(null)).toBeNull();
    });
  });

  describe("3. Dynamic CSS Generation & Isolation", () => {
    it("generates brand color tokens and typography variables scoped to public elements", () => {
      const config: PublicAppearanceConfig = {
        themePreset: "dark",
        brandPrimaryColor: "#3B82F6",
        brandSecondaryColor: "#8B5CF6",
        brandAccentColor: "#EC4899",
        fontHeading: "Space Grotesk",
        fontBody: "Inter",
        enableAnimations: true,
        enableGlowEffects: true,
        logoUrl: null,
        faviconUrl: null,
      };

      const css = generatePublicAppearanceCss(config);

      // Verify custom properties are properly assigned
      expect(css).toContain("--brand-primary: #3B82F6");
      expect(css).toContain("--brand-secondary: #8B5CF6");
      expect(css).toContain("--brand-accent: #EC4899");
      expect(css).toContain('--font-display: "Space Grotesk", sans-serif');
      expect(css).toContain('--font-sans: "Inter", sans-serif');

      // Verify public scopes are targeted
      expect(css).toContain(".site-shell, .detail-page, .floating-contact-btn");
      expect(css).toContain(".site-shell h1, .site-shell h2");

      // Verify admin portal is NOT targeted
      expect(css).not.toContain(".admin-layout");
      expect(css).not.toContain("[data-admin-accent]");
      expect(css).not.toContain(".dash-bg");
    });

    it("generates animation suppression rules when enableAnimations is false", () => {
      const config: PublicAppearanceConfig = {
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
        enableAnimations: false,
      };

      const css = generatePublicAppearanceCss(config);
      expect(css).toContain("Non-essential animations disabled via AppearanceConfig");
      expect(css).toContain("animation-duration: 0.001ms !important");
      expect(css).toContain("transition-duration: 0.001ms !important");
    });

    it("omits animation suppression rules when enableAnimations is true", () => {
      const config: PublicAppearanceConfig = {
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
        enableAnimations: true,
      };

      const css = generatePublicAppearanceCss(config);
      expect(css).not.toContain("Non-essential animations disabled via AppearanceConfig");
      expect(css).not.toContain("animation-duration: 0.001ms !important");
    });

    it("generates glow suppression rules when enableGlowEffects is false", () => {
      const config: PublicAppearanceConfig = {
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
        enableGlowEffects: false,
      };

      const css = generatePublicAppearanceCss(config);
      expect(css).toContain("Decorative glow effects disabled via AppearanceConfig");
      expect(css).toContain("text-shadow: none !important");
      expect(css).toContain(".site-shell .brand-glow");
      expect(css).toContain(".site-shell .portal-button-glow");
    });

    it("omits glow suppression rules when enableGlowEffects is true", () => {
      const config: PublicAppearanceConfig = {
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
        enableGlowEffects: true,
      };

      const css = generatePublicAppearanceCss(config);
      expect(css).not.toContain("Decorative glow effects disabled via AppearanceConfig");
      expect(css).not.toContain("text-shadow: none !important");
    });
  });

  describe("4. BrandMark Component & Logo Resolution", () => {
    it("renders official fallback logo image when no custom logo is configured", () => {
      render(
        <PublicAppearanceProvider appearance={DEFAULT_PUBLIC_APPEARANCE_CONFIG}>
          <BrandMark />
        </PublicAppearanceProvider>
      );

      const img = screen.getByAltText("CobraLearn InnoTechCore") as HTMLImageElement;
      expect(img).toBeDefined();
      expect(img.src).toContain("cobralearn-official-logo.png");
      expect(img.className).toContain("brand-logo-img");
      expect(img.getAttribute("width")).toBe("660");
      expect(img.getAttribute("height")).toBe("190");
    });

    it("renders custom logo URL when configured via appearance context", () => {
      const customConfig: PublicAppearanceConfig = {
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
        logoUrl: "https://cdn.example.com/custom-brand-logo.png",
      };

      render(
        <PublicAppearanceProvider appearance={customConfig}>
          <BrandMark />
        </PublicAppearanceProvider>
      );

      const img = screen.getByAltText("CobraLearn InnoTechCore") as HTMLImageElement;
      expect(img.src).toBe("https://cdn.example.com/custom-brand-logo.png");
    });

    it("supports compact logo class when compact prop is true", () => {
      render(
        <PublicAppearanceProvider appearance={DEFAULT_PUBLIC_APPEARANCE_CONFIG}>
          <BrandMark compact />
        </PublicAppearanceProvider>
      );

      const img = screen.getByAltText("CobraLearn InnoTechCore");
      expect(img.className).toContain("brand-logo-compact");
    });

    it("falls back to official logo if custom logo fails to load (onError)", () => {
      const customConfig: PublicAppearanceConfig = {
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
        logoUrl: "https://broken-cdn.example.com/missing-logo.png",
      };

      render(
        <PublicAppearanceProvider appearance={customConfig}>
          <BrandMark />
        </PublicAppearanceProvider>
      );

      const img = screen.getByAltText("CobraLearn InnoTechCore") as HTMLImageElement;
      expect(img.src).toBe("https://broken-cdn.example.com/missing-logo.png");

      // Trigger image error
      fireEvent.error(img);

      // Verify it safely recovered to the official logo
      expect(img.src).toContain("cobralearn-official-logo.png");
    });

    it("usePublicAppearance falls back safely without throwing when used outside provider", () => {
      function TestConsumer() {
        const appearance = usePublicAppearance();
        return <div data-testid="test-val">{appearance.brandPrimaryColor}</div>;
      }

      render(<TestConsumer />);
      expect(screen.getByTestId("test-val").textContent).toBe("#00FF87");
    });
  });
});
