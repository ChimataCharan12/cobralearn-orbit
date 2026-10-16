import { authService } from "@/lib/auth/auth-service";

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
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/password-updated",
  "/admin/session-expired",
  "/admin/access-denied",
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
 */
export function isAuthenticationError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("No cookie header provided") ||
    msg.includes("No valid Supabase session") ||
    msg.includes("JWT expired") ||
    msg.includes("token expired") ||
    msg.includes("invalid refresh token") ||
    msg.includes("session has expired") ||
    msg.startsWith("Unauthorized")
  );
}

/**
 * Checks whether an error signifies a top-level unprovisioned or deactivated administrator identity (403).
 */
export function isProfileForbiddenError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("AdminProfile not found") ||
    msg.includes("AdminProfile is deactivated")
  );
}

/**
 * Checks whether an error signifies a granular RBAC permission rejection (403).
 * NOTE: Granular RBAC permission denials MUST NOT log the user out or route to session-expired!
 */
export function isActionForbiddenError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.startsWith("Forbidden:") && !isProfileForbiddenError(err);
}

/**
 * Centralized error interceptor for administrative API calls and route guards.
 * Handles:
 * 1. Guiding 401 unauthenticated / expired sessions to /admin/session-expired and clearing stale auth.
 * 2. Guiding unprovisioned/deactivated administrators to /admin/access-denied.
 * 3. Preserving active sessions on action-level 403s.
 * 4. Preventing navigation loops on public/login routes.
 * 5. Debouncing concurrent failures to prevent duplicate navigation events.
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

    if (customNavigationHandler) {
      customNavigationHandler("/admin/session-expired");
    } else {
      window.location.assign("/admin/session-expired");
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
