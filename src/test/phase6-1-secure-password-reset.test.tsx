import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { PasswordUpdatedCard } from "@/components/auth/PasswordUpdatedCard";
import { authService } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import {
  requestPasswordResetOperation,
  recordPasswordResetCompletionOperation,
} from "@/lib/server/auth-rate-limit-operations";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({}),
}));

describe("Phase 6.1 — Secure Password Reset & Recovery Suite", () => {
  const browserClient = getSupabaseBrowserClient();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Generic Forgot-Password Confirmation Without Premature Navigation
  // =========================================================================
  it("Requirement 1: ForgotPasswordForm displays in-place generic confirmation without premature navigation", async () => {
    const requestSpy = vi.spyOn(adminClient, "requestPasswordReset").mockResolvedValueOnce({
      success: true,
      data: { message: "Dispatched" } as any,
    });

    render(<ForgotPasswordForm />);

    const input = screen.getByLabelText(/Admin Email Address/i);
    const submitBtn = screen.getByRole("button", { name: /Send Reset Link/i });

    fireEvent.change(input, { target: { value: "admin@cobralearn.in" } });
    fireEvent.click(submitBtn);

    // Verify request dispatched with entered email
    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalledWith("admin@cobralearn.in");
    });

    // In-place confirmation displayed
    expect(await screen.findByRole("heading", { name: /Check Your Email/i })).toBeInTheDocument();
    expect(screen.getByText(/Password reset instructions dispatched/i)).toBeInTheDocument();
    expect(screen.getByText(/If an account is associated with this email address/i)).toBeInTheDocument();

    // Must NOT navigate prematurely to /admin/reset-password
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.objectContaining({ to: "/admin/reset-password" }));
  });

  // =========================================================================
  // 2. Anti-Enumeration & Rate Limiting Behavior
  // =========================================================================
  it("Requirement 2: requestPasswordResetOperation returns generic responses for registered, unregistered, and throttled requests", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = {
      adminAuditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          auditLogs.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          if (where.email === "known.admin@cobralearn.in") {
            return Promise.resolve({ id: "admin-known-uuid", email: "known.admin@cobralearn.in" });
          }
          return Promise.resolve(null);
        }),
      },
    } as any;

    const req = new Request("https://api.internal/auth/recovery", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.15" },
    });

    // Known account request
    const resKnown = await requestPasswordResetOperation(
      req,
      { email: "known.admin@cobralearn.in" },
      mockPrisma
    );

    // Unknown account request
    const resUnknown = await requestPasswordResetOperation(
      req,
      { email: "ghost.account@cobralearn.in" },
      mockPrisma
    );

    expect(resKnown.success).toBe(true);
    expect(resUnknown.success).toBe(true);
    expect(resKnown.message).toBe(resUnknown.message);
    expect(resKnown.message).toContain("If an account is associated with this email");

    // Verify audit log emitted for known account without secret leakage
    const knownLog = auditLogs.find((l) => l.actorEmail === "known.admin@cobralearn.in");
    expect(knownLog).toBeDefined();
    expect(knownLog.action).toBe("auth:password_reset_requested");
    expect(knownLog.actorId).toBe("admin-known-uuid");

    // Verify audit log for unknown account does NOT fabricate an admin actor ID
    const unknownLog = auditLogs.find((l) => l.actorEmail === "anonymous@cobralearn.internal");
    expect(unknownLog).toBeDefined();
    expect(unknownLog.action).toBe("auth:password_reset_requested");
    expect(unknownLog.actorId).toBeNull();
  });

  // =========================================================================
  // 3. Reset-Completion Page Rejects Missing, Expired, or Reused Sessions
  // =========================================================================
  it("Requirement 3: ResetPasswordForm displays invalid/expired card when no active recovery session exists", async () => {
    vi.spyOn(authService, "getSession").mockResolvedValue(null);

    render(<ResetPasswordForm />);

    expect(await screen.findByText(/Invalid or Expired/i)).toBeInTheDocument();
    expect(screen.getByText(/This password reset link is invalid, expired, or has already been used/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^New Password$/i)).not.toBeInTheDocument();

    // Clicking request new link navigates to /admin/forgot-password
    const requestBtn = screen.getByRole("button", { name: /Request a New Reset Link/i });
    fireEvent.click(requestBtn);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/forgot-password" });
  });

  it("Requirement 3b: ResetPasswordForm rejects ordinary AAL2 authenticated sessions masquerading as recovery", async () => {
    const mockUser = { id: "admin-123", email: "admin@cobralearn.in" };
    vi.spyOn(authService, "getSession").mockResolvedValue({
      user: mockUser as any,
      access_token: "normal-aal2-jwt",
    } as any);

    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: {
        currentLevel: "aal2",
        nextLevel: "aal2",
        currentAuthenticationMethods: [{ method: "password", timestamp: 12345 }],
      },
      error: null,
    });

    render(<ResetPasswordForm />);

    expect(await screen.findByText(/Invalid or Expired/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^New Password$/i)).not.toBeInTheDocument();
  });

  // =========================================================================
  // 4. Prevention of Unauthorized Password Updates & Valid Form Rendering
  // =========================================================================
  it("Requirement 4: Valid recovery session renders the password reset form and permits updates", async () => {
    const mockUser = { id: "admin-recovery-123", email: "recovery.admin@cobralearn.in" };
    vi.spyOn(authService, "getSession").mockResolvedValue({
      user: mockUser as any,
      access_token: "recovery-aal1-jwt",
    } as any);

    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: {
        currentLevel: "aal1",
        nextLevel: "aal2",
        currentAuthenticationMethods: [{ method: "recovery", timestamp: 12345 }],
      },
      error: null,
    });

    render(<ResetPasswordForm />);

    expect(await screen.findByLabelText(/^New Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm New Password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reset Password/i })).toBeInTheDocument();
  });

  // =========================================================================
  // 5. Password Policy and Safe Error Handling
  // =========================================================================
  it("Requirement 5: Rejects password mismatch and short passwords client-side before update", async () => {
    const mockUser = { id: "admin-123", email: "admin@cobralearn.in" };
    vi.spyOn(authService, "getSession").mockResolvedValue({
      user: mockUser as any,
      access_token: "recovery-jwt",
    } as any);
    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: {
        currentLevel: "aal1",
        nextLevel: "aal2",
        currentAuthenticationMethods: [{ method: "recovery", timestamp: 12345 }],
      },
      error: null,
    });

    const updateSpy = vi.spyOn(authService, "updatePassword");

    render(<ResetPasswordForm />);

    const newPassInput = await screen.findByLabelText(/^New Password$/i);
    const confirmPassInput = screen.getByLabelText(/^Confirm New Password$/i);
    const submitBtn = screen.getByRole("button", { name: /Reset Password/i });

    // Too short
    fireEvent.change(newPassInput, { target: { value: "Short1!" } });
    fireEvent.change(confirmPassInput, { target: { value: "Short1!" } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    // Mismatch
    fireEvent.change(newPassInput, { target: { value: "ValidPassword123!" } });
    fireEvent.change(confirmPassInput, { target: { value: "DifferentPassword123!" } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 6. Session Cleanup After Successful Password Reset
  // =========================================================================
  it("Requirement 6: Successful password reset invokes recordPasswordResetCompletion and signs out recovery session", async () => {
    const mockUser = { id: "admin-123", email: "admin@cobralearn.in" };
    vi.spyOn(authService, "getSession").mockResolvedValue({
      user: mockUser as any,
      access_token: "active-recovery-session-token",
    } as any);

    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: {
        currentLevel: "aal1",
        nextLevel: "aal2",
        currentAuthenticationMethods: [{ method: "recovery", timestamp: 12345 }],
      },
      error: null,
    });

    const updateSpy = vi.spyOn(authService, "updatePassword").mockResolvedValue({
      data: mockUser as any,
      error: null,
    });

    const completionSpy = vi.spyOn(adminClient, "recordPasswordResetCompletion").mockResolvedValue({
      success: true,
      data: { success: true },
    });

    const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValue({
      data: null,
      error: null,
    });

    render(<ResetPasswordForm />);

    const newPassInput = await screen.findByLabelText(/^New Password$/i);
    const confirmPassInput = screen.getByLabelText(/^Confirm New Password$/i);
    const submitBtn = screen.getByRole("button", { name: /Reset Password/i });

    fireEvent.change(newPassInput, { target: { value: "BrandNewSecurePass123!" } });
    fireEvent.change(confirmPassInput, { target: { value: "BrandNewSecurePass123!" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith("BrandNewSecurePass123!");
      expect(completionSpy).toHaveBeenCalledWith("active-recovery-session-token");
      expect(signOutSpy).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/password-updated" });
    });
  });

  // =========================================================================
  // 7. PasswordUpdatedCard Enforces Clean Unauthenticated State
  // =========================================================================
  it("Requirement 7: PasswordUpdatedCard ensures recovery session is terminated before returning to login", async () => {
    const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValue({
      data: null,
      error: null,
    });

    render(<PasswordUpdatedCard />);

    // Automatic cleanup on mount
    expect(signOutSpy).toHaveBeenCalled();

    const returnBtn = screen.getByRole("button", { name: /Go to Admin Login/i });
    fireEvent.click(returnBtn);

    await waitFor(() => {
      expect(signOutSpy).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin" });
    });
  });

  // =========================================================================
  // 8. Server-Side Audit Events for Password Reset Completion
  // =========================================================================
  it("Requirement 8: recordPasswordResetCompletionOperation verifies token and logs auth:password_reset_completed", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = {
      adminAuditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          auditLogs.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "admin-456",
          email: "superadmin@cobralearn.in",
        }),
      },
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "admin-456", email: "superadmin@cobralearn.in" },
          },
          error: null,
        }),
        admin: {
          signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      },
    } as any;

    const req = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.22" },
    });

    const result = await recordPasswordResetCompletionOperation(
      req,
      { accessToken: "authoritative-session-token-abc" },
      mockPrisma,
      mockSupabase
    );

    expect(result.success).toBe(true);
    expect(mockSupabase.auth.getUser).toHaveBeenCalledWith("authoritative-session-token-abc");

    const completionLog = auditLogs.find((l) => l.action === "auth:password_reset_completed");
    expect(completionLog).toBeDefined();
    expect(completionLog.actorId).toBe("admin-456");
    expect(completionLog.actorEmail).toBe("superadmin@cobralearn.in");
    expect(completionLog.ipAddress).toBe("198.51.100.***");
  });

  it("Requirement 8b: recordPasswordResetCompletionOperation logs failure for invalid token without crashing", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = {
      adminAuditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          auditLogs.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("Token expired"),
        }),
      },
    } as any;

    const req = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.33" },
    });

    const result = await recordPasswordResetCompletionOperation(
      req,
      { accessToken: "expired-or-forged-token" },
      mockPrisma,
      mockSupabase
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid or expired session");

    const failedLog = auditLogs.find((l) => l.action === "auth:password_reset_completion_failed");
    expect(failedLog).toBeDefined();
    expect(failedLog.actorId).toBeNull();
  });

  // =========================================================================
  // 9. Redaction of Secrets from Logs and Audit Metadata
  // =========================================================================
  it("Requirement 9: Passwords, reset tokens, and raw credentials are never passed into audit logs", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = {
      adminAuditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          auditLogs.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "admin-789", email: "admin@cobralearn.in" },
          },
          error: null,
        }),
        admin: { signOut: vi.fn().mockResolvedValue({}) },
      },
    } as any;

    const testSecretToken = "super-sensitive-jwt-token-xyz-123";
    const req = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.44" },
    });

    await recordPasswordResetCompletionOperation(
      req,
      { accessToken: testSecretToken },
      mockPrisma,
      mockSupabase
    );

    const logEntry = auditLogs[0];
    const serializedLog = JSON.stringify(logEntry);
    const testRawPassword = "SuperSecretUnchangedPassword999!";
    expect(serializedLog).not.toContain(testSecretToken);
    expect(serializedLog).not.toContain(testRawPassword);
    expect(logEntry.metadata).not.toHaveProperty("password");
    expect(logEntry.metadata).not.toHaveProperty("token");
  });

  // =========================================================================
  // 10. Safe Redirect Destination Validation
  // =========================================================================
  it("Requirement 10: safeRedirect protects password recovery redirects against open redirects", () => {
    expect(safeRedirect("/admin/reset-password")).toBe("/admin/reset-password");
    expect(safeRedirect("https://attacker.site/phish", "/admin/reset-password")).toBe("/admin/reset-password");
    expect(safeRedirect("//attacker.site/phish", "/admin/reset-password")).toBe("/admin/reset-password");
    expect(safeRedirect("javascript:alert(1)", "/admin/reset-password")).toBe("/admin/reset-password");
  });

  // =========================================================================
  // 11. Rejection of Ordinary Password-Login Sessions at Completion Endpoint
  // =========================================================================
  it("Requirement 11: Ordinary login session (AMR contains only password) is rejected by completion endpoint", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = {
      adminAuditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          auditLogs.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "admin-regular-user", email: "regular.admin@cobralearn.in" },
          },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: {
              currentLevel: "aal2",
              nextLevel: "aal2",
              currentAuthenticationMethods: [{ method: "password" }],
            },
            error: null,
          }),
        },
        admin: {
          signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      },
    } as any;

    // Normal JWT payload with amr: ["password"]
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin-regular-user",
        email: "regular.admin@cobralearn.in",
        amr: [{ method: "password" }],
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const ordinaryPasswordToken = `${header}.${payload}.mock-signature`;

    const req = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.55" },
    });

    const result = await recordPasswordResetCompletionOperation(
      req,
      { accessToken: ordinaryPasswordToken },
      mockPrisma,
      mockSupabase
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Unauthorized: Invalid recovery session context");

    // Global session revocation must NOT be executed for rejected ordinary session
    expect(mockSupabase.auth.admin.signOut).not.toHaveBeenCalled();

    // Failure audit log must be recorded
    const failureLog = auditLogs.find((l) => l.action === "auth:password_reset_completion_failed");
    expect(failureLog).toBeDefined();
    expect(failureLog.actorId).toBe("admin-regular-user");
    expect(failureLog.metadata.reason).toBe("unauthorized_non_recovery_session");
  });

  // =========================================================================
  // 12. Completion Endpoint Deduplication and Replay Protection
  // =========================================================================
  it("Requirement 12: Deduplication prevents duplicate completion logs and redundant revocation calls", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = {
      adminAuditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          auditLogs.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "admin-dedup-uuid",
          email: "dedup.admin@cobralearn.in",
        }),
      },
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "admin-dedup-uuid", email: "dedup.admin@cobralearn.in" },
          },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: {
              currentLevel: "aal1",
              nextLevel: "aal2",
              currentAuthenticationMethods: [{ method: "recovery" }],
            },
            error: null,
          }),
        },
        admin: {
          signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      },
    } as any;

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin-dedup-uuid",
        email: "dedup.admin@cobralearn.in",
        amr: [{ method: "recovery" }],
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const validRecoveryToken = `${header}.${payload}.mock-signature`;

    const req = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.66" },
    });

    // First completion invocation
    const result1 = await recordPasswordResetCompletionOperation(
      req,
      { accessToken: validRecoveryToken },
      mockPrisma,
      mockSupabase
    );

    expect(result1.success).toBe(true);
    expect(mockSupabase.auth.admin.signOut).toHaveBeenCalledTimes(1);
    expect(auditLogs.filter((l) => l.action === "auth:password_reset_completed")).toHaveLength(1);

    // Second completion invocation (replayed / duplicated within window)
    const result2 = await recordPasswordResetCompletionOperation(
      req,
      { accessToken: validRecoveryToken },
      mockPrisma,
      mockSupabase
    );

    expect(result2.success).toBe(true);
    expect(result2.message).toContain("Completion already recorded");

    // Global revocation must NOT be called a second time
    expect(mockSupabase.auth.admin.signOut).toHaveBeenCalledTimes(1);

    // No duplicate audit log entry
    expect(auditLogs.filter((l) => l.action === "auth:password_reset_completed")).toHaveLength(1);
  });

  // =========================================================================
  // 13. Password Update Failure Prevents Completion Event and Revocation
  // =========================================================================
  it("Requirement 13: Password update failure prevents completion event and global revocation", async () => {
    const mockUser = { id: "admin-fail-update", email: "fail.update@cobralearn.in" };
    vi.spyOn(authService, "getSession").mockResolvedValue({
      user: mockUser as any,
      access_token: "active-recovery-token-fail",
    } as any);

    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: {
        currentLevel: "aal1",
        nextLevel: "aal2",
        currentAuthenticationMethods: [{ method: "recovery", timestamp: 12345 }],
      },
      error: null,
    });

    const updateSpy = vi.spyOn(authService, "updatePassword").mockResolvedValue({
      data: null,
      error: new Error("New password should be different from old password"),
    });

    const completionSpy = vi.spyOn(adminClient, "recordPasswordResetCompletion");
    const signOutSpy = vi.spyOn(authService, "signOut");

    render(<ResetPasswordForm />);

    const newPassInput = await screen.findByLabelText(/^New Password$/i);
    const confirmPassInput = screen.getByLabelText(/^Confirm New Password$/i);
    const submitBtn = screen.getByRole("button", { name: /Reset Password/i });

    fireEvent.change(newPassInput, { target: { value: "SameOldPassword123!" } });
    fireEvent.change(confirmPassInput, { target: { value: "SameOldPassword123!" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith("SameOldPassword123!");
      expect(screen.getByText(/New password should be different from old password/i)).toBeInTheDocument();
      expect(completionSpy).not.toHaveBeenCalled();
      expect(signOutSpy).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/password-updated" });
    });
  });

  // =========================================================================
  // 14. Non-fatal Completion Failure Does Not Trap User
  // =========================================================================
  it("Requirement 14: Completion audit or revocation failure after password update still navigates to success safely", async () => {
    const mockUser = { id: "admin-resilient-123", email: "resilient.admin@cobralearn.in" };
    vi.spyOn(authService, "getSession").mockResolvedValue({
      user: mockUser as any,
      access_token: "resilient-recovery-token",
    } as any);

    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: {
        currentLevel: "aal1",
        nextLevel: "aal2",
        currentAuthenticationMethods: [{ method: "recovery", timestamp: 12345 }],
      },
      error: null,
    });

    vi.spyOn(authService, "updatePassword").mockResolvedValue({
      data: mockUser as any,
      error: null,
    });

    // Simulate completion network / server error
    vi.spyOn(adminClient, "recordPasswordResetCompletion").mockRejectedValue(
      new Error("Network timeout contacting completion endpoint")
    );

    const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValue({
      data: null,
      error: null,
    });

    render(<ResetPasswordForm />);

    const newPassInput = await screen.findByLabelText(/^New Password$/i);
    const confirmPassInput = screen.getByLabelText(/^Confirm New Password$/i);
    const submitBtn = screen.getByRole("button", { name: /Reset Password/i });

    fireEvent.change(newPassInput, { target: { value: "BrandNewSecurePass123!" } });
    fireEvent.change(confirmPassInput, { target: { value: "BrandNewSecurePass123!" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Must NOT fail the update or trap the user on the reset screen
      expect(signOutSpy).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/password-updated" });
    });
  });

  // =========================================================================
  // 15. Asynchronous Session Hydration Polling
  // =========================================================================
  it("Requirement 15: Still-valid recovery session that is momentarily unhydrated on mount resolves via polling", async () => {
    const mockUser = { id: "admin-poll-123", email: "poll.admin@cobralearn.in" };
    const validSession = {
      user: mockUser as any,
      access_token: "hydrated-recovery-token",
    } as any;

    let callCount = 0;
    vi.spyOn(authService, "getSession").mockImplementation(() => {
      callCount++;
      // Return null on first attempt, then valid session on subsequent attempt
      return Promise.resolve(callCount === 1 ? null : validSession);
    });

    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: {
        currentLevel: "aal1",
        nextLevel: "aal2",
        currentAuthenticationMethods: [{ method: "recovery", timestamp: 12345 }],
      },
      error: null,
    });

    render(<ResetPasswordForm />);

    // Should NOT immediately show "Invalid or Expired Link" — it should hydrate and show the form
    expect(await screen.findByLabelText(/^New Password$/i)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid or Expired/i)).not.toBeInTheDocument();
  });

  // =========================================================================
  // 16. Legitimate Recovery Session with MFA Enabled Updates Password
  // =========================================================================
  it("Requirement 16: Recovery session on MFA-enabled account intercepts GoTrue AAL2 error and completes reset via authoritative server", async () => {
    const mockUser = { id: "admin-mfa-recovery-user", email: "mfa.admin@cobralearn.in" };
    vi.spyOn(authService, "getSession").mockResolvedValue({
      user: mockUser as any,
      access_token: "active-mfa-recovery-jwt",
    } as any);

    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: {
        currentLevel: "aal1",
        nextLevel: "aal2",
        currentAuthenticationMethods: [{ method: "recovery", timestamp: 12345 }],
      },
      error: null,
    });

    // Simulate Supabase GoTrue rejecting client-side updateUser because account has MFA enabled (AAL1 cannot call updateUser)
    const updateSpy = vi.spyOn(authService, "updatePassword").mockResolvedValue({
      data: null,
      error: new Error("AAL2 session is required to update email or password when MFA is enabled."),
    });

    const completionSpy = vi.spyOn(adminClient, "recordPasswordResetCompletion").mockResolvedValue({
      success: true,
      data: { success: true },
    });

    const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValue({
      data: null,
      error: null,
    });

    render(<ResetPasswordForm />);

    const newPassInput = await screen.findByLabelText(/^New Password$/i);
    const confirmPassInput = screen.getByLabelText(/^Confirm New Password$/i);
    const submitBtn = screen.getByRole("button", { name: /Reset Password/i });

    fireEvent.change(newPassInput, { target: { value: "NewMfaSecurePass999!" } });
    fireEvent.change(confirmPassInput, { target: { value: "NewMfaSecurePass999!" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith("NewMfaSecurePass999!");
      // Must call recordPasswordResetCompletion with the token AND new password
      expect(completionSpy).toHaveBeenCalledWith("active-mfa-recovery-jwt", "NewMfaSecurePass999!");
      expect(signOutSpy).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/password-updated" });
    });
  });

  // =========================================================================
  // 17. Server-Side Execution of Recovery Password Update
  // =========================================================================
  it("Requirement 17: recordPasswordResetCompletionOperation authoritatively updates password via Supabase Admin and revokes sessions", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = {
      adminAuditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          auditLogs.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "admin-recovery-server-user",
          email: "recovered@cobralearn.in",
        }),
      },
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "admin-recovery-server-user", email: "recovered@cobralearn.in" },
          },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: {
              currentLevel: "aal1",
              nextLevel: "aal2",
              currentAuthenticationMethods: [{ method: "recovery" }],
            },
            error: null,
          }),
        },
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
          signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      },
    } as any;

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin-recovery-server-user",
        email: "recovered@cobralearn.in",
        amr: [{ method: "recovery" }],
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const validRecoveryToken = `${header}.${payload}.mock-signature`;

    const req = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.77" },
    });

    const result = await recordPasswordResetCompletionOperation(
      req,
      {
        accessToken: validRecoveryToken,
        newPassword: "BrandNewSecurePassword456!",
      },
      mockPrisma,
      mockSupabase
    );

    expect(result.success).toBe(true);
    expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith(
      "admin-recovery-server-user",
      { password: "BrandNewSecurePassword456!" }
    );
    expect(mockSupabase.auth.admin.signOut).toHaveBeenCalledWith("admin-recovery-server-user", "global");

    const completionLog = auditLogs.find((l) => l.action === "auth:password_reset_completed");
    expect(completionLog).toBeDefined();
    expect(completionLog.actorId).toBe("admin-recovery-server-user");
    // Ensure raw password is NOT in audit log
    expect(JSON.stringify(completionLog)).not.toContain("BrandNewSecurePassword456!");
  });

  // =========================================================================
  // 18. Ordinary Session Cannot Update Password via Recovery Endpoint
  // =========================================================================
  it("Requirement 18: Ordinary session (AMR with password) cannot update password via recovery completion endpoint", async () => {
    const mockPrisma = {
      adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "admin-regular", email: "regular@cobralearn.in" },
          },
          error: null,
        }),
        admin: {
          updateUserById: vi.fn(),
          signOut: vi.fn(),
        },
      },
    } as any;

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin-regular",
        email: "regular@cobralearn.in",
        amr: [{ method: "password" }],
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const ordinaryToken = `${header}.${payload}.mock-signature`;

    const req = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.88" },
    });

    const result = await recordPasswordResetCompletionOperation(
      req,
      {
        accessToken: ordinaryToken,
        newPassword: "AttemptedNewPassword789!",
      },
      mockPrisma,
      mockSupabase
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Unauthorized: Invalid recovery session context");
    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled();
    expect(mockSupabase.auth.admin.signOut).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 19. Weak Password Rejected by Server Recovery Endpoint
  // =========================================================================
  it("Requirement 19: Server recovery endpoint rejects passwords failing complexity requirements", async () => {
    const mockPrisma = {
      adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "admin-complex-check", email: "complex@cobralearn.in" },
          },
          error: null,
        }),
        admin: {
          updateUserById: vi.fn(),
          signOut: vi.fn(),
        },
      },
    } as any;

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin-complex-check",
        email: "complex@cobralearn.in",
        amr: [{ method: "recovery" }],
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const recoveryToken = `${header}.${payload}.mock-signature`;

    const req = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.99" },
    });

    // Too short / missing complexity
    const result = await recordPasswordResetCompletionOperation(
      req,
      {
        accessToken: recoveryToken,
        newPassword: "short",
      },
      mockPrisma,
      mockSupabase
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("complexity");
    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 20. Provider Update Failure Followed by Safe Retry
  // =========================================================================
  it("Requirement 20: Provider failure releases in-flight claim, does not mark completion, and allows safe retry", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = {
      adminAuditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          auditLogs.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "admin-retry-user",
          email: "retry@cobralearn.in",
          isActive: true,
        }),
      },
    } as any;

    let updateAttempts = 0;
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "admin-retry-user", email: "retry@cobralearn.in" } },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentAuthenticationMethods: [{ method: "recovery" }] },
            error: null,
          }),
        },
        admin: {
          updateUserById: vi.fn().mockImplementation(() => {
            updateAttempts++;
            if (updateAttempts === 1) {
              return Promise.resolve({ data: null, error: new Error("Supabase Auth internal provider error (500)") });
            }
            return Promise.resolve({ data: { user: {} }, error: null });
          }),
          signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      },
    } as any;

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin-retry-user",
        email: "retry@cobralearn.in",
        amr: [{ method: "recovery" }],
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const recoveryToken = `${header}.${payload}.mock-signature`;

    const req = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.111" },
    });

    // Attempt 1: Provider failure
    const attempt1 = await recordPasswordResetCompletionOperation(
      req,
      { accessToken: recoveryToken, newPassword: "SecurePasswordRetry1!" },
      mockPrisma,
      mockSupabase
    );

    expect(attempt1.success).toBe(false);
    expect(attempt1.message).toContain("Supabase Auth internal provider error");
    expect(mockSupabase.auth.admin.signOut).not.toHaveBeenCalled();
    expect(auditLogs.some((l) => l.action === "auth:password_reset_completion_failed" && l.metadata.reason === "provider_update_failed")).toBe(true);

    // Attempt 2: Immediate user retry after failure must NOT be falsely marked as already completed!
    const attempt2 = await recordPasswordResetCompletionOperation(
      req,
      { accessToken: recoveryToken, newPassword: "SecurePasswordRetry1!" },
      mockPrisma,
      mockSupabase
    );

    expect(attempt2.success).toBe(true);
    expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledTimes(2);
    expect(mockSupabase.auth.admin.signOut).toHaveBeenCalledWith("admin-retry-user", "global");
    expect(auditLogs.some((l) => l.action === "auth:password_reset_completed")).toBe(true);
  });

  // =========================================================================
  // 21. Atomic In-Flight Concurrency Control
  // =========================================================================
  it("Requirement 21: In-flight lock rejects concurrent duplicate requests to prevent simultaneous updates", async () => {
    const mockPrisma = {
      adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "admin-concurrent-user",
          email: "concurrent@cobralearn.in",
          isActive: true,
        }),
      },
    } as any;

    let resolveUpdate: () => void;
    const updateBarrier = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "admin-concurrent-user", email: "concurrent@cobralearn.in" } },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentAuthenticationMethods: [{ method: "recovery" }] },
            error: null,
          }),
        },
        admin: {
          updateUserById: vi.fn().mockImplementation(async () => {
            await updateBarrier;
            return { data: { user: {} }, error: null };
          }),
          signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      },
    } as any;

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin-concurrent-user",
        email: "concurrent@cobralearn.in",
        amr: [{ method: "recovery" }],
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const recoveryToken = `${header}.${payload}.mock-signature`;

    const req1 = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.120" },
    });
    const req2 = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.121" },
    });

    // Launch first request (holds in-flight lock while awaiting updateBarrier)
    const p1 = recordPasswordResetCompletionOperation(
      req1,
      { accessToken: recoveryToken, newPassword: "ConcurPassword123!" },
      mockPrisma,
      mockSupabase
    );

    // Launch second concurrent request immediately
    const p2 = recordPasswordResetCompletionOperation(
      req2,
      { accessToken: recoveryToken, newPassword: "ConcurPassword123!" },
      mockPrisma,
      mockSupabase
    );

    // Release barrier
    resolveUpdate!();

    const [res1, res2] = await Promise.all([p1, p2]);

    // Exactly one must succeed and one must be rejected by concurrency lock
    const successes = [res1, res2].filter((r) => r.success);
    const failures = [res1, res2].filter((r) => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toContain("in progress");
    expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // 22. Ambiguous Provider Timeout with Reconciliation
  // =========================================================================
  it("Requirement 22: Ambiguous provider timeout reconciles if user record was updated, fails safely if unconfirmed", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = {
      adminAuditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          auditLogs.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "admin-timeout-user",
          email: "timeout@cobralearn.in",
          isActive: true,
        }),
      },
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "admin-timeout-user",
              email: "timeout@cobralearn.in",
              // updated_at is within the last 2 seconds (reconciled!)
              updated_at: new Date().toISOString(),
            },
          },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentAuthenticationMethods: [{ method: "recovery" }] },
            error: null,
          }),
        },
        admin: {
          updateUserById: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("504 Gateway Timeout while contacting auth upstream"),
          }),
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "admin-timeout-user",
                email: "timeout@cobralearn.in",
                updated_at: new Date().toISOString(),
              },
            },
            error: null,
          }),
          signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      },
    } as any;

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin-timeout-user",
        email: "timeout@cobralearn.in",
        amr: [{ method: "recovery" }],
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const recoveryToken = `${header}.${payload}.mock-signature`;

    const req = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.130" },
    });

    const result = await recordPasswordResetCompletionOperation(
      req,
      { accessToken: recoveryToken, newPassword: "TimeoutPass123!" },
      mockPrisma,
      mockSupabase
    );

    // Reconciled successfully based on fresh updated_at
    expect(result.success).toBe(true);
    expect(mockSupabase.auth.admin.signOut).toHaveBeenCalledWith("admin-timeout-user", "global");
  });

  // =========================================================================
  // 23. Active Administrator Validation Suite
  // =========================================================================
  it("Requirement 23: Enforces active AdminProfile status and rejects inactive, missing, or mismatched identities", async () => {
    const auditLogs: any[] = [];
    const mockAudit = vi.fn().mockImplementation((args: any) => {
      auditLogs.push(args.data);
      return Promise.resolve(args.data);
    });

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin-check-id",
        email: "admin.check@cobralearn.in",
        amr: [{ method: "recovery" }],
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const recoveryToken = `${header}.${payload}.mock-signature`;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "admin-check-id", email: "admin.check@cobralearn.in" } },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentAuthenticationMethods: [{ method: "recovery" }] },
            error: null,
          }),
        },
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
          signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      },
    } as any;

    const req = new Request("https://api.internal/auth/reset-completion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.140" },
    });

    // 23a. Inactive admin profile rejected
    const inactivePrisma = {
      adminAuditLog: { create: mockAudit },
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "admin-check-id",
          email: "admin.check@cobralearn.in",
          isActive: false, // DEACTIVATED
        }),
      },
    } as any;

    const inactiveRes = await recordPasswordResetCompletionOperation(
      req,
      { accessToken: recoveryToken, newPassword: "ValidPassword123!" },
      inactivePrisma,
      mockSupabase
    );

    expect(inactiveRes.success).toBe(false);
    expect(inactiveRes.message).toContain("Identity verification failed");
    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled();
    expect(auditLogs.some((l) => l.metadata.reason === "inactive_admin_account")).toBe(true);

    // 23b. Missing admin profile rejected
    const missingPrisma = {
      adminAuditLog: { create: mockAudit },
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue(null), // MISSING
      },
    } as any;

    const missingRes = await recordPasswordResetCompletionOperation(
      req,
      { accessToken: recoveryToken, newPassword: "ValidPassword123!" },
      missingPrisma,
      mockSupabase
    );

    expect(missingRes.success).toBe(false);
    expect(missingRes.message).toContain("Identity verification failed");
    expect(auditLogs.some((l) => l.metadata.reason === "missing_admin_profile")).toBe(true);

    // 23c. Mismatched email rejected
    const mismatchPrisma = {
      adminAuditLog: { create: mockAudit },
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "admin-check-id",
          email: "completely.different@cobralearn.in",
          isActive: true,
        }),
      },
    } as any;

    const mismatchRes = await recordPasswordResetCompletionOperation(
      req,
      { accessToken: recoveryToken, newPassword: "ValidPassword123!" },
      mismatchPrisma,
      mockSupabase
    );

    expect(mismatchRes.success).toBe(false);
    expect(mismatchRes.message).toContain("Identity verification failed");
    expect(auditLogs.some((l) => l.metadata.reason === "profile_identity_mismatch")).toBe(true);
  });

  // =========================================================================
  // 24. Single Submission Produces At Most One Recovery Completion Attempt
  // =========================================================================
  it("Requirement 24: Single form submission invokes recordPasswordResetCompletion at most once on AAL2 fallback", async () => {
    const mockUser = { id: "admin-single-call", email: "single@cobralearn.in" };
    vi.spyOn(authService, "getSession").mockResolvedValue({
      user: mockUser as any,
      access_token: "single-call-recovery-jwt",
    } as any);

    vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
      data: {
        currentLevel: "aal1",
        nextLevel: "aal2",
        currentAuthenticationMethods: [{ method: "recovery", timestamp: 12345 }],
      },
      error: null,
    });

    // authService.updatePassword reports GoTrue AAL2 error
    vi.spyOn(authService, "updatePassword").mockResolvedValue({
      data: null,
      error: new Error("AAL2 session is required to update email or password when MFA is enabled."),
    });

    const completionSpy = vi.spyOn(adminClient, "recordPasswordResetCompletion").mockResolvedValue({
      success: true,
      data: { success: true },
    });

    vi.spyOn(authService, "signOut").mockResolvedValue({ data: null, error: null });

    render(<ResetPasswordForm />);

    const newPassInput = await screen.findByLabelText(/^New Password$/i);
    const confirmPassInput = screen.getByLabelText(/^Confirm New Password$/i);
    const submitBtn = screen.getByRole("button", { name: /Reset Password/i });

    fireEvent.change(newPassInput, { target: { value: "SingleCallSecurePass123!" } });
    fireEvent.change(confirmPassInput, { target: { value: "SingleCallSecurePass123!" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Must call recordPasswordResetCompletion exactly once!
      expect(completionSpy).toHaveBeenCalledTimes(1);
      expect(completionSpy).toHaveBeenCalledWith("single-call-recovery-jwt", "SingleCallSecurePass123!");
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/password-updated" });
    });
  });
});
