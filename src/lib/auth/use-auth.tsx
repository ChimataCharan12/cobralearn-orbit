import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User, AuthenticatorAssuranceLevels } from "@supabase/supabase-js";
import type { AdminProfile } from "@prisma/client";
import { useNavigate } from "@tanstack/react-router";
import { authService, type AuthResult } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";

export interface VerifyAdminResult {
  eligible: boolean;
  profile: AdminProfile | null;
  error?: string;
}

export interface MfaStatusState {
  currentAal: AuthenticatorAssuranceLevels | null;
  nextAal: AuthenticatorAssuranceLevels | null;
  isMfaRequired: boolean;
  isMfaEnrolled: boolean;
  verifiedFactorId: string | null;
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  adminProfile: AdminProfile | null;
  isAuthenticated: boolean;
  isEligibleAdmin: boolean;
  isLoading: boolean;
  isEligibilityLoading: boolean;
  eligibilityError: string | null;

  // Phase 4.2 MFA State additions
  currentAal: AuthenticatorAssuranceLevels | null;
  nextAal: AuthenticatorAssuranceLevels | null;
  isMfaRequired: boolean;
  isMfaEnrolled: boolean;
  verifiedFactorId: string | null;
  isMfaLoading: boolean;
  mfaError: string | null;
  clearMfaError: () => void;
  checkMfaState: () => Promise<MfaStatusState>;
  verifyMfaChallenge: (
    code: string
  ) => Promise<AuthResult<{ user: User; session: Session; profile?: AdminProfile }>>;

  signIn: (
    email: string,
    password: string
  ) => Promise<AuthResult<{ user: User; session: Session; profile?: AdminProfile; mfaRequired?: boolean }>>;
  signOut: () => Promise<AuthResult<void>>;
  verifyAdminEligibility: (token?: string, explicitUserId?: string) => Promise<VerifyAdminResult>;
  refreshProfile: () => Promise<VerifyAdminResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEligibilityLoading, setIsEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  // MFA State
  const [currentAal, setCurrentAal] = useState<AuthenticatorAssuranceLevels | null>(null);
  const [nextAal, setNextAal] = useState<AuthenticatorAssuranceLevels | null>(null);
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [isMfaEnrolled, setIsMfaEnrolled] = useState(false);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const lastVerifiedUserIdRef = useRef<string | null>(null);
  const inFlightCheckRef = useRef<Promise<VerifyAdminResult> | null>(null);

  const clearMfaError = useCallback(() => {
    setMfaError(null);
  }, []);

  /**
   * Authoritatively checks the Supabase MFA assurance level and enrolled factors.
   * If an enrolled verified factor exists and nextLevel === 'aal2' while currentLevel !== 'aal2',
   * MFA is strictly required before full admin authentication is recognized.
   */
  const checkMfaState = useCallback(async (): Promise<MfaStatusState> => {
    if (isMountedRef.current) {
      setIsMfaLoading(true);
    }
    try {
      const [assuranceRes, factorsRes] = await Promise.all([
        authService.getAuthenticatorAssuranceLevel(),
        authService.listMfaFactors(),
      ]);

      const cur = assuranceRes.data?.currentLevel ?? null;
      const nxt = assuranceRes.data?.nextLevel ?? null;
      const verifiedTotp = factorsRes.data?.verifiedTotp ?? null;
      const factorId = verifiedTotp?.id ?? null;
      const enrolled = Boolean(verifiedTotp);

      // Require MFA challenge if verified factor exists and next assurance level is AAL2
      const required = Boolean(enrolled && nxt === "aal2" && cur !== "aal2");

      if (isMountedRef.current) {
        setCurrentAal(cur);
        setNextAal(nxt);
        setIsMfaEnrolled(enrolled);
        setVerifiedFactorId(factorId);
        setIsMfaRequired(required);
      }

      return {
        currentAal: cur,
        nextAal: nxt,
        isMfaRequired: required,
        isMfaEnrolled: enrolled,
        verifiedFactorId: factorId,
      };
    } catch (err) {
      if (isMountedRef.current) {
        setMfaError(err instanceof Error ? err.message : "Error checking MFA state");
      }
      return {
        currentAal: null,
        nextAal: null,
        isMfaRequired: false,
        isMfaEnrolled: false,
        verifiedFactorId: null,
      };
    } finally {
      if (isMountedRef.current) {
        setIsMfaLoading(false);
      }
    }
  }, []);

