import { z } from "zod";

export const SUPPORTED_THEMES = ["dark"] as const;
export type ThemeOption = (typeof SUPPORTED_THEMES)[number];

export const SUPPORTED_ACCENTS = [
  "emerald",
  "cyan",
  "purple",
  "orange",
  "red",
  "blue",
] as const;
export type AccentOption = (typeof SUPPORTED_ACCENTS)[number];

export const SUPPORTED_LANGUAGES = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
] as const;
export type LanguageOption = (typeof SUPPORTED_LANGUAGES)[number];

export const SUPPORTED_TIMEZONES = [
  "(GMT+5:30) Asia/Kolkata",
  "(GMT+0:00) UTC",
  "(GMT-5:00) America/New_York",
  "(GMT-8:00) America/Los_Angeles",
  "(GMT+0:00) Europe/London",
  "(GMT+8:00) Asia/Singapore",
  "(GMT+9:00) Asia/Tokyo",
] as const;
export type TimezoneOption = (typeof SUPPORTED_TIMEZONES)[number];

export interface AdminNotificationPreferences {
  emailNotifications: boolean;
  contentUpdates: boolean;
  securityAlerts: boolean;
  systemAnnouncements: boolean;
  adminActivities: boolean;
  contactInquiries: boolean;
  marketingUpdates: boolean;
}

export interface AdminPortalPreferences {
  theme: ThemeOption;
  selectedAccent: AccentOption;
  sidebarCollapse: boolean;
  language: LanguageOption;
  timezone: TimezoneOption;
}

export interface AdminPreferences {
  notifications: AdminNotificationPreferences;
  portal: AdminPortalPreferences;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: AdminNotificationPreferences = {
  emailNotifications: true,
  contentUpdates: true,
  securityAlerts: true,
  systemAnnouncements: true,
  adminActivities: true,
  contactInquiries: true,
  marketingUpdates: false,
};

export const DEFAULT_PORTAL_PREFERENCES: AdminPortalPreferences = {
  theme: "dark",
  selectedAccent: "emerald",
  sidebarCollapse: false,
  language: "English",
  timezone: "(GMT+5:30) Asia/Kolkata",
};

export const DEFAULT_ADMIN_PREFERENCES: AdminPreferences = {
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  portal: DEFAULT_PORTAL_PREFERENCES,
};

export const MAX_PREFERENCES_PAYLOAD_BYTES = 4096; // 4 KB limit

export const notificationPreferencesSchema = z
  .object({
    emailNotifications: z.boolean().optional(),
    contentUpdates: z.boolean().optional(),
    securityAlerts: z.boolean().optional(),
    systemAnnouncements: z.boolean().optional(),
    adminActivities: z.boolean().optional(),
    contactInquiries: z.boolean().optional(),
    marketingUpdates: z.boolean().optional(),
  })
  .strict();

export const portalPreferencesSchema = z
  .object({
    theme: z.enum(SUPPORTED_THEMES).optional(),
    selectedAccent: z.enum(SUPPORTED_ACCENTS).optional(),
    sidebarCollapse: z.boolean().optional(),
    language: z.enum(SUPPORTED_LANGUAGES).optional(),
    timezone: z.enum(SUPPORTED_TIMEZONES).optional(),
  })
  .strict();

export const updatePreferencesPayloadSchema = z
  .object({
    notifications: notificationPreferencesSchema.optional(),
    portal: portalPreferencesSchema.optional(),
  })
  .strict();

export type UpdatePreferencesPayload = z.infer<typeof updatePreferencesPayloadSchema>;

/**
 * Safely merges a raw (or partial/legacy) preferences object with canonical defaults.
 * Guarantees every expected field is populated with a valid, typed value.
 */
export function mergeWithDefaultPreferences(raw: unknown): AdminPreferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      portal: { ...DEFAULT_PORTAL_PREFERENCES },
    };
  }

  const obj = raw as Record<string, any>;
  const rawNotifs =
    obj.notifications && typeof obj.notifications === "object" && !Array.isArray(obj.notifications)
      ? obj.notifications
      : {};
  const rawPortal =
    obj.portal && typeof obj.portal === "object" && !Array.isArray(obj.portal)
      ? obj.portal
      : {};

  return {
    notifications: {
      emailNotifications:
        typeof rawNotifs.emailNotifications === "boolean"
          ? rawNotifs.emailNotifications
          : typeof obj.emailNotifications === "boolean"
          ? obj.emailNotifications
          : DEFAULT_NOTIFICATION_PREFERENCES.emailNotifications,
      contentUpdates:
        typeof rawNotifs.contentUpdates === "boolean"
          ? rawNotifs.contentUpdates
          : typeof obj.contentUpdates === "boolean"
          ? obj.contentUpdates
          : DEFAULT_NOTIFICATION_PREFERENCES.contentUpdates,
      securityAlerts:
        typeof rawNotifs.securityAlerts === "boolean"
          ? rawNotifs.securityAlerts
          : typeof obj.securityAlerts === "boolean"
          ? obj.securityAlerts
          : DEFAULT_NOTIFICATION_PREFERENCES.securityAlerts,
      systemAnnouncements:
        typeof rawNotifs.systemAnnouncements === "boolean"
          ? rawNotifs.systemAnnouncements
          : typeof obj.systemAnnouncements === "boolean"
          ? obj.systemAnnouncements
          : DEFAULT_NOTIFICATION_PREFERENCES.systemAnnouncements,
      adminActivities:
        typeof rawNotifs.adminActivities === "boolean"
          ? rawNotifs.adminActivities
          : typeof obj.adminActivities === "boolean"
          ? obj.adminActivities
          : DEFAULT_NOTIFICATION_PREFERENCES.adminActivities,
      contactInquiries:
        typeof rawNotifs.contactInquiries === "boolean"
          ? rawNotifs.contactInquiries
          : typeof obj.contactInquiries === "boolean"
          ? obj.contactInquiries
          : DEFAULT_NOTIFICATION_PREFERENCES.contactInquiries,
      marketingUpdates:
        typeof rawNotifs.marketingUpdates === "boolean"
          ? rawNotifs.marketingUpdates
          : typeof obj.marketingUpdates === "boolean"
          ? obj.marketingUpdates
          : DEFAULT_NOTIFICATION_PREFERENCES.marketingUpdates,
    },
    portal: {
      theme: (SUPPORTED_THEMES as readonly string[]).includes(rawPortal.theme ?? obj.theme)
        ? ((rawPortal.theme ?? obj.theme) as ThemeOption)
        : DEFAULT_PORTAL_PREFERENCES.theme,
      selectedAccent: SUPPORTED_ACCENTS.includes(rawPortal.selectedAccent ?? obj.selectedAccent)
        ? (rawPortal.selectedAccent ?? obj.selectedAccent)
        : DEFAULT_PORTAL_PREFERENCES.selectedAccent,
      sidebarCollapse:
        typeof (rawPortal.sidebarCollapse ?? obj.sidebarCollapse) === "boolean"
          ? (rawPortal.sidebarCollapse ?? obj.sidebarCollapse)
          : DEFAULT_PORTAL_PREFERENCES.sidebarCollapse,
      language: SUPPORTED_LANGUAGES.includes(rawPortal.language ?? obj.language)
        ? (rawPortal.language ?? obj.language)
        : DEFAULT_PORTAL_PREFERENCES.language,
      timezone: SUPPORTED_TIMEZONES.includes(rawPortal.timezone ?? obj.timezone)
        ? (rawPortal.timezone ?? obj.timezone)
        : DEFAULT_PORTAL_PREFERENCES.timezone,
    },
  };
}
