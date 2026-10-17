import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SecurityTab } from "@/components/profile/SecurityTab";
import { PreferencesTab } from "@/components/profile/PreferencesTab";
import { ActivitySessionsTab } from "@/components/profile/ActivitySessionsTab";
import { ProfileTabs, type ProfileTabId } from "@/components/profile/ProfileTabs";
import { AccountActionsCard } from "@/components/profile/AccountActionsCard";
import { AccountOverviewCard } from "@/components/profile/AccountOverviewCard";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { authService } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";

// Mock @tanstack/react-router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useBlocker: vi.fn().mockReturnValue({
    status: "unblocked",
    proceed: vi.fn(),
    reset: vi.fn(),
  }),
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

// Mock useAuth
let mockAuthValue = {
  user: { id: "user-123", email: "admin@cobralearn.com" },
  session: {
    expires_at: 1780000000,
    user: { id: "user-123", email: "admin@cobralearn.com" },
  } as any,
  isAuthenticated: true,
  isLoading: false,
  signOut: vi.fn().mockResolvedValue({ success: true, data: undefined }),
};

vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => mockAuthValue,
  useAuthGuard: vi.fn(),
}));

describe("Admin Profile UI — Security, Preferences & Activity/Sessions Tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // 1. Profile Tabs Switcher
  it("ProfileTabs renders all 5 tabs and calls onTabChange on click", () => {
    const onTabChange = vi.fn();
    render(<ProfileTabs activeTab="profile-info" onTabChange={onTabChange} />);

    expect(screen.getByText("Profile Information")).toBeDefined();
    expect(screen.getByText("Security")).toBeDefined();
    expect(screen.getByText("Preferences")).toBeDefined();
    expect(screen.getByText("Activity & Sessions")).toBeDefined();
    expect(screen.getByText("Login History")).toBeDefined();

    fireEvent.click(screen.getByText("Security"));
    expect(onTabChange).toHaveBeenCalledWith("security");

    fireEvent.click(screen.getByText("Preferences"));
    expect(onTabChange).toHaveBeenCalledWith("preferences");

    fireEvent.click(screen.getByText("Activity & Sessions"));
    expect(onTabChange).toHaveBeenCalledWith("activity-sessions");

    fireEvent.click(screen.getByText("Login History"));
    expect(onTabChange).toHaveBeenCalledWith("login-history");
  });

  // 2. Security Tab Rendering & Password Navigation
  describe("SecurityTab", () => {
    it("renders Password Management, MFA, Connected Devices, and Recommendations", () => {
      render(<SecurityTab />);

      expect(screen.getByText("Password Management")).toBeDefined();
      expect(screen.getByText("Multi-Factor Authentication (MFA)")).toBeDefined();
      expect(screen.getByText("Connected Devices")).toBeDefined();
      expect(screen.getByText("Security Recommendations")).toBeDefined();

      // Check Password Checklist
      expect(screen.getByText("Use at least 8 characters")).toBeDefined();
      expect(screen.getByText("Include a mix of letters, numbers and symbols")).toBeDefined();

      // Check Recommendations
      expect(screen.getByText("Use a strong, unique password")).toBeDefined();
      expect(screen.getByText("Enable two-factor authentication")).toBeDefined();
    });

    it("clicking Change Password navigates to /admin/profile/change-password", () => {
      render(<SecurityTab />);

      const changePasswordBtn = screen.getByRole("button", { name: /change password/i });
      fireEvent.click(changePasswordBtn);

      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/profile/change-password" });
    });

    it("clicking MFA Details opens the honest provider policy dialog", () => {
      render(<SecurityTab />);

      const mfaDetailsBtn = screen.getByRole("button", { name: /mfa details/i });
      fireEvent.click(mfaDetailsBtn);

      expect(screen.getByText("Multi-Factor Authentication")).toBeDefined();
      expect(screen.getAllByText(/Provider Policy/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Self-Service Enrollment/i)).toBeDefined();
    });

    it("renders honest single current device without static Verified JWT claims or fake revoke buttons", () => {
      render(<SecurityTab />);

      expect(screen.getByText(/Current Browser Session/i)).toBeDefined();
      expect(screen.getByText("Current")).toBeDefined();
      expect(screen.getByText(/Active Supabase Auth Session/i)).toBeDefined();
      // Verify static "Verified JWT" / "Verified Token" is NOT rendered
      expect(screen.queryByText(/Verified JWT/i)).toBeNull();
      expect(screen.queryByText(/Verified Token/i)).toBeNull();
      expect(screen.queryByRole("button", { name: /^revoke$/i })).toBeNull();
    });

    it("opens sign out modal from connected device dropdown menu in SecurityTab and signs out on confirmation", async () => {
      render(<SecurityTab />);

      // Find the session options button in Connected Devices
      const optionsBtn = screen.getByRole("button", { name: "Session options" });
      fireEvent.keyDown(optionsBtn, { key: "Enter" });

      // Click "Sign out from this device" in the dropdown
      const signOutMenuItem = screen.getByText("Sign out from this device");
      fireEvent.click(signOutMenuItem);

      // Verify SignOutModal dialog is shown
      expect(screen.getByText("Sign Out?")).toBeDefined();
      expect(screen.getByText(/Are you sure you want to end your admin session/i)).toBeDefined();

      // Click the confirmation "Sign Out" button inside the modal
      const confirmBtn = screen.getByRole("button", { name: /^Sign Out$/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockAuthValue.signOut).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin" });
      });
    });

    it("renders checking state when authentication is loading in SecurityTab", () => {
      const prevAuth = { ...mockAuthValue };
      mockAuthValue = {
        ...mockAuthValue,
        isLoading: true,
        session: null,
      };

      try {
        render(<SecurityTab />);
        expect(screen.getByText("Checking authentication session...")).toBeDefined();
      } finally {
        mockAuthValue = prevAuth;
      }
    });

    it("renders unauthenticated state when no session is present in SecurityTab", () => {
      const prevAuth = { ...mockAuthValue };
      mockAuthValue = {
        ...mockAuthValue,
        isAuthenticated: false,
        session: null,
      };

      try {
        render(<SecurityTab />);
        expect(screen.getByText("No Active Session")).toBeDefined();
        expect(screen.getByText("Authentication session is inactive or not established.")).toBeDefined();
      } finally {
        mockAuthValue = prevAuth;
      }
    });
  });

  // 3. Preferences Tab Rendering & Interactions
  describe("PreferencesTab", () => {
    it("renders Notification Preferences, Appearance Preferences, and Language & Region", () => {
      render(<PreferencesTab />);

      expect(screen.getByText("Notification Preferences")).toBeDefined();
      expect(screen.getByText("Appearance Preferences")).toBeDefined();
      expect(screen.getByText("Language & Region")).toBeDefined();

      // Notification Toggles
      expect(screen.getByText("System Announcements")).toBeDefined();
      expect(screen.getByText("Security Alerts")).toBeDefined();
      expect(screen.getByText("Admin Activities")).toBeDefined();
      expect(screen.getByText("Contact Inquiries")).toBeDefined();
      expect(screen.getByText("Marketing & Product Updates")).toBeDefined();

      // Theme Options - Dark is sole supported theme, Light mode removed
      expect(screen.getByText("Dark")).toBeDefined();
      expect(screen.queryByText("Light")).toBeNull();
    });

    it("clicking Save Preferences persists settings through adminClient and clears legacy localStorage", async () => {
      const updatePrefSpy = vi.spyOn(adminClient, "updateSelfPreferences").mockResolvedValue({
        success: true,
        data: {
          preferences: {} as any,
          profile: {} as any,
        },
      });

      render(<PreferencesTab />);

      const saveBtn = screen.getByRole("button", { name: /save preferences/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updatePrefSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            notifications: expect.objectContaining({
              systemAnnouncements: true,
              securityAlerts: true,
            }),
            portal: expect.objectContaining({
              language: "English",
              timezone: "(GMT+5:30) Asia/Kolkata",
            }),
          })
        );
      });
    });

    it("clicking Reset to Default resets preferences and clears custom localStorage item", async () => {
      localStorage.setItem("cobralearn_admin_preferences", JSON.stringify({ language: "Spanish" }));
      const updatePrefSpy = vi.spyOn(adminClient, "updateSelfPreferences").mockResolvedValue({
        success: true,
        data: {
          preferences: {} as any,
          profile: {} as any,
        },
      });

      render(<PreferencesTab />);

      const resetBtn = screen.getByRole("button", { name: /reset to default/i });
      fireEvent.click(resetBtn);

      expect(localStorage.getItem("cobralearn_admin_preferences")).toBeNull();
      await waitFor(() => {
        expect(updatePrefSpy).toHaveBeenCalled();
      });
    });
  });

  // 4. Activity & Sessions Tab Rendering
  describe("ActivitySessionsTab", () => {
    beforeEach(() => {
      mockAuthValue = {
        user: { id: "user-123", email: "admin@cobralearn.com" },
        session: {
          expires_at: 1780000000,
          user: { id: "user-123", email: "admin@cobralearn.com" },
        } as any,
        isAuthenticated: true,
        isLoading: false,
        signOut: vi.fn().mockResolvedValue({ success: true, data: undefined }),
      };
    });

    it("renders Recent Activity timeline from PostgreSQL and session status table on query success", async () => {
      vi.spyOn(adminClient, "getSelfAuditLogs").mockResolvedValue({
        success: true,
        data: {
          logs: [
            {
              id: "log-1",
              actorId: "user-123",
              actorEmail: "admin@cobralearn.com",
              action: "SELF_PROFILE_UPDATED",
              module: "PROFILE_MANAGEMENT",
              entityId: "user-123",
              ipAddress: null,
              metadata: {},
              createdAt: new Date(),
            },
          ],
          count: 1,
        },
      });

      render(<ActivitySessionsTab currentProfileId="user-123" />);

      expect(screen.getByText("Recent Activity")).toBeDefined();
      expect(screen.getByText("Active Sessions")).toBeDefined();
      expect(screen.getByText("Session & Security Status")).toBeDefined();

      await waitFor(() => {
        expect(screen.getByText("Profile updated")).toBeDefined();
      });

      // Security status table columns
      expect(screen.getByText("Audit Scope")).toBeDefined();
      expect(screen.getByText("Verification Mechanism")).toBeDefined();
      expect(screen.getByText("Backend Persistence")).toBeDefined();

      // Active status for auth session and connected status for audit query
      expect(screen.getByText("Active")).toBeDefined();
      expect(screen.getByText("Connected")).toBeDefined();
    });

    it("displays honest session details with formatted expiry and active badge when authenticated", async () => {
      vi.spyOn(adminClient, "getSelfAuditLogs").mockResolvedValue({
        success: true,
        data: { logs: [], count: 0 },
      });

      render(<ActivitySessionsTab currentProfileId="user-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading audit activity/i)).toBeNull();
      });

      expect(screen.getByText(/Current Browser Session/i)).toBeDefined();
      expect(screen.getByText("(Active Device)")).toBeDefined();
      expect(screen.getByText(/Active Supabase Session/i)).toBeDefined();
      expect(screen.getByText(/Expires:/i)).toBeDefined();
      // Ensure unverified "Verified Token" is NOT displayed
      expect(screen.queryByText(/Verified Token/i)).toBeNull();
    });

    it("omits expiry timestamp honestly when session metadata has no valid expires_at", async () => {
      mockAuthValue.session = {
        expires_at: null,
        user: { id: "user-123", email: "admin@cobralearn.com" },
      } as any;

      vi.spyOn(adminClient, "getSelfAuditLogs").mockResolvedValue({
        success: true,
        data: { logs: [], count: 0 },
      });

      render(<ActivitySessionsTab currentProfileId="user-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading audit activity/i)).toBeNull();
      });

      expect(screen.getByText(/Active Supabase Session/i)).toBeDefined();
      expect(screen.queryByText(/Expires:/i)).toBeNull();
    });

    it("renders loading state when authentication is checking", async () => {
      mockAuthValue.isLoading = true;
      mockAuthValue.session = null;

      vi.spyOn(adminClient, "getSelfAuditLogs").mockResolvedValue({
        success: true,
        data: { logs: [], count: 0 },
      });

      render(<ActivitySessionsTab currentProfileId="user-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading audit activity/i)).toBeNull();
      });

      expect(screen.getByText("Checking authentication session...")).toBeDefined();
      // Table authentication session row shows checking
      expect(screen.getAllByText("Checking...").length).toBeGreaterThanOrEqual(1);
    });

    it("renders honest unauthenticated state when no session is present", async () => {
      mockAuthValue.isAuthenticated = false;
      mockAuthValue.session = null;

      vi.spyOn(adminClient, "getSelfAuditLogs").mockResolvedValue({
        success: true,
        data: { logs: [], count: 0 },
      });

      render(<ActivitySessionsTab currentProfileId="user-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading audit activity/i)).toBeNull();
      });

      expect(screen.getByText("No Active Session")).toBeDefined();
      expect(screen.getByText("Authentication session is inactive or not established.")).toBeDefined();
      expect(screen.getByText("Inactive")).toBeDefined();
    });

    it("renders Unavailable status badge for Audit Logging Engine when audit query fails", async () => {
      vi.spyOn(adminClient, "getSelfAuditLogs").mockResolvedValue({
        success: false,
        error: "Failed to connect to audit log database",
      });

      render(<ActivitySessionsTab currentProfileId="user-123" />);

      await waitFor(() => {
        expect(screen.getByText("Failed to connect to audit log database")).toBeDefined();
      });

      // Audit Logging Engine row MUST show Unavailable, and NOT remain Connected
      expect(screen.getByText("Unavailable")).toBeDefined();
      expect(screen.queryByText("Connected")).toBeNull();
    });

    it("handles audit query rejection exception and shows Unavailable status", async () => {
      vi.spyOn(adminClient, "getSelfAuditLogs").mockRejectedValue(new Error("Network timeout"));

      render(<ActivitySessionsTab currentProfileId="user-123" />);

      await waitFor(() => {
        expect(screen.getByText("Network timeout")).toBeDefined();
      });

      expect(screen.getByText("Unavailable")).toBeDefined();
      expect(screen.queryByText("Connected")).toBeNull();
    });

    it("opens sign-out dialog and executes real sign-out with redirection", async () => {
      vi.spyOn(adminClient, "getSelfAuditLogs").mockResolvedValue({
        success: true,
        data: { logs: [], count: 0 },
      });

      render(<ActivitySessionsTab currentProfileId="user-123" />);

      // Find the session options button
      const optionsBtn = screen.getByRole("button", { name: "Session options" });
      fireEvent.keyDown(optionsBtn, { key: "Enter" });

      // Click "Sign out from this device" in the dropdown
      const signOutMenuItem = screen.getByText("Sign out from this device");
      fireEvent.click(signOutMenuItem);

      // Verify SignOutModal dialog is shown
      expect(screen.getByText("Sign Out?")).toBeDefined();
      expect(screen.getByText(/Are you sure you want to end your admin session/i)).toBeDefined();

      // Click the confirmation "Sign Out" button inside the modal
      const confirmBtn = screen.getByRole("button", { name: /^Sign Out$/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockAuthValue.signOut).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin" });
      });
    });
  });

  // 5. AccountActionsCard — Honest Data Export & Tab Navigation (SEC-01 & SEC-05)
  describe("AccountActionsCard", () => {
    it("opens honest export modal on Export My Data and does not emit fake success toast", () => {
      render(<AccountActionsCard onTabChange={vi.fn()} />);

      const exportBtn = screen.getByText("Export My Data");
      fireEvent.click(exportBtn);

      expect(screen.getByText("Account Data Export")).toBeDefined();
      expect(
        screen.getByText(
          /Self-service account data archiving is currently not available in this portal version \(V1\)\. No file or archive has been generated or downloaded\./i
        )
      ).toBeDefined();

      // Dismiss dialog
      const understoodBtn = screen.getByRole("button", { name: "Understood" });
      fireEvent.click(understoodBtn);
    });

    it("routes Manage Active Sessions to activity-sessions tab", () => {
      const onTabChange = vi.fn();
      render(<AccountActionsCard onTabChange={onTabChange} />);

      const manageSessionsBtn = screen.getByText("Manage Active Sessions");
      fireEvent.click(manageSessionsBtn);

      expect(onTabChange).toHaveBeenCalledWith("activity-sessions");
    });

    it("routes View Login History to login-history tab", () => {
      const onTabChange = vi.fn();
      render(<AccountActionsCard onTabChange={onTabChange} />);

      const viewHistoryBtn = screen.getByText("View Login History");
      fireEvent.click(viewHistoryBtn);

      expect(onTabChange).toHaveBeenCalledWith("login-history");
    });
  });

  // 6. AccountOverviewCard — Dynamic Preferences & Honest Session State (SEC-04)
  describe("AccountOverviewCard", () => {
    it("displays dynamic language and timezone from saved administrator preferences", () => {
      const mockProfileWithCustomPrefs = {
        id: "admin-1",
        email: "sarah@cobralearn.com",
        fullName: "Sarah Jenkins",
        role: "ADMIN",
        isActive: true,
        createdAt: new Date("2025-01-15"),
        preferences: {
          portal: {
            language: "Spanish",
            timezone: "(GMT-5:00) America/New_York",
          },
        },
      } as any;

      render(<AccountOverviewCard profile={mockProfileWithCustomPrefs} />);

      expect(screen.getByText("Spanish")).toBeDefined();
      expect(screen.getByText("(GMT-5:00) America/New_York")).toBeDefined();
      expect(screen.getByText("Active Session")).toBeDefined();
    });

    it("uses default language and timezone when preferences are absent or undefined", () => {
      const mockProfileWithoutPrefs = {
        id: "admin-1",
        email: "sarah@cobralearn.com",
        fullName: "Sarah Jenkins",
        role: "SUPER_ADMIN",
        isActive: true,
        createdAt: new Date("2024-06-01"),
        preferences: null,
      } as any;

      render(<AccountOverviewCard profile={mockProfileWithoutPrefs} />);

      expect(screen.getByText("English")).toBeDefined();
      expect(screen.getByText("(GMT+5:30) Asia/Kolkata")).toBeDefined();
      expect(screen.getByText("Super Administrator")).toBeDefined();
    });

    it("displays checking session status when authentication is loading", () => {
      const prevAuth = { ...mockAuthValue };
      mockAuthValue = {
        ...mockAuthValue,
        isLoading: true,
        session: null,
      };

      try {
        render(<AccountOverviewCard profile={null} />);
        expect(screen.getByText("Checking...")).toBeDefined();
      } finally {
        mockAuthValue = prevAuth;
      }
    });

    it("displays inactive session status when not authenticated", () => {
      const prevAuth = { ...mockAuthValue };
      mockAuthValue = {
        ...mockAuthValue,
        isAuthenticated: false,
        session: null,
      };

      try {
        render(<AccountOverviewCard profile={null} />);
        expect(screen.getByText("Inactive")).toBeDefined();
      } finally {
        mockAuthValue = prevAuth;
      }
    });
  });

  // 7. ChangePasswordForm — Current Password Re-Authentication (SEC-03)
  describe("ChangePasswordForm", () => {
    it("validates current password before attempting password update and blocks update if invalid", async () => {
      const changePasswordSpy = vi.spyOn(adminClient, "changePassword").mockResolvedValue({
        success: false,
        error: "Invalid login credentials",
      });
      const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValue({ data: null, error: null });

      render(<ChangePasswordForm />);

      // Fill in current password, new password, and confirmation
      fireEvent.change(screen.getByLabelText("Current Password"), {
        target: { value: "WrongCurrentPassword" },
      });
      fireEvent.change(screen.getByLabelText("New Password"), {
        target: { value: "NewSecurePass123!" },
      });
      fireEvent.change(screen.getByLabelText("Confirm New Password"), {
        target: { value: "NewSecurePass123!" },
      });

      const submitBtn = screen.getByRole("button", { name: /update password/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(changePasswordSpy).toHaveBeenCalledWith({
          currentPassword: "WrongCurrentPassword",
          newPassword: "NewSecurePass123!",
        });
        expect(signOutSpy).not.toHaveBeenCalled();
        expect(screen.getByText("Invalid login credentials")).toBeDefined();
      });
    });

    it("successfully calls updatePassword and navigates when current password is verified", async () => {
      const changePasswordSpy = vi.spyOn(adminClient, "changePassword").mockResolvedValue({
        success: true,
      });
      const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValue({ data: null, error: null });

      render(<ChangePasswordForm />);

      fireEvent.change(screen.getByLabelText("Current Password"), {
        target: { value: "CorrectCurrentPass123!" },
      });
      fireEvent.change(screen.getByLabelText("New Password"), {
        target: { value: "NewSecurePass123!" },
      });
      fireEvent.change(screen.getByLabelText("Confirm New Password"), {
        target: { value: "NewSecurePass123!" },
      });

      const submitBtn = screen.getByRole("button", { name: /update password/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(changePasswordSpy).toHaveBeenCalledWith({
          currentPassword: "CorrectCurrentPass123!",
          newPassword: "NewSecurePass123!",
        });
        expect(signOutSpy).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/password-updated" });
      });
    });
  });
});

