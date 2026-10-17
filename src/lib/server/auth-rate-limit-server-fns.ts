import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  evaluateLoginRateLimitOperation,
  requestPasswordResetOperation,
  recordPasswordResetCompletionOperation,
  changeAdminPasswordOperation,
  type EvaluateLoginPayload,
  type EvaluateLoginResult,
  type RequestPasswordResetPayload,
  type RequestPasswordResetResult,
  type RecordPasswordResetCompletionPayload,
  type RecordPasswordResetCompletionResult,
  type ChangeAdminPasswordPayload,
  type ChangeAdminPasswordResult,
} from "@/lib/server/auth-rate-limit-operations";

/**
 * Creates an internal Request object capturing headers from the ambient TanStack Start server request.
 */
function createAmbientRequest(url: string, method: string = "POST", body?: unknown): Request {
  const headers = new Headers();

  try {
    const incomingReq = getRequest();
    if (incomingReq) {
      // Forward cookie, auth, and user agent
      const cookie = incomingReq.headers.get("cookie");
      if (cookie) headers.set("Cookie", cookie);

      const auth = incomingReq.headers.get("authorization");
      if (auth) headers.set("Authorization", auth);

      const ua = incomingReq.headers.get("user-agent");
      if (ua) headers.set("User-Agent", ua);

      const origin = incomingReq.headers.get("origin");
      if (origin) headers.set("Origin", origin);

      const referer = incomingReq.headers.get("referer");
      if (referer) headers.set("Referer", referer);

      // Forward proxy IP headers
      const cfIp = incomingReq.headers.get("cf-connecting-ip");
      if (cfIp) headers.set("cf-connecting-ip", cfIp);

      const trueClientIp = incomingReq.headers.get("true-client-ip");
      if (trueClientIp) headers.set("true-client-ip", trueClientIp);

      const realIp = incomingReq.headers.get("x-real-ip");
      if (realIp) headers.set("x-real-ip", realIp);

      const forwarded = incomingReq.headers.get("x-forwarded-for");
      if (forwarded) headers.set("x-forwarded-for", forwarded);
    }
  } catch {
    // Non-HTTP context (e.g. unit test)
  }

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  return new Request(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Server Function: Pre-flight rate-limit evaluation before authentication attempt.
 */
export const evaluateLoginRateLimitServerFn = createServerFn({ method: "POST" })
  .validator((data: EvaluateLoginPayload) => data)
  .handler(async ({ data }): Promise<EvaluateLoginResult> => {
    const request = createAmbientRequest("https://api.internal/auth/rate-limit/login", "POST", data);
    return await evaluateLoginRateLimitOperation(request, data);
  });

/**
 * Server Function: Request password reset with server-enforced rate limiting and generic responses.
 */
export const requestPasswordResetServerFn = createServerFn({ method: "POST" })
  .validator((data: RequestPasswordResetPayload) => data)
  .handler(async ({ data }): Promise<RequestPasswordResetResult> => {
    const request = createAmbientRequest("https://api.internal/auth/rate-limit/recovery", "POST", data);
    return await requestPasswordResetOperation(request, data);
  });

/**
 * Server Function: Authoritatively records password reset completion in AdminAuditLog.
 */
export const recordPasswordResetCompletionServerFn = createServerFn({ method: "POST" })
  .validator((data: RecordPasswordResetCompletionPayload) => data)
  .handler(async ({ data }): Promise<RecordPasswordResetCompletionResult> => {
    const request = createAmbientRequest("https://api.internal/auth/rate-limit/reset-completion", "POST", data);
    return await recordPasswordResetCompletionOperation(request, data);
  });

/**
 * Server Function: Authoritatively executes administrator password change at AAL2.
 */
export const changeAdminPasswordServerFn = createServerFn({ method: "POST" })
  .validator((data: ChangeAdminPasswordPayload) => data)
  .handler(async ({ data }): Promise<ChangeAdminPasswordResult> => {
    const request = createAmbientRequest("https://api.internal/auth/change-password", "POST", data);
    return await changeAdminPasswordOperation(request, data);
  });
