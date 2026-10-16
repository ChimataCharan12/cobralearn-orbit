import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import type { SiteSettings } from "@prisma/client";
import { adminClient } from "@/lib/api/admin-client";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import { canPerform, AdminPermissions } from "@/lib/auth/rbac";
import {
  updateSiteSettingsSchema,
  type UpdateSiteSettingsInput,
} from "@/lib/validation/settings-schemas";

export interface SiteSettingsDraft {
  siteName: string;
  tagline: string;
  siteDescription: string;
  siteUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  businessHours: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  defaultLanguage: string;
  metaKeywords: string[];
  ogImageUrl: string | null;
  notifyOnNewMessage: boolean;
  notificationEmail: string | null;
}

export const DEFAULT_SITE_SETTINGS_DRAFT: SiteSettingsDraft = {
  siteName: "CobraLearn Innotechcore",
  tagline: "Digital Showcase & Technology Hub",
  siteDescription:
    "A cinematic showcase of digital innovation, web experiences, real-time projects and achievements.",
  siteUrl: "https://cobralearn.com",
  contactEmail: "contact@cobralearn.com",
  contactPhone: "+91 98765 43210",
  contactAddress: "Hyderabad, Telangana, India",
  businessHours: "Mon - Fri: 9:00 AM - 6:00 PM IST",
  timezone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12-hour",
  defaultLanguage: "en",
  metaKeywords: ["technology", "showcase", "web development", "digital innovation"],
  ogImageUrl: null,
  notifyOnNewMessage: true,
  notificationEmail: null,
};

export function mapSiteSettingsToDraft(data: Partial<SiteSettings> | null | undefined): SiteSettingsDraft {
  if (!data) return { ...DEFAULT_SITE_SETTINGS_DRAFT };
  return {
    siteName: data.siteName ?? DEFAULT_SITE_SETTINGS_DRAFT.siteName,
    tagline: data.tagline ?? DEFAULT_SITE_SETTINGS_DRAFT.tagline,
    siteDescription: data.siteDescription ?? DEFAULT_SITE_SETTINGS_DRAFT.siteDescription,
    siteUrl: data.siteUrl ?? DEFAULT_SITE_SETTINGS_DRAFT.siteUrl,
    contactEmail: data.contactEmail ?? DEFAULT_SITE_SETTINGS_DRAFT.contactEmail,
    contactPhone: data.contactPhone ?? DEFAULT_SITE_SETTINGS_DRAFT.contactPhone,
    contactAddress: data.contactAddress ?? DEFAULT_SITE_SETTINGS_DRAFT.contactAddress,
    businessHours: data.businessHours ?? DEFAULT_SITE_SETTINGS_DRAFT.businessHours,
    timezone: data.timezone ?? DEFAULT_SITE_SETTINGS_DRAFT.timezone,
    dateFormat: data.dateFormat ?? DEFAULT_SITE_SETTINGS_DRAFT.dateFormat,
    timeFormat: data.timeFormat ?? DEFAULT_SITE_SETTINGS_DRAFT.timeFormat,
    defaultLanguage: data.defaultLanguage ?? DEFAULT_SITE_SETTINGS_DRAFT.defaultLanguage,
    metaKeywords: Array.isArray(data.metaKeywords) ? [...data.metaKeywords] : [...DEFAULT_SITE_SETTINGS_DRAFT.metaKeywords],
    ogImageUrl: data.ogImageUrl ?? null,
    notifyOnNewMessage: typeof data.notifyOnNewMessage === "boolean" ? data.notifyOnNewMessage : DEFAULT_SITE_SETTINGS_DRAFT.notifyOnNewMessage,
    notificationEmail: data.notificationEmail ?? null,
  };
}

export function isDraftEqual(a: SiteSettingsDraft, b: SiteSettingsDraft): boolean {
  if (
    a.siteName !== b.siteName ||
    a.tagline !== b.tagline ||
    a.siteDescription !== b.siteDescription ||
    a.siteUrl !== b.siteUrl ||
    a.contactEmail !== b.contactEmail ||
    a.contactPhone !== b.contactPhone ||
    a.contactAddress !== b.contactAddress ||
    a.businessHours !== b.businessHours ||
    a.timezone !== b.timezone ||
    a.dateFormat !== b.dateFormat ||
    a.timeFormat !== b.timeFormat ||
    a.defaultLanguage !== b.defaultLanguage ||
    a.ogImageUrl !== b.ogImageUrl ||
    a.notifyOnNewMessage !== b.notifyOnNewMessage ||
    a.notificationEmail !== b.notificationEmail
  ) {
    return false;
  }
  if (a.metaKeywords.length !== b.metaKeywords.length) return false;
  for (let i = 0; i < a.metaKeywords.length; i++) {
    if (a.metaKeywords[i] !== b.metaKeywords[i]) return false;
  }
  return true;
}

