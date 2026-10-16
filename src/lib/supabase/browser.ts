import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function getBrowserEnv(key: string): string {
  // Check import.meta.env first (Vite client build)
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const viteVal = import.meta.env[`VITE_${key}`] || import.meta.env[key];
    if (viteVal) return viteVal;
  }
  // Fallback to process.env if available (SSR / Node test environments)
  if (typeof process !== "undefined" && process.env) {
    const nodeVal = process.env[`VITE_${key}`] || process.env[key];
    if (nodeVal) return nodeVal;
  }
  return "";
}

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const supabaseUrl = getBrowserEnv("SUPABASE_URL");
  const supabaseAnonKey = getBrowserEnv("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    // In dev / test environments without active env injected into client yet, handle gracefully
    console.warn("Supabase URL or Anon Key is not set in environment.");
  }

  browserClient = createBrowserClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-anon-key"
  );

  return browserClient;
}

export const supabase = getSupabaseBrowserClient();
