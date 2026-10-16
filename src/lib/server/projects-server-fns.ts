import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { PublishStatus } from "@prisma/client";
import {
  listAdminProjectsOperation,
  getAdminProjectByIdOperation,
  createAdminProjectOperation,
  updateAdminProjectOperation,
  deleteAdminProjectOperation,
  reorderAdminProjectsOperation,
  getPublicProjectsOperation,
  getPublicProjectBySlugOperation,
  type ProjectWithMedia,
  type CreateProjectPayload,
  type UpdateProjectPayload,
} from "@/lib/server/projects-operations";

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
// 1. ADMIN PROTECTED SERVER FUNCTIONS (RBAC & Auth Enforced on Server)
// =========================================================================

/**
 * Server Function: List all projects for admin management (Requires CMS_READ).
 */
export const listAdminProjectsServerFn = createServerFn({ method: "GET" })
  .validator((data?: { status?: PublishStatus | undefined; search?: string | undefined; authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<{ projects: ProjectWithMedia[] }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/projects", data?.authToken, "GET");
      return await listAdminProjectsOperation(request, data);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Get a single project by ID or Slug for editing (Requires CMS_READ).
 */
export const getAdminProjectByIdServerFn = createServerFn({ method: "GET" })
  .validator((data: { idOrSlug: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ project: ProjectWithMedia | null }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/projects/${data.idOrSlug}`, data.authToken, "GET");
      return await getAdminProjectByIdOperation(request, data.idOrSlug);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Create a new project in PostgreSQL (Requires CMS_CREATE).
 */
export const createAdminProjectServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: CreateProjectPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ project: ProjectWithMedia }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/projects", data.authToken, "POST", data.payload);
      return await createAdminProjectOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Update an existing project in PostgreSQL (Requires CMS_UPDATE).
 */
export const updateAdminProjectServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateProjectPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ project: ProjectWithMedia }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/projects/${data.id}`, data.authToken, "POST", data.payload);
      return await updateAdminProjectOperation(request, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Delete a project from PostgreSQL (Requires CMS_DELETE).
 */
export const deleteAdminProjectServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; deletedId: string }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/projects/${data.id}`, data.authToken, "POST");
      return await deleteAdminProjectOperation(request, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Reorder projects in PostgreSQL (Requires CMS_UPDATE).
 */
export const reorderAdminProjectsServerFn = createServerFn({ method: "POST" })
  .validator((data: { orderedIds: string[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/projects/reorder", data.authToken, "POST", { orderedIds: data.orderedIds });
      return await reorderAdminProjectsOperation(request, data.orderedIds);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 2. PUBLIC SHOWCASE SERVER FUNCTIONS (Published Only, Unauthenticated)
// =========================================================================

/**
 * Server Function: Query published projects for the public showcase website.
 */
export const getPublicProjectsServerFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ projects: ProjectWithMedia[] }> => {
    return await getPublicProjectsOperation();
  });

/**
 * Server Function: Query a single published project by slug.
 */
export const getPublicProjectBySlugServerFn = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<{ project: ProjectWithMedia | null }> => {
    return await getPublicProjectBySlugOperation(data.slug);
  });
