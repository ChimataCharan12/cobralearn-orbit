import type { PrismaClient } from "@prisma/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface ProvisionCliArgs {
  id?: string | undefined;
  email?: string | undefined;
  name?: string | undefined;
  dryRun?: boolean | undefined;
  apply?: boolean | undefined;
  help?: boolean | undefined;
}

export interface ProvisionOptions {
  id: string;
  email: string;
  name: string;
  mode: "dry-run" | "apply";
}

export interface ProvisionResult {
  success: boolean;
  mode: "dry-run" | "apply";
  isNoOp?: boolean | undefined;
  error?: string | undefined;
  message?: string | undefined;
  data?:
    | {
        id: string;
        email: string;
        name: string;
        role: "SUPER_ADMIN";
        isActive: boolean;
      }
    | undefined;
}

export interface ProvisionDependencies {
  prisma: PrismaClient;
  getSupabaseAdminUser: (id: string) => Promise<{ user: User | null; error: Error | null }>;
  log: (message: string) => void;
  errorLog: (message: string) => void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parses raw command-line arguments for admin provisioning.
 */
export function parseProvisionCliArgs(argv: string[]): ProvisionCliArgs {
  const args: ProvisionCliArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--apply") {
      args.apply = true;
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
    } else if (arg.startsWith("--name=")) {
      args.name = arg.substring(7).trim();
    } else if (arg === "--name" || arg === "-n") {
      const nextArg = argv[++i];
      if (nextArg) args.name = nextArg.trim();
    } else if (arg.startsWith("-")) {
      throw new Error(`Unrecognized or unsupported argument: ${arg}`);
    }
  }

  return args;
}

/**
 * Validates parsed CLI arguments and normalizes inputs.
 */
export function validateProvisionArgs(args: ProvisionCliArgs): ProvisionOptions {
  if (args.dryRun && args.apply) {
    throw new Error("Conflicting flags: Cannot specify both --dry-run and --apply simultaneously.");
  }

  if (!args.id) {
    throw new Error("Missing required argument: --id=<SUPABASE_AUTH_UUID>");
  }

  if (!UUID_REGEX.test(args.id)) {
    throw new Error(`Invalid UUID format: "${args.id}". Must be a valid 36-character UUID.`);
  }

  if (!args.email) {
    throw new Error("Missing required argument: --email=<ADMIN_EMAIL>");
  }

  const normalizedEmail = args.email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error(`Invalid email address: "${args.email}".`);
  }

  if (!args.name || args.name.trim().length === 0) {
    throw new Error("Missing required argument: --name=<FULL_NAME>");
  }

  const trimmedName = args.name.trim();
  if (trimmedName.length < 2) {
    throw new Error("Invalid name: Full name must be at least 2 characters.");
  }

  return {
    id: args.id.trim(),
    email: normalizedEmail,
    name: trimmedName,
    mode: args.apply ? "apply" : "dry-run", // Dry-run by default
  };
}

/**
 * Redacts sensitive credentials or tokens from error messages.
 */
export function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgresql:\/\/[^@]+@/g, "postgresql://***:***@")
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/sbp_[a-zA-Z0-9]+/g, "[REDACTED_KEY]");
}

/**
 * Core business logic for provisioning the first AdminProfile.
 */
