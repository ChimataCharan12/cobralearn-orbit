import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { Factor, Session, User } from "@supabase/supabase-js";
import type { AdminProfile } from "@prisma/client";
import { authService } from "@/lib/auth/auth-service";
import { AuthProvider, useAuth, useAuthGuard } from "@/lib/auth/use-auth";
import { adminClient } from "@/lib/api/admin-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// Mock router navigation
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

describe("Phase 4.2: Secure MFA Service & Authentication State Management", () => {
  const browserClient = getSupabaseBrowserClient();

  const mockAdminUser: User = {
    id: "user-superadmin-001",
    email: "superadmin@cobralearn.com",
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

  const mockActiveAdminProfile: AdminProfile = {
    id: "user-superadmin-001",
    fullName: "Super Admin",
    avatarUrl: null,
    role: "SUPER_ADMIN",
    isActive: true,
    lastLoginAt: new Date(),
    phone: null,
    title: "Chief Administrator",
    department: "Security",
    bio: null,
    updatedAt: new Date(),
    createdAt: new Date(),
  };

  const mockVerifiedTotpFactor: Factor = {
    id: "factor-totp-12345",
    friendly_name: "Authenticator App",
    factor_type: "totp",
    status: "verified",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockUnverifiedTotpFactor: Factor = {
    id: "factor-totp-unverified",
    friendly_name: "New Phone",
    factor_type: "totp",
    status: "unverified",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();

    // Default: no initial session on mount
    vi.spyOn(authService, "getSession").mockResolvedValue(null);

    // Default: rate limiting allows request
    vi.spyOn(adminClient, "evaluateLoginRateLimit").mockResolvedValue({
      success: true,
      data: { allowed: true },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. MFA Service Layer Unit Tests: Factor Listing & Enrollment
  // =========================================================================
  describe("1. MFA Service Layer: Factor Listing & Enrollment", () => {
    it("listMfaFactors returns categorized factors and distinguishes verified from unverified", async () => {
      // Mock client.auth.mfa.listFactors
      const mockListFactors = vi.fn().mockResolvedValue({
        data: {
          all: [mockUnverifiedTotpFactor, mockVerifiedTotpFactor],
          totp: [mockUnverifiedTotpFactor, mockVerifiedTotpFactor],
        },
        error: null,
      });

      (browserClient.auth as any).mfa = {
        ...((browserClient.auth as any).mfa || {}),
        listFactors: mockListFactors,
      };

      const result = await authService.listMfaFactors();

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.all).toHaveLength(2);
      expect(result.data?.totp).toHaveLength(2);
      expect(result.data?.verifiedTotp?.id).toBe("factor-totp-12345");
      expect(result.data?.verifiedTotp?.status).toBe("verified");
    });

    it("listMfaFactors returns null for verifiedTotp when only unverified factors exist", async () => {
      const mockListFactors = vi.fn().mockResolvedValue({
        data: {
          all: [mockUnverifiedTotpFactor],
          totp: [mockUnverifiedTotpFactor],
        },
        error: null,
      });

      (browserClient.auth as any).mfa = {
        listFactors: mockListFactors,
      };

      const result = await authService.listMfaFactors();

      expect(result.error).toBeNull();
      expect(result.data?.verifiedTotp).toBeNull();
      expect(result.data?.totp).toHaveLength(1);
    });

    it("listMfaFactors reliably partitions unverified TOTP factors from data.all when Supabase returns empty data.totp", async () => {
      // Real Supabase GoTrue behavior: data.totp only contains verified factors!
      const mockListFactors = vi.fn().mockResolvedValue({
        data: {
          all: [mockUnverifiedTotpFactor],
          totp: [], // Empty in real Supabase when factor is unverified
          phone: [],
          webauthn: [],
        },
        error: null,
      });

      (browserClient.auth as any).mfa = {
        listFactors: mockListFactors,
      };

      const result = await authService.listMfaFactors();

      expect(result.error).toBeNull();
      expect(result.data?.all).toHaveLength(1);
      // Our fix ensures totp is partitioned from all so unverified factors are not lost
      expect(result.data?.totp).toHaveLength(1);
      expect(result.data?.totp[0].id).toBe(mockUnverifiedTotpFactor.id);
      expect(result.data?.unverifiedTotp).toHaveLength(1);
      expect(result.data?.verifiedTotp).toBeNull();
    });

    it("listMfaFactors propagates Supabase errors safely", async () => {
      (browserClient.auth as any).mfa = {
        listFactors: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("Network timeout contacting auth server"),
        }),
      };

      const result = await authService.listMfaFactors();

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Network timeout");
    });

    it("enrollTotp calls Supabase mfa.enroll with friendlyName and returns enrollment credentials", async () => {
      const mockEnroll = vi.fn().mockResolvedValue({
        data: {
          id: "factor-new-999",
          type: "totp",
          friendly_name: "Orbit Work Device",
          totp: {
            qr_code: "data:image/svg+xml;base64,mockSvgData",
            secret: "JBSWY3DPEHPK3PXP",
            uri: "otpauth://totp/CobraLearn%20Orbit:admin?secret=JBSWY3DPEHPK3PXP&issuer=CobraLearn%20Orbit",
          },
        },
        error: null,
      });

      (browserClient.auth as any).mfa = {
        enroll: mockEnroll,
      };

      const result = await authService.enrollTotp({ friendlyName: "Orbit Work Device" });

      expect(result.error).toBeNull();
      expect(result.data?.id).toBe("factor-new-999");
      expect(result.data?.type).toBe("totp");
      expect(result.data?.friendlyName).toBe("Orbit Work Device");
      expect(result.data?.totp.secret).toBe("JBSWY3DPEHPK3PXP");
      expect(mockEnroll).toHaveBeenCalledWith({
        factorType: "totp",
        friendlyName: "Orbit Work Device",
        issuer: "CobraLearn Orbit",
      });
    });

    it("enrollTotp propagates enrollment error from Supabase", async () => {
      (browserClient.auth as any).mfa = {
        enroll: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("MFA enroll quota exceeded"),
        }),
      };

      const result = await authService.enrollTotp();

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("MFA enroll quota exceeded");
    });
  });

  // =========================================================================
  // 2. MFA Service Layer: Challenge, Verify & Validation
  // =========================================================================
  describe("2. MFA Service Layer: Challenge & Verify Operations", () => {
    it("challengeMfa creates a challenge for a valid factor ID", async () => {
      const mockChallenge = vi.fn().mockResolvedValue({
        data: { id: "challenge-xyz-789", expires_at: 1770000000 },
        error: null,
      });

      (browserClient.auth as any).mfa = {
        challenge: mockChallenge,
      };

      const result = await authService.challengeMfa("factor-totp-12345");

      expect(result.error).toBeNull();
      expect(result.data?.id).toBe("challenge-xyz-789");
      expect(mockChallenge).toHaveBeenCalledWith({ factorId: "factor-totp-12345" });
    });

    it("challengeMfa rejects empty or whitespace factorId without calling Supabase", async () => {
      const mockChallenge = vi.fn();
      (browserClient.auth as any).mfa = { challenge: mockChallenge };

      const result = await authService.challengeMfa("   ");

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Invalid factor ID");
      expect(mockChallenge).not.toHaveBeenCalled();
    });

    it("verifyMfa rejects non-6-digit codes before submitting to Supabase", async () => {
      const mockVerify = vi.fn();
      (browserClient.auth as any).mfa = { verify: mockVerify };

      const invalidCodes = ["", "12345", "1234567", "abcdef", "12 456", "12345a"];
      for (const code of invalidCodes) {
        const result = await authService.verifyMfa("factor-1", "challenge-1", code);
        expect(result.data).toBeNull();
        expect(result.error?.message).toContain("Code must be exactly 6 digits");
      }
      expect(mockVerify).not.toHaveBeenCalled();
    });

    it("verifyMfa submits clean 6-digit code to Supabase and returns upgraded session", async () => {
      const mockVerify = vi.fn().mockResolvedValue({
        data: { user: mockAdminUser, session: mockAal2Session },
        error: null,
      });

      (browserClient.auth as any).mfa = { verify: mockVerify };

      const result = await authService.verifyMfa("factor-totp-12345", "challenge-xyz", " 849201 ");

      expect(result.error).toBeNull();
      expect(result.data?.session.access_token).toBe(mockAal2Session.access_token);
      expect(mockVerify).toHaveBeenCalledWith({
        factorId: "factor-totp-12345",
        challengeId: "challenge-xyz",
        code: "849201",
      });
    });

    it("verifyMfa supports actual installed SDK response shape (AuthMFAVerifyResponseData)", async () => {
      // The installed Supabase SDK returns tokens and user at the top-level of data, not inside a nested session object
      const sdkResponseData = {
        access_token: "actual-sdk-aal2-access-token",
        token_type: "bearer" as const,
        expires_in: 3600,
        refresh_token: "actual-sdk-aal2-refresh-token",
        user: mockAdminUser,
      };

      const mockVerify = vi.fn().mockResolvedValue({
        data: sdkResponseData,
        error: null,
      });

      (browserClient.auth as any).mfa = { verify: mockVerify };

      const result = await authService.verifyMfa("factor-totp-12345", "challenge-xyz", "849201");

      expect(result.error).toBeNull();
      expect(result.data?.user.id).toBe(mockAdminUser.id);
      expect(result.data?.session.access_token).toBe("actual-sdk-aal2-access-token");
      expect(result.data?.session.refresh_token).toBe("actual-sdk-aal2-refresh-token");
      expect(result.data?.session.token_type).toBe("bearer");
      expect(result.data?.session.expires_at).toBeGreaterThan(0);
    });

    it("challengeAndVerifyMfa executes atomic verification with valid 6-digit code", async () => {
      const mockChallengeAndVerify = vi.fn().mockResolvedValue({
        data: { user: mockAdminUser, session: mockAal2Session },
        error: null,
      });

      (browserClient.auth as any).mfa = { challengeAndVerify: mockChallengeAndVerify };

      const result = await authService.challengeAndVerifyMfa("factor-totp-12345", "123456");

      expect(result.error).toBeNull();
      expect(result.data?.user.id).toBe(mockAdminUser.id);
      expect(mockChallengeAndVerify).toHaveBeenCalledWith({
        factorId: "factor-totp-12345",
        code: "123456",
      });
    });

    it("challengeAndVerifyMfa supports actual installed SDK response shape (AuthMFAVerifyResponseData)", async () => {
      // Real SDK shape from @supabase/auth-js GoTrueClient.ts
      const sdkResponseData = {
        access_token: "actual-sdk-mfa-access-token",
        token_type: "bearer" as const,
        expires_in: 3600,
        refresh_token: "actual-sdk-mfa-refresh-token",
        user: mockAdminUser,
      };

      const mockChallengeAndVerify = vi.fn().mockResolvedValue({
        data: sdkResponseData,
        error: null,
      });

      (browserClient.auth as any).mfa = { challengeAndVerify: mockChallengeAndVerify };

      const result = await authService.challengeAndVerifyMfa("factor-totp-12345", "123456");

      expect(result.error).toBeNull();
      expect(result.data?.user.id).toBe(mockAdminUser.id);
      expect(result.data?.session.access_token).toBe("actual-sdk-mfa-access-token");
      expect(result.data?.session.refresh_token).toBe("actual-sdk-mfa-refresh-token");
      expect(result.data?.session.token_type).toBe("bearer");
      expect(result.data?.session.expires_at).toBeGreaterThan(0);
    });

    it("challengeAndVerifyMfa safely handles missing or incomplete response data from Supabase", async () => {
      const mockChallengeAndVerify = vi.fn().mockResolvedValue({
        data: {}, // Missing user and session
        error: null,
      });

      (browserClient.auth as any).mfa = { challengeAndVerify: mockChallengeAndVerify };

      const result = await authService.challengeAndVerifyMfa("factor-totp-12345", "123456");

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Incomplete verification response returned");
    });

    it("challengeAndVerifyMfa propagates genuine Supabase verification errors safely", async () => {
      const mockChallengeAndVerify = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Invalid TOTP code"),
      });

      (browserClient.auth as any).mfa = { challengeAndVerify: mockChallengeAndVerify };

      const result = await authService.challengeAndVerifyMfa("factor-totp-12345", "123456");

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Invalid TOTP code");
    });

    it("challengeAndVerifyMfa rejects invalid TOTP format without network call", async () => {
      const mockChallengeAndVerify = vi.fn();
      (browserClient.auth as any).mfa = { challengeAndVerify: mockChallengeAndVerify };

      const result = await authService.challengeAndVerifyMfa("factor-totp-12345", "not-digits");

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Code must be exactly 6 digits");
      expect(mockChallengeAndVerify).not.toHaveBeenCalled();
    });

    it("unenrollMfa unenrolls factor by ID", async () => {
      const mockUnenroll = vi.fn().mockResolvedValue({
        data: { id: "factor-totp-12345" },
        error: null,
      });

      (browserClient.auth as any).mfa = { unenroll: mockUnenroll };

      const result = await authService.unenrollMfa("factor-totp-12345");

      expect(result.error).toBeNull();
      expect(result.data?.id).toBe("factor-totp-12345");
      expect(mockUnenroll).toHaveBeenCalledWith({ factorId: "factor-totp-12345" });
    });

    it("unenrollMfa rejects invalid factor ID without calling Supabase", async () => {
      const mockUnenroll = vi.fn();
      (browserClient.auth as any).mfa = { unenroll: mockUnenroll };

      const result = await authService.unenrollMfa("");

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Invalid factor ID");
      expect(mockUnenroll).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Assurance Level Inspection
  // =========================================================================
  describe("3. Authenticator Assurance Level (AAL) Retrieval", () => {
    it("getAuthenticatorAssuranceLevel returns currentLevel and nextLevel", async () => {
      const mockGetAal = vi.fn().mockResolvedValue({
        data: {
          currentLevel: "aal1",
          nextLevel: "aal2",
          currentAuthenticationMethods: [{ method: "password", timestamp: 1770000000 }],
        },
        error: null,
      });

      (browserClient.auth as any).mfa = { getAuthenticatorAssuranceLevel: mockGetAal };

      const result = await authService.getAuthenticatorAssuranceLevel();

      expect(result.error).toBeNull();
      expect(result.data?.currentLevel).toBe("aal1");
      expect(result.data?.nextLevel).toBe("aal2");
    });

    it("getAuthenticatorAssuranceLevel passes JWT token argument when provided", async () => {
      const mockGetAal = vi.fn().mockResolvedValue({
        data: {
          currentLevel: "aal2",
          nextLevel: "aal2",
          currentAuthenticationMethods: [],
        },
        error: null,
      });

      (browserClient.auth as any).mfa = { getAuthenticatorAssuranceLevel: mockGetAal };

      const result = await authService.getAuthenticatorAssuranceLevel("test-custom-jwt");

      expect(result.error).toBeNull();
      expect(result.data?.currentLevel).toBe("aal2");
      expect(mockGetAal).toHaveBeenCalledWith("test-custom-jwt");
    });
  });

  // =========================================================================
  // 4. Zero Secrets / Token Logging Check
  // =========================================================================
  describe("4. Security Guardrail: Zero Secret / Token Logging", () => {
    it("never logs TOTP secret, enrollment URI, or verification codes to console", async () => {
      const logSpy = vi.spyOn(console, "log");
      const infoSpy = vi.spyOn(console, "info");
      const warnSpy = vi.spyOn(console, "warn");
      const errorSpy = vi.spyOn(console, "error");

      const sensitiveSecret = "SECRET_SUPER_SENSITIVE_KEY_TOTP_999";
      const sensitiveCode = "948271";

      (browserClient.auth as any).mfa = {
        enroll: vi.fn().mockResolvedValue({
          data: {
            id: "factor-123",
            type: "totp",
            totp: {
              qr_code: "svg_data",
              secret: sensitiveSecret,
              uri: `otpauth://totp/Orbit?secret=${sensitiveSecret}`,
            },
          },
          error: null,
        }),
        challengeAndVerify: vi.fn().mockResolvedValue({
          data: { user: mockAdminUser, session: mockAal2Session },
          error: null,
        }),
      };

      await authService.enrollTotp();
      await authService.challengeAndVerifyMfa("factor-123", sensitiveCode);

      const allLoggedMessages = [
        ...logSpy.mock.calls,
        ...infoSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ].flat().map(String);

      for (const msg of allLoggedMessages) {
        expect(msg).not.toContain(sensitiveSecret);
        expect(msg).not.toContain(sensitiveCode);
        expect(msg).not.toContain(mockAal2Session.access_token);
      }
    });
  });

  // =========================================================================
  // 5. Auth State Management (useAuth & AuthProvider): Pending MFA State
  // =========================================================================
  describe("5. useAuth State Management: MFA Workflow & Pending State", () => {
    it("when account has verified TOTP (nextLevel: aal2), signIn sets isMfaRequired=true and blocks isEligibleAdmin", async () => {
      // 1. Password sign-in succeeds at AAL1
      vi.spyOn(authService, "signIn").mockResolvedValueOnce({
        data: { user: mockAdminUser, session: mockAal1Session },
        error: null,
      });

      // 2. Supabase MFA indicates nextLevel is aal2 while current is aal1
      vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
        data: {
          currentLevel: "aal1",
          nextLevel: "aal2",
          currentAuthenticationMethods: [{ method: "password", timestamp: 1770000000 }],
        },
        error: null,
      });

      // 3. User has verified TOTP factor
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: {
          all: [mockVerifiedTotpFactor],
          totp: [mockVerifiedTotpFactor],
          verifiedTotp: mockVerifiedTotpFactor,
        },
        error: null,
      });

      // Profile verification should NOT be called while MFA is pending
      const profileSpy = vi.spyOn(adminClient, "getSelfProfile");

      function TestMfaRequiredComponent() {
        const {
          signIn,
          isAuthenticated,
          isEligibleAdmin,
          isMfaRequired,
          isMfaEnrolled,
          currentAal,
          nextAal,
          verifiedFactorId,
          adminProfile,
        } = useAuth();

        return (
          <div>
            <button onClick={() => signIn("superadmin@cobralearn.com", "Password123!")}>
              Sign In
            </button>
            <span data-testid="auth">{isAuthenticated ? "AUTH" : "UNAUTH"}</span>
            <span data-testid="eligible">{isEligibleAdmin ? "ELIGIBLE" : "INELIGIBLE"}</span>
            <span data-testid="mfaRequired">{isMfaRequired ? "MFA_REQUIRED" : "MFA_NOT_REQUIRED"}</span>
            <span data-testid="mfaEnrolled">{isMfaEnrolled ? "ENROLLED" : "NOT_ENROLLED"}</span>
            <span data-testid="currentAal">{currentAal || "NONE"}</span>
            <span data-testid="nextAal">{nextAal || "NONE"}</span>
            <span data-testid="factorId">{verifiedFactorId || "NO_FACTOR"}</span>
            <span data-testid="profile">{adminProfile ? "HAS_PROFILE" : "NO_PROFILE"}</span>
          </div>
        );
      }

      render(
        <AuthProvider>
          <TestMfaRequiredComponent />
        </AuthProvider>
      );

      // Initially unauthenticated
      expect(screen.getByTestId("auth").textContent).toBe("UNAUTH");
      expect(screen.getByTestId("eligible").textContent).toBe("INELIGIBLE");

      // Trigger password sign-in
      await act(async () => {
        screen.getByRole("button", { name: "Sign In" }).click();
      });

      // Verify pending MFA state:
      // - isAuthenticated: true (session exists)
      // - isMfaRequired: true
      // - currentAal: aal1, nextAal: aal2
      // - verifiedFactorId: factor-totp-12345
      // - CRITICAL: isEligibleAdmin is FALSE!
      // - CRITICAL: adminProfile is NULL (not loaded into memory for pending MFA)
      expect(screen.getByTestId("auth").textContent).toBe("AUTH");
      expect(screen.getByTestId("mfaRequired").textContent).toBe("MFA_REQUIRED");
      expect(screen.getByTestId("mfaEnrolled").textContent).toBe("ENROLLED");
      expect(screen.getByTestId("currentAal").textContent).toBe("aal1");
      expect(screen.getByTestId("nextAal").textContent).toBe("aal2");
      expect(screen.getByTestId("factorId").textContent).toBe("factor-totp-12345");
      expect(screen.getByTestId("eligible").textContent).toBe("INELIGIBLE");
      expect(screen.getByTestId("profile").textContent).toBe("NO_PROFILE");

      // Server profile check was deferred until AAL2 verification
      expect(profileSpy).not.toHaveBeenCalled();
    });

    it("completing verifyMfaChallenge upgrades session to AAL2, validates AdminProfile, and grants isEligibleAdmin", async () => {
      // Step 1: Start in pending MFA state
      vi.spyOn(authService, "signIn").mockResolvedValueOnce({
        data: { user: mockAdminUser, session: mockAal1Session },
        error: null,
      });

      vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
        data: {
          currentLevel: "aal1",
          nextLevel: "aal2",
          currentAuthenticationMethods: [{ method: "password", timestamp: 1770000000 }],
        },
        error: null,
      });

      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: {
          all: [mockVerifiedTotpFactor],
          totp: [mockVerifiedTotpFactor],
          verifiedTotp: mockVerifiedTotpFactor,
        },
        error: null,
      });

      // Step 2: verifyMfaChallenge succeeds with AAL2 session
      vi.spyOn(authService, "challengeAndVerifyMfa").mockResolvedValueOnce({
        data: { user: mockAdminUser, session: mockAal2Session },
        error: null,
      });

      // Step 3: AdminProfile authoritative check succeeds
      vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
        success: true,
        data: mockActiveAdminProfile,
      });

      function TestChallengeVerificationComponent() {
        const {
          signIn,
          verifyMfaChallenge,
          isMfaRequired,
          isEligibleAdmin,
          currentAal,
          adminProfile,
          mfaError,
        } = useAuth();

        return (
          <div>
            <button onClick={() => signIn("superadmin@cobralearn.com", "Password123!")}>
              Sign In
            </button>
            <button onClick={() => verifyMfaChallenge("654321")}>Verify Code</button>
            <span data-testid="mfaRequired">{isMfaRequired ? "MFA_REQUIRED" : "MFA_NOT_REQUIRED"}</span>
            <span data-testid="eligible">{isEligibleAdmin ? "ELIGIBLE" : "INELIGIBLE"}</span>
            <span data-testid="currentAal">{currentAal || "NONE"}</span>
            <span data-testid="role">{adminProfile?.role || "NO_ROLE"}</span>
            <span data-testid="mfaError">{mfaError || "NO_ERROR"}</span>
          </div>
        );
      }

      render(
        <AuthProvider>
          <TestChallengeVerificationComponent />
        </AuthProvider>
      );

      // Enter pending MFA
      await act(async () => {
        screen.getByRole("button", { name: "Sign In" }).click();
      });
      expect(screen.getByTestId("mfaRequired").textContent).toBe("MFA_REQUIRED");
      expect(screen.getByTestId("eligible").textContent).toBe("INELIGIBLE");

      // Submit valid TOTP code
      await act(async () => {
        screen.getByRole("button", { name: "Verify Code" }).click();
      });

      // Upgraded to AAL2, eligible admin granted
      expect(screen.getByTestId("mfaRequired").textContent).toBe("MFA_NOT_REQUIRED");
      expect(screen.getByTestId("eligible").textContent).toBe("ELIGIBLE");
      expect(screen.getByTestId("currentAal").textContent).toBe("aal2");
      expect(screen.getByTestId("role").textContent).toBe("SUPER_ADMIN");
      expect(screen.getByTestId("mfaError").textContent).toBe("NO_ERROR");
    });

    it("verifyMfaChallenge with invalid 6-digit code preserves pending state and sets mfaError", async () => {
      vi.spyOn(authService, "signIn").mockResolvedValueOnce({
        data: { user: mockAdminUser, session: mockAal1Session },
        error: null,
      });

      vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
        data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
        error: null,
      });

      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [mockVerifiedTotpFactor], totp: [mockVerifiedTotpFactor], verifiedTotp: mockVerifiedTotpFactor },
        error: null,
      });

      vi.spyOn(authService, "challengeAndVerifyMfa").mockResolvedValueOnce({
        data: null,
        error: new Error("Invalid TOTP code or expired challenge."),
      });

      function TestFailedChallengeComponent() {
        const { signIn, verifyMfaChallenge, isMfaRequired, isEligibleAdmin, mfaError } = useAuth();
        return (
          <div>
            <button onClick={() => signIn("superadmin@cobralearn.com", "Password123!")}>Sign In</button>
            <button onClick={() => verifyMfaChallenge("000000")}>Submit Wrong Code</button>
            <span data-testid="mfaRequired">{isMfaRequired ? "MFA_REQUIRED" : "MFA_NOT_REQUIRED"}</span>
            <span data-testid="eligible">{isEligibleAdmin ? "ELIGIBLE" : "INELIGIBLE"}</span>
            <span data-testid="mfaError">{mfaError || "NO_ERROR"}</span>
          </div>
        );
      }

      render(
        <AuthProvider>
          <TestFailedChallengeComponent />
        </AuthProvider>
      );

      await act(async () => {
        screen.getByRole("button", { name: "Sign In" }).click();
      });

      await act(async () => {
        screen.getByRole("button", { name: "Submit Wrong Code" }).click();
      });

      expect(screen.getByTestId("mfaRequired").textContent).toBe("MFA_REQUIRED");
      expect(screen.getByTestId("eligible").textContent).toBe("INELIGIBLE");
      expect(screen.getByTestId("mfaError").textContent).toContain("Invalid TOTP code or expired challenge");
    });

    it("useAuthGuard redirects pending MFA user to /admin instead of /admin/access-denied", async () => {
      // Simulate state where session is active at AAL1, but MFA is required
      vi.spyOn(authService, "getSession").mockResolvedValueOnce(mockAal1Session);
      vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
        data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
        error: null,
      });
      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [mockVerifiedTotpFactor], totp: [mockVerifiedTotpFactor], verifiedTotp: mockVerifiedTotpFactor },
        error: null,
      });

      function GuardedAdminComponent() {
        useAuthGuard("/admin");
        return <div data-testid="protected-content">PROTECTED_ADMIN_PANEL</div>;
      }

      await act(async () => {
        render(
          <AuthProvider>
            <GuardedAdminComponent />
          </AuthProvider>
        );
      });

      // Must be redirected to /admin (login/challenge route), NEVER to /admin/access-denied
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin" });
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin/access-denied" });
    });
  });

  // =========================================================================
  // 6. Preservation of Rate Limiting & Account Eligibility
  // =========================================================================
  describe("6. Preservation of Rate Limiting & Account Eligibility", () => {
    it("rate limit block stops authentication before MFA or Supabase check", async () => {
      vi.spyOn(adminClient, "evaluateLoginRateLimit").mockResolvedValueOnce({
        success: true,
        data: { allowed: false, retryAfterSeconds: 120, message: "Too many login attempts." },
      });

      const signInSpy = vi.spyOn(authService, "signIn");

      function TestRateLimitedLogin() {
        const { signIn } = useAuth();
        const [errMsg, setErrMsg] = React.useState("");

        const handleLogin = async () => {
          const res = await signIn("target@cobralearn.com", "Password123!");
          if (res.error) setErrMsg(res.error.message);
        };

        return (
          <div>
            <button onClick={handleLogin}>Log In</button>
            <span data-testid="error">{errMsg}</span>
          </div>
        );
      }

      render(
        <AuthProvider>
          <TestRateLimitedLogin />
        </AuthProvider>
      );

      await act(async () => {
        screen.getByRole("button", { name: "Log In" }).click();
      });

      expect(screen.getByTestId("error").textContent).toContain("Too many login attempts");
      expect(signInSpy).not.toHaveBeenCalled();
    });

    it("inactive administrator fails closed and signs out even after successful MFA", async () => {
      vi.spyOn(authService, "signIn").mockResolvedValueOnce({
        data: { user: mockAdminUser, session: mockAal1Session },
        error: null,
      });

      vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
        data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
        error: null,
      });

      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [mockVerifiedTotpFactor], totp: [mockVerifiedTotpFactor], verifiedTotp: mockVerifiedTotpFactor },
        error: null,
      });

      vi.spyOn(authService, "challengeAndVerifyMfa").mockResolvedValueOnce({
        data: { user: mockAdminUser, session: mockAal2Session },
        error: null,
      });

      // Deactivated admin profile
      vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
        success: true,
        data: { ...mockActiveAdminProfile, isActive: false },
      });

      const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValueOnce({
        data: null,
        error: null,
      });

      function TestDeactivatedMfaComponent() {
        const { signIn, verifyMfaChallenge, isEligibleAdmin, isAuthenticated } = useAuth();
        return (
          <div>
            <button onClick={() => signIn("superadmin@cobralearn.com", "Password123!")}>Sign In</button>
            <button onClick={() => verifyMfaChallenge("123456")}>Verify MFA</button>
            <span data-testid="auth">{isAuthenticated ? "AUTH" : "UNAUTH"}</span>
            <span data-testid="eligible">{isEligibleAdmin ? "ELIGIBLE" : "INELIGIBLE"}</span>
          </div>
        );
      }

      render(
        <AuthProvider>
          <TestDeactivatedMfaComponent />
        </AuthProvider>
      );

      await act(async () => {
        screen.getByRole("button", { name: "Sign In" }).click();
      });

      await act(async () => {
        screen.getByRole("button", { name: "Verify MFA" }).click();
      });

      expect(signOutSpy).toHaveBeenCalled();
      expect(screen.getByTestId("eligible").textContent).toBe("INELIGIBLE");
      expect(screen.getByTestId("auth").textContent).toBe("UNAUTH");
    });

    it("verifyMfaChallenge passes upgraded access_token directly to adminClient.getSelfProfile", async () => {
      vi.spyOn(authService, "signIn").mockResolvedValueOnce({
        data: { user: mockAdminUser, session: mockAal1Session },
        error: null,
      });

      vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
        data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
        error: null,
      });

      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [mockVerifiedTotpFactor], totp: [mockVerifiedTotpFactor], verifiedTotp: mockVerifiedTotpFactor },
        error: null,
      });

      vi.spyOn(authService, "challengeAndVerifyMfa").mockResolvedValueOnce({
        data: { user: mockAdminUser, session: mockAal2Session },
        error: null,
      });

      const profileSpy = vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
        success: true,
        data: mockActiveAdminProfile,
      });

      function TestTokenPassingComponent() {
        const { signIn, verifyMfaChallenge } = useAuth();
        return (
          <div>
            <button onClick={() => signIn("superadmin@cobralearn.com", "Password123!")}>Sign In</button>
            <button onClick={() => verifyMfaChallenge("654321")}>Verify MFA</button>
          </div>
        );
      }

      render(
        <AuthProvider>
          <TestTokenPassingComponent />
        </AuthProvider>
      );

      await act(async () => {
        screen.getByRole("button", { name: "Sign In" }).click();
      });

      await act(async () => {
        screen.getByRole("button", { name: "Verify MFA" }).click();
      });

      expect(profileSpy).toHaveBeenCalledWith(mockAal2Session.access_token);
    });

    it("verifyMfaChallenge handles database/server errors during profile verification without destroying session", async () => {
      vi.spyOn(authService, "signIn").mockResolvedValueOnce({
        data: { user: mockAdminUser, session: mockAal1Session },
        error: null,
      });

      vi.spyOn(authService, "getAuthenticatorAssuranceLevel").mockResolvedValue({
        data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
        error: null,
      });

      vi.spyOn(authService, "listMfaFactors").mockResolvedValue({
        data: { all: [mockVerifiedTotpFactor], totp: [mockVerifiedTotpFactor], verifiedTotp: mockVerifiedTotpFactor },
        error: null,
      });

      vi.spyOn(authService, "challengeAndVerifyMfa").mockResolvedValueOnce({
        data: { user: mockAdminUser, session: mockAal2Session },
        error: null,
      });

      vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
        success: false,
        error: "The column AdminProfile.mfaRecoveryPending does not exist in the current database.",
      });

      const signOutSpy = vi.spyOn(authService, "signOut");

      function TestDbErrorComponent() {
        const { signIn, verifyMfaChallenge, mfaError, isAuthenticated } = useAuth();
        return (
          <div>
            <button onClick={() => signIn("superadmin@cobralearn.com", "Password123!")}>Sign In</button>
            <button onClick={() => verifyMfaChallenge("654321")}>Verify MFA</button>
            <span data-testid="error">{mfaError || "NO_ERROR"}</span>
            <span data-testid="auth">{isAuthenticated ? "AUTH" : "UNAUTH"}</span>
          </div>
        );
      }

      render(
        <AuthProvider>
          <TestDbErrorComponent />
        </AuthProvider>
      );

      await act(async () => {
        screen.getByRole("button", { name: "Sign In" }).click();
      });

      await act(async () => {
        screen.getByRole("button", { name: "Verify MFA" }).click();
      });

      expect(signOutSpy).not.toHaveBeenCalled();
      expect(screen.getByTestId("error").textContent).toContain("mfaRecoveryPending");
      expect(screen.getByTestId("auth").textContent).toBe("AUTH");
    });
  });
});
