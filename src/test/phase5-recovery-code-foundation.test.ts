import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateSingleRecoveryCode,
  generateRecoveryCodeSet,
  normalizeRecoveryCode,
  isValidRecoveryCodeFormat,
  formatRecoveryCode,
  generateSaltHex,
  hashRecoveryCode,
  verifyRecoveryCodeHash,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_ALPHABET,
} from "@/lib/server/recovery-code-crypto";
import {
  generateRecoveryCodesOperation,
  getRecoveryCodeStatusOperation,
  verifyAndRedeemRecoveryCodeOperation,
  SERVICE_UNAVAILABLE_RECOVERY_ERROR,
  RATE_LIMIT_RECOVERY_ERROR,
} from "@/lib/server/recovery-code-operations";
import { resetMemoryRateLimitStore } from "@/lib/server/rate-limiter";

// Mock server-auth
vi.mock("@/lib/auth/server-auth", () => ({
  requireAal2: vi.fn(),
  requireAdminProfile: vi.fn(),
}));

import { requireAal2, requireAdminProfile } from "@/lib/auth/server-auth";

describe("Phase 5.2: MFA Recovery-Code Foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMemoryRateLimitStore();
  });

  describe("1. Cryptographic Generation & Format Validation", () => {
    it("generates exactly 8 unique codes per set", () => {
      const set = generateRecoveryCodeSet();
      expect(set).toHaveLength(RECOVERY_CODE_COUNT);
      const uniqueSet = new Set(set);
      expect(uniqueSet.size).toBe(RECOVERY_CODE_COUNT);
    });

    it("formats codes as XXXX-XXXX-XXXX using only approved unambiguous Crockford characters", () => {
      const code = generateSingleRecoveryCode();
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);

      // Verify no ambiguous characters (0, O, 1, I, L)
      expect(code).not.toMatch(/[01OILoil]/);

      const normalized = normalizeRecoveryCode(code);
      expect(normalized).toHaveLength(12);
      for (const char of normalized) {
        expect(RECOVERY_CODE_ALPHABET).toContain(char);
      }
    });

    it("normalizes user input by stripping spaces, hyphens, and converting to uppercase", () => {
      expect(normalizeRecoveryCode("abcd-efgh-jkmn")).toBe("ABCDEFGHJKMN");
      expect(normalizeRecoveryCode("  ab cd - ef gh - jk mn  ")).toBe("ABCDEFGHJKMN");
      expect(normalizeRecoveryCode("")).toBe("");
    });

    it("validates recovery code format strictly", () => {
      expect(isValidRecoveryCodeFormat("2345-6789-ABCD")).toBe(true);
      expect(isValidRecoveryCodeFormat("23456789ABCD")).toBe(true);
      expect(isValidRecoveryCodeFormat("2345-6789-ABC")).toBe(false); // Too short
      expect(isValidRecoveryCodeFormat("2345-6789-ABCD-EFGH")).toBe(false); // Too long
      expect(isValidRecoveryCodeFormat("0123-4567-89AB")).toBe(false); // Contains forbidden '0' and '1'
      expect(isValidRecoveryCodeFormat("ABCD-EFGH-IJKL")).toBe(false); // Contains forbidden 'I' and 'L'
    });

    it("formats 12-char normalized code into XXXX-XXXX-XXXX display format", () => {
      expect(formatRecoveryCode("23456789ABCD")).toBe("2345-6789-ABCD");
      expect(() => formatRecoveryCode("SHORT")).toThrow();
    });
  });

  describe("2. Cryptographic Salt & scrypt Hashing", () => {
    it("generates unique 16-byte random salts in hex", () => {
      const salt1 = generateSaltHex();
      const salt2 = generateSaltHex();
      expect(salt1).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(salt2).toHaveLength(32);
      expect(salt1).not.toBe(salt2);
    });

    it("derives one-way scrypt hash and correctly verifies matching candidate code", async () => {
      const code = "2345-6789-ABCD";
      const salt = generateSaltHex();
      const hash = await hashRecoveryCode(code, salt);

      expect(hash).toHaveLength(128); // 64 bytes = 128 hex chars

      // Successful verification
      const isValid = await verifyRecoveryCodeHash(code, salt, hash);
      expect(isValid).toBe(true);

      // Successful verification with different formatting / case
      const isNormalizedValid = await verifyRecoveryCodeHash("23456789abcd", salt, hash);
      expect(isNormalizedValid).toBe(true);

      // Rejects wrong code
      const isWrongValid = await verifyRecoveryCodeHash("9999-9999-9999", salt, hash);
      expect(isWrongValid).toBe(false);
    });

    it("produces completely different hashes for identical codes using different salts", async () => {
      const code = "2345-6789-ABCD";
      const salt1 = generateSaltHex();
      const salt2 = generateSaltHex();

      const hash1 = await hashRecoveryCode(code, salt1);
      const hash2 = await hashRecoveryCode(code, salt2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("3. Recovery Code Generation & Regeneration Operation", () => {
    it("requires active administrator with verified AAL2 elevation", async () => {
      vi.mocked(requireAal2).mockRejectedValueOnce(new Error("Forbidden: AAL2_REQUIRED"));

      const req = new Request("https://internal.portal/api/recovery/generate", { method: "POST" });
      const mockPrisma = {} as any;

      await expect(generateRecoveryCodesOperation(req, mockPrisma)).rejects.toThrow("Forbidden: AAL2_REQUIRED");
      expect(requireAal2).toHaveBeenCalledWith(req, mockPrisma);
    });

    it("atomically deletes old codes, persists 8 new hashed codes, and returns plaintext codes once", async () => {
      const adminId = "admin-uuid-123";
      const adminEmail = "admin@cobralearn.com";

      vi.mocked(requireAal2).mockResolvedValueOnce({
        user: { id: adminId } as any,
        profile: { id: adminId, email: adminEmail, role: "SUPER_ADMIN", isActive: true } as any,
      });

      let deletedAdminId: string | null = null;
      let insertedRecords: any[] = [];
      let auditLogRecord: any = null;

      const mockTx = {
        adminRecoveryCode: {
          deleteMany: vi.fn().mockImplementation(async ({ where }) => {
            deletedAdminId = where.adminId;
            return { count: 8 };
          }),
          createMany: vi.fn().mockImplementation(async ({ data }) => {
            insertedRecords = data;
            return { count: data.length };
          }),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
        adminAuditLog: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            auditLogRecord = data;
            return { id: "log-1", ...data };
          }),
        },
      } as any;

      const req = new Request("https://internal.portal/api/recovery/generate", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.25" },
      });

      const res = await generateRecoveryCodesOperation(req, mockPrisma);

      expect(res.success).toBe(true);
      expect(res.codes).toHaveLength(8);

      // Verify atomic regeneration deleted previous codes
      expect(deletedAdminId).toBe(adminId);

      // Verify 8 records were inserted
      expect(insertedRecords).toHaveLength(8);
      for (const rec of insertedRecords) {
        expect(rec.adminId).toBe(adminId);
        expect(rec.isUsed).toBe(false);
        expect(rec.codeSalt).toHaveLength(32);
        expect(rec.codeHash).toHaveLength(128);
        // Verify plaintext code is NOT stored
        expect(rec).not.toHaveProperty("code");
        expect(rec).not.toHaveProperty("plaintext");
      }

      // Verify audit log sanitization (Zero sensitive values)
      expect(auditLogRecord).toBeDefined();
      expect(auditLogRecord.action).toBe("auth:recovery_codes_generated");
      expect(auditLogRecord.metadata).toEqual({ count: 8 });
      expect(JSON.stringify(auditLogRecord)).not.toContain(res.codes![0]);
    });

    it("fails closed with descriptive error if transaction client is missing adminRecoveryCode delegate", async () => {
      const adminId = "admin-uuid-stale";
      const adminEmail = "admin-stale@cobralearn.com";

      vi.mocked(requireAal2).mockResolvedValueOnce({
        user: { id: adminId } as any,
        profile: { id: adminId, email: adminEmail, role: "SUPER_ADMIN", isActive: true } as any,
      });

      // Simulates stale client where adminRecoveryCode delegate is undefined on transaction client
      const mockStaleTx = {};
      const mockStalePrisma = {
        $transaction: vi.fn().mockImplementation(async (cb) => cb(mockStaleTx)),
      } as any;

      const req = new Request("https://internal.portal/api/recovery/generate", {
        method: "POST",
      });

      await expect(generateRecoveryCodesOperation(req, mockStalePrisma)).rejects.toThrow(
        "Database client or transaction is missing AdminRecoveryCode delegate"
      );
    });
  });

  describe("4. Non-Sensitive Status Operation", () => {
    it("returns count metadata without exposing codes or hashes", async () => {
      const adminId = "admin-uuid-456";

      vi.mocked(requireAdminProfile).mockResolvedValueOnce({
        user: { id: adminId } as any,
        profile: { id: adminId, email: "admin@cobralearn.com", role: "ADMIN", isActive: true } as any,
      });

      const mockPrisma = {
        adminRecoveryCode: {
          count: vi.fn().mockImplementation(async ({ where }) => {
            if (where.isUsed === false) return 5;
            return 8;
          }),
        },
      } as any;

      const req = new Request("https://internal.portal/api/recovery/status");
      const status = await getRecoveryCodeStatusOperation(req, mockPrisma);

      expect(status.success).toBe(true);
      expect(status.hasCodes).toBe(true);
      expect(status.totalCodes).toBe(8);
      expect(status.remainingCodes).toBe(5);
    });

    it("throws descriptive error when adminRecoveryCode delegate is missing from prisma client", async () => {
      const adminId = "admin-uuid-456";

      vi.mocked(requireAdminProfile).mockResolvedValueOnce({
        user: { id: adminId } as any,
        profile: { id: adminId, email: "admin@cobralearn.com", role: "ADMIN", isActive: true } as any,
      });

      // Simulates stale client without adminRecoveryCode delegate
      const mockStalePrisma = {} as any;

      const req = new Request("https://internal.portal/api/recovery/status");
      await expect(getRecoveryCodeStatusOperation(req, mockStalePrisma)).rejects.toThrow(
        "Database client is missing AdminRecoveryCode delegate"
      );
    });
  });

  describe("5. Single-Use Verification and Atomic Redemption", () => {
    it("successfully redeems an unused recovery code in an atomic transaction", async () => {
      const adminId = "target-admin-uuid";
      const validCode = "2345-6789-ABCD";
      const salt = generateSaltHex();
      const hash = await hashRecoveryCode(validCode, salt);

      const storedRecords = [
        { id: "rec-1", codeHash: hash, codeSalt: salt, isUsed: false },
        { id: "rec-2", codeHash: "otherhash", codeSalt: "othersalt", isUsed: false },
      ];

      let updatedRecordId: string | null = null;
      let auditLogRecord: any = null;

      const mockPrisma = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            email: "target@cobralearn.com",
            isActive: true,
          }),
        },
        adminRecoveryCode: {
          findMany: vi.fn().mockResolvedValue(storedRecords),
          updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
            if (where.id === "rec-1" && where.isUsed === false) {
              updatedRecordId = where.id;
              return { count: 1 };
            }
            return { count: 0 };
          }),
        },
        adminAuditLog: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            auditLogRecord = data;
            return { id: "log-1", ...data };
          }),
        },
      } as any;

      const req = new Request("https://internal.portal/api/recovery/redeem", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.195" },
      });

      const result = await verifyAndRedeemRecoveryCodeOperation(
        req,
        { adminId, code: validCode },
        mockPrisma
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("successfully");
      expect(result.remainingCodes).toBe(1);
      expect(updatedRecordId).toBe("rec-1");

      // Verify audit log recorded event with zero secrets
      expect(auditLogRecord.action).toBe("auth:recovery_code_redeemed");
      expect(auditLogRecord.metadata).toEqual({ outcome: "success" });
      expect(JSON.stringify(auditLogRecord)).not.toContain(validCode);
    });

    it("prevents replay: already-used recovery codes are rejected", async () => {
      const adminId = "target-admin-uuid";
      const code = "2345-6789-ABCD";

      const mockPrisma = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            email: "target@cobralearn.com",
            isActive: true,
          }),
        },
        adminRecoveryCode: {
          // No unused codes returned
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as any;

      const req = new Request("https://internal.portal/api/recovery/redeem", { method: "POST" });
      const result = await verifyAndRedeemRecoveryCodeOperation(
        req,
        { adminId, code },
        mockPrisma
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or already redeemed recovery code.");
    });

    it("prevents concurrent double-redemption via atomic updateMany count validation", async () => {
      const adminId = "target-admin-uuid";
      const validCode = "2345-6789-ABCD";
      const salt = generateSaltHex();
      const hash = await hashRecoveryCode(validCode, salt);

      const mockPrisma = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            email: "target@cobralearn.com",
            isActive: true,
          }),
        },
        adminRecoveryCode: {
          findMany: vi.fn().mockResolvedValue([
            { id: "rec-1", codeHash: hash, codeSalt: salt, isUsed: false },
          ]),
          // Simulate race condition: another concurrent thread updated the row first (count === 0)
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      } as any;

      const req = new Request("https://internal.portal/api/recovery/redeem", { method: "POST" });
      const result = await verifyAndRedeemRecoveryCodeOperation(
        req,
        { adminId, code: validCode },
        mockPrisma
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or already redeemed recovery code.");
    });

    it("rejects invalid code format with generic error without querying database", async () => {
      const mockPrisma = {
        adminProfile: { findUnique: vi.fn() },
      } as any;

      const req = new Request("https://internal.portal/api/recovery/redeem", { method: "POST" });
      const result = await verifyAndRedeemRecoveryCodeOperation(
        req,
        { adminId: "admin-1", code: "NOT_VALID_CODE" },
        mockPrisma
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or already redeemed recovery code.");
      expect(mockPrisma.adminProfile.findUnique).not.toHaveBeenCalled();
    });

    it("rejects inactive or missing administrators with generic error (Anti-enumeration)", async () => {
      const mockPrisma = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: "inactive-admin",
            isActive: false, // Inactive!
          }),
        },
      } as any;

      const req = new Request("https://internal.portal/api/recovery/redeem", { method: "POST" });
      const result = await verifyAndRedeemRecoveryCodeOperation(
        req,
        { adminId: "inactive-admin", code: "2345-6789-ABCD" },
        mockPrisma
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or already redeemed recovery code.");
    });

    it("enforces rate limits on repeated attempts", async () => {
      const adminId = "rate-limited-admin";
      const code = "2345-6789-ABCD";

      const mockPrisma = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({ id: adminId, isActive: true }),
        },
        adminRecoveryCode: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as any;

      const req = new Request("https://internal.portal/api/recovery/redeem", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.99" },
      });

      // Submit 5 failed attempts (exhausting the threshold of 5)
      for (let i = 0; i < 5; i++) {
        await verifyAndRedeemRecoveryCodeOperation(req, { adminId, code }, mockPrisma);
      }

      // 6th attempt should be blocked by rate limiter
      const blockedRes = await verifyAndRedeemRecoveryCodeOperation(req, { adminId, code }, mockPrisma);
      expect(blockedRes.success).toBe(false);
      expect(blockedRes.error).toBe("Too many recovery attempts. Please try again later.");
    });

    it("fails closed with generic error if adminRecoveryCode delegate is missing during redemption", async () => {
      const adminId = "target-admin-uuid-no-delegate";
      const validCode = "2345-6789-ABCD";

      // Mock prisma missing adminRecoveryCode delegate
      const mockStalePrisma = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({ id: adminId, isActive: true }),
        },
      } as any;

      const req = new Request("https://internal.portal/api/recovery/redeem", { method: "POST" });
      const result = await verifyAndRedeemRecoveryCodeOperation(
        req,
        { adminId, code: validCode },
        mockStalePrisma
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or already redeemed recovery code.");
    });

    it("fails closed with service unavailable error when rate-limit storage fails, preventing profile and code queries", async () => {
      const adminId = "target-admin-uuid-storage-fail";
      const validCode = "2345-6789-ABCD";

      const mockFindUnique = vi.fn().mockResolvedValue({ id: adminId, isActive: true });
      const mockFindMany = vi.fn().mockResolvedValue([]);

      const mockFailingPrisma = {
        $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("PGBOUNCER connection pool exhausted: relation '_orbit_rate_limits' does not exist")),
        adminProfile: {
          findUnique: mockFindUnique,
        },
        adminRecoveryCode: {
          findMany: mockFindMany,
        },
      } as any;

      const req = new Request("https://internal.portal/api/recovery/redeem", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.195" },
      });

      const result = await verifyAndRedeemRecoveryCodeOperation(
        req,
        { adminId, code: validCode },
        mockFailingPrisma
      );

      // Verify exact error response: generic service unavailable error, NOT rate limit exceeded error
      expect(result.success).toBe(false);
      expect(result.error).toBe(SERVICE_UNAVAILABLE_RECOVERY_ERROR);
      expect(result.error).not.toBe(RATE_LIMIT_RECOVERY_ERROR);
      expect(result.error).not.toContain("PGBOUNCER");
      expect(result.error).not.toContain("relation");

      // Verify fail-closed behavior: no recovery code lookup or profile verification was reached
      expect(mockFindUnique).not.toHaveBeenCalled();
      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });
});
