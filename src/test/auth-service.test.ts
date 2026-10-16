import { describe, expect, it, vi, beforeEach } from "vitest";
import { authService } from "@/lib/auth/auth-service";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { requireAuthenticatedUser, getAuthenticatedUserFromCookies } from "@/lib/auth/server-auth";

describe("Supabase Authentication Service Integration", () => {
  const browserClient = getSupabaseBrowserClient();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handles signIn success when Supabase returns user and session", async () => {
    const mockUser = { id: "user-123", email: "admin@cobralearn.com" };
    const mockSession = { access_token: "token-abc", user: mockUser };

    vi.spyOn(browserClient.auth, "signInWithPassword").mockResolvedValueOnce({
      data: { user: mockUser as any, session: mockSession as any },
      error: null,
    });

    const result = await authService.signIn("admin@cobralearn.com", "SecurePass123!");
    expect(result.error).toBeNull();
    expect(result.data?.user.id).toBe("user-123");
    expect(result.data?.session.access_token).toBe("token-abc");
  });

  it("handles signIn failure gracefully when invalid credentials provided", async () => {
    vi.spyOn(browserClient.auth, "signInWithPassword").mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error("Invalid login credentials") as any,
    });

    const result = await authService.signIn("unknown@cobralearn.com", "WrongPassword!");
    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("Invalid login credentials");
  });

  it("handles signOut correctly", async () => {
    vi.spyOn(browserClient.auth, "signOut").mockResolvedValueOnce({
      error: null,
    });

    const result = await authService.signOut();
    expect(result.error).toBeNull();
  });

  it("handles resetPassword request for email", async () => {
    vi.spyOn(browserClient.auth, "resetPasswordForEmail").mockResolvedValueOnce({
      data: {},
      error: null,
    });

    const result = await authService.resetPassword("admin@cobralearn.com");
    expect(result.error).toBeNull();
  });

  it("handles updatePassword request", async () => {
    const mockUser = { id: "user-123", email: "admin@cobralearn.com" };
    vi.spyOn(browserClient.auth, "updateUser").mockResolvedValueOnce({
      data: { user: mockUser as any },
      error: null,
    });

    const result = await authService.updatePassword("NewSecurePass123!");
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("user-123");
  });

  it("verifyCurrentPassword succeeds when current password is valid", async () => {
    const mockUser = { id: "user-123", email: "admin@cobralearn.com" };
    vi.spyOn(browserClient.auth, "getUser").mockResolvedValueOnce({
      data: { user: mockUser as any },
      error: null,
    });
    vi.spyOn(browserClient.auth, "signInWithPassword").mockResolvedValueOnce({
      data: { user: mockUser as any, session: {} as any },
      error: null,
    });

    const result = await authService.verifyCurrentPassword("CorrectPassword123!");
    expect(result.data).toBe(true);
    expect(result.error).toBeNull();
  });

  it("verifyCurrentPassword fails when current password is wrong", async () => {
    const mockUser = { id: "user-123", email: "admin@cobralearn.com" };
    vi.spyOn(browserClient.auth, "getUser").mockResolvedValueOnce({
      data: { user: mockUser as any },
      error: null,
    });
    vi.spyOn(browserClient.auth, "signInWithPassword").mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error("Invalid login credentials") as any,
    });

    const result = await authService.verifyCurrentPassword("WrongPassword123!");
    expect(result.data).toBe(false);
    expect(result.error?.message).toBe("Current password is incorrect.");
  });

  it("verifyCurrentPassword fails when no user session is active", async () => {
    vi.spyOn(browserClient.auth, "getUser").mockResolvedValueOnce({
      data: { user: null },
      error: new Error("No session") as any,
    });

    const result = await authService.verifyCurrentPassword("AnyPassword123!");
    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("Active administrator session required");
  });

  it("server authentication helper returns user from bearer token or rejects unauthenticated request", async () => {
    const mockRequest = new Request("http://localhost:3000/api/admin/projects", {
      headers: {
        authorization: "Bearer valid-token-123",
      },
    });

    // Without live token verification server will reject invalid token
    await expect(requireAuthenticatedUser(mockRequest)).rejects.toThrow();

    // Cookie helper returns null user when no cookies passed
    const cookieResult = await getAuthenticatedUserFromCookies("");
    expect(cookieResult.user).toBeNull();
  });
});
