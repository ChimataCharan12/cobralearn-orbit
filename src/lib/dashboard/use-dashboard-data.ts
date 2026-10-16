import { useState, useEffect, useCallback, useRef } from "react";
import { adminClient, type DashboardDataResult } from "@/lib/api/admin-client";

export function useDashboardData() {
  const [data, setData] = useState<DashboardDataResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let completed = false;
    const timeoutId = setTimeout(() => {
      if (!completed && isMountedRef.current) {
        setIsLoading(false);
        setError("Dashboard request timed out. Please retry.");
      }
    }, 8000);

    try {
      const res = await adminClient.getDashboardData();
      completed = true;
      clearTimeout(timeoutId);

      if (!isMountedRef.current) return;

      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error || "Failed to load dashboard data");
      }
    } catch (err: unknown) {
      completed = true;
      clearTimeout(timeoutId);
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(message);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchDashboardData();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchDashboardData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchDashboardData,
  };
}
