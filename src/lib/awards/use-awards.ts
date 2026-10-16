import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { adminClient } from "@/lib/api/admin-client";
import type { AwardWithMedia, CreateAwardPayload, UpdateAwardPayload } from "@/lib/server/awards-operations";
import { awardToItem, type AwardItem } from "@/lib/awards-data";
import { toast } from "sonner";
import type { PublishStatus } from "@prisma/client";

export function useAwards(options?: { status?: PublishStatus; category?: string; search?: string }) {
  const [rawAwards, setRawAwards] = useState<AwardWithMedia[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);

  const fetchAwards = useCallback(async () => {
    const currentRequestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const res = await adminClient.listAdminAwards(options);
      if (currentRequestId !== activeRequestIdRef.current) return;

      if (res.success && res.data) {
        setRawAwards(res.data);
      } else {
        setError(res.error || "Failed to load awards from database");
      }
    } catch (err: unknown) {
      if (currentRequestId !== activeRequestIdRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load awards from database";
      setError(message);
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [options?.status, options?.category, options?.search]);

  useEffect(() => {
    fetchAwards();
  }, [fetchAwards]);

  const awards: AwardItem[] = useMemo(() => {
    return rawAwards.map(awardToItem);
  }, [rawAwards]);

  const createAward = async (payload: CreateAwardPayload): Promise<AwardWithMedia | null> => {
    try {
      const res = await adminClient.createAdminAward(payload);
      if (res.success && res.data) {
        toast.success(`Award "${res.data.name}" created successfully.`);
        await fetchAwards();
        return res.data;
      } else {
        toast.error(res.error || "Failed to create award");
        return null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create award";
      toast.error(msg);
      return null;
    }
  };

  const updateAward = async (id: string, payload: UpdateAwardPayload): Promise<AwardWithMedia | null> => {
    try {
      const res = await adminClient.updateAdminAward(id, payload);
      if (res.success && res.data) {
        toast.success(`Award "${res.data.name}" updated successfully.`);
        await fetchAwards();
        return res.data;
      } else {
        toast.error(res.error || "Failed to update award");
        return null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update award";
      toast.error(msg);
      return null;
    }
  };

  const deleteAward = async (id: string): Promise<boolean> => {
    try {
      const res = await adminClient.deleteAdminAward(id);
      if (res.success) {
        toast.success("Award deleted successfully.");
        await fetchAwards();
        return true;
      } else {
        toast.error(res.error || "Failed to delete award. CMS_DELETE permission required.");
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete award";
      toast.error(msg);
      return false;
    }
  };

  const reorderAwards = async (orderedIds: string[]): Promise<boolean> => {
    try {
      const res = await adminClient.reorderAdminAwards(orderedIds);
      if (res.success) {
        toast.success("Award display order updated.");
        await fetchAwards();
        return true;
      } else {
        toast.error(res.error || "Failed to update award display order.");
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update award display order.";
      toast.error(msg);
      return false;
    }
  };

  const publishAward = async (id: string): Promise<boolean> => {
    const res = await updateAward(id, { status: "PUBLISHED" });
    return !!res;
  };

  const unpublishAward = async (id: string): Promise<boolean> => {
    const res = await updateAward(id, { status: "DRAFT" });
    return !!res;
  };

  const archiveAward = async (id: string): Promise<boolean> => {
    const res = await updateAward(id, { status: "ARCHIVED" });
    return !!res;
  };

  return {
    awards,
    rawAwards,
    isLoading,
    error,
    refetch: fetchAwards,
    refreshAwards: fetchAwards,
    createAward,
    updateAward,
    deleteAward,
    reorderAwards,
    publishAward,
    unpublishAward,
    archiveAward,
  };
}
