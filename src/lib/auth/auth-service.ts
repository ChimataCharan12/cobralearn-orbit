import type {
  AuthChangeEvent,
  Session,
  User,
  Factor,
  AuthenticatorAssuranceLevels,
  AMREntry,
} from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface AuthResult<T = unknown> {
  data: T | null;
  error: Error | null;
  retryAfterSeconds?: number;
}

export interface MfaFactorsList {
  all: Factor[];
  totp: Factor[];
  unverifiedTotp?: Factor[];
  verifiedTotp: Factor | null;
}

export interface MfaEnrollTotpResult {
  id: string;
  type: "totp";
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
  friendlyName?: string;
}

export interface MfaAssuranceLevelResult {
  currentLevel: AuthenticatorAssuranceLevels | null;
  nextLevel: AuthenticatorAssuranceLevels | null;
  currentAuthenticationMethods: AMREntry[] | string[];
}

export const authService = {
  async signIn(email: string, password: string): Promise<AuthResult<{ user: User; session: Session }>> {
    try {
      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { data: null, error };
      }

      if (!data.user || !data.session) {
        return { data: null, error: new Error("Authentication failed: No user or session returned.") };
      }

      return {
        data: { user: data.user, session: data.session },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  async signOut(): Promise<AuthResult<void>> {
    try {
      const client = getSupabaseBrowserClient();
      const { error } = await client.auth.signOut();
      if (error) {
        return { data: null, error };
      }
      return { data: null, error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  async getSession(): Promise<Session | null> {
    try {
      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) return null;
      return data.session;
    } catch {
      return null;
    }
  },

  async getUser(): Promise<User | null> {
    try {
      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return data.user;
    } catch {
      return null;
    }
  },

  async exchangeCodeForSession(code: string): Promise<AuthResult<{ user: User; session: Session }>> {
    try {
      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) {
        return { data: null, error };
      }
      if (!data.user || !data.session) {
        return { data: null, error: new Error("Authentication exchange failed: No user or session established.") };
      }
      return {
        data: { user: data.user, session: data.session },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  async verifyOtp(params: {
    token_hash: string;
    type?: "recovery" | "email" | "signup" | "magiclink" | "invite";
  }): Promise<AuthResult<{ user: User; session: Session }>> {
    try {
      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.verifyOtp({
        token_hash: params.token_hash,
        type: (params.type || "recovery") as any,
      });
      if (error) {
        return { data: null, error };
      }
      if (!data.user || !data.session) {
        return { data: null, error: new Error("OTP verification failed: No user or session established.") };
      }
      return {
        data: { user: data.user, session: data.session },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  async setSession(currentSession: {
    access_token: string;
    refresh_token: string;
  }): Promise<AuthResult<{ user: User; session: Session }>> {
    try {
      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.setSession(currentSession);
      if (error) {
        return { data: null, error };
      }
      if (!data.user || !data.session) {
        return { data: null, error: new Error("Session initialization failed: No user or session established.") };
      }
      return {
        data: { user: data.user, session: data.session },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  async resetPassword(email: string, redirectTo?: string): Promise<AuthResult<void>> {
    try {
      const client = getSupabaseBrowserClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const defaultRedirect = `${origin}/auth/callback?type=recovery&next=/admin/reset-password`;

      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectTo || defaultRedirect,
      });

      if (error) {
        return { data: null, error };
      }
      return { data: null, error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  async verifyCurrentPassword(password: string): Promise<AuthResult<boolean>> {
    try {
      const client = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user?.email) {
        return { data: null, error: new Error("Active administrator session required.") };
      }

      const { error } = await client.auth.signInWithPassword({
        email: userData.user.email,
        password,
      });

      if (error) {
        return { data: false, error: new Error("Current password is incorrect.") };
      }

      return { data: true, error: null };
    } catch (err) {
      return {
        data: false,
        error: err instanceof Error ? err : new Error("Failed to verify current password."),
      };
    }
  },

  async updatePassword(password: string): Promise<AuthResult<User>> {
    try {
      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.updateUser({
        password,
      });

      if (error) {
        return { data: null, error };
      }
      return { data: data.user, error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  // =========================================================================
  // MFA (TOTP) SERVICE WRAPPERS
  // =========================================================================

  /**
   * Retrieves all enrolled MFA factors for the active authenticated user.
   */
  async listMfaFactors(): Promise<AuthResult<MfaFactorsList>> {
    try {
      const client = getSupabaseBrowserClient();
      if (!client.auth?.mfa || typeof client.auth.mfa.listFactors !== "function") {
        return {
          data: { all: [], totp: [], unverifiedTotp: [], verifiedTotp: null },
          error: null,
        };
      }

      const { data, error } = await client.auth.mfa.listFactors();
      if (error) {
        return { data: null, error };
      }

      const all = data?.all || [];
      // Note: In Supabase GoTrue, data.totp ONLY contains factors where status === 'verified'.
      // Unverified TOTP factors are only present in data.all.
      // Partition reliably from `all` so that all TOTP factors are accessible.
      const totp = all.filter((f) => f.factor_type === "totp");
      const unverifiedTotp = totp.filter((f) => f.status === "unverified");
      const verifiedTotp = totp.find((f) => f.status === "verified") || null;

      return {
        data: { all, totp, unverifiedTotp, verifiedTotp },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  /**
   * Retrieves the Authenticator Assurance Level (AAL) for the active session.
   * When jwt is provided, checks the assurance level of that token.
   */
  async getAuthenticatorAssuranceLevel(
    jwt?: string
  ): Promise<AuthResult<MfaAssuranceLevelResult>> {
    try {
      const client = getSupabaseBrowserClient();
      if (!client.auth?.mfa || typeof client.auth.mfa.getAuthenticatorAssuranceLevel !== "function") {
        return {
          data: {
            currentLevel: "aal1",
            nextLevel: "aal1",
            currentAuthenticationMethods: [],
          },
          error: null,
        };
      }

      const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(jwt);
      if (error) {
        return { data: null, error };
      }

      return {
        data: {
          currentLevel: data?.currentLevel || null,
          nextLevel: data?.nextLevel || null,
          currentAuthenticationMethods: data?.currentAuthenticationMethods || [],
        },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  /**
   * Enrolls a new TOTP MFA factor for the active user.
   * Never logs the secret, QR code, or sensitive parameters.
   */
  async enrollTotp(
    options?: string | { friendlyName?: string }
  ): Promise<AuthResult<MfaEnrollTotpResult>> {
    try {
      const client = getSupabaseBrowserClient();
      if (!client.auth?.mfa || typeof client.auth.mfa.enroll !== "function") {
        return { data: null, error: new Error("MFA enrollment API not available in current environment.") };
      }

      const rawName = typeof options === "string" ? options : options?.friendlyName;
      const friendlyName = (rawName || "").trim() || "CobraLearn Orbit Admin";

      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        issuer: "CobraLearn Orbit",
        friendlyName,
      });

      if (error) {
        return { data: null, error };
      }

      if (!data?.id || !data.totp) {
        return { data: null, error: new Error("MFA enrollment failed: Incomplete factor details returned.") };
      }

      return {
        data: {
          id: data.id,
          type: "totp",
          totp: {
            qr_code: data.totp.qr_code,
            secret: data.totp.secret,
            uri: data.totp.uri,
          },
          ...(data.friendly_name ? { friendlyName: data.friendly_name } : {}),
        },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  /**
   * Creates an authentication challenge for an enrolled MFA factor.
   */
  async challengeMfa(
    factorId: string
  ): Promise<AuthResult<{ id: string; expires_at: number }>> {
    try {
      if (!factorId || typeof factorId !== "string" || !factorId.trim()) {
        return { data: null, error: new Error("Invalid factor ID: A valid factor identifier is required.") };
      }

      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.mfa.challenge({
        factorId: factorId.trim(),
      });

      if (error) {
        return { data: null, error };
      }

      if (!data?.id) {
        return { data: null, error: new Error("MFA challenge creation failed: No challenge ID returned.") };
      }

      return {
        data: { id: data.id, expires_at: data.expires_at },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  /**
   * Verifies a 6-digit TOTP code against an active MFA challenge.
   */
  async verifyMfa(
    factorId: string,
    challengeId: string,
    code: string
  ): Promise<AuthResult<{ user: User; session: Session }>> {
    try {
      if (!factorId || typeof factorId !== "string" || !factorId.trim()) {
        return { data: null, error: new Error("Invalid factor ID: A valid factor identifier is required.") };
      }
      if (!challengeId || typeof challengeId !== "string" || !challengeId.trim()) {
        return { data: null, error: new Error("Invalid challenge ID: A valid challenge identifier is required.") };
      }

      const cleanCode = (code || "").trim();
      if (!/^\d{6}$/.test(cleanCode)) {
        return {
          data: null,
          error: new Error("Invalid verification code: Code must be exactly 6 digits."),
        };
      }

      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.mfa.verify({
        factorId: factorId.trim(),
        challengeId: challengeId.trim(),
        code: cleanCode,
      });

      if (error) {
        return { data: null, error };
      }

      if (!data?.user || (!('access_token' in data) && !(data as any).session)) {
        return { data: null, error: new Error("MFA verification failed: Incomplete verification response returned.") };
      }

      const user = data.user;
      let session: Session;

      if ((data as any).session) {
        session = (data as any).session;
      } else if ('access_token' in data && (data as any).access_token) {
        session = {
          access_token: (data as any).access_token,
          refresh_token: (data as any).refresh_token,
          expires_in: (data as any).expires_in,
          expires_at: (data as any).expires_at || Math.round(Date.now() / 1000) + ((data as any).expires_in || 3600),
          token_type: (data as any).token_type || "bearer",
          user: data.user,
        };
      } else {
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData?.session) {
          session = sessionData.session;
        } else {
          return { data: null, error: new Error("MFA verification failed: Incomplete session credentials returned.") };
        }
      }

      return {
        data: { user, session },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  /**
   * Single-step challenge and verify helper for TOTP authentication.
   */
  async challengeAndVerifyMfa(
    factorId: string,
    code: string
  ): Promise<AuthResult<{ user: User; session: Session }>> {
    try {
      if (!factorId || typeof factorId !== "string" || !factorId.trim()) {
        return { data: null, error: new Error("Invalid factor ID: A valid factor identifier is required.") };
      }

      const cleanCode = (code || "").trim();
      if (!/^\d{6}$/.test(cleanCode)) {
        return {
          data: null,
          error: new Error("Invalid verification code: Code must be exactly 6 digits."),
        };
      }

      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.mfa.challengeAndVerify({
        factorId: factorId.trim(),
        code: cleanCode,
      });

      if (error) {
        return { data: null, error };
      }

      if (!data?.user || (!('access_token' in data) && !(data as any).session)) {
        return { data: null, error: new Error("MFA verification failed: Incomplete verification response returned.") };
      }

      const user = data.user;
      let session: Session;

      if ((data as any).session) {
        session = (data as any).session;
      } else if ('access_token' in data && (data as any).access_token) {
        session = {
          access_token: (data as any).access_token,
          refresh_token: (data as any).refresh_token,
          expires_in: (data as any).expires_in,
          expires_at: (data as any).expires_at || Math.round(Date.now() / 1000) + ((data as any).expires_in || 3600),
          token_type: (data as any).token_type || "bearer",
          user: data.user,
        };
      } else {
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData?.session) {
          session = sessionData.session;
        } else {
          return { data: null, error: new Error("MFA verification failed: Incomplete session credentials returned.") };
        }
      }

      return {
        data: { user, session },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  /**
   * Unenrolls an MFA factor. Supabase requires an active aal2 session to unenroll a verified factor.
   */
  async unenrollMfa(factorId: string): Promise<AuthResult<{ id: string }>> {
    try {
      if (!factorId || typeof factorId !== "string" || !factorId.trim()) {
        return { data: null, error: new Error("Invalid factor ID: A valid factor identifier is required.") };
      }

      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.mfa.unenroll({
        factorId: factorId.trim(),
      });

      if (error) {
        return { data: null, error };
      }

      if (!data?.id) {
        return { data: null, error: new Error("MFA unenrollment failed: No factor ID returned.") };
      }

      return {
        data: { id: data.id },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    const client = getSupabaseBrowserClient();
    const { data: { subscription } } = client.auth.onAuthStateChange(callback);
    return subscription;
  },
};
