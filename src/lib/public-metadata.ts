/**
 * Public Site Settings & Metadata Utilities (Phase 2E)
 * Pure client/server-safe utilities for public website metadata consumption.
 * Does not import Prisma or server-only modules.
 */

export interface PublicSiteSettings {
  siteName: string;
  siteDescription: string;
  ogImageUrl: string | null;
  metaKeywords: string[];
  siteUrl: string;
}

export const DEFAULT_OG_IMAGE = "/cobralearn-official-logo.png";

export const DEFAULT_PUBLIC_SITE_SETTINGS: PublicSiteSettings = {
  siteName: "CobraLearn Innotechcore",
  siteDescription: "CobraLearn creates innovative projects, websites, campaigns and awards for the next generation of digital builders.",
  ogImageUrl: null,
  metaKeywords: ["technology", "showcase", "web development", "digital innovation"],
  siteUrl: "https://cobralearn.com",
};

/**
 * Validates and resolves an Open Graph image URL.
 * Accepts valid absolute HTTP(S) URLs or root-relative paths.
 * Returns the default brand image when absent, empty, or invalid.
 */
export function resolveOgImageUrl(ogImageUrl?: string | null): string {
  if (ogImageUrl && typeof ogImageUrl === "string") {
    const trimmed = ogImageUrl.trim();
    if (trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }
  return DEFAULT_OG_IMAGE;
}

/**
 * Normalizes a base site URL and path into a clean, safe canonical URL string.
 * Strictly verifies the protocol (http/https) and strips query params/fragments.
 * Returns null if the URL is invalid or malformed.
 */
export function normalizeCanonicalUrl(baseUrl?: string | null, path: string = "/"): string | null {
  if (!baseUrl || typeof baseUrl !== "string") return null;
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    url.pathname = cleanPath === "/" ? "" : cleanPath;
    url.search = "";
    url.hash = "";
    return cleanPath === "/" ? url.origin : `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export interface MetaTagItem {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
}

export interface LinkTagItem {
  rel: string;
  href: string;
}

/**
 * Assembles metadata tags and link tags for public website consumption.
 * Integrates existing persisted settings (siteName, siteDescription, ogImageUrl, metaKeywords, siteUrl)
 * with robust fallbacks to ensure public routes never fail to render.
 */
export function getPublicMetaTags(settings?: PublicSiteSettings | null): {
  meta: MetaTagItem[];
  links: LinkTagItem[];
} {
  const effective = settings || DEFAULT_PUBLIC_SITE_SETTINGS;
  const siteName = (effective.siteName && effective.siteName.trim()) || DEFAULT_PUBLIC_SITE_SETTINGS.siteName;
  const siteDescription =
    (effective.siteDescription && effective.siteDescription.trim()) || DEFAULT_PUBLIC_SITE_SETTINGS.siteDescription;
  const ogImage = resolveOgImageUrl(effective.ogImageUrl);

  const pageTitle = `${siteName} — Learn, Build, Grow`;

  const meta: MetaTagItem[] = [
    { title: pageTitle },
    { name: "description", content: siteDescription },
    { property: "og:title", content: pageTitle },
    { property: "og:description", content: siteDescription },
    { property: "og:image", content: ogImage },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: ogImage },
  ];

  if (Array.isArray(effective.metaKeywords) && effective.metaKeywords.length > 0) {
    const keywordsContent = effective.metaKeywords
      .map((k) => (typeof k === "string" ? k.trim() : ""))
      .filter(Boolean)
      .join(", ");
    if (keywordsContent) {
      meta.push({ name: "keywords", content: keywordsContent });
    }
  }

  const links: LinkTagItem[] = [];
  const canonicalUrl = normalizeCanonicalUrl(effective.siteUrl, "/");
  if (canonicalUrl) {
    links.push({ rel: "canonical", href: canonicalUrl });
  }

  return { meta, links };
}
