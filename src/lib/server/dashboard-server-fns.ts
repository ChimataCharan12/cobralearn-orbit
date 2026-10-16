import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  getDashboardDataOperation,
  type DashboardDataResult,
} from "@/lib/server/dashboard-operations";

/**
 * Normalizes internal errors into safe, client-facing error responses.
 * - Preserves 401 Unauthorized and 403 Forbidden status messages.
 * - Preserves 400 Validation Error messages.
 * - Redacts raw database, SQL, token, or internal system errors into generic 500 errors.
 */
export function normalizeAuthError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);

  // 1. Authentication failures (401)
  if (
    msg.includes("No cookie header provided") ||
    msg.includes("No valid Supabase session") ||
    msg.startsWith("Unauthorized")
  ) {
    throw new Error("Unauthorized: Valid administrative session required");
  }

  // 2. Authorization / Permission failures (403)
  if (msg.startsWith("Forbidden")) {
    const sanitized = msg.replace(/([a-zA-Z0-9_-]+\.){2,}[a-zA-Z0-9_-]+/g, "[REDACTED_TOKEN]");
    throw new Error(sanitized);
  }

  // 3. Application validation failures (400)
  if (msg.startsWith("Validation Error")) {
    throw new Error(msg);
  }

  // 4. Diagnostic server-side error logging (safe; suppresses in test runner to keep outputs clean)
  if (process.env.NODE_ENV !== "test") {
    console.error("[DashboardServerFn Error]:", err instanceof Error ? err.name : "UnknownError");
  }

  // 5. Generic safe server error (500)
  throw new Error("Internal server error: An unexpected error occurred while processing the request");
}

/**
 * Creates an authenticated internal Request object for server operations.
 * Preserves incoming HTTP Cookie headers and Authorization headers from the server context.
 */
function createServerOpRequest(
  url: string,
  authToken?: string,
  method: string = "GET"
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
    }
  } catch {
    // Graceful fallback for non-HTTP environments (e.g. Unit tests)
  }

  // 2. Explicit client authToken payload takes precedence for Bearer Authorization
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  return new Request(url, { method, headers });
}

/**
 * Server Function: Loads real aggregated dashboard statistics, recent activity,
 * showcase items, and media telemetry from PostgreSQL.
 */
export const getDashboardDataServerFn = createServerFn({ method: "GET" })
  .validator((data?: { authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<{ dashboard: DashboardDataResult }> => {
    try {
      const req = createServerOpRequest(
        "https://internal.cobralearn.portal/api/admin/dashboard",
        data?.authToken
      );
      const result = await getDashboardDataOperation(req);
      return { dashboard: result };
    } catch (err) {
      normalizeAuthError(err);
    }
  });
