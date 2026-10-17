import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureDefaultHomepageSections,
  listAdminHomepageSectionsOperation,
  updateAdminHomepageSectionOperation,
  createAdminHomepageSectionOperation,
  reorderAdminHomepageSectionsOperation,
  deleteAdminHomepageSectionOperation,
  getPublicHomepageSectionsOperation,
  validateSafeUrl,
} from "@/lib/server/homepage-operations";
import {
  ensureDefaultNavigationAndFooter,
  listAdminNavigationOperation,
  createAdminNavItemOperation,
  updateAdminNavItemOperation,
  deleteAdminNavItemOperation,
  reorderAdminNavItemsOperation,
  createAdminFooterSectionOperation,
  updateAdminFooterSectionOperation,
  deleteAdminFooterSectionOperation,
  reorderAdminFooterSectionsOperation,
  createAdminSocialLinkOperation,
  updateAdminSocialLinkOperation,
  deleteAdminSocialLinkOperation,
  reorderAdminSocialLinksOperation,
  getPublicNavigationAndFooterOperation,
  validateSafeLink,
} from "@/lib/server/navigation-operations";
import { adminClient } from "@/lib/api/admin-client";
import { resolveNavigationHref } from "@/lib/navigation-utils";
import type { PrismaClient, HomepageSection, NavigationItem, FooterSection, FooterLink, GlobalSocialLink } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

// Mock Supabase Server Client
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

// Mock Supabase Browser Client
vi.mock("@/lib/supabase/browser", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-client-access-token" } },
        error: null,
      }),
    },
  },
}));

