import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { PublishStatus } from "@prisma/client";
import {
  listAdminWebsitesOperation,
  getAdminWebsiteByIdOperation,
  createAdminWebsiteOperation,
  updateAdminWebsiteOperation,
  deleteAdminWebsiteOperation,
  reorderAdminWebsitesOperation,
  getPublicWebsitesOperation,
  getPublicWebsiteBySlugOperation,
  type WebsiteWithMedia,
  type CreateWebsitePayload,
  type UpdateWebsitePayload,
} from "@/lib/server/websites-operations";

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
 * Server Function: List all websites for admin management (Requires CMS_READ).
 */
export const listAdminWebsitesServerFn = createServerFn({ method: "GET" })
  .validator((data?: { status?: PublishStatus | undefined; search?: string | undefined; authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<{ websites: WebsiteWithMedia[] }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/websites", data?.authToken, "GET");
      return await listAdminWebsitesOperation(request, data);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Get a single website by ID or Slug for editing (Requires CMS_READ).
 */
export const getAdminWebsiteByIdServerFn = createServerFn({ method: "GET" })
  .validator((data: { idOrSlug: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ website: WebsiteWithMedia | null }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/websites/${data.idOrSlug}`, data.authToken, "GET");
      return await getAdminWebsiteByIdOperation(request, data.idOrSlug);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Create a new website in PostgreSQL (Requires CMS_CREATE).
 */
export const createAdminWebsiteServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: CreateWebsitePayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ website: WebsiteWithMedia }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/websites", data.authToken, "POST", data.payload);
      return await createAdminWebsiteOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Update an existing website in PostgreSQL (Requires CMS_UPDATE).
 */
export const updateAdminWebsiteServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateWebsitePayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ website: WebsiteWithMedia }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/websites/${data.id}`, data.authToken, "POST", data.payload);
      return await updateAdminWebsiteOperation(request, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Delete a website from PostgreSQL (Requires CMS_DELETE).
 */
export const deleteAdminWebsiteServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; deletedId: string }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/websites/${data.id}`, data.authToken, "POST");
      return await deleteAdminWebsiteOperation(request, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Reorder websites in PostgreSQL (Requires CMS_UPDATE).
 */
export const reorderAdminWebsitesServerFn = createServerFn({ method: "POST" })
  .validator((data: { orderedIds: string[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/websites/reorder", data.authToken, "POST", { orderedIds: data.orderedIds });
      return await reorderAdminWebsitesOperation(request, data.orderedIds);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 2. PUBLIC SHOWCASE SERVER FUNCTIONS (Published Only, Unauthenticated)
// =========================================================================

/**
 * Server Function: Query published websites for the public showcase website.
 */
export const getPublicWebsitesServerFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ websites: WebsiteWithMedia[] }> => {
    return await getPublicWebsitesOperation();
  });

/**
 * Server Function: Query a single published website by slug.
 */
export const getPublicWebsiteBySlugServerFn = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<{ website: WebsiteWithMedia | null }> => {
    return await getPublicWebsiteBySlugOperation(data.slug);
  });
