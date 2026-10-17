import * as fs from "fs";
import * as path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { contactStore } from "@/lib/contact-store";
import {
  getPublicContactConfigOperation,
  updateAdminContactConfigOperation,
  submitPublicContactMessageOperation,
  listAdminContactMessagesOperation,
  updateAdminContactMessageStatusOperation,
  deleteAdminContactMessageOperation,
  bulkDeleteAdminContactMessagesOperation,
  bulkUpdateAdminContactMessageStatusOperation,
  validateSafeUrl,
  type UpdateContactConfigPayload,
} from "@/lib/server/contact-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Contact Module Phase 2 — Admin UI & Public Integration Test Suite", () => {
  const superAdminUuid = "11111111-1111-4111-8111-111111111111";

  const createAuthRequest = (token: string = "valid-token"): Request => {
    return new Request("https://api.internal/test", {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: "sb-mock-token=valid",
      },
    });
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Store Server Initialization & Data Mapping", () => {
    it("initializes ContactConfig correctly from server response payload", () => {
      const serverPayload = {
        config: {
          id: "default",
          heroSectionNumber: "07",
          heroSectionLabel: "CONNECT",
          heroTitle: "Build With Us",
          heroHighlightHeading: "INNOTECHCORE",
          heroDescription: "Reach our global engineering team.",
          heroKeywords: ["FUTURE", "TECH", "SCALE"],
          seoPageTitle: "Custom Contact Title",
          seoMetaDescription: "Custom Contact Description",
          contactEmailDescription: "Direct support email",
          contactLocationDescription: "Bangalore Innovation Hub",
          formTitle: "Start a Conversation",
          formSubtitle: "We reply within 12 hours.",
          formSubmitButtonText: "Submit Request",
          formSuccessMessage: "Got your message!",
          formErrorMessage: "Invalid fields.",
          subjectOptions: ["Consulting", "Careers"],
          enableFaqSection: false,
          enableHighlights: true,
          heroBackgroundAsset: {
            id: "asset-123",
            publicUrl: "https://cdn.example.com/contact-bg.jpg",
          },
          highlights: [
            {
              id: "hl-1",
              title: "Fast Response",
              description: "Within 24h",
              iconName: "Zap",
              accentColor: "CYAN",
              displayOrder: 0,
              isEnabled: true,
            },
          ],
          faqs: [
            {
              id: "faq-1",
              question: "What is the turnaround?",
              answer: "2-3 weeks",
              iconName: "Clock",
              displayOrder: 0,
              isEnabled: true,
            },
          ],
          socialLinks: [
            {
              id: "soc-1",
              platform: "LinkedIn",
              label: "LinkedIn Profile",
              url: "https://linkedin.com/company/cobralearn",
              iconName: "Linkedin",
              displayOrder: 0,
              isEnabled: true,
            },
          ],
        },
        siteSettings: {
          contactEmail: "hello@cobralearn.com",
          contactPhone: "+91 99999 88888",
          contactAddress: "Bangalore, India",
          businessHours: "Mon-Sat 10am-7pm",
        },
      };

      contactStore.initializeFromServer(serverPayload);

      const updated = contactStore.getConfigSnapshot();
      expect(updated.hero.sectionNumber).toBe("07");
      expect(updated.hero.sectionLabel).toBe("CONNECT");
      expect(updated.hero.mainHeading).toBe("Build With Us");
      expect(updated.hero.highlightHeading).toBe("INNOTECHCORE");
      expect(updated.hero.description).toBe("Reach our global engineering team.");
      expect(updated.hero.backgroundImage).toBe("https://cdn.example.com/contact-bg.jpg");
      expect(updated.hero.backgroundImageId).toBe("asset-123");
      expect(updated.hero.keywords).toHaveLength(3);
      expect(updated.hero.keywords[0].text).toBe("FUTURE");

      // Canonical SiteSettings mapped
      expect(updated.contactInfo.email).toBe("hello@cobralearn.com");
      expect(updated.contactInfo.phone).toBe("+91 99999 88888");
      expect(updated.contactInfo.location).toBe("Bangalore, India");
      expect(updated.contactInfo.businessHours).toBe("Mon-Sat 10am-7pm");
      // ContactPageConfig presentation descriptions mapped
      expect(updated.contactInfo.emailDescription).toBe("Direct support email");
      expect(updated.contactInfo.locationDescription).toBe("Bangalore Innovation Hub");

      // Highlights, FAQs, Social Links mapped
      expect(updated.highlights).toHaveLength(1);
      expect(updated.highlights[0].title).toBe("Fast Response");
      expect(updated.highlights[0].accent).toBe("cyan");
      expect(updated.faqs).toHaveLength(1);
      expect(updated.faqs[0].question).toBe("What is the turnaround?");
      expect(updated.socialLinks).toHaveLength(1);
      expect(updated.socialLinks[0].platform).toBe("LinkedIn");

      // Form Settings mapped
      expect(updated.formSettings.heading).toBe("Start a Conversation");
      expect(updated.formSettings.enableFaqSection).toBe(false);
      expect(updated.formSettings.enableHighlights).toBe(true);
    });

    it("initializes ContactMessages correctly from server records", () => {
      const serverMessages = [
        {
          id: "msg-1",
          fullName: "Alice Smith",
          email: "alice@example.com",
          subject: "Partnership",
          message: "Would love to partner on digital platforms.",
          status: "NEW",
          createdAt: new Date("2026-10-10T10:00:00Z"),
          adminNotes: null,
          metadata: null,
        },
        {
          id: "msg-2",
          fullName: "Bob Jones",
          email: "bob@example.com",
          subject: "Consulting",
          message: "Need consulting services.",
          status: "READ",
          createdAt: new Date("2026-10-09T10:00:00Z"),
          adminNotes: "Replied via email",
          metadata: null,
        },
      ];

      contactStore.initializeMessagesFromServer(serverMessages);

      const msgs = contactStore.getMessagesSnapshot();
      expect(msgs).toHaveLength(2);
      expect(msgs[0].id).toBe("msg-1");
      expect(msgs[0].status).toBe("new");
      expect(msgs[1].id).toBe("msg-2");
      expect(msgs[1].status).toBe("read");
    });
  });

  describe("2. Admin Save Payload & Multi-Tab Synchronization", () => {
    it("constructs full 6-tab payload and executes transactional sync", async () => {
      const mockPrisma: any = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: superAdminUuid,
            email: "superadmin@cobralearn.com",
            role: "SUPER_ADMIN",
            isActive: true,
          }),
        },
        contactPageConfig: {
          upsert: vi.fn().mockResolvedValue({ id: "default" }),
          findUnique: vi.fn().mockResolvedValue({ id: "default" }),
        },
        siteSettings: {
          upsert: vi.fn().mockResolvedValue({ id: "default" }),
        },
        contactHighlight: {
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        contactFaq: {
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        contactSocialLink: {
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        adminAuditLog: {
          create: vi.fn().mockResolvedValue({ id: "audit-1" }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          return await callback(mockPrisma);
        }),
      };

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: superAdminUuid, email: "superadmin@cobralearn.com" } },
            error: null,
          }),
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);

      const payload: UpdateContactConfigPayload = {
        hero: {
          heroSectionNumber: "01",
          heroSectionLabel: "CONTACT",
          heroTitle: "Connect With CobraLearn",
          heroHighlightHeading: "EXCELLENCE",
          heroDescription: "Reach our core teams.",
          heroKeywords: ["CREATIVE", "SYSTEMS"],
          heroBackgroundAssetId: null,
        },
        seo: {
          seoPageTitle: "Contact Us — CobraLearn",
          seoMetaDescription: "Reach our teams.",
        },
        contactInfo: {
          email: "info@cobralearn.com",
          emailDescription: "General inquiries",
          phone: "+91 91234 56789",
          businessHours: "Mon-Fri 9am-6pm",
          location: "Hyderabad, India",
          locationDescription: "Tech HQ",
        },
        formSettings: {
          formTitle: "Send a Note",
          formSubtitle: "We are glad to help.",
          subjectOptions: ["General", "Enterprise"],
          formSubmitButtonText: "Submit",
          formSuccessMessage: "Received!",
          formErrorMessage: "Check form fields.",
          enableFaqSection: true,
          enableHighlights: true,
        },
        highlights: [
          {
            title: "Agile Delivery",
            description: "Fast turnarounds",
            iconName: "Zap",
            accentColor: "EMERALD",
            displayOrder: 0,
            isEnabled: true,
          },
        ],
        faqs: [
          {
            question: "How to hire?",
            answer: "Contact our team directly.",
            iconName: "HelpCircle",
            displayOrder: 0,
            isEnabled: true,
          },
        ],
        socialLinks: [
          {
            platform: "GitHub",
            label: "Open Source",
            url: "https://github.com/cobralearn",
            iconName: "Github",
            displayOrder: 0,
            isEnabled: true,
          },
        ],
      };

      const req = createAuthRequest("superadmin-token");
      const result = await updateAdminContactConfigOperation(req, payload, mockPrisma);
      expect(result).toBeDefined();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.contactPageConfig.upsert).toHaveBeenCalled();
      expect(mockPrisma.siteSettings.upsert).toHaveBeenCalled();
      expect(mockPrisma.contactHighlight.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.contactHighlight.createMany).toHaveBeenCalled();
      expect(mockPrisma.contactFaq.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.contactFaq.createMany).toHaveBeenCalled();
      expect(mockPrisma.contactSocialLink.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.contactSocialLink.createMany).toHaveBeenCalled();
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalled();
    });
  });

  describe("3. Public Contact Configuration & Safe Link Rendering", () => {
    it("returns public contact data with section visibility respected", async () => {
      const mockPrisma: any = {
        contactPageConfig: {
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            badgeText: "CONTACT",
            heroTitle: "Build with us",
            heroSubtitle: "Get in touch",
            heroSectionNumber: "01",
            heroSectionLabel: "CONTACT",
            heroHighlightHeading: "SOMETHING BIG",
            heroDescription: "Let's innovate together",
            heroKeywords: ["INNOVATE", "BUILD"],
            seoPageTitle: "Contact CobraLearn",
            seoMetaDescription: "Reach us today",
            contactEmailDescription: "Email channel",
            contactLocationDescription: "HQ Office",
            formTitle: "Message Us",
            formSubtitle: "Fast replies",
            formSuccessMessage: "Success!",
            formErrorMessage: "Error!",
            formSubmitButtonText: "Send",
            subjectOptions: ["General", "Support"],
            enableFaqSection: false, // suppressed by admin
            enableHighlights: true,
            heroBackgroundAsset: {
              publicUrl: "https://media.cobralearn.com/contact-hero.png",
              altText: "Hero Banner",
            },
            highlights: [
              {
                id: "h1",
                title: "Rapid Execution",
                description: "Fast deliverables",
                iconName: "Zap",
                accentColor: "EMERALD",
                displayOrder: 0,
                isEnabled: true,
              },
            ],
            faqs: [
              {
                id: "f1",
                question: "Do you sign NDA?",
                answer: "Yes, always.",
                iconName: "ShieldCheck",
                displayOrder: 0,
                isEnabled: true,
              },
            ],
            socialLinks: [
              {
                id: "s1",
                platform: "LinkedIn",
                label: "LinkedIn",
                url: "https://linkedin.com/company/cobralearn",
                iconName: "Linkedin",
                displayOrder: 0,
                isEnabled: true,
              },
            ],
          }),
        },
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue({
            contactEmail: "public@cobralearn.com",
            contactPhone: "+91 98765 00000",
            contactAddress: "Hyderabad, India",
            businessHours: "9am - 6pm",
          }),
        },
      };

      const publicConfig = await getPublicContactConfigOperation(mockPrisma);
      expect(publicConfig.hero.heroTitle).toBe("Build with us");
      expect(publicConfig.hero.backgroundImage).toBe("https://media.cobralearn.com/contact-hero.png");
      expect(publicConfig.contactInfo.email).toBe("public@cobralearn.com");
      expect(publicConfig.highlights).toHaveLength(1);
      expect(publicConfig.formSettings.enableFaqSection).toBe(false);
      expect(publicConfig.formSettings.enableHighlights).toBe(true);

      // Verify safe URL validation function
      expect(validateSafeUrl(publicConfig.socialLinks[0].url)).toBe("https://linkedin.com/company/cobralearn");
      expect(() => validateSafeUrl("javascript:alert(1)")).toThrow(/dangerous protocol/i);
    });

    it("gracefully falls back when database row is empty", async () => {
      const mockPrisma: any = {
        contactPageConfig: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const publicConfig = await getPublicContactConfigOperation(mockPrisma);
      expect(publicConfig.hero.heroTitle).toBe("Let’s Build the Next Generation of Digital Experiences");
      expect(publicConfig.hero.backgroundImage).toBeNull();
      expect(publicConfig.contactInfo.email).toBe("");
      expect(publicConfig.contactInfo.phone).toBe("");
      expect(publicConfig.contactInfo.location).toBe("");
      expect(publicConfig.highlights).toEqual([]);
      expect(publicConfig.faqs).toEqual([]);
      expect(publicConfig.socialLinks).toEqual([]);
    });
  });

  describe("4. Public Form Submission & Honeypot Bot Defense", () => {
    it("persists legitimate user submissions into ContactMessage table", async () => {
      const mockPrisma: any = {
        contactMessage: {
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockResolvedValue({
            id: "msg-101",
            fullName: "Maya Lin",
            email: "maya@example.com",
            subject: "Project Inquiry",
            message: "Looking for full-stack engineering partnership.",
            status: "NEW",
          }),
        },
      };

      const result = await submitPublicContactMessageOperation(
        {
          fullName: "Maya Lin",
          email: "maya@example.com",
          subject: "Project Inquiry",
          message: "Looking for full-stack engineering partnership.",
        },
        { clientIp: "203.0.113.195" },
        mockPrisma
      );

      expect(result.success).toBe(true);
      expect(result.id).toBe("msg-101");
      expect(mockPrisma.contactMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fullName: "Maya Lin",
            email: "maya@example.com",
            status: "NEW",
          }),
        })
      );
    });

    it("silently drops submissions with filled honeypot without creating database record", async () => {
      const mockPrisma: any = {
        contactMessage: {
          create: vi.fn(),
        },
      };

      const result = await submitPublicContactMessageOperation(
        {
          fullName: "Bot Spammer",
          email: "spammer@botnet.org",
          subject: "Crypto Scam",
          message: "Buy cheap tokens now!",
          honeypot: "I am a spam bot filling hidden fields",
        },
        {},
        mockPrisma
      );

      expect(result.success).toBe(true);
      expect(result.id).toBe("filtered");
      expect(mockPrisma.contactMessage.create).not.toHaveBeenCalled();
    });
  });

  describe("5. Messages Inbox Actions", () => {
    const mockPrisma: any = {
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: superAdminUuid,
          email: "superadmin@cobralearn.com",
          role: "SUPER_ADMIN",
          isActive: true,
        }),
      },
      contactMessage: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            fullName: "Sarah Connor",
            email: "sarah@resistance.org",
            subject: "Security",
            message: "Critical advisory note.",
            status: "NEW",
            createdAt: new Date(),
          },
        ]),
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue({
          id: "m-1",
          fullName: "Sarah Connor",
          email: "sarah@resistance.org",
          subject: "Security",
          message: "Critical advisory note.",
          status: "NEW",
        }),
        update: vi.fn().mockResolvedValue({
          id: "m-1",
          status: "READ",
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        delete: vi.fn().mockResolvedValue({ id: "m-1" }),
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: "log-1" }),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      }),
    };

    beforeEach(() => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: superAdminUuid, email: "superadmin@cobralearn.com" } },
            error: null,
          }),
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
              data: { currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [] },
              error: null,
            }),
          },
        },
      };
      (getSupabaseServerClient as any).mockReturnValue(mockSupabase);
    });

    it("lists contact messages with pagination and filtering", async () => {
      const result = await listAdminContactMessagesOperation(
        createAuthRequest(),
        { status: "NEW", search: "Sarah", limit: 20 },
        mockPrisma
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].fullName).toBe("Sarah Connor");
      expect(result.totalCount).toBe(1);
    });

    it("updates message status from NEW to READ and logs audit event", async () => {
      const updated = await updateAdminContactMessageStatusOperation(
        createAuthRequest(),
        {
          messageId: "m-1",
          status: "READ",
          adminNotes: "Checked during morning review",
        },
        mockPrisma
      );

      expect(updated.status).toBe("READ");
      expect(mockPrisma.contactMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "m-1" },
          data: expect.objectContaining({ status: "READ" }),
        })
      );
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalled();
    });

    it("deletes single message with audit trail", async () => {
      const res = await deleteAdminContactMessageOperation(
        createAuthRequest(),
        "m-1",
        mockPrisma
      );

      expect(res.deletedId).toBe("m-1");
      expect(mockPrisma.contactMessage.delete).toHaveBeenCalledWith({
        where: { id: "m-1" },
      });
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalled();
    });

    it("bulk deletes multiple messages atomically", async () => {
      const res = await bulkDeleteAdminContactMessagesOperation(
        createAuthRequest(),
        ["m-1", "m-2", "m-3"],
        mockPrisma
      );

      expect(res.deletedCount).toBe(3);
      expect(mockPrisma.contactMessage.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["m-1", "m-2", "m-3"] } },
      });
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalled();
    });

    it("bulk updates multiple message statuses atomically with audit log", async () => {
      const res = await bulkUpdateAdminContactMessageStatusOperation(
        createAuthRequest(),
        {
          messageIds: ["m-1", "m-2"],
          status: "ARCHIVED",
        },
        mockPrisma
      );

      expect(res.updatedCount).toBe(2);
      expect(mockPrisma.contactMessage.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["m-1", "m-2"] } },
        data: expect.objectContaining({ status: "ARCHIVED" }),
      });
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalled();
    });
  });

  describe("7. Audit Findings Correction Regressions (P0, P1, P2)", () => {
    it("P0: verifies ContactPageConfig initialization SQL includes CURRENT_TIMESTAMP for updatedAt", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "prisma/migrations/20261011180000_contact_schema_alignment/migration.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const migrationSql = fs.readFileSync(migrationPath, "utf-8");
      expect(migrationSql).toContain(
        `INSERT INTO "ContactPageConfig" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;`
      );
    });

    it("P1: submitPublicContactMessageOperation executes inside a transaction with advisory locks", async () => {
      const mockTx = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(1),
        contactMessage: {
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockResolvedValue({
            id: "msg-atomic-1",
            fullName: "Alice Test",
            email: "alice@example.com",
            subject: "Course Inquiry",
            message: "Hello world testing atomic rate limiting.",
            status: "NEW",
            createdAt: new Date(),
          }),
        },
      };

      const customPrisma = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          return await callback(mockTx);
        }),
      } as any;

      const result = await submitPublicContactMessageOperation(
        {
          fullName: "Alice Test",
          email: "alice@example.com",
          subject: "Course Inquiry",
          message: "Hello world testing atomic rate limiting.",
        },
        { clientIp: "192.168.1.1", userAgent: "Mozilla/5.0" },
        customPrisma
      );

      expect(result.success).toBe(true);
      expect(result.id).toBe("msg-atomic-1");
      expect(customPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.$executeRawUnsafe).toHaveBeenCalled();
      expect(mockTx.contactMessage.create).toHaveBeenCalled();
    });

    it("P1: submitPublicContactMessageOperation rejects with rate limit error when count exceeds limit", async () => {
      const mockTx = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(1),
        contactMessage: {
          count: vi.fn().mockResolvedValue(5), // at limit
          create: vi.fn(),
        },
      };

      const customPrisma = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          return await callback(mockTx);
        }),
      } as any;

      await expect(
        submitPublicContactMessageOperation(
          {
            fullName: "Alice Test",
            email: "alice@example.com",
            subject: "Course Inquiry",
            message: "Hello world testing rate limiting rejection.",
          },
          { clientIp: "192.168.1.1", userAgent: "Mozilla/5.0" },
          customPrisma
        )
      ).rejects.toThrow("Rate Limit Exceeded: Too many messages sent from this email address. Please try again later.");

      expect(mockTx.contactMessage.create).not.toHaveBeenCalled();
    });

    it("P1: submitPublicContactMessageOperation rejects with rate limit error when IP count exceeds limit", async () => {
      let countCall = 0;
      const mockTx = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(1),
        contactMessage: {
          count: vi.fn().mockImplementation(() => {
            countCall++;
            // 1st call is for email: return 0. 2nd call is for IP: return 10 (exceeds limit)
            return Promise.resolve(countCall === 1 ? 0 : 10);
          }),
          create: vi.fn(),
        },
      };

      const customPrisma = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          return await callback(mockTx);
        }),
      } as any;

      await expect(
        submitPublicContactMessageOperation(
          {
            fullName: "Bob Test",
            email: "bob@example.com",
            subject: "General Question",
            message: "Testing IP rate limiting.",
          },
          { clientIp: "192.168.1.200", userAgent: "Mozilla/5.0" },
          customPrisma
        )
      ).rejects.toThrow("Rate Limit Exceeded: Too many submissions from your connection. Please wait a few minutes.");

      expect(mockTx.contactMessage.create).not.toHaveBeenCalled();
    });
  });
});
