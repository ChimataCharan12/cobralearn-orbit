import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  submitPublicContactMessageOperation,
  listAdminContactMessagesOperation,
  getAdminContactMessageDetailOperation,
  updateAdminContactMessageStatusOperation,
  deleteAdminContactMessageOperation,
  bulkUpdateAdminContactMessageStatusOperation,
  bulkDeleteAdminContactMessagesOperation,
} from "@/lib/server/contact-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminProfile, AdminRole, ContactMessageStatus } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Production-Ready Contact Messages Module — End-to-End Suite", () => {
  const superAdminUuid = "11111111-1111-4111-8111-111111111111";
  const adminUuid = "22222222-2222-4222-8222-222222222222";
  const editorUuid = "33333333-3333-4333-8333-333333333333";
  const inactiveUuid = "44444444-4444-4444-8444-444444444444";

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
    [inactiveUuid]: {
      id: inactiveUuid,
      email: "inactive@cobralearn.com",
      fullName: "Inactive Admin",
      role: "ADMIN" as AdminRole,
      isActive: false,
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
    return new Request("https://api.internal/test", {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: "sb-mock-token=valid",
      },
    });
  };

  let mockPrisma: any;
  let mockMessages: any[];
  let mockAuditLogs: any[];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuditLogs = [];
    mockMessages = [
      {
        id: "msg-1",
        fullName: "Alice Smith",
        email: "alice@example.com",
        subject: "Website Development",
        message: "Hello team, looking to develop a corporate showcase website.",
        status: "NEW",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        readAt: null,
        repliedAt: null,
        archivedAt: null,
        createdAt: new Date(Date.now() - 3600 * 1000),
        updatedAt: new Date(Date.now() - 3600 * 1000),
      },
      {
        id: "msg-2",
        fullName: "Bob Johnson",
        email: "bob@example.com",
        subject: "General Inquiry",
        message: "Can you provide consulting services for cloud architecture?",
        status: "READ",
        ipAddress: "192.168.1.2",
        userAgent: "Mozilla/5.0",
        readAt: new Date(Date.now() - 1800 * 1000),
        repliedAt: null,
        archivedAt: null,
        createdAt: new Date(Date.now() - 7200 * 1000),
        updatedAt: new Date(Date.now() - 1800 * 1000),
      },
    ];

    mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockPrisma)),
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
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
        create: vi.fn().mockImplementation(({ data }: any) => {
          const created = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            readAt: null,
            repliedAt: null,
            archivedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockMessages.push(created);
          return Promise.resolve(created);
        }),
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          const found = mockMessages.find((m) => m.id === where.id);
          return Promise.resolve(found || null);
        }),
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          const found = mockMessages.find((m) => {
            if (where.email && m.email !== where.email) return false;
            if (where.subject && m.subject !== where.subject) return false;
            if (where.message && m.message !== where.message) return false;
            return true;
          });
          return Promise.resolve(found || null);
        }),
        findMany: vi.fn().mockImplementation(({ where, take, skip, orderBy }: any) => {
          let list = [...mockMessages];
          if (where?.status) {
            list = list.filter((m) => m.status === where.status);
          }
          if (where?.OR) {
            const term = where.OR[0]?.fullName?.contains?.toLowerCase() || "";
            if (term) {
              list = list.filter(
                (m) =>
                  m.fullName.toLowerCase().includes(term) ||
                  m.email.toLowerCase().includes(term) ||
                  m.subject.toLowerCase().includes(term) ||
                  m.message.toLowerCase().includes(term)
              );
            }
          }
          if (orderBy?.createdAt === "asc") {
            list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          } else if (orderBy?.fullName === "asc") {
            list.sort((a, b) => a.fullName.localeCompare(b.fullName));
          } else {
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          }
          const s = skip || 0;
          const t = take || list.length;
          return Promise.resolve(list.slice(s, s + t));
        }),
        count: vi.fn().mockImplementation(({ where }: any = {}) => {
          let list = [...mockMessages];
          if (where?.status) {
            list = list.filter((m) => m.status === where.status);
          }
          if (where?.email) {
            list = list.filter((m) => m.email === where.email);
          }
          if (where?.ipAddress) {
            list = list.filter((m) => m.ipAddress === where.ipAddress);
          }
          if (where?.OR) {
            const term = where.OR[0]?.fullName?.contains?.toLowerCase() || "";
            if (term) {
              list = list.filter(
                (m) =>
                  m.fullName.toLowerCase().includes(term) ||
                  m.email.toLowerCase().includes(term) ||
                  m.subject.toLowerCase().includes(term) ||
                  m.message.toLowerCase().includes(term)
              );
            }
          }
          return Promise.resolve(list.length);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = mockMessages.findIndex((m) => m.id === where.id);
          if (idx === -1) throw new Error("Record to update not found.");
          mockMessages[idx] = { ...mockMessages[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockMessages[idx]);
        }),
        updateMany: vi.fn().mockImplementation(({ where, data }: any) => {
          const ids: string[] = where?.id?.in || [];
          let updatedCount = 0;
          mockMessages.forEach((m, idx) => {
            if (ids.includes(m.id)) {
              mockMessages[idx] = { ...m, ...data, updatedAt: new Date() };
              updatedCount++;
            }
          });
          return Promise.resolve({ count: updatedCount });
        }),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          const idx = mockMessages.findIndex((m) => m.id === where.id);
          if (idx === -1) throw new Error("Record to delete not found.");
          const deleted = mockMessages[idx];
          mockMessages.splice(idx, 1);
          return Promise.resolve(deleted);
        }),
        deleteMany: vi.fn().mockImplementation(({ where }: any) => {
          const ids: string[] = where?.id?.in || [];
          const initialLen = mockMessages.length;
          mockMessages = mockMessages.filter((m) => !ids.includes(m.id));
          return Promise.resolve({ count: initialLen - mockMessages.length });
        }),
      },
    };

    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockImplementation(async (token?: string) => {
          if (!token || token === "invalid-token") {
            return { data: { user: null }, error: new Error("Invalid token") };
          }
          const user = Object.values(mockProfiles).find((p) => p.id === token);
          if (user) {
            return { data: { user: makeUser(user.id, user.email) }, error: null };
          }
          return { data: { user: null }, error: new Error("User not found") };
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "mock-session-token" } },
        }),
      },
    });
  });

  // =========================================================================
  // 1. PUBLIC SUBMISSION
  // =========================================================================
  describe("Public Contact Form Submission", () => {
    it("persists a valid submission to the PostgreSQL ContactMessage table and returns confirmed success", async () => {
      const res = await submitPublicContactMessageOperation(
        {
          fullName: "Charlie Brown",
          email: "Charlie@Example.Com",
          subject: "Partnership Proposal",
          message: "We would love to discuss a strategic partnership with your engineering team.",
        },
        { clientIp: "203.0.113.1", userAgent: "Vitest/Test" },
        mockPrisma
      );

      expect(res.success).toBe(true);
      expect(res.id).toBeDefined();

      const saved = mockMessages.find((m) => m.id === res.id);
      expect(saved).toBeDefined();
      expect(saved.fullName).toBe("Charlie Brown");
      expect(saved.email).toBe("charlie@example.com"); // Normalized email
      expect(saved.subject).toBe("Partnership Proposal");
      expect(saved.status).toBe("NEW");
      expect(saved.ipAddress).toBe("203.0.113.1");
      expect(saved.userAgent).toBe("Vitest/Test");
    });

    it("rejects invalid full name, email, subject, or message", async () => {
      // Invalid name
      await expect(
        submitPublicContactMessageOperation(
          { fullName: "A", email: "valid@example.com", subject: "Valid Subj", message: "A message with enough length" },
          {},
          mockPrisma
        )
      ).rejects.toThrow(/Full name must be between 2 and 100 characters/i);

      // Invalid email
      await expect(
        submitPublicContactMessageOperation(
          { fullName: "Valid Name", email: "not-an-email", subject: "Valid Subj", message: "A message with enough length" },
          {},
          mockPrisma
        )
      ).rejects.toThrow(/Invalid email address format/i);

      // Short message
      await expect(
        submitPublicContactMessageOperation(
          { fullName: "Valid Name", email: "valid@example.com", subject: "Valid Subj", message: "Too short" },
          {},
          mockPrisma
        )
      ).rejects.toThrow(/Message must be at least 10 characters long/i);

      // Overlength message
      await expect(
        submitPublicContactMessageOperation(
          { fullName: "Valid Name", email: "valid@example.com", subject: "Valid Subj", message: "X".repeat(2001) },
          {},
          mockPrisma
        )
      ).rejects.toThrow(/Message exceeds 2000 characters limit/i);
    });

    it("silently filters honeypot submissions without creating a database record", async () => {
      const initialCount = mockMessages.length;
      const res = await submitPublicContactMessageOperation(
        {
          fullName: "Spam Bot",
          email: "spambot@example.com",
          subject: "Spam Subject",
          message: "Buy cheap products at this url http://spam.xyz",
          honeypot: "i am a hidden spam field",
        },
        {},
        mockPrisma
      );

      expect(res.success).toBe(true);
      expect(res.id).toBe("filtered");
      expect(mockMessages.length).toBe(initialCount);
    });

    it("enforces rate limits per email address (max 5 per 15 minutes)", async () => {
      mockPrisma.contactMessage.count.mockResolvedValue(5);

      await expect(
        submitPublicContactMessageOperation(
          {
            fullName: "Rapid Submitter",
            email: "rapid@example.com",
            subject: "Quick query",
            message: "Testing rate limits on rapid submissions.",
          },
          {},
          mockPrisma
        )
      ).rejects.toThrow(/Rate Limit Exceeded: Too many messages sent from this email address/i);
    });

    it("enforces rate limits per client IP address (max 10 per 15 minutes)", async () => {
      mockPrisma.contactMessage.count
        .mockResolvedValueOnce(1) // email count ok
        .mockResolvedValueOnce(10); // IP count exceeded

      await expect(
        submitPublicContactMessageOperation(
          {
            fullName: "Rapid Submitter",
            email: "other@example.com",
            subject: "Quick query",
            message: "Testing rate limits on rapid submissions.",
          },
          { clientIp: "10.0.0.99" },
          mockPrisma
        )
      ).rejects.toThrow(/Rate Limit Exceeded: Too many submissions from your connection/i);
    });

    it("prevents accidental duplicate submissions within 60 seconds without creating redundant records", async () => {
      const initialCount = mockMessages.length;

      // First submission
      const res1 = await submitPublicContactMessageOperation(
        {
          fullName: "Double Clicker",
          email: "doubleclick@example.com",
          subject: "Duplicate Test",
          message: "Accidental double-click test message body.",
        },
        {},
        mockPrisma
      );
      expect(res1.success).toBe(true);
      expect(mockMessages.length).toBe(initialCount + 1);

      // Immediate second submission with identical payload
      const res2 = await submitPublicContactMessageOperation(
        {
          fullName: "Double Clicker",
          email: "doubleclick@example.com",
          subject: "Duplicate Test",
          message: "Accidental double-click test message body.",
        },
        {},
        mockPrisma
      );
      expect(res2.success).toBe(true);
      expect(res2.id).toBe(res1.id);
      // No extra record was inserted
      expect(mockMessages.length).toBe(initialCount + 1);
    });

    it("does not return false success when database write fails", async () => {
      mockPrisma.contactMessage.create.mockRejectedValueOnce(new Error("Database connection severed"));

      await expect(
        submitPublicContactMessageOperation(
          {
            fullName: "Failure Test",
            email: "fail@example.com",
            subject: "DB Down",
            message: "Checking database failure error behavior.",
          },
          {},
          mockPrisma
        )
      ).rejects.toThrow(/Database connection severed/);
    });
  });

  // =========================================================================
  // 2. ADMIN INBOX & PERSISTENCE
  // =========================================================================
  describe("Admin Messages Inbox Operations", () => {
    it("queries messages from persistence with status counts, unread count, and deterministic ordering", async () => {
      const req = createAuthRequest(adminUuid);
      const res = await listAdminContactMessagesOperation(
        req,
        { limit: 10, offset: 0, sortBy: "newest" },
        mockPrisma
      );

      expect(res.messages).toHaveLength(2);
      expect(res.totalCount).toBe(2);
      expect(res.unreadCount).toBe(1);
      expect(res.counts.all).toBe(2);
      expect(res.counts.new).toBe(1);
      expect(res.counts.read).toBe(1);
      expect(res.limit).toBe(10);
      expect(res.offset).toBe(0);
    });

    it("supports search across name, email, subject, and message", async () => {
      const req = createAuthRequest(adminUuid);
      const res = await listAdminContactMessagesOperation(
        req,
        { search: "showcase" },
        mockPrisma
      );

      expect(res.messages).toHaveLength(1);
      expect(res.messages[0].fullName).toBe("Alice Smith");
    });

    it("supports filtering by message status", async () => {
      const req = createAuthRequest(adminUuid);
      const res = await listAdminContactMessagesOperation(
        req,
        { status: "READ" },
        mockPrisma
      );

      expect(res.messages).toHaveLength(1);
      expect(res.messages[0].id).toBe("msg-2");
    });

    it("marks message as read and updates readAt timestamp", async () => {
      const req = createAuthRequest(adminUuid);
      const updated = await updateAdminContactMessageStatusOperation(
        req,
        { messageId: "msg-1", status: "READ" },
        mockPrisma
      );

      expect(updated.status).toBe("READ");
      expect(updated.readAt).toBeDefined();

      // Audit log check: ensures private message content is not stored in audit logs
      const auditLog = mockAuditLogs.find((l) => l.action === "CONTACT_MESSAGE_STATUS_UPDATED");
      expect(auditLog).toBeDefined();
      expect(auditLog.entityId).toBe("msg-1");
      expect(auditLog.metadata.newStatus).toBe("READ");
      expect(auditLog.metadata).not.toHaveProperty("message");
      expect(auditLog.metadata).not.toHaveProperty("email");
    });

    it("supports archiving and unarchiving messages", async () => {
      const req = createAuthRequest(adminUuid);

      // Archive
      const archived = await updateAdminContactMessageStatusOperation(
        req,
        { messageId: "msg-1", status: "ARCHIVED" },
        mockPrisma
      );
      expect(archived.status).toBe("ARCHIVED");
      expect(archived.archivedAt).toBeDefined();

      // Unarchive back to READ
      const unarchived = await updateAdminContactMessageStatusOperation(
        req,
        { messageId: "msg-1", status: "READ" },
        mockPrisma
      );
      expect(unarchived.status).toBe("READ");
    });

    it("rejects invalid status mutations that do not conform to schema enum", async () => {
      const req = createAuthRequest(adminUuid);

      await expect(
        updateAdminContactMessageStatusOperation(
          req,
          { messageId: "msg-1", status: "SPAM" as any },
          mockPrisma
        )
      ).rejects.toThrow(/Invalid contact message status 'SPAM'/i);
    });

    it("deletes a single message and records audit log", async () => {
      const req = createAuthRequest(adminUuid);
      const res = await deleteAdminContactMessageOperation(req, "msg-2", mockPrisma);

      expect(res.success).toBe(true);
      expect(res.deletedId).toBe("msg-2");
      expect(mockMessages.find((m) => m.id === "msg-2")).toBeUndefined();

      const auditLog = mockAuditLogs.find((l) => l.action === "CONTACT_MESSAGE_DELETED");
      expect(auditLog).toBeDefined();
      expect(auditLog.entityId).toBe("msg-2");
    });

    it("performs bulk status updates with maximum 100 IDs validation", async () => {
      const req = createAuthRequest(adminUuid);

      // Rejects empty array
      await expect(
        bulkUpdateAdminContactMessageStatusOperation(
          req,
          { messageIds: [], status: "ARCHIVED" },
          mockPrisma
        )
      ).rejects.toThrow(/No message IDs provided/i);

      // Rejects over 100 items
      const largeList = Array.from({ length: 101 }, (_, i) => `msg-large-${i}`);
      await expect(
        bulkUpdateAdminContactMessageStatusOperation(
          req,
          { messageIds: largeList, status: "ARCHIVED" },
          mockPrisma
        )
      ).rejects.toThrow(/Cannot perform bulk update on more than 100 messages/i);

      // Valid bulk update
      const res = await bulkUpdateAdminContactMessageStatusOperation(
        req,
        { messageIds: ["msg-1"], status: "ARCHIVED" },
        mockPrisma
      );
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(1);
    });

    it("performs bulk deletion with maximum 100 IDs validation", async () => {
      const req = createAuthRequest(adminUuid);

      // Rejects empty array
      await expect(
        bulkDeleteAdminContactMessagesOperation(req, [], mockPrisma)
      ).rejects.toThrow(/No message IDs provided/i);

      // Rejects over 100 items
      const largeList = Array.from({ length: 101 }, (_, i) => `msg-large-${i}`);
      await expect(
        bulkDeleteAdminContactMessagesOperation(req, largeList, mockPrisma)
      ).rejects.toThrow(/Cannot perform bulk deletion on more than 100 messages/i);

      // Valid bulk delete
      const res = await bulkDeleteAdminContactMessagesOperation(req, ["msg-1"], mockPrisma);
      expect(res.success).toBe(true);
      expect(res.deletedCount).toBe(1);
      expect(mockMessages.find((m) => m.id === "msg-1")).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. AUTHENTICATION & RBAC PERMISSIONS
  // =========================================================================
  describe("Authentication, Authorization & RBAC Guardrails", () => {
    it("rejects unauthenticated requests", async () => {
      const unauthReq = new Request("https://api.internal/test");

      await expect(
        listAdminContactMessagesOperation(unauthReq, {}, mockPrisma)
      ).rejects.toThrow(/No cookie header provided|Unauthorized/i);
    });

    it("rejects inactive administrative users", async () => {
      const inactiveReq = createAuthRequest(inactiveUuid);

      await expect(
        listAdminContactMessagesOperation(inactiveReq, {}, mockPrisma)
      ).rejects.toThrow(/Forbidden: AdminProfile is deactivated/i);
    });

    it("allows EDITOR role to read messages but forbids updating or deleting them", async () => {
      const editorReq = createAuthRequest(editorUuid);

      // Allowed read
      const listRes = await listAdminContactMessagesOperation(editorReq, {}, mockPrisma);
      expect(listRes.messages).toBeDefined();

      // Forbidden status update
      await expect(
        updateAdminContactMessageStatusOperation(
          editorReq,
          { messageId: "msg-1", status: "READ" },
          mockPrisma
        )
      ).rejects.toThrow(/Forbidden/i);

      // Forbidden delete
      await expect(
        deleteAdminContactMessageOperation(editorReq, "msg-1", mockPrisma)
      ).rejects.toThrow(/Forbidden/i);
    });

    it("allows ADMIN and SUPER_ADMIN roles full message permissions", async () => {
      const adminReq = createAuthRequest(adminUuid);
      const superAdminReq = createAuthRequest(superAdminUuid);

      const resAdmin = await listAdminContactMessagesOperation(adminReq, {}, mockPrisma);
      expect(resAdmin.messages).toBeDefined();

      const resSuper = await listAdminContactMessagesOperation(superAdminReq, {}, mockPrisma);
      expect(resSuper.messages).toBeDefined();
    });
  });
});
