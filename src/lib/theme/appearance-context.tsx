import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { adminClient } from "@/lib/api/admin-client";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import { canPerform, AdminPermissions } from "@/lib/auth/rbac";
import type { AppearanceConfig, MediaAsset } from "@prisma/client";
import type { UpdateAppearanceConfigInput } from "@/lib/validation/settings-schemas";

export interface AppearanceStateValues {
  themePreset: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandAccentColor: string;
  fontHeading: string;
  fontBody: string;
  logoAssetId: string | null;
  faviconAssetId: string | null;
  enableGlowEffects: boolean;
  enableAnimations: boolean;
}

export const DEFAULT_APPEARANCE_STATE: AppearanceStateValues = {
  themePreset: "dark",
  brandPrimaryColor: "#00FF87",
  brandSecondaryColor: "#00E5FF",
  brandAccentColor: "#FFB800",
  fontHeading: "Orbitron",
  fontBody: "Rajdhani",
  logoAssetId: null,
  faviconAssetId: null,
  enableGlowEffects: true,
  enableAnimations: true,
};

export interface AppearanceContextValue {
  savedValues: AppearanceStateValues;
  currentValues: AppearanceStateValues;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  hasUnsavedChanges: boolean;
  canUpdate: boolean;
  updateField: <K extends keyof AppearanceStateValues>(field: K, value: AppearanceStateValues[K]) => void;
  resetToSaved: () => void;
  saveChanges: () => Promise<boolean>;
  reload: () => Promise<void>;
  // Resolved media assets for preview
  logoAsset: MediaAsset | null;
  faviconAsset: MediaAsset | null;
  setLogoAsset: (asset: MediaAsset | null) => void;
  setFaviconAsset: (asset: MediaAsset | null) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function configToValues(cfg?: AppearanceConfig | null): AppearanceStateValues {
  if (!cfg) return { ...DEFAULT_APPEARANCE_STATE };
  return {
    themePreset: cfg.themePreset || DEFAULT_APPEARANCE_STATE.themePreset,
    brandPrimaryColor: cfg.brandPrimaryColor || DEFAULT_APPEARANCE_STATE.brandPrimaryColor,
    brandSecondaryColor: cfg.brandSecondaryColor || DEFAULT_APPEARANCE_STATE.brandSecondaryColor,
    brandAccentColor: cfg.brandAccentColor || DEFAULT_APPEARANCE_STATE.brandAccentColor,
    fontHeading: cfg.fontHeading || DEFAULT_APPEARANCE_STATE.fontHeading,
    fontBody: cfg.fontBody || DEFAULT_APPEARANCE_STATE.fontBody,
    logoAssetId: cfg.logoAssetId ?? null,
    faviconAssetId: cfg.faviconAssetId ?? null,
    enableGlowEffects: cfg.enableGlowEffects ?? true,
    enableAnimations: cfg.enableAnimations ?? true,
  };
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAdminProfile();
  const canUpdate = profile?.role ? canPerform(profile.role, AdminPermissions.APPEARANCE_UPDATE) : false;

  const [savedValues, setSavedValues] = useState<AppearanceStateValues>(DEFAULT_APPEARANCE_STATE);
  const [currentValues, setCurrentValues] = useState<AppearanceStateValues>(DEFAULT_APPEARANCE_STATE);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Resolved media assets
  const [logoAsset, setLogoAsset] = useState<MediaAsset | null>(null);
  const [faviconAsset, setFaviconAsset] = useState<MediaAsset | null>(null);

  const fetchResolvedAsset = useCallback(async (assetId: string | null, setAsset: (a: MediaAsset | null) => void) => {
    if (!assetId) {
      setAsset(null);
      return;
    }
    const res = await adminClient.getAdminMedia(assetId);
    if (res.success && res.data) {
      setAsset(res.data);
    } else {
      setAsset(null);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await adminClient.getAppearanceConfig();
      if (!res.success) {
        setLoadError(res.error || "Failed to load appearance settings from database.");
        return;
      }
      const initial = configToValues(res.data);
      setSavedValues(initial);
      setCurrentValues(initial);

      // Load associated media assets in background
      if (initial.logoAssetId) {
        fetchResolvedAsset(initial.logoAssetId, setLogoAsset);
      } else {
        setLogoAsset(null);
      }
      if (initial.faviconAssetId) {
        fetchResolvedAsset(initial.faviconAssetId, setFaviconAsset);
      } else {
        setFaviconAsset(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error loading appearance configuration.";
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [fetchResolvedAsset]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateField = useCallback(<K extends keyof AppearanceStateValues>(field: K, value: AppearanceStateValues[K]) => {
    setCurrentValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const resetToSaved = useCallback(() => {
    setCurrentValues(savedValues);
    if (savedValues.logoAssetId) {
      fetchResolvedAsset(savedValues.logoAssetId, setLogoAsset);
    } else {
      setLogoAsset(null);
    }
    if (savedValues.faviconAssetId) {
      fetchResolvedAsset(savedValues.faviconAssetId, setFaviconAsset);
    } else {
      setFaviconAsset(null);
    }
    toast.info("Unsaved edits discarded. Restored last saved database settings.");
  }, [savedValues, fetchResolvedAsset]);

  const hasUnsavedChanges = useMemo(() => {
    return (
      savedValues.themePreset !== currentValues.themePreset ||
      savedValues.brandPrimaryColor !== currentValues.brandPrimaryColor ||
      savedValues.brandSecondaryColor !== currentValues.brandSecondaryColor ||
      savedValues.brandAccentColor !== currentValues.brandAccentColor ||
      savedValues.fontHeading !== currentValues.fontHeading ||
      savedValues.fontBody !== currentValues.fontBody ||
      savedValues.logoAssetId !== currentValues.logoAssetId ||
      savedValues.faviconAssetId !== currentValues.faviconAssetId ||
      savedValues.enableGlowEffects !== currentValues.enableGlowEffects ||
      savedValues.enableAnimations !== currentValues.enableAnimations
    );
  }, [savedValues, currentValues]);

  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (!canUpdate) {
      toast.error("Permission Denied: Your role lacks appearance:update permissions.");
      return false;
    }
    if (isSaving) return false;

    setIsSaving(true);
    try {
      const payload: UpdateAppearanceConfigInput = {
        themePreset: currentValues.themePreset,
        brandPrimaryColor: currentValues.brandPrimaryColor,
        brandSecondaryColor: currentValues.brandSecondaryColor,
        brandAccentColor: currentValues.brandAccentColor,
        fontHeading: currentValues.fontHeading,
        fontBody: currentValues.fontBody,
        logoAssetId: currentValues.logoAssetId,
        faviconAssetId: currentValues.faviconAssetId,
        enableGlowEffects: currentValues.enableGlowEffects,
        enableAnimations: currentValues.enableAnimations,
      };

      const res = await adminClient.updateAppearanceConfig(payload);
      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to save appearance settings.");
        return false;
      }

      const newSaved = configToValues(res.data);
      setSavedValues(newSaved);
      setCurrentValues(newSaved);
      toast.success("Appearance configuration successfully saved to database.");
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving appearance settings.";
      toast.error(msg);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [canUpdate, isSaving, currentValues]);

  const contextValue = useMemo<AppearanceContextValue>(
    () => ({
      savedValues,
      currentValues,
      isLoading,
      isSaving,
      loadError,
      hasUnsavedChanges,
      canUpdate,
      updateField,
      resetToSaved,
      saveChanges,
      reload: loadConfig,
      logoAsset,
      faviconAsset,
      setLogoAsset,
      setFaviconAsset,
    }),
    [
      savedValues,
      currentValues,
      isLoading,
      isSaving,
      loadError,
      hasUnsavedChanges,
      canUpdate,
      updateField,
      resetToSaved,
      saveChanges,
      loadConfig,
      logoAsset,
      faviconAsset,
    ]
  );

  return <AppearanceContext.Provider value={contextValue}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used within an AppearanceProvider");
  }
  return ctx;
}
