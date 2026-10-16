import { useState, useEffect, useCallback, useRef } from "react";
import { adminClient } from "@/lib/api/admin-client";
import type { WebsiteWithMedia, CreateWebsitePayload, UpdateWebsitePayload } from "@/lib/server/websites-operations";
import { toast } from "sonner";
import type { PublishStatus } from "@prisma/client";

export function useWebsites(options?: { status?: PublishStatus; search?: string }) {
  const [websites, setWebsites] = useState<WebsiteWithMedia[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);

  const fetchWebsites = useCallback(async () => {
    const currentRequestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const res = await adminClient.listAdminWebsites(options);
      // Guard against stale response if a newer request was dispatched
      if (currentRequestId !== activeRequestIdRef.current) return;

      if (res.success && res.data) {
        setWebsites(res.data);
      } else {
        setError(res.error || "Failed to load websites from database");
      }
    } catch (err: unknown) {
      if (currentRequestId !== activeRequestIdRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load websites from database";
      setError(message);
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [options?.status, options?.search]);

  useEffect(() => {
    fetchWebsites();
  }, [fetchWebsites]);

  const createWebsite = async (payload: CreateWebsitePayload): Promise<WebsiteWithMedia | null> => {
    try {
      const res = await adminClient.createAdminWebsite(payload);
      if (res.success && res.data) {
        toast.success(`Website "${res.data.name}" created successfully.`);
        await fetchWebsites();
        return res.data;
      } else {
        toast.error(res.error || "Failed to create website");
        return null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create website";
      toast.error(msg);
      return null;
    }
  };

  const updateWebsite = async (id: string, payload: UpdateWebsitePayload): Promise<WebsiteWithMedia | null> => {
    try {
      const res = await adminClient.updateAdminWebsite(id, payload);
      if (res.success && res.data) {
        toast.success(`Website "${res.data.name}" updated successfully.`);
        await fetchWebsites();
        return res.data;
      } else {
        toast.error(res.error || "Failed to update website");
        return null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update website";
      toast.error(msg);
      return null;
    }
  };

  const deleteWebsite = async (id: string): Promise<boolean> => {
    try {
      const res = await adminClient.deleteAdminWebsite(id);
      if (res.success) {
        toast.success("Website deleted successfully.");
        await fetchWebsites();
        return true;
      } else {
        toast.error(res.error || "Failed to delete website. CMS_DELETE permission required.");
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete website";
      toast.error(msg);
      return false;
    }
  };

  const reorderWebsites = async (orderedIds: string[]): Promise<boolean> => {
    try {
      const res = await adminClient.reorderAdminWebsites(orderedIds);
      if (res.success) {
        toast.success("Websites reordered successfully.");
        await fetchWebsites();
        return true;
      } else {
        toast.error(res.error || "Failed to reorder websites");
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reorder websites";
      toast.error(msg);
      return false;
    }
  };

  return {
    websites,
    isLoading,
    error,
    refreshWebsites: fetchWebsites,
    createWebsite,
    updateWebsite,
    deleteWebsite,
    reorderWebsites,
  };
}
