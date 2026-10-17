import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Factor } from "@supabase/supabase-js";
import { MfaEnrollmentCard } from "@/components/profile/MfaEnrollmentCard";
import { SecurityTab } from "@/components/profile/SecurityTab";
import { authService } from "@/lib/auth/auth-service";
import * as useAuthModule from "@/lib/auth/use-auth";

// Mock @tanstack/react-router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock sonner toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};
vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => mockToast.success(...args),
    error: (...args: any[]) => mockToast.error(...args),
    info: (...args: any[]) => mockToast.info(...args),
  },
}));

describe("Phase 4.4: TOTP MFA Enrollment UI", () => {
  const mockVerifiedFactor: Factor = {
    id: "factor-totp-verified-123",
    friendly_name: "CobraLearn Orbit Admin",
    factor_type: "totp",
    status: "verified",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockUnverifiedFactor: Factor = {
    id: "factor-totp-pending-456",
    friendly_name: "CobraLearn Orbit Admin",
    factor_type: "totp",
    status: "unverified",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockEnrollmentResponse = {
    id: "factor-totp-new-789",
    type: "totp" as const,
    friendlyName: "CobraLearn Orbit Admin",
    totp: {
      qr_code: "data:image/svg+xml;utf-8,<svg>mock-qr-code</svg>",
      secret: "JBSWY3DPEHPK3PXP",
      uri: "otpauth://totp/CobraLearn%20Orbit:admin?secret=JBSWY3DPEHPK3PXP",
    },
  };

  let mockCheckMfaState = vi.fn();
  let defaultAuthContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    mockCheckMfaState = vi.fn().mockResolvedValue({
      currentAal: "aal1",
      nextAal: "aal1",
      isMfaRequired: false,
      isMfaEnrolled: false,
      verifiedFactorId: null,
    });

    defaultAuthContext = {
      user: { id: "user-admin-1", email: "admin@cobralearn.com" },
      session: {
        access_token: "test-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
      adminProfile: { id: "user-admin-1", role: "ADMIN", isActive: true },
      isAuthenticated: true,
      isEligibleAdmin: true,
      isLoading: false,
      isEligibilityLoading: false,
      eligibilityError: null,
      currentAal: "aal1",
      nextAal: "aal1",
      isMfaRequired: false,
      isMfaEnrolled: false,
      verifiedFactorId: null,
      isMfaLoading: false,
      mfaError: null,
      clearMfaError: vi.fn(),
      checkMfaState: mockCheckMfaState,
      verifyMfaChallenge: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
      verifyAdminEligibility: vi.fn(),
    };

    vi.spyOn(useAuthModule, "useAuth").mockImplementation(() => defaultAuthContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  // =========================================================================
  // 1. No Factor: Displays Option to Enable MFA
  // =========================================================================
  it("Requirement 1: shows Not Enabled status and an action to enable MFA when no verified factor exists", () => {
    render(<MfaEnrollmentCard />);

    expect(screen.getByText("Multi-Factor Authentication (MFA)")).toBeDefined();
    expect(screen.getByText("Not Enabled")).toBeDefined();
    expect(screen.getByText("Managed by Auth Provider")).toBeDefined();
    expect(screen.getByRole("button", { name: /enable mfa/i })).toBeDefined();
    expect(screen.queryByText("Enabled & Protected")).toBeNull();
  });

  // =========================================================================
  // 2. Existing Verified Factor: Displays Enabled Status & Prevents Duplicate Enrollment
  // =========================================================================
  it("Requirement 2: displays enabled status and hides Enable MFA button when verified factor already exists", () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaEnrolled: true,
      verifiedFactorId: mockVerifiedFactor.id,
      currentAal: "aal2",
    });

    render(<MfaEnrollmentCard />);

    expect(screen.getByText("Enabled & Protected")).toBeDefined();
    expect(screen.getByText("AAL2 Enforced")).toBeDefined();
    expect(screen.queryByRole("button", { name: /enable mfa/i })).toBeNull();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeDefined();
  });

  // =========================================================================
  // 3. Pending Factor: Handled Safely Prior to Enrollment
  // =========================================================================
  it("Requirement 3: cleans up prior unverified factors before starting a new enrollment and never removes a verified factor", async () => {
    const listSpy = vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: {
        all: [mockUnverifiedFactor],
        totp: [mockUnverifiedFactor],
        verifiedTotp: null,
      },
      error: null,
    });

    const unenrollSpy = vi.spyOn(authService, "unenrollMfa").mockResolvedValue({
      data: { id: mockUnverifiedFactor.id },
      error: null,
    });

    const enrollSpy = vi.spyOn(authService, "enrollTotp").mockResolvedValue({
      data: mockEnrollmentResponse,
      error: null,
    });

    render(<MfaEnrollmentCard />);

    const enableBtn = screen.getByRole("button", { name: /enable mfa/i });
    await act(async () => {
      fireEvent.click(enableBtn);
    });

    expect(listSpy).toHaveBeenCalled();
    expect(unenrollSpy).toHaveBeenCalledWith(mockUnverifiedFactor.id);
    expect(enrollSpy).toHaveBeenCalledWith({ friendlyName: "CobraLearn Orbit Admin" });
  });

  // =========================================================================
  // 4. Enrollment Success: Displays QR & Setup Data Without Storage Persistence
  // =========================================================================
  it("Requirement 4: displays QR code image and manual setup key without persisting secret in storage", async () => {
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: null },
      error: null,
    });

    vi.spyOn(authService, "enrollTotp").mockResolvedValue({
      data: mockEnrollmentResponse,
      error: null,
    });

    render(<MfaEnrollmentCard />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
    });

    // Check QR code image
    const qrImg = screen.getByAltText(/mfa authenticator qr code/i) as HTMLImageElement;
    expect(qrImg).toBeDefined();
    expect(qrImg.src).toBe(mockEnrollmentResponse.totp.qr_code);

    // Toggle manual setup key
    const toggleManualBtn = screen.getByText(/view manual setup key/i);
    await act(async () => {
      fireEvent.click(toggleManualBtn);
    });

    expect(screen.getByText(mockEnrollmentResponse.totp.secret)).toBeDefined();

    // Verify ZERO persistence to localStorage or sessionStorage
    expect(localStorage.getItem("secret")).toBeNull();
    expect(sessionStorage.getItem("secret")).toBeNull();
    expect(localStorage.getItem("qr_code")).toBeNull();
    expect(sessionStorage.getItem("qr_code")).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain(mockEnrollmentResponse.totp.secret);
    expect(JSON.stringify(sessionStorage)).not.toContain(mockEnrollmentResponse.totp.secret);
  });

  // =========================================================================
  // 5. Invalid Confirmation Code: Blocked by Client Validation
  // =========================================================================
  it("Requirement 5: blocks non-6-digit input and validates strictly on client", async () => {
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: null },
      error: null,
    });

    vi.spyOn(authService, "enrollTotp").mockResolvedValue({
      data: mockEnrollmentResponse,
      error: null,
    });

    const verifySpy = vi.spyOn(authService, "challengeAndVerifyMfa");

    render(<MfaEnrollmentCard />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
    });

    const input = screen.getByLabelText(/confirmation code/i) as HTMLInputElement;
    const confirmBtn = screen.getByRole("button", { name: /confirm & activate/i });

    // Initially disabled (empty code)
    expect(confirmBtn).toBeDisabled();

    // Try typing non-digits and incomplete lengths
    await act(async () => {
      fireEvent.change(input, { target: { value: "abc12" } });
    });
    // Non-digits are stripped, leaving "12" (length 2)
    expect(input.value).toBe("12");
    expect(confirmBtn).toBeDisabled();

    // Verification service should NOT have been called
    expect(verifySpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 6. Supabase Verification Failure: Safe Error & Retry Supported
  // =========================================================================
  it("Requirement 6: displays sanitized error on verification failure and allows retry without exposing secret", async () => {
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: null },
      error: null,
    });

    vi.spyOn(authService, "enrollTotp").mockResolvedValue({
      data: mockEnrollmentResponse,
      error: null,
    });

    const verifySpy = vi.spyOn(authService, "challengeAndVerifyMfa").mockResolvedValue({
      data: null,
      error: new Error("Invalid TOTP code provided."),
    });

    render(<MfaEnrollmentCard />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
    });

    const input = screen.getByLabelText(/confirmation code/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "123456" } });
    });

    const confirmBtn = screen.getByRole("button", { name: /confirm & activate/i });
    expect(confirmBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(verifySpy).toHaveBeenCalledWith(mockEnrollmentResponse.id, "123456");

    // Check error display
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/Invalid TOTP code provided/i)).toBeDefined();

    // Retry is still possible (setup screen remains open)
    expect(screen.getByAltText(/mfa authenticator qr code/i)).toBeDefined();
    expect(mockToast.error).toHaveBeenCalled();
  });

  // =========================================================================
  // 7. Successful Verification: Authoritative State Reloaded Before Success
  // =========================================================================
  // 7. Successful Verification: Authoritative State Reloaded Before Success
  // =========================================================================
  it("Requirement 7: reloads authoritative factor state and clears transient secret upon success", async () => {
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: null },
      error: null,
    });

    vi.spyOn(authService, "enrollTotp").mockResolvedValue({
      data: mockEnrollmentResponse,
      error: null,
    });

    // Simulate pre-check (not enrolled) followed by authoritative confirmation upon verify (enrolled)
    mockCheckMfaState
      .mockResolvedValueOnce({
        currentAal: "aal1",
        nextAal: "aal1",
        isMfaRequired: false,
        isMfaEnrolled: false,
        verifiedFactorId: null,
      })
      .mockResolvedValueOnce({
        currentAal: "aal2",
        nextAal: "aal2",
        isMfaRequired: false,
        isMfaEnrolled: true,
        verifiedFactorId: mockEnrollmentResponse.id,
      });

    const verifySpy = vi.spyOn(authService, "challengeAndVerifyMfa").mockResolvedValue({
      data: {
        user: defaultAuthContext.user,
        session: defaultAuthContext.session,
      },
      error: null,
    });

    render(<MfaEnrollmentCard />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
    });

    const input = screen.getByLabelText(/confirmation code/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "654321" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm & activate/i }));
    });

    expect(verifySpy).toHaveBeenCalledWith(mockEnrollmentResponse.id, "654321");
    // Authoritative check must be triggered
    expect(mockCheckMfaState).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith("Two-Factor Authentication enabled successfully!");

    // Setup screen should now be closed
    expect(screen.queryByAltText(/mfa authenticator qr code/i)).toBeNull();
  });

  it("Regression: handles real Supabase SDK AuthMFAVerifyResponseData response shape and preserves session", async () => {
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: null },
      error: null,
    });

    vi.spyOn(authService, "enrollTotp").mockResolvedValue({
      data: mockEnrollmentResponse,
      error: null,
    });

    // Mock client.auth.mfa.challengeAndVerify with real SDK return shape
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser");
    const browserClient = getSupabaseBrowserClient();
    (browserClient.auth as any).mfa = {
      ...((browserClient.auth as any).mfa || {}),
      challengeAndVerify: vi.fn().mockResolvedValue({
        data: {
          access_token: "new-aal2-jwt-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "new-aal2-refresh-token",
          user: defaultAuthContext.user,
        },
        error: null,
      }),
    };

    mockCheckMfaState
      .mockResolvedValueOnce({
        currentAal: "aal1",
        nextAal: "aal1",
        isMfaRequired: false,
        isMfaEnrolled: false,
        verifiedFactorId: null,
      })
      .mockResolvedValueOnce({
        currentAal: "aal2",
        nextAal: "aal2",
        isMfaRequired: false,
        isMfaEnrolled: true,
        verifiedFactorId: mockEnrollmentResponse.id,
      });

    render(<MfaEnrollmentCard />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
    });

    const input = screen.getByLabelText(/confirmation code/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "849201" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm & activate/i }));
    });

    expect(mockToast.success).toHaveBeenCalledWith("Two-Factor Authentication enabled successfully!");
    expect(screen.queryByAltText(/mfa authenticator qr code/i)).toBeNull();
  });

  it("Regression: rejects verification when authoritative state fails to confirm factor activation", async () => {
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: null },
      error: null,
    });

    vi.spyOn(authService, "enrollTotp").mockResolvedValue({
      data: mockEnrollmentResponse,
      error: null,
    });

    vi.spyOn(authService, "challengeAndVerifyMfa").mockResolvedValue({
      data: {
        user: defaultAuthContext.user,
        session: defaultAuthContext.session,
      },
      error: null,
    });

    // Authoritative check fails to confirm enrollment
    mockCheckMfaState.mockResolvedValue({
      currentAal: "aal1",
      nextAal: "aal1",
      isMfaRequired: false,
      isMfaEnrolled: false,
      verifiedFactorId: null,
    });

    render(<MfaEnrollmentCard />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
    });

    const input = screen.getByLabelText(/confirmation code/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "123456" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm & activate/i }));
    });

    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining("MFA verification could not be confirmed")
    );
    // Setup screen preserved for retry
    expect(screen.getByAltText(/mfa authenticator qr code/i)).toBeDefined();
  });

  // =========================================================================
  // 8. Cancel Setup: Clears Transient State and Does Not Remove Verified Factor
  // =========================================================================
  it("Requirement 8: cancels setup, cleans up unverified factor, and never touches a verified factor", async () => {
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: null },
      error: null,
    });

    vi.spyOn(authService, "enrollTotp").mockResolvedValue({
      data: mockEnrollmentResponse,
      error: null,
    });

    const unenrollSpy = vi.spyOn(authService, "unenrollMfa").mockResolvedValue({
      data: { id: mockEnrollmentResponse.id },
      error: null,
    });

    render(<MfaEnrollmentCard />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
    });

    expect(screen.getByAltText(/mfa authenticator qr code/i)).toBeDefined();

    const cancelBtn = screen.getByRole("button", { name: /cancel setup/i });
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    // Pending factor unenrollment triggered
    expect(unenrollSpy).toHaveBeenCalledWith(mockEnrollmentResponse.id);
    expect(mockToast.info).toHaveBeenCalledWith("MFA setup cancelled. No factor was activated.");

    // Setup screen cleared
    expect(screen.queryByAltText(/mfa authenticator qr code/i)).toBeNull();
    expect(screen.getByRole("button", { name: /enable mfa/i })).toBeDefined();
  });

  // =========================================================================
  // 9. Duplicate Submission: Verification Guarded While In Progress
  // =========================================================================
  it("Requirement 9: guards against duplicate submissions while verification is in flight", async () => {
    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: null },
      error: null,
    });

    vi.spyOn(authService, "enrollTotp").mockResolvedValue({
      data: mockEnrollmentResponse,
      error: null,
    });

    let resolveVerification: (val: any) => void = () => {};
    const deferredVerification = new Promise((resolve) => {
      resolveVerification = resolve;
    });

    const verifySpy = vi.spyOn(authService, "challengeAndVerifyMfa").mockReturnValue(
      deferredVerification as any
    );

    render(<MfaEnrollmentCard />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
    });

    const input = screen.getByLabelText(/confirmation code/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "112233" } });
    });

    const confirmBtn = screen.getByRole("button", { name: /confirm & activate/i });

    // Submit first time
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(verifySpy).toHaveBeenCalledTimes(1);
    // Button is disabled and in verifying state
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByText(/verifying.../i)).toBeDefined();

    // Click again while in-flight
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Still only called once!
    expect(verifySpy).toHaveBeenCalledTimes(1);

    // Resolve in-flight verification
    await act(async () => {
      resolveVerification({
        data: { user: defaultAuthContext.user, session: defaultAuthContext.session },
        error: null,
      });
    });
  });

  // =========================================================================
  // 10. Auth State Refresh: Synchronizes Status
  // =========================================================================
  it("Requirement 10: refresh button invokes authoritative checkMfaState", async () => {
    mockCheckMfaState.mockResolvedValueOnce({
      currentAal: "aal2",
      nextAal: "aal2",
      isMfaRequired: false,
      isMfaEnrolled: true,
      verifiedFactorId: mockVerifiedFactor.id,
    });

    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaEnrolled: true,
      verifiedFactorId: mockVerifiedFactor.id,
      checkMfaState: mockCheckMfaState,
    });

    render(<MfaEnrollmentCard />);

    const refreshBtn = screen.getByRole("button", { name: /refresh mfa status/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    expect(mockCheckMfaState).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith("Two-Factor Authentication is active and verified.");
  });

  // =========================================================================
  // 11. Security: Zero Leakage in Storage or Logs
  // =========================================================================
  it("Requirement 11: ensures TOTP secrets never appear in persistent storage, URLs, or console logs", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    const consoleWarnSpy = vi.spyOn(console, "warn");
    const consoleErrorSpy = vi.spyOn(console, "error");

    vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
      data: { all: [], totp: [], verifiedTotp: null },
      error: null,
    });

    vi.spyOn(authService, "enrollTotp").mockResolvedValue({
      data: mockEnrollmentResponse,
      error: null,
    });

    render(<MfaEnrollmentCard />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
    });

    // Copy secret
    const toggleManualBtn = screen.getByText(/view manual setup key/i);
    await act(async () => {
      fireEvent.click(toggleManualBtn);
    });

    const copyBtn = screen.getByRole("button", { name: /copy secret key/i });
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockEnrollmentResponse.totp.secret);

    // Verify console was never used to output the secret
    const calls = [
      ...consoleLogSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
      ...consoleErrorSpy.mock.calls,
    ];
    for (const call of calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain(mockEnrollmentResponse.totp.secret);
    }

    // Verify storage has no secret
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  // =========================================================================
  // 12. SecurityTab Integration
  // =========================================================================
  it("Requirement 12: renders properly inside SecurityTab alongside password and device cards", () => {
    render(<SecurityTab />);

    expect(screen.getByText("Password Management")).toBeDefined();
    expect(screen.getByText("Multi-Factor Authentication (MFA)")).toBeDefined();
    expect(screen.getByText("Connected Devices")).toBeDefined();
    expect(screen.getByText("Security Recommendations")).toBeDefined();
    expect(screen.getByRole("button", { name: /enable mfa/i })).toBeDefined();
  });

  // =========================================================================
  // Phase 4.4 Follow-Up Regression Tests: Existing Factor Conflict & Cleanup
  // =========================================================================
  describe("Phase 4.4 Follow-Up: Existing Factor Conflict & Safe Recovery", () => {
    it("Follow-up 1: existing verified factor correctly displays 'Enabled & Protected' and does not create another factor", async () => {
      vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
        ...defaultAuthContext,
        isMfaEnrolled: true,
        verifiedFactorId: mockVerifiedFactor.id,
        currentAal: "aal2",
      });

      const enrollSpy = vi.spyOn(authService, "enrollTotp");

      render(<MfaEnrollmentCard />);

      expect(screen.getByText("Enabled & Protected")).toBeDefined();
      expect(screen.getByText("AAL2 Enforced")).toBeDefined();
      expect(screen.queryByRole("button", { name: /enable mfa/i })).toBeNull();
      expect(screen.getByRole("button", { name: /refresh/i })).toBeDefined();
      expect(enrollSpy).not.toHaveBeenCalled();
    });

    it("Follow-up 2: detects pending unverified factor, displays recovery alert, and allows safe cleanup via reset button", async () => {
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: {
          all: [mockUnverifiedFactor],
          totp: [mockUnverifiedFactor],
          unverifiedTotp: [mockUnverifiedFactor],
          verifiedTotp: null,
        },
        error: null,
      });

      const unenrollSpy = vi.spyOn(authService, "unenrollMfa").mockResolvedValue({
        data: { id: mockUnverifiedFactor.id },
        error: null,
      });

      render(<MfaEnrollmentCard />);

      // Pending banner should be detected and rendered
      const banner = await screen.findByText(/an incomplete mfa setup was detected/i);
      expect(banner).toBeDefined();

      const resetBtn = screen.getByRole("button", { name: /reset pending setup/i });
      expect(resetBtn).toBeDefined();

      await act(async () => {
        fireEvent.click(resetBtn);
      });

      expect(unenrollSpy).toHaveBeenCalledWith(mockUnverifiedFactor.id);
      expect(mockToast.success).toHaveBeenCalledWith(
        "Previous unverified MFA setup removed. You can now enable MFA."
      );
    });

    it("Follow-up 3: duplicate friendly-name error safely recovers by unenrolling unverified factor by ID and retrying enrollment without infinite loop", async () => {
      // 1. Initial list has empty totp (or unverified factor)
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: {
          all: [mockUnverifiedFactor],
          totp: [mockUnverifiedFactor],
          unverifiedTotp: [mockUnverifiedFactor],
          verifiedTotp: null,
        },
        error: null,
      });

      const unenrollSpy = vi.spyOn(authService, "unenrollMfa").mockResolvedValue({
        data: { id: mockUnverifiedFactor.id },
        error: null,
      });

      // First enrollment call returns duplicate friendly name error; retry succeeds
      const enrollSpy = vi
        .spyOn(authService, "enrollTotp")
        .mockResolvedValueOnce({
          data: null,
          error: new Error('A factor with the friendly name "CobraLearn Orbit Admin" for this user already exists'),
        })
        .mockResolvedValueOnce({
          data: mockEnrollmentResponse,
          error: null,
        });

      render(<MfaEnrollmentCard />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
      });

      // Assert unenroll was called with factor ID
      expect(unenrollSpy).toHaveBeenCalledWith(mockUnverifiedFactor.id);
      // Assert enroll was retried and succeeded
      expect(enrollSpy).toHaveBeenCalledTimes(2);
      // Setup screen now renders QR code
      expect(screen.getByAltText(/mfa authenticator qr code/i)).toBeDefined();
    });

    it("Follow-up 4: verified factor is strictly protected and never deleted during pending-factor cleanup", async () => {
      // Both verified and unverified factors exist in authoritative list
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: {
          all: [mockVerifiedFactor, mockUnverifiedFactor],
          totp: [mockVerifiedFactor, mockUnverifiedFactor],
          unverifiedTotp: [mockUnverifiedFactor],
          verifiedTotp: mockVerifiedFactor,
        },
        error: null,
      });

      mockCheckMfaState.mockResolvedValue({
        currentAal: "aal2",
        nextAal: "aal2",
        isMfaRequired: false,
        isMfaEnrolled: false, // UI temporarily unenrolled check
        verifiedFactorId: mockVerifiedFactor.id,
      });

      const unenrollSpy = vi.spyOn(authService, "unenrollMfa").mockResolvedValue({
        data: { id: mockUnverifiedFactor.id },
        error: null,
      });

      vi.spyOn(authService, "enrollTotp").mockResolvedValue({
        data: mockEnrollmentResponse,
        error: null,
      });

      render(<MfaEnrollmentCard />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
      });

      // Strictly verify: mockVerifiedFactor.id was NEVER passed to unenrollMfa
      expect(unenrollSpy).not.toHaveBeenCalledWith(mockVerifiedFactor.id);
    });

    it("Follow-up 5: factor state refreshes after cleanup and successful verification", async () => {
      const listSpy = vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: {
          all: [mockUnverifiedFactor],
          totp: [mockUnverifiedFactor],
          unverifiedTotp: [mockUnverifiedFactor],
          verifiedTotp: null,
        },
        error: null,
      });

      vi.spyOn(authService, "unenrollMfa").mockResolvedValue({
        data: { id: mockUnverifiedFactor.id },
        error: null,
      });

      render(<MfaEnrollmentCard />);

      const resetBtn = await screen.findByRole("button", { name: /reset pending setup/i });
      await act(async () => {
        fireEvent.click(resetBtn);
      });

      // Factor state reloaded after unenroll
      expect(listSpy).toHaveBeenCalled();
    });

    it("Follow-up 6: errors never expose TOTP secrets, tokens, or URIs in error alerts or toast notifications", async () => {
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [], totp: [], verifiedTotp: null },
        error: null,
      });

      const sensitiveMsg =
        "Supabase error: Bearer eyJhbGciOiJIUzI1NiJ9.test secret=JBSWY3DPEHPK3PXP uri=otpauth://totp/CobraLearn:admin?secret=JBSWY3DPEHPK3PXP";

      vi.spyOn(authService, "enrollTotp").mockResolvedValue({
        data: null,
        error: new Error(sensitiveMsg),
      });

      render(<MfaEnrollmentCard />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
      });

      const alertEl = screen.getByRole("alert");
      expect(alertEl.textContent).not.toContain("eyJhbGciOiJIUzI1NiJ9.test");
      expect(alertEl.textContent).not.toContain("JBSWY3DPEHPK3PXP");
      expect(alertEl.textContent).not.toContain("otpauth://");
      expect(alertEl.textContent).toContain("[REDACTED]");

      // Toast also sanitized
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining("[REDACTED]"));
      expect(mockToast.error).toHaveBeenCalledWith(expect.not.stringContaining("eyJhbGciOiJIUzI1NiJ9.test"));
    });
  });
});
