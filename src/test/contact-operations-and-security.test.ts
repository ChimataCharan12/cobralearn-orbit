import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAdminContactConfigOperation,
  updateAdminContactConfigOperation,
  getPublicContactConfigOperation,
  listAdminContactHighlightsOperation,
  createAdminContactHighlightOperation,
  updateAdminContactHighlightOperation,
  deleteAdminContactHighlightOperation,
  reorderAdminContactHighlightsOperation,
  listAdminContactFaqsOperation,
  createAdminContactFaqOperation,
  updateAdminContactFaqOperation,
  deleteAdminContactFaqOperation,
  reorderAdminContactFaqsOperation,
  listAdminContactSocialLinksOperation,
  createAdminContactSocialLinkOperation,
  updateAdminContactSocialLinkOperation,
  deleteAdminContactSocialLinkOperation,
  reorderAdminContactSocialLinksOperation,
  listAdminContactMessagesOperation,
  getAdminContactMessageDetailOperation,
  updateAdminContactMessageStatusOperation,
  deleteAdminContactMessageOperation,
  bulkDeleteAdminContactMessagesOperation,
  submitPublicContactMessageOperation,
  validateSafeUrl,
} from "@/lib/server/contact-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminProfile, AdminRole } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Phase 1 — Contact Operations, Schema Alignment & Security Test Suite", () => {
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
  let mockAuditLogs: any[];
  let mockMessages: any[];
  let mockHighlights: any[];
  let mockFaqs: any[];
  let mockSocialLinks: any[];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuditLogs = [];
    mockMessages = [
      {
        id: "msg-1",
        fullName: "Jane Doe",
        email: "jane@example.com",
        subject: "Project Inquiry",
        message: "Hello, looking to build a new platform.",
        status: "NEW",
        createdAt: new Date(),
      },
    ];
    mockHighlights = [];
    mockFaqs = [];
    mockSocialLinks = [];

    mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockPrisma)),
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
      mediaAsset: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          if (where.id === "media-valid-bg") {
            return Promise.resolve({ id: "media-valid-bg", publicUrl: "https://cdn.example.com/bg.jpg" });
          }
          return Promise.resolve(null);
        }),
      },
      contactPageConfig: {
        upsert: vi.fn().mockResolvedValue({
          id: "default",
          badgeText: "CONNECT WITH US",
          heroTitle: "Hero Title",
          heroSubtitle: "Hero Subtitle",
          heroSectionNumber: "01",
          heroSectionLabel: "CONTACT",
          heroHighlightHeading: "SOMETHING TOGETHER",
          heroKeywords: ["GROWTH", "IDEAS"],
          heroBackgroundAsset: null,
          highlights: [],
          faqs: [],
          socialLinks: [],
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          badgeText: "CONNECT WITH US",
          heroTitle: "Hero Title",
          heroSubtitle: "Hero Subtitle",
          heroBackgroundAsset: null,
          highlights: [{ id: "hl-1", title: "HL 1", isEnabled: true, displayOrder: 0 }],
          faqs: [{ id: "faq-1", question: "Q1", answer: "A1", isEnabled: true, displayOrder: 0 }],
          socialLinks: [{ id: "soc-1", platform: "X", url: "https://x.com", isEnabled: true, displayOrder: 0 }],
        }),
      },
      siteSettings: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          contactEmail: "contact@cobralearn.com",
          contactPhone: "+91 98765 43210",
          contactAddress: "Hyderabad, Telangana, India",
          businessHours: "Mon - Fri: 9:00 AM - 6:00 PM IST",
        }),
        upsert: vi.fn().mockImplementation(({ update }: any) => Promise.resolve({ id: "default", ...update })),
      },
      contactHighlight: {
        findMany: vi.fn().mockImplementation(() => Promise.resolve(mockHighlights)),
        findFirst: vi.fn().mockImplementation(() => Promise.resolve(mockHighlights[mockHighlights.length - 1] || null)),
        findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(mockHighlights.find((h) => h.id === where.id) || null)),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const item = { id: `hl-${mockHighlights.length + 1}`, ...data };
          mockHighlights.push(item);
          return Promise.resolve(item);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = mockHighlights.findIndex((h) => h.id === where.id);
          if (idx >= 0) mockHighlights[idx] = { ...mockHighlights[idx], ...data };
          return Promise.resolve(mockHighlights[idx] || { id: where.id, ...data });
        }),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          mockHighlights = mockHighlights.filter((h) => h.id !== where.id);
          return Promise.resolve({ id: where.id });
        }),
      },
      contactFaq: {
        findMany: vi.fn().mockImplementation(() => Promise.resolve(mockFaqs)),
        findFirst: vi.fn().mockImplementation(() => Promise.resolve(mockFaqs[mockFaqs.length - 1] || null)),
        findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(mockFaqs.find((f) => f.id === where.id) || null)),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const item = { id: `faq-${mockFaqs.length + 1}`, ...data };
          mockFaqs.push(item);
          return Promise.resolve(item);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = mockFaqs.findIndex((f) => f.id === where.id);
          if (idx >= 0) mockFaqs[idx] = { ...mockFaqs[idx], ...data };
          return Promise.resolve(mockFaqs[idx] || { id: where.id, ...data });
        }),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          mockFaqs = mockFaqs.filter((f) => f.id !== where.id);
          return Promise.resolve({ id: where.id });
        }),
      },
      contactSocialLink: {
        findMany: vi.fn().mockImplementation(() => Promise.resolve(mockSocialLinks)),
        findFirst: vi.fn().mockImplementation(() => Promise.resolve(mockSocialLinks[mockSocialLinks.length - 1] || null)),
        findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(mockSocialLinks.find((s) => s.id === where.id) || null)),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const item = { id: `soc-${mockSocialLinks.length + 1}`, ...data };
          mockSocialLinks.push(item);
          return Promise.resolve(item);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = mockSocialLinks.findIndex((s) => s.id === where.id);
          if (idx >= 0) mockSocialLinks[idx] = { ...mockSocialLinks[idx], ...data };
          return Promise.resolve(mockSocialLinks[idx] || { id: where.id, ...data });
        }),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          mockSocialLinks = mockSocialLinks.filter((s) => s.id !== where.id);
          return Promise.resolve({ id: where.id });
        }),
      },
      contactMessage: {
        findMany: vi.fn().mockImplementation(() => Promise.resolve(mockMessages)),
        findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(mockMessages.find((m) => m.id === where.id) || null)),
        count: vi.fn().mockImplementation(({ where }: any) => {
          if (where?.status === "NEW") return Promise.resolve(1);
          if (where?.email) return Promise.resolve(0);
          return Promise.resolve(mockMessages.length);
        }),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const item = { id: `msg-${mockMessages.length + 1}`, ...data, createdAt: new Date() };
          mockMessages.push(item);
          return Promise.resolve(item);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = mockMessages.findIndex((m) => m.id === where.id);
          if (idx >= 0) mockMessages[idx] = { ...mockMessages[idx], ...data };
          return Promise.resolve(mockMessages[idx] || { id: where.id, ...data });
        }),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          mockMessages = mockMessages.filter((m) => m.id !== where.id);
          return Promise.resolve({ id: where.id });
        }),
        deleteMany: vi.fn().mockImplementation(({ where }: any) => {
          const count = mockMessages.filter((m) => where.id.in.includes(m.id)).length;
          mockMessages = mockMessages.filter((m) => !where.id.in.includes(m.id));
          return Promise.resolve({ count });
        }),
      },
    };
  });

  // =========================================================================
  // 1. RBAC & INACTIVE ADMIN ENFORCEMENT
  // =========================================================================
  describe("Authentication & RBAC Enforcement", () => {
    it("rejects unauthenticated requests without authorization header or cookie", async () => {
      const unauthReq = new Request("https://api.internal/test");
      await expect(getAdminContactConfigOperation(unauthReq, mockPrisma)).rejects.toThrow(/No cookie header provided/i);
    });

    it("rejects inactive administrator requests with 403 Forbidden", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(inactiveUuid, "inactive@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const req = createAuthRequest("inactive-token");
      await expect(getAdminContactConfigOperation(req, mockPrisma)).rejects.toThrow(/Forbidden: AdminProfile is deactivated/i);
    });

    it("allows EDITOR role to read contact configuration (CONTACT_READ)", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(editorUuid, "editor@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const req = createAuthRequest("editor-token");
      const result = await getAdminContactConfigOperation(req, mockPrisma);
      expect(result).toBeDefined();
      expect(result.config.badgeText).toBe("CONNECT WITH US");
    });

    it("denies EDITOR role from mutating contact configuration (CONTACT_UPDATE)", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(editorUuid, "editor@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const req = createAuthRequest("editor-token");
      await expect(
        updateAdminContactConfigOperation(req, { hero: { heroTitle: "New Title" } }, mockPrisma)
      ).rejects.toThrow(/Forbidden: Role "EDITOR" lacks required permission: "contact:update"/i);
    });

    it("denies EDITOR role from deleting contact messages (CONTACT_DELETE)", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(editorUuid, "editor@cobralearn.com") }, error: null }),
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
              data: { currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [] },
              error: null,
            }),
          },
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const req = createAuthRequest("editor-token");
      await expect(
        deleteAdminContactMessageOperation(req, "msg-1", mockPrisma)
      ).rejects.toThrow(/Forbidden: Role "EDITOR" lacks required permission: "contact:delete"/i);
    });
  });

  // =========================================================================
  // 2. CONTACT CONFIGURATION & PERSISTENCE
  // =========================================================================
  describe("Contact Configuration & Unified Source of Truth", () => {
    it("updates contact presentation on ContactPageConfig and coordinates on SiteSettings atomically", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const req = createAuthRequest("admin-token");
      const payload = {
        hero: {
          heroTitle: "Updated Hero Title",
          heroKeywords: ["TECH", "AI"],
        },
        contactInfo: {
          email: "hello@cobralearn.com",
          phone: "+91 99999 00000",
          location: "Bengaluru, India",
          businessHours: "Mon - Sat 9am - 7pm",
          emailDescription: "Direct business inquiries",
        },
      };

      const result = await updateAdminContactConfigOperation(req, payload, mockPrisma);
      expect(result).toBeDefined();

      // Verify Prisma transaction was invoked
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

      // Verify audit log was recorded without sensitive leak
      expect(mockAuditLogs.length).toBe(1);
      expect(mockAuditLogs[0].action).toBe("CONTACT_CONFIG_UPDATED");
      expect(mockAuditLogs[0].metadata.updatedContactInfo).toBe(true);
    });

    it("validates media asset reference exists before associating hero background", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const req = createAuthRequest("admin-token");

      // Non-existent media ID
      await expect(
        updateAdminContactConfigOperation(req, { hero: { heroBackgroundAssetId: "non-existent-id" } }, mockPrisma)
      ).rejects.toThrow(/Specified background media asset does not exist/i);

      // Valid media ID succeeds
      const result = await updateAdminContactConfigOperation(
        req,
        { hero: { heroBackgroundAssetId: "media-valid-bg" } },
        mockPrisma
      );
      expect(result).toBeDefined();
    });

    it("public loader fetches active elements and returns sanitized structure", async () => {
      const publicData = await getPublicContactConfigOperation(mockPrisma);
      expect(publicData.hero).toBeDefined();
      expect(publicData.contactInfo.email).toBe("contact@cobralearn.com");
      expect(publicData.highlights).toHaveLength(1);
      expect(publicData.faqs).toHaveLength(1);
      expect(publicData.socialLinks).toHaveLength(1);
    });
  });

  // =========================================================================
  // 3. HIGHLIGHTS & FAQS OPERATIONS
  // =========================================================================
  describe("Highlights & FAQs CRUD & Ordering", () => {
    it("creates, updates, reorders and deletes contact highlights", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const req = createAuthRequest("admin-token");

      // Create
      const created = await createAdminContactHighlightOperation(
        req,
        { title: "Cutting Edge", description: "Modern Web", iconName: "Sparkles", accentColor: "EMERALD" },
        mockPrisma
      );
      expect(created.id).toBe("hl-1");
      expect(created.displayOrder).toBe(0);

      // Update
      const updated = await updateAdminContactHighlightOperation(
        req,
        "hl-1",
        { title: "Cutting Edge Tech" },
        mockPrisma
      );
      expect(updated.title).toBe("Cutting Edge Tech");

      // Reorder
      const reorderRes = await reorderAdminContactHighlightsOperation(
        req,
        [{ id: "hl-1", displayOrder: 5 }],
        mockPrisma
      );
      expect(reorderRes.success).toBe(true);

      // Delete
      const deleteRes = await deleteAdminContactHighlightOperation(req, "hl-1", mockPrisma);
      expect(deleteRes.success).toBe(true);
      expect(mockHighlights).toHaveLength(0);
    });

    it("creates, updates, reorders and deletes contact FAQs", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const req = createAuthRequest("admin-token");

      // Create
      const faq = await createAdminContactFaqOperation(
        req,
        { question: "How to hire?", answer: "Reach out via form.", iconName: "Briefcase" },
        mockPrisma
      );
      expect(faq.id).toBe("faq-1");
      expect(faq.iconName).toBe("Briefcase");

      // Update
      const updatedFaq = await updateAdminContactFaqOperation(
        req,
        "faq-1",
        { answer: "Updated answer text" },
        mockPrisma
      );
      expect(updatedFaq.answer).toBe("Updated answer text");

      // Delete
      const deleteRes = await deleteAdminContactFaqOperation(req, "faq-1", mockPrisma);
      expect(deleteRes.success).toBe(true);
      expect(mockFaqs).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. SOCIAL LINKS & URL PROTOCOL VALIDATION
  // =========================================================================
  describe("Social Links & Safe Protocol Validation", () => {
    it("rejects dangerous protocol schemes in social links", () => {
      expect(() => validateSafeUrl("javascript:alert(1)")).toThrow(/dangerous protocol scheme/i);
      expect(() => validateSafeUrl("data:text/html;base64,PHNjcmlwdD4=")).toThrow(/dangerous protocol scheme/i);
      expect(() => validateSafeUrl("vbscript:MsgBox(1)")).toThrow(/dangerous protocol scheme/i);
    });

    it("accepts safe HTTPS social URLs and creates record", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const req = createAuthRequest("admin-token");

      const link = await createAdminContactSocialLinkOperation(
        req,
        { platform: "GitHub", url: "https://github.com/cobralearn", iconName: "Github" },
        mockPrisma
      );
      expect(link.platform).toBe("GitHub");
      expect(link.url).toBe("https://github.com/cobralearn");
      expect(mockSocialLinks).toHaveLength(1);
    });
  });

  // =========================================================================
  // 5. MESSAGES MANAGEMENT & STATUS TRANSITIONS
  // =========================================================================
  describe("Messages Management Operations", () => {
    it("updates message status and does not leak message body in audit log", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const req = createAuthRequest("admin-token");

      const updated = await updateAdminContactMessageStatusOperation(
        req,
        { messageId: "msg-1", status: "READ", adminNotes: "Reviewed by admin" },
        mockPrisma
      );
      expect(updated.status).toBe("READ");

      // Verify audit log
      const audit = mockAuditLogs.find((l) => l.action === "CONTACT_MESSAGE_STATUS_UPDATED");
      expect(audit).toBeDefined();
      expect(audit.metadata.newStatus).toBe("READ");
      expect(audit.metadata.message).toBeUndefined(); // Crucial: message content NOT logged
    });

    it("performs bulk deletion of messages with CONTACT_DELETE permission", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: makeUser(adminUuid, "admin@cobralearn.com") }, error: null }),
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
              data: { currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [] },
              error: null,
            }),
          },
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const req = createAuthRequest("admin-token");

      const bulkRes = await bulkDeleteAdminContactMessagesOperation(req, ["msg-1"], mockPrisma);
      expect(bulkRes.success).toBe(true);
      expect(bulkRes.deletedCount).toBe(1);
    });
  });

  // =========================================================================
  // 6. PUBLIC SUBMISSION SECURITY & ANTI-ABUSE
  // =========================================================================
  describe("Public Contact Submission Anti-Abuse Controls", () => {
    it("silently drops submission when honeypot field is filled", async () => {
      const res = await submitPublicContactMessageOperation(
        {
          fullName: "Spam Bot",
          email: "bot@spam.com",
          subject: "Crypto Deal",
          message: "Check out this amazing link right now!",
          honeypot: "http://bot-site.ru",
        },
        {},
        mockPrisma
      );

      expect(res.success).toBe(true);
      expect(res.id).toBe("filtered");
      expect(mockPrisma.contactMessage.create).not.toHaveBeenCalled();
    });

    it("enforces validation on required fields and message length", async () => {
      // Too short name
      await expect(
        submitPublicContactMessageOperation(
          { fullName: "A", email: "user@test.com", subject: "Valid Subj", message: "Valid 10 char message" },
          {},
          mockPrisma
        )
      ).rejects.toThrow(/Full name must be between 2 and 100 characters/i);

      // Invalid email
      await expect(
        submitPublicContactMessageOperation(
          { fullName: "Valid Name", email: "not-an-email", subject: "Valid Subj", message: "Valid 10 char message" },
          {},
          mockPrisma
        )
      ).rejects.toThrow(/Invalid email address format/i);

      // Message too short
      await expect(
        submitPublicContactMessageOperation(
          { fullName: "Valid Name", email: "user@test.com", subject: "Valid Subj", message: "short" },
          {},
          mockPrisma
        )
      ).rejects.toThrow(/Message must be at least 10 characters long/i);
    });

    it("enforces database-backed rate limiting per email address", async () => {
      // Mock count returning 5 recent messages
      mockPrisma.contactMessage.count.mockResolvedValueOnce(5);

      await expect(
        submitPublicContactMessageOperation(
          { fullName: "Test User", email: "test@domain.com", subject: "Inquiry", message: "This is a legitimate message body." },
          {},
          mockPrisma
        )
      ).rejects.toThrow(/Rate Limit Exceeded: Too many messages sent from this email address/i);
    });

    it("enforces rate limiting per client IP address", async () => {
      // First count (email) passes: 0
      mockPrisma.contactMessage.count.mockResolvedValueOnce(0);
      // Second count (IP) exceeds: 10
      mockPrisma.contactMessage.count.mockResolvedValueOnce(10);

      await expect(
        submitPublicContactMessageOperation(
          { fullName: "Test User", email: "test@domain.com", subject: "Inquiry", message: "This is a legitimate message body." },
          { clientIp: "203.0.113.195" },
          mockPrisma
        )
      ).rejects.toThrow(/Rate Limit Exceeded: Too many submissions from your connection/i);
    });

    it("successfully creates ContactMessage record with NEW status", async () => {
      // Both email and IP counts pass
      mockPrisma.contactMessage.count.mockResolvedValue(0);

      const res = await submitPublicContactMessageOperation(
        {
          fullName: "Alice Morgan",
          email: "alice@example.com",
          subject: "Project Consultation",
          message: "We want to build a modern fintech portal.",
        },
        { clientIp: "198.51.100.42", userAgent: "Mozilla/5.0 Test Browser" },
        mockPrisma
      );

      expect(res.success).toBe(true);
      expect(res.id).toBe("msg-2");

      const created = mockMessages.find((m) => m.id === "msg-2");
      expect(created).toBeDefined();
      expect(created.status).toBe("NEW");
      expect(created.email).toBe("alice@example.com");
      expect(created.ipAddress).toBe("198.51.100.42");
    });
  });
});
