import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { adminClient } from "@/lib/api/admin-client";
import type { AdvertisementWithMedia, CreateAdvertisementPayload, UpdateAdvertisementPayload } from "@/lib/server/advertisements-operations";
import { advertisementToItem, type AdvertisementItem } from "@/lib/advertisements-data";
import { toast } from "sonner";
import type { PublishStatus } from "@prisma/client";

export function useAdvertisements(options?: { status?: PublishStatus; campaign?: string; search?: string }) {
  const [rawAdvertisements, setRawAdvertisements] = useState<AdvertisementWithMedia[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);

  const fetchAdvertisements = useCallback(async () => {
    const currentRequestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const res = await adminClient.listAdminAdvertisements(options);
      if (currentRequestId !== activeRequestIdRef.current) return;

      if (res.success && res.data) {
        setRawAdvertisements(res.data);
      } else {
        setError(res.error || "Failed to load advertisements from database");
      }
    } catch (err: unknown) {
      if (currentRequestId !== activeRequestIdRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load advertisements from database";
      setError(message);
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [options?.status, options?.campaign, options?.search]);

  useEffect(() => {
    fetchAdvertisements();
  }, [fetchAdvertisements]);

  const advertisements: AdvertisementItem[] = useMemo(() => {
    return rawAdvertisements.map(advertisementToItem);
  }, [rawAdvertisements]);

  const createAdvertisement = async (payload: CreateAdvertisementPayload): Promise<AdvertisementWithMedia | null> => {
    try {
      const res = await adminClient.createAdminAdvertisement(payload);
      if (res.success && res.data) {
        toast.success(`Advertisement "${res.data.name}" created successfully.`);
        await fetchAdvertisements();
        return res.data;
      } else {
        toast.error(res.error || "Failed to create advertisement");
        return null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create advertisement";
      toast.error(msg);
      return null;
    }
  };

  const updateAdvertisement = async (id: string, payload: UpdateAdvertisementPayload): Promise<AdvertisementWithMedia | null> => {
    try {
      const res = await adminClient.updateAdminAdvertisement(id, payload);
      if (res.success && res.data) {
        toast.success(`Advertisement "${res.data.name}" updated successfully.`);
        await fetchAdvertisements();
        return res.data;
      } else {
        toast.error(res.error || "Failed to update advertisement");
        return null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update advertisement";
      toast.error(msg);
      return null;
    }
  };

  const deleteAdvertisement = async (id: string): Promise<boolean> => {
    try {
      const res = await adminClient.deleteAdminAdvertisement(id);
      if (res.success) {
        toast.success("Advertisement deleted successfully.");
        await fetchAdvertisements();
        return true;
      } else {
        toast.error(res.error || "Failed to delete advertisement. CMS_DELETE permission required.");
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete advertisement";
      toast.error(msg);
      return false;
    }
  };

  const reorderAdvertisements = async (orderedIds: string[]): Promise<boolean> => {
    try {
      const res = await adminClient.reorderAdminAdvertisements(orderedIds);
      if (res.success) {
        toast.success("Advertisement display order updated.");
        await fetchAdvertisements();
        return true;
      } else {
        toast.error(res.error || "Failed to update advertisement display order.");
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update advertisement display order.";
      toast.error(msg);
      return false;
    }
  };

  const publishAdvertisement = async (id: string): Promise<boolean> => {
    const res = await updateAdvertisement(id, { status: "PUBLISHED" });
    return !!res;
  };

  const unpublishAdvertisement = async (id: string): Promise<boolean> => {
    const res = await updateAdvertisement(id, { status: "DRAFT" });
    return !!res;
  };

  const archiveAdvertisement = async (id: string): Promise<boolean> => {
    const res = await updateAdvertisement(id, { status: "ARCHIVED" });
    return !!res;
  };

  return {
    advertisements,
    rawAdvertisements,
    isLoading,
    error,
    refetch: fetchAdvertisements,
    refreshAdvertisements: fetchAdvertisements,
    createAdvertisement,
    updateAdvertisement,
    deleteAdvertisement,
    reorderAdvertisements,
    publishAdvertisement,
    unpublishAdvertisement,
    archiveAdvertisement,
  };
}