export interface SiteSettingsContextValue {
  draft: SiteSettingsDraft;
  savedSettings: SiteSettings | null;
  updateDraft: <K extends keyof SiteSettingsDraft>(field: K, value: SiteSettingsDraft[K]) => void;
  updateDrafts: (partial: Partial<SiteSettingsDraft>) => void;
  isLoading: boolean;
  loadError: string | null;
  retryLoad: () => void;
  isSaving: boolean;
  saveSettings: () => Promise<boolean>;
  resetSettings: () => void;
  canUpdateSettings: boolean;
  hasUnsavedChanges: boolean;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

export function SiteSettingsProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: SiteSettings | null;
}) {
  const { profile } = useAdminProfile();
  const canUpdateSettings = profile?.role
    ? canPerform(profile.role, AdminPermissions.SETTINGS_UPDATE)
    : false;

  const [savedSettings, setSavedSettings] = useState<SiteSettings | null>(initialData || null);
  const [savedSnapshot, setSavedSnapshot] = useState<SiteSettingsDraft>(() =>
    mapSiteSettingsToDraft(initialData)
  );
  const [draft, setDraft] = useState<SiteSettingsDraft>(() =>
    mapSiteSettingsToDraft(initialData)
  );

  const [isLoading, setIsLoading] = useState(!initialData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const requestIdRef = useRef(0);
  const isDirtyRef = useRef(false);

  // Check whether user has unsaved modifications
  const hasUnsavedChanges = !isDraftEqual(draft, savedSnapshot);

  const updateDraft = useCallback(<K extends keyof SiteSettingsDraft>(field: K, value: SiteSettingsDraft[K]) => {
    isDirtyRef.current = true;
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateDrafts = useCallback((partial: Partial<SiteSettingsDraft>) => {
    isDirtyRef.current = true;
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  // Fetch settings from server
  const loadSettings = useCallback(async () => {
    const currentId = ++requestIdRef.current;
    setIsLoading(true);
    setLoadError(null);

    try {
      const res = await adminClient.getSiteSettings();

      // Prevent stale response if another request was triggered
      if (currentId !== requestIdRef.current) return;

      if (res.success) {
        const loaded = res.data ?? null;
        setSavedSettings(loaded);
        const mapped = mapSiteSettingsToDraft(loaded);
        setSavedSnapshot(mapped);

        // Only populate draft if user hasn't already modified the draft
        if (!isDirtyRef.current) {
          setDraft(mapped);
        }
        setIsLoading(false);
      } else {
        setLoadError(res.error || "Failed to load site settings from server");
        setIsLoading(false);
      }
    } catch (err: unknown) {
      if (currentId !== requestIdRef.current) return;
      const msg = err instanceof Error ? err.message : "Failed to load site settings";
      setLoadError(msg);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      loadSettings();
    }
  }, [initialData, loadSettings]);

  const retryLoad = useCallback(() => {
    isDirtyRef.current = false;
    loadSettings();
  }, [loadSettings]);

  // Save changes to database
  const saveSettings = useCallback(async (): Promise<boolean> => {
    if (!canUpdateSettings) {
      toast.error("Forbidden: Modifying site configuration requires SUPER_ADMIN permissions.");
      return false;
    }

    if (isSaving) return false;

    // Build strictly allowlisted payload
    const rawPayload: UpdateSiteSettingsInput = {
      siteName: draft.siteName.trim(),
      tagline: draft.tagline.trim(),
      siteDescription: draft.siteDescription.trim(),
      siteUrl: draft.siteUrl.trim(),
      contactEmail: draft.contactEmail.trim(),
      contactPhone: draft.contactPhone.trim(),
      contactAddress: draft.contactAddress.trim(),
      businessHours: draft.businessHours.trim(),
      timezone: draft.timezone.trim(),
      dateFormat: draft.dateFormat.trim(),
      timeFormat: draft.timeFormat.trim(),
      defaultLanguage: draft.defaultLanguage.trim(),
      metaKeywords: draft.metaKeywords,
      ogImageUrl: draft.ogImageUrl ? draft.ogImageUrl.trim() : null,
      notifyOnNewMessage: draft.notifyOnNewMessage,
      notificationEmail: draft.notificationEmail ? draft.notificationEmail.trim() : null,
    };

    // Client-side schema pre-validation to match authoritative server boundary
    const parsed = updateSiteSettingsSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "settings"}: ${i.message}`)
        .join("; ");
      toast.error(`Validation Error: ${issues}`);
      return false;
    }

    setIsSaving(true);
    try {
      const res = await adminClient.updateSiteSettings(parsed.data);
      if (res.success && res.data) {
        setSavedSettings(res.data);
        const newSnapshot = mapSiteSettingsToDraft(res.data);
        setSavedSnapshot(newSnapshot);
        setDraft(newSnapshot);
        isDirtyRef.current = false;
        toast.success("Site settings saved successfully.");
        return true;
      } else {
        // Keep unsaved edits intact on error
        toast.error(res.error || "Failed to save site settings.");
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred while saving settings";
      toast.error(msg);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [canUpdateSettings, isSaving, draft]);

  // Reset to last saved snapshot
  const resetSettings = useCallback(() => {
    setDraft({ ...savedSnapshot });
    isDirtyRef.current = false;
    toast.info("Unsaved changes discarded. Restored to last saved settings.");
  }, [savedSnapshot]);

  const value: SiteSettingsContextValue = {
    draft,
    savedSettings,
    updateDraft,
    updateDrafts,
    isLoading,
    loadError,
    retryLoad,
    isSaving,
    saveSettings,
    resetSettings,
    canUpdateSettings,
    hasUnsavedChanges,
  };

  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

/**
 * Hook to consume Site Settings form state.
 * Returns safe fallback default state if used outside of SiteSettingsProvider (e.g. isolated tab unit tests).
 */
export function useSiteSettings(): SiteSettingsContextValue {
  const context = useContext(SiteSettingsContext);
  if (!context) {
    return {
      draft: { ...DEFAULT_SITE_SETTINGS_DRAFT },
      savedSettings: null,
      updateDraft: () => {},
      updateDrafts: () => {},
      isLoading: false,
      loadError: null,
      retryLoad: () => {},
      isSaving: false,
      saveSettings: async () => false,
      resetSettings: () => {},
      canUpdateSettings: true,
      hasUnsavedChanges: false,
    };
  }
  return context;
}
