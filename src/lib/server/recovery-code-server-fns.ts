import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  generateRecoveryCodesOperation,
  getRecoveryCodeStatusOperation,
  verifyAndRedeemRecoveryCodeOperation,
  type GenerateRecoveryCodesResult,
  type RecoveryCodeStatusResult,
  type VerifyRecoveryCodePayload,
  type VerifyRecoveryCodeResult,
} from "@/lib/server/recovery-code-operations";

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
      const incomingUa = incomingReq.headers.get("user-agent");
      if (incomingUa) {
        headers.set("User-Agent", incomingUa);
      }
      const incomingXff = incomingReq.headers.get("x-forwarded-for");
      if (incomingXff) {
        headers.set("x-forwarded-for", incomingXff);
      }
    }
  } catch {
    // Fallback for non-HTTP environments (e.g. unit tests)
  }

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    return new Request(url, {
      method,
      headers,
      body: JSON.stringify(body),
    });
  }

  return new Request(url, { method, headers });
}

/**
 * Server Function: Generates a fresh set of 8 single-use recovery codes.
 * Requires active administrator with verified AAL2 elevation.
 */
export const generateRecoveryCodesServerFn = createServerFn({ method: "POST" })
  .validator((data?: { authToken?: string }) => data)
  .handler(async ({ data }): Promise<GenerateRecoveryCodesResult> => {
    try {
      const req = createServerOpRequest(
        "https://internal.cobralearn.portal/api/admin/recovery-codes/generate",
        data?.authToken,
        "POST"
      );
      return await generateRecoveryCodesOperation(req);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Retrieves recovery code count and status metadata.
 */
export const getRecoveryCodeStatusServerFn = createServerFn({ method: "GET" })
  .validator((data?: { authToken?: string }) => data)
  .handler(async ({ data }): Promise<RecoveryCodeStatusResult> => {
    try {
      const req = createServerOpRequest(
        "https://internal.cobralearn.portal/api/admin/recovery-codes/status",
        data?.authToken,
        "GET"
      );
      return await getRecoveryCodeStatusOperation(req);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Verifies and redeems a single-use recovery code.
 */
export const verifyAndRedeemRecoveryCodeServerFn = createServerFn({ method: "POST" })
  .validator((data: VerifyRecoveryCodePayload) => data)
  .handler(async ({ data }): Promise<VerifyRecoveryCodeResult> => {
    try {
      const req = createServerOpRequest(
        "https://internal.cobralearn.portal/api/admin/recovery-codes/redeem",
        undefined,
        "POST",
        data
      );
      return await verifyAndRedeemRecoveryCodeOperation(req, data);
    } catch (err) {
      normalizeAuthError(err);
    }
  });
