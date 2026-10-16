import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { SiteSettings, AppearanceConfig } from "@prisma/client";
import {
  getGlobalSettingsOperation,
  updateGlobalSettingsOperation,
  getAppearanceConfigOperation,
  updateAppearanceConfigOperation,
  getSettingsEnvironmentStatus,
  getPublicSiteSettingsOperation,
  getPublicAppearanceConfigOperation,
  type SettingsEnvironmentStatus,
} from "@/lib/server/admin-operations";
import {
  type PublicSiteSettings,
  DEFAULT_PUBLIC_SITE_SETTINGS,
} from "@/lib/public-metadata";
import {
  type PublicAppearanceConfig,
  DEFAULT_PUBLIC_APPEARANCE_CONFIG,
} from "@/lib/public-appearance";
import {
  updateSiteSettingsSchema,
  updateAppearanceConfigSchema,
  type UpdateSiteSettingsInput,
  type UpdateAppearanceConfigInput,
} from "@/lib/validation/settings-schemas";

/**
 * Strict input schema for reading settings / environment status.
 */
export const getSettingsServerFnInputSchema = z
  .object({
    authToken: z.string({ invalid_type_error: "Auth token must be a string" }).optional(),
  })
  .strict({ message: "Unrecognized field in request input" })
  .optional();

/**
 * Strict input schema for updateGlobalSettingsServerFn.
 */
export const updateGlobalSettingsServerFnInputSchema = z
  .object({
    settings: updateSiteSettingsSchema,
    authToken: z.string({ invalid_type_error: "Auth token must be a string" }).optional(),
  })
  .strict({ message: "Unrecognized field in updateGlobalSettingsServerFn input" });

/**
 * Strict input schema for updateAppearanceConfigServerFn.
 */
export const updateAppearanceConfigServerFnInputSchema = z
  .object({
    appearance: updateAppearanceConfigSchema,
    authToken: z.string({ invalid_type_error: "Auth token must be a string" }).optional(),
  })
  .strict({ message: "Unrecognized field in updateAppearanceConfigServerFn input" });

/**
 * Normalizes internal errors into safe, client-facing error responses.
 * - Preserves 401 Unauthorized and 403 Forbidden status messages.
 * - Preserves 400 Validation Error messages.
 * - Redacts raw database, SQL, token, or internal system errors into generic 500 errors.
 */
export function normalizeAuthError(err: unknown): never {
  if (err instanceof z.ZodError) {
    const issues = err.issues.map((i) => `${i.path.join(".") || "payload"}: ${i.message}`).join("; ");
    throw new Error(`Validation Error: Invalid input parameters (${issues})`);
  }

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
    console.error("[SettingsServerFn Error]:", err instanceof Error ? err.name : "UnknownError");
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

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  return new Request(url, { method, headers });
}

export type { SettingsEnvironmentStatus };

/**
 * Server Function: Safely returns whether external provider credentials are configured
 * on the server environment. Never exposes secret keys or tokens to the browser.
 * Turnstile is reported configured ONLY if the server-side secret key exists.
 */
export const getSettingsEnvironmentStatusServerFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => {
    const parsed = getSettingsServerFnInputSchema.safeParse(data);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "data"}: ${i.message}`).join("; ");
      throw new Error(`Validation Error: Invalid input (${issues})`);
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<{ status: SettingsEnvironmentStatus }> => {
    try {
      const req = createServerOpRequest(
        "https://internal.cobralearn.portal/api/admin/settings/env-status",
        data?.authToken
      );
      return await getSettingsEnvironmentStatus(req);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Reads global site settings configuration from PostgreSQL.
 * Requires SETTINGS_READ (SUPER_ADMIN, ADMIN, EDITOR).
 */
export const getGlobalSettingsServerFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => {
    const parsed = getSettingsServerFnInputSchema.safeParse(data);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "data"}: ${i.message}`).join("; ");
      throw new Error(`Validation Error: Invalid input (${issues})`);
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<{ settings: SiteSettings | null }> => {
    try {
      const req = createServerOpRequest(
        "https://internal.cobralearn.portal/api/admin/settings",
        data?.authToken
      );
      const settings = await getGlobalSettingsOperation(req);
      return { settings };
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Updates global site settings configuration in PostgreSQL.
 * Requires SETTINGS_UPDATE (SUPER_ADMIN only).
 * Performs strict runtime validation against updateSiteSettingsSchema.
 */
export const updateGlobalSettingsServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = updateGlobalSettingsServerFnInputSchema.safeParse(data);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "payload"}: ${i.message}`).join("; ");
      throw new Error(`Validation Error: Invalid settings update payload (${issues})`);
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<{ settings: SiteSettings }> => {
    try {
      const req = createServerOpRequest(
        "https://internal.cobralearn.portal/api/admin/settings",
        data.authToken,
        "POST"
      );
      const settings = await updateGlobalSettingsOperation(req, {
        settings: data.settings,
      });
      return { settings };
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Reads global appearance configuration from PostgreSQL.
 * Requires APPEARANCE_READ (SUPER_ADMIN, ADMIN, EDITOR).
 */
export const getAppearanceConfigServerFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => {
    const parsed = getSettingsServerFnInputSchema.safeParse(data);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "data"}: ${i.message}`).join("; ");
      throw new Error(`Validation Error: Invalid input (${issues})`);
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<{ appearance: AppearanceConfig | null }> => {
    try {
      const req = createServerOpRequest(
        "https://internal.cobralearn.portal/api/admin/appearance",
        data?.authToken
      );
      const appearance = await getAppearanceConfigOperation(req);
      return { appearance };
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Updates global appearance configuration in PostgreSQL.
 * Requires APPEARANCE_UPDATE (SUPER_ADMIN and ADMIN only).
 * Performs strict runtime validation against updateAppearanceConfigSchema.
 */
export const updateAppearanceConfigServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = updateAppearanceConfigServerFnInputSchema.safeParse(data);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "payload"}: ${i.message}`).join("; ");
      throw new Error(`Validation Error: Invalid appearance update payload (${issues})`);
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<{ appearance: AppearanceConfig }> => {
    try {
      const req = createServerOpRequest(
        "https://internal.cobralearn.portal/api/admin/appearance",
        data.authToken,
        "POST"
      );
      const appearance = await updateAppearanceConfigOperation(req, {
        appearance: data.appearance,
      });
      return { appearance };
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Reads public-safe site settings metadata.
 * Unauthenticated and safe for public visitors.
 * Always resolves with safe fallback settings on error.
 */
export const getPublicSiteSettingsServerFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ settings: PublicSiteSettings }> => {
    try {
      const settings = await getPublicSiteSettingsOperation();
      return { settings };
    } catch {
      return { settings: DEFAULT_PUBLIC_SITE_SETTINGS };
    }
  });

/**
 * Server Function: Reads public-safe appearance configuration.
 * Unauthenticated and safe for public visitors.
 * Always resolves with safe fallback appearance settings on error.
 */
export const getPublicAppearanceConfigServerFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ appearance: PublicAppearanceConfig }> => {
    try {
      const appearance = await getPublicAppearanceConfigOperation();
      return { appearance };
    } catch {
      return { appearance: DEFAULT_PUBLIC_APPEARANCE_CONFIG };
    }
  });

