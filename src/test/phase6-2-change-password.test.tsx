import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { PasswordUpdatedCard } from "@/components/auth/PasswordUpdatedCard";
import { authService } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";
import {
  changeAdminPasswordOperation,
  validatePasswordComplexity,
} from "@/lib/server/auth-rate-limit-operations";
import { resetMemoryRateLimitStore } from "@/lib/server/rate-limiter";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({}),
  useBlocker: vi.fn().mockReturnValue({
    status: "unblocked",
    proceed: vi.fn(),
    reset: vi.fn(),
  }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock requireAal2 behavior by mocking server-auth
vi.mock("@/lib/auth/server-auth", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    requireAal2: vi.fn().mockImplementation(async (req: Request, prisma: any) => {
      const authHeader = req.headers.get("authorization") || "";
      if (!authHeader.startsWith("Bearer ") || authHeader.includes("invalid")) {
        throw new Error("Unauthorized: Valid administrative session required");
      }
      if (authHeader.includes("aal1")) {
        throw new Error("Forbidden: AAL2_REQUIRED");
      }
      const profile = await prisma?.adminProfile?.findUnique({ where: { id: "admin-uuid-001" } });
      if (!profile) {
        throw new Error("Forbidden: AdminProfile not found for authenticated user");
      }
      if (!profile.isActive) {
        throw new Error("Forbidden: AdminProfile is deactivated");
      }
      if (profile.mfaRecoveryPending) {
        throw new Error("Forbidden: MFA_REENROLLMENT_REQUIRED");
      }
      return {
        user: { id: profile.id, email: profile.email },
        profile,
      };
    }),
  };
});

