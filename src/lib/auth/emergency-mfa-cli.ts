import type { PrismaClient } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface EmergencyMfaCliArgs {
  id?: string;
  email?: string;
  reason?: string;
  environment?: string;
  dryRun?: boolean;
  apply?: boolean;
  reconcile?: boolean;
  help?: boolean;
}

export interface CliExecutionDependencies {
  prisma: PrismaClient;
  supabaseAdmin: SupabaseClient;
  log: (message: string) => void;
  errorLog: (message: string) => void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parses command-line arguments for emergency MFA reset CLI.
 */
export function parseEmergencyMfaCliArgs(argv: string[]): EmergencyMfaCliArgs {
  const args: EmergencyMfaCliArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--reconcile") {
      args.reconcile = true;
    } else if (arg.startsWith("--id=")) {
      args.id = arg.substring(5).trim();
    } else if (arg === "--id" || arg === "-i") {
      const nextArg = argv[++i];
      if (nextArg) args.id = nextArg.trim();
    } else if (arg.startsWith("--email=")) {
      args.email = arg.substring(8).trim();
    } else if (arg === "--email" || arg === "-e") {
      const nextArg = argv[++i];
      if (nextArg) args.email = nextArg.trim();
    } else if (arg.startsWith("--reason=")) {
      args.reason = arg.substring(9).trim();
    } else if (arg === "--reason" || arg === "-r") {
      const nextArg = argv[++i];
      if (nextArg) args.reason = nextArg.trim();
    } else if (arg.startsWith("--environment=")) {
      args.environment = arg.substring(14).trim();
    } else if (arg === "--environment" || arg === "-env") {
      const nextArg = argv[++i];
      if (nextArg) args.environment = nextArg.trim();
    } else if (arg.startsWith("-")) {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
  }

  return args;
}

/**
 * Executes break-glass CLI recovery workflow.
 * Defaults to dry-run unless --apply is explicitly specified.
 */
