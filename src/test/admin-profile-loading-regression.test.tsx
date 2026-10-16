import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import type { AdminProfile } from "@prisma/client";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import { adminClient } from "@/lib/api/admin-client";
import { ProfileInfoCard } from "@/components/profile/ProfileInfoCard";
import { ProfileTabs, type ProfileTabId } from "@/components/profile/ProfileTabs";
import {
  getSelfProfileServerFn,
  updateSelfProfileServerFn,
  uploadAvatarServerFn,
  getSelfAuditLogsServerFn,
} from "@/lib/server/profile-server-fns";

// Mock @tanstack/react-router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useRouterState: () => ({ location: { pathname: "/admin/profile" } }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  createFileRoute: () => (config: any) => config,
}));

// Mock sonner toast
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
};
vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => mockAuthState,
  useAuthGuard: vi.fn(),
}));

const mockProfile: AdminProfile = {
  id: "admin-1",
  email: "admin@cobralearn.com",
  fullName: "Super Admin",
  role: "SUPER_ADMIN",
  phone: "+91 9999999999",
  designation: "Chief Technology Officer",
  avatarUrl: "https://example.com/avatar.png",
  bio: "Lead Systems Architect",
  isActive: true,
  lastLoginAt: new Date("2026-10-12T10:00:00Z"),
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-10-12T10:00:00Z"),
};

describe("Admin Profile Stuck Loading & Tab Navigation Regression Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      user: { id: "admin-1", email: "admin@cobralearn.com" },
      isAuthenticated: true,
    };
  });

  // =========================================================================
  // 1. Hook Loading State & Failure Recovery
  // =========================================================================
  describe("useAdminProfile Lifecycle & Failure Termination", () => {
    it("transitions isLoading from true to false on successful profile retrieval", async () => {
      vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
        success: true,
        data: mockProfile,
      });

      const { result } = renderHook(() => useAdminProfile());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.profile).toEqual(mockProfile);
      expect(result.current.error).toBeNull();
    });

    it("terminates isLoading to false and sets error when server returns failure response", async () => {
      vi.spyOn(adminClient, "getSelfProfile").mockResolvedValueOnce({
        success: false,
        error: "Unauthorized: Valid administrative session required",
      });

      const { result } = renderHook(() => useAdminProfile());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBe("Unauthorized: Valid administrative session required");
    });

    it("guarantees isLoading terminates to false even if adminClient throws an exception", async () => {
      vi.spyOn(adminClient, "getSelfProfile").mockRejectedValueOnce(
        new Error("Network connection dropped")
      );

      const { result } = renderHook(() => useAdminProfile());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBe("Network connection dropped");
    });

    it("handles unauthenticated state gracefully without hanging", async () => {
      mockAuthState = {
        user: null as any,
        isAuthenticated: false,
      };

      const { result } = renderHook(() => useAdminProfile());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  // =========================================================================
  // 2. ProfileInfoCard Loading & Error States
  // =========================================================================
  describe("ProfileInfoCard State Transitions", () => {
    const dummyFormData = {
      fullName: "Super Admin",
      phone: "+91 9999999999",
      designation: "Chief Technology Officer",
      bio: "Lead Systems Architect",
      avatarUrl: null,
    };

    it("renders loading spinner while isLoading is true", () => {
      render(
        <ProfileInfoCard
          profile={null}
          isLoading={true}
          formData={dummyFormData}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText("Loading verified administrator profile...")).toBeDefined();
    });

    it("renders form content and hides spinner once isLoading is false", () => {
      render(
        <ProfileInfoCard
          profile={mockProfile}
          isLoading={false}
          formData={dummyFormData}
          onChange={vi.fn()}
        />
      );

      expect(screen.queryByText("Loading verified administrator profile...")).toBeNull();
      expect(screen.getByDisplayValue("Super Admin")).toBeDefined();
      expect(screen.getByDisplayValue("Chief Technology Officer")).toBeDefined();
    });

    it("renders recoverable error banner with Retry button when profile fails to load", () => {
      const onRetry = vi.fn();
      render(
        <ProfileInfoCard
          profile={null}
          isLoading={false}
          error="Unable to retrieve admin profile from database"
          onRetry={onRetry}
          formData={dummyFormData}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText("Unable to retrieve admin profile from database")).toBeDefined();
      const retryBtn = screen.getByRole("button", { name: /retry/i });
      expect(retryBtn).toBeDefined();

      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. Tab Click Interactivity
  // =========================================================================
  describe("ProfileTabs Navigation Interactivity", () => {
    it("updates tab selection cleanly across all 4 tabs", () => {
      let currentTab: ProfileTabId = "profile-info";
      const setTab = vi.fn((tab: ProfileTabId) => {
        currentTab = tab;
      });

      const { rerender } = render(<ProfileTabs activeTab={currentTab} onTabChange={setTab} />);

      // Switch to Security
      fireEvent.click(screen.getByText("Security"));
      expect(setTab).toHaveBeenCalledWith("security");

      // Switch to Preferences
      rerender(<ProfileTabs activeTab="security" onTabChange={setTab} />);
      fireEvent.click(screen.getByText("Preferences"));
      expect(setTab).toHaveBeenCalledWith("preferences");

      // Switch to Activity & Sessions
      rerender(<ProfileTabs activeTab="preferences" onTabChange={setTab} />);
      fireEvent.click(screen.getByText("Activity & Sessions"));
      expect(setTab).toHaveBeenCalledWith("activity-sessions");
    });
  });

  // =========================================================================
  // 4. Server Function Architecture Verification
  // =========================================================================
  describe("Server Function Boundary Architecture", () => {
    it("exposes all required server functions for profile operations", () => {
      expect(typeof getSelfProfileServerFn).toBe("function");
      expect(typeof updateSelfProfileServerFn).toBe("function");
      expect(typeof uploadAvatarServerFn).toBe("function");
      expect(typeof getSelfAuditLogsServerFn).toBe("function");
    });
  });
});