export async function provisionAdminProfile(
  options: ProvisionOptions,
  deps: ProvisionDependencies,
): Promise<ProvisionResult> {
  const { id, email, name, mode } = options;
  const { prisma, getSupabaseAdminUser, log } = deps;

  log(`\n============================================================`);
  log(`COBRALEARN INITIAL ADMIN PROVISIONING TOOL`);
  log(`Mode: ${mode.toUpperCase()} (Write: ${mode === "apply" ? "ENABLED" : "DISABLED"})`);
  log(`============================================================`);
  log(`Target Auth UUID : ${id}`);
  log(`Target Email     : ${email}`);
  log(`Target Full Name : ${name}`);
  log(`Target Role      : SUPER_ADMIN`);
  log(`------------------------------------------------------------`);

  // Step 1: Verify user in Supabase Auth Admin API
  log(`[Step 1/3] Verifying user identity in Supabase Auth...`);
  const { user: authUser, error: authError } = await getSupabaseAdminUser(id);

  if (authError || !authUser) {
    const errorMsg = `Auth identity check failed: Supabase Auth user with UUID "${id}" was not found or Admin API returned an error (${authError ? sanitizeErrorMessage(authError) : "User not found"}).`;
    return {
      success: false,
      mode,
      error: errorMsg,
    };
  }

  const authEmail = (authUser.email || "").trim().toLowerCase();
  if (authEmail !== email) {
    const errorMsg = `Identity mismatch: Supabase Auth user's email (${authEmail || "none"}) does not match the supplied email (${email}).`;
    return {
      success: false,
      mode,
      error: errorMsg,
    };
  }

  log(`✓ Identity verified: Supabase Auth user exists and email matches.`);

  // Step 2: Check database preconditions in PostgreSQL
  log(`[Step 2/3] Checking database conflict and singleton conditions...`);

  const [profileById, profileByEmail, existingSuperAdmin] = await Promise.all([
    prisma.adminProfile.findUnique({ where: { id } }),
    prisma.adminProfile.findUnique({ where: { email } }),
    prisma.adminProfile.findFirst({ where: { role: "SUPER_ADMIN" } }),
  ]);

  // Check 2a: Existing profile with exact same UUID
  if (profileById) {
    const isMatchingActiveSuperAdmin =
      profileById.email.toLowerCase() === email &&
      profileById.role === "SUPER_ADMIN" &&
      profileById.isActive === true;

    if (isMatchingActiveSuperAdmin) {
      log(`✓ Idempotent state detected: Matching active SUPER_ADMIN profile already exists.`);
      return {
        success: true,
        mode,
        isNoOp: true,
        message: `AdminProfile already exists for UUID "${id}" with matching email, role (SUPER_ADMIN), and active status. No database changes required.`,
        data: {
          id: profileById.id,
          email: profileById.email,
          name: profileById.fullName,
          role: "SUPER_ADMIN",
          isActive: true,
        },
      };
    }

    // Conflicting details on same UUID
    const errorMsg = `Conflicting record: An AdminProfile with UUID "${id}" already exists with different attributes (Email: ${profileById.email}, Role: ${profileById.role}, Active: ${profileById.isActive}). Aborting to prevent unsafe overwrite.`;
    return {
      success: false,
      mode,
      error: errorMsg,
    };
  }

  // Check 2b: Email belongs to a different UUID
  if (profileByEmail && profileByEmail.id !== id) {
    const errorMsg = `Conflicting record: Email "${email}" is already associated with another AdminProfile (UUID: "${profileByEmail.id}"). Aborting.`;
    return {
      success: false,
      mode,
      error: errorMsg,
    };
  }

  // Check 2c: Another Super Admin exists
  if (existingSuperAdmin && existingSuperAdmin.id !== id) {
    const errorMsg = `Initial Super Admin rule violated: Another SUPER_ADMIN already exists in the system (UUID: "${existingSuperAdmin.id}", Email: "${existingSuperAdmin.email}"). Only one initial Super Admin can be provisioned via this tool.`;
    return {
      success: false,
      mode,
      error: errorMsg,
    };
  }

  log(`✓ Database checks passed: No conflicts found. Zero existing Super Admins.`);

  // Step 3: Action Execution (Dry Run vs Apply)
  log(`[Step 3/3] Executing provisioning action...`);

  if (mode === "dry-run") {
    log(`------------------------------------------------------------`);
    log(`[DRY RUN SUMMARY]`);
    log(`All pre-provisioning checks PASSED.`);
    log(`NO database records were created or modified.`);
    log(`To execute the write operation, re-run with the --apply flag.`);
    log(`============================================================\n`);

    return {
      success: true,
      mode: "dry-run",
      isNoOp: false,
      message: `[DRY RUN] All validation and conflict checks passed successfully. No database writes were performed.`,
      data: {
        id,
        email,
        name,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    };
  }

  // Apply mode: Execute in isolated Prisma transaction
  try {
    const createdProfile = await prisma.$transaction(async (tx) => {
      // Recheck inside transaction to prevent race conditions
      const raceSuperAdmin = await tx.adminProfile.findFirst({ where: { role: "SUPER_ADMIN" } });
      if (raceSuperAdmin && raceSuperAdmin.id !== id) {
        throw new Error(
          `Concurrent provisioning detected: Another SUPER_ADMIN was created during transaction.`,
        );
      }

      const raceProfile = await tx.adminProfile.findUnique({ where: { id } });
      if (raceProfile) {
        throw new Error(
          `Concurrent provisioning detected: Profile with UUID "${id}" already exists.`,
        );
      }

      // Create AdminProfile
      const profile = await tx.adminProfile.create({
        data: {
          id,
          email,
          fullName: name,
          role: "SUPER_ADMIN",
          isActive: true,
        },
      });

      // Create initial audit log entry
      await tx.adminAuditLog.create({
        data: {
          actorId: id,
          actorEmail: email,
          action: "INITIAL_ADMIN_PROVISIONED",
          module: "AUTH_PROVISIONING",
          entityId: id,
          metadata: {
            role: "SUPER_ADMIN",
            provisionedVia: "CLI_SEED_TOOL",
            timestamp: new Date().toISOString(),
          },
        },
      });

      return profile;
    });

    log(`✓ AdminProfile successfully created in PostgreSQL!`);
    log(`✓ Audit log entry created.`);
    log(`============================================================\n`);

    return {
      success: true,
      mode: "apply",
      isNoOp: false,
      message: `AdminProfile successfully provisioned as SUPER_ADMIN.`,
      data: {
        id: createdProfile.id,
        email: createdProfile.email,
        name: createdProfile.fullName,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    };
  } catch (err) {
    const cleanError = sanitizeErrorMessage(err);
    return {
      success: false,
      mode: "apply",
      error: `Database transaction failed: ${cleanError}`,
    };
  }
}

/**
 * CLI Runner with dependency injection support.
 */
export async function runProvisionCli(
  argv: string[],
  customDeps?: Partial<ProvisionDependencies>,
): Promise<number> {
  const log = customDeps?.log || console.log;
  const errorLog = customDeps?.errorLog || console.error;

  try {
    const parsedArgs = parseProvisionCliArgs(argv);

    if (parsedArgs.help) {
      log(`
Usage:
  npm run seed:admin -- --id="<AUTH_UUID>" --email="<EMAIL>" --name="<NAME>" [--dry-run | --apply]

Options:
  --id, -i      Supabase Auth user UUID (Required, valid UUID)
  --email, -e   Administrator email address (Required, must match Supabase Auth)
  --name, -n    Administrator full name (Required, min 2 chars)
  --dry-run     Validate identity and database preconditions without writing (Default)
  --apply       Execute the database write transaction to create the AdminProfile
  --help, -h    Show this help message
      `);
      return 0;
    }

    const options = validateProvisionArgs(parsedArgs);

    let prisma = customDeps?.prisma;
    if (!prisma) {
      const { PrismaClient } = await import("@prisma/client");
      prisma = new PrismaClient();
    }

    let getSupabaseAdminUser = customDeps?.getSupabaseAdminUser;
    if (!getSupabaseAdminUser) {
      const { getSupabaseAdminClient } = await import("../supabase/admin.ts");
      getSupabaseAdminUser = async (userId: string) => {
        try {
          const adminClient: SupabaseClient = getSupabaseAdminClient();
          const { data, error } = await adminClient.auth.admin.getUserById(userId);
          if (error) return { user: null, error: new Error(error.message) };
          return { user: data.user, error: null };
        } catch (e) {
          return { user: null, error: e instanceof Error ? e : new Error(String(e)) };
        }
      };
    }

    const result = await provisionAdminProfile(options, {
      prisma,
      getSupabaseAdminUser,
      log,
      errorLog,
    });

    if (!result.success) {
      errorLog(`\n❌ PROVISIONING ERROR: ${result.error}`);
      return 1;
    }

    if (result.isNoOp) {
      log(`\nℹ️ NO-OP: ${result.message}`);
      return 0;
    }

    log(`\n✅ SUCCESS: ${result.message}`);
    return 0;
  } catch (err) {
    errorLog(`\n❌ FATAL ERROR: ${sanitizeErrorMessage(err)}`);
    return 1;
  }
}
