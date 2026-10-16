import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  searchGlobalAdminOperation,
  type GlobalSearchResponse,
} from "./search-operations";

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
 * Server Function: Performs cross-module global search across CMS records and settings.
 * Enforces authentication and RBAC permissions.
 */
export const searchGlobalAdminServerFn = createServerFn({ method: "GET" })
  .validator((data: { query: string; authToken?: string }) => data)
  .handler(async ({ data }): Promise<GlobalSearchResponse> => {
    try {
      const request = createServerOpRequest(
        `https://api.internal/admin/search?q=${encodeURIComponent(data?.query || "")}`,
        data?.authToken,
        "GET"
      );
      return await searchGlobalAdminOperation(request, data?.query || "");
    } catch (err) {
      normalizeAuthError(err);
    }
  });
