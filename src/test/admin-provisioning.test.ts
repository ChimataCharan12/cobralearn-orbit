import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseProvisionCliArgs,
  validateProvisionArgs,
  provisionAdminProfile,
  runProvisionCli,
  sanitizeErrorMessage,
  type ProvisionDependencies,
} from "@/lib/auth/admin-provisioning";
import type { PrismaClient } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

describe("Admin Provisioning CLI & Core Architecture", () => {
  const validUuid = "a1b2c3d4-e5f6-4a1b-8c2d-123456789abc";
  const validEmail = "master.admin@cobralearn.com";
  const validName = "Master Administrator";

  let mockPrisma: {
    adminProfile: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    adminAuditLog: {
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let mockGetSupabaseAdminUser: ReturnType<
    typeof vi.fn<(id: string) => Promise<{ user: User | null; error: Error | null }>>
  >;
  let logs: string[];
  let errorLogs: string[];
  let deps: ProvisionDependencies;

  beforeEach(() => {
    logs = [];
    errorLogs = [];

    mockPrisma = {
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
      $transaction: vi.fn(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    mockGetSupabaseAdminUser = vi.fn().mockResolvedValue({
      user: {
        id: validUuid,
        email: validEmail,
      } as User,
      error: null,
    });

    deps = {
      prisma: mockPrisma as unknown as PrismaClient,
      getSupabaseAdminUser: mockGetSupabaseAdminUser,
      log: (msg: string) => logs.push(msg),
      errorLog: (msg: string) => errorLogs.push(msg),
    };
  });

  // 1. Dry-run performs no writes
  it("Requirement 1: Dry-run performs no writes and reports preview summary", async () => {
    const options = {
      id: validUuid,
      email: validEmail,
      name: validName,
      mode: "dry-run" as const,
    };

    const result = await provisionAdminProfile(options, deps);

    expect(result.success).toBe(true);
    expect(result.mode).toBe("dry-run");
    expect(result.isNoOp).toBe(false);
    expect(result.message).toContain("[DRY RUN]");
    expect(mockPrisma.adminProfile.create).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes("NO database records were created or modified"))).toBe(true);
  });

  // 2. Missing arguments are rejected
  it("Requirement 2: Missing required arguments (id, email, name) are rejected", () => {
    expect(() => validateProvisionArgs({})).toThrow("Missing required argument: --id=");
    expect(() => validateProvisionArgs({ id: validUuid })).toThrow(
      "Missing required argument: --email=",
    );
    expect(() => validateProvisionArgs({ id: validUuid, email: validEmail })).toThrow(
      "Missing required argument: --name=",
    );
    expect(() => validateProvisionArgs({ id: validUuid, email: validEmail, name: "   " })).toThrow(
      "Missing required argument: --name=",
    );
  });

  // 3. Invalid UUID/email/name is rejected
  it("Requirement 3: Invalid UUID, malformed email, or short name is rejected", () => {
    expect(() =>
      validateProvisionArgs({ id: "invalid-uuid", email: validEmail, name: validName }),
    ).toThrow("Invalid UUID format");
    expect(() =>
      validateProvisionArgs({ id: validUuid, email: "invalid-email", name: validName }),
    ).toThrow("Invalid email address");
    expect(() => validateProvisionArgs({ id: validUuid, email: validEmail, name: "A" })).toThrow(
      "Full name must be at least 2 characters",
    );
  });

  // 4. Auth user does not exist
  it("Requirement 4: Fails closed when Supabase Auth user does not exist", async () => {
    mockGetSupabaseAdminUser.mockResolvedValue({ user: null, error: null });

    const result = await provisionAdminProfile(
      { id: validUuid, email: validEmail, name: validName, mode: "dry-run" },
      deps,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("was not found");
    expect(mockPrisma.adminProfile.findUnique).not.toHaveBeenCalled();
  });

  // 5. Auth email and supplied email do not match
  it("Requirement 5: Fails closed when Supabase Auth user email does not match supplied email", async () => {
    mockGetSupabaseAdminUser.mockResolvedValue({
      user: { id: validUuid, email: "different@cobralearn.com" } as User,
      error: null,
    });

    const result = await provisionAdminProfile(
      { id: validUuid, email: validEmail, name: validName, mode: "dry-run" },
      deps,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Identity mismatch");
  });

  // 6. Auth Admin API failure
  it("Requirement 6: Fails safely when Supabase Auth Admin API throws or returns an error", async () => {
    mockGetSupabaseAdminUser.mockResolvedValue({
      user: null,
      error: new Error("Network connection timeout to Supabase API"),
    });

    const result = await provisionAdminProfile(
      { id: validUuid, email: validEmail, name: validName, mode: "dry-run" },
      deps,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network connection timeout to Supabase API");
  });

  // 7. Existing matching active Super Admin returns a no-op
  it("Requirement 7: Existing matching active Super Admin returns a safe idempotent no-op", async () => {
    mockPrisma.adminProfile.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id === validUuid || where.email === validEmail) {
          return Promise.resolve({
            id: validUuid,
            email: validEmail,
            fullName: validName,
            role: "SUPER_ADMIN",
            isActive: true,
          });
        }
        return Promise.resolve(null);
      },
    );

    const result = await provisionAdminProfile(
      { id: validUuid, email: validEmail, name: validName, mode: "dry-run" },
      deps,
    );

    expect(result.success).toBe(true);
    expect(result.isNoOp).toBe(true);
    expect(result.message).toContain("AdminProfile already exists");
    expect(mockPrisma.adminProfile.create).not.toHaveBeenCalled();
  });

  // 8. Existing UUID with conflicting details aborts
  it("Requirement 8: Existing UUID with conflicting email or role aborts without overwrite", async () => {
    mockPrisma.adminProfile.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id === validUuid) {
          return Promise.resolve({
            id: validUuid,
            email: "old.email@cobralearn.com",
            fullName: "Old Name",
            role: "EDITOR",
            isActive: false,
          });
        }
        return Promise.resolve(null);
      },
    );

    const result = await provisionAdminProfile(
      { id: validUuid, email: validEmail, name: validName, mode: "dry-run" },
      deps,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Conflicting record: An AdminProfile with UUID");
  });

  // 9. Email already belongs to another UUID
  it("Requirement 9: Email already associated with a different UUID aborts", async () => {
    mockPrisma.adminProfile.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id === validUuid) return Promise.resolve(null);
        if (where.email === validEmail) {
          return Promise.resolve({
            id: "99999999-9999-4999-8999-999999999999",
            email: validEmail,
            role: "EDITOR",
            isActive: true,
          });
        }
        return Promise.resolve(null);
      },
    );

    const result = await provisionAdminProfile(
      { id: validUuid, email: validEmail, name: validName, mode: "dry-run" },
      deps,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      'Email "master.admin@cobralearn.com" is already associated with another AdminProfile',
    );
  });

  // 10. A different Super Admin already exists
  it("Requirement 10: Another existing Super Admin aborts execution", async () => {
    mockPrisma.adminProfile.findFirst.mockResolvedValue({
      id: "88888888-8888-4888-8888-888888888888",
      email: "existing.super@cobralearn.com",
      role: "SUPER_ADMIN",
      isActive: true,
    });

    const result = await provisionAdminProfile(
      { id: validUuid, email: validEmail, name: validName, mode: "dry-run" },
      deps,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      "Initial Super Admin rule violated: Another SUPER_ADMIN already exists",
    );
  });

  // 11. Successful creation through the mocked apply path
  it("Requirement 11: Successful creation through mocked apply mode creates profile and audit log", async () => {
    mockPrisma.adminProfile.create.mockResolvedValue({
      id: validUuid,
      email: validEmail,
      fullName: validName,
      role: "SUPER_ADMIN",
      isActive: true,
    });

    const result = await provisionAdminProfile(
      { id: validUuid, email: validEmail, name: validName, mode: "apply" },
      deps,
    );

    expect(result.success).toBe(true);
    expect(result.mode).toBe("apply");
    expect(result.data?.role).toBe("SUPER_ADMIN");
    expect(result.data?.isActive).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.adminProfile.create).toHaveBeenCalledWith({
      data: {
        id: validUuid,
        email: validEmail,
        fullName: validName,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: validUuid,
          actorEmail: validEmail,
          action: "INITIAL_ADMIN_PROVISIONED",
          module: "AUTH_PROVISIONING",
        }),
      }),
    );
  });

  // 12. Duplicate/unique-constraint race is handled safely
  it("Requirement 12: Duplicate/unique-constraint race condition is handled safely inside transaction", async () => {
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => {
        // Simulate concurrent insertion before create
        const txMock = {
          adminProfile: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ id: "concurrent-super-admin-uuid", role: "SUPER_ADMIN" }),
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
          },
          adminAuditLog: { create: vi.fn() },
          $transaction: vi.fn(),
        };
        return cb(txMock);
      },
    );

    const result = await provisionAdminProfile(
      { id: validUuid, email: validEmail, name: validName, mode: "apply" },
      deps,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Concurrent provisioning detected");
  });

  // 13. Transaction failure is handled without claiming success
  it("Requirement 13: Transaction failure returns error and does not claim success", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("Database connection pool exhausted"));

    const result = await provisionAdminProfile(
      { id: validUuid, email: validEmail, name: validName, mode: "apply" },
      deps,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      "Database transaction failed: Database connection pool exhausted",
    );
  });

  // 14. Logs and errors never expose credentials or connection strings
  it("Requirement 14: Error sanitizer redacts database credentials and JWT tokens", () => {
    const rawError =
      "Error connecting to postgresql://postgres.abcdef:secretPassword123@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature";
    const sanitized = sanitizeErrorMessage(rawError);

    expect(sanitized).not.toContain("secretPassword123");
    expect(sanitized).not.toContain("doNotLeakThisSignature");
    expect(sanitized).toContain("postgresql://***:***@");
    expect(sanitized).toContain("[REDACTED_JWT]");
  });

  // 15. Conflicting command flags are rejected
  it("Requirement 15: Conflicting command flags (--dry-run and --apply together) are rejected", () => {
    const args = parseProvisionCliArgs([
      "--id=" + validUuid,
      "--email=" + validEmail,
      "--name=" + validName,
      "--dry-run",
      "--apply",
    ]);
    expect(() => validateProvisionArgs(args)).toThrow("Conflicting flags");
  });

  // Additional CLI integration test
  it("runProvisionCli executes with exitCode 0 on valid dry-run and exitCode 1 on error", async () => {
    const successExit = await runProvisionCli(
      ["--id=" + validUuid, "--email=" + validEmail, "--name=" + validName, "--dry-run"],
      deps,
    );
    expect(successExit).toBe(0);

    const failExit = await runProvisionCli(
      ["--id=invalid", "--email=" + validEmail, "--name=" + validName],
      deps,
    );
    expect(failExit).toBe(1);
    expect(errorLogs.some((e) => e.includes("Invalid UUID"))).toBe(true);
  });
});
