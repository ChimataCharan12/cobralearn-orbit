import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { AdminProfile, AdminRole, AdminAuditLog } from "@prisma/client";
import {
  getCurrentAdminProfileOperation,
  updateSelfProfileOperation,
  updateSelfPreferencesOperation,
  uploadAvatarOperation,
  getSelfAuditLogsOperation,
  listAdminProfilesOperation,
  updateAdminStatusOperation,
  assignAdminRoleOperation,
  getAuditLogsOperation,
  recordAdminLoginOperation,
  getSelfLoginHistoryOperation,
  type UpdateSelfProfilePayload,
  type UploadAvatarPayload,
  type RecordLoginResult,
  type GetSelfLoginHistoryResult,
} from "@/lib/server/admin-operations";
import type { UpdatePreferencesPayload, AdminPreferences } from "@/lib/preferences";

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

/**
 * Creates an authenticated internal Request object for server operations.
 * Preserves incoming HTTP Cookie headers and Authorization headers from the server context.
 */
function createServerOpRequest(
  url: string,
  authToken?: string,
  method: string = "GET",
  body?: unknown
): Request {
  const headers = new Headers();

  // 1. Inherit incoming HTTP request headers (Cookie, Authorization) from TanStack Start server context
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
      const incomingUa = incomingReq.headers.get("user-agent");
      if (incomingUa) {
        headers.set("User-Agent", incomingUa);
      }
    }
  } catch {
    // Graceful fallback for non-HTTP environments (e.g. Unit tests)
  }

  // 2. Explicit client authToken payload takes precedence for Bearer Authorization
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const init: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

// =========================================================================
// 1. ADMIN PROFILE & SELF-SERVICE SERVER FUNCTIONS
// =========================================================================

/**
 * Server Function: Loads current verified administrator profile.
 */
export const getSelfProfileServerFn = createServerFn({ method: "GET" })
  .validator((data?: { authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<{ profile: AdminProfile }> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/profile/self",
        data?.authToken,
        "GET"
      );
      const result = await getCurrentAdminProfileOperation(request);
      return { profile: result.profile };
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Updates self administrator profile fields.
 */
export const updateSelfProfileServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: UpdateSelfProfilePayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ profile: AdminProfile }> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/profile/self",
        data.authToken,
        "POST",
        data.payload
      );
      const result = await updateSelfProfileOperation(request, data.payload);
      return { profile: result.profile };
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Updates self administrator notification and portal preferences.
 */
export const updateSelfPreferencesServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: UpdatePreferencesPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ preferences: AdminPreferences; profile: AdminProfile }> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/profile/preferences",
        data.authToken,
        "POST",
        data.payload
      );
      return await updateSelfPreferencesOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Uploads administrator avatar and updates profile.
 */
export const uploadAvatarServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: UploadAvatarPayload; authToken?: string | undefined }) => data)
  .handler(
    async ({ data }): Promise<{ avatarUrl: string; profile: AdminProfile }> => {
      try {
        const request = createServerOpRequest(
          "https://api.internal/admin/profile/avatar",
          data.authToken,
          "POST",
          data.payload
        );
        return await uploadAvatarOperation(request, data.payload);
      } catch (err) {
        normalizeAuthError(err);
      }
    }
  );

/**
 * Server Function: Retrieves self administrative audit logs.
 */
export const getSelfAuditLogsServerFn = createServerFn({ method: "GET" })
  .validator(
    (data?: { limit?: number; offset?: number; authToken?: string | undefined } | undefined) => data
  )
  .handler(async ({ data }): Promise<{ logs: AdminAuditLog[]; count: number }> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/profile/activity",
        data?.authToken,
        "GET"
      );
      return await getSelfAuditLogsOperation(request, {
        limit: data?.limit,
        offset: data?.offset,
      });
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 2. ADMIN GOVERNANCE & AUDIT LOG SERVER FUNCTIONS
// =========================================================================

/**
 * Server Function: Lists administrative team profiles (Requires ADMIN_READ).
 */
export const listTeamProfilesServerFn = createServerFn({ method: "GET" })
  .validator((data?: { authToken?: string | undefined } | undefined) => data)
  .handler(
    async ({ data }): Promise<{ profiles: Array<Omit<AdminProfile, "avatarUrl" | "bio" | "phone">> }> => {
      try {
        const request = createServerOpRequest(
          "https://api.internal/admin/team",
          data?.authToken,
          "GET"
        );
        return await listAdminProfilesOperation(request);
      } catch (err) {
        normalizeAuthError(err);
      }
    }
  );

/**
 * Server Function: Updates administrator active status (Requires ADMIN_MANAGE).
 */
export const updateAdminStatusServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: { targetAdminId: string; isActive: boolean; authToken?: string | undefined }) => data
  )
  .handler(
    async ({ data }): Promise<{ success: boolean; targetAdminId: string; isActive: boolean }> => {
      try {
        const request = createServerOpRequest(
          "https://api.internal/admin/team/status",
          data.authToken,
          "POST",
          { targetAdminId: data.targetAdminId, isActive: data.isActive }
        );
        return await updateAdminStatusOperation(request, {
          targetAdminId: data.targetAdminId,
          isActive: data.isActive,
        });
      } catch (err) {
        normalizeAuthError(err);
      }
    }
  );

/**
 * Server Function: Assigns new administrative role (Requires ROLE_ASSIGN).
 */
export const assignAdminRoleServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: { targetAdminId: string; newRole: AdminRole; authToken?: string | undefined }) => data
  )
  .handler(
    async ({ data }): Promise<{ success: boolean; targetAdminId: string; newRole: AdminRole }> => {
      try {
        const request = createServerOpRequest(
          "https://api.internal/admin/team/role",
          data.authToken,
          "POST",
          { targetAdminId: data.targetAdminId, newRole: data.newRole }
        );
        return await assignAdminRoleOperation(request, {
          targetAdminId: data.targetAdminId,
          newRole: data.newRole,
        });
      } catch (err) {
        normalizeAuthError(err);
      }
    }
  );

/**
 * Server Function: Retrieves global audit logs (Requires AUDIT_LOG_READ).
 */
export const getAuditLogsServerFn = createServerFn({ method: "GET" })
  .validator(
    (data?: { limit?: number; offset?: number; authToken?: string | undefined } | undefined) => data
  )
  .handler(async ({ data }): Promise<{ logs: AdminAuditLog[]; count: number }> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/audit-logs",
        data?.authToken,
        "GET"
      );
      return await getAuditLogsOperation(request, {
        limit: data?.limit,
        offset: data?.offset,
      });
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Records an authenticated administrator's login event.
 */
export const recordLoginHistoryServerFn = createServerFn({ method: "POST" })
  .validator((data?: { authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<RecordLoginResult> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/login-history",
        data?.authToken,
        "POST"
      );
      return await recordAdminLoginOperation(request);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Retrieves paginated login history for the authenticated administrator.
 */
export const getSelfLoginHistoryServerFn = createServerFn({ method: "GET" })
  .validator((data?: { page?: number; limit?: number; authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<GetSelfLoginHistoryResult> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/self/login-history",
        data?.authToken,
        "GET"
      );
      return await getSelfLoginHistoryOperation(request, {
        page: data?.page,
        limit: data?.limit,
      });
    } catch (err) {
      normalizeAuthError(err);
    }
  });

