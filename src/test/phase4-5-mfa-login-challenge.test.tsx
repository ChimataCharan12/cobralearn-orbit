import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Factor, Session, User } from "@supabase/supabase-js";
import type { AdminProfile } from "@prisma/client";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import * as useAuthModule from "@/lib/auth/use-auth";
import { adminClient } from "@/lib/api/admin-client";

// Mock @tanstack/react-router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

describe("Phase 4.5: Login MFA Challenge UI & Flow (Six-Box OTP Redesign)", () => {
  const mockAdminUser: User = {
    id: "user-admin-mfa-001",
    email: "admin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const mockAal1Session: Session = {
    access_token: "mock-jwt-aal1-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: mockAdminUser,
  };

  const mockAal2Session: Session = {
    access_token: "mock-jwt-aal2-elevated-token",
    refresh_token: "mock-refresh-token-aal2",
    expires_in: 3600,
    token_type: "bearer",
    user: mockAdminUser,
  };

  const mockActiveAdminProfile: AdminProfile = {
    id: "user-admin-mfa-001",
    fullName: "Security Administrator",
    avatarUrl: null,
    role: "ADMIN",
    isActive: true,
    lastLoginAt: new Date(),
    phone: null,
    title: "Security Officer",
    department: "SecOps",
    bio: null,
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
    localStorage.clear();
    sessionStorage.clear();

    mockSignIn = vi.fn().mockResolvedValue({
      data: {
        user: mockAdminUser,
        session: mockAal1Session,
        profile: mockActiveAdminProfile,
        mfaRequired: false,
      },
      error: null,
    });

    mockVerifyMfaChallenge = vi.fn().mockResolvedValue({
      data: {
        user: mockAdminUser,
        session: mockAal2Session,
        profile: mockActiveAdminProfile,
      },
      error: null,
    });

    mockSignOut = vi.fn().mockResolvedValue({ data: null, error: null });

    mockCheckMfaState = vi.fn().mockResolvedValue({
      currentAal: "aal1",
      nextAal: "aal1",
      isMfaRequired: false,
      isMfaEnrolled: false,
      verifiedFactorId: null,
    });

    defaultAuthContext = {
      user: null,
      session: null,
      adminProfile: null,
      isAuthenticated: false,
      isEligibleAdmin: false,
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
      data: { id: "login-1", loggedAt: new Date().toISOString() },
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  // =========================================================================
  // 1. Non-MFA Administrators Retain Existing Login Flow
  // =========================================================================
  it("Requirement 1: administrators without verified MFA proceed directly to dashboard without seeing challenge", async () => {
    render(<AdminLoginForm />);

    // Credentials form is visible
    expect(screen.getByLabelText(/email address/i)).toBeDefined();
    expect(screen.getByLabelText(/^password$/i)).toBeDefined();

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitBtn = screen.getByRole("button", { name: /^sign in$/i });

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: "admin@cobralearn.com" } });
      fireEvent.change(passwordInput, { target: { value: "ValidPassword123!" } });
      fireEvent.click(submitBtn);
    });

    expect(mockSignIn).toHaveBeenCalledWith("admin@cobralearn.com", "ValidPassword123!");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/dashboard" });
    // Challenge screen should NEVER have appeared
    expect(screen.queryByRole("heading", { name: /two-factor/i })).toBeNull();
  });

  // =========================================================================
  // 2. Enrolled Administrator at AAL1 Sees MFA Challenge Screen
  // =========================================================================
  it("Requirement 2: enrolled administrator at AAL1 transitions to MFA challenge screen instead of navigating to dashboard", async () => {
    mockSignIn.mockResolvedValueOnce({
      data: {
        user: mockAdminUser,
        session: mockAal1Session,
        mfaRequired: true,
      },
      error: null,
    });

    render(<AdminLoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitBtn = screen.getByRole("button", { name: /^sign in$/i });

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: "mfa-admin@cobralearn.com" } });
      fireEvent.change(passwordInput, { target: { value: "ValidPassword123!" } });
      fireEvent.click(submitBtn);
    });

    expect(mockSignIn).toHaveBeenCalled();
    // Must NOT navigate to dashboard yet
    expect(mockNavigate).not.toHaveBeenCalled();

    // MFA Challenge screen elements must be present
    expect(screen.getByRole("heading", { name: /enter two-factor code/i })).toBeDefined();
    expect(
      screen.getByText(/please enter the 6-digit verification code generated by your authenticator app/i)
    ).toBeDefined();
    expect(screen.getByText("6-Digit Security Code")).toBeDefined();
    expect(screen.getByRole("group", { name: /6-digit security code/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /verify & continue/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /sign out and return to login/i })).toBeDefined();
    expect(screen.getByText(/session elevation to aal2 required for admin access/i)).toBeDefined();
  });

  // =========================================================================
  // 3. Mounts directly in MFA Challenge View if isMfaRequired is true
  // =========================================================================
  it("Requirement 2b: mounts directly in challenge view when existing session has isMfaRequired = true", () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      user: mockAdminUser,
      session: mockAal1Session,
      isMfaRequired: true,
      isMfaEnrolled: true,
      currentAal: "aal1",
      nextAal: "aal2",
    });

    render(<AdminLoginForm />);

    expect(screen.getByRole("heading", { name: /enter two-factor code/i })).toBeDefined();
    expect(screen.getByRole("group", { name: /6-digit security code/i })).toBeDefined();
    expect(screen.queryByLabelText(/email address/i)).toBeNull();
  });

  // =========================================================================
  // 4. Six individual digit boxes render correctly with separator
  // =========================================================================
  it("UI Requirement 1: renders six individual digit boxes with separator and accessibility labels", () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
    });

    render(<AdminLoginForm />);

    const group = screen.getByRole("group", { name: /6-digit security code/i });
    expect(group).toBeDefined();

    for (let i = 1; i <= 6; i++) {
      const box = screen.getByLabelText(`Digit ${i} of 6`) as HTMLInputElement;
      expect(box).toBeDefined();
      expect(box.maxLength).toBe(1);
      expect(box.getAttribute("inputMode")).toBe("numeric");
      expect(box.value).toBe("");
    }

    // Separator exists between 3rd and 4th digit
    expect(screen.getByText("-")).toBeDefined();
  });

  // =========================================================================
  // 5. Entering a digit advances focus
  // =========================================================================
  it("UI Requirement 2: entering a valid digit advances focus to the next input box", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;
    const box2 = screen.getByLabelText("Digit 2 of 6") as HTMLInputElement;

    box1.focus();
    expect(document.activeElement).toBe(box1);

    await act(async () => {
      fireEvent.change(box1, { target: { value: "3" } });
    });

    expect(box1.value).toBe("3");
    expect(document.activeElement).toBe(box2);
  });

  // =========================================================================
  // 6. Backspace navigation works
  // =========================================================================
  it("UI Requirement 3: backspace clears current digit or deletes and moves to previous box if empty", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;
    const box2 = screen.getByLabelText("Digit 2 of 6") as HTMLInputElement;

    // Fill box 1 and box 2
    await act(async () => {
      fireEvent.change(box1, { target: { value: "7" } });
    });
    await act(async () => {
      fireEvent.change(box2, { target: { value: "8" } });
    });

    expect(box1.value).toBe("7");
    expect(box2.value).toBe("8");

    // Press backspace on box 2 -> clears box 2
    await act(async () => {
      fireEvent.keyDown(box2, { key: "Backspace" });
    });
    expect(box2.value).toBe("");

    // Press backspace again on now-empty box 2 -> moves to box 1 and clears box 1
    await act(async () => {
      fireEvent.keyDown(box2, { key: "Backspace" });
    });
    expect(box1.value).toBe("");
    expect(document.activeElement).toBe(box1);
  });

  // =========================================================================
  // 7. Arrow-key navigation works
  // =========================================================================
  it("UI Requirement 4: left and right arrow keys navigate horizontally between boxes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;
    const box2 = screen.getByLabelText("Digit 2 of 6") as HTMLInputElement;

    box1.focus();
    expect(document.activeElement).toBe(box1);

    // ArrowRight moves from box 1 to box 2
    await act(async () => {
      fireEvent.keyDown(box1, { key: "ArrowRight" });
    });
    expect(document.activeElement).toBe(box2);

    // ArrowLeft moves from box 2 to box 1
    await act(async () => {
      fireEvent.keyDown(box2, { key: "ArrowLeft" });
    });
    expect(document.activeElement).toBe(box1);
  });

  // =========================================================================
  // 8. Pasting six digits populates all boxes
  // =========================================================================
  it("UI Requirement 5: pasting a 6-digit code distributes digits across all six boxes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;
    const verifyBtn = screen.getByRole("button", { name: /verify & continue/i });

    expect(verifyBtn).toBeDisabled();

    await act(async () => {
      fireEvent.paste(box1, {
        clipboardData: {
          getData: () => "842915",
        },
      });
    });

    expect((screen.getByLabelText("Digit 1 of 6") as HTMLInputElement).value).toBe("8");
    expect((screen.getByLabelText("Digit 2 of 6") as HTMLInputElement).value).toBe("4");
    expect((screen.getByLabelText("Digit 3 of 6") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("Digit 4 of 6") as HTMLInputElement).value).toBe("9");
    expect((screen.getByLabelText("Digit 5 of 6") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("Digit 6 of 6") as HTMLInputElement).value).toBe("5");

    // Complete 6 digits enables the verify button
    expect(verifyBtn).not.toBeDisabled();
  });

  // =========================================================================
  // 9. Incomplete codes cannot be submitted
  // =========================================================================
  it("UI Requirement 6: incomplete codes disable the verify button and cannot be submitted", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
      verifyMfaChallenge: mockVerifyMfaChallenge,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;
    const box2 = screen.getByLabelText("Digit 2 of 6") as HTMLInputElement;
    const verifyBtn = screen.getByRole("button", { name: /verify & continue/i });

    expect(verifyBtn).toBeDisabled();

    // Enter only 2 digits
    await act(async () => {
      fireEvent.change(box1, { target: { value: "1" } });
      fireEvent.change(box2, { target: { value: "2" } });
    });

    expect(verifyBtn).toBeDisabled();

    // Attempting click while disabled should not trigger handler
    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    expect(mockVerifyMfaChallenge).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 10. Invalid input is handled safely
  // =========================================================================
  it("UI Requirement 7: strips non-numeric input and caps to single digit per box", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;

    // Typing non-numeric character
    await act(async () => {
      fireEvent.change(box1, { target: { value: "abc!" } });
    });

    expect(box1.value).toBe("");

    // Pasting text with symbols strips non-digits
    await act(async () => {
      fireEvent.paste(box1, {
        clipboardData: {
          getData: () => "1a-2b-3c-4d-5e-6f",
        },
      });
    });

    expect((screen.getByLabelText("Digit 1 of 6") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("Digit 2 of 6") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("Digit 3 of 6") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("Digit 4 of 6") as HTMLInputElement).value).toBe("4");
    expect((screen.getByLabelText("Digit 5 of 6") as HTMLInputElement).value).toBe("5");
    expect((screen.getByLabelText("Digit 6 of 6") as HTMLInputElement).value).toBe("6");
  });

  // =========================================================================
  // 11. Loading and error states remain visible and accessible
  // =========================================================================
  it("UI Requirement 8: displays sanitized inline error with role='alert' and prevents duplicate in-flight submissions", async () => {
    let resolveVerify: any;
    const verifyPromise = new Promise((resolve) => {
      resolveVerify = resolve;
    });

    mockVerifyMfaChallenge.mockReturnValue(verifyPromise);

    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
      verifyMfaChallenge: mockVerifyMfaChallenge,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;
    const verifyBtn = screen.getByRole("button", { name: /verify & continue/i });

    await act(async () => {
      fireEvent.paste(box1, {
        clipboardData: {
          getData: () => "000000",
        },
      });
    });

    // First click
    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    expect(mockVerifyMfaChallenge).toHaveBeenCalledTimes(1);
    expect(verifyBtn).toBeDisabled();
    expect(screen.getByText(/verifying code.../i)).toBeDefined();

    // Second click ignored while in-flight
    await act(async () => {
      fireEvent.click(verifyBtn);
    });
    expect(mockVerifyMfaChallenge).toHaveBeenCalledTimes(1);

    // Reject verification
    await act(async () => {
      resolveVerify({
        data: null,
        error: new Error("Invalid verification code."),
      });
    });

    // Error alert displayed
    const alertEl = screen.getByRole("alert");
    expect(alertEl.textContent).toContain("Invalid verification code.");
    expect(verifyBtn).not.toBeDisabled();
  });

  // =========================================================================
  // 12. Verify & Continue invokes handler with expected code
  // =========================================================================
  it("UI Requirement 9: Verify & Continue submits full 6-digit code and completes elevation", async () => {
    mockVerifyMfaChallenge.mockResolvedValueOnce({
      data: {
        user: mockAdminUser,
        session: mockAal2Session,
        profile: mockActiveAdminProfile,
      },
      error: null,
    });

    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
      verifyMfaChallenge: mockVerifyMfaChallenge,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;
    const verifyBtn = screen.getByRole("button", { name: /verify & continue/i });

    await act(async () => {
      fireEvent.paste(box1, {
        clipboardData: {
          getData: () => "654321",
        },
      });
    });

    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    expect(mockVerifyMfaChallenge).toHaveBeenCalledWith("654321");
    expect(adminClient.recordLoginHistory).toHaveBeenCalledWith(mockAal2Session.access_token);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/dashboard" });
  });

  // =========================================================================
  // 13. Sign out and return to Login invokes safe handler
  // =========================================================================
  it("UI Requirement 10: 'Sign out and return to Login' purges partial session and restores credentials view", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
      signOut: mockSignOut,
    });

    render(<AdminLoginForm />);

    expect(screen.getByRole("heading", { name: /enter two-factor code/i })).toBeDefined();

    const signoutBtn = screen.getByRole("button", { name: /sign out and return to login/i });

    await act(async () => {
      fireEvent.click(signoutBtn);
    });

    expect(mockSignOut).toHaveBeenCalled();
    // Returned to credentials view
    expect(screen.getByLabelText(/email address/i)).toBeDefined();
    expect(screen.getByLabelText(/^password$/i)).toBeDefined();
    expect(screen.queryByRole("heading", { name: /enter two-factor code/i })).toBeNull();
  });

  // =========================================================================
  // 14. Inactive Profile Protection
  // =========================================================================
  it("Security Requirement: blocks inactive or unprovisioned administrator profile even with valid code", async () => {
    mockVerifyMfaChallenge.mockResolvedValueOnce({
      data: null,
      error: new Error("Forbidden: Inactive or unprovisioned administrator."),
    });

    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
      verifyMfaChallenge: mockVerifyMfaChallenge,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;
    const verifyBtn = screen.getByRole("button", { name: /verify & continue/i });

    await act(async () => {
      fireEvent.paste(box1, {
        clipboardData: {
          getData: () => "654321",
        },
      });
    });

    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    const alertEl = screen.getByRole("alert");
    expect(alertEl.textContent).toContain("Access denied: Inactive or unprovisioned administrator.");
  });

  // =========================================================================
  // 15. Security: No Leakage of Tokens, Secrets, or URIs in Error Messages
  // =========================================================================
  it("Security Requirement: error handling never exposes raw tokens, secrets, or internal SDK parameters", async () => {
    const rawSensitiveError =
      "Supabase internal error: Bearer eyJhbGciOiJIUzI1NiJ9.sensitive-token secret=JBSWY3DPEHPK3PXP uri=otpauth://totp/CobraLearn:admin?secret=JBSWY3DPEHPK3PXP";

    mockVerifyMfaChallenge.mockResolvedValueOnce({
      data: null,
      error: new Error(rawSensitiveError),
    });

    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
      verifyMfaChallenge: mockVerifyMfaChallenge,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;
    const verifyBtn = screen.getByRole("button", { name: /verify & continue/i });

    await act(async () => {
      fireEvent.paste(box1, {
        clipboardData: {
          getData: () => "999999",
        },
      });
    });

    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    const alertEl = screen.getByRole("alert");
    expect(alertEl.textContent).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(alertEl.textContent).not.toContain("JBSWY3DPEHPK3PXP");
    expect(alertEl.textContent).not.toContain("otpauth://");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  // =========================================================================
  // 16. Profile Verification Database Error Transparency
  // =========================================================================
  it("displays transparent error message when profile verification encounters a database error", async () => {
    mockVerifyMfaChallenge.mockResolvedValueOnce({
      data: null,
      error: new Error("The column AdminProfile.mfaRecoveryPending does not exist in the current database."),
    });

    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
      verifyMfaChallenge: mockVerifyMfaChallenge,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;
    const verifyBtn = screen.getByRole("button", { name: /verify & continue/i });

    await act(async () => {
      fireEvent.paste(box1, {
        clipboardData: {
          getData: () => "654321",
        },
      });
    });

    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    const alertEl = screen.getByRole("alert");
    expect(alertEl.textContent).toContain("mfaRecoveryPending");
    expect(alertEl.textContent).not.toContain("Access denied: Inactive or unprovisioned administrator.");
  });

  // =========================================================================
  // 17. Successful TOTP and Profile Verification Navigation
  // =========================================================================
  it("successful TOTP and profile verification records login and navigates to dashboard", async () => {
    mockVerifyMfaChallenge.mockResolvedValueOnce({
      data: {
        user: { id: "user-123", email: "admin@cobralearn.com" } as any,
        session: { access_token: "elevated-aal2-token" } as any,
        profile: { id: "user-123", email: "admin@cobralearn.com", role: "ADMIN", isActive: true } as any,
      },
      error: null,
    });

    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      ...defaultAuthContext,
      isMfaRequired: true,
      verifyMfaChallenge: mockVerifyMfaChallenge,
    });

    render(<AdminLoginForm />);

    const box1 = screen.getByLabelText("Digit 1 of 6") as HTMLInputElement;
    const verifyBtn = screen.getByRole("button", { name: /verify & continue/i });

    await act(async () => {
      fireEvent.paste(box1, {
        clipboardData: {
          getData: () => "123456",
        },
      });
    });

    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/dashboard" });
  });
});
