import type {
  User,
  Session,
  AuthenticatorAssuranceLevels,
  AMREntry,
} from "@supabase/supabase-js";
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

export interface ServerAssuranceResult {
  currentLevel: AuthenticatorAssuranceLevels | null;
  nextLevel: AuthenticatorAssuranceLevels | null;
  currentAuthenticationMethods: AMREntry[] | string[];
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
 * Extracts the raw access token string from Authorization header or cookies.
 */
export function extractAccessTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token) return token;
  }

  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader) {
    const cookieMap = new Map<string, string>();
    cookieHeader.split(";").forEach((pair) => {
      const [key, ...vals] = pair.trim().split("=");
      if (key) cookieMap.set(key, decodeURIComponent(vals.join("=")));
    });

    const sbToken =
      cookieMap.get("sb-access-token") ||
      cookieMap.get("supabase-auth-token") ||
      Array.from(cookieMap.entries()).find(([k]) => k.startsWith("sb-") && k.endsWith("-auth-token"))?.[1];

    if (sbToken) {
      try {
        if (sbToken.startsWith("{") || sbToken.startsWith("[")) {
          const parsed = JSON.parse(sbToken);
          if (typeof parsed === "string") return parsed;
          if (parsed && typeof parsed.access_token === "string") return parsed.access_token;
          if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
        }
      } catch {
        // Not JSON, return as-is
      }
      return sbToken;
    }
  }

  return null;
}

/**
 * Authoritatively retrieves the Authenticator Assurance Level (AAL) for a server request
 * using the official Supabase SDK server client.
 */
export async function getAssuranceLevelForRequest(
  request: Request
): Promise<ServerAssuranceResult> {
  const token = extractAccessTokenFromRequest(request);
  const cookieHeader = request.headers.get("cookie") || "";

  const cookieMap = new Map<string, string>();
  if (cookieHeader) {
    cookieHeader.split(";").forEach((pair) => {
      const [key, ...vals] = pair.trim().split("=");
      if (key) cookieMap.set(key, vals.join("="));
    });
  }

  const supabase = getSupabaseServerClient({
    get: (name: string) => cookieMap.get(name),
  });

  try {
    if (token) {
      if (typeof supabase.auth?.mfa?.getAuthenticatorAssuranceLevel === "function") {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(token);
        if (!error && data) {
          return {
            currentLevel: data.currentLevel,
            nextLevel: data.nextLevel,
            currentAuthenticationMethods: data.currentAuthenticationMethods || [],
          };
        }
      }
    } else {
      if (typeof supabase.auth?.mfa?.getAuthenticatorAssuranceLevel === "function") {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!error && data) {
          return {
            currentLevel: data.currentLevel,
            nextLevel: data.nextLevel,
            currentAuthenticationMethods: data.currentAuthenticationMethods || [],
          };
        }
      }
    }
  } catch {
    // Fail closed on error
  }

  return {
    currentLevel: null,
    nextLevel: null,
    currentAuthenticationMethods: [],
  };
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

export interface AdminAuthOptions {
  allowQuarantined?: boolean;
}

/**
 * Resolves the authenticated Supabase user to a verified, active PostgreSQL AdminProfile.
 * Fails closed if the session is invalid, the profile record is missing, isActive === false,
 * or mfaRecoveryPending === true (unless explicitly permitted for re-enrollment).
 */