describe("Homepage & Navigation Database-Backed CMS Test Suite", () => {
  const adminUuid = "11111111-1111-1111-1111-111111111111";
  const viewerUuid = "22222222-2222-2222-2222-222222222222";

  const adminUser: User = {
    id: adminUuid,
    email: "admin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const viewerUser: User = {
    id: viewerUuid,
    email: "viewer@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const mockAdminProfile = {
    id: "prof-admin",
    userId: adminUuid,
    email: "admin@cobralearn.com",
    role: "SUPER_ADMIN",
    isActive: true,
  };

  const mockViewerProfile = {
    id: "prof-viewer",
    userId: viewerUuid,
    email: "viewer@cobralearn.com",
    role: "VIEWER",
    isActive: true,
  };

  let mockPrisma: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { getSupabaseServerClient } = await import("@/lib/supabase/server");
    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockImplementation((token?: string) => {
          if (token === "viewer-token") {
            return Promise.resolve({ data: { user: viewerUser }, error: null });
          }
          if (token === "admin-token") {
            return Promise.resolve({ data: { user: adminUser }, error: null });
          }
          return Promise.resolve({ data: { user: null }, error: new Error("Invalid token") });
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockImplementation((token?: string) => {
            if (token === "admin-token") {
              return Promise.resolve({
                data: { currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [] },
                error: null,
              });
            }
            return Promise.resolve({
              data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
              error: null,
            });
          }),
        },
      },
    });

    const footerSectionStorage: Record<string, any> = {
      "footer-showcase": {
        id: "footer-showcase",
        title: "Showcase",
        iconName: "Box",
        displayOrder: 1,
        isVisible: true,
        links: [
          { id: "lnk-1", footerSectionId: "footer-showcase", label: "Projects", url: "#projects", openInNewTab: false, displayOrder: 1 },
        ],
      },
    };

    mockPrisma = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          if (where.id === adminUuid || where.userId === adminUuid) return Promise.resolve(mockAdminProfile);
          if (where.id === viewerUuid || where.userId === viewerUuid) return Promise.resolve(mockViewerProfile);
          return Promise.resolve(null);
        }),
      },
      homepageSection: {
        count: vi.fn().mockResolvedValue(4),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "sec-hero",
            name: "Hero Section",
            iconName: "Home",
            enabled: true,
            displayOrder: 1,
            badge: "LEARN • BUILD • GROW",
            title: "CobraLearn Innotechcore",
            subtitle: "Innovation showcase",
            primaryButtonLabel: "Explore Projects",
            primaryButtonLink: "#projects",
            mediaAsset: null,
          },
        ]),
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve({
            id: where.id,
            name: "Hero Section",
            iconName: "Home",
            enabled: true,
            displayOrder: 1,
            badge: "LEARN • BUILD • GROW",
            title: "CobraLearn Innotechcore",
            subtitle: "Innovation showcase",
            mediaAsset: null,
          });
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          return Promise.resolve({
            id: where.id,
            name: data.name ?? "Hero Section",
            iconName: data.iconName ?? "Home",
            enabled: data.enabled ?? true,
            displayOrder: 1,
            badge: data.badge,
            title: data.title ?? "CobraLearn",
            subtitle: data.subtitle ?? "Subtitle",
            primaryButtonLabel: data.primaryButtonLabel,
            primaryButtonLink: data.primaryButtonLink,
            mediaAsset: null,
          });
        }),
        create: vi.fn().mockImplementation(({ data }: any) => ({
          ...data,
          mediaAsset: null,
        })),
        findFirst: vi.fn().mockResolvedValue({ displayOrder: 4 }),
        delete: vi.fn().mockResolvedValue({ id: "sec-custom" }),
      },
      navigationItem: {
        count: vi.fn().mockResolvedValue(7),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "nav-1",
            label: "Home",
            link: "/",
            type: "INTERNAL",
            status: "ACTIVE",
            iconName: "Home",
            openInNewTab: false,
            buttonStyle: null,
            displayOrder: 1,
          },
        ]),
        findUnique: vi.fn().mockResolvedValue({
          id: "nav-1",
          label: "Home",
          link: "/",
          type: "INTERNAL",
          status: "ACTIVE",
          displayOrder: 1,
        }),
        findFirst: vi.fn().mockResolvedValue({ displayOrder: 7 }),
        create: vi.fn().mockImplementation(({ data }: any) => ({ ...data })),
        update: vi.fn().mockImplementation(({ where, data }: any) => ({ id: where.id, ...data })),
        delete: vi.fn().mockResolvedValue({ id: "nav-1" }),
      },
      footerSection: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "footer-showcase",
            title: "Showcase",
            iconName: "Box",
            displayOrder: 1,
            isVisible: true,
            links: [
              { id: "lnk-1", footerSectionId: "footer-showcase", label: "Projects", url: "#projects", openInNewTab: false, displayOrder: 1 },
            ],
          },
        ]),
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(footerSectionStorage[where.id] || {
            id: where.id,
            title: "Showcase",
            iconName: "Box",
            displayOrder: 1,
            isVisible: true,
            links: [],
          });
        }),
        findFirst: vi.fn().mockResolvedValue({ displayOrder: 5 }),
        create: vi.fn().mockImplementation(({ data }: any) => ({ ...data, links: [] })),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          footerSectionStorage[where.id] = {
            ...(footerSectionStorage[where.id] || {}),
            id: where.id,
            ...data,
          };
          return Promise.resolve(footerSectionStorage[where.id]);
        }),
        delete: vi.fn().mockResolvedValue({ id: "footer-showcase" }),
      },
      footerLink: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      globalSocialLink: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ displayOrder: 5 }),
        findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve({
          id: where.id,
          platform: "Twitter",
          url: "https://x.com",
          iconName: "Twitter",
          handle: "@test",
          displayOrder: 1,
          isEnabled: true,
        })),
        create: vi.fn().mockImplementation(({ data }: any) => ({ ...data })),
        update: vi.fn().mockImplementation(({ where, data }: any) => ({ id: where.id, ...data })),
        delete: vi.fn().mockResolvedValue({ id: "soc-1" }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
      $transaction: vi.fn().mockImplementation(async (callback: any) => {
        if (typeof callback === "function") {
          return callback(mockPrisma);
        }
        return Promise.all(callback);
      }),
    };
  });

  // =========================================================================
  // 1. URL & Link Validation
  // =========================================================================
  describe("Input and URL Safety Validation", () => {
    it("accepts safe relative paths and valid HTTPS links", () => {
      expect(validateSafeUrl("/projects")).toBe("/projects");
      expect(validateSafeUrl("#showcase")).toBe("#showcase");
      expect(validateSafeUrl("https://example.com/demo")).toBe("https://example.com/demo");
      expect(validateSafeUrl(null)).toBeNull();
    });

    it("rejects malicious URL schemes in Homepage and Navigation", () => {
      expect(() => validateSafeUrl("javascript:alert(1)")).toThrow(/dangerous protocol/i);
      expect(() => validateSafeUrl("data:text/html,<script>alert(1)</script>")).toThrow(/dangerous protocol/i);
      expect(() => validateSafeUrl("vbscript:msgbox(1)")).toThrow(/dangerous protocol/i);

      expect(() => validateSafeLink("javascript:alert(1)")).toThrow(/dangerous protocol/i);
      expect(() => validateSafeLink("data:text/html")).toThrow(/dangerous protocol/i);
    });

    it("requires non-empty link for navigation items", () => {
      expect(() => validateSafeLink("")).toThrow(/required/i);
      expect(() => validateSafeLink("   ")).toThrow(/required/i);
    });
  });

  // =========================================================================
  // 2. Homepage CMS Operations
  // =========================================================================
  describe("Homepage CMS Server Operations", () => {
    it("lists homepage sections when authorized with CMS_READ", async () => {
      const req = new Request("https://api.internal/admin/homepage", {
        headers: { authorization: "Bearer admin-token" },
      });
      const result = await listAdminHomepageSectionsOperation(req, mockPrisma);
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0]!.id).toBe("sec-hero");
    });

    it("updates homepage section and writes audit log with CMS_UPDATE", async () => {
      const req = new Request("https://api.internal/admin/homepage/sec-hero", {
        method: "PUT",
        headers: { authorization: "Bearer admin-token" },
      });
      const result = await updateAdminHomepageSectionOperation(
        req,
        "sec-hero",
        {
          title: "Updated Title",
          subtitle: "Updated Subtitle",
          primaryButtonLabel: "Click Here",
          primaryButtonLink: "https://example.com",
          enabled: true,
        },
        mockPrisma
      );

      expect(result.section.title).toBe("Updated Title");
      expect(mockPrisma.homepageSection.update).toHaveBeenCalled();
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "HOMEPAGE_SECTION_UPDATED",
            module: "HOMEPAGE_CMS",
            entityId: "sec-hero",
          }),
        })
      );
    });

    it("protects the four core sections from deletion", async () => {
      const req = new Request("https://api.internal/admin/homepage/sec-hero", {
        method: "DELETE",
        headers: { authorization: "Bearer admin-token" },
      });

      await expect(deleteAdminHomepageSectionOperation(req, "sec-hero", mockPrisma)).rejects.toThrow(
        /core homepage section .* cannot be deleted/i
      );

      await expect(deleteAdminHomepageSectionOperation(req, "sec-featured", mockPrisma)).rejects.toThrow(
        /core homepage section/i
      );
    });

    it("allows deletion of custom homepage sections", async () => {
      const req = new Request("https://api.internal/admin/homepage/sec-custom", {
        method: "DELETE",
        headers: { authorization: "Bearer admin-token" },
      });

      const res = await deleteAdminHomepageSectionOperation(req, "sec-custom", mockPrisma);
      expect(res.deletedId).toBe("sec-custom");
      expect(mockPrisma.homepageSection.delete).toHaveBeenCalledWith({ where: { id: "sec-custom" } });
    });

    it("returns enabled homepage sections for unauthenticated public requests", async () => {
      const res = await getPublicHomepageSectionsOperation(mockPrisma);
      expect(res.sections).toBeDefined();
      expect(mockPrisma.homepageSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { enabled: true },
          orderBy: { displayOrder: "asc" },
        })
      );
    });
  });

  // =========================================================================
  // 3. Navigation & Footer CMS Operations
  // =========================================================================
  describe("Navigation & Footer Server Operations", () => {
    it("lists navigation items, footer sections, and social links with CMS_READ", async () => {
      const req = new Request("https://api.internal/admin/navigation", {
        headers: { authorization: "Bearer admin-token" },
      });
      const res = await listAdminNavigationOperation(req, mockPrisma);
      expect(res.navItems).toBeDefined();
      expect(res.footerSections).toBeDefined();
      expect(res.socialLinks).toBeDefined();
    });

    it("creates navigation item with auto displayOrder and audit log", async () => {
      const req = new Request("https://api.internal/admin/navigation/items", {
        method: "POST",
        headers: { authorization: "Bearer admin-token" },
      });

      const res = await createAdminNavItemOperation(
        req,
        {
          label: "Careers",
          link: "/careers",
          type: "Internal",
          status: "Active",
        },
        mockPrisma
      );

      expect(res.navItem.label).toBe("Careers");
      expect(res.navItem.displayOrder).toBe(8);
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalled();
    });

    it("updates navigation item and normalizes enums", async () => {
      const req = new Request("https://api.internal/admin/navigation/items/nav-1", {
        method: "PUT",
        headers: { authorization: "Bearer admin-token" },
      });

      const res = await updateAdminNavItemOperation(
        req,
        "nav-1",
        {
          label: "Home Page",
          type: "Internal",
          status: "Inactive",
        },
        mockPrisma
      );

      expect(res.navItem.label).toBe("Home Page");
      expect(res.navItem.status).toBe("INACTIVE");
    });

    it("deletes navigation item and logs audit", async () => {
      const req = new Request("https://api.internal/admin/navigation/items/nav-1", {
        method: "DELETE",
        headers: { authorization: "Bearer admin-token" },
      });

      const res = await deleteAdminNavItemOperation(req, "nav-1", mockPrisma);
      expect(res.deletedId).toBe("nav-1");
      expect(mockPrisma.navigationItem.delete).toHaveBeenCalledWith({ where: { id: "nav-1" } });
    });

    it("updates footer section and synchronizes child links in transaction", async () => {
      const req = new Request("https://api.internal/admin/navigation/footer/footer-showcase", {
        method: "PUT",
        headers: { authorization: "Bearer admin-token" },
      });

      const res = await updateAdminFooterSectionOperation(
        req,
        "footer-showcase",
        {
          title: "Showcase Hub",
          isVisible: true,
          links: [
            { label: "Projects", url: "#projects" },
            { label: "Websites", url: "#websites" },
          ],
        },
        mockPrisma
      );

      expect(res.section.title).toBe("Showcase Hub");
      expect(mockPrisma.footerLink.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.footerLink.createMany).toHaveBeenCalled();
    });

    it("returns public navigation items and footer sections filtered by active and visible", async () => {
      const res = await getPublicNavigationAndFooterOperation(mockPrisma);
      expect(res.navItems).toBeDefined();
      expect(res.footerSections).toBeDefined();
      expect(res.socialLinks).toBeDefined();

      expect(mockPrisma.navigationItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "ACTIVE" },
        })
      );
      expect(mockPrisma.footerSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isVisible: true },
        })
      );
    });

    it("creates, updates, deletes, and reorders GlobalSocialLink with admin permission", async () => {
      const adminReq = new Request("https://api.internal/admin/social-links", {
        method: "POST",
        headers: { authorization: "Bearer admin-token" },
      });

      // 1. Create Social Link
      const created = await createAdminSocialLinkOperation(
        adminReq,
        { platform: "Discord", url: "https://discord.gg/test", handle: "discord_comm" },
        mockPrisma
      );
      expect(created.socialLink.platform).toBe("Discord");
      expect(mockPrisma.globalSocialLink.create).toHaveBeenCalled();

      // 2. Reject unsafe URL on create
      await expect(
        createAdminSocialLinkOperation(
          adminReq,
          { platform: "Malicious", url: "javascript:alert(1)" },
          mockPrisma
        )
      ).rejects.toThrow(/dangerous protocol/i);

      // 3. Update Social Link
      const updated = await updateAdminSocialLinkOperation(
        adminReq,
        "soc-1",
        { platform: "Discord Updated", url: "https://discord.com" },
        mockPrisma
      );
      expect(updated.socialLink.platform).toBe("Discord Updated");

      // 4. Reorder Social Links
      const reordered = await reorderAdminSocialLinksOperation(
        adminReq,
        ["soc-1", "soc-2"],
        mockPrisma
      );
      expect(reordered.success).toBe(true);

      // 5. Delete Social Link
      const deleted = await deleteAdminSocialLinkOperation(
        adminReq,
        "soc-1",
        mockPrisma
      );
      expect(deleted.deletedId).toBe("soc-1");
    });
  });

  // =========================================================================
  // 4. Server-Side RBAC Enforcement
  // =========================================================================
  describe("Server-Side RBAC Authorization Enforcement", () => {
    it("denies unauthenticated requests with HTTP 401", async () => {
      const req = new Request("https://api.internal/admin/homepage", {
        headers: {}, // No token
      });
      await expect(listAdminHomepageSectionsOperation(req, mockPrisma)).rejects.toThrow(
        /no cookie header|unauthorized/i
      );
    });

    it("denies VIEWER role attempting to update Homepage with HTTP 403", async () => {
      const req = new Request("https://api.internal/admin/homepage/sec-hero", {
        method: "PUT",
        headers: { authorization: "Bearer viewer-token" },
      });
      await expect(
        updateAdminHomepageSectionOperation(
          req,
          "sec-hero",
          { title: "Hacked" },
          mockPrisma
        )
      ).rejects.toThrow(/forbidden/i);
    });

    it("denies VIEWER role attempting to create navigation item with HTTP 403", async () => {
      const req = new Request("https://api.internal/admin/navigation/items", {
        method: "POST",
        headers: { authorization: "Bearer viewer-token" },
      });
      await expect(
        createAdminNavItemOperation(
          req,
          { label: "Disallowed", link: "/test" },
          mockPrisma
        )
      ).rejects.toThrow(/forbidden/i);
    });
  });

  // =========================================================================
  // 5. Verification for Three CMS Functional Issues
  // =========================================================================
  describe("Three Manually Verified CMS Issues Verification", () => {
    describe("Issue 1 & 2: Social Links Enabled/Disabled Preview and Public Filtering", () => {
      it("public footer operation excludes disabled social links and preserves enabled order", async () => {
        const testLinks = [
          { id: "soc-1", platform: "LinkedIn", url: "https://linkedin.com", isEnabled: true, displayOrder: 1 },
          { id: "soc-2", platform: "GitHub", url: "https://github.com", isEnabled: false, displayOrder: 2 },
          { id: "soc-3", platform: "YouTube", url: "https://youtube.com", isEnabled: true, displayOrder: 3 },
          { id: "soc-4", platform: "X (Twitter)", url: "https://x.com", isEnabled: false, displayOrder: 4 },
        ];
        mockPrisma.globalSocialLink.findMany = vi.fn().mockImplementation(({ where }: any) => {
          if (where?.isEnabled) {
            return Promise.resolve(testLinks.filter((l) => l.isEnabled));
          }
          return Promise.resolve(testLinks);
        });

        const publicData = await getPublicNavigationAndFooterOperation(mockPrisma);
        expect(mockPrisma.globalSocialLink.findMany).toHaveBeenCalledWith({
          where: { isEnabled: true },
          orderBy: { displayOrder: "asc" },
        });
        expect(publicData.socialLinks).toHaveLength(2);
        expect(publicData.socialLinks.map((s: any) => s.platform)).toEqual(["LinkedIn", "YouTube"]);
      });

      it("public footer operation returns empty array when all social links are disabled", async () => {
        mockPrisma.globalSocialLink.findMany = vi.fn().mockResolvedValue([]);

        const publicData = await getPublicNavigationAndFooterOperation(mockPrisma);
        expect(publicData.socialLinks).toEqual([]);
      });

      it("admin list operation returns all social links including disabled with enabled state", async () => {
        const adminReq = new Request("https://api.internal/admin/navigation", {
          headers: { authorization: "Bearer admin-token" },
        });

        mockPrisma.globalSocialLink.findMany = vi.fn().mockResolvedValue([
          { id: "soc-1", platform: "LinkedIn", url: "https://linkedin.com", isEnabled: true, displayOrder: 1 },
          { id: "soc-2", platform: "GitHub", url: "https://github.com", isEnabled: false, displayOrder: 2 },
        ]);

        const adminData = await listAdminNavigationOperation(adminReq, mockPrisma);
        expect(mockPrisma.globalSocialLink.findMany).toHaveBeenCalledWith({
          orderBy: { displayOrder: "asc" },
        });
        expect(adminData.socialLinks).toHaveLength(2);
        expect(adminData.socialLinks[0].isEnabled).toBe(true);
        expect(adminData.socialLinks[1].isEnabled).toBe(false);
      });
    });

    describe("Issue 2: Footer Parity Across Routes", () => {
      it("homepage and contact route both query identical public footer sections and links", async () => {
        const testSections = [
          {
            id: "sec-1",
            title: "Solutions",
            iconName: "Layers",
            displayOrder: 1,
            isVisible: true,
            links: [
              { id: "l-1", label: "Web", url: "/websites", displayOrder: 1, openInNewTab: false },
              { id: "l-2", label: "Contact", url: "/contact", displayOrder: 2, openInNewTab: false },
            ],
          },
        ];

        mockPrisma.footerSection.findMany = vi.fn().mockResolvedValue(testSections);
        mockPrisma.globalSocialLink.findMany = vi.fn().mockResolvedValue([
          { id: "soc-1", platform: "GitHub", url: "https://github.com", isEnabled: true, displayOrder: 1 },
        ]);

        const homepageFooterData = await getPublicNavigationAndFooterOperation(mockPrisma);
        const contactFooterData = await getPublicNavigationAndFooterOperation(mockPrisma);

        expect(homepageFooterData.footerSections).toEqual(contactFooterData.footerSections);
        expect(homepageFooterData.socialLinks).toEqual(contactFooterData.socialLinks);
        expect(homepageFooterData.footerSections[0].links).toHaveLength(2);
      });
    });

    describe("Issue 3: Route-Aware Navigation Href Resolution", () => {
      it("resolves #contact to /contact from homepage and other pages", () => {
        expect(resolveNavigationHref("#contact", "/")).toBe("/contact");
        expect(resolveNavigationHref("/#contact", "/")).toBe("/contact");
        expect(resolveNavigationHref("contact", "/")).toBe("/contact");
        expect(resolveNavigationHref("#contact", "/projects")).toBe("/contact");
      });

      it("preserves in-page anchor scrolling on the homepage for sections that exist on homepage", () => {
        expect(resolveNavigationHref("#projects", "/")).toBe("#projects");
        expect(resolveNavigationHref("#websites", "/")).toBe("#websites");
        expect(resolveNavigationHref("#advertisements", "/")).toBe("#advertisements");
        expect(resolveNavigationHref("#awards", "/")).toBe("#awards");
      });

      it("prefixes homepage section anchors with / when navigating from non-homepage routes", () => {
        expect(resolveNavigationHref("#projects", "/contact")).toBe("/#projects");
        expect(resolveNavigationHref("#websites", "/contact")).toBe("/#websites");
      });

      it("preserves external URLs, absolute paths, and protocols safely", () => {
        expect(resolveNavigationHref("https://github.com/cobralearn", "/")).toBe("https://github.com/cobralearn");
        expect(resolveNavigationHref("http://example.com", "/contact")).toBe("http://example.com");
        expect(resolveNavigationHref("mailto:hello@cobralearn.com", "/")).toBe("mailto:hello@cobralearn.com");
        expect(resolveNavigationHref("tel:+919876543210", "/")).toBe("tel:+919876543210");
        expect(resolveNavigationHref("/projects", "/contact")).toBe("/projects");
      });

      it("neutralizes dangerous schemes like javascript: or data:", () => {
        expect(resolveNavigationHref("javascript:alert(1)", "/")).toBe("#");
        expect(resolveNavigationHref("data:text/html,<script>alert(1)</script>", "/")).toBe("#");
      });
    });
  });
});