  /**
   * Authoritatively verifies whether the active Supabase identity
   * corresponds to an active, provisioned PostgreSQL AdminProfile.
   * Deduplicates concurrent calls to eliminate race conditions.
   */
  const verifyAdminEligibility = useCallback(
    async (token?: string, explicitUserId?: string): Promise<VerifyAdminResult> => {
      if (inFlightCheckRef.current) {
        return inFlightCheckRef.current;
      }

      const checkPromise = (async (): Promise<VerifyAdminResult> => {
        setIsEligibilityLoading(true);
        setEligibilityError(null);

        try {
          const profileRes = await adminClient.getSelfProfile(token);
          if (!isMountedRef.current) {
            return { eligible: false, profile: null };
          }

          if (profileRes.success && profileRes.data && profileRes.data.isActive) {
            setAdminProfile(profileRes.data);
            lastVerifiedUserIdRef.current = explicitUserId || profileRes.data.id;
            setIsEligibilityLoading(false);
            setEligibilityError(null);
            return { eligible: true, profile: profileRes.data };
          }

          // Missing, inactive, or forbidden administrator
          setAdminProfile(null);
          lastVerifiedUserIdRef.current = null;
          const errorMsg = profileRes.error || "Forbidden: Inactive or unprovisioned administrator";
          setEligibilityError(errorMsg);
          setIsEligibilityLoading(false);
          return { eligible: false, profile: null, error: errorMsg };
        } catch (err) {
          if (!isMountedRef.current) {
            return { eligible: false, profile: null };
          }
          setAdminProfile(null);
          lastVerifiedUserIdRef.current = null;
          const errorMsg = err instanceof Error ? err.message : "Error verifying administrator eligibility";
          setEligibilityError(errorMsg);
          setIsEligibilityLoading(false);
          return { eligible: false, profile: null, error: errorMsg };
        } finally {
          inFlightCheckRef.current = null;
        }
      })();

      inFlightCheckRef.current = checkPromise;
      return checkPromise;
    },
    []
  );