describe("Phase 6.2 — Secure Administrator Password Change Suite", () => {
  const browserClient = getSupabaseBrowserClient();

  beforeEach(() => {
    vi.clearAllMocks();
    resetMemoryRateLimitStore();
  });

  // Helper to create mock authenticated request
  function createMockRequest(headers: Record<string, string> = {}) {
    return new Request("https://api.internal/auth/change-password", {
      method: "POST",
      headers: {
        "x-real-ip": "198.51.100.22",
        authorization: "Bearer valid-aal2-jwt",
        ...headers,
      },
    });
  }

  // Helper to create standard mock Prisma client
  function createMockPrisma(overrides: {
    profile?: any;
    auditLogs?: any[];
  } = {}) {
    const auditLogs = overrides.auditLogs || [];
    const defaultProfile = {
      id: "admin-uuid-001",
      email: "secadmin@cobralearn.in",
      role: "ADMIN",
      isActive: true,
      mfaRecoveryPending: false,
    };

    return {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          if (overrides.profile === null) return Promise.resolve(null);
          return Promise.resolve(overrides.profile || defaultProfile);
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          auditLogs.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
      auditLogs,
    } as any;
  }


  // =========================================================================
  // Requirement 1 & 10: Correct current password permits change & revokes sessions
  // =========================================================================
  it("Requirement 1 & 10: Correct current password updates password and revokes other sessions", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = createMockPrisma({ auditLogs });
    const callOrder: string[] = [];

    const mockSupabaseAdmin = {
      auth: {
        admin: {
          updateUserById: vi.fn().mockImplementation(async (userId, params) => {
            callOrder.push("updateUserById");
            return { data: { user: { id: userId } }, error: null };
          }),
          signOut: vi.fn().mockImplementation(async (userId, scope) => {
            callOrder.push(`signOut:${scope}`);
            return { error: null };
          }),
        },
      },
    };

    const verifier = vi.fn().mockResolvedValue(true);

    const req = createMockRequest();
    const result = await changeAdminPasswordOperation(
      req,
      {
        currentPassword: "CurrentPassword123!",
        newPassword: "BrandNewSecurePassword2026!",
      },
      mockPrisma,
      mockSupabaseAdmin,
      verifier
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe("Password changed successfully.");
    expect(result.globalRevocation).toBe(true);

    // Verify correct execution order: updateUserById must occur before global revocation
    expect(callOrder).toEqual(["updateUserById", "signOut:global"]);
    expect(mockSupabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
      "admin-uuid-001",
      { password: "BrandNewSecurePassword2026!" }
    );
    expect(mockSupabaseAdmin.auth.admin.signOut).toHaveBeenCalledWith("admin-uuid-001", "global");

    // Verify audit log
    const successLog = auditLogs.find((l) => l.action === "auth:password_changed");
    expect(successLog).toBeDefined();
    expect(successLog.actorId).toBe("admin-uuid-001");
    expect(successLog.metadata.outcome).toBe("success");
    expect(successLog.metadata.globalRevocation).toBe("completed");
  });

  // =========================================================================
  // Requirement 2 & 9: Incorrect current password blocks update, no revocation
  // =========================================================================
  it("Requirement 2 & 9: Incorrect current password blocks update and causes no session revocation or success audit", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = createMockPrisma({ auditLogs });

    const mockSupabaseAdmin = {
      auth: {
        admin: {
          updateUserById: vi.fn(),
          signOut: vi.fn(),
        },
      },
    };

    const verifier = vi.fn().mockResolvedValue(false);

    const req = createMockRequest();
    const result = await changeAdminPasswordOperation(
      req,
      {
        currentPassword: "WrongCurrentPassword123!",
        newPassword: "BrandNewSecurePassword2026!",
      },
      mockPrisma,
      mockSupabaseAdmin,
      verifier
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("Current password is incorrect.");

    // Must NOT call updateUserById or signOut
    expect(mockSupabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
    expect(mockSupabaseAdmin.auth.admin.signOut).not.toHaveBeenCalled();

    // Must log failure with safe reason code
    const failedLog = auditLogs.find((l) => l.action === "auth:password_change_failed");
    expect(failedLog).toBeDefined();
    expect(failedLog.actorId).toBe("admin-uuid-001");
    expect(failedLog.metadata.reason).toBe("invalid_current_password");
  });

  // =========================================================================
  // Requirement 3: Active browser session is not replaced or downgraded
  // =========================================================================
  it("Requirement 3: Active browser session is not mutated or downgraded during password change", async () => {
    const browserSignInSpy = vi.spyOn(browserClient.auth, "signInWithPassword");

    const auditLogs: any[] = [];
    const mockPrisma = createMockPrisma({ auditLogs });
    const mockSupabaseAdmin = {
      auth: {
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ error: null }),
          signOut: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    };

    const req = createMockRequest();
    await changeAdminPasswordOperation(
      req,
      {
        currentPassword: "CurrentPassword123!",
        newPassword: "BrandNewSecurePassword2026!",
      },
      mockPrisma,
      mockSupabaseAdmin,
      async () => true // Isolated verification
    );

    // Browser client signInWithPassword must NEVER be called
    expect(browserSignInSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Requirement 4: AAL1 requests are rejected
  // =========================================================================
  it("Requirement 4: AAL1 requests are rejected with elevated AAL2 required error", async () => {
    const mockPrisma = createMockPrisma();
    const mockSupabaseAdmin = {
      auth: { admin: { updateUserById: vi.fn(), signOut: vi.fn() } },
    };

    const req = createMockRequest({ authorization: "Bearer aal1-only-session-token" });
    const result = await changeAdminPasswordOperation(
      req,
      {
        currentPassword: "CurrentPassword123!",
        newPassword: "BrandNewSecurePassword2026!",
      },
      mockPrisma,
      mockSupabaseAdmin,
      async () => true
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Elevated AAL2 authentication required");
    expect(mockSupabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Requirement 5: Inactive and MFA-quarantined administrators are rejected
  // =========================================================================
  it("Requirement 5: Inactive administrators are rejected", async () => {
    const mockPrisma = createMockPrisma({
      profile: {
        id: "admin-uuid-001",
        email: "secadmin@cobralearn.in",
        role: "ADMIN",
        isActive: false,
        mfaRecoveryPending: false,
      },
    });

    const req = createMockRequest();
    const result = await changeAdminPasswordOperation(
      req,
      {
        currentPassword: "CurrentPassword123!",
        newPassword: "BrandNewSecurePassword2026!",
      },
      mockPrisma
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Administrator account is deactivated");
  });

  it("Requirement 5b: MFA-quarantined administrators are rejected", async () => {
    const mockPrisma = createMockPrisma({
      profile: {
        id: "admin-uuid-001",
        email: "secadmin@cobralearn.in",
        role: "ADMIN",
        isActive: true,
        mfaRecoveryPending: true,
      },
    });

    const req = createMockRequest();
    const result = await changeAdminPasswordOperation(
      req,
      {
        currentPassword: "CurrentPassword123!",
        newPassword: "BrandNewSecurePassword2026!",
      },
      mockPrisma
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Account in restricted recovery");
  });

  // =========================================================================
  // Requirement 6: Direct server-function invocation cannot bypass authorization
  // =========================================================================
  it("Requirement 6: Direct invocation without credentials fails closed", async () => {
    const mockPrisma = createMockPrisma();
    const req = new Request("https://api.internal/auth/change-password", {
      method: "POST",
      headers: {},
    });

    const result = await changeAdminPasswordOperation(
      req,
      {
        currentPassword: "CurrentPassword123!",
        newPassword: "BrandNewSecurePassword2026!",
      },
      mockPrisma
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Valid administrative session required");
  });

  // =========================================================================
  // Requirement 7: Password complexity, mismatch, and same-as-current rules
  // =========================================================================
  it("Requirement 7: Password complexity helper enforces all 4 criteria", () => {
    expect(validatePasswordComplexity("short").valid).toBe(false);
    expect(validatePasswordComplexity("alllowercase123!").valid).toBe(false);
    expect(validatePasswordComplexity("ALLUPPERCASE123!").valid).toBe(false);
    expect(validatePasswordComplexity("NoSpecialChar123").valid).toBe(false);
    expect(validatePasswordComplexity("NoDigitsChar!@#").valid).toBe(false);
    expect(validatePasswordComplexity("ValidPass123!").valid).toBe(true);
  });

  it("Requirement 7b: Same-as-current password is rejected with explicit audit log", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = createMockPrisma({ auditLogs });

    const req = createMockRequest();
    const result = await changeAdminPasswordOperation(
      req,
      {
        currentPassword: "ExactSamePassword123!",
        newPassword: "ExactSamePassword123!",
      },
      mockPrisma
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("New password cannot be the same as your current password.");

    const failedLog = auditLogs.find((l) => l.action === "auth:password_change_failed");
    expect(failedLog).toBeDefined();
    expect(failedLog.metadata.reason).toBe("same_as_current_password");
  });

  // =========================================================================
  // Requirement 8: Account and IP rate limiting
  // =========================================================================
  it("Requirement 8: Account-level and IP-level rate limiting throttles excess attempts", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = createMockPrisma({ auditLogs });
    const verifier = vi.fn().mockResolvedValue(false); // Invalid password consumes rate limits

    const req = createMockRequest();

    // Trigger 5 attempts (account threshold limit is 5)
    for (let i = 0; i < 5; i++) {
      const res = await changeAdminPasswordOperation(
        req,
        {
          currentPassword: `WrongPass${i}!`,
          newPassword: "ValidNewPassword123!",
        },
        mockPrisma,
        undefined,
        verifier
      );
      expect(res.message).toBe("Current password is incorrect.");
    }

    // 6th attempt must be throttled
    const throttledRes = await changeAdminPasswordOperation(
      req,
      {
        currentPassword: "WrongPass5!",
        newPassword: "ValidNewPassword123!",
      },
      mockPrisma,
      undefined,
      verifier
    );

    expect(throttledRes.success).toBe(false);
    expect(throttledRes.message).toContain("Too many password change attempts");

    const throttleLog = auditLogs.find((l) => l.action === "auth:password_change_throttled");
    expect(throttleLog).toBeDefined();
    expect(throttleLog.metadata.reason).toContain("rate_limit_exceeded");
  });

  // =========================================================================
  // Requirement 11: Global revocation failure is handled truthfully
  // =========================================================================
  it("Requirement 11: Global revocation failure does not claim password update failed", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = createMockPrisma({ auditLogs });

    const mockSupabaseAdmin = {
      auth: {
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ error: null }),
          signOut: vi.fn().mockRejectedValue(new Error("Global signOut transient network failure")),
        },
      },
    };

    const req = createMockRequest();
    const result = await changeAdminPasswordOperation(
      req,
      {
        currentPassword: "CurrentPassword123!",
        newPassword: "ValidNewPassword123!",
      },
      mockPrisma,
      mockSupabaseAdmin,
      async () => true
    );

    // Password was updated, so success is true, but globalRevocation is false
    expect(result.success).toBe(true);
    expect(result.globalRevocation).toBe(false);

    const log = auditLogs.find((l) => l.action === "auth:password_changed");
    expect(log).toBeDefined();
    expect(log.metadata.outcome).toBe("success");
    expect(log.metadata.globalRevocation).toBe("limited");
  });

  // =========================================================================
  // Requirement 12: Audit events contain no secrets
  // =========================================================================
  it("Requirement 12: Audit events redact all passwords, tokens, and hashes", async () => {
    const auditLogs: any[] = [];
    const mockPrisma = createMockPrisma({ auditLogs });

    const currentPass = "SecretCurrent123!";
    const newPass = "SecretNew456!";

    const mockSupabaseAdmin = {
      auth: {
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ error: null }),
          signOut: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    };

    const req = createMockRequest({ authorization: "Bearer secret-bearer-token-999" });
    await changeAdminPasswordOperation(
      req,
      {
        currentPassword: currentPass,
        newPassword: newPass,
      },
      mockPrisma,
      mockSupabaseAdmin,
      async () => true
    );

    expect(auditLogs.length).toBeGreaterThan(0);
    const serializedLogs = JSON.stringify(auditLogs);

    expect(serializedLogs).not.toContain(currentPass);
    expect(serializedLogs).not.toContain(newPass);
    expect(serializedLogs).not.toContain("secret-bearer-token-999");
    expect(serializedLogs).not.toContain("Authorization");
  });

  // =========================================================================
  // Requirement 13 & Client Form Integration: Form validation, submit, and signout
  // =========================================================================
  it("Requirement 13: ChangePasswordForm validates complexity client-side, calls server, signs out, and navigates", async () => {
    const changeSpy = vi.spyOn(adminClient, "changePassword").mockResolvedValueOnce({
      success: true,
      data: { success: true, message: "Password changed successfully.", globalRevocation: true },
    });
    const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValueOnce({ error: null });

    render(<ChangePasswordForm />);

    const currentInput = screen.getByLabelText(/Current Password/i);
    const newInput = screen.getByLabelText(/^New Password/i);
    const confirmInput = screen.getByLabelText(/Confirm New Password/i);
    const submitBtn = screen.getByRole("button", { name: /Update Password/i });

    // 1. Mismatch rejection
    fireEvent.change(currentInput, { target: { value: "Current123!" } });
    fireEvent.change(newInput, { target: { value: "NewPass123!" } });
    fireEvent.change(confirmInput, { target: { value: "DifferentPass123!" } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/New password and confirmation do not match/i)).toBeInTheDocument();
    expect(changeSpy).not.toHaveBeenCalled();

    // 2. Same as current rejection
    fireEvent.change(newInput, { target: { value: "Current123!" } });
    fireEvent.change(confirmInput, { target: { value: "Current123!" } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/New password cannot be the same as your current password/i)).toBeInTheDocument();
    expect(changeSpy).not.toHaveBeenCalled();

    // 3. Complexity rejection
    fireEvent.change(newInput, { target: { value: "weakpass" } });
    fireEvent.change(confirmInput, { target: { value: "weakpass" } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Password does not meet complexity requirements/i)).toBeInTheDocument();
    expect(changeSpy).not.toHaveBeenCalled();

    // 4. Valid submission
    fireEvent.change(newInput, { target: { value: "ValidNewPass2026!" } });
    fireEvent.change(confirmInput, { target: { value: "ValidNewPass2026!" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(changeSpy).toHaveBeenCalledWith({
        currentPassword: "Current123!",
        newPassword: "ValidNewPass2026!",
      });
      expect(signOutSpy).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/password-updated" });
    });
  });

  // =========================================================================
  // Requirement 13b: PasswordUpdatedCard navigates to login with signOut
  // =========================================================================
  it("Requirement 13b: PasswordUpdatedCard ensures local sign out and returns to login", async () => {
    const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValue({ error: null });

    render(<PasswordUpdatedCard />);

    const returnBtn = screen.getByRole("button", { name: /Go to Admin Login/i });
    fireEvent.click(returnBtn);

    await waitFor(() => {
      expect(signOutSpy).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin" });
    });
  });
});
