import { useState, useEffect, useCallback, useRef } from "react";
import type { AdminProfile } from "@prisma/client";
import { useAuth } from "@/lib/auth/use-auth";
import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";
import {
  type AdminPreferences,
  type UpdatePreferencesPayload,
  mergeWithDefaultPreferences,
} from "@/lib/preferences";

export interface UseAdminProfileResult {
  profile: AdminProfile | null;
  preferences: AdminPreferences;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  reloadProfile: () => Promise<void>;
  updateProfile: (data: {
    fullName?: string;
    phone?: string | null;
    designation?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    preferences?: UpdatePreferencesPayload;
  }) => Promise<boolean>;
  updatePreferences: (payload: UpdatePreferencesPayload) => Promise<boolean>;
  uploadAvatar: (file: File) => Promise<boolean>;
}

export function useAdminProfile(): UseAdminProfileResult {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);

  const fetchProfile = useCallback(async () => {
    // 1. If auth session is still initializing, remain in loading state
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    // 2. If auth initialization completed and no session exists, terminate loading gracefully
    if (!isAuthenticated && !user) {
      setIsLoading(false);
      setError(null);
      return;
    }

    const currentRequestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const fetchPromise = adminClient.getSelfProfile();
      const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({ success: false, error: "Request timed out while loading admin profile" });
        }, 6000);
      });

      const res = await Promise.race([fetchPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);

      // Guard against stale asynchronous resolution
      if (currentRequestId !== activeRequestIdRef.current) return;

      if (res.success && res.data) {
        setProfile(res.data);
      } else {
        setError(res.error || "Unable to retrieve admin profile");
      }
    } catch (err: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      if (currentRequestId !== activeRequestIdRef.current) return;
      const message = err instanceof Error ? err.message : "Unable to retrieve admin profile";
      setError(message);
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [authLoading, isAuthenticated, user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Synchronize state across multiple hook instances via window event
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleProfileUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<AdminProfile>;
      if (customEvent.detail) {
        setProfile(customEvent.detail);
      } else {
        fetchProfile();
      }
    };
    window.addEventListener("admin-profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("admin-profile-updated", handleProfileUpdate);
    };
  }, [fetchProfile]);

  const updateProfile = useCallback(
    async (data: {
      fullName?: string;
      phone?: string | null;
      designation?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
    }): Promise<boolean> => {
      setIsSaving(true);
      const res = await adminClient.updateSelfProfile(data);
      setIsSaving(false);

      if (res.success && res.data) {
        setProfile(res.data);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("admin-profile-updated", { detail: res.data })
          );
        }
        toast.success("Profile changes saved successfully.");
        return true;
      } else {
        toast.error(res.error || "Failed to update profile.");
        return false;
      }
    },
    []
  );

  const uploadAvatar = useCallback(
    async (file: File): Promise<boolean> => {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Avatar file exceeds maximum allowed 2MB.");
        return false;
      }
      setIsSaving(true);
      try {
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });

        const res = await adminClient.uploadAvatar({
          originalFilename: file.name,
          mimeType: file.type,
          base64Content,
        });

        setIsSaving(false);

        if (res.success && res.data) {
          setProfile(res.data.profile);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("admin-profile-updated", { detail: res.data.profile })
            );
          }
          toast.success("Avatar updated successfully.");
          return true;
        } else {
          toast.error(res.error || "Failed to upload avatar.");
          return false;
        }
      } catch (err: unknown) {
        setIsSaving(false);
        const msg = err instanceof Error ? err.message : "Failed to upload avatar.";
        toast.error(msg);
        return false;
      }
    },
    []
  );

  const preferences: AdminPreferences = mergeWithDefaultPreferences(profile?.preferences);

  const updatePreferences = useCallback(
    async (payload: UpdatePreferencesPayload): Promise<boolean> => {
      setIsSaving(true);
      const res = await adminClient.updateSelfPreferences(payload);
      setIsSaving(false);

      if (res.success && res.data) {
        setProfile(res.data.profile);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("admin-profile-updated", { detail: res.data.profile })
          );
        }
        toast.success("Preferences saved successfully.");
        return true;
      } else {
        toast.error(res.error || "Failed to update preferences.");
        return false;
      }
    },
    []
  );

  return {
    profile,
    preferences,
    isLoading,
    isSaving,
    error,
    reloadProfile: fetchProfile,
    updateProfile,
    updatePreferences,
    uploadAvatar,
  };
}
