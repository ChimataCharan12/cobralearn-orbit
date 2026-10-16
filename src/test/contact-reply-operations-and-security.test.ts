import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sendAdminContactMessageReplyOperation,
  listAdminContactMessageRepliesOperation,
} from "@/lib/server/contact-operations";
import { getEmailConfig } from "@/lib/server/email/email-config";
import { ResendEmailClient, sanitizeProviderError, type EmailClient } from "@/lib/server/email/resend-client";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminProfile, AdminRole } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("In-Admin Email Reply System — Operations & Security Suite", () => {
  const superAdminUuid = "11111111-1111-4111-8111-111111111111";
  const adminUuid = "22222222-2222-4222-8222-222222222222";
  const editorUuid = "33333333-3333-4333-8333-333333333333";

  const makeUser = (id: string, email: string): User => ({
    id,
    email,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  });

  const mockProfiles: Record<string, AdminProfile> = {
    [superAdminUuid]: {
      id: superAdminUuid,
      email: "superadmin@cobralearn.com",
      fullName: "Super Admin",
      role: "SUPER_ADMIN" as AdminRole,
      isActive: true,
      phone: null,
      designation: null,
      bio: null,
      avatarUrl: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    [adminUuid]: {
      id: adminUuid,
      email: "admin@cobralearn.com",
      fullName: "Operations Admin",
      role: "ADMIN" as AdminRole,
      isActive: true,
      phone: null,
      designation: null,
      bio: null,
      avatarUrl: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    [editorUuid]: {
      id: editorUuid,
      email: "editor@cobralearn.com",
      fullName: "Content Editor",
      role: "EDITOR" as AdminRole,
      isActive: true,
      phone: null,
      designation: null,
      bio: null,
      avatarUrl: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const createAuthRequest = (token: string): Request => {
    return new Request("https://api.internal/admin/contact/messages/reply", {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: "sb-mock-token=valid",
      },
    });
  };

  let mockPrisma: any;
  let mockMessages: any[];
  let mockReplies: any[];
  let mockAuditLogs: any[];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuditLogs = [];
    mockReplies = [];
    mockMessages = [
      {
        id: "msg-1",
        fullName: "Jane Doe",
        email: "jane@example.com",
        subject: "Website Redesign Inquiry",
        message: "Hello team, I need a proposal for rebuilding our platform.",
        status: "NEW",
        repliedAt: null,
        createdAt: new Date(),
      },
    ];

    mockPrisma = {
      $transaction: vi.fn().mockImplementation(function (this: any, callback: any) {
        return callback(this || mockPrisma);
      }),
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(mockProfiles[where.id] || null)),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          const log = { id: `audit-${mockAuditLogs.length + 1}`, ...data, createdAt: new Date() };
          mockAuditLogs.push(log);
          return Promise.resolve(log);
        }),
      },
      contactMessage: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(mockMessages.find((m) => m.id === where.id) || null);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = mockMessages.findIndex((m) => m.id === where.id);
          if (idx >= 0) mockMessages[idx] = { ...mockMessages[idx], ...data };
          return Promise.resolve(mockMessages[idx] || { id: where.id, ...data });
        }),
      },
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      contactMessageReply: {
        findFirst: vi.fn().mockImplementation(() => Promise.resolve(mockReplies[0] || null)),
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          if (where.idempotencyKey) {
            return Promise.resolve(mockReplies.find((r) => r.idempotencyKey === where.idempotencyKey) || null);
          }
          return Promise.resolve(mockReplies.find((r) => r.id === where.id) || null);
        }),
        findMany: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(mockReplies.filter((r) => r.messageId === where.messageId));
        }),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const reply = { id: `reply-${mockReplies.length + 1}`, ...data, createdAt: new Date() };
          mockReplies.push(reply);
          return Promise.resolve(reply);
        }),
        count: vi.fn().mockImplementation(({ where }: any) => {
          let filtered = mockReplies;
          if (where?.adminId) filtered = filtered.filter((r) => r.adminId === where.adminId);
          if (where?.status) filtered = filtered.filter((r) => r.status === where.status);
          if (where?.createdAt?.gte) {
            const minTime = where.createdAt.gte instanceof Date ? where.createdAt.gte.getTime() : new Date(where.createdAt.gte).getTime();
            filtered = filtered.filter((r) => {
              const rTime = r.createdAt instanceof Date ? r.createdAt.getTime() : new Date(r.createdAt).getTime();
              return rTime >= minTime;
            });
          }
          return Promise.resolve(filtered.length);
        }),
      },
    };
  });

  // =========================================================================
  // 1. CONFIGURATION CONTRACT
  // =========================================================================
  describe("Server Outbound Email Configuration Contract", () => {
    it("throws a clear error when RESEND_API_KEY is missing", () => {
      const origKey = process.env["RESEND_API_KEY"];
      delete process.env["RESEND_API_KEY"];
      process.env["EMAIL_FROM_ADDRESS"] = "CobraLearn <support@cobralearn.com>";

      try {
        expect(() => getEmailConfig()).toThrow(/Missing RESEND_API_KEY environment variable/i);
      } finally {
        if (origKey) process.env["RESEND_API_KEY"] = origKey;
      }
    });

    it("throws a clear error when EMAIL_FROM_ADDRESS is missing", () => {
      const origFrom = process.env["EMAIL_FROM_ADDRESS"];
      process.env["RESEND_API_KEY"] = "re_test_12345";
      delete process.env["EMAIL_FROM_ADDRESS"];

      try {
        expect(() => getEmailConfig()).toThrow(/Missing EMAIL_FROM_ADDRESS environment variable/i);
      } finally {
        if (origFrom) process.env["EMAIL_FROM_ADDRESS"] = origFrom;
      }
    });

    it("loads valid configuration including optional reply-to", () => {
      const origKey = process.env["RESEND_API_KEY"];
      const origFrom = process.env["EMAIL_FROM_ADDRESS"];
      const origReplyTo = process.env["EMAIL_REPLY_TO"];

      process.env["RESEND_API_KEY"] = "re_live_valid_key";
      process.env["EMAIL_FROM_ADDRESS"] = "CobraLearn <support@cobralearn.com>";
      process.env["EMAIL_REPLY_TO"] = "replies@cobralearn.com";

      try {
        const config = getEmailConfig();
        expect(config.resendApiKey).toBe("re_live_valid_key");
        expect(config.fromAddress).toBe("CobraLearn <support@cobralearn.com>");
        expect(config.replyTo).toBe("replies@cobralearn.com");
        expect(config.timeoutMs).toBe(10000);
      } finally {
        if (origKey) process.env["RESEND_API_KEY"] = origKey; else delete process.env["RESEND_API_KEY"];
        if (origFrom) process.env["EMAIL_FROM_ADDRESS"] = origFrom; else delete process.env["EMAIL_FROM_ADDRESS"];
        if (origReplyTo) process.env["EMAIL_REPLY_TO"] = origReplyTo; else delete process.env["EMAIL_REPLY_TO"];
      }
    });
  });

  // =========================================================================
  // 2. RESEND CLIENT BEHAVIOR
  // =========================================================================
  describe("Resend Email Client Unit Behavior", () => {
    it("successfully sends an email and returns acceptance ID", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ id: "resend_msg_abc123" }),
      });

      const client = new ResendEmailClient(
        {
          resendApiKey: "re_mock_key",
          fromAddress: "CobraLearn <support@cobralearn.com>",
          timeoutMs: 5000,
        },
        mockFetch as any
      );

      const result = await client.sendEmail({
        to: "visitor@example.com",
        subject: "Re: Inquiry",
        text: "Hello visitor, thanks for reaching out.",
        idempotencyKey: "idem-key-1",
      });

      expect(result.provider).toBe("resend");
      expect(result.providerMessageId).toBe("resend_msg_abc123");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer re_mock_key",
            "Idempotency-Key": "idem-key-1",
          }),
        })
      );
    });

    it("throws appropriate error when Resend returns 401 unauthorized", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: vi.fn().mockResolvedValue({ message: "Invalid API Key" }),
      });

      const client = new ResendEmailClient(
        {
          resendApiKey: "re_invalid_key",
          fromAddress: "support@cobralearn.com",
          timeoutMs: 5000,
        },
        mockFetch as any
      );

      await expect(
        client.sendEmail({ to: "v@example.com", subject: "S", text: "Body message" })
      ).rejects.toThrow(/verify the server RESEND_API_KEY/i);
    });

    it("throws distinct provider access denial error when Resend returns 403 forbidden and sanitizes email addresses", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: vi.fn().mockResolvedValue({
          statusCode: 403,
          name: "validation_error",
          message:
            "You can only send testing emails to your own email address (owner@example.com). To send to other addresses, please verify a domain at https://resend.com/domains",
        }),
      });

      const client = new ResendEmailClient(
        {
          resendApiKey: "re_valid_key",
          fromAddress: "support@cobralearn.com",
          timeoutMs: 5000,
        },
        mockFetch as any
      );

      let caughtError: Error | null = null;
      try {
        await client.sendEmail({ to: "external@target.com", subject: "S", text: "Body message" });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      // Must be classified as 403 access denial, NOT a 401 authentication error
      expect(caughtError?.message).toMatch(/Email provider access denied \(403\):/i);
      expect(caughtError?.message).not.toMatch(/verify the server RESEND_API_KEY/i);
      // PII email must be redacted
      expect(caughtError?.message).toContain("[redacted-email]");
      expect(caughtError?.message).not.toContain("owner@example.com");
      expect(caughtError?.message).toContain("https://resend.com/domains");
    });

    it("throws distinct validation error when Resend returns 422 unprocessable entity and sanitizes details", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: vi.fn().mockResolvedValue({
          statusCode: 422,
          name: "validation_error",
          message: "The domain untrusted.org is not verified for account user@testcompany.org",
        }),
      });

      const client = new ResendEmailClient(
        {
          resendApiKey: "re_valid_key",
          fromAddress: "support@cobralearn.com",
          timeoutMs: 5000,
        },
        mockFetch as any
      );

      let caughtError: Error | null = null;
      try {
        await client.sendEmail({ to: "bad@untrusted.org", subject: "S", text: "Body message" });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      // Must be classified as 422 rejected request, NOT a 401 or generic failure
      expect(caughtError?.message).toMatch(/Email provider rejected request \(422\):/i);
      expect(caughtError?.message).not.toContain("user@testcompany.org");
      expect(caughtError?.message).toContain("[redacted-email]");
    });

    it("sanitizes provider error messages containing API keys, Bearer tokens, and email addresses", () => {
      const leakedMessage =
        "Failed request with Bearer re_1234567890abcdef12345678 to recipient test.user+alias@gmail.com; see server internals.";
      const sanitized = sanitizeProviderError(leakedMessage);

      expect(sanitized).not.toContain("re_1234567890abcdef12345678");
      expect(sanitized).not.toContain("test.user+alias@gmail.com");
      expect(sanitized).toContain("[redacted-key]");
      expect(sanitized).toContain("[redacted-email]");
    });

    it("throws appropriate error when Resend times out", async () => {
      const timeoutError = new Error("The operation was aborted");
      timeoutError.name = "TimeoutError";
      const mockFetch = vi.fn().mockRejectedValue(timeoutError);

      const client = new ResendEmailClient(
        {
          resendApiKey: "re_key",
          fromAddress: "support@cobralearn.com",
          timeoutMs: 10000,
        },
        mockFetch as any
      );

      await expect(
        client.sendEmail({ to: "v@example.com", subject: "S", text: "Body message" })
      ).rejects.toThrow(/timed out after 10 seconds/i);
    });
  });

  // =========================================================================
  // 3. RBAC & PERMISSION CHECKS
  // =========================================================================
  describe("Authentication & RBAC Authorization Checks", () => {
    it("rejects unauthenticated requests without credentials and blocks email dispatch", async () => {
      const emailClientSpy: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "unauth_fail" }),
      };
      const unauthReq = new Request("https://api.internal/admin/contact/messages/reply");
      await expect(
        sendAdminContactMessageReplyOperation(
          unauthReq,
          { messageId: "msg-1", subject: "Re: Hi", body: "Hello, this is our reply message." },
          mockPrisma,
          emailClientSpy
        )
      ).rejects.toThrow(/No cookie header provided/i);
      expect(emailClientSpy.sendEmail).not.toHaveBeenCalled();
    });

    it("rejects EDITOR role (requires CONTACT_UPDATE permission) and blocks email dispatch", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(editorUuid, "editor@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const emailClientSpy: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "editor_fail" }),
      };

      const req = createAuthRequest("editor-token");
      await expect(
        sendAdminContactMessageReplyOperation(
          req,
          { messageId: "msg-1", subject: "Re: Hi", body: "Hello, this is our reply message." },
          mockPrisma,
          emailClientSpy
        )
      ).rejects.toThrow(/Forbidden: Role .* lacks required permission.*contact:update/i);
      expect(emailClientSpy.sendEmail).not.toHaveBeenCalled();
    });

    it("allows ADMIN role to reply to contact messages", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const mockEmailClient: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "msg_ok_123" }),
      };

      const req = createAuthRequest("admin-token");
      const result = await sendAdminContactMessageReplyOperation(
        req,
        { messageId: "msg-1", subject: "Re: Inquiry", body: "Thank you for reaching out to us." },
        mockPrisma,
        mockEmailClient
      );

      expect(result.success).toBe(true);
      expect(result.message.status).toBe("REPLIED");
    });
  });

  // =========================================================================
  // 4. VALIDATION & SECURITY (HEADER INJECTION, ANTI-RELAY, FIELD LIMITS)
  // =========================================================================
  describe("Validation & Security Controls", () => {
    const setupAdminAuth = () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);
    };

    it("strictly rejects subjects containing carriage return or newline characters (header injection guard)", async () => {
      setupAdminAuth();
      const req = createAuthRequest("admin-token");

      await expect(
        sendAdminContactMessageReplyOperation(
          req,
          { messageId: "msg-1", subject: "Subject\r\nBcc: evil@attacker.com", body: "Hello there from team." },
          mockPrisma
        )
      ).rejects.toThrow(/newline characters \(header injection detected\)/i);
    });

    it("rejects replies with body shorter than 10 characters", async () => {
      setupAdminAuth();
      const req = createAuthRequest("admin-token");

      await expect(
        sendAdminContactMessageReplyOperation(
          req,
          { messageId: "msg-1", subject: "Subject", body: "Too short" },
          mockPrisma
        )
      ).rejects.toThrow(/Reply body must be at least 10 characters long/i);
    });

    it("rejects non-existent message ID", async () => {
      setupAdminAuth();
      const req = createAuthRequest("admin-token");

      await expect(
        sendAdminContactMessageReplyOperation(
          req,
          { messageId: "non-existent-msg", subject: "Subject", body: "This is a full valid reply text." },
          mockPrisma
        )
      ).rejects.toThrow(/Message with id 'non-existent-msg' not found/i);
    });

    it("enforces server-side recipient selection from DB record, ignoring any client-supplied recipient", async () => {
      setupAdminAuth();
      const req = createAuthRequest("admin-token");

      const mockEmailClient: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "msg_777" }),
      };

      // Even if payload had arbitrary recipient attempt (cast as any)
      const payload: any = {
        messageId: "msg-1",
        subject: "Re: Inquiry",
        body: "Thank you for reaching out to us.",
        toEmail: "attacker@spam-target.com", // malicious client override attempt
      };

      await sendAdminContactMessageReplyOperation(req, payload, mockPrisma, mockEmailClient);

      // Verify that sendEmail was called with the stored DB message email, NOT the attacker recipient
      expect(mockEmailClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "jane@example.com",
        })
      );
    });
  });

  // =========================================================================
  // 5. PROVIDER FAILURE, STORAGE HEALTH & TRANSACTIONAL CONSISTENCY
  // =========================================================================
  describe("Provider Error Handling & Atomic Transaction Consistency", () => {
    it("strictly requires reply-history table to be available and prevents provider dispatch if missing", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      // Simulate unapplied migration where ContactMessageReply table does not exist
      const unmigratedPrisma = {
        ...mockPrisma,
        contactMessageReply: {
          ...mockPrisma.contactMessageReply,
          findFirst: vi.fn().mockRejectedValue(new Error('relation "ContactMessageReply" does not exist')),
        },
      };

      const emailClientSpy: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "should_not_send" }),
      };

      const req = createAuthRequest("admin-token");
      await expect(
        sendAdminContactMessageReplyOperation(
          req,
          { messageId: "msg-1", subject: "Re: Inquiry", body: "Valid long reply message text." },
          unmigratedPrisma,
          emailClientSpy
        )
      ).rejects.toThrow(/Reply history table is not initialized.*Please apply database migration/i);

      // CRITICAL: Ensure provider dispatch was NEVER called when storage is unavailable
      expect(emailClientSpy.sendEmail).not.toHaveBeenCalled();

      // Ensure message status was NOT modified
      const messageInDb = mockMessages.find((m) => m.id === "msg-1");
      expect(messageInDb.status).toBe("NEW");
      expect(messageInDb.repliedAt).toBeNull();
    });

    it("does NOT update message status to REPLIED if the provider rejects the send", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const failingEmailClient: EmailClient = {
        sendEmail: vi.fn().mockRejectedValue(new Error("Email provider validation error: domain unverified")),
      };

      const req = createAuthRequest("admin-token");
      await expect(
        sendAdminContactMessageReplyOperation(
          req,
          { messageId: "msg-1", subject: "Re: Inquiry", body: "Valid long reply message text." },
          mockPrisma,
          failingEmailClient
        )
      ).rejects.toThrow(/domain unverified/i);

      // Verify status remains unchanged
      const messageInDb = mockMessages.find((m) => m.id === "msg-1");
      expect(messageInDb.status).toBe("NEW");
      expect(messageInDb.repliedAt).toBeNull();
      expect(mockReplies.length).toBe(0);
    });

    it("does NOT silently report success if reply-history persistence fails after provider acceptance", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const acceptingEmailClient: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "resend_msg_accepted_456" }),
      };

      // Mock database transaction failure during reply persistence
      const failingDbPrisma: any = {
        ...mockPrisma,
        contactMessageReply: {
          ...mockPrisma.contactMessageReply,
          create: vi.fn().mockRejectedValue(new Error("PostgreSQL write constraint violation")),
        },
      };
      failingDbPrisma.$transaction = vi.fn().mockImplementation(async (cb: any) => cb(failingDbPrisma));

      const req = createAuthRequest("admin-token");
      await expect(
        sendAdminContactMessageReplyOperation(
          req,
          { messageId: "msg-1", subject: "Re: Inquiry", body: "Valid long reply message text." },
          failingDbPrisma,
          acceptingEmailClient
        )
      ).rejects.toThrow(/Delivery Ambiguity: Email accepted by provider \(ID: resend_msg_accepted_456\), but database persistence failed/i);

      // Verify status remains NEW because persistence failed
      const messageInDb = mockMessages.find((m) => m.id === "msg-1");
      expect(messageInDb.status).toBe("NEW");
      expect(messageInDb.repliedAt).toBeNull();
    });

    it("preserves idempotency key across retry after ambiguous provider acceptance", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const emailClientSpy: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "resend_idempotent_789" }),
      };

      const idempotencyKey = "shared-idempotency-key-abc";
      const req = createAuthRequest("admin-token");

      // Retry attempt with the same idempotency key
      const result = await sendAdminContactMessageReplyOperation(
        req,
        {
          messageId: "msg-1",
          subject: "Re: Inquiry",
          body: "Valid long reply message text.",
          idempotencyKey,
        },
        mockPrisma,
        emailClientSpy
      );

      // Verify idempotency key was forwarded to provider
      expect(emailClientSpy.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "shared-idempotency-key-abc",
        })
      );

      // Verify persistence succeeded
      expect(result.success).toBe(true);
      expect(result.reply.idempotencyKey).toBe("shared-idempotency-key-abc");
      expect(result.message.status).toBe("REPLIED");
    });
  });

  // =========================================================================
  // 6. IDEMPOTENCY & DUPLICATE PREVENTION
  // =========================================================================
  describe("Idempotency & Duplicate Send Prevention", () => {
    it("returns existing reply without re-calling email provider when duplicate idempotencyKey is sent", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      // Pre-seed an existing reply with an idempotency key
      mockReplies.push({
        id: "reply-existing",
        messageId: "msg-1",
        adminEmail: "admin@cobralearn.com",
        toEmail: "jane@example.com",
        subject: "Re: Inquiry",
        bodyText: "Existing reply text",
        provider: "resend",
        providerMessageId: "msg_prior_1",
        status: "SENT",
        idempotencyKey: "unique-key-999",
        createdAt: new Date(),
      });

      const emailClientSpy: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "msg_new" }),
      };

      const req = createAuthRequest("admin-token");
      const result = await sendAdminContactMessageReplyOperation(
        req,
        {
          messageId: "msg-1",
          subject: "Re: Inquiry",
          body: "Trying to send duplicate",
          idempotencyKey: "unique-key-999",
        },
        mockPrisma,
        emailClientSpy
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.reply.id).toBe("reply-existing");
      expect(emailClientSpy.sendEmail).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 7. PERSISTENT SERVER-SIDE RATE LIMITING (SEC-CNT-01)
  // =========================================================================
  describe("Persistent Server-Side Rate Limiting (SEC-CNT-01)", () => {
    it("enforces maximum 10 replies per 60 seconds per admin account and blocks the 11th request", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const emailClientSpy: EmailClient = {
        sendEmail: vi.fn().mockImplementation(() =>
          Promise.resolve({ provider: "resend", providerMessageId: `msg_${Math.random()}` })
        ),
      };

      const req = createAuthRequest("admin-token");

      // Send 10 replies successfully
      for (let i = 0; i < 10; i++) {
        const res = await sendAdminContactMessageReplyOperation(
          req,
          { messageId: "msg-1", subject: `Reply ${i + 1}`, body: `Valid reply content body ${i + 1}` },
          mockPrisma,
          emailClientSpy
        );
        expect(res.success).toBe(true);
      }
      expect(emailClientSpy.sendEmail).toHaveBeenCalledTimes(10);

      // Attempt 11th reply within the 60-second window
      await expect(
        sendAdminContactMessageReplyOperation(
          req,
          { messageId: "msg-1", subject: "Reply 11", body: "Attempting 11th reply within 60s" },
          mockPrisma,
          emailClientSpy
        )
      ).rejects.toThrow(/Rate Limit Exceeded: Too many email replies sent\. Please wait a minute before sending another\./i);

      // Provider was NOT called for the 11th request
      expect(emailClientSpy.sendEmail).toHaveBeenCalledTimes(10);
    });

    it("persists rate limits across process instances using database reply records", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      // Pre-seed 10 replies in the database (simulating previous process/worker activity)
      const now = new Date();
      for (let i = 0; i < 10; i++) {
        mockReplies.push({
          id: `seeded-reply-${i}`,
          messageId: "msg-1",
          adminId: adminUuid,
          adminEmail: "admin@cobralearn.com",
          toEmail: "jane@example.com",
          subject: `Historical reply ${i}`,
          bodyText: "Historical body text",
          provider: "resend",
          providerMessageId: `seeded_resend_${i}`,
          status: "SENT",
          createdAt: new Date(now.getTime() - 10 * 1000), // 10 seconds ago
        });
      }

      const emailClientSpy: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "should_not_reach" }),
      };

      const req = createAuthRequest("admin-token");

      // Immediately blocked on first call in this process because DB already has 10 sent replies
      await expect(
        sendAdminContactMessageReplyOperation(
          req,
          { messageId: "msg-1", subject: "New attempt", body: "Should be blocked by database records" },
          mockPrisma,
          emailClientSpy
        )
      ).rejects.toThrow(/Rate Limit Exceeded/i);

      expect(emailClientSpy.sendEmail).not.toHaveBeenCalled();
    });

    it("allows idempotent retries without being blocked even when rate limit threshold is saturated", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      // Pre-seed 10 replies to saturate the rate limit
      for (let i = 0; i < 10; i++) {
        mockReplies.push({
          id: `seeded-reply-${i}`,
          messageId: "msg-1",
          adminId: adminUuid,
          adminEmail: "admin@cobralearn.com",
          toEmail: "jane@example.com",
          subject: `Seeded ${i}`,
          bodyText: "Seeded body text",
          status: "SENT",
          idempotencyKey: i === 0 ? "idempotent-allowed-key" : undefined,
          createdAt: new Date(),
        });
      }

      const emailClientSpy: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "never_called" }),
      };

      const req = createAuthRequest("admin-token");

      // Retry with existing idempotency key must succeed without throwing rate limit error
      const retryResult = await sendAdminContactMessageReplyOperation(
        req,
        {
          messageId: "msg-1",
          subject: "Retry Subject",
          body: "Retry Body Content Here",
          idempotencyKey: "idempotent-allowed-key",
        },
        mockPrisma,
        emailClientSpy
      );

      expect(retryResult.isDuplicate).toBe(true);
      expect(retryResult.reply.id).toBe("seeded-reply-0");
      expect(emailClientSpy.sendEmail).not.toHaveBeenCalled();
    });

    it("serializes concurrent requests via advisory transaction lock and prevents threshold bypass", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      // In real PostgreSQL, pg_advisory_xact_lock serializes concurrent transactions.
      // In this test, we simulate an advisory lock by wrapping $transaction with an in-memory mutex queue.
      let queue = Promise.resolve();
      const originalTx = mockPrisma.$transaction;
      mockPrisma.$transaction = vi.fn().mockImplementation((callback: any) => {
        const next = queue.then(async () => {
          return await originalTx(callback);
        });
        queue = next.catch(() => {});
        return next;
      });

      const emailClientSpy: EmailClient = {
        sendEmail: vi.fn().mockImplementation(async () => {
          await new Promise((r) => setTimeout(r, 5));
          return { provider: "resend", providerMessageId: `msg_${Math.random()}` };
        }),
      };

      const req = createAuthRequest("admin-token");

      // Fire 15 concurrent requests simultaneously
      const results = await Promise.allSettled(
        Array.from({ length: 15 }, (_, i) =>
          sendAdminContactMessageReplyOperation(
            req,
            { messageId: "msg-1", subject: `Concurrent ${i}`, body: `Concurrent reply body test ${i}` },
            mockPrisma,
            emailClientSpy
          )
        )
      );

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly 10 must succeed, and exactly 5 must be rejected by the rate limiter
      expect(fulfilled.length).toBe(10);
      expect(rejected.length).toBe(5);

      rejected.forEach((rej) => {
        if (rej.status === "rejected") {
          expect((rej.reason as Error).message).toMatch(/Rate Limit Exceeded/i);
        }
      });
    });

    it("does NOT increment rate limit count if email provider rejects the send", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const failingEmailClient: EmailClient = {
        sendEmail: vi.fn().mockRejectedValue(new Error("Provider API key invalid")),
      };

      const req = createAuthRequest("admin-token");

      // Attempt 3 failing requests
      for (let i = 0; i < 3; i++) {
        await expect(
          sendAdminContactMessageReplyOperation(
            req,
            { messageId: "msg-1", subject: "Fail Test", body: "Failing reply body text here" },
            mockPrisma,
            failingEmailClient
          )
        ).rejects.toThrow(/Provider API key invalid/i);
      }

      // No replies were committed to the DB
      expect(mockReplies.length).toBe(0);

      // Now send 10 valid replies with a working client - all 10 must succeed!
      const workingEmailClient: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "valid_msg_id" }),
      };

      for (let i = 0; i < 10; i++) {
        const res = await sendAdminContactMessageReplyOperation(
          req,
          { messageId: "msg-1", subject: `Valid ${i}`, body: `Valid reply body text here ${i}` },
          mockPrisma,
          workingEmailClient
        );
        expect(res.success).toBe(true);
      }
      expect(workingEmailClient.sendEmail).toHaveBeenCalledTimes(10);
    });
  });

  // =========================================================================
  // 8. DURABLE AUDIT LOGGING (PRIVACY-PRESERVING)
  // =========================================================================
  describe("Durable Recording & Privacy Audit Trail", () => {
    it("creates ContactMessageReply and AdminAuditLog without exposing sensitive message body in audit metadata", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const mockEmailClient: EmailClient = {
        sendEmail: vi.fn().mockResolvedValue({ provider: "resend", providerMessageId: "resend_tx_888" }),
      };

      const req = createAuthRequest("admin-token");
      const res = await sendAdminContactMessageReplyOperation(
        req,
        {
          messageId: "msg-1",
          subject: "Re: Official Proposal",
          body: "CONFIDENTIAL PROPOSAL: We can deliver the platform in 8 weeks for $50,000.",
          idempotencyKey: "audit-test-key",
        },
        mockPrisma,
        mockEmailClient
      );

      expect(res.success).toBe(true);
      expect(res.reply.providerMessageId).toBe("resend_tx_888");

      // Verify ContactMessage was updated
      expect(res.message.status).toBe("REPLIED");
      expect(res.message.repliedAt).toBeDefined();

      // Verify Audit Log
      expect(mockAuditLogs.length).toBe(1);
      const log = mockAuditLogs[0];
      expect(log.action).toBe("CONTACT_MESSAGE_REPLY_SENT");
      expect(log.actorEmail).toBe("admin@cobralearn.com");
      expect(log.entityId).toBe("msg-1");
      expect(log.metadata.providerMessageId).toBe("resend_tx_888");
      expect(log.metadata.recipientDomain).toBe("example.com");

      // Verify body text is NOT leaked into audit log metadata
      expect(log.metadata.bodyText).toBeUndefined();
      expect(JSON.stringify(log.metadata)).not.toContain("CONFIDENTIAL PROPOSAL");
    });
  });

  // =========================================================================
  // 8. LISTING REPLIES
  // =========================================================================
  describe("List Contact Message Replies", () => {
    it("retrieves replies ordered chronologically for a message", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      mockReplies.push(
        { id: "r-1", messageId: "msg-1", subject: "First Reply", bodyText: "Text 1", createdAt: new Date(1000) },
        { id: "r-2", messageId: "msg-1", subject: "Second Reply", bodyText: "Text 2", createdAt: new Date(2000) }
      );

      const req = createAuthRequest("admin-token");
      const replies = await listAdminContactMessageRepliesOperation(req, "msg-1", mockPrisma);
      expect(replies.length).toBe(2);
      expect(replies[0].subject).toBe("First Reply");
      expect(replies[1].subject).toBe("Second Reply");
    });
  });
});
