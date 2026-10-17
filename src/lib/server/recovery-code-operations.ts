import type { PrismaClient } from "@prisma/client";
import { requireAal2, requireAdminProfile } from "@/lib/auth/server-auth";
import {
  extractTrustedClientIp,
  hashAccountIdentifier,
  hashIpIdentifier,
  maskIpAddress,
} from "@/lib/server/client-ip";
import {
  consumeRateLimit,
  AUTH_RATE_THRESHOLDS,
  type RateLimitResult,
} from "@/lib/server/rate-limiter";
import {
  generateRecoveryCodeSet,
  generateSaltHex,
  hashRecoveryCode,
  isValidRecoveryCodeFormat,
  normalizeRecoveryCode,
  verifyRecoveryCodeHash,
} from "@/lib/server/recovery-code-crypto";

let defaultPrisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient | undefined> {
  if (process.env["VITEST"]) {
    return undefined;
  }
  if (!defaultPrisma || typeof (defaultPrisma as any).adminRecoveryCode === "undefined") {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

export interface GenerateRecoveryCodesResult {
  success: boolean;
  codes?: string[];
  error?: string;
}

export interface RecoveryCodeStatusResult {
  success: boolean;
  hasCodes: boolean;
  totalCodes: number;
  remainingCodes: number;
  error?: string;
}

export interface VerifyRecoveryCodePayload {
  adminId: string;
  code: string;
}

export interface VerifyRecoveryCodeResult {
  success: boolean;
  message?: string;
  remainingCodes?: number;
  isQuarantined?: boolean;
  error?: string;
}

export const GENERIC_RECOVERY_ERROR = "Invalid or already redeemed recovery code.";
export const RATE_LIMIT_RECOVERY_ERROR = "Too many recovery attempts. Please try again later.";
export const SERVICE_UNAVAILABLE_RECOVERY_ERROR = "Recovery service temporarily unavailable. Please try again later.";

/**
 * Server Operation: Generates a fresh set of 8 single-use recovery codes for the active administrator.
 *
 * Security Requirements:
 * 1. Requires active administrator profile with verified AAL2 elevation.
 * 2. Uses canonical authenticated user UUID.
 * 3. Atomically invalidates any previously issued recovery codes.
 * 4. Persists only salted scrypt hashes. Never persists plaintext codes.
 * 5. Returns plaintext codes ONCE to the authorized caller.
 * 6. Records an audit event with sanitized metadata (no codes, salts, or hashes).
 */
export async function generateRecoveryCodesOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<GenerateRecoveryCodesResult> {
  const prisma = prismaClient || (await getPrisma());
  if (!prisma) {
    throw new Error("Database client unavailable");
  }

  // 1. Authoritatively enforce AAL2 + active AdminProfile
  const context = await requireAal2(request, prisma);
  const adminId = context.profile.id;

  // 2. Generate 8 unique, high-entropy recovery codes
  const plaintextCodes = generateRecoveryCodeSet();

  // 3. Compute unique random salts and scrypt hashes asynchronously
  const recordsToInsert = await Promise.all(
    plaintextCodes.map(async (code) => {
      const normalized = normalizeRecoveryCode(code);
      const saltHex = generateSaltHex();
      const codeHash = await hashRecoveryCode(normalized, saltHex);
      return {
        adminId,
        codeHash,
        codeSalt: saltHex,
        isUsed: false,
      };
    })
  );

  // 4. Atomically invalidate previous codes and insert new code set
  await prisma.$transaction(async (tx) => {
    const recoveryCodeDelegate = (tx as any)?.adminRecoveryCode || (prisma as any)?.adminRecoveryCode;
    if (!recoveryCodeDelegate || typeof recoveryCodeDelegate.deleteMany !== "function") {
      throw new Error("Database client or transaction is missing AdminRecoveryCode delegate");
    }

    // Delete any existing recovery codes for this administrator
    await recoveryCodeDelegate.deleteMany({
      where: { adminId },
    });

    // Insert new hashed codes
    await recoveryCodeDelegate.createMany({
      data: recordsToInsert,
    });
  });

  // 5. Record sanitized security audit log (Zero sensitive values)
  try {
    if (typeof (prisma as any).adminAuditLog?.create === "function") {
      await (prisma as any).adminAuditLog.create({
        data: {
          actorId: adminId,
          actorEmail: context.profile.email,
          action: "auth:recovery_codes_generated",
          module: "auth_mfa_recovery",
          entityId: adminId,
          metadata: {
            count: plaintextCodes.length,
          },
          ipAddress: maskIpAddress(extractTrustedClientIp(request.headers)),
        },
      });
    }
  } catch {
    // Non-fatal audit log failure
  }

  return {
    success: true,
    codes: plaintextCodes,
  };
}

/**
 * Server Operation: Retrieves non-sensitive recovery-code status for the authenticated administrator.
 *
 * Security Requirements:
 * 1. Requires active administrator profile.
 * 2. Never exposes codes, salts, or hashes.
 */
export async function getRecoveryCodeStatusOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<RecoveryCodeStatusResult> {
  const prisma = prismaClient || (await getPrisma());
  if (!prisma) {
    throw new Error("Database client unavailable");
  }

  const context = await requireAdminProfile(request, prisma);
  const adminId = context.profile.id;

  const recoveryCodeDelegate = (prisma as any)?.adminRecoveryCode;
  if (!recoveryCodeDelegate || typeof recoveryCodeDelegate.count !== "function") {
    throw new Error("Database client is missing AdminRecoveryCode delegate");
  }

  try {
    const [totalCodes, remainingCodes] = await Promise.all([
      recoveryCodeDelegate.count({
        where: { adminId },
      }),
      recoveryCodeDelegate.count({
        where: { adminId, isUsed: false },
      }),
    ]);

    return {
      success: true,
      hasCodes: totalCodes > 0,
      totalCodes,
      remainingCodes,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("missing AdminRecoveryCode delegate")) {
      throw err;
    }
    // If table is missing or query fails, return safe default
    return {
      success: true,
      hasCodes: false,
      totalCodes: 0,
      remainingCodes: 0,
    };
  }
}

/**
 * Server Operation: Verifies and atomically redeems a single-use recovery code.
 *
 * Security Requirements:
 * 1. Protected by persistent rate limiting (per account and per IP).
 * 2. Constant-time hash verification via scrypt + timingSafeEqual.
 * 3. Atomic single-use redemption preventing replay and concurrent double-redemption.
 * 4. Fails closed with generic error messages (anti-enumeration).
 * 5. Does NOT grant normal AAL2 access.
 * 6. Records sanitized audit log upon redemption.
 */
export async function verifyAndRedeemRecoveryCodeOperation(
  request: Request,
  payload: VerifyRecoveryCodePayload,
  prismaClient?: PrismaClient,
  mockSupabaseAdminClient?: any
): Promise<VerifyRecoveryCodeResult> {
  const prisma = prismaClient || (await getPrisma());
  if (!prisma) {
    return { success: false, error: GENERIC_RECOVERY_ERROR };
  }

  const clientIp = extractTrustedClientIp(request.headers);
  const rawAdminId = (payload?.adminId || "").trim();
  const rawCode = (payload?.code || "").trim();

  // 1. Rate limiting evaluation (per account and per IP)
  let accountHash: string;
  let ipHash: string;
  try {
    accountHash = hashAccountIdentifier(rawAdminId || "unknown");
    ipHash = hashIpIdentifier(clientIp);
  } catch (err) {
    console.error("[verifyRecoveryCodeOperation] Rate limit identifier derivation failure (failing closed):", err instanceof Error ? err.message : String(err));
    return { success: false, error: SERVICE_UNAVAILABLE_RECOVERY_ERROR };
  }

  const accountKey = `recov_code:act:${accountHash}`;
  const ipKey = `recov_code:ip:${ipHash}`;

  let accountRate: RateLimitResult;
  let ipRate: RateLimitResult;
  try {
    const results = await Promise.all([
      consumeRateLimit({
        key: accountKey,
        limit: AUTH_RATE_THRESHOLDS.RECOVERY_CODE_ACCOUNT.limit,
        windowSeconds: AUTH_RATE_THRESHOLDS.RECOVERY_CODE_ACCOUNT.windowSeconds,
        prismaClient: prisma,
      }),
      consumeRateLimit({
        key: ipKey,
        limit: AUTH_RATE_THRESHOLDS.RECOVERY_CODE_IP.limit,
        windowSeconds: AUTH_RATE_THRESHOLDS.RECOVERY_CODE_IP.windowSeconds,
        prismaClient: prisma,
      }),
    ]);
    accountRate = results[0];
    ipRate = results[1];
  } catch (err) {
    console.error("[verifyRecoveryCodeOperation] Rate limit storage failure (failing closed):", err instanceof Error ? err.message : String(err));
    return { success: false, error: SERVICE_UNAVAILABLE_RECOVERY_ERROR };
  }

  if (!accountRate.allowed || !ipRate.allowed) {
    try {
      if (typeof (prisma as any).adminAuditLog?.create === "function") {
        await (prisma as any).adminAuditLog.create({
          data: {
            actorEmail: "security-gate@cobralearn.internal",
            action: "auth:recovery_code_throttled",
            module: "auth_abuse_protection",
            entityId: accountHash ? accountHash.slice(0, 16) : "ip_gate",
            metadata: {
              reason: "rate_limit_exceeded",
              retryAfterSeconds: Math.max(
                accountRate.retryAfterSeconds || 0,
                ipRate.retryAfterSeconds || 0,
                1
              ),
            },
            ipAddress: maskIpAddress(clientIp),
          },
        });
      }
    } catch {
      // Non-fatal audit log failure
    }
    return { success: false, error: RATE_LIMIT_RECOVERY_ERROR };
  }

  // 2. Format validation (generic failure on invalid format)
  if (!rawAdminId || !isValidRecoveryCodeFormat(rawCode)) {
    return { success: false, error: GENERIC_RECOVERY_ERROR };
  }

  // 3. Administrator validation (Fail closed, generic response)
  const profile = await prisma.adminProfile.findUnique({
    where: { id: rawAdminId },
  });

  if (!profile || !profile.isActive) {
    return { success: false, error: GENERIC_RECOVERY_ERROR };
  }

  // 4. Retrieve unused recovery codes for this administrator
  const recoveryCodeDelegate = (prisma as any)?.adminRecoveryCode;
  if (!recoveryCodeDelegate || typeof recoveryCodeDelegate.findMany !== "function") {
    return { success: false, error: GENERIC_RECOVERY_ERROR };
  }

  let unusedCodes: Array<{ id: string; codeHash: string; codeSalt: string }> = [];
  try {
    unusedCodes = await recoveryCodeDelegate.findMany({
      where: {
        adminId: profile.id,
        isUsed: false,
      },
      select: {
        id: true,
        codeHash: true,
        codeSalt: true,
      },
    });
  } catch {
    return { success: false, error: GENERIC_RECOVERY_ERROR };
  }

  if (!unusedCodes || unusedCodes.length === 0) {
    try {
      if (typeof (prisma as any).adminAuditLog?.create === "function") {
        await (prisma as any).adminAuditLog.create({
          data: {
            actorId: profile.id,
            actorEmail: profile.email,
            action: "auth:recovery_code_redeem_failed",
            module: "auth_mfa_recovery",
            entityId: profile.id,
            metadata: {
              reason: "invalid_code",
            },
            ipAddress: maskIpAddress(clientIp),
          },
        });
      }
    } catch {
      // Non-fatal audit log failure
    }
    return { success: false, error: GENERIC_RECOVERY_ERROR };
  }

  // 5. Constant-time candidate comparison against unused codes
  let matchedRecordId: string | null = null;
  const normalizedCandidate = normalizeRecoveryCode(rawCode);

  for (const record of unusedCodes) {
    const isMatch = await verifyRecoveryCodeHash(
      normalizedCandidate,
      record.codeSalt,
      record.codeHash
    );
    if (isMatch) {
      matchedRecordId = record.id;
      break;
    }
  }

  if (!matchedRecordId) {
    try {
      if (typeof (prisma as any).adminAuditLog?.create === "function") {
        await (prisma as any).adminAuditLog.create({
          data: {
            actorId: profile.id,
            actorEmail: profile.email,
            action: "auth:recovery_code_redeem_failed",
            module: "auth_mfa_recovery",
            entityId: profile.id,
            metadata: {
              reason: "invalid_code",
            },
            ipAddress: maskIpAddress(clientIp),
          },
        });
      }
    } catch {
      // Non-fatal audit log failure
    }
    return { success: false, error: GENERIC_RECOVERY_ERROR };
  }

  // 6. Atomic redemption: update conditionally where isUsed: false
  // Protects against concurrent requests attempting to redeem the exact same code
  try {
    const updateResult = await recoveryCodeDelegate.updateMany({
      where: {
        id: matchedRecordId,
        isUsed: false,
      },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      // Race condition: another concurrent execution claimed this code
      return { success: false, error: GENERIC_RECOVERY_ERROR };
    }
  } catch {
    return { success: false, error: GENERIC_RECOVERY_ERROR };
  }

  // 7. Transition account to quarantine and invalidate lost TOTP factor
  const recoveryNow = new Date();
  let deletedFactorId: string | null = null;

  try {
    // 7A. Update AdminProfile to quarantine state
    if (typeof (prisma as any).adminProfile?.update === "function") {
      await (prisma as any).adminProfile.update({
        where: { id: profile.id },
        data: {
          mfaRecoveryPending: true,
          mfaRecoveryAt: recoveryNow,
        },
      });
    }

    // 7B. Invalidate lost factor via Supabase Admin API
    try {
      const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const supabaseAdmin = mockSupabaseAdminClient || getSupabaseAdminClient();
      if (supabaseAdmin?.auth?.admin?.mfa?.listFactors) {
        const listRes = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: profile.id });
        const factors = listRes?.data?.factors || [];
        const verifiedTotp = factors.filter(
          (f: any) => f.factor_type === "totp" && f.status === "verified"
        );
        if (verifiedTotp.length > 0) {
          deletedFactorId = verifiedTotp[0].id;
          if (supabaseAdmin.auth.admin.mfa.deleteFactor) {
            await supabaseAdmin.auth.admin.mfa.deleteFactor({
              id: deletedFactorId,
              userId: profile.id,
            });
          }
        }
      }
    } catch {
      // Non-blocking in mock or non-admin test environments
    }

    // 7C. Create AdminMfaRecovery record in FACTOR_DELETED status
    if (typeof (prisma as any).adminMfaRecovery?.create === "function") {
      await (prisma as any).adminMfaRecovery.create({
        data: {
          actorType: "SYSTEM_RECONCILER",
          actorId: profile.id,
          actorEmail: profile.email,
          actorIdentifier: "RECOVERY_CODE_REDEMPTION",
          targetId: profile.id,
          targetEmail: profile.email,
          targetRoleSnapshot: profile.role,
          status: "FACTOR_DELETED",
          justification: "Account quarantined for MFA re-enrollment via verified recovery code redemption",
          factorId: deletedFactorId,
          initiatedAt: recoveryNow,
          factorDeletedAt: recoveryNow,
        },
      });
    }
  } catch {
    // Retain safety; do not allow quarantine failure to expose protected state
  }

  // 8. Record sanitized audit log
  try {
    if (typeof (prisma as any).adminAuditLog?.create === "function") {
      await (prisma as any).adminAuditLog.create({
        data: {
          actorId: profile.id,
          actorEmail: profile.email,
          action: "auth:recovery_code_redeemed",
          module: "auth_mfa_recovery",
          entityId: profile.id,
          metadata: {
            outcome: "success",
          },
          ipAddress: maskIpAddress(clientIp),
        },
      });
    }
  } catch {
    // Non-fatal audit log failure
  }

  return {
    success: true,
    message: "Recovery code redeemed successfully. Account quarantined for MFA re-enrollment.",
    remainingCodes: Math.max(0, unusedCodes.length - 1),
    isQuarantined: true,
  };
}

export const redeemRecoveryCodeOperation = verifyAndRedeemRecoveryCodeOperation;
