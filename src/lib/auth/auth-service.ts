import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface AuthResult<T = unknown> {
  data: T | null;
  error: Error | null;
  retryAfterSeconds?: number;
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

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    const client = getSupabaseBrowserClient();
    const { data: { subscription } } = client.auth.onAuthStateChange(callback);
    return subscription;
  },
};
