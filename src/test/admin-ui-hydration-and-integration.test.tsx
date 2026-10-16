import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { adminClient } from "@/lib/api/admin-client";
import { ProfileInfoCard, type ProfileFormData } from "@/components/profile/ProfileInfoCard";
import { AccountOverviewCard } from "@/components/profile/AccountOverviewCard";
import { ActivitySessionsTab } from "@/components/profile/ActivitySessionsTab";
import { TeamManagementTable } from "@/components/team/TeamManagementTable";
import type { AdminProfile, AdminRole, AdminAuditLog } from "@prisma/client";

// Mock @tanstack/react-router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Phase 7E.1 — Admin UI Hydration & Integration Foundation Test Suite", () => {
  const mockSuperAdminProfile: AdminProfile = {
    id: "uuid-super-1",
    email: "superadmin@cobralearn.com",
    fullName: "Chief Executive Admin",
    role: "SUPER_ADMIN" as AdminRole,
    isActive: true,
    phone: "+91 98765 11111",
    designation: "Principal System Architect",
    bio: "Core platform architect and administrator.",
    avatarUrl: null,
    lastLoginAt: new Date("2026-10-09T10:00:00Z"),
    createdAt: new Date("2026-01-15T00:00:00Z"),
    updatedAt: new Date("2026-10-09T10:00:00Z"),
  };

  const mockEditorProfile: AdminProfile = {
    id: "uuid-editor-2",
    email: "editor@cobralearn.com",
    fullName: "Content Editor Jane",
    role: "EDITOR" as AdminRole,
    isActive: true,
    phone: null,
    designation: "Media Specialist",
    bio: "Showcase editor.",
    avatarUrl: null,
    lastLoginAt: null,
    createdAt: new Date("2026-03-01T00:00:00Z"),
    updatedAt: new Date("2026-03-01T00:00:00Z"),
  };

  const mockAuditLogs: AdminAuditLog[] = [
    {
      id: "log-1",
      actorId: "uuid-super-1",
      actorEmail: "superadmin@cobralearn.com",
      action: "SELF_PROFILE_UPDATED",
      module: "PROFILE_MANAGEMENT",
      entityId: "uuid-super-1",
      ipAddress: null,
      metadata: { updatedFields: ["fullName", "designation"] },
      createdAt: new Date("2026-10-09T12:30:00Z"),
    },
    {
      id: "log-2",
      actorId: "uuid-super-1",
      actorEmail: "superadmin@cobralearn.com",
      action: "SETTINGS_UPDATED",
      module: "GLOBAL_SETTINGS",
      entityId: "default",
      ipAddress: null,
      metadata: { updatedFields: ["siteTitle"] },
      createdAt: new Date("2026-10-08T15:00:00Z"),
    },
    {
      id: "log-3",
      actorId: "uuid-super-1",
      actorEmail: "superadmin@cobralearn.com",
      action: "ADMIN_ROLE_ASSIGNED",
      module: "ADMIN_GOVERNANCE",
      entityId: "uuid-editor-2",
      ipAddress: null,
      metadata: { previousRole: "ADMIN", newRole: "EDITOR" },
      createdAt: new Date("2026-10-07T09:15:00Z"),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. ProfileInfoCard Hydration
  describe("ProfileInfoCard Integration", () => {
    it("renders real administrator identity fields and handles edits", () => {
      const formData: ProfileFormData = {
        fullName: mockSuperAdminProfile.fullName,
        phone: mockSuperAdminProfile.phone || "",
        designation: mockSuperAdminProfile.designation || "",
        bio: mockSuperAdminProfile.bio || "",
        avatarUrl: null,
      };
      const onChange = vi.fn();

      render(
        <ProfileInfoCard
          profile={mockSuperAdminProfile}
          isLoading={false}
          formData={formData}
          onChange={onChange}
        />
      );

      // Verify populated fields from real profile
      expect(screen.getByDisplayValue("Chief Executive Admin")).toBeDefined();
      expect(screen.getByDisplayValue("superadmin@cobralearn.com")).toBeDefined();
      expect(screen.getByDisplayValue("Principal System Architect")).toBeDefined();
      expect(screen.getByDisplayValue("+91 98765 11111")).toBeDefined();
      expect(screen.getByText("Super Admin")).toBeDefined();

      // Email must be read-only / disabled
      const emailInput = screen.getByDisplayValue("superadmin@cobralearn.com");
      expect(emailInput.hasAttribute("disabled")).toBe(true);

      // Trigger field update
      const nameInput = screen.getByDisplayValue("Chief Executive Admin");
      fireEvent.change(nameInput, { target: { value: "Updated Admin Name" } });
      expect(onChange).toHaveBeenCalledWith({ fullName: "Updated Admin Name" });
    });

    it("displays loading state when profile is being retrieved", () => {
      const formData: ProfileFormData = {
        fullName: "",
        phone: "",
        designation: "",
        bio: "",
        avatarUrl: null,
      };

      render(
        <ProfileInfoCard
          profile={null}
          isLoading={true}
          formData={formData}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText("Loading verified administrator profile...")).toBeDefined();
    });
  });

  // 2. AccountOverviewCard Hydration
  describe("AccountOverviewCard Integration", () => {
    it("renders dynamic account status, member since date, and role name", () => {
      render(<AccountOverviewCard profile={mockSuperAdminProfile} />);

      expect(screen.getByText("Super Administrator")).toBeDefined();
      expect(screen.getByText("Active")).toBeDefined();
      expect(screen.getByText("2026")).toBeDefined();
      expect(screen.getByText("Oct 9, 2026")).toBeDefined();
    });

    it("renders deactivated status badge when isActive is false", () => {
      const deactivatedProfile = { ...mockSuperAdminProfile, isActive: false };
      render(<AccountOverviewCard profile={deactivatedProfile} />);

      expect(screen.getByText("Deactivated")).toBeDefined();
    });
  });

  // 3. ActivitySessionsTab Hydration
  describe("ActivitySessionsTab Integration", () => {
    it("fetches and renders real audit logs from PostgreSQL", async () => {
      vi.spyOn(adminClient, "getAuditLogs").mockResolvedValue({
        success: true,
        data: { logs: mockAuditLogs, count: mockAuditLogs.length },
      });
      vi.spyOn(adminClient, "getSelfAuditLogs").mockResolvedValue({
        success: true,
        data: { logs: mockAuditLogs, count: mockAuditLogs.length },
      });

      render(<ActivitySessionsTab currentProfileId={mockSuperAdminProfile.id} />);

      await waitFor(() => {
        expect(screen.getByText("Profile updated")).toBeDefined();
        expect(screen.getByText("Site settings updated")).toBeDefined();
        expect(screen.getByText("Role permissions changed")).toBeDefined();
      });

      expect(screen.getAllByText(/Actor: superadmin@cobralearn.com/).length).toBe(3);
    });

    it("displays useful empty state when no audit records exist", async () => {
      vi.spyOn(adminClient, "getAuditLogs").mockResolvedValue({
        success: true,
        data: { logs: [], count: 0 },
      });
      vi.spyOn(adminClient, "getSelfAuditLogs").mockResolvedValue({
        success: true,
        data: { logs: [], count: 0 },
      });

      render(<ActivitySessionsTab currentProfileId={mockSuperAdminProfile.id} />);

      await waitFor(() => {
        expect(screen.getByText("No audit activity recorded yet")).toBeDefined();
      });
    });

    it("displays error banner and retry button when audit query fails", async () => {
      vi.spyOn(adminClient, "getAuditLogs").mockResolvedValue({
        success: false,
        error: "Forbidden: Insufficient audit-log read permissions",
      });
      vi.spyOn(adminClient, "getSelfAuditLogs").mockResolvedValue({
        success: false,
        error: "Forbidden: Insufficient audit-log read permissions",
      });

      render(<ActivitySessionsTab currentProfileId={mockSuperAdminProfile.id} />);

      await waitFor(() => {
        expect(screen.getByText("Forbidden: Insufficient audit-log read permissions")).toBeDefined();
        expect(screen.getByText("Retry Loading")).toBeDefined();
      });
    });
  });

  // 4. TeamManagementTable Integration
  describe("TeamManagementTable Integration", () => {
    it("loads and displays administrative team roster", async () => {
      vi.spyOn(adminClient, "listTeamProfiles").mockResolvedValue({
        success: true,
        data: [mockSuperAdminProfile, mockEditorProfile],
      });

      render(<TeamManagementTable />);

      await waitFor(() => {
        expect(screen.getByText("Chief Executive Admin")).toBeDefined();
        expect(screen.getByText("Content Editor Jane")).toBeDefined();
        expect(screen.getByText("superadmin@cobralearn.com")).toBeDefined();
        expect(screen.getByText("editor@cobralearn.com")).toBeDefined();
      });
    });

    it("handles role change modal and updates role via assignAdminRole", async () => {
      vi.spyOn(adminClient, "listTeamProfiles").mockResolvedValue({
        success: true,
        data: [mockSuperAdminProfile, mockEditorProfile],
      });
      const assignSpy = vi.spyOn(adminClient, "assignAdminRole").mockResolvedValue({
        success: true,
        data: { targetAdminId: mockEditorProfile.id, newRole: "ADMIN" as AdminRole },
      });

      render(<TeamManagementTable />);

      await waitFor(() => {
        expect(screen.getByText("Content Editor Jane")).toBeDefined();
      });

      const changeRoleButtons = screen.getAllByRole("button", { name: /change role/i });
      const targetChangeBtn = changeRoleButtons[1]!;
      fireEvent.click(targetChangeBtn); // Click for Editor

      expect(screen.getByText("Change Administrator Role")).toBeDefined();

      // Change role to ADMIN
      const adminRadio = screen.getAllByRole("radio")[1]!; // ADMIN
      fireEvent.click(adminRadio);

      const updateRoleSubmit = screen.getByRole("button", { name: /update role/i });
      fireEvent.click(updateRoleSubmit);

      await waitFor(() => {
        expect(assignSpy).toHaveBeenCalledWith(mockEditorProfile.id, "ADMIN");
      });
    });

    it("handles status toggle and deactivates administrator via updateAdminStatus", async () => {
      vi.spyOn(adminClient, "listTeamProfiles").mockResolvedValue({
        success: true,
        data: [mockSuperAdminProfile, mockEditorProfile],
      });
      const statusSpy = vi.spyOn(adminClient, "updateAdminStatus").mockResolvedValue({
        success: true,
        data: { targetAdminId: mockEditorProfile.id, isActive: false },
      });

      render(<TeamManagementTable />);

      await waitFor(() => {
        expect(screen.getByText("Content Editor Jane")).toBeDefined();
      });

      const deactivateButtons = screen.getAllByRole("button", { name: /deactivate/i });
      const targetDeactBtn = deactivateButtons[1]!;
      fireEvent.click(targetDeactBtn); // Click for Editor

      expect(screen.getByText("Deactivate Administrator")).toBeDefined();

      const confirmBtn = screen.getByRole("button", { name: /confirm deactivation/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(statusSpy).toHaveBeenCalledWith(mockEditorProfile.id, false);
      });
    });

    it("displays error when user lacks ADMIN_READ permission", async () => {
      vi.spyOn(adminClient, "listTeamProfiles").mockResolvedValue({
        success: false,
        error: "Forbidden: Insufficient role permissions. Required: [SUPER_ADMIN, ADMIN]",
      });

      render(<TeamManagementTable />);

      await waitFor(() => {
        expect(
          screen.getByText("Forbidden: Insufficient role permissions. Required: [SUPER_ADMIN, ADMIN]")
        ).toBeDefined();
      });
    });
  });
});
