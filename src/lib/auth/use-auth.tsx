import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AdminProfile } from "@prisma/client";
import { useNavigate } from "@tanstack/react-router";
import { authService, type AuthResult } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";

export interface VerifyAdminResult {
  eligible: boolean;
  profile: AdminProfile | null;
  error?: string;
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
  signIn: (email: string, password: string) => Promise<AuthResult<{ user: User; session: Session; profile?: AdminProfile }>>;
  signOut: () => Promise<AuthResult<void>>;
  verifyAdminEligibility: (token?: string, explicitUserId?: string) => Promise<VerifyAdminResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEligibilityLoading, setIsEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const lastVerifiedUserIdRef = useRef<string | null>(null);
  const inFlightCheckRef = useRef<Promise<VerifyAdminResult> | null>(null);

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
          const profileRes = await adminClient.getSelfProfile();
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
        setIsLoading(false);

        if (initialSession?.user) {
          await verifyAdminEligibility(initialSession.access_token, initialSession.user.id);
        } else {
          setAdminProfile(null);
          setIsEligibilityLoading(false);
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
          setIsLoading(false);
          if (currentSession?.user) {
            if (lastVerifiedUserIdRef.current !== currentSession.user.id) {
              await verifyAdminEligibility(currentSession.access_token, currentSession.user.id);
            }
          }
          break;
        case "SIGNED_OUT":
          setSession(null);
          setUser(null);
          setAdminProfile(null);
          lastVerifiedUserIdRef.current = null;
          setIsLoading(false);
          setIsEligibilityLoading(false);
          setEligibilityError(null);
          break;
        case "TOKEN_REFRESHED":
        case "USER_UPDATED":
        case "PASSWORD_RECOVERY":
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          // Preserve verified profile across token refreshes to avoid repeated DB hits & races
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
  }, [verifyAdminEligibility]);

  /**
   * Secure Interactive Sign-In Flow:
   * 1. Authenticates Supabase credentials over TLS.
   * 2. Immediately validates that the identity has an active PostgreSQL AdminProfile.
   * 3. Fails closed (signs out and displays generic error) for unprovisioned/deactivated accounts.
   */
  const signIn = async (
    email: string,
    password: string
  ): Promise<AuthResult<{ user: User; session: Session; profile?: AdminProfile }>> => {
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
          retryAfterSeconds: retryAfter,
        };
      }

      const result = await authService.signIn(cleanEmail, password);
      if (result.error || !result.data) {
        setIsLoading(false);
        setIsEligibilityLoading(false);
        return { data: null, error: new Error("Invalid email or password.") };
      }

      // Authoritative server-side active administrator check
      const profileRes = await adminClient.getSelfProfile();

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

  const signOut = async (): Promise<AuthResult<void>> => {
    setIsLoading(true);
    setSession(null);
    setUser(null);
    setAdminProfile(null);
    lastVerifiedUserIdRef.current = null;
    setIsEligibilityLoading(false);
    setEligibilityError(null);

    const result = await authService.signOut();
    setIsLoading(false);
    return result;
  };

  const isEligibleAdmin = Boolean(
    session && user && adminProfile && adminProfile.isActive
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
        signIn,
        signOut,
        verifyAdminEligibility,
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
      verifyAdminEligibility: async () => ({ eligible: false, profile: null }),
      signIn: async (email: string, password: string) => authService.signIn(email, password),
      signOut: authService.signOut,
    };
  }
  return context;
}

export function useAuthGuard(redirectTo = "/admin") {
  const { isAuthenticated, isEligibleAdmin, isLoading, isEligibilityLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait until both initial session check and eligibility verification finish
    if (isLoading || isEligibilityLoading) {
      return;
    }

    // 1. Unauthenticated -> redirect to login (or redirectTo)
    if (!isAuthenticated) {
      navigate({ to: redirectTo });
      return;
    }

    // 2. Authenticated with Supabase, but not an active eligible admin
    if (!isEligibleAdmin) {
      navigate({ to: "/admin/access-denied" });
      return;
    }
  }, [isAuthenticated, isEligibleAdmin, isLoading, isEligibilityLoading, navigate, redirectTo]);

  return {
    isAuthenticated,
    isEligibleAdmin,
    isLoading: isLoading || isEligibilityLoading,
  };
}
