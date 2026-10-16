import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("CRITICAL SECURITY ERROR: getSupabaseAdminClient must NEVER be called in browser context.");
  }

  if (adminClient) return adminClient;

  const supabaseUrl = process.env["SUPABASE_URL"] || "";
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in server environment.");
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
