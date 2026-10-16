import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CookieHandler {
  get: (name: string) => string | undefined;
  set?: (name: string, value: string, options: CookieOptions) => void;
  remove?: (name: string, options: CookieOptions) => void;
}

export function getSupabaseServerClient(cookieHandler?: CookieHandler): SupabaseClient {
  const supabaseUrl = process.env["SUPABASE_URL"] || "";
  const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"] || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Server Supabase URL or Anon Key is not set in environment.");
  }

  return createServerClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-anon-key",
    {
      cookies: {
        get(name: string) {
          return cookieHandler?.get(name);
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieHandler?.set?.(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieHandler?.remove?.(name, options);
        },
      },
    }
  );
}
