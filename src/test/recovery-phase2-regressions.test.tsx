import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import React, { useState } from "react";
import { useProjects } from "@/lib/projects/use-projects";
import { useAdvertisements } from "@/lib/advertisements/use-advertisements";
import { useAwards } from "@/lib/awards/use-awards";
import { AuthProvider, useAuth } from "@/lib/auth/use-auth";
import { authService } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";
import { projectToItem, projectToShowcaseItem } from "@/lib/projects-data";
import { ContactTabs, type ContactTabId } from "@/components/contact/ContactTabs";
import { ProfileTabs, type ProfileTabId } from "@/components/profile/ProfileTabs";
import type { ProjectWithMedia } from "@/lib/server/projects-operations";
import type { AdvertisementWithMedia } from "@/lib/server/advertisements-operations";
import type { AwardWithMedia } from "@/lib/server/awards-operations";

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

const mockProjectData: ProjectWithMedia = {
  id: "proj-101",
  slug: "ai-learning-platform",
  name: "AI Learning Platform",
  description: "Adaptive intelligent platform",
  fullDescription: "Comprehensive description",
  category: "WEB_APPLICATION",
  status: "PUBLISHED",
  featured: true,
  displayOrder: 1,
  projectDuration: "6 months",
  teamSize: "4",
  technologies: ["React", "TypeScript", "TailwindCSS"],
  tags: ["ai", "learning"],
  githubUrl: null,
  videoUrl: null,
  thumbnailId: null,
  publishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAdvertisementData: AdvertisementWithMedia = {
  id: "ad-101",
  slug: "global-launch-campaign",
  name: "Global Launch Campaign",
  campaignName: "Launch 2026",
  headline: "Experience Innotechcore",
  description: "Next-gen creative campaign",
  category: "DIGITAL",
  status: "PUBLISHED",
  featured: true,
  displayOrder: 1,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  targetAudience: "Developers",
  ctaText: "Explore Now",
  ctaUrl: "https://cobralearn.com",
  thumbnailId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAwardData: AwardWithMedia = {
  id: "award-101",
  slug: "national-excellence-trophy",
  name: "National Excellence Trophy",
  organization: "EdTech Global",
  year: 2026,
  title: "Outstanding Innovation",
  description: "Recognizing outstanding technical innovation",
  category: "EXCELLENCE",
  status: "PUBLISHED",
  featured: true,
  displayOrder: 1,
  badgeText: "Gold Medal",
  dateReceived: "2026-05-15",
  thumbnailId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("COBRALEARN RECOVERY PHASE 2 — APPLICATION-WIDE REGRESSION AUDIT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. PROJECTS MODULE RESILIENCE
  // =========================================================================
  describe("useProjects Loading & Resilience", () => {
    it("successfully loads projects and transitions isLoading from true to false", async () => {
      vi.spyOn(adminClient, "listAdminProjects").mockResolvedValueOnce({
        success: true,
        data: [mockProjectData],
      });

      const { result } = renderHook(() => useProjects());
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0]?.name).toBe("AI Learning Platform");
      expect(result.current.error).toBeNull();
    });

    it("terminates isLoading to false and populates error on server-function rejection", async () => {
      vi.spyOn(adminClient, "listAdminProjects").mockRejectedValueOnce(
        new Error("Database connection timeout")
      );

      const { result } = renderHook(() => useProjects());
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.projects).toHaveLength(0);
      expect(result.current.error).toContain("Database connection timeout");
    });
  });

  // =========================================================================
  // 2. ADVERTISEMENTS MODULE RESILIENCE
  // =========================================================================
  describe("useAdvertisements Loading & Resilience", () => {
    it("successfully loads advertisements and transitions isLoading from true to false", async () => {
      vi.spyOn(adminClient, "listAdminAdvertisements").mockResolvedValueOnce({
        success: true,
        data: [mockAdvertisementData],
      });

      const { result } = renderHook(() => useAdvertisements());
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.advertisements).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it("terminates isLoading to false and populates error on server-function rejection", async () => {
      vi.spyOn(adminClient, "listAdminAdvertisements").mockRejectedValueOnce(
        new Error("Unauthorized: Valid administrative session required")
      );

      const { result } = renderHook(() => useAdvertisements());
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.advertisements).toHaveLength(0);
      expect(result.current.error).toContain("Unauthorized");
    });
  });

  // =========================================================================
  // 3. AWARDS MODULE RESILIENCE
  // =========================================================================
  describe("useAwards Loading & Resilience", () => {
    it("successfully loads awards and transitions isLoading from true to false", async () => {
      vi.spyOn(adminClient, "listAdminAwards").mockResolvedValueOnce({
        success: true,
        data: [mockAwardData],
      });

      const { result } = renderHook(() => useAwards());
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.awards).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it("terminates isLoading to false and populates error on server-function rejection", async () => {
      vi.spyOn(adminClient, "listAdminAwards").mockRejectedValueOnce(
        new Error("Internal Server Error")
      );

      const { result } = renderHook(() => useAwards());
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.awards).toHaveLength(0);
      expect(result.current.error).toContain("Internal Server Error");
    });
  });

  // =========================================================================
  // 4. AUTH PROVIDER RESILIENCE & LIFECYCLE
  // =========================================================================
  describe("AuthProvider Resilience", () => {
    it("terminates isLoading to false even when authService.getSession() rejects", async () => {
      vi.spyOn(authService, "getSession").mockRejectedValueOnce(
        new Error("Auth service unavailable")
      );
      vi.spyOn(authService, "onAuthStateChange").mockImplementation(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
        unsubscribe: vi.fn(),
      } as any));

      function TestConsumer() {
        const { isLoading, isAuthenticated } = useAuth();
        return (
          <div>
            <span data-testid="auth-loading">{String(isLoading)}</span>
            <span data-testid="auth-authenticated">{String(isAuthenticated)}</span>
          </div>
        );
      }

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("auth-loading").textContent).toBe("false");
      });

      expect(screen.getByTestId("auth-authenticated").textContent).toBe("false");
    });
  });

  // =========================================================================
  // 5. PUBLIC SHOWCASE & DETAIL IMAGE FALLBACK
  // =========================================================================
  describe("Public Showcase & Detail Image Fallback", () => {
    it("never returns empty string for image in projectToItem when thumbnail is absent", () => {
      const item = projectToItem(mockProjectData);
      expect(item.image).not.toBe("");
      expect(item.image.length).toBeGreaterThan(0);
    });

    it("never returns empty string for image in projectToShowcaseItem when thumbnail is absent", () => {
      const item = projectToShowcaseItem(mockProjectData);
      expect(item.image).not.toBe("");
      expect(item.image.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 6. CONTACT & PROFILE TAB INTERACTION VERIFICATION
  // =========================================================================
  describe("Contact & Profile Tab Switching Interaction", () => {
    function ContactTabsContainer() {
      const [activeTab, setActiveTab] = useState<ContactTabId>("general");
      return (
        <div>
          <ContactTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <div data-testid="active-contact-tab">{activeTab}</div>
        </div>
      );
    }

    function ProfileTabsContainer() {
      const [activeTab, setActiveTab] = useState<ProfileTabId>("profile-info");
      return (
        <div>
          <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <div data-testid="active-profile-tab">{activeTab}</div>
        </div>
      );
    }

    it("switches Contact tabs to each view upon click", () => {
      render(<ContactTabsContainer />);
      expect(screen.getByTestId("active-contact-tab").textContent).toBe("general");

      fireEvent.click(screen.getByRole("button", { name: /contact information/i }));
      expect(screen.getByTestId("active-contact-tab").textContent).toBe("info");

      fireEvent.click(screen.getByRole("button", { name: /social links/i }));
      expect(screen.getByTestId("active-contact-tab").textContent).toBe("social");

      fireEvent.click(screen.getByRole("button", { name: /highlights/i }));
      expect(screen.getByTestId("active-contact-tab").textContent).toBe("highlights");

      fireEvent.click(screen.getByRole("button", { name: /faqs/i }));
      expect(screen.getByTestId("active-contact-tab").textContent).toBe("faqs");

      fireEvent.click(screen.getByRole("button", { name: /form settings/i }));
      expect(screen.getByTestId("active-contact-tab").textContent).toBe("form");
    });

    it("switches Profile tabs to each view upon click", () => {
      render(<ProfileTabsContainer />);
      expect(screen.getByTestId("active-profile-tab").textContent).toBe("profile-info");

      fireEvent.click(screen.getByRole("button", { name: /security/i }));
      expect(screen.getByTestId("active-profile-tab").textContent).toBe("security");

      fireEvent.click(screen.getByRole("button", { name: /preferences/i }));
      expect(screen.getByTestId("active-profile-tab").textContent).toBe("preferences");

      fireEvent.click(screen.getByRole("button", { name: /activity & sessions/i }));
      expect(screen.getByTestId("active-profile-tab").textContent).toBe("activity-sessions");
    });
  });
});
