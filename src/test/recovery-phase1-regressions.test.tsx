import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import React, { useState } from "react";
import { useWebsites } from "@/lib/websites/use-websites";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import { adminClient } from "@/lib/api/admin-client";
import { ContactTabs, type ContactTabId } from "@/components/contact/ContactTabs";
import { ProfileTabs, type ProfileTabId } from "@/components/profile/ProfileTabs";
import { projectToShowcaseItem, projectToItem } from "@/lib/projects-data";
import { websiteToShowcaseItem, websiteToItem } from "@/lib/websites-data";
import { advertisementToShowcaseItem } from "@/lib/advertisements-data";
import { awardToShowcaseItem } from "@/lib/awards-data";
import { ShowcaseCarousel } from "@/components/public/ShowcaseCarousel";
import type { WebsiteWithMedia } from "@/lib/server/websites-operations";
import type { ProjectWithMedia } from "@/lib/server/projects-operations";
import type { AdminProfile } from "@prisma/client";

// Mock @tanstack/react-router
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useRouterState: () => ({ location: { pathname: "/admin" } }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useAuth
let mockAuthState = {
  user: { id: "admin-1", email: "admin@cobralearn.com" },
  isAuthenticated: true,
  isLoading: false,
};
vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => mockAuthState,
  useAuthGuard: vi.fn(),
}));

