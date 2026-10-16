import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { MediaAsset, MediaCategory, MediaType } from "@prisma/client";
import {
  uploadMediaAssetOperation,
  listAdminMediaAssetsOperation,
  getAdminMediaAssetByIdOperation,
  updateAdminMediaAssetOperation,
  deleteAdminMediaAssetOperation,
  type UploadMediaPayload,
  type ListMediaOptions,
  type UpdateMediaPayload,
  type DeleteMediaResult,
} from "@/lib/server/media-operations";

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
function createServerOpRequest(url: string, authToken?: string, method: string = "GET", body?: unknown): Request {
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
// ADMIN PROTECTED SERVER FUNCTIONS (RBAC & Auth Enforced on Server)
// =========================================================================

/**
 * Server Function: Uploads a media asset to Supabase Storage and records it in PostgreSQL.
 * Requires MEDIA_UPLOAD permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export const uploadAdminMediaServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: UploadMediaPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ asset: MediaAsset }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/media/upload", data.authToken, "POST", data.payload);
      return await uploadMediaAssetOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Lists all media assets for administrative management.
 * Requires MEDIA_READ permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export const listAdminMediaServerFn = createServerFn({ method: "GET" })
  .validator((data?: { options?: ListMediaOptions | undefined; authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<{ assets: MediaAsset[]; totalCount: number }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/media", data?.authToken, "GET");
      return await listAdminMediaAssetsOperation(request, data?.options);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Retrieves a media asset by ID.
 * Requires MEDIA_READ permission.
 */
export const getAdminMediaByIdServerFn = createServerFn({ method: "GET" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ asset: MediaAsset | null }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/media/${data.id}`, data.authToken, "GET");
      return await getAdminMediaAssetByIdOperation(request, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Deletes a media asset from PostgreSQL and Storage.
 * Requires MEDIA_DELETE permission (SUPER_ADMIN, ADMIN only).
 */
export const deleteAdminMediaServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<DeleteMediaResult> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/media/${data.id}`, data.authToken, "POST");
      return await deleteAdminMediaAssetOperation(request, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Updates an existing media asset's metadata.
 * Requires MEDIA_UPDATE permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export const updateAdminMediaServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateMediaPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ asset: MediaAsset }> => {
    try {
      const request = createServerOpRequest(
        `https://api.internal/admin/media/${data.id}`,
        data.authToken,
        "POST",
        data.payload
      );
      return await updateAdminMediaAssetOperation(request, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });
