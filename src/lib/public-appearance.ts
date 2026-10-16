/**
 * Public Appearance Runtime Configuration & CSS Generator (Phase 2)
 * Client and server safe — pure utilities for public appearance consumption.
 * Does not import Prisma or server-only modules.
 */

export interface PublicAppearanceConfig {
  themePreset: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandAccentColor: string;
  fontHeading: string;
  fontBody: string;
  enableAnimations: boolean;
  enableGlowEffects: boolean;
  logoUrl: string | null;
  faviconUrl: string | null;
}

export const DEFAULT_PUBLIC_APPEARANCE_CONFIG: PublicAppearanceConfig = {
  themePreset: "dark",
  brandPrimaryColor: "#00FF87",
  brandSecondaryColor: "#00E5FF",
  brandAccentColor: "#FFB800",
  fontHeading: "Orbitron",
  fontBody: "Rajdhani",
  enableAnimations: true,
  enableGlowEffects: true,
  logoUrl: null,
  faviconUrl: null,
};

export const SUPPORTED_PUBLIC_FONTS = new Set([
  "Orbitron",
  "Oxanium",
  "Rajdhani",
  "Space Grotesk",
  "Inter",
]);

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Validates and sanitizes a hex color code.
 * Falls back to safe default if invalid, empty, or malicious.
 */
export function sanitizeColor(color: string | undefined | null, fallback: string): string {
  if (!color || typeof color !== "string") return fallback;
  const trimmed = color.trim();
  if (HEX_COLOR_REGEX.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

/**
 * Validates a font family against the supported Google Fonts loaded in __root.tsx.
 * Falls back to safe default if invalid, empty, or unsupported.
 */
export function sanitizeFont(font: string | undefined | null, fallback: string): string {
  if (!font || typeof font !== "string") return fallback;
  const trimmed = font.trim();
  if (SUPPORTED_PUBLIC_FONTS.has(trimmed)) {
    return trimmed;
  }
  return fallback;
}

/**
 * Validates and resolves an asset URL (logo or favicon).
 * Accepts absolute HTTP(S) URLs or root-relative paths.
 * Returns null if invalid.
 */
export function sanitizeAssetUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Generates scoped CSS rules for public website consumption.
 * Strictly scopes all styles to .site-shell, .detail-page, and .floating-contact-btn.
 * NEVER affects admin routes or admin portal styles.
 */
export function generatePublicAppearanceCss(config?: Partial<PublicAppearanceConfig> | null): string {
  const effective = { ...DEFAULT_PUBLIC_APPEARANCE_CONFIG, ...config };

  const primary = sanitizeColor(effective.brandPrimaryColor, DEFAULT_PUBLIC_APPEARANCE_CONFIG.brandPrimaryColor);
  const secondary = sanitizeColor(effective.brandSecondaryColor, DEFAULT_PUBLIC_APPEARANCE_CONFIG.brandSecondaryColor);
  const accent = sanitizeColor(effective.brandAccentColor, DEFAULT_PUBLIC_APPEARANCE_CONFIG.brandAccentColor);

  const fontHeading = sanitizeFont(effective.fontHeading, DEFAULT_PUBLIC_APPEARANCE_CONFIG.fontHeading);
  const fontBody = sanitizeFont(effective.fontBody, DEFAULT_PUBLIC_APPEARANCE_CONFIG.fontBody);

  const enableAnimations = effective.enableAnimations ?? true;
  const enableGlowEffects = effective.enableGlowEffects ?? true;

  const lines: string[] = [
    `/* CobraLearn Public Appearance Dynamic Tokens (Scoped) */`,
    `.site-shell, .detail-page, .floating-contact-btn {`,
    `  --brand-primary: ${primary};`,
    `  --brand-secondary: ${secondary};`,
    `  --brand-accent: ${accent};`,
    `  --neon-green: var(--brand-primary);`,
    `  --cyan: var(--brand-secondary);`,
    `  --gold: var(--brand-accent);`,
    `  --brand-bright: var(--brand-primary);`,
    `  --brand: var(--brand-primary);`,
    `  --brand-cyan: var(--brand-secondary);`,
    `  --brand-gold: var(--brand-accent);`,
    `  --font-display: "${fontHeading}", sans-serif;`,
    `  --font-sans: "${fontBody}", sans-serif;`,
    `  font-family: var(--font-sans);`,
    `}`,
    `.site-shell h1, .site-shell h2, .site-shell h3, .site-shell h4, .site-shell h5, .site-shell h6,`,
    `.detail-page h1, .detail-page h2, .detail-page h3, .detail-page h4, .detail-page h5, .detail-page h6 {`,
    `  font-family: var(--font-display);`,
    `}`,
    `.floating-contact-btn {`,
    `  --section-accent: var(--brand-primary);`,
    `}`,
    `.floating-contact-dot {`,
    `  background: var(--brand-accent) !important;`,
    `  box-shadow: 0 0 8px var(--brand-accent), 0 0 14px var(--brand-accent) !important;`,
    `}`,
  ];

  // Disable non-essential animations when toggle is off
  if (!enableAnimations) {
    lines.push(
      `/* Non-essential animations disabled via AppearanceConfig */`,
      `.site-shell *, .detail-page *, .floating-contact-btn *,`,
      `.site-shell, .detail-page, .floating-contact-btn {`,
      `  animation-duration: 0.001ms !important;`,
      `  animation-iteration-count: 1 !important;`,
      `  transition-duration: 0.001ms !important;`,
      `}`
    );
  }

  // Disable decorative neon glows when toggle is off
  if (!enableGlowEffects) {
    lines.push(
      `/* Decorative glow effects disabled via AppearanceConfig */`,
      `.site-shell, .site-shell *, .detail-page, .detail-page *, .floating-contact-btn, .floating-contact-btn * {`,
      `  text-shadow: none !important;`,
      `}`,
      `.site-shell .section-atmosphere::after,`,
      `.site-shell .section-number i,`,
      `.site-shell .section-button,`,
      `.site-shell .brand-glow,`,
      `.site-shell .portal-button-glow,`,
      `.detail-page .brand-glow,`,
      `.detail-page .portal-button-glow {`,
      `  box-shadow: none !important;`,
      `  filter: none !important;`,
      `}`,
      `.floating-contact-btn {`,
      `  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8) !important;`,
      `}`,
      `.floating-contact-btn:hover {`,
      `  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.9) !important;`,
      `}`,
      `.floating-contact-dot {`,
      `  box-shadow: none !important;`,
      `}`
    );
  }

  return lines.join("\n");
}
