import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { DetailPage } from "@/components/public/DetailPage";
import { WebsiteTable } from "@/components/websites/WebsiteTable";
import { isSafeHttpUrl } from "@/routes/admin/websites/edit";
import { advertisementToPublicDetailItem } from "@/lib/advertisements-data";
import { awardToPublicDetailItem } from "@/lib/awards-data";
import { projectToPublicDetailItem } from "@/lib/projects-data";
import { websiteToPublicDetailItem } from "@/lib/websites-data";
import { getPublicAdvertisementBySlugOperation } from "@/lib/server/advertisements-operations";
import { getPublicAwardBySlugOperation } from "@/lib/server/awards-operations";
import { getPublicWebsiteBySlugOperation } from "@/lib/server/websites-operations";
import type { AdvertisementWithMedia } from "@/lib/advertisements-data";
import type { AwardWithMedia } from "@/lib/awards-data";
import type { ProjectWithMedia } from "@/lib/server/projects-operations";
import type { WebsiteWithMedia, WebsiteItem } from "@/lib/websites-data";
import type { PrismaClient } from "@prisma/client";

// Mock @tanstack/react-router partially
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ children, to, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

describe("Targeted Fixes Test Suite", () => {
  // ── AREA 1: Public Advertisement gallery images & ordering ──
  describe("1. Public Advertisement Gallery Rendering", () => {
    it("renders advertisement gallery images in exact persisted order with 'Campaign Gallery' heading", () => {
      const adData: AdvertisementWithMedia = {
        id: "ad-1",
        slug: "super-campaign",
        name: "Super Campaign",
        campaign: "Spring 2026",
        brand: "CobraLearn",
        description: "Innovative campaign",
        fullDescription: "Detailed campaign overview",
        status: "PUBLISHED",
        date: "2026-03-15",
        displayOrder: 1,
        campaignType: "BANNER",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        campaignUrl: "https://example.com/campaign",
        featured: true,
        showOnHomepage: true,
        thumbnailId: "media-thumb",
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnail: {
          id: "media-thumb",
          name: "thumb.png",
          originalFilename: "thumb.png",
          mimeType: "image/png",
          size: 1000,
          bucket: "media-library",
          storagePath: "thumb.png",
          publicUrl: "https://cdn.example.com/thumb.png",
          category: "ADVERTISEMENTS",
          altText: "Ad Thumbnail",
          tags: [],
          description: null,
          width: 800,
          height: 600,
          uploadedById: "admin-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        gallery: [
          {
            id: "gal-1",
            advertisementId: "ad-1",
            mediaId: "media-g1",
            displayOrder: 0,
            media: {
              id: "media-g1",
              name: "image-first.png",
              originalFilename: "image-first.png",
              mimeType: "image/png",
              size: 2000,
              bucket: "media-library",
              storagePath: "image-first.png",
              publicUrl: "https://cdn.example.com/image-first.png",
              category: "ADVERTISEMENTS",
              altText: "First Image",
              tags: [],
              description: null,
              width: 800,
              height: 600,
              uploadedById: "admin-1",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          {
            id: "gal-2",
            advertisementId: "ad-1",
            mediaId: "media-g2",
            displayOrder: 1,
            media: {
              id: "media-g2",
              name: "image-second.png",
              originalFilename: "image-second.png",
              mimeType: "image/png",
              size: 3000,
              bucket: "media-library",
              storagePath: "image-second.png",
              publicUrl: "https://cdn.example.com/image-second.png",
              category: "ADVERTISEMENTS",
              altText: "Second Image",
              tags: [],
              description: null,
              width: 800,
              height: 600,
              uploadedById: "admin-1",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      };

      const publicItem = advertisementToPublicDetailItem(adData);
      render(<DetailPage item={publicItem} type="advertisements" />);

      // Verify heading with count
      expect(screen.getByText("Campaign Gallery (2)")).toBeDefined();

      // Verify gallery images rendered in order
      const images = screen.getAllByRole("img");
      // images[0] is hero thumbnail, images[1] & images[2] are gallery images
      const galleryImgs = images.filter((img) =>
        img.getAttribute("src")?.includes("gallery") ||
        img.getAttribute("src")?.includes("image-")
      );
      expect(galleryImgs.length).toBe(2);
      expect(galleryImgs[0].getAttribute("src")).toBe("https://cdn.example.com/image-first.png");
      expect(galleryImgs[0].getAttribute("alt")).toBe("First Image");
      expect(galleryImgs[1].getAttribute("src")).toBe("https://cdn.example.com/image-second.png");
      expect(galleryImgs[1].getAttribute("alt")).toBe("Second Image");
    });
  });

  // ── AREA 2: Public Award gallery images & ordering ──
  describe("2. Public Award Gallery Rendering", () => {
    it("renders award gallery images in exact persisted order with 'Award Gallery' heading", () => {
      const awardData: AwardWithMedia = {
        id: "aw-1",
        slug: "best-innovator",
        name: "Best Innovator",
        context: "Global EdTech Summit",
        organization: "World Education Forum",
        category: "Excellence",
        description: "Honoring top technological innovations.",
        fullDescription: "Full story of the award recognition.",
        status: "PUBLISHED",
        date: "2026-05-20",
        displayOrder: 1,
        credentialUrl: "https://example.com/cert/123",
        featured: true,
        showOnHomepage: true,
        thumbnailId: "media-aw-thumb",
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnail: {
          id: "media-aw-thumb",
          name: "aw-thumb.png",
          originalFilename: "aw-thumb.png",
          mimeType: "image/png",
          size: 1500,
          bucket: "media-library",
          storagePath: "aw-thumb.png",
          publicUrl: "https://cdn.example.com/aw-thumb.png",
          category: "AWARDS",
          altText: "Award Trophy Thumbnail",
          tags: [],
          description: null,
          width: 800,
          height: 600,
          uploadedById: "admin-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        gallery: [
          {
            id: "aw-g1",
            awardId: "aw-1",
            mediaId: "media-aw-g1",
            displayOrder: 0,
            media: {
              id: "media-aw-g1",
              name: "ceremony-photo.png",
              originalFilename: "ceremony-photo.png",
              mimeType: "image/png",
              size: 2500,
              bucket: "media-library",
              storagePath: "ceremony-photo.png",
              publicUrl: "https://cdn.example.com/ceremony-photo.png",
              category: "AWARDS",
              altText: "Stage Presentation",
              tags: [],
              description: null,
              width: 800,
              height: 600,
              uploadedById: "admin-1",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          {
            id: "aw-g2",
            awardId: "aw-1",
            mediaId: "media-aw-g2",
            displayOrder: 1,
            media: {
              id: "media-aw-g2",
              name: "certificate-scan.png",
              originalFilename: "certificate-scan.png",
              mimeType: "image/png",
              size: 3500,
              bucket: "media-library",
              storagePath: "certificate-scan.png",
              publicUrl: "https://cdn.example.com/certificate-scan.png",
              category: "AWARDS",
              altText: "Official Citation",
              tags: [],
              description: null,
              width: 800,
              height: 600,
              uploadedById: "admin-1",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      };

      const publicItem = awardToPublicDetailItem(awardData);
      render(<DetailPage item={publicItem} type="awards" />);

      // Verify heading with count
      expect(screen.getByText("Award Gallery (2)")).toBeDefined();

      // Verify gallery images rendered in order
      const images = screen.getAllByRole("img");
      const galleryImgs = images.filter((img) =>
        img.getAttribute("src")?.includes("ceremony") ||
        img.getAttribute("src")?.includes("certificate")
      );
      expect(galleryImgs.length).toBe(2);
      expect(galleryImgs[0].getAttribute("src")).toBe("https://cdn.example.com/ceremony-photo.png");
      expect(galleryImgs[0].getAttribute("alt")).toBe("Stage Presentation");
      expect(galleryImgs[1].getAttribute("src")).toBe("https://cdn.example.com/certificate-scan.png");
      expect(galleryImgs[1].getAttribute("alt")).toBe("Official Citation");
    });
  });

  // ── AREA 3: Empty Galleries ──
  describe("3. Empty Galleries Handling", () => {
    it("gracefully omits gallery section when advertisement has no gallery items", () => {
      const adWithoutGallery: AdvertisementWithMedia = {
        id: "ad-empty",
        slug: "no-gallery-ad",
        name: "No Gallery Ad",
        campaign: "Simple",
        brand: "CobraLearn",
        description: "Ad without extra images",
        status: "PUBLISHED",
        date: "2026-04-01",
        displayOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnail: {
          id: "thumb-1",
          name: "t.png",
          originalFilename: "t.png",
          mimeType: "image/png",
          size: 500,
          bucket: "media",
          storagePath: "t.png",
          publicUrl: "https://cdn.example.com/thumb.png",
          category: "ADVERTISEMENTS",
          altText: "Thumb",
          tags: [],
          description: null,
          width: 100,
          height: 100,
          uploadedById: "admin-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        gallery: [],
      };

      const publicItem = advertisementToPublicDetailItem(adWithoutGallery);
      render(<DetailPage item={publicItem} type="advertisements" />);

      expect(screen.queryByText(/Campaign Gallery/i)).toBeNull();
    });

    it("gracefully omits gallery section when award has no gallery items", () => {
      const awardWithoutGallery: AwardWithMedia = {
        id: "aw-empty",
        slug: "no-gallery-award",
        name: "No Gallery Award",
        context: "Local Event",
        organization: "Local Chapter",
        category: "Community",
        description: "Award without gallery",
        status: "PUBLISHED",
        date: "2026-04-01",
        displayOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnail: null,
        gallery: [],
      };

      const publicItem = awardToPublicDetailItem(awardWithoutGallery);
      render(<DetailPage item={publicItem} type="awards" />);

      expect(screen.queryByText(/Award Gallery/i)).toBeNull();
    });
  });

  // ── AREA 4: Draft/Archived Public-Access Restrictions ──
  describe("4. Draft & Archived Public-Access Restrictions", () => {
    it("blocks draft and archived advertisements from public retrieval by slug", async () => {
      const mockPrisma = {
        advertisement: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            if (where.status === "PUBLISHED" && where.slug === "published-ad") {
              return { id: "1", slug: "published-ad", status: "PUBLISHED" };
            }
            return null;
          }),
        },
      } as unknown as PrismaClient;

      // Published succeeds
      const pubRes = await getPublicAdvertisementBySlugOperation("published-ad", mockPrisma);
      expect(pubRes.advertisement).not.toBeNull();

      // Draft or Archived returns null
      const draftRes = await getPublicAdvertisementBySlugOperation("secret-draft", mockPrisma);
      expect(draftRes.advertisement).toBeNull();

      const archRes = await getPublicAdvertisementBySlugOperation("old-archived", mockPrisma);
      expect(archRes.advertisement).toBeNull();
    });

    it("blocks draft and archived awards from public retrieval by slug", async () => {
      const mockPrisma = {
        award: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            if (where.status === "PUBLISHED" && where.slug === "published-award") {
              return { id: "1", slug: "published-award", status: "PUBLISHED" };
            }
            return null;
          }),
        },
      } as unknown as PrismaClient;

      const pubRes = await getPublicAwardBySlugOperation("published-award", mockPrisma);
      expect(pubRes.award).not.toBeNull();

      const draftRes = await getPublicAwardBySlugOperation("draft-award", mockPrisma);
      expect(draftRes.award).toBeNull();
    });

    it("blocks draft and archived websites from public retrieval by slug", async () => {
      const mockPrisma = {
        website: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            if (where.status === "PUBLISHED" && where.slug === "published-site") {
              return { id: "1", slug: "published-site", status: "PUBLISHED" };
            }
            return null;
          }),
        },
      } as unknown as PrismaClient;

      const pubRes = await getPublicWebsiteBySlugOperation("published-site", mockPrisma);
      expect(pubRes.website).not.toBeNull();

      const draftRes = await getPublicWebsiteBySlugOperation("campus-connect", mockPrisma);
      expect(draftRes.website).toBeNull();
    });
  });

  // ── AREA 5: Regression: Projects and Websites gallery behavior preserved ──
  describe("5. Projects and Websites Gallery Regression", () => {
    it("preserves Project Gallery rendering on public detail page", () => {
      const project: ProjectWithMedia = {
        id: "proj-1",
        slug: "ai-code-editor",
        name: "AI Code Editor",
        description: "Intelligent programming tool",
        fullDescription: "Deep dive into architecture",
        category: "Artificial Intelligence",
        technologies: ["TypeScript", "Rust"],
        tags: ["ai", "devtools"],
        status: "PUBLISHED",
        displayOrder: 1,
        featured: true,
        thumbnailId: "p-thumb",
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnail: {
          id: "p-thumb",
          name: "p.png",
          originalFilename: "p.png",
          mimeType: "image/png",
          size: 1000,
          bucket: "media",
          storagePath: "p.png",
          publicUrl: "https://cdn.example.com/proj-thumb.png",
          category: "PROJECTS",
          altText: "Thumb",
          tags: [],
          description: null,
          width: 100,
          height: 100,
          uploadedById: "admin-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        gallery: [
          {
            id: "pg-1",
            projectId: "proj-1",
            mediaId: "pm-1",
            displayOrder: 0,
            media: {
              id: "pm-1",
              name: "editor-ui.png",
              originalFilename: "editor-ui.png",
              mimeType: "image/png",
              size: 2000,
              bucket: "media",
              storagePath: "editor-ui.png",
              publicUrl: "https://cdn.example.com/editor-ui.png",
              category: "PROJECTS",
              altText: "Editor Interface",
              tags: [],
              description: null,
              width: 800,
              height: 600,
              uploadedById: "admin-1",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      };

      const detail = projectToPublicDetailItem(project);
      render(<DetailPage item={detail} type="projects" />);

      expect(screen.getByText("Project Gallery (1)")).toBeDefined();
      expect(screen.getByAltText("Editor Interface")).toBeDefined();
    });

    it("preserves Website Screenshots rendering on public detail page", () => {
      const website: WebsiteWithMedia = {
        id: "web-1",
        slug: "cobralearn-portal",
        name: "CobraLearn Portal",
        url: "https://cobralearn.com",
        description: "Modern educational platform",
        fullDescription: "Long form portal description",
        category: "Education",
        status: "PUBLISHED",
        displayOrder: 1,
        featured: true,
        technologies: ["Next.js", "TailwindCSS"],
        tags: ["lms"],
        thumbnailId: "w-thumb",
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnail: null,
        gallery: [
          {
            id: "wg-1",
            websiteId: "web-1",
            mediaId: "wm-1",
            displayOrder: 0,
            media: {
              id: "wm-1",
              name: "dashboard-screen.png",
              originalFilename: "dashboard-screen.png",
              mimeType: "image/png",
              size: 1500,
              bucket: "media",
              storagePath: "screen.png",
              publicUrl: "https://cdn.example.com/dashboard-screen.png",
              category: "WEBSITES",
              altText: "Student Dashboard",
              tags: [],
              description: null,
              width: 800,
              height: 600,
              uploadedById: "admin-1",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      };

      const detail = websiteToPublicDetailItem(website);
      render(<DetailPage item={detail} type="websites" />);

      expect(screen.getByText("Website Screenshots (1)")).toBeDefined();
      expect(screen.getByAltText("Student Dashboard")).toBeDefined();
    });
  });

  // ── AREA 6: Websites Listing table removes Technologies column ──
  describe("6. Websites Listing Table (Technologies Column Removed)", () => {
    it("renders table with Website, Description, Status, Order, Actions headers and NO Technologies header", () => {
      const websites: WebsiteItem[] = [
        {
          id: "web-1",
          slug: "campus-connect",
          name: "Campus Connect",
          url: "https://campusconnect-final.vercel.app/",
          description: "Student networking app",
          category: "Education",
          status: "Draft",
          featured: false,
          order: 1,
          technologies: ["React", "Node", "MongoDB"],
          image: "https://cdn.example.com/thumb.png",
          gallery: [],
        },
      ];

      render(
        <WebsiteTable
          websites={websites}
          selectedIds={[]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onDeleteWebsite={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
          pageSize={10}
          onPageSizeChange={vi.fn()}
          totalCount={1}
        />
      );

      // Expected columns must exist
      expect(screen.getByText("Website")).toBeDefined();
      expect(screen.getByText("Description")).toBeDefined();
      expect(screen.getByText("Status")).toBeDefined();
      expect(screen.getByText("Order")).toBeDefined();
      expect(screen.getByText("Actions")).toBeDefined();

      // Technologies column must NOT be present in header or rows
      expect(screen.queryByRole("columnheader", { name: /Technologies/i })).toBeNull();
      expect(screen.queryByText("React")).toBeNull();
      expect(screen.queryByText("MongoDB")).toBeNull();

      // Website name and description content must be present
      expect(screen.getByText("Campus Connect")).toBeDefined();
      expect(screen.getByText("Student networking app")).toBeDefined();
    });
  });

  // ── AREA 7: Safe View on Website and Live Site URL Validation ──
  describe("7. View on Website & Live Site URL Validation", () => {
    it("validates safe HTTP and HTTPS URLs and rejects invalid or dangerous protocols", () => {
      expect(isSafeHttpUrl("https://campusconnect-final.vercel.app/")).toBe(true);
      expect(isSafeHttpUrl("http://localhost:3000")).toBe(true);
      expect(isSafeHttpUrl("https://example.com/demo?foo=bar")).toBe(true);

      // Dangerous schemes rejected
      expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
      expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
      expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
      expect(isSafeHttpUrl("vbscript:test")).toBe(false);

      // Malformed / empty values rejected
      expect(isSafeHttpUrl("not a url")).toBe(false);
      expect(isSafeHttpUrl("")).toBe(false);
      expect(isSafeHttpUrl(null)).toBe(false);
      expect(isSafeHttpUrl(undefined)).toBe(false);
    });
  });
});
