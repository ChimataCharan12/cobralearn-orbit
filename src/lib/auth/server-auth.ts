import type { User, Session } from "@supabase/supabase-js";
import type { AdminProfile, AdminRole, PrismaClient } from "@prisma/client";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { canPerform, type AdminPermission } from "@/lib/auth/rbac";

export interface AuthenticatedUserResult {
  user: User | null;
  session: Session | null;
  error: string | null;
}

export interface AuthenticatedAdminContext {
  user: User;
  profile: AdminProfile;
}

let defaultPrisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient> {
  if (!defaultPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

/**
 * Extracts and verifies the authenticated Supabase user from cookie headers.
 */
export async function getAuthenticatedUserFromCookies(
  cookieHeader?: string
): Promise<AuthenticatedUserResult> {
  try {
    if (!cookieHeader) {
      return { user: null, session: null, error: "No cookie header provided" };
    }

    const cookieMap = new Map<string, string>();
    cookieHeader.split(";").forEach((pair) => {
      const [key, ...vals] = pair.trim().split("=");
      if (key) cookieMap.set(key, vals.join("="));
    });

    const supabase = getSupabaseServerClient({
      get: (name: string) => cookieMap.get(name),
    });

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { user: null, session: null, error: error?.message || "User not found" };
    }

    const { data: sessionData } = await supabase.auth.getSession();

    return {
      user: data.user,
      session: sessionData.session,
      error: null,
    };
  } catch (err) {
    return {
      user: null,
      session: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Enforces that a request possesses a cryptographically valid Supabase session.
 * Checks Authorization Bearer header first, then falls back to session cookies.
 */
export async function requireAuthenticatedUser(request: Request): Promise<User> {
  const cookieHeader = request.headers.get("cookie") || "";
  const authHeader = request.headers.get("authorization") || "";

  // 1. Check Bearer Token if present
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token) {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
        return data.user;
      }
    }
  }

  // 2. Fallback to session cookies
  const result = await getAuthenticatedUserFromCookies(cookieHeader);
  if (!result.user) {
    throw new Error(result.error || "Unauthorized: No valid Supabase session");
  }

  return result.user;
}

/**
 * Resolves the authenticated Supabase user to a verified, active PostgreSQL AdminProfile.
 * Fails closed if the session is invalid, the profile record is missing, or isActive === false.
 */
export async function requireAdminProfile(
  request: Request,
  prismaClient?: PrismaClient
): Promise<AuthenticatedAdminContext> {
  // 1. Authenticate identity via Supabase Auth
  const user = await requireAuthenticatedUser(request);

  // 2. Query matching AdminProfile by canonical Auth UUID
  const prisma = prismaClient || (await getPrisma());
  const profile = await prisma.adminProfile.findUnique({
    where: { id: user.id },
  });

  // 3. Reject missing profile (Fail Closed)
  if (!profile) {
    throw new Error("Forbidden: AdminProfile not found for authenticated user");
  }

  // 4. Reject inactive profile (Fail Closed)
  if (!profile.isActive) {
    throw new Error("Forbidden: AdminProfile is deactivated");
  }

  return { user, profile };
}

/**
 * Enforces that the authenticated user possesses one of the allowed administrative roles.
 */
export async function requireRole(
  request: Request,
  allowedRoles: AdminRole[],
  prismaClient?: PrismaClient
): Promise<AuthenticatedAdminContext> {
  const context = await requireAdminProfile(request, prismaClient);

  if (!allowedRoles.includes(context.profile.role)) {
    throw new Error(
      `Forbidden: Insufficient role permissions. Required: [${allowedRoles.join(", ")}], Actual: ${context.profile.role}`
    );
  }

  return context;
}

/**
 * Enforces that the authenticated user's role has permission to execute a specific action.
 */
export async function requirePermission(
  request: Request,
  permission: AdminPermission,
  prismaClient?: PrismaClient
): Promise<AuthenticatedAdminContext> {
  const context = await requireAdminProfile(request, prismaClient);

  if (!canPerform(context.profile.role, permission)) {
    throw new Error(
      `Forbidden: Role "${context.profile.role}" lacks required permission: "${permission}"`
    );
  }

  return context;
}
