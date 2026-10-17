import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";
import type { AdminProfile } from "@prisma/client";
import * as useAuthModule from "@/lib/auth/use-auth";
import { AuthProvider, useAuth, useAuthGuard } from "@/lib/auth/use-auth";
import { authService } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";
import { MfaRecoveryCard } from "@/components/auth/MfaRecoveryCard";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { requireAdminProfile, requireAal2 } from "@/lib/auth/server-auth";
import * as serverAuthModule from "@/lib/auth/server-auth";

// Mock @tanstack/react-router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

describe("MFA Recovery Re-Enrollment Navigation & Authorization Regression Tests", () => {
  const mockAdminUser: User = {
    id: "user-recovery-999",
    email: "quarantined-admin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const mockAal1Session: Session = {
    access_token: "mock-aal1-quarantined-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: mockAdminUser,
  };

  const mockQuarantinedProfile: AdminProfile = {
    id: "user-recovery-999",
    email: "quarantined-admin@cobralearn.com",
    fullName: "Quarantined Admin",
    designation: "Security Admin",
    avatarUrl: null,
    role: "ADMIN",
    phone: null,
    bio: null,
    preferences: null,
    isActive: true,
    lastLoginAt: new Date(),
    mfaRecoveryPending: true,
    mfaRecoveryAt: new Date(),
    updatedAt: new Date(),
    createdAt: new Date(),
  };

  const mockRestoredProfile: AdminProfile = {
    ...mockQuarantinedProfile,
    mfaRecoveryPending: false,
    mfaRecoveryAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  describe("1. Recovery Screen Button Navigation", () => {
    it("Proceed to MFA Re-Enrollment button navigates specifically to /admin/mfa-recovery", async () => {
      vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
        user: mockAdminUser,
        session: mockAal1Session,
        adminProfile: null,
        isAuthenticated: true,
        isEligibleAdmin: false,
        isLoading: false,
        isEligibilityLoading: false,
        eligibilityError: null,
        currentAal: "aal1",
        nextAal: "aal2",
        isMfaRequired: true,
        isMfaEnrolled: true,
        verifiedFactorId: "factor-totp-123",
        isMfaLoading: false,
        mfaError: null,
        clearMfaError: vi.fn(),
        checkMfaState: vi.fn().mockResolvedValue({
          currentAal: "aal1",
          nextAal: "aal1",
          isMfaRequired: false,
          isMfaEnrolled: false,
          verifiedFactorId: null,
        }),
        verifyMfaChallenge: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        verifyAdminEligibility: vi.fn(),
        refreshProfile: vi.fn().mockResolvedValue({
          eligible: true,
          profile: mockQuarantinedProfile,
        }),
      });

      vi.spyOn(adminClient, "verifyAndRedeemRecoveryCode").mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          message: "Code verified",
          remainingCodes: 7,
          isQuarantined: true,
        },
      });

      render(<AdminLoginForm />);

      // Navigate to recovery challenge
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", {
            name: /lost access to your authenticator\? use a recovery code/i,
          })
        );
      });

      // Submit recovery code
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX");
      await act(async () => {
        fireEvent.change(input, { target: { value: "2345-6789-ABCD" } });
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", {
            name: /redeem & recover account/i,
          })
        );
      });

      // Restricted recovery screen is visible
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /restricted recovery/i })).toBeDefined();
      });

      const proceedBtn = screen.getByRole("button", {
        name: /proceed to mfa re-enrollment/i,
      });
      expect(proceedBtn).toBeDefined();

      await act(async () => {
        fireEvent.click(proceedBtn);
      });

      // Must navigate to dedicated /admin/mfa-recovery route, NEVER to /admin/profile or /admin/access-denied
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/mfa-recovery" });
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/profile" });
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/access-denied" });
    });
  });

  describe("2. Route Guarding (useAuthGuard)", () => {
    function createGuardedComponent(redirectTo = "/admin", allowQuarantined = false) {
      return function GuardedComponent() {
        const { isQuarantined, isEligibleAdmin } = useAuthGuard(redirectTo, allowQuarantined);
        return (
          <div data-testid="guarded-view">
            <span>QUARANTINED:{String(isQuarantined)}</span>
            <span>ELIGIBLE:{String(isEligibleAdmin)}</span>
          </div>
        );
      };
    }

    it("Permits quarantined recovery session at AAL1 to access /admin/mfa-recovery (allowQuarantined: true)", async () => {
      vi.spyOn(authService, "getSession").mockResolvedValue(mockAal1Session);
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

      const MfaRecoveryRoute = createGuardedComponent("/admin", true);

      await act(async () => {
        render(
          <AuthProvider>
            <MfaRecoveryRoute />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("guarded-view")).toBeDefined();
      });

      // Access is granted without being redirected to access-denied or login
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/access-denied" });
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin" });
    });

    it("Blocks direct navigation to protected admin routes (allowQuarantined: false) and redirects to /admin/mfa-recovery", async () => {
      vi.spyOn(authService, "getSession").mockResolvedValue(mockAal1Session);
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

      const DashboardRoute = createGuardedComponent("/admin", false);

      await act(async () => {
        render(
          <AuthProvider>
            <DashboardRoute />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/mfa-recovery" });
      });

      // Must NOT navigate to access-denied or let them stay
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/access-denied" });
    });

    it("Redirects non-quarantined active admins away from /admin/mfa-recovery to /admin/dashboard", async () => {
      vi.spyOn(authService, "getSession").mockResolvedValue(mockAal1Session);
      vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
        data: { currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [] },
        error: null,
      });
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [], totp: [], verifiedTotp: { id: "factor-123" } as any },
        error: null,
      });
      vi.spyOn(adminClient, "getSelfProfile").mockResolvedValue({
        success: true,
        data: mockRestoredProfile, // mfaRecoveryPending = false
      });

      const MfaRecoveryRoute = createGuardedComponent("/admin", true);

      await act(async () => {
        render(
          <AuthProvider>
            <MfaRecoveryRoute />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/dashboard" });
      });
    });

    it("Redirects unauthenticated users attempting /admin/mfa-recovery to /admin", async () => {
      vi.spyOn(authService, "getSession").mockResolvedValue(null);
      vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
        data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] },
        error: null,
      });
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [], totp: [], verifiedTotp: null },
        error: null,
      });

      const MfaRecoveryRoute = createGuardedComponent("/admin", true);

      await act(async () => {
        render(
          <AuthProvider>
            <MfaRecoveryRoute />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin" });
      });
    });

    it("Redirects deactivated admins attempting /admin/mfa-recovery to /admin/access-denied", async () => {
      vi.spyOn(authService, "getSession").mockResolvedValue(mockAal1Session);
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
        data: { ...mockQuarantinedProfile, isActive: false },
      });

      const MfaRecoveryRoute = createGuardedComponent("/admin", true);

      await act(async () => {
        render(
          <AuthProvider>
            <MfaRecoveryRoute />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/access-denied" });
      });
    });
  });

  describe("3. Dedicated MFA Recovery Card Re-Enrollment Flow", () => {
    it("Initializes replacement factor, renders QR code and secret, and validates 6-digit input", async () => {
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [], totp: [], verifiedTotp: null },
        error: null,
      });

      vi.spyOn(authService, "enrollTotp").mockResolvedValue({
        data: {
          id: "new-replacement-factor-id",
          type: "totp",
          totp: {
            qr_code: "data:image/svg+xml;base64,mock-qr-code",
            secret: "JBSWY3DPEHPK3PXP",
            uri: "otpauth://totp/CobraLearn?secret=JBSWY3DPEHPK3PXP",
          },
        },
        error: null,
      });

      render(<MfaRecoveryCard />);

      // Awaits initialization and renders QR code
      await waitFor(() => {
        expect(screen.getByAltText("MFA QR Code")).toBeDefined();
      });

      // Verification button is initially disabled until 6 digits are provided
      const submitBtn = screen.getByRole("button", { name: /verify code & restore access/i });
      expect(submitBtn).toBeDisabled();

      // Typing non-numeric characters is filtered out
      const input = screen.getByPlaceholderText("000000");
      await act(async () => {
        fireEvent.change(input, { target: { value: "abc1234" } });
      });
      expect(input).toHaveValue("1234");
      expect(submitBtn).toBeDisabled();

      // Full 6 digits enables submission
      await act(async () => {
        fireEvent.change(input, { target: { value: "123456" } });
      });
      expect(input).toHaveValue("123456");
      expect(submitBtn).toBeEnabled();
    });

    it("Completes re-enrollment upon successful verification: lifts quarantine and navigates to dashboard", async () => {
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [], totp: [], verifiedTotp: null },
        error: null,
      });

      vi.spyOn(authService, "enrollTotp").mockResolvedValue({
        data: {
          id: "new-replacement-factor-id",
          type: "totp",
          totp: {
            qr_code: "data:image/svg+xml;base64,mock-qr-code",
            secret: "JBSWY3DPEHPK3PXP",
            uri: "otpauth://totp/CobraLearn?secret=JBSWY3DPEHPK3PXP",
          },
        },
        error: null,
      });

      vi.spyOn(authService, "challengeAndVerifyMfa").mockResolvedValue({
        data: { user: mockAdminUser, session: mockAal1Session },
        error: null,
      });

      const completeReenrollSpy = vi.spyOn(adminClient, "completeMfaReenrollment").mockResolvedValue({
        success: true,
        data: {
          success: true,
          status: "COMPLETED",
          targetId: mockAdminUser.id,
          completedAt: new Date().toISOString(),
          message: "Quarantine lifted",
        },
      });

      vi.spyOn(adminClient, "getSelfProfile").mockResolvedValue({
        success: true,
        data: mockRestoredProfile,
      });

      render(
        <AuthProvider>
          <MfaRecoveryCard />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByAltText("MFA QR Code")).toBeDefined();
      });

      const input = screen.getByPlaceholderText("000000");
      await act(async () => {
        fireEvent.change(input, { target: { value: "654321" } });
      });

      const submitBtn = screen.getByRole("button", { name: /verify code & restore access/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(completeReenrollSpy).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/dashboard" });
      });
    });

    it("Preserves quarantine and leaves account restricted if server completion fails", async () => {
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [], totp: [], verifiedTotp: null },
        error: null,
      });

      vi.spyOn(authService, "enrollTotp").mockResolvedValue({
        data: {
          id: "new-replacement-factor-id",
          type: "totp",
          totp: {
            qr_code: "data:image/svg+xml;base64,mock-qr-code",
            secret: "JBSWY3DPEHPK3PXP",
            uri: "otpauth://totp/CobraLearn?secret=JBSWY3DPEHPK3PXP",
          },
        },
        error: null,
      });

      vi.spyOn(authService, "challengeAndVerifyMfa").mockResolvedValue({
        data: { user: mockAdminUser, session: mockAal1Session },
        error: null,
      });

      // Server rejects completion (e.g. factor timestamp invalid or concurrent modification)
      vi.spyOn(adminClient, "completeMfaReenrollment").mockResolvedValue({
        success: false,
        error: "Server could not verify re-enrollment to lift quarantine.",
      });

      render(
        <AuthProvider>
          <MfaRecoveryCard />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByAltText("MFA QR Code")).toBeDefined();
      });

      const input = screen.getByPlaceholderText("000000");
      await act(async () => {
        fireEvent.change(input, { target: { value: "654321" } });
      });

      const submitBtn = screen.getByRole("button", { name: /verify code & restore access/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText("Server could not verify re-enrollment to lift quarantine.")).toBeDefined();
      });

      // Must NOT navigate to dashboard
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/dashboard" });
    });

    it("Allows safe sign out and returns to /admin", async () => {
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [], totp: [], verifiedTotp: null },
        error: null,
      });

      vi.spyOn(authService, "enrollTotp").mockResolvedValue({
        data: {
          id: "new-replacement-factor-id",
          type: "totp",
          totp: {
            qr_code: "data:image/svg+xml;base64,mock-qr-code",
            secret: "JBSWY3DPEHPK3PXP",
            uri: "otpauth://totp/CobraLearn?secret=JBSWY3DPEHPK3PXP",
          },
        },
        error: null,
      });

      const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValue({ error: null });

      render(
        <AuthProvider>
          <MfaRecoveryCard />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/cancel and return to sign in/i)).toBeDefined();
      });

      const cancelBtn = screen.getByRole("button", { name: /cancel and return to sign in/i });
      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      await waitFor(() => {
        expect(signOutSpy).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin" });
      });
    });
  });
});
