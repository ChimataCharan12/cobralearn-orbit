import { z } from "zod";

export const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

/**
 * Strict Zod schema for updating SiteSettings.
 * Rejects unrecognized fields (including id, updatedAt) and enforces constraints.
 */
export const updateSiteSettingsSchema = z
  .object({
    siteName: z
      .string({ invalid_type_error: "Site name must be a string" })
      .trim()
      .min(1, "Site name cannot be empty")
      .max(100, "Site name cannot exceed 100 characters")
      .optional(),
    tagline: z
      .string({ invalid_type_error: "Tagline must be a string" })
      .trim()
      .max(200, "Tagline cannot exceed 200 characters")
      .optional(),
    siteDescription: z
      .string({ invalid_type_error: "Site description must be a string" })
      .trim()
      .max(1000, "Site description cannot exceed 1000 characters")
      .optional(),
    siteUrl: z
      .string({ invalid_type_error: "Site URL must be a string" })
      .trim()
      .url("Invalid site URL format (must be a valid URL)")
      .max(500, "Site URL cannot exceed 500 characters")
      .optional(),
    contactEmail: z
      .string({ invalid_type_error: "Contact email must be a string" })
      .trim()
      .email("Invalid contact email format")
      .max(255, "Contact email cannot exceed 255 characters")
      .optional(),
    contactPhone: z
      .string({ invalid_type_error: "Contact phone must be a string" })
      .trim()
      .max(50, "Contact phone cannot exceed 50 characters")
      .optional(),
    contactAddress: z
      .string({ invalid_type_error: "Contact address must be a string" })
      .trim()
      .max(300, "Contact address cannot exceed 300 characters")
      .optional(),
    businessHours: z
      .string({ invalid_type_error: "Business hours must be a string" })
      .trim()
      .max(100, "Business hours cannot exceed 100 characters")
      .optional(),
    timezone: z
      .string({ invalid_type_error: "Timezone must be a string" })
      .trim()
      .max(100, "Timezone cannot exceed 100 characters")
      .optional(),
    dateFormat: z
      .string({ invalid_type_error: "Date format must be a string" })
      .trim()
      .max(50, "Date format cannot exceed 50 characters")
      .optional(),
    timeFormat: z
      .string({ invalid_type_error: "Time format must be a string" })
      .trim()
      .max(50, "Time format cannot exceed 50 characters")
      .optional(),
    defaultLanguage: z
      .string({ invalid_type_error: "Default language must be a string" })
      .trim()
      .max(20, "Default language cannot exceed 20 characters")
      .optional(),
    metaKeywords: z
      .array(z.string().trim().max(100), { invalid_type_error: "Meta keywords must be an array of strings" })
      .max(50, "Cannot specify more than 50 keywords")
      .optional(),
    ogImageUrl: z
      .string({ invalid_type_error: "OG image URL must be a string or null" })
      .trim()
      .max(1000, "OG image URL cannot exceed 1000 characters")
      .refine(
        (val) => val === "" || val.startsWith("/") || /^https?:\/\//i.test(val),
        { message: "OG image URL must be a valid HTTP(S) URL or root-relative path" }
      )
      .nullable()
      .optional(),
    notifyOnNewMessage: z
      .boolean({ invalid_type_error: "Notify on new message must be a boolean" })
      .optional(),
    notificationEmail: z
      .string({ invalid_type_error: "Notification email must be a string or null" })
      .trim()
      .email("Invalid notification email format")
      .max(255, "Notification email cannot exceed 255 characters")
      .nullable()
      .optional(),
  })
  .strict({ message: "Unrecognized field provided in Site Settings update payload" });

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;

/**
 * Strict Zod schema for updating AppearanceConfig.
 * Rejects unrecognized fields (including id, updatedAt) and validates visual tokens.
 */
export const updateAppearanceConfigSchema = z
  .object({
    themePreset: z
      .string({ invalid_type_error: "Theme preset must be a string" })
      .trim()
      .min(1, "Theme preset cannot be empty")
      .max(50, "Theme preset cannot exceed 50 characters")
      .optional(),
    brandPrimaryColor: z
      .string({ invalid_type_error: "Brand primary color must be a string" })
      .trim()
      .regex(HEX_COLOR_REGEX, "Brand primary color must be a valid hex color code (e.g. #00FF87 or #0F8)")
      .optional(),
    brandSecondaryColor: z
      .string({ invalid_type_error: "Brand secondary color must be a string" })
      .trim()
      .regex(HEX_COLOR_REGEX, "Brand secondary color must be a valid hex color code (e.g. #00E5FF or #0EF)")
      .optional(),
    brandAccentColor: z
      .string({ invalid_type_error: "Brand accent color must be a string" })
      .trim()
      .regex(HEX_COLOR_REGEX, "Brand accent color must be a valid hex color code (e.g. #FFB800 or #FB0)")
      .optional(),
    fontHeading: z
      .string({ invalid_type_error: "Heading font must be a string" })
      .trim()
      .min(1, "Heading font cannot be empty")
      .max(100, "Heading font cannot exceed 100 characters")
      .optional(),
    fontBody: z
      .string({ invalid_type_error: "Body font must be a string" })
      .trim()
      .min(1, "Body font cannot be empty")
      .max(100, "Body font cannot exceed 100 characters")
      .optional(),
    logoAssetId: z
      .string({ invalid_type_error: "Logo asset ID must be a string or null" })
      .trim()
      .max(100, "Logo asset ID cannot exceed 100 characters")
      .nullable()
      .optional(),
    faviconAssetId: z
      .string({ invalid_type_error: "Favicon asset ID must be a string or null" })
      .trim()
      .max(100, "Favicon asset ID cannot exceed 100 characters")
      .nullable()
      .optional(),
    enableGlowEffects: z
      .boolean({ invalid_type_error: "Enable glow effects must be a boolean" })
      .optional(),
    enableAnimations: z
      .boolean({ invalid_type_error: "Enable animations must be a boolean" })
      .optional(),
  })
  .strict({ message: "Unrecognized field provided in Appearance update payload" });

export type UpdateAppearanceConfigInput = z.infer<typeof updateAppearanceConfigSchema>;
