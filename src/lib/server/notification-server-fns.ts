import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { AdminNotification } from "@prisma/client";
import {
  getSelfNotificationsOperation,
  markNotificationReadOperation,
  markAllNotificationsReadOperation,
} from "./notification-operations";

/**
 * Normalizes internal authentication error messages to standard HTTP 401 client-safe errors.
 */
function normalizeAuthError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("No cookie header provided") ||
    msg.includes("No valid Supabase session") ||
    msg.startsWith("Unauthorized")
  ) {
    throw new Error("Unauthorized: Valid administrative session required");
  }
  throw err;
}

function createServerOpRequest(
  url: string,
  authToken?: string,
  method: string = "GET",
  body?: unknown
): Request {
  const headers = new Headers();

  try {
    const incomingReq = getRequest();
    if (incomingReq) {
      const incomingCookie = incomingReq.headers.get("cookie");
      if (incomingCookie) {
        headers.set("Cookie", incomingCookie);
      }
      const incomingAuth = incomingReq.headers.get("authorization");
      if (incomingAuth) {
        headers.set("Authorization", incomingAuth);
      }
    }
  } catch {
    // Graceful fallback for non-HTTP environments (e.g. Unit tests)
  }

  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const init: RequestInit = { method, headers };
  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

/**
 * Server Function: Retrieves notifications and unread count for current administrator.
 */
export const getSelfNotificationsServerFn = createServerFn({ method: "GET" })
  .validator((data: { limit?: number; unreadOnly?: boolean; category?: string; authToken?: string } | undefined) => data || {})
  .handler(async ({ data }): Promise<{ notifications: AdminNotification[]; unreadCount: number }> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/notifications",
        data?.authToken,
        "GET"
      );
      return await getSelfNotificationsOperation(request, {
        limit: data?.limit,
        unreadOnly: data?.unreadOnly,
        category: data?.category,
      });
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Marks a single notification as read.
 */
export const markNotificationReadServerFn = createServerFn({ method: "POST" })
  .validator((data: { notificationId: string; authToken?: string }) => data)
  .handler(async ({ data }): Promise<{ success: true; notification: AdminNotification }> => {
    try {
      const request = createServerOpRequest(
        `https://api.internal/admin/notifications/${data.notificationId}/read`,
        data.authToken,
        "POST",
        { notificationId: data.notificationId }
      );
      return await markNotificationReadOperation(request, data.notificationId);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Marks all notifications as read for current administrator.
 */
export const markAllNotificationsReadServerFn = createServerFn({ method: "POST" })
  .validator((data: { authToken?: string } | undefined) => data || {})
  .handler(async ({ data }): Promise<{ success: true; count: number }> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/notifications/mark-all-read",
        data?.authToken,
        "POST"
      );
      return await markAllNotificationsReadOperation(request);
    } catch (err) {
      normalizeAuthError(err);
    }
  });