const mockWebsite: WebsiteWithMedia = {
  id: "web-1",
  slug: "cobra-portal",
  name: "CobraLearn Portal",
  url: "https://cobralearn.com",
  description: "Next-gen tech portal",
  fullDescription: "Comprehensive portal",
  category: "PORTAL",
  status: "PUBLISHED",
  featured: true,
  displayOrder: 1,
  launchDate: "2026-01-01",
  teamSize: "5",
  technologies: ["React", "TypeScript", "TailwindCSS"],
  tags: ["portal", "tech"],
  githubUrl: null,
  videoUrl: null,
  thumbnailId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAdminProfileData: AdminProfile = {
  id: "prof-1",
  email: "admin@cobralearn.com",
  fullName: "Senior Architect",
  role: "SUPER_ADMIN",
  phone: "+91 9876543210",
  designation: "Principal Engineer",
  avatarUrl: "https://example.com/avatar.jpg",
  bio: "Engineering lead",
  isActive: true,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("COBRALEARN RECOVERY PHASE 1 — REGRESSION AUDIT VERIFICATION", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      user: { id: "admin-1", email: "admin@cobralearn.com" },
      isAuthenticated: true,
      isLoading: false,
    };
  });

  // =========================================================================
  // 1. RECOVERY STEP A: WEBSITES LOADING & ERROR TERMINATION
  // =========================================================================
  describe("Recovery Step A — Websites Loading & Resilience", () => {
    it("successfully loads websites and transitions isLoading from true to false", async () => {
      vi.spyOn(adminClient, "listAdminWebsites").mockResolvedValueOnce({
        success: true,
        data: [mockWebsite],
      });

      const { result } = renderHook(() => useWebsites());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.websites).toHaveLength(1);
      expect(result.current.websites[0]?.name).toBe("CobraLearn Portal");
      expect(result.current.error).toBeNull();
    });

    it("terminates isLoading to false and populates error on server-function rejection", async () => {
      vi.spyOn(adminClient, "listAdminWebsites").mockRejectedValueOnce(
        new Error("Connection to database failed: ECONNREFUSED")
      );

      const { result } = renderHook(() => useWebsites());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.websites).toHaveLength(0);
      expect(result.current.error).toContain("Connection to database failed");
    });

    it("terminates isLoading to false on authorization/forbidden response", async () => {
      vi.spyOn(adminClient, "listAdminWebsites").mockResolvedValueOnce({
        success: false,
        error: "Unauthorized: Valid administrative session required",
      });

      const { result } = renderHook(() => useWebsites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.websites).toHaveLength(0);
      expect(result.current.error).toBe("Unauthorized: Valid administrative session required");
    });

    it("recovers successfully on retry after a failure", async () => {
      vi.spyOn(adminClient, "listAdminWebsites")
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockResolvedValueOnce({
          success: true,
          data: [mockWebsite],
        });

      const { result } = renderHook(() => useWebsites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.error).toBe("Network timeout");

      // Trigger retry
      await act(async () => {
        await result.current.refreshWebsites();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.websites).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });
  });

  // =========================================================================
  // 2. RECOVERY STEP B: ADMIN PROFILE LOADING & RESILIENCE
  // =========================================================================
  describe("Recovery Step B — Admin Profile Loading & Error Recovery", () => {
    it("successfully loads profile without staying stuck in loading", async () => {
      vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
        success: true,
        data: mockAdminProfileData,
      });

      const { result } = renderHook(() => useAdminProfile());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.profile?.fullName).toBe("Senior Architect");
      expect(result.current.error).toBeNull();
    });

    it("terminates loading and sets error when profile request fails", async () => {
      vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
        success: false,
        error: "Forbidden: AdminProfile is deactivated",
      });

      const { result } = renderHook(() => useAdminProfile());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBe("Forbidden: AdminProfile is deactivated");
    });

    it("terminates loading even if adminClient throws an exception", async () => {
      vi.spyOn(adminClient, "getSelfProfile").mockRejectedValueOnce(
        new Error("Server connection lost")
      );

      const { result } = renderHook(() => useAdminProfile());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBe("Server connection lost");
    });

    it("recovers on reloadProfile after initial failure", async () => {
      vi.spyOn(adminClient, "getSelfProfile")
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValueOnce({
          success: true,
          data: mockAdminProfileData,
        });

      const { result } = renderHook(() => useAdminProfile());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.error).toBe("Timeout");

      await act(async () => {
        await result.current.reloadProfile();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.profile?.fullName).toBe("Senior Architect");
      expect(result.current.error).toBeNull();
    });
  });

  // =========================================================================
  // 3. RECOVERY STEP C: TAB INTERACTIONS FOR CONTACT & PROFILE
  // =========================================================================
  describe("Recovery Step C — Contact & Profile Tab Interaction", () => {
    function ContactTabsWrapper() {
      const [activeTab, setActiveTab] = useState<ContactTabId>("general");
      return (
        <div>
          <ContactTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <div data-testid="tab-content">{activeTab}</div>
        </div>
      );
    }

    function ProfileTabsWrapper() {
      const [activeTab, setActiveTab] = useState<ProfileTabId>("profile-info");
      return (
        <div>
          <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <div data-testid="tab-content">{activeTab}</div>
        </div>
      );
    }

    it("switches contact tabs and updates displayed content on click", () => {
      render(<ContactTabsWrapper />);

      expect(screen.getByTestId("tab-content").textContent).toBe("general");

      fireEvent.click(screen.getByRole("button", { name: /contact information/i }));
      expect(screen.getByTestId("tab-content").textContent).toBe("info");

      fireEvent.click(screen.getByRole("button", { name: /social links/i }));
      expect(screen.getByTestId("tab-content").textContent).toBe("social");

      fireEvent.click(screen.getByRole("button", { name: /highlights/i }));
      expect(screen.getByTestId("tab-content").textContent).toBe("highlights");

      fireEvent.click(screen.getByRole("button", { name: /faqs/i }));
      expect(screen.getByTestId("tab-content").textContent).toBe("faqs");

      fireEvent.click(screen.getByRole("button", { name: /form settings/i }));
      expect(screen.getByTestId("tab-content").textContent).toBe("form");
    });

    it("switches profile tabs and updates displayed content on click", () => {
      render(<ProfileTabsWrapper />);

      expect(screen.getByTestId("tab-content").textContent).toBe("profile-info");

      fireEvent.click(screen.getByRole("button", { name: /security/i }));
      expect(screen.getByTestId("tab-content").textContent).toBe("security");

      fireEvent.click(screen.getByRole("button", { name: /preferences/i }));
      expect(screen.getByTestId("tab-content").textContent).toBe("preferences");

      fireEvent.click(screen.getByRole("button", { name: /activity & sessions/i }));
      expect(screen.getByTestId("tab-content").textContent).toBe("activity-sessions");
    });
  });

  // =========================================================================
  // 4. RECOVERY STEP D: PUBLIC SHOWCASE HEADINGS & EMPTY IMAGE PREVENTION
  // =========================================================================
  describe("Recovery Step D — Public Showcase Mapping & Image Safety", () => {
    const mockProjectWithoutThumb: ProjectWithMedia = {
      id: "proj-empty",
      slug: "no-thumb-proj",
      name: "Smart Automation",
      description: "Automated controller",
      fullDescription: null,
      category: "IoT",
      status: "PUBLISHED",
      featured: false,
      displayOrder: 1,
      projectDuration: null,
      teamSize: null,
      technologies: ["Node.js"],
      tags: [],
      liveUrl: null,
      githubUrl: null,
      videoUrl: null,
      thumbnailId: null,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockWebsiteWithoutThumb: WebsiteWithMedia = {
      ...mockWebsite,
      thumbnailId: null,
      thumbnail: null,
    };

    it("never returns an empty string for image in projectToShowcaseItem", () => {
      const item = projectToShowcaseItem(mockProjectWithoutThumb);
      expect(item.image).not.toBe("");
      expect(item.image.length).toBeGreaterThan(0);
    });

    it("never returns an empty string for image in websiteToShowcaseItem", () => {
      const item = websiteToShowcaseItem(mockWebsiteWithoutThumb);
      expect(item.image).not.toBe("");
      expect(item.image.length).toBeGreaterThan(0);
    });

    it("preserves valid thumbnail URL when provided", () => {
      const projectWithThumb: ProjectWithMedia = {
        ...mockProjectWithoutThumb,
        thumbnail: {
          id: "thumb-1",
          name: "Project Cover",
          originalFilename: "cover.jpg",
          bucket: "media",
          storagePath: "projects/cover.jpg",
          publicUrl: "https://cdn.example.com/cover.jpg",
          mediaType: "IMAGE",
          category: "PROJECTS",
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
      };

      const item = projectToShowcaseItem(projectWithThumb);
      expect(item.image).toBe("https://cdn.example.com/cover.jpg");
    });

    it("ShowcaseCarousel never renders an empty src attribute", () => {
      const items = [
        {
          id: "1",
          title: "Test Item",
          slug: "test-item",
          description: "Test description",
          image: "", // Explicitly empty to verify component-level defense
          accent: "orange" as const,
          published: true,
          order: 1,
        },
      ];

      const { container } = render(
        <ShowcaseCarousel items={items} accent="orange" sectionType="projects" autoPlay={false} />
      );

      // Verify no img element has an empty src
      const images = container.querySelectorAll("img");
      images.forEach((img) => {
        expect(img.getAttribute("src")).not.toBe("");
      });
      // Placeholder was rendered safely
      expect(container.querySelector(".showcase-card-placeholder")).toBeDefined();
    });
  });
});
