import { useState, useEffect, useCallback, useRef } from "react";
import type { AdminNotification } from "@prisma/client";
import { adminClient } from "@/lib/api/admin-client";
import { useAuth } from "@/lib/auth/use-auth";
import { toast } from "sonner";

export interface UseAdminNotificationsResult {
  notifications: AdminNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
}

export function useAdminNotifications(options?: {
  pollIntervalMs?: number;
  limit?: number;
  unreadOnly?: boolean;
  category?: string;
}): UseAdminNotificationsResult {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const pollInterval = options?.pollIntervalMs ?? 30000;
  const limit = options?.limit ?? 50;
  const unreadOnly = options?.unreadOnly;
  const category = options?.category;
  const isFetchingRef = useRef(false);

  const fetchNotifications = useCallback(async (showLoadingSpinner = false) => {
    if (!isAuthenticated || authLoading) {
      setIsLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (showLoadingSpinner) setIsLoading(true);

    try {
      const res = await adminClient.getNotifications({ limit, unreadOnly, category });
      if (res.success && res.data) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
        setError(null);
      } else {
        setError(res.error || "Failed to load notifications");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [isAuthenticated, authLoading, limit, unreadOnly, category]);

  // Initial load
  useEffect(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  // Polling & focus refresh
  useEffect(() => {
    if (!isAuthenticated || authLoading || pollInterval <= 0) return;

    const interval = setInterval(() => {
      fetchNotifications(false);
    }, pollInterval);

    const onFocus = () => fetchNotifications(false);
    window.addEventListener("focus", onFocus);

    const onRefreshEvent = () => fetchNotifications(false);
    window.addEventListener("admin-notifications-refresh", onRefreshEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("admin-notifications-refresh", onRefreshEvent);
    };
  }, [isAuthenticated, authLoading, pollInterval, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    const res = await adminClient.markNotificationRead(notificationId);
    if (!res.success) {
      toast.error(res.error || "Failed to mark notification as read");
      fetchNotifications(false);
      return false;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("admin-notifications-refresh"));
    }
    return true;
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
    );
    setUnreadCount(0);

    const res = await adminClient.markAllNotificationsRead();
    if (!res.success) {
      toast.error(res.error || "Failed to mark all as read");
      fetchNotifications(false);
      return false;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("admin-notifications-refresh"));
    }
    toast.success("All notifications marked as read");
    return true;
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: () => fetchNotifications(true),
    markAsRead,
    markAllAsRead,
  };
}
