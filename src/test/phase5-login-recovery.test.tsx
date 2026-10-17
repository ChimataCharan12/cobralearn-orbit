import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";
import type { AdminProfile } from "@prisma/client";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import * as useAuthModule from "@/lib/auth/use-auth";
import { adminClient } from "@/lib/api/admin-client";
import {
  verifyAndRedeemRecoveryCodeOperation,
} from "@/lib/server/recovery-code-operations";
import {
  generateSaltHex,
  hashRecoveryCode,
} from "@/lib/server/recovery-code-crypto";
import { requireAal2, requireAdminProfile } from "@/lib/auth/server-auth";
import { resetMemoryRateLimitStore } from "@/lib/server/rate-limiter";

// Mock @tanstack/react-router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock server-auth for operational authorization testing
vi.mock("@/lib/auth/server-auth", () => ({
  requireAal2: vi.fn(),
  requireAdminProfile: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

describe("Phase 5.4: Secure Login Recovery Integration", () => {
  const mockAdminUser: User = {
    id: "user-recovery-001",
    email: "admin-recovery@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const mockAal1Session: Session = {
    access_token: "mock-jwt-aal1-session-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: mockAdminUser,
  };

  const mockAal2Session: Session = {
    access_token: "mock-jwt-aal2-session-token",
    refresh_token: "mock-refresh-token-aal2",
    expires_in: 3600,
    token_type: "bearer",
    user: mockAdminUser,
  };

  const mockAdminProfile: AdminProfile = {
    id: "user-recovery-001",
    email: "admin-recovery@cobralearn.com",
    fullName: "Recovery Administrator",
    designation: "Security Admin",
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

  let mockSignIn: any;
  let mockVerifyMfaChallenge: any;
  let mockSignOut: any;
  let mockCheckMfaState: any;
  let defaultAuthContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    resetMemoryRateLimitStore();
    sessionStorage.clear();
    localStorage.clear();

    mockSignIn = vi.fn().mockResolvedValue({
      data: {
        user: mockAdminUser,
        session: mockAal1Session,
        mfaRequired: true,
      },
      error: null,
    });

    mockVerifyMfaChallenge = vi.fn().mockResolvedValue({
      data: {
        user: mockAdminUser,
        session: mockAal2Session,
        profile: mockAdminProfile,
      },
      error: null,
    });

    mockSignOut = vi.fn().mockResolvedValue({ data: null, error: null });

    mockCheckMfaState = vi.fn().mockResolvedValue({
      currentAal: "aal1",
      nextAal: "aal2",
      isMfaRequired: true,
      isMfaEnrolled: true,
      verifiedFactorId: "factor-totp-123",
    });

    defaultAuthContext = {
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
      checkMfaState: mockCheckMfaState,
      verifyMfaChallenge: mockVerifyMfaChallenge,
      signIn: mockSignIn,
      signOut: mockSignOut,
      verifyAdminEligibility: vi.fn(),
    };

    vi.spyOn(useAuthModule, "useAuth").mockImplementation(() => defaultAuthContext);

    vi.spyOn(adminClient, "evaluateLoginRateLimit").mockResolvedValue({
      success: true,
      data: { allowed: true },
    });
    vi.spyOn(adminClient, "recordLoginHistory").mockResolvedValue({
      success: true,
      data: { id: "log-1" },
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  // =========================================================================
  // 1. UI Challenge Toggle & Mode Switching
  // =========================================================================
  describe("1. Login Challenge UI: Toggle Between TOTP and Recovery Code", () => {
    it("Requirement 1: renders a clear 'Use a recovery code' alternative in TOTP challenge UI", () => {
      render(<AdminLoginForm />);

      // Challenge heading is present
      expect(screen.getByRole("heading", { name: /enter two-factor code/i })).toBeDefined();

      // Clear alternative link/button is present
      const recoveryToggleBtn = screen.getByRole("button", {
        name: /lost access to your authenticator\? use a recovery code/i,
      });
      expect(recoveryToggleBtn).toBeDefined();
    });

    it("Requirement 2: allows switching to recovery code view and back to TOTP without restarting the login flow", async () => {
      render(<AdminLoginForm />);

      // Switch to Recovery Code
      const recoveryToggleBtn = screen.getByRole("button", {
        name: /lost access to your authenticator\? use a recovery code/i,
      });
      await act(async () => {
        fireEvent.click(recoveryToggleBtn);
      });

      // Verify Recovery Code view is rendered
      expect(screen.getByRole("heading", { name: /enter recovery code/i })).toBeDefined();
      expect(screen.getByPlaceholderText("XXXX-XXXX-XXXX")).toBeDefined();
      expect(screen.queryByLabelText(/6-digit security code/i)).toBeNull();

      // Switch back to TOTP without signOut
      const totpToggleBtn = screen.getByRole("button", {
        name: /back to 6-digit verification code/i,
      });
      await act(async () => {
        fireEvent.click(totpToggleBtn);
      });

      // Verify TOTP challenge view is restored
      expect(screen.getByRole("heading", { name: /enter two-factor code/i })).toBeDefined();
      expect(screen.getByLabelText(/6-digit security code/i)).toBeDefined();
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("Safe cancellation: clicking 'Sign out and return to Login' signs out and returns to credentials screen", async () => {
      render(<AdminLoginForm />);

      // Switch to recovery code mode
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", {
            name: /lost access to your authenticator\? use a recovery code/i,
          })
        );
      });

      const cancelBtn = screen.getByRole("button", {
        name: /sign out and return to login/i,
      });

      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      // Returns to credentials view
      expect(screen.getByRole("heading", { name: /^sign in$/i })).toBeDefined();
    });
  });

  // =========================================================================
  // 2. Input Validation and Normalization
  // =========================================================================
  describe("2. Recovery Code Input Formatting and Validation", () => {
    it("Requirement 3: automatically formats and normalizes code as XXXX-XXXX-XXXX ignoring case and hyphens", async () => {
      render(<AdminLoginForm />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", {
            name: /lost access to your authenticator\? use a recovery code/i,
          })
        );
      });

      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX") as HTMLInputElement;

      // Type lowercase characters without hyphens
      await act(async () => {
        fireEvent.change(input, { target: { value: "23456789abcd" } });
      });

      // Should be automatically formatted with hyphens in uppercase
      expect(input.value).toBe("2345-6789-ABCD");
    });

    it("strips ambiguous characters (0, O, 1, I, L) from input", async () => {
      render(<AdminLoginForm />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", {
            name: /lost access to your authenticator\? use a recovery code/i,
          })
        );
      });

      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX") as HTMLInputElement;

      // Type characters containing forbidden ambiguous ones
      await act(async () => {
        fireEvent.change(input, { target: { value: "01OIL2345678" } });
      });

      // Ambiguous characters should be rejected, only valid 2345678 kept
      expect(input.value).toBe("2345-678");
    });

    it("disables submit button until all 12 characters are entered", async () => {
      render(<AdminLoginForm />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", {
            name: /lost access to your authenticator\? use a recovery code/i,
          })
        );
      });

      const submitBtn = screen.getByRole("button", {
        name: /redeem & recover account/i,
      }) as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(true);

      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX");
      await act(async () => {
        fireEvent.change(input, { target: { value: "2345-6789" } });
      });
      expect(submitBtn.disabled).toBe(true);

      await act(async () => {
        fireEvent.change(input, { target: { value: "2345-6789-ABCD" } });
      });
      expect(submitBtn.disabled).toBe(false);
    });
  });

  // =========================================================================
  // 3. Client Submission & Restricted Recovery State
  // =========================================================================
  describe("3. Client Submission & Restricted Recovery State", () => {
    it("Requirement 4 & 6: redeems recovery code via server operation and immediately wipes code from memory", async () => {
      const redeemSpy = vi.spyOn(adminClient, "verifyAndRedeemRecoveryCode").mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          message: "Recovery code redeemed successfully.",
          remainingCodes: 7,
          isQuarantined: true,
        },
      });

      render(<AdminLoginForm />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", {
            name: /lost access to your authenticator\? use a recovery code/i,
          })
        );
      });

      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX");
      await act(async () => {
        fireEvent.change(input, { target: { value: "2345-6789-ABCD" } });
      });

      const submitBtn = screen.getByRole("button", {
        name: /redeem & recover account/i,
      });

      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Verify redemption called with normalized code and user id
      expect(redeemSpy).toHaveBeenCalledWith("user-recovery-001", "23456789ABCD");

      // Verify code input was cleared
      expect(input).not.toBeInTheDocument();
    });

    it("Requirement 8: successful recovery leads to restricted recovery state with re-enrollment prompt", async () => {
      vi.spyOn(adminClient, "verifyAndRedeemRecoveryCode").mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          message: "Recovery code redeemed successfully.",
          remainingCodes: 7,
          isQuarantined: true,
        },
      });

      render(<AdminLoginForm />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", {
            name: /lost access to your authenticator\? use a recovery code/i,
          })
        );
      });

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

      // Should transition to restricted recovery view
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /restricted recovery/i })).toBeDefined();
      });

      expect(
        screen.getByText(/your recovery code was accepted and your lost authenticator factor has been deactivated/i)
      ).toBeDefined();

      const proceedBtn = screen.getByRole("button", {
        name: /proceed to mfa re-enrollment/i,
      });
      expect(proceedBtn).toBeDefined();

      // Clicking Proceed navigates to /admin/mfa-recovery
      await act(async () => {
        fireEvent.click(proceedBtn);
      });

      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/mfa-recovery" });
    });

    it("Requirement 5: preserves generic error message on invalid code or server rejection (anti-enumeration)", async () => {
      vi.spyOn(adminClient, "verifyAndRedeemRecoveryCode").mockResolvedValueOnce({
        success: false,
        error: "Invalid or already redeemed recovery code.",
      });

      render(<AdminLoginForm />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", {
            name: /lost access to your authenticator\? use a recovery code/i,
          })
        );
      });

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

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeDefined();
      });

      expect(screen.getByText("Invalid or already redeemed recovery code.")).toBeDefined();
      // Must NOT navigate to dashboard or profile
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. Server-Side Quarantine, Factor Deletion, and AAL2 Guarantees
  // =========================================================================
  describe("4. Server-Side Quarantine and AAL2 Enforcement Guarantees", () => {
    it("Requirement 7: server operation marks code used, transitions AdminProfile to quarantine, and invalidates factor", async () => {
      const adminId = "user-recovery-001";
      const validCode = "2345-6789-ABCD";
      const salt = generateSaltHex();
      const hash = await hashRecoveryCode(validCode, salt);

      let updatedProfileData: any = null;
      let createdRecoveryData: any = null;
      let codeMarkedUsed = false;

      const mockPrisma = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            email: "admin-recovery@cobralearn.com",
            role: "ADMIN",
            isActive: true,
          }),
          update: vi.fn().mockImplementation(async ({ where, data }) => {
            if (where.id === adminId) {
              updatedProfileData = data;
              return { id: adminId, ...data };
            }
          }),
        },
        adminRecoveryCode: {
          findMany: vi.fn().mockResolvedValue([
            { id: "code-rec-1", codeHash: hash, codeSalt: salt, isUsed: false },
          ]),
          updateMany: vi.fn().mockImplementation(async ({ where }) => {
            if (where.id === "code-rec-1" && where.isUsed === false) {
              codeMarkedUsed = true;
              return { count: 1 };
            }
            return { count: 0 };
          }),
        },
        adminMfaRecovery: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            createdRecoveryData = data;
            return { id: "recov-entry-1", ...data };
          }),
        },
        adminAuditLog: {
          create: vi.fn().mockResolvedValue({ id: "audit-1" }),
        },
      } as any;

      let deletedFactorUserId: string | null = null;
      let deletedFactorId: string | null = null;

      const mockSupabaseAdmin = {
        auth: {
          admin: {
            mfa: {
              listFactors: vi.fn().mockResolvedValue({
                data: {
                  factors: [
                    { id: "factor-lost-999", factor_type: "totp", status: "verified" },
                  ],
                },
                error: null,
              }),
              deleteFactor: vi.fn().mockImplementation(async ({ id, userId }) => {
                deletedFactorId = id;
                deletedFactorUserId = userId;
                return { data: { id }, error: null };
              }),
            },
          },
        },
      };

      const req = new Request("https://internal.portal/api/recovery/redeem", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.55" },
      });

      const result = await verifyAndRedeemRecoveryCodeOperation(
        req,
        { adminId, code: validCode },
        mockPrisma,
        mockSupabaseAdmin
      );

      expect(result.success).toBe(true);
      expect(codeMarkedUsed).toBe(true);

      // Verify AdminProfile quarantine was set
      expect(updatedProfileData).not.toBeNull();
      expect(updatedProfileData.mfaRecoveryPending).toBe(true);
      expect(updatedProfileData.mfaRecoveryAt).toBeInstanceOf(Date);

      // Verify Supabase lost factor was deleted
      expect(deletedFactorUserId).toBe(adminId);
      expect(deletedFactorId).toBe("factor-lost-999");

      // Verify AdminMfaRecovery record created in FACTOR_DELETED status
      expect(createdRecoveryData).not.toBeNull();
      expect(createdRecoveryData.targetId).toBe(adminId);
      expect(createdRecoveryData.status).toBe("FACTOR_DELETED");
      expect(createdRecoveryData.factorId).toBe("factor-lost-999");
      expect(createdRecoveryData.actorType).toBe("SYSTEM_RECONCILER");
    });

    it("Requirement 7: recovery code redemption NEVER satisfies requireAal2 directly", async () => {
      // Create request with AAL1 session (simulating post-recovery state)
      const aal1Req = new Request("https://internal.portal/api/admin/dashboard-stats", {
        headers: { authorization: "Bearer mock-jwt-aal1-session-token" },
      });

      // requireAal2 must reject AAL1 session
      vi.mocked(requireAal2).mockRejectedValueOnce(new Error("Forbidden: AAL2_REQUIRED"));

      await expect(requireAal2(aal1Req)).rejects.toThrow("Forbidden: AAL2_REQUIRED");
    });

    it("Requirement 7: quarantined administrator is blocked by requireAdminProfile on protected operations", async () => {
      const req = new Request("https://internal.portal/api/admin/projects", {
        headers: { authorization: "Bearer mock-jwt-token" },
      });

      // requireAdminProfile must reject quarantined admins when allowQuarantined is not set
      vi.mocked(requireAdminProfile).mockRejectedValueOnce(
        new Error("Forbidden: MFA_REENROLLMENT_REQUIRED")
      );

      await expect(requireAdminProfile(req)).rejects.toThrow(
        "Forbidden: MFA_REENROLLMENT_REQUIRED"
      );
    });

    it("preserves standard TOTP login verification: valid 6-digit TOTP grants AAL2 and navigates to dashboard", async () => {
      render(<AdminLoginForm />);

      // Fill in 6 digits for normal TOTP challenge
      const digitInputs = screen.getAllByRole("textbox", { name: /digit/i });
      expect(digitInputs).toHaveLength(6);

      await act(async () => {
        fireEvent.change(digitInputs[0], { target: { value: "123456" } });
      });

      const verifyBtn = screen.getByRole("button", { name: /verify & continue/i });
      await act(async () => {
        fireEvent.click(verifyBtn);
      });

      expect(mockVerifyMfaChallenge).toHaveBeenCalledWith("123456");
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/dashboard" });
    });
  });
});