  useEffect(() => {
    isMountedRef.current = true;

    let initialLoadComplete = false;
    const fallbackTimeoutId = setTimeout(() => {
      if (!initialLoadComplete && isMountedRef.current) {
        setIsLoading(false);
        setIsEligibilityLoading(false);
      }
    }, 6000);

    // Initial session retrieval
    authService
      .getSession()
      .then(async (initialSession) => {
        initialLoadComplete = true;
        clearTimeout(fallbackTimeoutId);
        if (!isMountedRef.current) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          setIsEligibilityLoading(true);
          try {
            const mfaState = await checkMfaState();
            if (!isMountedRef.current) return;

            if (mfaState.isMfaRequired) {
              // Pending MFA verification: do not load profile or treat as eligible admin
              setAdminProfile(null);
            } else {
              await verifyAdminEligibility(initialSession.access_token, initialSession.user.id);
            }
          } finally {
            if (isMountedRef.current) {
              setIsEligibilityLoading(false);
              setIsLoading(false);
            }
          }
        } else {
          setAdminProfile(null);
          setIsEligibilityLoading(false);
          setCurrentAal(null);
          setNextAal(null);
          setIsMfaRequired(false);
          setIsMfaEnrolled(false);
          setVerifiedFactorId(null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        initialLoadComplete = true;
        clearTimeout(fallbackTimeoutId);
        if (!isMountedRef.current) return;
        console.warn("Auth session initialization error:", err);
        setIsLoading(false);
        setIsEligibilityLoading(false);
      });

    // Subscribe to auth state changes
    const subscription = authService.onAuthStateChange(async (event, currentSession) => {
      if (!isMountedRef.current) return;

      switch (event) {
        case "INITIAL_SESSION":
          break;
        case "SIGNED_IN":
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          if (currentSession?.user) {
            setIsEligibilityLoading(true);
            try {
              const mfaState = await checkMfaState();
              if (!isMountedRef.current) break;
              if (mfaState.isMfaRequired) {
                setAdminProfile(null);
              } else if (lastVerifiedUserIdRef.current !== currentSession.user.id) {
                await verifyAdminEligibility(currentSession.access_token, currentSession.user.id);
              }
            } finally {
              if (isMountedRef.current) {
                setIsEligibilityLoading(false);
                setIsLoading(false);
              }
            }
          } else {
            setIsLoading(false);
          }
          break;
        case "SIGNED_OUT":
          setSession(null);
          setUser(null);
          setAdminProfile(null);
          lastVerifiedUserIdRef.current = null;
          setCurrentAal(null);
          setNextAal(null);
          setIsMfaRequired(false);
          setIsMfaEnrolled(false);
          setVerifiedFactorId(null);
          setMfaError(null);
          setIsLoading(false);
          setIsEligibilityLoading(false);
          setEligibilityError(null);
          break;
        case "TOKEN_REFRESHED":
        case "USER_UPDATED":
        case "PASSWORD_RECOVERY":
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          if (currentSession?.user) {
            await checkMfaState();
          }
          break;
        default:
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          break;
      }
    });

    return () => {
      isMountedRef.current = false;
      clearTimeout(fallbackTimeoutId);
      subscription.unsubscribe();
    };
  }, [checkMfaState, verifyAdminEligibility]);

  /**
   * Secure Interactive Sign-In Flow:
   * 1. Evaluates application boundary rate-limiting (fail-closed).
   * 2. Authenticates Supabase credentials over TLS.
   * 3. Authoritatively evaluates MFA assurance levels. If nextLevel is AAL2 and user is AAL1,
   *    session enters pending-MFA challenge state (mfaRequired: true) and stops short of granting
   *    dashboard access or loading active AdminProfile.
   * 4. If MFA is not required, immediately validates active PostgreSQL AdminProfile.
   * 5. Fails closed (signs out and displays generic error) for unprovisioned/deactivated accounts.
   */
  const signIn = async (
    email: string,
    password: string
  ): Promise<AuthResult<{ user: User; session: Session; profile?: AdminProfile; mfaRequired?: boolean }>> => {
    setIsLoading(true);
    setIsEligibilityLoading(true);

    try {
      const cleanEmail = (email || "").trim().toLowerCase();

      // 1. Pre-flight rate limiting evaluation at application boundary (fail closed)
      const rateLimitRes = await adminClient.evaluateLoginRateLimit(cleanEmail);
      if (!rateLimitRes.success || !rateLimitRes.data || !rateLimitRes.data.allowed) {
        setIsLoading(false);
        setIsEligibilityLoading(false);
        const retryAfter = rateLimitRes.data?.retryAfterSeconds;
        const msg =
          rateLimitRes.data?.message ||
          rateLimitRes.error ||
          "Too many login attempts. Please try again later.";
        const errorObj = new Error(msg);
        (errorObj as any).retryAfterSeconds = retryAfter;
        return {
          data: null,
          error: errorObj,
          ...(retryAfter !== undefined ? { retryAfterSeconds: retryAfter } : {}),
        };
      }

      // 2. Primary credential verification
      const result = await authService.signIn(cleanEmail, password);
      if (result.error || !result.data) {
        setIsLoading(false);
        setIsEligibilityLoading(false);
        return { data: null, error: new Error("Invalid email or password.") };
      }

      // 3. MFA status assessment
      const mfaState = await checkMfaState();

      if (mfaState.isMfaRequired) {
        // Enrolled TOTP account: password valid (AAL1), but AAL2 challenge is required.
        // Session is held in pending-MFA state; admin profile is NOT loaded yet.
        setSession(result.data.session);
        setUser(result.data.user);
        setAdminProfile(null);
        lastVerifiedUserIdRef.current = null;
        setIsLoading(false);
        setIsEligibilityLoading(false);
        setEligibilityError(null);

        return {
          data: {
            user: result.data.user,
            session: result.data.session,
            mfaRequired: true,
          },
          error: null,
        };
      }

      // 4. Authoritative server-side active administrator check (for non-MFA sign-ins)
      const profileRes = await adminClient.getSelfProfile(result.data.session?.access_token);

      if (!profileRes.success || !profileRes.data || !profileRes.data.isActive) {
        // Reject user without provisioned or active administrator profile (Fail Closed)
        // Immediately purge the Supabase session to leave zero lingering auth state
        await authService.signOut();
        setSession(null);
        setUser(null);
        setAdminProfile(null);
        lastVerifiedUserIdRef.current = null;
        setIsLoading(false);
        setIsEligibilityLoading(false);

        // Generic error message: no account enumeration
        return {
          data: null,
          error: new Error("Invalid email or password."),
        };
      }

      // Verified active administrator
      setSession(result.data.session);
      setUser(result.data.user);
      setAdminProfile(profileRes.data);
      lastVerifiedUserIdRef.current = result.data.user.id;
      setIsLoading(false);
      setIsEligibilityLoading(false);
      setEligibilityError(null);

      return {
        data: {
          user: result.data.user,
          session: result.data.session,
          profile: profileRes.data,
          mfaRequired: false,
        },
        error: null,
      };
    } catch (err) {
      setIsLoading(false);
      setIsEligibilityLoading(false);
      const msg = err instanceof Error && err.message ? err.message : "Invalid email or password.";
      return { data: null, error: new Error(msg) };
    }
  };

  /**
   * Completes a pending TOTP challenge and upgrades the session from AAL1 to AAL2.
   * Upon successful verification, validates the PostgreSQL AdminProfile.
   */
  const verifyMfaChallenge = async (
    code: string
  ): Promise<AuthResult<{ user: User; session: Session; profile?: AdminProfile }>> => {
    setIsMfaLoading(true);
    setMfaError(null);

    try {
      const cleanCode = (code || "").trim();
      if (!/^\d{6}$/.test(cleanCode)) {
        const err = new Error("Invalid verification code: Code must be exactly 6 digits.");
        setMfaError(err.message);
        setIsMfaLoading(false);
        return { data: null, error: err };
      }

      let factorId = verifiedFactorId;
      if (!factorId) {
        const factorsRes = await authService.listMfaFactors();
        factorId = factorsRes.data?.verifiedTotp?.id ?? null;
        if (factorId) {
          setVerifiedFactorId(factorId);
          setIsMfaEnrolled(true);
        }
      }

      if (!factorId) {
        const err = new Error("No verified MFA factor found for this account.");
        setMfaError(err.message);
        setIsMfaLoading(false);
        return { data: null, error: err };
      }

      const verifyRes = await authService.challengeAndVerifyMfa(factorId, cleanCode);
      if (verifyRes.error || !verifyRes.data) {
        const err = verifyRes.error || new Error("MFA verification failed.");
        setMfaError(err.message);
        setIsMfaLoading(false);
        return { data: null, error: err };
      }

      // Upgraded session at AAL2!
      setSession(verifyRes.data.session);
      setUser(verifyRes.data.user);
      setCurrentAal("aal2");
      setIsMfaRequired(false);
      setMfaError(null);

      // Now authoritatively verify PostgreSQL AdminProfile
      setIsEligibilityLoading(true);
      const profileRes = await adminClient.getSelfProfile(verifyRes.data.session?.access_token);

      if (!profileRes.success || !profileRes.data) {
        // Server or database error during profile lookup:
        // Do NOT destroy the session, and do NOT falsely report that the admin is inactive/unprovisioned.
        const errorMsg = profileRes.error || "Failed to load administrator profile.";
        setIsLoading(false);
        setIsEligibilityLoading(false);
        setIsMfaLoading(false);
        setMfaError(errorMsg);
        return {
          data: null,
          error: new Error(errorMsg),
        };
      }

      if (!profileRes.data.isActive) {
        // Genuine governance deactivation: sign out and fail closed
        await authService.signOut();
        setSession(null);
        setUser(null);
        setAdminProfile(null);
        lastVerifiedUserIdRef.current = null;
        setIsLoading(false);
        setIsEligibilityLoading(false);
        setIsMfaLoading(false);
        return {
          data: null,
          error: new Error("Forbidden: Inactive or unprovisioned administrator."),
        };
      }

      setAdminProfile(profileRes.data);
      lastVerifiedUserIdRef.current = verifyRes.data.user.id;
      setIsLoading(false);
      setIsEligibilityLoading(false);
      setIsMfaLoading(false);

      return {
        data: {
          user: verifyRes.data.user,
          session: verifyRes.data.session,
          profile: profileRes.data,
        },
        error: null,
      };
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setMfaError(errorObj.message);
      setIsMfaLoading(false);
      setIsEligibilityLoading(false);
      return { data: null, error: errorObj };
    }
  };

  const signOut = async (): Promise<AuthResult<void>> => {
    setIsLoading(true);
    setSession(null);
    setUser(null);
    setAdminProfile(null);
    lastVerifiedUserIdRef.current = null;
    setCurrentAal(null);
    setNextAal(null);
    setIsMfaRequired(false);
    setIsMfaEnrolled(false);
    setVerifiedFactorId(null);
    setMfaError(null);
    setIsEligibilityLoading(false);
    setEligibilityError(null);

    const result = await authService.signOut();
    setIsLoading(false);
    return result;
  };

  const isEligibleAdmin = Boolean(
    session && user && adminProfile && adminProfile.isActive && !isMfaRequired
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        adminProfile,
        isAuthenticated: Boolean(session && user),
        isEligibleAdmin,
        isLoading,
        isEligibilityLoading,
        eligibilityError,
        currentAal,
        nextAal,
        isMfaRequired,
        isMfaEnrolled,
        verifiedFactorId,
        isMfaLoading,
        mfaError,
        clearMfaError,
        checkMfaState,
        verifyMfaChallenge,
        signIn,
        signOut,
        verifyAdminEligibility,
        refreshProfile: async () => verifyAdminEligibility(session?.access_token, user?.id),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      session: null,
      adminProfile: null,
      isAuthenticated: false,
      isEligibleAdmin: false,
      isLoading: false,
      isEligibilityLoading: false,
      eligibilityError: null,
      currentAal: null,
      nextAal: null,
      isMfaRequired: false,
      isMfaEnrolled: false,
      verifiedFactorId: null,
      isMfaLoading: false,
      mfaError: null,
      clearMfaError: () => {},
      checkMfaState: async () => ({
        currentAal: null,
        nextAal: null,
        isMfaRequired: false,
        isMfaEnrolled: false,
        verifiedFactorId: null,
      }),
      verifyMfaChallenge: async () => ({
        data: null,
        error: new Error("AuthProvider not found"),
      }),
      verifyAdminEligibility: async () => ({ eligible: false, profile: null }),
      refreshProfile: async () => ({ eligible: false, profile: null }),
      signIn: async (email: string, password: string) => authService.signIn(email, password),
      signOut: authService.signOut,
    };
  }
  return context;
}

