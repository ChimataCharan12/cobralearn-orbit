import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import {
  handleAuthError,
  setAuthNavigationHandler,
  resetAuthNavigationState,
  isExemptRoute,
  isAuthenticationError,
  isProfileForbiddenError,
  isActionForbiddenError,
  isMfaReenrollmentRequiredError,
} from "@/lib/auth/auth-error-handling";
import { authService } from "@/lib/auth/auth-service";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { AccessDeniedCard } from "@/components/auth/AccessDeniedCard";
import { Route as AdminLoginRoute } from "@/routes/admin/login";

// Mock router navigation
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Phase 6.4 — Session Lifecycle & Authentication Error Handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    resetAuthNavigationState();
    setAuthNavigationHandler(mockNavigate);
  });

  afterEach(() => {
    resetAuthNavigationState();
    setAuthNavigationHandler(null);
  });

  // =========================================================================
  // Requirement 1: Case-insensitive expired/invalid-refresh-token error handling
  // =========================================================================
  describe("1. Case-Insensitive Authentication Error Classification", () => {
    it("classifies uppercase and mixed-case refresh and token errors as authentication errors", () => {
      expect(isAuthenticationError(new Error("INVALID REFRESH TOKEN"))).toBe(true);
      expect(isAuthenticationError(new Error("Invalid Refresh Token: Token expired or revoked"))).toBe(true);
      expect(isAuthenticationError(new Error("Token Expired"))).toBe(true);
      expect(isAuthenticationError(new Error("JWT EXPIRED"))).toBe(true);
      expect(isAuthenticationError(new Error("Session Has Expired"))).toBe(true);
      expect(isAuthenticationError(new Error("NO COOKIE HEADER PROVIDED"))).toBe(true);
      expect(isAuthenticationError(new Error("UNAUTHORIZED: Session invalid"))).toBe(true);
      expect(isAuthenticationError(new Error("Unauthorized: Valid administrative session required"))).toBe(true);
    });

    it("triggers sign-out and session-expired navigation on uppercase INVALID REFRESH TOKEN", () => {
      const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValueOnce({
        data: null,
        error: null,
      });

      handleAuthError(new Error("INVALID REFRESH TOKEN"), "/admin/settings");

      expect(signOutSpy).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/admin/session-expired?next=%2Fadmin%2Fsettings");
    });
  });

  // =========================================================================
  // Requirement 2: MFA re-enrollment errors navigating to /admin/mfa-recovery
  // =========================================================================
  describe("2. MFA Recovery Quarantine Error Handling", () => {
    it("correctly identifies MFA_REENROLLMENT_REQUIRED as quarantine error and not generic action 403", () => {
      const err = new Error("Forbidden: MFA_REENROLLMENT_REQUIRED");
      expect(isMfaReenrollmentRequiredError(err)).toBe(true);
      expect(isActionForbiddenError(err)).toBe(false);
      expect(isProfileForbiddenError(err)).toBe(false);
      expect(isAuthenticationError(err)).toBe(false);
    });

    it("routes to /admin/mfa-recovery without clearing the active re-enrollment session", () => {
      const signOutSpy = vi.spyOn(authService, "signOut");

      handleAuthError(new Error("Forbidden: MFA_REENROLLMENT_REQUIRED"), "/admin/dashboard");

      // Critical: Must preserve the authenticated session for factor re-enrollment!
      expect(signOutSpy).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/admin/mfa-recovery");
    });
  });

  // =========================================================================
  // Requirement 3: Access Denied action safely navigating to /admin
  // =========================================================================
  describe("3. AccessDeniedCard Navigation", () => {
    it("renders 'Return to Sign In' and navigates to canonical /admin route", async () => {
      render(<AccessDeniedCard />);

      const returnButton = screen.getByRole("button", { name: /return to sign in/i });
      expect(returnButton).toBeDefined();

      await act(async () => {
        returnButton.click();
      });

      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin" });
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/dashboard" });
    });
  });

  // =========================================================================
  // Requirement 4: /admin/login redirecting to /admin
  // =========================================================================
  describe("4. /admin/login Route Alias", () => {
    it("is recognized as an exempt route preventing redirect loops", () => {
      expect(isExemptRoute("/admin/login")).toBe(true);
      expect(isExemptRoute("/admin/login/")).toBe(true);
    });

    it("redirects to canonical /admin route in beforeLoad", () => {
      const beforeLoad = (AdminLoginRoute.options as any).beforeLoad;
      expect(typeof beforeLoad).toBe("function");

      try {
        beforeLoad({ search: {} });
        expect.unreachable("beforeLoad should have thrown a redirect");
      } catch (redirectError: any) {
        expect(redirectError).toBeDefined();
        const targetTo = redirectError?.options?.to ?? redirectError?.to;
        expect(targetTo).toBe("/admin");
      }
    });

    it("preserves safe return parameter next through the redirect", () => {
      const beforeLoad = (AdminLoginRoute.options as any).beforeLoad;

      try {
        beforeLoad({ search: { next: "/admin/profile/security" } });
        expect.unreachable("beforeLoad should have thrown a redirect");
      } catch (redirectError: any) {
        expect(redirectError).toBeDefined();
        const targetTo = redirectError?.options?.to ?? redirectError?.to;
        const targetSearch = redirectError?.options?.search ?? redirectError?.search;
        expect(targetTo).toBe("/admin");
        expect(targetSearch).toEqual({ next: "/admin/profile/security" });
      }
    });
  });

  // =========================================================================
  // Requirement 5 & 6: Safe return-path preservation and rejection of unsafe targets
  // =========================================================================
  describe("5 & 6. Return Destination Preservation & Security", () => {
    it("preserves internal deep links as encoded next parameter", () => {
      vi.spyOn(authService, "signOut").mockResolvedValueOnce({ data: null, error: null });

      handleAuthError(new Error("Token Expired"), "/admin/audit-logs");
      expect(mockNavigate).toHaveBeenCalledWith("/admin/session-expired?next=%2Fadmin%2Faudit-logs");
    });

    it("falls back to clean /admin/session-expired when on default /admin/dashboard", () => {
      vi.spyOn(authService, "signOut").mockResolvedValueOnce({ data: null, error: null });

      handleAuthError(new Error("Token Expired"), "/admin/dashboard");
      expect(mockNavigate).toHaveBeenCalledWith("/admin/session-expired");
    });

    it("rejects external phishing URLs and protocol-relative URLs without query param leakage", () => {
      vi.spyOn(authService, "signOut").mockResolvedValue({ data: null, error: null });

      handleAuthError(new Error("Token Expired"), "https://evil.attacker.com/steal-creds");
      expect(mockNavigate).toHaveBeenCalledWith("/admin/session-expired");

      resetAuthNavigationState();
      handleAuthError(new Error("Token Expired"), "//evil.com");
      expect(mockNavigate).toHaveBeenCalledWith("/admin/session-expired");

      resetAuthNavigationState();
      handleAuthError(new Error("Token Expired"), "javascript:alert(document.cookie)");
      expect(mockNavigate).toHaveBeenCalledWith("/admin/session-expired");
    });

    it("safeRedirect correctly sanitizes internal and dangerous paths", () => {
      expect(safeRedirect("/admin/profile")).toBe("/admin/profile");
      expect(safeRedirect("/admin/settings?tab=general")).toBe("/admin/settings?tab=general");
      expect(safeRedirect("https://attacker.com", "/admin/dashboard")).toBe("/admin/dashboard");
      expect(safeRedirect("//attacker.com", "/admin/dashboard")).toBe("/admin/dashboard");
      expect(safeRedirect("javascript:alert(1)", "/admin/dashboard")).toBe("/admin/dashboard");
      expect(safeRedirect("", "/admin/dashboard")).toBe("/admin/dashboard");
      expect(safeRedirect(null, "/admin/dashboard")).toBe("/admin/dashboard");
    });
  });

  // =========================================================================
  // Requirement 7: Redirect-loop prevention and exempt-route behavior
  // =========================================================================
  describe("7. Redirect-Loop Prevention on Exempt Routes", () => {
    it("suppresses redirects when error occurs on exempt routes", () => {
      const authErr = new Error("Unauthorized: Valid session required");

      handleAuthError(authErr, "/admin/session-expired");
      expect(mockNavigate).not.toHaveBeenCalled();

      handleAuthError(authErr, "/admin/access-denied");
      expect(mockNavigate).not.toHaveBeenCalled();

      handleAuthError(authErr, "/admin");
      expect(mockNavigate).not.toHaveBeenCalled();

      handleAuthError(authErr, "/admin/");
      expect(mockNavigate).not.toHaveBeenCalled();

      handleAuthError(authErr, "/admin/login");
      expect(mockNavigate).not.toHaveBeenCalled();

      handleAuthError(authErr, "/admin/mfa-recovery");
      expect(mockNavigate).not.toHaveBeenCalled();

      handleAuthError(authErr, "/admin/forgot-password");
      expect(mockNavigate).not.toHaveBeenCalled();

      handleAuthError(authErr, "/admin/reset-password");
      expect(mockNavigate).not.toHaveBeenCalled();

      handleAuthError(authErr, "/auth/callback");
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Requirement 8: Ordinary network failures not causing unnecessary sign-out
  // =========================================================================
  describe("8. Network Failure Isolation", () => {
    it("does not classify generic network errors as authentication failures", () => {
      expect(isAuthenticationError(new TypeError("Failed to fetch"))).toBe(false);
      expect(isAuthenticationError(new Error("NetworkError when attempting to fetch resource"))).toBe(false);
      expect(isAuthenticationError(new Error("ECONNREFUSED: Connection refused"))).toBe(false);
      expect(isAuthenticationError(new Error("Request timeout after 5000ms"))).toBe(false);
    });

    it("does not sign out user or redirect to session-expired on network failures", () => {
      const signOutSpy = vi.spyOn(authService, "signOut");

      handleAuthError(new TypeError("Failed to fetch"), "/admin/projects");

      expect(signOutSpy).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Requirement 9: Existing Phase 4–6 protections remain intact
  // =========================================================================
  describe("9. Phase 4–6 Regression Compatibility", () => {
    it("preserves AAL2 challenge step-up without signing out user", () => {
      const signOutSpy = vi.spyOn(authService, "signOut");
      const aal2Err = new Error("Forbidden: AAL2_REQUIRED");

      expect(isAuthenticationError(aal2Err)).toBe(false);
      expect(isProfileForbiddenError(aal2Err)).toBe(false);
      expect(isActionForbiddenError(aal2Err)).toBe(true);

      handleAuthError(aal2Err, "/admin/audit-logs");

      expect(signOutSpy).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("preserves granular role permission denials without signing out user", () => {
      const signOutSpy = vi.spyOn(authService, "signOut");
      const roleErr = new Error('Forbidden: Role "EDITOR" lacks required permission: "admin:manage"');

      expect(isAuthenticationError(roleErr)).toBe(false);
      expect(isProfileForbiddenError(roleErr)).toBe(false);
      expect(isActionForbiddenError(roleErr)).toBe(true);

      handleAuthError(roleErr, "/admin/team");

      expect(signOutSpy).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("signs out and routes to /admin/access-denied when administrator is deactivated", () => {
      const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValueOnce({ data: null, error: null });
      const deactivatedErr = new Error("Forbidden: AdminProfile is deactivated");

      expect(isAuthenticationError(deactivatedErr)).toBe(false);
      expect(isProfileForbiddenError(deactivatedErr)).toBe(true);
      expect(isActionForbiddenError(deactivatedErr)).toBe(false);

      handleAuthError(deactivatedErr, "/admin/dashboard");

      expect(signOutSpy).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/admin/access-denied");
    });
  });
});
