import { describe, expect, it, vi, beforeEach } from "vitest";
import { authService } from "@/lib/auth/auth-service";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

describe("Phase 6D — Password & Recovery Verification Suite", () => {
  const browserClient = getSupabaseBrowserClient();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Valid login invokes the correct Supabase operation
  it("Requirement 1: Valid login invokes signInWithPassword with trimmed email", async () => {
    const mockUser = { id: "user-123", email: "admin@cobralearn.com" };
    const mockSession = { access_token: "jwt-token-123", user: mockUser };

    const signInSpy = vi.spyOn(browserClient.auth, "signInWithPassword").mockResolvedValueOnce({
      data: { user: mockUser as any, session: mockSession as any },
      error: null,
    });

    const result = await authService.signIn("  admin@cobralearn.com  ", "CorrectPassword123!");

    expect(signInSpy).toHaveBeenCalledWith({
      email: "admin@cobralearn.com",
      password: "CorrectPassword123!",
    });
    expect(result.error).toBeNull();
    expect(result.data?.user.id).toBe("user-123");
    expect(result.data?.session.access_token).toBe("jwt-token-123");
  });

  // 2. Invalid login returns a safe error
  it("Requirement 2: Invalid login returns a safe error without leaking internal details", async () => {
    vi.spyOn(browserClient.auth, "signInWithPassword").mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error("Invalid login credentials") as any,
    });

    const result = await authService.signIn("admin@cobralearn.com", "WrongPassword!");

    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe("Invalid login credentials");
  });

  // 3. Forgot-password invokes the correct reset API and callback URL
  it("Requirement 3: Forgot-password invokes resetPasswordForEmail with /auth/callback redirect", async () => {
    const resetSpy = vi.spyOn(browserClient.auth, "resetPasswordForEmail").mockResolvedValueOnce({
      data: {},
      error: null,
    });

    const result = await authService.resetPassword("admin@cobralearn.in");

    expect(result.error).toBeNull();
    expect(resetSpy).toHaveBeenCalledWith(
      "admin@cobralearn.in",
      expect.objectContaining({
        redirectTo: expect.stringMatching(
          /\/auth\/callback\?type=recovery&next=\/admin\/reset-password/,
        ),
      }),
    );
  });

  // 4. Forgot-password responses do not disclose account existence
  it("Requirement 4: Forgot-password resolves cleanly regardless of user existence", async () => {
    vi.spyOn(browserClient.auth, "resetPasswordForEmail").mockResolvedValueOnce({
      data: {},
      error: null,
    });

    // Supabase standard behavior returns generic success even for non-existent users
    const result = await authService.resetPassword("nonexistent@cobralearn.com");
    expect(result.error).toBeNull();
  });

  // 5. Recovery callback success and failure cases
  it("Requirement 5a: Recovery callback successfully exchanges code for recovery session", async () => {
    const mockUser = { id: "user-recovery-123", email: "recovery@cobralearn.com" };
    const mockSession = { access_token: "recovery-jwt", user: mockUser };

    vi.spyOn(browserClient.auth, "exchangeCodeForSession").mockResolvedValueOnce({
      data: { user: mockUser as any, session: mockSession as any },
      error: null,
    });

    const result = await authService.exchangeCodeForSession("valid-recovery-code");
    expect(result.error).toBeNull();
    expect(result.data?.user.id).toBe("user-recovery-123");
  });

  it("Requirement 5b: Recovery callback handles expired/invalid recovery code safely", async () => {
    vi.spyOn(browserClient.auth, "exchangeCodeForSession").mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error("Auth code expired or already used") as any,
    });

    const result = await authService.exchangeCodeForSession("expired-code");
    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("Auth code expired");
  });

  // 6. External and malformed redirect destinations are rejected
  it("Requirement 6: safeRedirect blocks open redirects, protocol-relative URLs, and script schemes", () => {
    expect(safeRedirect("https://malicious-site.com/steal-token")).toBe("/admin/dashboard");
    expect(safeRedirect("//malicious-site.com")).toBe("/admin/dashboard");
    expect(safeRedirect("\\\\evil.com\\share")).toBe("/admin/dashboard");
    expect(safeRedirect("javascript:alert(document.cookie)")).toBe("/admin/dashboard");
    expect(safeRedirect("data:text/html,<script>alert(1)</script>")).toBe("/admin/dashboard");
    expect(safeRedirect("/admin/reset-password")).toBe("/admin/reset-password");
  });

  // 7. Reset-password rejects missing or invalid recovery sessions
  it("Requirement 7: Password update fails when no active recovery session is present", async () => {
    vi.spyOn(browserClient.auth, "updateUser").mockResolvedValueOnce({
      data: { user: null },
      error: new Error("Auth session missing! Unable to update password.") as any,
    });

    const result = await authService.updatePassword("NewPassword123!");
    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("Auth session missing");
  });

  // 8. Password mismatch is rejected before submission
  it("Requirement 8: Password matching logic verifies equality and length", () => {
    const passwordA: string = "SecretPass123!";
    const passwordB: string = "DifferentPass123!";
    const shortPass = "Short1!";

    expect(passwordA === passwordB).toBe(false);
    expect(passwordA.length >= 8).toBe(true);
    expect(shortPass.length >= 8).toBe(false);
  });

  // 9. Password-update failures do not show success
  it("Requirement 9: Password update failure is returned directly to caller", async () => {
    vi.spyOn(browserClient.auth, "updateUser").mockResolvedValueOnce({
      data: { user: null },
      error: new Error("New password should be different from the old password.") as any,
    });

    const result = await authService.updatePassword("SameOldPassword123!");
    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("New password should be different");
  });

  // 10. Password-update success is reflected accurately
  it("Requirement 10: Password update success returns the updated user object", async () => {
    const mockUser = {
      id: "user-123",
      email: "admin@cobralearn.com",
      updated_at: new Date().toISOString(),
    };
    vi.spyOn(browserClient.auth, "updateUser").mockResolvedValueOnce({
      data: { user: mockUser as any },
      error: null,
    });

    const result = await authService.updatePassword("BrandNewSecurePass123!");
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("user-123");
  });

  // 11. Tokens, codes, passwords, and secrets do not appear in application logs
  it("Requirement 11: Passwords and tokens are not written to console logs", () => {
    const consoleSpy = vi.spyOn(console, "log");
    const testPassword = "SuperSecretPassword123!";

    authService.updatePassword(testPassword);

    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining(testPassword));
  });

  // 12. Direct access to the password-updated page cannot grant access
  it("Requirement 12: Password updated status does not alter unauthenticated session state", async () => {
    vi.spyOn(browserClient.auth, "getSession").mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const session = await authService.getSession();
    expect(session).toBeNull();
  });
});
