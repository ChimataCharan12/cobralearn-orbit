import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { PublishStatus } from "@prisma/client";
import {
  listAdminAwardsOperation,
  getAdminAwardByIdOperation,
  createAdminAwardOperation,
  updateAdminAwardOperation,
  deleteAdminAwardOperation,
  reorderAdminAwardsOperation,
  getPublicAwardsOperation,
  getPublicAwardBySlugOperation,
  type AwardWithMedia,
  type CreateAwardPayload,
  type UpdateAwardPayload,
} from "@/lib/server/awards-operations";

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
 * Server Function: List all awards for admin management (Requires CMS_READ).
 */
export const listAdminAwardsServerFn = createServerFn({ method: "GET" })
  .validator((data?: { status?: PublishStatus | undefined; category?: string | undefined; search?: string | undefined; authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<{ awards: AwardWithMedia[] }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/awards", data?.authToken, "GET");
      return await listAdminAwardsOperation(request, data);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Get a single award by ID or Slug for editing (Requires CMS_READ).
 */
export const getAdminAwardByIdServerFn = createServerFn({ method: "GET" })
  .validator((data: { idOrSlug: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ award: AwardWithMedia | null }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/awards/${data.idOrSlug}`, data.authToken, "GET");
      return await getAdminAwardByIdOperation(request, data.idOrSlug);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Create a new award in PostgreSQL (Requires CMS_CREATE).
 */
export const createAdminAwardServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: CreateAwardPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ award: AwardWithMedia }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/awards", data.authToken, "POST", data.payload);
      return await createAdminAwardOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Update an existing award in PostgreSQL (Requires CMS_UPDATE).
 */
export const updateAdminAwardServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateAwardPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ award: AwardWithMedia }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/awards/${data.id}`, data.authToken, "POST", data.payload);
      return await updateAdminAwardOperation(request, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Delete an award from PostgreSQL (Requires CMS_DELETE).
 */
export const deleteAdminAwardServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; deletedId: string }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/awards/${data.id}`, data.authToken, "POST");
      return await deleteAdminAwardOperation(request, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Reorder awards in PostgreSQL (Requires CMS_UPDATE).
 */
export const reorderAdminAwardsServerFn = createServerFn({ method: "POST" })
  .validator((data: { orderedIds: string[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/awards/reorder", data.authToken, "POST", { orderedIds: data.orderedIds });
      return await reorderAdminAwardsOperation(request, data.orderedIds);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 2. PUBLIC SHOWCASE SERVER FUNCTIONS (Published Only, Unauthenticated)
// =========================================================================

/**
 * Server Function: Query published awards for public showcase.
 */
export const getPublicAwardsServerFn = createServerFn({ method: "GET" })
  .validator((data?: { homepageOnly?: boolean } | undefined) => data)
  .handler(async ({ data }): Promise<{ awards: AwardWithMedia[] }> => {
    return await getPublicAwardsOperation(undefined, data);
  });

/**
 * Server Function: Query a single published award by slug.
 */
export const getPublicAwardBySlugServerFn = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<{ award: AwardWithMedia | null }> => {
    return await getPublicAwardBySlugOperation(data.slug);
  });