export function useAuthGuard(redirectTo = "/admin", allowQuarantined = false) {
  const {
    isAuthenticated,
    isEligibleAdmin,
    isMfaRequired,
    isLoading,
    isEligibilityLoading,
    isMfaLoading,
    adminProfile,
  } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait until both initial session check and eligibility verification finish
    if (isLoading || isEligibilityLoading || isMfaLoading) {
      return;
    }

    // 1. Unauthenticated or MFA pending -> redirect to login (or challenge screen in Phase 4.5)
    // Note: If isMfaRequired is true, user is not fully authenticated for protected admin routes,
    // so they MUST be redirected to login (or redirectTo) and NOT to /admin/access-denied.
    if (!isAuthenticated || isMfaRequired) {
      navigate({ to: redirectTo });
      return;
    }

    // 2. Reject non-admin or inactive accounts immediately (Fail closed)
    if (!isEligibleAdmin && !adminProfile?.mfaRecoveryPending) {
      navigate({ to: "/admin/access-denied" });
      return;
    }

    // 3. Quarantined in Emergency MFA Recovery:
    if (adminProfile?.mfaRecoveryPending) {
      if (!adminProfile.isActive) {
        navigate({ to: "/admin/access-denied" });
        return;
      }
      if (!allowQuarantined) {
        navigate({ to: "/admin/mfa-recovery" });
        return;
      }
      return;
    }

    // 4. For dedicated recovery routes (allowQuarantined is true):
    // If active administrator is NOT quarantined, redirect to admin dashboard
    if (allowQuarantined) {
      navigate({ to: "/admin/dashboard" });
      return;
    }
  }, [
    isAuthenticated,
    isEligibleAdmin,
    isMfaRequired,
    isLoading,
    isEligibilityLoading,
    isMfaLoading,
    adminProfile?.mfaRecoveryPending,
    adminProfile?.isActive,
    allowQuarantined,
    navigate,
    redirectTo,
  ]);

  return {
    isAuthenticated,
    isEligibleAdmin,
    isMfaRequired,
    isQuarantined: Boolean(adminProfile?.mfaRecoveryPending),
    isLoading: isLoading || isEligibilityLoading || isMfaLoading,
  };
}
