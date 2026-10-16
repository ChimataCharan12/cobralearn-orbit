import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth, useAuthGuard } from "@/lib/auth/use-auth";
import { authService } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";
import {
  handleAuthError,
  setAuthNavigationHandler,
  resetAuthNavigationState,
  isExemptRoute,
  isAuthenticationError,
  isProfileForbiddenError,
  isActionForbiddenError,
} from "@/lib/auth/auth-error-handling";
import { AdminPortalBoundary } from "@/components/auth/AdminPortalBoundary";
import { AdminPermissions, canPerform } from "@/lib/auth/rbac";
import type { Session, User } from "@supabase/supabase-js";
import type { AdminProfile } from "@prisma/client";

// Mock router navigation
const mockNavigate = vi.fn();
let mockCurrentPath = "/admin/dashboard";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useRouter: () => ({
    navigate: mockNavigate,
    state: {
      location: {
        pathname: mockCurrentPath,
      },
    },
  }),
}));

describe("Phase 2 — CobraLearn Orbit Authentication Boundary & Route Protection", () => {
  const activeAdminUuid = "11111111-1111-4111-8111-111111111111";
  const inactiveAdminUuid = "22222222-2222-4222-8222-222222222222";
  const nonAdminUuid = "33333333-3333-4333-8333-333333333333";

  const mockActiveUser: User = {
    id: activeAdminUuid,
    email: "superadmin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const mockInactiveUser: User = {
    id: inactiveAdminUuid,
    email: "inactive@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const mockNonAdminUser: User = {
    id: nonAdminUuid,
    email: "nonadmin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const mockActiveProfile: AdminProfile = {
    id: activeAdminUuid,
    email: "superadmin@cobralearn.com",
    fullName: "Super Admin",
    role: "SUPER_ADMIN",
    isActive: true,
    phone: null,
    designation: null,
    bio: null,
    avatarUrl: null,
    preferences: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockInactiveProfile: AdminProfile = {
    id: inactiveAdminUuid,
    email: "inactive@cobralearn.com",
    fullName: "Inactive Admin",
    role: "ADMIN",
    isActive: false,
    phone: null,
    designation: null,
    bio: null,
    avatarUrl: null,
    preferences: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    resetAuthNavigationState();
    mockCurrentPath = "/admin/dashboard";
    setAuthNavigationHandler(mockNavigate);
  });

  afterEach(() => {
    setAuthNavigationHandler(null);
    resetAuthNavigationState();
  });

  // =========================================================================
  // Requirement 1: Valid active administrator login
  // =========================================================================
  it("Requirement 1: Valid active administrator login succeeds and confirms eligibility", async () => {
    const mockSession: Session = {
      access_token: "valid-admin-token",
      refresh_token: "valid-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user: mockActiveUser,
    };

    vi.spyOn(authService, "getSession").mockResolvedValue(null);

    vi.spyOn(authService, "signIn").mockResolvedValue({
      data: { user: mockActiveUser, session: mockSession },
      error: null,
    });

    vi.spyOn(adminClient, "getSelfProfile").mockResolvedValue({
      success: true,
      data: mockActiveProfile,
    });

    function TestLoginComponent() {
      const { signIn, isEligibleAdmin, adminProfile } = useAuth();
      const [loginSuccess, setLoginSuccess] = React.useState(false);

      const handleLogin = async () => {
        const res = await signIn("superadmin@cobralearn.com", "Password123!");
        if (res.data) setLoginSuccess(true);
      };

      return (
        <div>
          <button onClick={handleLogin}>Log In</button>
          <span data-testid="success">{loginSuccess ? "LOGGED_IN" : "LOGGED_OUT"}</span>
          <span data-testid="eligible">{isEligibleAdmin ? "ELIGIBLE" : "INELIGIBLE"}</span>
          <span data-testid="role">{adminProfile?.role || "NO_ROLE"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestLoginComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByRole("button", { name: "Log In" });
    await act(async () => {
      loginButton.click();
    });

    expect(screen.getByTestId("success").textContent).toBe("LOGGED_IN");
    expect(screen.getByTestId("eligible").textContent).toBe("ELIGIBLE");
    expect(screen.getByTestId("role").textContent).toBe("SUPER_ADMIN");
  });

  // =========================================================================
  // Requirement 2: Missing administrator profile (Fail Closed)
  // =========================================================================
  it("Requirement 2: Missing administrator profile rejects login, signs out, and stays unauthenticated", async () => {
    const mockSession: Session = {
      access_token: "unprovisioned-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: mockNonAdminUser,
    };

    vi.spyOn(authService, "signIn").mockResolvedValueOnce({
      data: { user: mockNonAdminUser, session: mockSession },
      error: null,
    });

    const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValueOnce({
      data: null,
      error: null,
    });

    vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
      success: false,
      error: "Forbidden: AdminProfile not found for authenticated user",
    });

    function TestMissingProfileComponent() {
      const { signIn, isEligibleAdmin, isAuthenticated } = useAuth();
      const [errorMsg, setErrorMsg] = React.useState("");

      const handleLogin = async () => {
        const res = await signIn("nonadmin@cobralearn.com", "Password123!");
        if (res.error) setErrorMsg(res.error.message);
      };

      return (
        <div>
          <button onClick={handleLogin}>Log In</button>
          <span data-testid="error">{errorMsg}</span>
          <span data-testid="auth">{isAuthenticated ? "AUTH" : "UNAUTH"}</span>
          <span data-testid="eligible">{isEligibleAdmin ? "ELIGIBLE" : "INELIGIBLE"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestMissingProfileComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByRole("button", { name: "Log In" });
    await act(async () => {
      loginButton.click();
    });

    // Fails closed with generic error message
    expect(screen.getByTestId("error").textContent).toBe("Invalid email or password.");
    expect(screen.getByTestId("auth").textContent).toBe("UNAUTH");
    expect(screen.getByTestId("eligible").textContent).toBe("INELIGIBLE");
    expect(signOutSpy).toHaveBeenCalled();
  });

  // =========================================================================
  // Requirement 3: Inactive administrator profile (Fail Closed)
  // =========================================================================
  it("Requirement 3: Inactive administrator profile rejects login, purges session, and displays generic error", async () => {
    const mockSession: Session = {
      access_token: "inactive-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: mockInactiveUser,
    };

    vi.spyOn(authService, "signIn").mockResolvedValueOnce({
      data: { user: mockInactiveUser, session: mockSession },
      error: null,
    });

    const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValueOnce({
      data: null,
      error: null,
    });

    vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
      success: true,
      data: mockInactiveProfile, // isActive === false
    });

    function TestInactiveProfileComponent() {
      const { signIn, isEligibleAdmin, isAuthenticated } = useAuth();
      const [errorMsg, setErrorMsg] = React.useState("");

      const handleLogin = async () => {
        const res = await signIn("inactive@cobralearn.com", "Password123!");
        if (res.error) setErrorMsg(res.error.message);
      };

      return (
        <div>
          <button onClick={handleLogin}>Log In</button>
          <span data-testid="error">{errorMsg}</span>
          <span data-testid="auth">{isAuthenticated ? "AUTH" : "UNAUTH"}</span>
          <span data-testid="eligible">{isEligibleAdmin ? "ELIGIBLE" : "INELIGIBLE"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestInactiveProfileComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByRole("button", { name: "Log In" });
    await act(async () => {
      loginButton.click();
    });

    expect(screen.getByTestId("error").textContent).toBe("Invalid email or password.");
    expect(screen.getByTestId("auth").textContent).toBe("UNAUTH");
    expect(screen.getByTestId("eligible").textContent).toBe("INELIGIBLE");
    expect(signOutSpy).toHaveBeenCalled();
  });

  // =========================================================================
  // Requirement 4: Authenticated non-admin user redirected from portal
  // =========================================================================
  it("Requirement 4: Authenticated user without active AdminProfile is redirected to /admin/access-denied by useAuthGuard", async () => {
    const mockSession: Session = {
      access_token: "nonadmin-session-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: mockNonAdminUser,
    };

    vi.spyOn(authService, "getSession").mockResolvedValueOnce(mockSession);
    vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
      success: false,
      error: "Forbidden: AdminProfile not found for authenticated user",
    });

    function ProtectedRoute() {
      useAuthGuard();
      return <div>PROTECTED_PORTAL_CONTENT</div>;
    }

    render(
      <AuthProvider>
        <ProtectedRoute />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/access-denied" });
    });
  });

  // =========================================================================
  // Requirement 5: Generic login error behavior (No enumeration)
  // =========================================================================
  it("Requirement 5: Generic login error message is identical for bad password, unprovisioned user, and deactivated user", async () => {
    // 1. Bad password
    vi.spyOn(authService, "signIn").mockResolvedValueOnce({
      data: null,
      error: new Error("Invalid login credentials"),
    });

    let badPassError = "";
    function TestBadPassword() {
      const { signIn } = useAuth();
      return (
        <button
          onClick={async () => {
            const res = await signIn("any@cobralearn.com", "wrongpass");
            badPassError = res.error?.message || "";
          }}
        >
          BadPass
        </button>
      );
    }

    const { unmount } = render(
      <AuthProvider>
        <TestBadPassword />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText("BadPass").click();
    });
    expect(badPassError).toBe("Invalid email or password.");
    unmount();

    // 2. Unprovisioned email
    const mockSession: Session = {
      access_token: "token",
      refresh_token: "ref",
      expires_in: 3600,
      token_type: "bearer",
      user: mockNonAdminUser,
    };
    vi.spyOn(authService, "signIn").mockResolvedValueOnce({
      data: { user: mockNonAdminUser, session: mockSession },
      error: null,
    });
    vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
      success: false,
      error: "Forbidden: AdminProfile not found",
    });

    let unprovisionedError = "";
    function TestUnprovisioned() {
      const { signIn } = useAuth();
      return (
        <button
          onClick={async () => {
            const res = await signIn("nonadmin@cobralearn.com", "correctpass");
            unprovisionedError = res.error?.message || "";
          }}
        >
          Unprovisioned
        </button>
      );
    }

    render(
      <AuthProvider>
        <TestUnprovisioned />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText("Unprovisioned").click();
    });
    expect(unprovisionedError).toBe("Invalid email or password.");
  });

  // =========================================================================
  // Requirement 6: No protected-content flash before eligibility is resolved
  // =========================================================================
  it("Requirement 6: AdminPortalBoundary suppresses protected children and displays loading state before eligibility resolves", async () => {
    mockCurrentPath = "/admin/dashboard";

    let resolveSession: (s: Session | null) => void;
    const sessionPromise = new Promise<Session | null>((resolve) => {
      resolveSession = resolve;
    });

    vi.spyOn(authService, "getSession").mockImplementationOnce(() => sessionPromise);

    render(
      <AuthProvider>
        <AdminPortalBoundary>
          <div data-testid="protected-shell">SECRET_ADMIN_DASHBOARD</div>
        </AdminPortalBoundary>
      </AuthProvider>
    );

    // Initial render must show loading indicator, NOT protected content
    expect(screen.queryByTestId("protected-shell")).toBeNull();
    expect(screen.getByText(/Verifying Administrator Authorization/i)).toBeDefined();

    // Now resolve session as unauthenticated
    await act(async () => {
      resolveSession(null);
    });

    // Content still not rendered
    expect(screen.queryByTestId("protected-shell")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin" });
  });

  // =========================================================================
  // Requirement 7: Correct loading and retry behavior without infinite hang
  // =========================================================================
  it("Requirement 7: Clean termination and error state when profile verification fails", async () => {
    const mockSession: Session = {
      access_token: "token",
      refresh_token: "ref",
      expires_in: 3600,
      token_type: "bearer",
      user: mockActiveUser,
    };

    vi.spyOn(authService, "getSession").mockResolvedValueOnce(mockSession);
    vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
      success: false,
      error: "Network timeout: Unable to reach administrator verification service",
    });

    function TestComponent() {
      const { isLoading, isEligibilityLoading, eligibilityError, isEligibleAdmin } = useAuth();
      const busy = isLoading || isEligibilityLoading;
      return (
        <div>
          <span data-testid="loading">{busy ? "LOADING" : "DONE"}</span>
          <span data-testid="error">{eligibilityError || "NO_ERROR"}</span>
          <span data-testid="eligible">{isEligibleAdmin ? "YES" : "NO"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("DONE");
      expect(screen.getByTestId("error").textContent).toContain("Network timeout");
    });

    expect(screen.getByTestId("eligible").textContent).toBe("NO");
    expect(screen.getByTestId("error").textContent).toContain("Network timeout");
  });

  // =========================================================================
  // Requirement 8: No redirect loops on exempt routes
  // =========================================================================
  it("Requirement 8: isExemptRoute prevents redirect loops on login, session-expired, and access-denied pages", () => {
    expect(isExemptRoute("/admin")).toBe(true);
    expect(isExemptRoute("/admin/")).toBe(true);
    expect(isExemptRoute("/admin/session-expired")).toBe(true);
    expect(isExemptRoute("/admin/access-denied")).toBe(true);
    expect(isExemptRoute("/admin/forgot-password")).toBe(true);
    expect(isExemptRoute("/admin/reset-password")).toBe(true);
    expect(isExemptRoute("/")).toBe(true);

    // Protected routes are NOT exempt
    expect(isExemptRoute("/admin/dashboard")).toBe(false);
    expect(isExemptRoute("/admin/projects")).toBe(false);
    expect(isExemptRoute("/admin/settings")).toBe(false);

    // Triggering handleAuthError on /admin/session-expired does NOT redirect
    mockNavigate.mockReset();
    handleAuthError(new Error("Unauthorized: Valid session required"), "/admin/session-expired");
    expect(mockNavigate).not.toHaveBeenCalled();

    // Triggering handleAuthError on /admin/access-denied does NOT redirect
    handleAuthError(new Error("Forbidden: AdminProfile not found"), "/admin/access-denied");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Requirement 9: Session expiration routing on authentication failure
  // =========================================================================
  it("Requirement 9: Authentication failure on protected route clears auth state and guides to /admin/session-expired", () => {
    mockNavigate.mockReset();
    const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValueOnce({
      data: null,
      error: null,
    });

    handleAuthError(new Error("Unauthorized: Valid administrative session required"), "/admin/dashboard");

    expect(signOutSpy).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/admin/session-expired");
  });

  // =========================================================================
  // Requirement 10: Authorization failures must NOT be misclassified as session expiration
  // =========================================================================
  it("Requirement 10: Action-level 403 Forbidden does NOT sign out or redirect to /admin/session-expired", () => {
    mockNavigate.mockReset();
    const signOutSpy = vi.spyOn(authService, "signOut");

    const actionForbiddenErr = new Error('Forbidden: Role "EDITOR" lacks required permission: "settings:update"');

    expect(isAuthenticationError(actionForbiddenErr)).toBe(false);
    expect(isActionForbiddenError(actionForbiddenErr)).toBe(true);

    handleAuthError(actionForbiddenErr, "/admin/settings");

    // Must NOT sign out active user and must NOT redirect to session-expired
    expect(signOutSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Requirement 11: Duplicate concurrent 401/403 handling (Debounced navigation)
  // =========================================================================
  it("Requirement 11: Concurrent 401 failures trigger navigation exactly once", () => {
    mockNavigate.mockReset();
    vi.spyOn(authService, "signOut").mockResolvedValue({
      data: null,
      error: null,
    });

    const authError = new Error("Unauthorized: No valid Supabase session");

    // Simulate 5 simultaneous queries failing with 401
    handleAuthError(authError, "/admin/dashboard");
    handleAuthError(authError, "/admin/dashboard");
    handleAuthError(authError, "/admin/dashboard");
    handleAuthError(authError, "/admin/dashboard");
    handleAuthError(authError, "/admin/dashboard");

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/admin/session-expired");
  });

  // =========================================================================
  // Requirement 12: Preservation of server-side RBAC and session-refresh behavior
  // =========================================================================
  it("Requirement 12: RBAC permissions matrix and role separation are strictly preserved", () => {
    // SUPER_ADMIN has full permissions
    expect(canPerform("SUPER_ADMIN", AdminPermissions.ADMIN_MANAGE)).toBe(true);
    expect(canPerform("SUPER_ADMIN", AdminPermissions.SETTINGS_UPDATE)).toBe(true);

    // ADMIN has CMS/Media/Contact, but lacks ADMIN_MANAGE & SETTINGS_UPDATE
    expect(canPerform("ADMIN", AdminPermissions.CMS_CREATE)).toBe(true);
    expect(canPerform("ADMIN", AdminPermissions.ADMIN_MANAGE)).toBe(false);
    expect(canPerform("ADMIN", AdminPermissions.SETTINGS_UPDATE)).toBe(false);

    // EDITOR can create/read, but cannot delete or manage governance
    expect(canPerform("EDITOR", AdminPermissions.CMS_CREATE)).toBe(true);
    expect(canPerform("EDITOR", AdminPermissions.CMS_DELETE)).toBe(false);
    expect(canPerform("EDITOR", AdminPermissions.MEDIA_DELETE)).toBe(false);
    expect(canPerform("EDITOR", AdminPermissions.ADMIN_MANAGE)).toBe(false);
  });

  // =========================================================================
  // Requirement 13: No password or token leakage into logs or client-visible messages
  // =========================================================================
  it("Requirement 13: Sensitive passwords and bearer tokens are not leaked into console or error messages", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    const consoleErrorSpy = vi.spyOn(console, "error");
    const sensitiveSecret = "SuperSecretPassword123!_NeverLeak";
    const sensitiveJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitivePayload.mockSig";

    vi.spyOn(authService, "signIn").mockResolvedValueOnce({
      data: null,
      error: new Error(`Authentication failed for ${sensitiveJwt}`),
    });

    function TestLeakageComponent() {
      const { signIn } = useAuth();
      const [msg, setMsg] = React.useState("");

      return (
        <div>
          <button
            onClick={async () => {
              const res = await signIn("admin@cobralearn.com", sensitiveSecret);
              if (res.error) setMsg(res.error.message);
            }}
          >
            Submit
          </button>
          <span data-testid="msg">{msg}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestLeakageComponent />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText("Submit").click();
    });

    const displayedMessage = screen.getByTestId("msg").textContent;
    expect(displayedMessage).not.toContain(sensitiveSecret);
    expect(displayedMessage).not.toContain(sensitiveJwt);
    expect(displayedMessage).toBe("Invalid email or password.");

    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining(sensitiveSecret));
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining(sensitiveSecret));
  });
});