export async function requireAdminProfile(
  request: Request,
  prismaClient?: PrismaClient,
  options?: AdminAuthOptions
): Promise<AuthenticatedAdminContext> {
  // 1. Authenticate identity via Supabase Auth
  const user = await requireAuthenticatedUser(request);

  // 2. Query matching AdminProfile by canonical Auth UUID
  const prisma = prismaClient || (await getPrisma());
  let profile: AdminProfile | null = null;
  let schemaMissingRecoveryColumn = false;

  try {
    profile = await prisma.adminProfile.findUnique({
      where: { id: user.id },
    });
  } catch (dbErr: any) {
    if (
      dbErr?.code === "P2022" &&
      (dbErr?.meta?.column?.includes("mfaRecoveryPending") || dbErr?.message?.includes("mfaRecoveryPending"))
    ) {
      schemaMissingRecoveryColumn = true;
      // The database has not yet applied the Phase 4.6 migration (mfaRecoveryPending column).
      // Retrieve base profile columns defensively.
      const rawProfile = await prisma.adminProfile.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          designation: true,
          avatarUrl: true,
          role: true,
          phone: true,
          bio: true,
          preferences: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (rawProfile) {
        profile = {
          ...rawProfile,
          mfaRecoveryPending: false,
          mfaRecoveryAt: null,
        } as AdminProfile;
      }
    } else {
      throw dbErr;
    }
  }

  // 3. Reject missing profile (Fail Closed)
  if (!profile) {
    throw new Error("Forbidden: AdminProfile not found for authenticated user");
  }

  // 4. Reject inactive profile (Fail Closed)
  if (!profile.isActive) {
    throw new Error("Forbidden: AdminProfile is deactivated");
  }

  // 5. Enforce Emergency Recovery Quarantine (Fail Closed)
  if (schemaMissingRecoveryColumn) {
    // When the recovery column is absent in the database, quarantine status cannot be assumed safe.
    // If the caller explicitly allows quarantined access (e.g. getSelfProfile during login/recovery),
    // proceed safely. Otherwise, authoritatively verify against active recovery records or fail closed.
    if (!options?.allowQuarantined) {
      let isQuarantined = false;
      let recoveryVerificationFailed = false;

      try {
        const activeRecovery = await prisma.adminMfaRecovery.findFirst({
          where: {
            targetId: user.id,
            status: { in: ["PENDING", "FACTOR_DELETED", "RECONCILIATION_REQUIRED"] },
          },
        });
        if (activeRecovery) {
          isQuarantined = true;
        }
      } catch {
        // If AdminMfaRecovery table is also missing (unmigrated database) or query fails,
        // quarantine state cannot be reliably established. Fail closed to prevent bypass!
        recoveryVerificationFailed = true;
      }

      if (isQuarantined || recoveryVerificationFailed) {
        throw new Error("Forbidden: MFA_REENROLLMENT_REQUIRED");
      }
    }
  } else if (profile.mfaRecoveryPending && !options?.allowQuarantined) {
    throw new Error("Forbidden: MFA_REENROLLMENT_REQUIRED");
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

/**
 * Central AAL2 Authorization Helper:
 * 1. Authoritatively validates authenticated Supabase identity and active AdminProfile (fails closed).
 * 2. Authoritatively verifies that the session is elevated to AAL2 from a cryptographically validated source.
 * 3. Rejects requests where currentLevel !== "aal2" with "Forbidden: AAL2_REQUIRED".
 */
export async function requireAal2(
  request: Request,
  prismaClient?: PrismaClient
): Promise<AuthenticatedAdminContext> {
  // 1. Authoritatively verify identity and active PostgreSQL AdminProfile
  const context = await requireAdminProfile(request, prismaClient);

  // 2. Authoritatively verify AAL2 assurance level
  const assurance = await getAssuranceLevelForRequest(request);

  if (assurance.currentLevel !== "aal2") {
    throw new Error("Forbidden: AAL2_REQUIRED");
  }

  return context;
}

/**
 * Combines AAL2 enforcement with action-level RBAC permission checks.
 * Guarantees that an AAL2 session never grants permissions that the user's role does not possess.
 */
export async function requireAal2Permission(
  request: Request,
  permission: AdminPermission,
  prismaClient?: PrismaClient
): Promise<AuthenticatedAdminContext> {
  // 1. Enforce AAL2 + active AdminProfile
  const context = await requireAal2(request, prismaClient);

  // 2. Enforce RBAC permission for role
  if (!canPerform(context.profile.role, permission)) {
    throw new Error(
      `Forbidden: Role "${context.profile.role}" lacks required permission: "${permission}"`
    );
  }

  return context;
}

/**
 * Combines AAL2 enforcement with explicit role requirements.
 */
export async function requireAal2Role(
  request: Request,
  allowedRoles: AdminRole[],
  prismaClient?: PrismaClient
): Promise<AuthenticatedAdminContext> {
  // 1. Enforce AAL2 + active AdminProfile
  const context = await requireAal2(request, prismaClient);

  // 2. Enforce allowed role
  if (!allowedRoles.includes(context.profile.role)) {
    throw new Error(
      `Forbidden: Insufficient role permissions. Required: [${allowedRoles.join(", ")}], Actual: ${context.profile.role}`
    );
  }

  return context;
}

/**
 * Checks if an error represents a server quarantine condition (MFA re-enrollment required).
 */
export function isQuarantineError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("MFA_REENROLLMENT_REQUIRED");
}
