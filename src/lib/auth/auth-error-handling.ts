import { authService } from "@/lib/auth/auth-service";
import { safeRedirect } from "@/lib/auth/safe-redirect";

export type NavigationHandler = (path: string) => void;

let customNavigationHandler: NavigationHandler | null = null;
let isNavigating = false;
let navigationTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Registers an optional client router navigation callback (e.g. TanStack Router navigate).
 */
export function setAuthNavigationHandler(handler: NavigationHandler | null) {
  customNavigationHandler = handler;
}

/**
 * Resets navigation tracking state (useful in testing or after complete redirects).
 */
export function resetAuthNavigationState() {
  isNavigating = false;
  if (navigationTimer) {
    clearTimeout(navigationTimer);
    navigationTimer = null;
  }
}

/**
 * Public and authentication transition routes where automatic redirection
 * must be suppressed to prevent navigation loops.
 */
export const EXEMPT_AUTH_ROUTES = [
  "/",
  "/admin",
  "/admin/",
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/password-updated",
  "/admin/session-expired",
  "/admin/access-denied",
  "/admin/mfa-recovery",
] as const;

/**
 * Determines whether a given pathname is an exempt route where auth redirects must NOT occur.
 */
export function isExemptRoute(pathname: string): boolean {
  if (!pathname) return false;
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (EXEMPT_AUTH_ROUTES.includes(normalized as any)) {
    return true;
  }
  if (normalized.startsWith("/auth/")) {
    return true;
  }
  return false;
}

/**
 * Checks whether an error signifies an authentication failure (401 / session expired / invalid token).
 * Normalized to lowercase for robust, case-insensitive provider message classification.
 */
export function isAuthenticationError(err: unknown): boolean {
  if (!err) return false;
  const rawMsg = err instanceof Error ? err.message : String(err);
  const msg = rawMsg.toLowerCase();
  return (
    msg.includes("no cookie header provided") ||
    msg.includes("no valid supabase session") ||
    msg.includes("jwt expired") ||
    msg.includes("token expired") ||
    msg.includes("invalid refresh token") ||
    msg.includes("session has expired") ||
    msg.startsWith("unauthorized")
  );
}

/**
 * Checks whether an error signifies that an administrator is quarantined in MFA recovery
 * and must complete mandatory factor re-enrollment.
 */
export function isMfaReenrollmentRequiredError(err: unknown): boolean {
  if (!err) return false;
  const rawMsg = err instanceof Error ? err.message : String(err);
  const msg = rawMsg.toLowerCase();
  return msg.includes("mfa_reenrollment_required");
}

/**
 * Checks whether an error signifies a top-level unprovisioned or deactivated administrator identity (403).
 */
export function isProfileForbiddenError(err: unknown): boolean {
  if (!err) return false;
  const rawMsg = err instanceof Error ? err.message : String(err);
  const msg = rawMsg.toLowerCase();
  return (
    msg.includes("adminprofile not found") ||
    msg.includes("adminprofile is deactivated")
  );
}

/**
 * Checks whether an error signifies a granular RBAC permission rejection (403).
 * NOTE: Granular RBAC permission denials MUST NOT log the user out or route to session-expired!
 */
export function isActionForbiddenError(err: unknown): boolean {
  if (!err) return false;
  const rawMsg = err instanceof Error ? err.message : String(err);
  const msg = rawMsg.toLowerCase();
  return (
    msg.startsWith("forbidden:") &&
    !isProfileForbiddenError(err) &&
    !isMfaReenrollmentRequiredError(err)
  );
}

/**
 * Centralized error interceptor for administrative API calls and route guards.
 * Handles:
 * 1. Guiding 401 unauthenticated / expired sessions to /admin/session-expired, encoding safe return paths, and clearing stale auth.
 * 2. Guiding MFA recovery quarantine errors to /admin/mfa-recovery without clearing the active re-enrollment session.
 * 3. Guiding unprovisioned/deactivated administrators to /admin/access-denied.
 * 4. Preserving active sessions on action-level 403s.
 * 5. Preventing navigation loops on public/login routes.
 * 6. Debouncing concurrent failures to prevent duplicate navigation events.
 */
export function handleAuthError(err: unknown, currentPath?: string): void {
  if (typeof window === "undefined") return;

  const pathname = currentPath ?? window.location.pathname;
  if (isExemptRoute(pathname)) {
    return;
  }

  // Prevent duplicate concurrent navigations when multiple API requests fail together
  if (isNavigating) {
    return;
  }

  if (isAuthenticationError(err)) {
    isNavigating = true;
    if (navigationTimer) clearTimeout(navigationTimer);
    navigationTimer = setTimeout(() => {
      isNavigating = false;
    }, 2500);

    // Clear stale local client auth state
    authService.signOut().catch(() => {});

    // Preserve attempted internal destination if available and not default dashboard
    const safeNext = safeRedirect(pathname, "");
    const sessionExpiredTarget =
      safeNext &&
      safeNext !== "/admin/dashboard" &&
      safeNext !== "/admin" &&
      safeNext !== "/admin/" &&
      safeNext !== "/admin/login" &&
      safeNext !== "/admin/session-expired"
        ? `/admin/session-expired?next=${encodeURIComponent(safeNext)}`
        : "/admin/session-expired";

    if (customNavigationHandler) {
      customNavigationHandler(sessionExpiredTarget);
    } else {
      window.location.assign(sessionExpiredTarget);
    }
    return;
  }

  if (isMfaReenrollmentRequiredError(err)) {
    isNavigating = true;
    if (navigationTimer) clearTimeout(navigationTimer);
    navigationTimer = setTimeout(() => {
      isNavigating = false;
    }, 2500);

    // Note: Do NOT sign out or clear session; re-enrollment requires the authenticated session!
    if (customNavigationHandler) {
      customNavigationHandler("/admin/mfa-recovery");
    } else {
      window.location.assign("/admin/mfa-recovery");
    }
    return;
  }

  if (isProfileForbiddenError(err)) {
    isNavigating = true;
    if (navigationTimer) clearTimeout(navigationTimer);
    navigationTimer = setTimeout(() => {
      isNavigating = false;
    }, 2500);

    // Deactivated or unprovisioned identity: clear local session
    authService.signOut().catch(() => {});

    if (customNavigationHandler) {
      customNavigationHandler("/admin/access-denied");
    } else {
      window.location.assign("/admin/access-denied");
    }
    return;
  }

  // Granular action-level 403: intentionally do NOT log out or navigate away
}
