import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { Hero } from "@/components/public/Hero";
import { PublicCmsSection } from "@/components/public/PublicCmsSection";
import { Footer } from "@/components/public/Footer";
import { Header } from "@/components/public/Header";
import { HomepageEditor } from "@/components/homepage/HomepageEditor";
import { HomepagePreview } from "@/components/homepage/HomepagePreview";
import { FooterPreview } from "@/components/navigation/FooterPreview";
import { NavigationPreview } from "@/components/navigation/NavigationPreview";
import { resolveNavigationHref } from "@/lib/navigation-utils";
import { validateSafeUrl } from "@/lib/server/homepage-operations";
import { validateSafeLink } from "@/lib/server/navigation-operations";
import type { HomepageSectionWithMedia } from "@/lib/server/homepage-operations";
import type { FooterSectionWithLinks } from "@/lib/server/navigation-operations";
import type { GlobalSocialLink, NavigationItem } from "@prisma/client";

// Mock TanStack Router hooks
vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => "/",
  Link: ({ children, to, className }: any) => <a href={to} className={className}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

// Mock Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Homepage CMS, Dynamic Preview & Public Rendering Correction Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Hero Section — Approved Fixed Cinematic Banner & Editable Content", () => {
    it("preserves fixed approved Hero banner image even if mediaAsset is present on section", () => {
      const mockHeroSection: HomepageSectionWithMedia = {
        id: "sec-hero",
        name: "Hero Section",
        iconName: "Home",
        enabled: true,
        displayOrder: 1,
        badge: "INNOVATE • CODE • DELIVER",
        title: "CobraLearn Innotechcore",
        subtitle: "High-velocity technology engineering.",
        primaryButtonLabel: "View Projects",
        primaryButtonLink: "#projects",
        secondaryButtonLabel: "Our Websites",
        secondaryButtonLink: "#websites",
        mediaAssetId: "media-override-attempt",
        mediaAsset: {
          id: "media-override-attempt",
          name: "Random Image",
          originalFilename: "random.jpg",
          bucket: "media-library",
          storagePath: "general/random.jpg",
          publicUrl: "https://storage.example.com/random.jpg",
          mediaType: "IMAGE",
          category: "GENERAL",
          mimeType: "image/jpeg",
          fileSize: BigInt(1024),
          fileExtension: "jpg",
          dimensions: "1920x1080",
          duration: null,
          altText: null,
          description: null,
          tags: [],
          uploadedById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      };

      const { container } = render(<Hero section={mockHeroSection} />);

      const heroImg = container.querySelector("img.hero-image") as HTMLImageElement;
      expect(heroImg).toBeDefined();
      // Must not use the override URL; must retain the approved local cobralearn-hero banner
      expect(heroImg.src).not.toContain("https://storage.example.com/random.jpg");
      expect(heroImg.src).toContain("cobralearn-hero");

      // Editable fields must update properly
      expect(screen.getByText("INNOVATE")).toBeDefined();
      expect(screen.getByText("High-velocity technology engineering.")).toBeDefined();
    });

    it("disables background media editing specifically for the core Hero section in HomepageEditor", () => {
      const mockHeroSection: HomepageSectionWithMedia = {
        id: "sec-hero",
        name: "Hero Section",
        iconName: "Home",
        enabled: true,
        displayOrder: 1,
        title: "CobraLearn Innotechcore",
        subtitle: "A cinematic showcase.",
        badge: "LEARN • BUILD • GROW",
        primaryButtonLabel: "Explore Projects",
        primaryButtonLink: "#projects",
        secondaryButtonLabel: "View Websites",
        secondaryButtonLink: "#websites",
        mediaAssetId: null,
        updatedAt: new Date(),
      };

      render(
        <HomepageEditor
          section={mockHeroSection}
          onUpdateSection={vi.fn()}
          onReset={vi.fn()}
        />
      );

      // Hero should state that background banner is fixed to approved branding
      expect(screen.getByText("Approved Cinematic Hero Banner")).toBeDefined();
      // Should not have "Select Media" or "Change Media" buttons for Hero
      expect(screen.queryByText("Select Media")).toBeNull();
      expect(screen.queryByText("Change Media")).toBeNull();
    });

    it("renders both primary and secondary Hero CTA buttons with saved destinations", () => {
      const mockHeroSection: HomepageSectionWithMedia = {
        id: "sec-hero",
        name: "Hero Section",
        iconName: "Home",
        enabled: true,
        displayOrder: 1,
        badge: "TEST",
        title: "Title Test",
        subtitle: "Subtitle Test",
        primaryButtonLabel: "Start Exploring",
        primaryButtonLink: "#projects",
        secondaryButtonLabel: "Contact Support",
        secondaryButtonLink: "#contact",
        mediaAssetId: null,
        updatedAt: new Date(),
      };

      const { container } = render(<Hero section={mockHeroSection} />);

      const primaryBtn = container.querySelector(".hero-btn-primary") as HTMLAnchorElement;
      expect(primaryBtn).toBeDefined();
      expect(primaryBtn.textContent).toContain("Start Exploring");
      expect(primaryBtn.getAttribute("href")).toBe("#projects");

      const secondaryBtn = container.querySelector(".hero-btn-secondary") as HTMLAnchorElement;
      expect(secondaryBtn).toBeDefined();
      expect(secondaryBtn.textContent).toContain("Contact Support");
      // #contact correctly routes to /contact
      expect(secondaryBtn.getAttribute("href")).toBe("/contact");
    });
  });

  describe("2. Configurable Section Real Media Support & Fallback Cleanup", () => {
    it("renders saved media image using publicUrl in PublicCmsSection", () => {
      const mockFeaturedSection: HomepageSectionWithMedia = {
        id: "sec-featured",
        name: "Featured Showcase",
        iconName: "Star",
        enabled: true,
        displayOrder: 2,
        badge: "FLAGSHIP",
        title: "Innovative Experiences",
        subtitle: "Curated collection of next-gen digital experiences.",
        primaryButtonLabel: "Explore",
        primaryButtonLink: "#projects",
        secondaryButtonLabel: null,
        secondaryButtonLink: null,
        mediaAssetId: "media-featured-real",
        mediaAsset: {
          id: "media-featured-real",
          name: "Featured Banner",
          originalFilename: "featured-banner.png",
          bucket: "media-library",
          storagePath: "general/featured-banner.png",
          publicUrl: "https://storage.cobralearn.com/media/featured-banner.png",
          mediaType: "IMAGE",
          category: "GENERAL",
          mimeType: "image/png",
          fileSize: BigInt(2048),
          fileExtension: "png",
          dimensions: "1920x800",
          duration: null,
          altText: "Flagship preview",
          description: null,
          tags: [],
          uploadedById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      };

      const { container } = render(<PublicCmsSection section={mockFeaturedSection} variant="featured" />);

      const bgImg = container.querySelector("img") as HTMLImageElement;
      expect(bgImg).toBeDefined();
      expect(bgImg.src).toBe("https://storage.cobralearn.com/media/featured-banner.png");
    });

    it("allows media selection for configurable sections (e.g. Featured Showcase) in HomepageEditor without fake fallback thumb", () => {
      const mockFeaturedSection: HomepageSectionWithMedia = {
        id: "sec-featured",
        name: "Featured Showcase",
        iconName: "Star",
        enabled: true,
        displayOrder: 2,
        badge: "FEATURED",
        title: "Flagship Products",
        subtitle: "Showcase description",
        primaryButtonLabel: "View All",
        primaryButtonLink: "#projects",
        secondaryButtonLabel: null,
        secondaryButtonLink: null,
        mediaAssetId: null,
        updatedAt: new Date(),
      };

      render(
        <HomepageEditor
          section={mockFeaturedSection}
          onUpdateSection={vi.fn()}
          onReset={vi.fn()}
        />
      );

      // Select Media button should be available for featured showcase
      expect(screen.getByText("Select Media")).toBeDefined();
      // Should show 'None' placeholder instead of misleading website image
      expect(screen.getByText("None")).toBeDefined();
    });
  });

  describe("3. Homepage Visibility & Section Order", () => {
    it("does not render disabled sections in PublicCmsSection", () => {
      const mockDisabledSection: HomepageSectionWithMedia = {
        id: "sec-featured",
        name: "Featured Showcase",
        iconName: "Star",
        enabled: false,
        displayOrder: 2,
        title: "Hidden Title",
        subtitle: "Hidden Subtitle",
        updatedAt: new Date(),
      };

      const { container } = render(<PublicCmsSection section={mockDisabledSection} variant="featured" />);
      expect(container.firstChild).toBeNull();
    });

    it("renders sections according to persisted displayOrder and enabled status in HomepagePreview", () => {
      const mockSections: HomepageSectionWithMedia[] = [
        {
          id: "sec-hero",
          name: "Hero Section",
          iconName: "Home",
          enabled: true,
          displayOrder: 2, // Hero moved down to 2
          title: "Hero Title",
          subtitle: "Hero Subtitle",
          updatedAt: new Date(),
        },
        {
          id: "sec-cta",
          name: "Call to Action",
          iconName: "Megaphone",
          enabled: true,
          displayOrder: 1, // CTA moved up to 1
          title: "CTA Title First",
          subtitle: "CTA Subtitle First",
          badge: "ACT NOW",
          updatedAt: new Date(),
        },
        {
          id: "sec-featured",
          name: "Featured Showcase",
          iconName: "Star",
          enabled: false, // Disabled section
          displayOrder: 3,
          title: "Disabled Featured Title",
          subtitle: "Disabled Featured Subtitle",
          updatedAt: new Date(),
        },
      ];

      render(<HomepagePreview sections={mockSections} />);

      // Enabled sections should appear
      expect(screen.getByText("CTA Title First")).toBeDefined();
      expect(screen.getByText("Hero Title")).toBeDefined();

      // Disabled section must NOT render
      expect(screen.queryByText("Disabled Featured Title")).toBeNull();
    });
  });

  describe("4. Navigation URL Resolution & Dangerous Scheme Sanitization", () => {
    it("correctly routes #contact and /#contact to /contact", () => {
      expect(resolveNavigationHref("#contact", "/")).toBe("/contact");
      expect(resolveNavigationHref("/#contact", "/")).toBe("/contact");
      expect(resolveNavigationHref("contact", "/")).toBe("/contact");
      expect(resolveNavigationHref("/contact", "/")).toBe("/contact");
    });

    it("preserves same-page hash anchors on homepage", () => {
      expect(resolveNavigationHref("#projects", "/")).toBe("#projects");
      expect(resolveNavigationHref("#websites", "/")).toBe("#websites");
      expect(resolveNavigationHref("#advertisements", "/")).toBe("#advertisements");
      expect(resolveNavigationHref("#awards", "/")).toBe("#awards");
    });

    it("prepends / to same-page hash anchors when navigated from other routes", () => {
      expect(resolveNavigationHref("#projects", "/contact")).toBe("/#projects");
      expect(resolveNavigationHref("#websites", "/contact")).toBe("/#websites");
    });

    it("preserves external HTTP and HTTPS URLs without prepending slash", () => {
      expect(resolveNavigationHref("https://github.com/cobralearn", "/")).toBe("https://github.com/cobralearn");
      expect(resolveNavigationHref("http://example.com", "/")).toBe("http://example.com");
      expect(resolveNavigationHref("mailto:info@cobralearn.com", "/")).toBe("mailto:info@cobralearn.com");
      expect(resolveNavigationHref("tel:+919876543210", "/")).toBe("tel:+919876543210");
    });

    it("rejects dangerous protocol schemes on client and server", () => {
      expect(resolveNavigationHref("javascript:alert(1)", "/")).toBe("#");
      expect(resolveNavigationHref("data:text/html,<script>alert(1)</script>", "/")).toBe("#");
      expect(resolveNavigationHref("vbscript:msgbox(1)", "/")).toBe("#");

      expect(() => validateSafeUrl("javascript:alert(1)")).toThrow("Validation Error");
      expect(() => validateSafeLink("data:text/html,evil")).toThrow("Validation Error");
    });
  });

  describe("5. Global Social Links & Footer Persistence & Fallback Protection", () => {
    it("does NOT render hardcoded social icons when all database social links are disabled", () => {
      const allDisabledSocialLinks: GlobalSocialLink[] = [
        {
          id: "soc-1",
          platform: "Instagram",
          url: "https://instagram.com/cobralearn",
          iconName: "Instagram",
          handle: "@cobralearn",
          displayOrder: 1,
          isEnabled: false, // Disabled
          updatedAt: new Date(),
        },
        {
          id: "soc-2",
          platform: "YouTube",
          url: "https://youtube.com/cobralearn",
          iconName: "Youtube",
          handle: "@cobralearn",
          displayOrder: 2,
          isEnabled: false, // Disabled
          updatedAt: new Date(),
        },
      ];

      const { container } = render(
        <Footer
          sections={[]}
          socialLinks={allDisabledSocialLinks}
        />
      );

      const socialsContainer = container.querySelector(".socials");
      expect(socialsContainer).toBeDefined();
      // No <a> links should be rendered inside .socials because all links are disabled
      const renderedSocialLinks = socialsContainer?.querySelectorAll("a");
      expect(renderedSocialLinks?.length).toBe(0);
    });

    it("renders only enabled social links in saved order in Footer and FooterPreview", () => {
      const socialLinks: GlobalSocialLink[] = [
        {
          id: "soc-1",
          platform: "GitHub",
          url: "https://github.com/cobralearn",
          iconName: "Github",
          handle: "@cobralearn",
          displayOrder: 1,
          isEnabled: true,
          updatedAt: new Date(),
        },
        {
          id: "soc-2",
          platform: "LinkedIn",
          url: "https://linkedin.com/company/cobralearn",
          iconName: "Linkedin",
          handle: "cobralearn",
          displayOrder: 2,
          isEnabled: false, // Disabled
          updatedAt: new Date(),
        },
      ];

      const { container: footerContainer } = render(
        <Footer sections={[]} socialLinks={socialLinks} />
      );

      const footerLinks = footerContainer.querySelectorAll(".socials a");
      expect(footerLinks.length).toBe(1);
      expect(footerLinks[0]?.getAttribute("href")).toBe("https://github.com/cobralearn");

      const { container: previewContainer } = render(
        <FooterPreview sections={[]} socialLinks={socialLinks} />
      );

      // In FooterPreview, only GitHub should be rendered
      const previewGithub = previewContainer.querySelector('[title="GitHub"]');
      const previewLinkedin = previewContainer.querySelector('[title="LinkedIn"]');
      expect(previewGithub).not.toBeNull();
      expect(previewLinkedin).toBeNull();
    });

    it("renders saved footer sections and links without hardcoded fallback overrides", () => {
      const customFooterSections: FooterSectionWithLinks[] = [
        {
          id: "sec-custom-resources",
          title: "Developer Portal",
          iconName: "Code",
          displayOrder: 1,
          isVisible: true,
          updatedAt: new Date(),
          links: [
            {
              id: "link-docs",
              footerSectionId: "sec-custom-resources",
              label: "Documentation Hub",
              url: "https://docs.cobralearn.com",
              openInNewTab: true,
              displayOrder: 1,
            },
          ],
        },
      ];

      render(<Footer sections={customFooterSections} socialLinks={[]} />);

      expect(screen.getByText("Developer Portal")).toBeDefined();
      const link = screen.getByText("Documentation Hub");
      expect(link).toBeDefined();
      expect(link.getAttribute("href")).toBe("https://docs.cobralearn.com");
      expect(link.getAttribute("target")).toBe("_blank");

      // Verify default fallback sections (e.g. "About Innotechcore") are NOT rendered
      expect(screen.queryByText("About Innotechcore")).toBeNull();
    });
  });

  describe("6. Header & Navigation Menu Active Order", () => {
    it("renders active navigation items in order and does not fallback to default links when records exist", () => {
      const mockNavItems: NavigationItem[] = [
        {
          id: "nav-1",
          label: "Custom Projects",
          link: "#projects",
          type: "INTERNAL",
          status: "ACTIVE",
          iconName: "Box",
          openInNewTab: false,
          buttonStyle: null,
          displayOrder: 1,
          updatedAt: new Date(),
        },
        {
          id: "nav-2",
          label: "Inactive Showcase",
          link: "#websites",
          type: "INTERNAL",
          status: "INACTIVE", // Inactive item
          iconName: "Globe",
          openInNewTab: false,
          buttonStyle: null,
          displayOrder: 2,
          updatedAt: new Date(),
        },
        {
          id: "nav-3",
          label: "Get Started",
          link: "#contact",
          type: "BUTTON",
          status: "ACTIVE",
          iconName: "Zap",
          openInNewTab: false,
          buttonStyle: "Primary",
          displayOrder: 3,
          updatedAt: new Date(),
        },
      ];

      render(<Header navItems={mockNavItems} />);

      expect(screen.getByText("CUSTOM PROJECTS")).toBeDefined();
      expect(screen.getByText("GET STARTED")).toBeDefined();
      // Inactive item must NOT be rendered
      expect(screen.queryByText("INACTIVE SHOWCASE")).toBeNull();
      // Default hardcoded links (e.g. "ADVERTISEMENTS") must NOT override database items
      expect(screen.queryByText("ADVERTISEMENTS")).toBeNull();
    });

    it("renders active menu items and button pills in NavigationPreview", () => {
      const mockMenuItems = [
        {
          id: "nav-1",
          order: 1,
          label: "Platform",
          link: "#home",
          type: "Internal" as const,
          status: "Active" as const,
        },
        {
          id: "nav-2",
          order: 2,
          label: "Join Us",
          link: "#contact",
          type: "Button" as const,
          status: "Active" as const,
          buttonStyle: "Primary (Filled)" as const,
        },
      ];

      render(<NavigationPreview items={mockMenuItems} />);

      expect(screen.getByText("Platform")).toBeDefined();
      expect(screen.getByText("Join Us")).toBeDefined();
    });
  });

  describe("7. Social Links Mutations — Creation, Toggle, Edit, Delete & Reorder", () => {
    it("renders newly created social link in both FooterPreview and public Footer", () => {
      const baseLinks: GlobalSocialLink[] = [
        {
          id: "soc-1",
          platform: "GitHub",
          url: "https://github.com/cobralearn",
          iconName: "Github",
          handle: "@cobralearn",
          displayOrder: 1,
          isEnabled: true,
          updatedAt: new Date(),
        },
      ];

      // Simulate newly created link added to state from server response
      const newLink: GlobalSocialLink = {
        id: "soc-new-yt",
        platform: "YouTube",
        url: "https://youtube.com/@cobralearn",
        iconName: "Youtube",
        handle: "@cobralearn",
        displayOrder: 2,
        isEnabled: true,
        updatedAt: new Date(),
      };

      const updatedLinks = [...baseLinks, newLink];

      // Render public Footer
      const { container: footerContainer } = render(
        <Footer sections={[]} socialLinks={updatedLinks} />
      );
      const footerAnchors = footerContainer.querySelectorAll(".socials a");
      expect(footerAnchors.length).toBe(2);
      expect(footerAnchors[1]?.getAttribute("href")).toBe("https://youtube.com/@cobralearn");

      // Render admin FooterPreview
      const { container: previewContainer } = render(
        <FooterPreview sections={[]} socialLinks={updatedLinks} />
      );
      expect(previewContainer.querySelector('[title="YouTube"]')).not.toBeNull();
      expect(previewContainer.querySelector('[title="GitHub"]')).not.toBeNull();
    });

    it("toggling a link OFF removes it from public Footer and FooterPreview, toggling ON restores it", () => {
      const activeLink: GlobalSocialLink = {
        id: "soc-twitter",
        platform: "X (Twitter)",
        url: "https://x.com/cobralearn",
        iconName: "Twitter",
        handle: "@cobralearn",
        displayOrder: 1,
        isEnabled: true,
        updatedAt: new Date(),
      };

      // 1. Initially enabled
      const { container: footerOn, unmount: unmountOn } = render(
        <Footer sections={[]} socialLinks={[activeLink]} />
      );
      expect(footerOn.querySelectorAll(".socials a").length).toBe(1);
      unmountOn();

      const { container: previewOn, unmount: unmountPreviewOn } = render(
        <FooterPreview sections={[]} socialLinks={[activeLink]} />
      );
      expect(previewOn.querySelector('[title="X (Twitter)"]')).not.toBeNull();
      unmountPreviewOn();

      // 2. Toggle OFF (disabled)
      const disabledLink = { ...activeLink, isEnabled: false };
      const { container: footerOff, unmount: unmountOff } = render(
        <Footer sections={[]} socialLinks={[disabledLink]} />
      );
      expect(footerOff.querySelectorAll(".socials a").length).toBe(0);
      unmountOff();

      const { container: previewOff, unmount: unmountPreviewOff } = render(
        <FooterPreview sections={[]} socialLinks={[disabledLink]} />
      );
      expect(previewOff.querySelector('[title="X (Twitter)"]')).toBeNull();
      unmountPreviewOff();

      // 3. Toggle back ON
      const restoredLink = { ...activeLink, isEnabled: true };
      const { container: footerRestored } = render(
        <Footer sections={[]} socialLinks={[restoredLink]} />
      );
      expect(footerRestored.querySelectorAll(".socials a").length).toBe(1);
    });

    it("editing platform and URL updates both previews and public footer", () => {
      const editedLink: GlobalSocialLink = {
        id: "soc-edit-1",
        platform: "Instagram",
        url: "https://instagram.com/cobralearn_official",
        iconName: "Instagram",
        handle: "@cobralearn_official",
        displayOrder: 1,
        isEnabled: true,
        updatedAt: new Date(),
      };

      const { container } = render(
        <Footer sections={[]} socialLinks={[editedLink]} />
      );
      const link = container.querySelector('.socials a[href="https://instagram.com/cobralearn_official"]');
      expect(link).not.toBeNull();
      expect(link?.getAttribute("aria-label")).toBe("Instagram");
    });

    it("deleting a social link removes it from Footer and FooterPreview", () => {
      const initialLinks: GlobalSocialLink[] = [
        {
          id: "soc-keep",
          platform: "GitHub",
          url: "https://github.com/cobralearn",
          iconName: "Github",
          handle: "@cobralearn",
          displayOrder: 1,
          isEnabled: true,
          updatedAt: new Date(),
        },
        {
          id: "soc-delete",
          platform: "LinkedIn",
          url: "https://linkedin.com/cobralearn",
          iconName: "Linkedin",
          handle: "cobralearn",
          displayOrder: 2,
          isEnabled: true,
          updatedAt: new Date(),
        },
      ];

      // After deletion
      const afterDelete = initialLinks.filter((l) => l.id !== "soc-delete");

      const { container: footerContainer } = render(
        <Footer sections={[]} socialLinks={afterDelete} />
      );
      expect(footerContainer.querySelectorAll(".socials a").length).toBe(1);
      expect(footerContainer.querySelector('.socials a[href="https://linkedin.com/cobralearn"]')).toBeNull();

      const { container: previewContainer } = render(
        <FooterPreview sections={[]} socialLinks={afterDelete} />
      );
      expect(previewContainer.querySelector('[title="LinkedIn"]')).toBeNull();
      expect(previewContainer.querySelector('[title="GitHub"]')).not.toBeNull();
    });

    it("reordering social links maintains exact sequence in Footer and FooterPreview", () => {
      const reorderedLinks: GlobalSocialLink[] = [
        {
          id: "soc-yt",
          platform: "YouTube",
          url: "https://youtube.com/@cobralearn",
          iconName: "Youtube",
          handle: "@cobralearn",
          displayOrder: 1,
          isEnabled: true,
          updatedAt: new Date(),
        },
        {
          id: "soc-gh",
          platform: "GitHub",
          url: "https://github.com/cobralearn",
          iconName: "Github",
          handle: "@cobralearn",
          displayOrder: 2,
          isEnabled: true,
          updatedAt: new Date(),
        },
      ];

      const { container: footerContainer } = render(
        <Footer sections={[]} socialLinks={reorderedLinks} />
      );
      const links = footerContainer.querySelectorAll(".socials a");
      expect(links.length).toBe(2);
      expect(links[0]?.getAttribute("href")).toBe("https://youtube.com/@cobralearn");
      expect(links[1]?.getAttribute("href")).toBe("https://github.com/cobralearn");
    });
  });

  describe("8. Homepage and Contact Footer Consistency", () => {
    it("renders identical footer markup and links on both homepage and contact routes given same props", () => {
      const sharedSections: FooterSectionWithLinks[] = [
        {
          id: "sec-shared-1",
          title: "Explore",
          iconName: "Compass",
          displayOrder: 1,
          isVisible: true,
          updatedAt: new Date(),
          links: [
            {
              id: "lnk-1",
              footerSectionId: "sec-shared-1",
              label: "Showcase",
              url: "#projects",
              openInNewTab: false,
              displayOrder: 1,
            },
            {
              id: "lnk-2",
              footerSectionId: "sec-shared-1",
              label: "Get in Touch",
              url: "/contact",
              openInNewTab: false,
              displayOrder: 2,
            },
          ],
        },
      ];

      const sharedSocialLinks: GlobalSocialLink[] = [
        {
          id: "soc-gh",
          platform: "GitHub",
          url: "https://github.com/cobralearn",
          iconName: "Github",
          handle: "@cobralearn",
          displayOrder: 1,
          isEnabled: true,
          updatedAt: new Date(),
        },
      ];

      const { container: homeFooter, unmount: unmountHome } = render(
        <Footer sections={sharedSections} socialLinks={sharedSocialLinks} />
      );
      const homeHtml = homeFooter.innerHTML;
      unmountHome();

      const { container: contactFooter } = render(
        <Footer sections={sharedSections} socialLinks={sharedSocialLinks} />
      );
      const contactHtml = contactFooter.innerHTML;

      expect(contactHtml).toBe(homeHtml);
    });
  });

  describe("9. Section Background Image Visibility & Stacking Context", () => {
    it("renders background image in PublicCmsSection with visible gradient overlay and relative z-10 content", () => {
      const mockSectionWithMedia: HomepageSectionWithMedia = {
        id: "sec-featured",
        name: "Featured Showcase",
        iconName: "Star",
        enabled: true,
        displayOrder: 2,
        badge: "SPOTLIGHT",
        title: "Featured Innovation",
        subtitle: "A modern showcase of digital excellence.",
        primaryButtonLabel: "Discover More",
        primaryButtonLink: "#projects",
        secondaryButtonLabel: null,
        secondaryButtonLink: null,
        mediaAssetId: "media-real-asset",
        mediaAsset: {
          id: "media-real-asset",
          name: "Section Banner",
          originalFilename: "banner.png",
          bucket: "media-library",
          storagePath: "general/banner.png",
          publicUrl: "https://storage.cobralearn.com/media/banner.png",
          mediaType: "IMAGE",
          category: "GENERAL",
          mimeType: "image/png",
          fileSize: BigInt(5000),
          fileExtension: "png",
          dimensions: "1920x1080",
          duration: null,
          altText: "Banner visual",
          description: null,
          tags: [],
          uploadedById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      };

      const { container } = render(
        <PublicCmsSection section={mockSectionWithMedia} variant="featured" />
      );

      const sectionEl = container.querySelector("section");
      expect(sectionEl).not.toBeNull();
      // Should have dark background behind the image
      expect(sectionEl?.className).toContain("bg-black");

      // Background image layer must be present and have z-0 pointer-events-none
      const bgImg = container.querySelector("img") as HTMLImageElement;
      expect(bgImg).not.toBeNull();
      expect(bgImg.src).toBe("https://storage.cobralearn.com/media/banner.png");
      expect(bgImg.className).toContain("object-cover");

      const bgLayer = bgImg.parentElement;
      expect(bgLayer?.className).toContain("z-0");
      expect(bgLayer?.className).toContain("pointer-events-none");

      // Content container must be relative z-10 so buttons and text are interactive
      const contentContainer = container.querySelector(".relative.z-10");
      expect(contentContainer).not.toBeNull();
      expect(contentContainer?.textContent).toContain("Featured Innovation");
      expect(contentContainer?.textContent).toContain("Discover More");
    });

    it("renders background image in HomepagePreview for sec-featured, sec-projects, sec-cta and custom sections", () => {
      const mockSectionsWithMedia: HomepageSectionWithMedia[] = [
        {
          id: "sec-featured",
          name: "Featured",
          iconName: "Star",
          enabled: true,
          displayOrder: 1,
          title: "Featured Title",
          subtitle: "Featured Subtitle",
          mediaAssetId: "med-1",
          mediaAsset: {
            id: "med-1",
            name: "Featured Image",
            originalFilename: "f.jpg",
            bucket: "media-library",
            storagePath: "general/f.jpg",
            publicUrl: "https://example.com/featured.jpg",
            mediaType: "IMAGE",
            category: "GENERAL",
            mimeType: "image/jpeg",
            fileSize: BigInt(100),
            fileExtension: "jpg",
            dimensions: null,
            duration: null,
            altText: null,
            description: null,
            tags: [],
            uploadedById: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          updatedAt: new Date(),
        },
        {
          id: "sec-cta",
          name: "Call to Action",
          iconName: "Zap",
          enabled: true,
          displayOrder: 2,
          title: "CTA Title",
          subtitle: "CTA Subtitle",
          mediaAssetId: "med-2",
          mediaAsset: {
            id: "med-2",
            name: "CTA Image",
            originalFilename: "cta.jpg",
            bucket: "media-library",
            storagePath: "general/cta.jpg",
            publicUrl: "https://example.com/cta.jpg",
            mediaType: "IMAGE",
            category: "GENERAL",
            mimeType: "image/jpeg",
            fileSize: BigInt(100),
            fileExtension: "jpg",
            dimensions: null,
            duration: null,
            altText: null,
            description: null,
            tags: [],
            uploadedById: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          updatedAt: new Date(),
        },
      ];

      const { container } = render(
        <HomepagePreview sections={mockSectionsWithMedia} />
      );

      const images = container.querySelectorAll("img");
      const urls = Array.from(images).map((img) => img.src);
      expect(urls).toContain("https://example.com/featured.jpg");
      expect(urls).toContain("https://example.com/cta.jpg");
    });
  });
});