export async function executeEmergencyMfaCli(
  args: EmergencyMfaCliArgs,
  deps: CliExecutionDependencies
): Promise<{ success: boolean; exitCode: number; message: string }> {
  const { prisma, supabaseAdmin, log, errorLog } = deps;

  if (args.help) {
    log(`
CobraLearn Orbit — Host Break-Glass Emergency MFA Recovery CLI

Usage:
  Dry run (default):
    node --env-file=.env --experimental-strip-types scripts/emergency-mfa-reset.ts --id="<UUID>" --email="<EMAIL>"

  Apply changes:
    node --env-file=.env --experimental-strip-types scripts/emergency-mfa-reset.ts --id="<UUID>" --email="<EMAIL>" --reason="<JUSTIFICATION>" --environment="<EXPECTED_ENV>" --apply

Options:
  --id, -i           Target administrator UUID (required)
  --email, -e        Expected administrator email address (required)
  --reason, -r       Mandatory security justification (required for --apply, min 10 chars)
  --environment      Target deployment environment (e.g., development, production, test)
  --apply            Execute factor deletion and place target in recovery quarantine
  --dry-run          Inspect state without modifying PostgreSQL or Supabase Auth (default)
  --help, -h         Show this help message
`);
    return { success: true, exitCode: 0, message: "Help displayed" };
  }

  // 1. Validate Target UUID
  if (!args.id || !UUID_REGEX.test(args.id)) {
    errorLog("ERROR: A valid target administrator UUID (--id) is required.");
    return { success: false, exitCode: 1, message: "Invalid target UUID" };
  }

  // 2. Validate Expected Email
  const expectedEmail = (args.email || "").trim().toLowerCase();
  if (!expectedEmail || !EMAIL_REGEX.test(expectedEmail)) {
    errorLog("ERROR: A valid expected target email address (--email) is required.");
    return { success: false, exitCode: 1, message: "Invalid target email" };
  }

  // 3. Inspect PostgreSQL AdminProfile
  const profile = await prisma.adminProfile.findUnique({
    where: { id: args.id },
  });

  if (!profile) {
    errorLog(`ERROR: Administrator profile with ID "${args.id}" not found in PostgreSQL.`);
    return { success: false, exitCode: 1, message: "Target profile not found" };
  }

  // 4. Verify Role: Host break-glass CLI is specifically for SUPER_ADMIN recovery
  if (profile.role !== "SUPER_ADMIN") {
    errorLog(
      `ERROR: Target role is "${profile.role}". Host break-glass CLI is reserved for SUPER_ADMIN accounts. Use Web Peer Recovery for ADMIN or EDITOR.`
    );
    return { success: false, exitCode: 1, message: "Target role not SUPER_ADMIN" };
  }

  // 5. Verify Active Status
  if (!profile.isActive) {
    errorLog("ERROR: Target administrator profile is deactivated.");
    return { success: false, exitCode: 1, message: "Target profile deactivated" };
  }

  // 6. Verify Email Match
  if (profile.email.toLowerCase() !== expectedEmail) {
    errorLog(
      `ERROR: Provided email does not match PostgreSQL record (Expected: ${profile.email.toLowerCase()}, Provided: ${expectedEmail}).`
    );
    return { success: false, exitCode: 1, message: "Email mismatch" };
  }

  // 7. Inspect Supabase Auth User
  let authUser: any = null;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(args.id);
    if (error || !data.user) {
      errorLog(`ERROR: Failed to retrieve user from Supabase Auth: ${error?.message || "User not found"}`);
      return { success: false, exitCode: 1, message: "Supabase user lookup failed" };
    }
    authUser = data.user;
  } catch (err: any) {
    errorLog(`ERROR: Supabase Auth connection failed: ${err.message}`);
    return { success: false, exitCode: 1, message: "Supabase connection error" };
  }

  // Verify email consistency between Supabase Auth and PostgreSQL
  if (authUser.email?.toLowerCase() !== expectedEmail) {
    errorLog(
      `ERROR: Supabase Auth email (${authUser.email?.toLowerCase()}) does not match expected email (${expectedEmail}).`
    );
    return { success: false, exitCode: 1, message: "Supabase email mismatch" };
  }

  // 8. Inspect Enrolled Factors
  let factors: any[] = [];
  try {
    const listRes = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: args.id });
    if (listRes.error) {
      errorLog(`ERROR: Failed to list factors from Supabase Auth: ${listRes.error.message}`);
      return { success: false, exitCode: 1, message: "List factors error" };
    }
    factors = listRes.data?.factors || [];
  } catch (err: any) {
    errorLog(`ERROR: Failed to list factors from Supabase Auth: ${err.message}`);
    return { success: false, exitCode: 1, message: "List factors exception" };
  }

  const verifiedTotp = factors.filter((f) => f.factor_type === "totp" && f.status === "verified");

  // 9. Handle Dry-Run Mode (Default)
  const isApply = Boolean(args.apply);

  if (!isApply) {
    log("==================================================================");
    log("  COBRALEARN ORBIT — EMERGENCY MFA RECOVERY [DRY-RUN INSPECTION]  ");
    log("==================================================================");
    log(`Target ID:            ${profile.id}`);
    log(`Target Email:         ${profile.email}`);
    log(`Target Role:          ${profile.role}`);
    log(`Target Active:        ${profile.isActive}`);
    log(`Current Quarantine:   ${profile.mfaRecoveryPending ? "YES (Active)" : "NO"}`);
    log(`Total MFA Factors:    ${factors.length}`);
    log(`Verified TOTP Count:  ${verifiedTotp.length}`);

    if (verifiedTotp.length > 0) {
      verifiedTotp.forEach((f, idx) => {
        log(`  [${idx + 1}] Factor ID: ${f.id} (${f.friendly_name || "totp"}) - Status: ${f.status}`);
      });
      log(`Action on --apply:   Delete verified TOTP factor [${verifiedTotp[0].id}] and quarantine profile.`);
    } else {
      log("  Notice: Target has no verified TOTP factor enrolled.");
    }

    log("------------------------------------------------------------------");
    log("[DRY-RUN] No changes were made to PostgreSQL or Supabase Auth.");
    log("To execute recovery, pass --apply with mandatory --reason and --environment.");
    log("==================================================================");
    return { success: true, exitCode: 0, message: "Dry-run inspection complete" };
  }

  // 10. Execution Mode (--apply): Validate Apply Prerequisites
  const reason = (args.reason || "").trim();
  if (reason.length < 10) {
    errorLog("ERROR: A meaningful justification (--reason) of at least 10 characters is required for --apply.");
    return { success: false, exitCode: 1, message: "Justification too short" };
  }

  if (!args.environment || args.environment.trim().length === 0) {
    errorLog("ERROR: Environment confirmation (--environment) is required for --apply.");
    return { success: false, exitCode: 1, message: "Missing environment confirmation" };
  }

  if (verifiedTotp.length === 0) {
    errorLog("ERROR: Target has no verified TOTP factor to reset.");
    return { success: false, exitCode: 1, message: "No verified TOTP factor" };
  }

  if (profile.mfaRecoveryPending) {
    errorLog("ERROR: Target administrator is already in active emergency recovery quarantine.");
    return { success: false, exitCode: 1, message: "Already in recovery" };
  }

  const factorToDelete = verifiedTotp[0];
  const now = new Date();

  // 11. Concurrency-safe intent and quarantine persistence before mutation
  log("Persisting recovery intent and establishing PostgreSQL quarantine...");
  let recovery: any;
  try {
    recovery = await prisma.$transaction(async (tx: any) => {
      const updateRes = await tx.adminProfile.updateMany({
        where: {
          id: profile.id,
          mfaRecoveryPending: false,
          isActive: true,
        },
        data: {
          mfaRecoveryPending: true,
          mfaRecoveryAt: now,
        },
      });

      if (updateRes.count === 0) {
        throw new Error("Conflict: Target administrator already has an active emergency recovery in progress or is inactive");
      }

      const rec = await tx.adminMfaRecovery.create({
        data: {
          actorType: "HOST_CLI_BREAK_GLASS",
          actorId: null,
          actorEmail: "host-cli@system.internal",
          actorIdentifier: `host-operator-cli:${args.environment}`,
          targetId: profile.id,
          targetEmail: profile.email,
          targetRoleSnapshot: profile.role,
          justification: `[CLI Break-Glass Env: ${args.environment}] ${reason}`,
          status: "PENDING",
          initiatedAt: now,
          reconciliationNotes: "Initiated via Host CLI Break-Glass",
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: null,
          actorEmail: "host-cli@system.internal",
          action: "CLI_BREAK_GLASS_MFA_RECOVERY_REQUESTED",
          module: "SECURITY_RECOVERY",
          entityId: profile.id,
          metadata: {
            recoveryId: rec.id,
            actorIdentifier: `host-operator-cli:${args.environment}`,
            targetEmail: profile.email,
            targetRole: profile.role,
            environment: args.environment,
            justification: reason,
            factorId: factorToDelete.id,
            initiatedAt: now.toISOString(),
          },
        },
      });

      return rec;
    });
  } catch (err: any) {
    if (
      err?.code === "P2002" ||
      err?.message?.includes("unique_active_admin_mfa_recovery") ||
      err?.message?.includes("Unique constraint failed") ||
      err?.message?.includes("already has an active emergency recovery")
    ) {
      errorLog("ERROR: Target administrator is already in active emergency recovery quarantine.");
      return { success: false, exitCode: 1, message: "Already in recovery" };
    }
    errorLog(`ERROR: Failed to acquire recovery quarantine: ${err?.message || "Database error"}`);
    return { success: false, exitCode: 1, message: err?.message || "Database error" };
  }

  // 12. Delete verified TOTP factor
  log(`Deleting verified factor [${factorToDelete.id}] via Supabase Auth Admin API...`);
  let deleteRes: any = null;
  let deleteThrown: any = null;

  try {
    deleteRes = await supabaseAdmin.auth.admin.mfa.deleteFactor({
      id: factorToDelete.id,
      userId: profile.id,
    });
  } catch (err: any) {
    deleteThrown = err;
  }

  if (deleteThrown || (deleteRes && deleteRes.error)) {
    // Recheck if factor remains intact
    let recheckRes: any = null;
    try {
      recheckRes = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: profile.id });
    } catch {
      // Recheck failed
    }

    const intactFactor = recheckRes?.data?.factors?.find((f: any) => f.id === factorToDelete.id);

    if (intactFactor) {
      errorLog("ERROR: Factor deletion failed and factor remains intact. Releasing quarantine.");
      await prisma.adminMfaRecovery.update({
        where: { id: recovery.id },
        data: {
          status: "FAILED",
          failureCategory: "DELETION_FAILED_FACTOR_INTACT",
          failureReason: deleteThrown?.message || deleteRes?.error?.message || "CLI deletion failed; factor intact",
        },
      });
      await prisma.adminProfile.update({
        where: { id: profile.id },
        data: { mfaRecoveryPending: false, mfaRecoveryAt: null },
      });
      return { success: false, exitCode: 1, message: "Deletion failed, factor intact" };
    } else {
      errorLog(
        "WARNING: Factor deletion outcome is ambiguous. Administrator remains quarantined; reconciliation required."
      );
      await prisma.adminMfaRecovery.update({
        where: { id: recovery.id },
        data: {
          status: "RECONCILIATION_REQUIRED",
          factorId: factorToDelete.id,
          failureCategory: "AMBIGUOUS_DELETION_OUTCOME",
          failureReason: deleteThrown?.message || deleteRes?.error?.message || "CLI ambiguous deletion outcome",
        },
      });
      return { success: false, exitCode: 1, message: "Ambiguous deletion outcome" };
    }
  }

  // 13. Confirmed factor deletion: record factor-deleted status
  const factorDeletedAt = new Date();
  try {
    await prisma.adminMfaRecovery.update({
      where: { id: recovery.id },
      data: {
        status: "FACTOR_DELETED",
        factorId: factorToDelete.id,
        factorDeletedAt,
      },
    });
  } catch (postDelErr: any) {
    errorLog(`WARNING: Supabase factor was deleted but database update failed: ${postDelErr?.message || postDelErr}`);
    try {
      await prisma.adminMfaRecovery.update({
        where: { id: recovery.id },
        data: {
          status: "RECONCILIATION_REQUIRED",
          factorId: factorToDelete.id,
          reconciliationNotes: `Post-deletion DB update failed: ${postDelErr?.message || "Unknown error"}. Quarantine preserved.`,
        },
      });
    } catch {
      // Quarantine remains preserved in AdminProfile
    }
  }

  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: null,
        actorEmail: "host-cli@system.internal",
        action: "CLI_BREAK_GLASS_MFA_FACTOR_DELETED",
        module: "SECURITY_RECOVERY",
        entityId: profile.id,
        metadata: {
          recoveryId: recovery.id,
          actorIdentifier: `host-operator-cli:${args.environment}`,
          factorId: factorToDelete.id,
          factorDeletedAt: factorDeletedAt.toISOString(),
        },
      },
    });
  } catch {
    // Post-deletion audit log failure must not release quarantine
  }

  log("==================================================================");
  log("  COBRALEARN ORBIT — EMERGENCY MFA RECOVERY [APPLY SUCCESSFUL]    ");
  log("==================================================================");
  log(`Recovery Operation ID: ${recovery.id}`);
  log(`Target Account:        ${profile.email} (${profile.id})`);
  log(`Deleted Factor ID:     ${factorToDelete.id}`);
  log("Quarantine Status:     ACTIVE (mfaRecoveryPending = true)");
  log("------------------------------------------------------------------");
  log("NEXT STEP: The administrator must log in and re-enroll MFA at /admin/profile.");
  log("General administration routes remain restricted until re-enrollment is verified.");
  log("==================================================================");

  return { success: true, exitCode: 0, message: "Emergency recovery applied successfully" };
}

/**
 * CLI execution entrypoint for scripts/emergency-mfa-reset.ts
 */
export async function runEmergencyMfaCli(argv: string[]): Promise<number> {
  const args = parseEmergencyMfaCliArgs(argv);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const { getSupabaseAdminClient } = await import("../supabase/admin.ts");
  const supabaseAdmin = getSupabaseAdminClient();

  try {
    const result = await executeEmergencyMfaCli(args, {
      prisma,
      supabaseAdmin,
      log: console.log,
      errorLog: console.error,
    });
    return result.exitCode;
  } finally {
    await prisma.$disconnect();
  }
}
