import { describe, expect, it, vi, beforeEach } from "vitest";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { authService } from "@/lib/auth/auth-service";

// Mock Supabase browser client
const mockExchangeCodeForSession = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockVerifyOtp = vi.fn();
const mockSetSession = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      resetPasswordForEmail: mockResetPasswordForEmail,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      verifyOtp: mockVerifyOtp,
      setSession: mockSetSession,
    },
  }),
}));

describe("Phase 6C — Auth Callback & Session Synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Safe Redirect Utility (safeRedirect)", () => {
    it("allows valid internal relative paths", () => {
      expect(safeRedirect("/admin")).toBe("/admin");
      expect(safeRedirect("/admin/dashboard")).toBe("/admin/dashboard");
      expect(safeRedirect("/admin/reset-password")).toBe("/admin/reset-password");
      expect(safeRedirect("/admin/media?view=grid")).toBe("/admin/media?view=grid");
    });

    it("rejects open redirect external URLs and falls back safely", () => {
      expect(safeRedirect("https://evil.example.com")).toBe("/admin/dashboard");
      expect(safeRedirect("http://phishing.site/login")).toBe("/admin/dashboard");
      expect(safeRedirect("https://attacker.org", "/admin/reset-password")).toBe("/admin/reset-password");
    });

    it("rejects protocol-relative URLs", () => {
      expect(safeRedirect("//evil.example.com")).toBe("/admin/dashboard");
      expect(safeRedirect("\\\\evil.example.com")).toBe("/admin/dashboard");
    });

    it("rejects dangerous URI schemes like javascript: and data:", () => {
      expect(safeRedirect("javascript:alert('xss')")).toBe("/admin/dashboard");
      expect(safeRedirect("data:text/html,<script>alert(1)</script>")).toBe("/admin/dashboard");
      expect(safeRedirect("/path/javascript:alert(1)")).toBe("/admin/dashboard");
    });

    it("falls back to default destination when input is null, undefined, or empty", () => {
      expect(safeRedirect(null)).toBe("/admin/dashboard");
      expect(safeRedirect(undefined)).toBe("/admin/dashboard");
      expect(safeRedirect("")).toBe("/admin/dashboard");
      expect(safeRedirect("   ")).toBe("/admin/dashboard");
      expect(safeRedirect(null, "/admin/reset-password")).toBe("/admin/reset-password");
    });
  });

  describe("Code Exchange (exchangeCodeForSession)", () => {
    it("exchanges valid PKCE code for authenticated user session", async () => {
      const mockUser = { id: "user-123", email: "admin@example.com" };
      const mockSession = { access_token: "mock-token", user: mockUser };

      mockExchangeCodeForSession.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.exchangeCodeForSession("valid-auth-code-123");
      expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-auth-code-123");
      expect(result.data?.user.id).toBe("user-123");
      expect(result.data?.session.access_token).toBe("mock-token");
      expect(result.error).toBeNull();
    });

    it("handles expired or invalid exchange code gracefully", async () => {
      mockExchangeCodeForSession.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new Error("Invalid or expired authorization code"),
      });

      const result = await authService.exchangeCodeForSession("invalid-code");
      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Invalid or expired");
    });
  });

  describe("Token Hash Verification (verifyOtp)", () => {
    it("verifies recovery token_hash successfully", async () => {
      const mockUser = { id: "user-otp-123", email: "admin@example.com" };
      const mockSession = { access_token: "mock-otp-token", user: mockUser };

      mockVerifyOtp.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.verifyOtp({ token_hash: "valid-token-hash", type: "recovery" });
      expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "valid-token-hash", type: "recovery" });
      expect(result.data?.user.id).toBe("user-otp-123");
      expect(result.data?.session.access_token).toBe("mock-otp-token");
      expect(result.error).toBeNull();
    });

    it("handles invalid or expired token_hash gracefully", async () => {
      mockVerifyOtp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new Error("Token expired or invalid"),
      });

      const result = await authService.verifyOtp({ token_hash: "expired-hash", type: "recovery" });
      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Token expired or invalid");
    });
  });

  describe("Session Initialization from URL Hash (setSession)", () => {
    it("initializes active session from access_token and refresh_token", async () => {
      const mockUser = { id: "user-hash-123", email: "admin@example.com" };
      const mockSession = { access_token: "hash-access-token", user: mockUser };

      mockSetSession.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.setSession({
        access_token: "hash-access-token",
        refresh_token: "hash-refresh-token",
      });

      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: "hash-access-token",
        refresh_token: "hash-refresh-token",
      });
      expect(result.data?.session.access_token).toBe("hash-access-token");
      expect(result.error).toBeNull();
    });
  });

  describe("Password Recovery Flow Routing", () => {
    it("configures password reset redirect to point through /auth/callback", async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

      const result = await authService.resetPassword("admin@cobralearn.in");
      expect(result.error).toBeNull();
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "admin@cobralearn.in",
        expect.objectContaining({
          redirectTo: expect.stringContaining("/auth/callback?type=recovery&next=/admin/reset-password"),
        })
      );
    });
  });

  describe("Centralized Auth State Listener & Subscription Management", () => {
    it("registers and cleans up onAuthStateChange listener", () => {
      const unsubscribeSpy = vi.fn();
      mockOnAuthStateChange.mockReturnValueOnce({
        data: { subscription: { unsubscribe: unsubscribeSpy } },
      });

      const callback = vi.fn();
      const subscription = authService.onAuthStateChange(callback);

      expect(mockOnAuthStateChange).toHaveBeenCalledWith(callback);
      subscription.unsubscribe();
      expect(unsubscribeSpy).toHaveBeenCalled();
    });
  });
});
