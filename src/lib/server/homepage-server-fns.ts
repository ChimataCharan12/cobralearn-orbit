import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  listAdminHomepageSectionsOperation,
  updateAdminHomepageSectionOperation,
  createAdminHomepageSectionOperation,
  reorderAdminHomepageSectionsOperation,
  deleteAdminHomepageSectionOperation,
  getPublicHomepageSectionsOperation,
  type HomepageSectionWithMedia,
  type CreateHomepageSectionPayload,
  type UpdateHomepageSectionPayload,
} from "@/lib/server/homepage-operations";

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
 */
function createServerOpRequest(url: string, authToken?: string, method: string = "GET", body?: unknown): Request {
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
    // Graceful fallback for non-HTTP test contexts
  }

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

// =========================================================================
// 1. ADMIN PROTECTED SERVER FUNCTIONS
// =========================================================================

export const listAdminHomepageSectionsServerFn = createServerFn({ method: "GET" })
  .validator((data?: { authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<{ sections: HomepageSectionWithMedia[] }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/homepage-sections", data?.authToken, "GET");
      return await listAdminHomepageSectionsOperation(request);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const updateAdminHomepageSectionServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateHomepageSectionPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ section: HomepageSectionWithMedia }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/homepage-sections/${data.id}`, data.authToken, "POST", data.payload);
      return await updateAdminHomepageSectionOperation(request, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const createAdminHomepageSectionServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: CreateHomepageSectionPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ section: HomepageSectionWithMedia }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/homepage-sections", data.authToken, "POST", data.payload);
      return await createAdminHomepageSectionOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const reorderAdminHomepageSectionsServerFn = createServerFn({ method: "POST" })
  .validator((data: { orderedIds: string[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/homepage-sections/reorder", data.authToken, "POST", { orderedIds: data.orderedIds });
      return await reorderAdminHomepageSectionsOperation(request, data.orderedIds);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const deleteAdminHomepageSectionServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ deletedId: string }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/homepage-sections/${data.id}/delete`, data.authToken, "POST");
      return await deleteAdminHomepageSectionOperation(request, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 2. PUBLIC SERVER FUNCTIONS
// =========================================================================

export const getPublicHomepageSectionsServerFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ sections: HomepageSectionWithMedia[] }> => {
    return await getPublicHomepageSectionsOperation();
  });
