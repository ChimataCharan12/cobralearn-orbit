import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";
import type { AdminProfile } from "@prisma/client";
import { AuthProvider, useAuthGuard } from "@/lib/auth/use-auth";
import { AdminPortalBoundary } from "@/components/auth/AdminPortalBoundary";
import { authService } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";

// Mock @tanstack/react-router
let mockCurrentPath = "/admin/dashboard";
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useRouter: () => ({
    state: {
      location: {
        pathname: mockCurrentPath,
      },
    },
  }),
}));

describe("Admin Panel Refresh & Initial Load Authorization", () => {
  const mockAdminUser: User = {
    id: "user-admin-101",
    email: "admin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const mockNonAdminUser: User = {
    id: "user-public-202",
    email: "public@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const mockValidAal2Session: Session = {
    access_token: "mock-valid-aal2-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: mockAdminUser,
  };

  const mockActiveProfile: AdminProfile = {
    id: "user-admin-101",
    email: "admin@cobralearn.com",
    fullName: "Lead Administrator",
    designation: "Chief Admin",
    avatarUrl: null,
    role: "ADMIN",
    phone: null,
    bio: null,
    preferences: null,
    isActive: true,
    lastLoginAt: new Date(),
    mfaRecoveryPending: false,
    mfaRecoveryAt: null,
    updatedAt: new Date(),
    createdAt: new Date(),
  };

  const mockQuarantinedProfile: AdminProfile = {
    ...mockActiveProfile,
    mfaRecoveryPending: true,
    mfaRecoveryAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    mockCurrentPath = "/admin/dashboard";
    sessionStorage.clear();
    localStorage.clear();
  });

  // =========================================================================
  // 1. Refreshing a protected admin route with a valid authorized session
  // =========================================================================
  it("Requirement 1: Refreshing a protected admin page with a valid authorized session preserves the route and does not redirect to Access Denied", async () => {
    mockCurrentPath = "/admin/dashboard";

    vi.spyOn(authService, "getSession").mockResolvedValue(mockValidAal2Session);
    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: { id: "totp-factor-1" } as any },
      error: null,
    });
    vi.spyOn(adminClient, "getSelfProfile").mockResolvedValue({
      success: true,
      data: mockActiveProfile,
    });

    function DashboardView() {
      useAuthGuard();
      return <div data-testid="dashboard-content">WELCOME_TO_ADMIN_DASHBOARD</div>;
    }

    render(
      <AuthProvider>
        <AdminPortalBoundary>
          <DashboardView />
        </AdminPortalBoundary>
      </AuthProvider>
    );

    // Initial state displays authorization verification loading
    expect(screen.queryByTestId("dashboard-content")).toBeNull();

    // After async session hydration and profile verification complete:
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-content")).toBeDefined();
    });

    // Must NOT navigate to access-denied or login
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/access-denied" });
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin" });
  });

  // =========================================================================
  // 2. Session restoration while authentication state is still loading
  // =========================================================================
  it("Requirement 2: Displays loading boundary and suppresses protected content while session and profile hydration is in flight", async () => {
    mockCurrentPath = "/admin/settings";

    let resolveProfile: (val: any) => void;
    const profilePromise = new Promise<any>((resolve) => {
      resolveProfile = resolve;
    });

    vi.spyOn(authService, "getSession").mockResolvedValue(mockValidAal2Session);
    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: { id: "totp-factor-1" } as any },
      error: null,
    });
    vi.spyOn(adminClient, "getSelfProfile").mockImplementationOnce(() => profilePromise);

    function SettingsView() {
      useAuthGuard();
      return <div data-testid="settings-content">CONFIDENTIAL_SYSTEM_SETTINGS</div>;
    }

    render(
      <AuthProvider>
        <AdminPortalBoundary>
          <SettingsView />
        </AdminPortalBoundary>
      </AuthProvider>
    );

    // While profile verification is in flight:
    // Protected content MUST NOT be mounted or rendered
    expect(screen.queryByTestId("settings-content")).toBeNull();
    // Loading indicator must be visible
    expect(screen.getByText(/Verifying Administrator Authorization/i)).toBeDefined();
    // Must NOT prematurely redirect to access-denied
    expect(mockNavigate).not.toHaveBeenCalled();

    // Now complete the profile verification
    await act(async () => {
      resolveProfile({
        success: true,
        data: mockActiveProfile,
      });
    });

    // Content should now be cleanly rendered
    await waitFor(() => {
      expect(screen.getByTestId("settings-content")).toBeDefined();
    });

    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/access-denied" });
  });

  // =========================================================================
  // 3. An authenticated user without the required admin role
  // =========================================================================
  it("Requirement 3: Authenticated user without active AdminProfile is redirected to /admin/access-denied after loading finishes", async () => {
    mockCurrentPath = "/admin/dashboard";

    const nonAdminSession: Session = {
      access_token: "non-admin-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: mockNonAdminUser,
    };

    vi.spyOn(authService, "getSession").mockResolvedValue(nonAdminSession);
    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [] },
      error: null,
    });
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: null },
      error: null,
    });
    // Server reports unprovisioned or inactive administrator
    vi.spyOn(adminClient, "getSelfProfile").mockResolvedValue({
      success: false,
      error: "Forbidden: AdminProfile not found for authenticated user",
    });

    function DashboardView() {
      useAuthGuard();
      return <div data-testid="dashboard-content">SECRET_ADMIN_PANEL</div>;
    }

    render(
      <AuthProvider>
        <AdminPortalBoundary>
          <DashboardView />
        </AdminPortalBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/access-denied" });
    });

    // Protected content was never displayed
    expect(screen.queryByTestId("dashboard-content")).toBeNull();
  });

  // =========================================================================
  // 4. A session that does not satisfy the required AAL2 level
  // =========================================================================
  it("Requirement 4: Session requiring AAL2 redirects to login/challenge (/admin) and NOT to /admin/access-denied", async () => {
    mockCurrentPath = "/admin/dashboard";

    // User is signed in at AAL1, but TOTP factor is enrolled and nextLevel is AAL2
    vi.spyOn(authService, "getSession").mockResolvedValue(mockValidAal2Session);
    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: { id: "totp-factor-1" } as any },
      error: null,
    });

    function DashboardView() {
      useAuthGuard();
      return <div data-testid="dashboard-content">SECRET_ADMIN_PANEL</div>;
    }

    render(
      <AuthProvider>
        <AdminPortalBoundary>
          <DashboardView />
        </AdminPortalBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin" });
    });

    // Must NEVER redirect to access-denied for pending MFA
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/access-denied" });
    expect(screen.queryByTestId("dashboard-content")).toBeNull();
  });

  // =========================================================================
  // 5. A recovery-quarantined account attempting to access ordinary admin routes
  // =========================================================================
  it("Requirement 5: Quarantined administrator in emergency recovery is redirected to /admin/mfa-recovery from ordinary admin routes", async () => {
    mockCurrentPath = "/admin/dashboard";

    vi.spyOn(authService, "getSession").mockResolvedValue(mockValidAal2Session);
    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [] },
      error: null,
    });
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: null },
      error: null,
    });
    vi.spyOn(adminClient, "getSelfProfile").mockResolvedValue({
      success: true,
      data: mockQuarantinedProfile,
    });

    function DashboardView() {
      useAuthGuard();
      return <div data-testid="dashboard-content">SECRET_ADMIN_PANEL</div>;
    }

    render(
      <AuthProvider>
        <AdminPortalBoundary>
          <DashboardView />
        </AdminPortalBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/mfa-recovery" });
    });

    expect(screen.queryByTestId("dashboard-content")).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/access-denied" });
  });

  // =========================================================================
  // 6. Direct navigation to a nested admin route
  // =========================================================================
  it("Requirement 6: Direct navigation / refresh on a nested admin route renders properly without redirection to Access Denied", async () => {
    mockCurrentPath = "/admin/projects/create";

    vi.spyOn(authService, "getSession").mockResolvedValue(mockValidAal2Session);
    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: { id: "totp-factor-1" } as any },
      error: null,
    });
    vi.spyOn(adminClient, "getSelfProfile").mockResolvedValue({
      success: true,
      data: mockActiveProfile,
    });

    function NestedCreateProjectView() {
      useAuthGuard();
      return <div data-testid="nested-project-content">NESTED_PROJECT_CREATION_FORM</div>;
    }

    render(
      <AuthProvider>
        <AdminPortalBoundary>
          <NestedCreateProjectView />
        </AdminPortalBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("nested-project-content")).toBeDefined();
    });

    // Must NOT navigate away from the nested route
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
