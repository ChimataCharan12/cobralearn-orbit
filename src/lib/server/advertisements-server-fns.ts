import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { PublishStatus } from "@prisma/client";
import {
  listAdminAdvertisementsOperation,
  getAdminAdvertisementByIdOperation,
  createAdminAdvertisementOperation,
  updateAdminAdvertisementOperation,
  deleteAdminAdvertisementOperation,
  reorderAdminAdvertisementsOperation,
  getPublicAdvertisementsOperation,
  getPublicAdvertisementBySlugOperation,
  type AdvertisementWithMedia,
  type CreateAdvertisementPayload,
  type UpdateAdvertisementPayload,
} from "@/lib/server/advertisements-operations";

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

  // 1. Inherit incoming HTTP request headers from TanStack Start server context
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
// 1. ADMIN PROTECTED SERVER FUNCTIONS (RBAC & Auth Enforced on Server)
// =========================================================================

/**
 * Server Function: List all advertisements for admin management (Requires CMS_READ).
 */
export const listAdminAdvertisementsServerFn = createServerFn({ method: "GET" })
  .validator((data?: { status?: PublishStatus | undefined; campaign?: string | undefined; search?: string | undefined; authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<{ advertisements: AdvertisementWithMedia[] }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/advertisements", data?.authToken, "GET");
      return await listAdminAdvertisementsOperation(request, data);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Get a single advertisement by ID or Slug for editing (Requires CMS_READ).
 */
export const getAdminAdvertisementByIdServerFn = createServerFn({ method: "GET" })
  .validator((data: { idOrSlug: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ advertisement: AdvertisementWithMedia | null }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/advertisements/${data.idOrSlug}`, data.authToken, "GET");
      return await getAdminAdvertisementByIdOperation(request, data.idOrSlug);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Create a new advertisement in PostgreSQL (Requires CMS_CREATE).
 */
export const createAdminAdvertisementServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: CreateAdvertisementPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ advertisement: AdvertisementWithMedia }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/advertisements", data.authToken, "POST", data.payload);
      return await createAdminAdvertisementOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Update an existing advertisement in PostgreSQL (Requires CMS_UPDATE).
 */
export const updateAdminAdvertisementServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateAdvertisementPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ advertisement: AdvertisementWithMedia }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/advertisements/${data.id}`, data.authToken, "POST", data.payload);
      return await updateAdminAdvertisementOperation(request, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Delete an advertisement from PostgreSQL (Requires CMS_DELETE).
 */
export const deleteAdminAdvertisementServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; deletedId: string }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/advertisements/${data.id}`, data.authToken, "POST");
      return await deleteAdminAdvertisementOperation(request, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Reorder advertisements in PostgreSQL (Requires CMS_UPDATE).
 */
export const reorderAdminAdvertisementsServerFn = createServerFn({ method: "POST" })
  .validator((data: { orderedIds: string[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/advertisements/reorder", data.authToken, "POST", { orderedIds: data.orderedIds });
      return await reorderAdminAdvertisementsOperation(request, data.orderedIds);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 2. PUBLIC SHOWCASE SERVER FUNCTIONS (Published Only, Unauthenticated)
// =========================================================================

/**
 * Server Function: Query published advertisements for public showcase.
 */
export const getPublicAdvertisementsServerFn = createServerFn({ method: "GET" })
  .validator((data?: { homepageOnly?: boolean } | undefined) => data)
  .handler(async ({ data }): Promise<{ advertisements: AdvertisementWithMedia[] }> => {
    return await getPublicAdvertisementsOperation(undefined, data);
  });

/**
 * Server Function: Query a single published advertisement by slug.
 */
export const getPublicAdvertisementBySlugServerFn = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<{ advertisement: AdvertisementWithMedia | null }> => {
    return await getPublicAdvertisementBySlugOperation(data.slug);
  });
