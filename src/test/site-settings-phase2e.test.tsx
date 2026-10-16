import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_PUBLIC_SITE_SETTINGS,
  getPublicMetaTags,
  normalizeCanonicalUrl,
  resolveOgImageUrl,
  type PublicSiteSettings,
} from "@/lib/public-metadata";
import { getPublicSiteSettingsOperation } from "@/lib/server/admin-operations";
import { getPublicContactConfigOperation } from "@/lib/server/contact-operations";
import { adminClient } from "@/lib/api/admin-client";

// Mock server function for testing adminClient.getPublicSiteSettings
vi.mock("@/lib/server/settings-server-fns", () => ({
  getPublicSiteSettingsServerFn: vi.fn(),
}));

import { getPublicSiteSettingsServerFn } from "@/lib/server/settings-server-fns";

describe("Phase 2E: Public Site Settings Consumption & Metadata Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Public Data Access & Security Separation", () => {
    it("returns only allowlisted public fields and never exposes secrets or admin fields", async () => {
      const mockPrisma = {
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            siteName: "Custom Portal",
            siteDescription: "Custom showcase platform",
            ogImageUrl: "https://cdn.example.com/social-preview.png",
            metaKeywords: ["design", "future", "tech"],
            siteUrl: "https://custom.example.com",
            // Admin/internal fields that must NOT be exposed:
            notificationEmail: "admin@secret.internal",
            notifyOnNewMessage: true,
            sessionTimeoutMinutes: 60,
            enforceMfa: true,
            updatedAt: new Date(),
          }),
        },
      } as any;

      const result = await getPublicSiteSettingsOperation(mockPrisma);

      // Verify required allowlisted public fields are present
      expect(result).toEqual({
        siteName: "Custom Portal",
        siteDescription: "Custom showcase platform",
        ogImageUrl: "https://cdn.example.com/social-preview.png",
        metaKeywords: ["design", "future", "tech"],
        siteUrl: "https://custom.example.com",
      });

      // Verify no sensitive internal fields exist on the returned object
      expect((result as any).notificationEmail).toBeUndefined();
      expect((result as any).notifyOnNewMessage).toBeUndefined();
      expect((result as any).sessionTimeoutMinutes).toBeUndefined();
      expect((result as any).enforceMfa).toBeUndefined();
      expect((result as any).updatedAt).toBeUndefined();
      expect((result as any).id).toBeUndefined();
    });

    it("falls back to safe default settings when database returns null", async () => {
      const mockPrisma = {
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as any;

      const result = await getPublicSiteSettingsOperation(mockPrisma);
      expect(result).toEqual(DEFAULT_PUBLIC_SITE_SETTINGS);
    });

    it("falls back to safe default settings when database query throws an error", async () => {
      const mockPrisma = {
        siteSettings: {
          findUnique: vi.fn().mockRejectedValue(new Error("Database connection dropped")),
        },
      } as any;

      const result = await getPublicSiteSettingsOperation(mockPrisma);
      expect(result).toEqual(DEFAULT_PUBLIC_SITE_SETTINGS);
    });
  });

  describe("2. Document Title and Description Metadata", () => {
    it("formats dynamic document title and description using persisted settings", () => {
      const settings: PublicSiteSettings = {
        siteName: "InnoTech Showcase",
        siteDescription: "A world-class digital showcase of interactive web applications.",
        ogImageUrl: null,
        metaKeywords: [],
        siteUrl: "https://innotech.example.com",
      };

      const { meta } = getPublicMetaTags(settings);

      const titleTag = meta.find((m) => m.title !== undefined);
      const descTag = meta.find((m) => m.name === "description");
      const ogTitleTag = meta.find((m) => m.property === "og:title");
      const ogDescTag = meta.find((m) => m.property === "og:description");

      expect(titleTag?.title).toBe("InnoTech Showcase — Learn, Build, Grow");
      expect(descTag?.content).toBe("A world-class digital showcase of interactive web applications.");
      expect(ogTitleTag?.content).toBe("InnoTech Showcase — Learn, Build, Grow");
      expect(ogDescTag?.content).toBe("A world-class digital showcase of interactive web applications.");
    });

    it("uses safe fallback title and description when settings are missing or blank", () => {
      const { meta } = getPublicMetaTags(null);

      const titleTag = meta.find((m) => m.title !== undefined);
      const descTag = meta.find((m) => m.name === "description");

      expect(titleTag?.title).toBe(`${DEFAULT_PUBLIC_SITE_SETTINGS.siteName} — Learn, Build, Grow`);
      expect(descTag?.content).toBe(DEFAULT_PUBLIC_SITE_SETTINGS.siteDescription);
    });
  });

  describe("3. Open Graph Image Resolution & Fallback Behavior", () => {
    it("emits custom Open Graph image when a valid URL is provided", () => {
      const settings: PublicSiteSettings = {
        ...DEFAULT_PUBLIC_SITE_SETTINGS,
        ogImageUrl: "https://images.example.com/banner-1200x630.png",
      };

      const { meta } = getPublicMetaTags(settings);
      const ogImageTag = meta.find((m) => m.property === "og:image");
      const twitterImageTag = meta.find((m) => m.name === "twitter:image");

      expect(ogImageTag?.content).toBe("https://images.example.com/banner-1200x630.png");
      expect(twitterImageTag?.content).toBe("https://images.example.com/banner-1200x630.png");
    });

    it("emits root-relative path when configured as a relative URL", () => {
      const settings: PublicSiteSettings = {
        ...DEFAULT_PUBLIC_SITE_SETTINGS,
        ogImageUrl: "/static/social-share.jpg",
      };

      const { meta } = getPublicMetaTags(settings);
      const ogImageTag = meta.find((m) => m.property === "og:image");
      expect(ogImageTag?.content).toBe("/static/social-share.jpg");
    });

    it("falls back to default brand image when ogImageUrl is null, empty, or invalid", () => {
      expect(resolveOgImageUrl(null)).toBe(DEFAULT_OG_IMAGE);
      expect(resolveOgImageUrl("")).toBe(DEFAULT_OG_IMAGE);
      expect(resolveOgImageUrl("   ")).toBe(DEFAULT_OG_IMAGE);
      expect(resolveOgImageUrl("javascript:alert(1)")).toBe(DEFAULT_OG_IMAGE);
      expect(resolveOgImageUrl("data:image/png;base64,123")).toBe(DEFAULT_OG_IMAGE);

      const { meta } = getPublicMetaTags({
        ...DEFAULT_PUBLIC_SITE_SETTINGS,
        ogImageUrl: null,
      });

      const ogImageTag = meta.find((m) => m.property === "og:image");
      expect(ogImageTag?.content).toBe(DEFAULT_OG_IMAGE);
    });
  });

  describe("4. Meta Keywords Tag Generation", () => {
    it("emits comma-separated keywords meta tag when keywords are configured", () => {
      const settings: PublicSiteSettings = {
        ...DEFAULT_PUBLIC_SITE_SETTINGS,
        metaKeywords: ["NextGen", "Robotics", "Web3 Showcase", "AI"],
      };

      const { meta } = getPublicMetaTags(settings);
      const keywordsTag = meta.find((m) => m.name === "keywords");

      expect(keywordsTag).toBeDefined();
      expect(keywordsTag?.content).toBe("NextGen, Robotics, Web3 Showcase, AI");
    });

    it("omits keywords meta tag when array is empty or contains only whitespace", () => {
      const emptySettings: PublicSiteSettings = {
        ...DEFAULT_PUBLIC_SITE_SETTINGS,
        metaKeywords: [],
      };

      const { meta } = getPublicMetaTags(emptySettings);
      const keywordsTag = meta.find((m) => m.name === "keywords");
      expect(keywordsTag).toBeUndefined();

      const whitespaceSettings: PublicSiteSettings = {
        ...DEFAULT_PUBLIC_SITE_SETTINGS,
        metaKeywords: ["   ", ""],
      };
      const { meta: wsMeta } = getPublicMetaTags(whitespaceSettings);
      expect(wsMeta.find((m) => m.name === "keywords")).toBeUndefined();
    });
  });

  describe("5. Canonical URL Generation & Normalization", () => {
    it("generates normalized canonical link when siteUrl is valid", () => {
      expect(normalizeCanonicalUrl("https://cobralearn.com")).toBe("https://cobralearn.com");
      expect(normalizeCanonicalUrl("https://cobralearn.com/")).toBe("https://cobralearn.com");
      expect(normalizeCanonicalUrl("https://cobralearn.com?ref=twitter#header")).toBe("https://cobralearn.com");

      const settings: PublicSiteSettings = {
        ...DEFAULT_PUBLIC_SITE_SETTINGS,
        siteUrl: "https://cobralearn.com",
      };

      const { links } = getPublicMetaTags(settings);
      const canonical = links.find((l) => l.rel === "canonical");

      expect(canonical).toBeDefined();
      expect(canonical?.href).toBe("https://cobralearn.com");
    });

    it("omits canonical link when siteUrl is invalid, non-http, or empty", () => {
      expect(normalizeCanonicalUrl("not-a-url")).toBeNull();
      expect(normalizeCanonicalUrl("ftp://example.com")).toBeNull();
      expect(normalizeCanonicalUrl("")).toBeNull();
      expect(normalizeCanonicalUrl(null)).toBeNull();

      const { links } = getPublicMetaTags({
        ...DEFAULT_PUBLIC_SITE_SETTINGS,
        siteUrl: "invalid-url",
      });

      const canonical = links.find((l) => l.rel === "canonical");
      expect(canonical).toBeUndefined();
    });
  });

  describe("6. Route-Specific Metadata Preservation", () => {
    it("preserves Contact page route-specific SEO and does not overwrite it", async () => {
      // Import contact route head function
      const contactRoute = await import("@/routes/contact");
      const headFn = (contactRoute.Route as any).options.head;

      const mockLoaderData = {
        publicContactData: {
          seo: {
            pageTitle: "Custom Contact Us Title",
            metaDescription: "Custom Contact Us Description",
          },
        },
      };

      const headResult = headFn({ loaderData: mockLoaderData });
      const titleTag = headResult.meta.find((m: any) => m.title !== undefined);
      const descTag = headResult.meta.find((m: any) => m.name === "description");

      // Verifies route-specific contact SEO takes precedence
      expect(titleTag?.title).toBe("Custom Contact Us Title");
      expect(descTag?.content).toBe("Custom Contact Us Description");
    });

    it("preserves Project Detail page route-specific SEO", async () => {
      const projectSlugRoute = await import("@/routes/projects/$slug");
      const headFn = (projectSlugRoute.Route as any).options.head;

      const mockLoaderData = {
        title: "Autonomous Drone System",
        description: "An advanced aerial robotic delivery platform.",
      };

      const headResult = headFn({ loaderData: mockLoaderData });
      const titleTag = headResult.meta.find((m: any) => m.title !== undefined);
      const descTag = headResult.meta.find((m: any) => m.name === "description");

      expect(titleTag?.title).toBe("Autonomous Drone System — CobraLearn");
      expect(descTag?.content).toBe("An advanced aerial robotic delivery platform.");
    });
  });

  describe("7. Existing Contact Details Integration Preservation", () => {
    it("continues to consume siteSettings contact info in getPublicContactConfigOperation", async () => {
      const mockPrisma = {
        contactPageConfig: {
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            badgeText: "CONNECT WITH US",
            heroTitle: "Let's Build Together",
            highlights: [],
            faqs: [],
            socialLinks: [],
          }),
        },
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            contactEmail: "persisted@cobralearn.com",
            contactPhone: "+1 (555) 019-2834",
            contactAddress: "742 Evergreen Terrace, Springfield",
            businessHours: "Mon - Fri: 8:00 AM - 5:00 PM EST",
          }),
        },
      } as any;

      const result = await getPublicContactConfigOperation(mockPrisma);

      expect(result.contactInfo.email).toBe("persisted@cobralearn.com");
      expect(result.contactInfo.phone).toBe("+1 (555) 019-2834");
      expect(result.contactInfo.location).toBe("742 Evergreen Terrace, Springfield");
      expect(result.contactInfo.businessHours).toBe("Mon - Fri: 8:00 AM - 5:00 PM EST");
    });
  });

  describe("8. adminClient.getPublicSiteSettings Resilience", () => {
    it("returns data successfully from the server function", async () => {
      const testSettings: PublicSiteSettings = {
        siteName: "Live Portal",
        siteDescription: "Live description",
        ogImageUrl: "https://example.com/og.jpg",
        metaKeywords: ["live"],
        siteUrl: "https://example.com",
      };

      vi.mocked(getPublicSiteSettingsServerFn).mockResolvedValueOnce({
        settings: testSettings,
      });

      const res = await adminClient.getPublicSiteSettings();
      expect(res.success).toBe(true);
      expect(res.data).toEqual(testSettings);
    });

    it("safely falls back to DEFAULT_PUBLIC_SITE_SETTINGS when server function rejects", async () => {
      vi.mocked(getPublicSiteSettingsServerFn).mockRejectedValueOnce(
        new Error("Network connection failure")
      );

      const res = await adminClient.getPublicSiteSettings();
      expect(res.success).toBe(true);
      expect(res.data).toEqual(DEFAULT_PUBLIC_SITE_SETTINGS);
    });
  });
});
