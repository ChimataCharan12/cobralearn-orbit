import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  emergencyMfaResetOperation,
  completeMfaReenrollmentOperation,
  reconcileMfaRecoveryOperation,
  getMfaRecoveryStatusOperation,
  type EmergencyMfaResetPayload,
  type EmergencyMfaResetResult,
  type CompleteMfaReenrollmentResult,
  type ReconcileMfaRecoveryPayload,
  type ReconcileMfaRecoveryResult,
} from "@/lib/server/admin-operations";
import type { AdminMfaRecovery } from "@/lib/auth/mfa-recovery-types";

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
    }
  } catch {
    // Graceful fallback for non-HTTP environments (e.g. Unit tests)
  }

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

/**
 * Server Function: Track A Peer Emergency MFA Reset
 */
export const emergencyMfaResetServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: EmergencyMfaResetPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<EmergencyMfaResetResult> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/mfa/emergency-reset",
        data.authToken,
        "POST",
        data.payload
      );
      return await emergencyMfaResetOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Phase 4 Verified MFA Re-enrollment Completion
 */
export const completeMfaReenrollmentServerFn = createServerFn({ method: "POST" })
  .validator((data?: { authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<CompleteMfaReenrollmentResult> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/mfa/complete-reenrollment",
        data?.authToken,
        "POST"
      );
      return await completeMfaReenrollmentOperation(request);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Phase 5 MFA Recovery Reconciliation
 */
export const reconcileMfaRecoveryServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: ReconcileMfaRecoveryPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<ReconcileMfaRecoveryResult> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/mfa/reconcile",
        data.authToken,
        "POST",
        data.payload
      );
      return await reconcileMfaRecoveryOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

/**
 * Server Function: Inspect MFA Recovery Status
 */
export const getMfaRecoveryStatusServerFn = createServerFn({ method: "GET" })
  .validator((data?: { targetId?: string; authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<{ pending: boolean; recovery: AdminMfaRecovery | null }> => {
    try {
      const request = createServerOpRequest(
        "https://api.internal/admin/mfa/recovery-status",
        data?.authToken,
        "GET"
      );
      return await getMfaRecoveryStatusOperation(request, data?.targetId);
    } catch (err) {
      normalizeAuthError(err);
    }
  });
