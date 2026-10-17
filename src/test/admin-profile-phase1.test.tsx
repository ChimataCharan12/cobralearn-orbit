import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { PrismaClient, AdminProfile } from "@prisma/client";
import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { ProfileInfoCard } from "@/components/profile/ProfileInfoCard";
import { SecurityTab } from "@/components/profile/SecurityTab";
import { ActivitySessionsTab } from "@/components/profile/ActivitySessionsTab";
import {
  getSelfAuditLogsOperation,
  getAuditLogsOperation,
  uploadAvatarOperation,
  updateSelfProfileOperation,
  ALLOWED_AVATAR_MIMES,
  MAX_AVATAR_SIZE_BYTES,
} from "@/lib/server/admin-operations";
import { adminClient } from "@/lib/api/admin-client";

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

// Mock useAuth
vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "sarah@cobralearn.com" },
    isAuthenticated: true,
  }),
  useAuthGuard: vi.fn(),
}));

// Top-level server-auth context mocking
let currentServerContext = {
  user: { id: "admin-1", email: "sarah@cobralearn.com" },
  profile: {
    id: "admin-1",
    email: "sarah@cobralearn.com",
    role: "ADMIN" as any,
    isActive: true,
  },
};

vi.mock("@/lib/auth/server-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/server-auth")>();
  return {
    ...actual,
    requireAdminProfile: vi.fn().mockImplementation(async () => currentServerContext),
    requireAal2: vi.fn().mockImplementation(async () => currentServerContext),
    requireAal2Permission: vi.fn().mockImplementation(async (_req, perm) => {
      const { canPerform } = await import("@/lib/auth/rbac");
      if (!canPerform(currentServerContext.profile.role, perm)) {
        throw new Error(`Forbidden: Insufficient permissions for ${perm}`);
      }
      return currentServerContext;
    }),
    requirePermission: vi.fn().mockImplementation(async (_req, perm) => {
      const { canPerform } = await import("@/lib/auth/rbac");
      if (!canPerform(currentServerContext.profile.role, perm)) {
        throw new Error(`Forbidden: Insufficient permissions for ${perm}`);
      }
      return currentServerContext;
    }),
  };
});

// Mock useAdminProfile
let mockProfileState: AdminProfile | null = {
  id: "admin-1",
  email: "sarah@cobralearn.com",
  fullName: "Sarah Jenkins",
  role: "ADMIN",
  phone: null,
  designation: "Lead Administrator",
  avatarUrl: "https://cdn.example.com/avatars/sarah.png",
  bio: null,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock("@/lib/auth/use-admin-profile", () => ({
  useAdminProfile: () => ({
    profile: mockProfileState,
    isLoading: false,
    isSaving: false,
    error: null,
    reloadProfile: vi.fn(),
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
  }),
}));

describe("Phase 1: Admin Profile Core Completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentServerContext = {
      user: { id: "admin-1", email: "sarah@cobralearn.com" },
      profile: {
        id: "admin-1",
        email: "sarah@cobralearn.com",
        role: "ADMIN" as any,
        isActive: true,
      },
    };
  });

  // =========================================================================
  // TASK 1: AdminHeader Identity Synchronization
  // =========================================================================
  describe("Task 1: AdminHeader Identity Binding", () => {
    it("binds authenticated administrator display name, role label, and avatar image", () => {
      mockProfileState = {
        id: "admin-1",
        email: "sarah@cobralearn.com",
        fullName: "Sarah Jenkins",
        role: "ADMIN",
        phone: null,
        designation: "Lead Administrator",
        avatarUrl: "https://cdn.example.com/avatars/sarah.png",
        bio: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      render(<AdminHeader onMenu={vi.fn()} />);

      expect(screen.getByText("Sarah Jenkins")).toBeDefined();
      expect(screen.getByText("Administrator")).toBeDefined();

      const img = screen.getByRole("img", { name: "Sarah Jenkins" });
      expect(img).toBeDefined();
      expect(img.getAttribute("src")).toBe("https://cdn.example.com/avatars/sarah.png");
    });

    it("falls back gracefully to initials when avatarUrl is missing", () => {
      mockProfileState = {
        id: "admin-2",
        email: "alex@cobralearn.com",
        fullName: "Alex Rivera",
        role: "SUPER_ADMIN",
        phone: null,
        designation: null,
        avatarUrl: null,
        bio: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      render(<AdminHeader onMenu={vi.fn()} />);

      expect(screen.getByText("Alex Rivera")).toBeDefined();
      expect(screen.getByText("Super Administrator")).toBeDefined();
      expect(screen.getByText("A")).toBeDefined();
      expect(screen.queryByRole("img")).toBeNull();
    });

    it("falls back to Content Editor role label for EDITOR role", () => {
      mockProfileState = {
        id: "editor-1",
        email: "editor@cobralearn.com",
        fullName: "Elena Rostova",
        role: "EDITOR",
        phone: null,
        designation: null,
        avatarUrl: null,
        bio: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      render(<AdminHeader onMenu={vi.fn()} />);

      expect(screen.getByText("Elena Rostova")).toBeDefined();
      expect(screen.getByText("Content Editor")).toBeDefined();
      expect(screen.getByText("E")).toBeDefined();
    });
  });

  // =========================================================================
  // TASK 2: Self-Scoped Activity History
  // =========================================================================
  describe("Task 2: Self-Scoped Activity History", () => {
    it("getSelfAuditLogsOperation scopes strictly to authenticated admin ID for EDITOR", async () => {
      currentServerContext = {
        user: { id: "editor-1", email: "editor@cobralearn.com" },
        profile: {
          id: "editor-1",
          email: "editor@cobralearn.com",
          role: "EDITOR" as any,
          isActive: true,
        },
      };

      const mockFindMany = vi.fn().mockResolvedValue([
        {
          id: "log-1",
          actorId: "editor-1",
          actorEmail: "editor@cobralearn.com",
          action: "SELF_PROFILE_UPDATED",
          module: "PROFILE_MANAGEMENT",
          entityId: "editor-1",
          createdAt: new Date(),
        },
      ]);

      const mockPrisma = {
        adminAuditLog: {
          findMany: mockFindMany,
        },
      } as unknown as PrismaClient;

      const request = new Request("https://api.internal/admin/profile/activity", {
        headers: { Cookie: "sb-access-token=valid-editor-token" },
      });

      const result = await getSelfAuditLogsOperation(request, { limit: 10 }, mockPrisma);

      expect(result.count).toBe(1);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ actorId: "editor-1" }, { entityId: "editor-1" }],
          },
          take: 10,
        })
      );
    });

    it("preserves global audit log restriction: EDITOR cannot access global getAuditLogsOperation", async () => {
      currentServerContext = {
        user: { id: "editor-1", email: "editor@cobralearn.com" },
        profile: {
          id: "editor-1",
          email: "editor@cobralearn.com",
          role: "EDITOR" as any,
          isActive: true,
        },
      };

      const request = new Request("https://api.internal/admin/audit-logs", {
        headers: { Cookie: "sb-access-token=valid-editor-token" },
      });

      const mockPrisma = {} as unknown as PrismaClient;

      await expect(getAuditLogsOperation(request, {}, mockPrisma)).rejects.toThrow(/Forbidden/i);
    });

    it("ActivitySessionsTab renders self logs via getSelfAuditLogs", async () => {
      vi.spyOn(adminClient, "getSelfAuditLogs").mockResolvedValue({
        success: true,
        data: {
          logs: [
            {
              id: "self-log-1",
              actorId: "editor-1",
              actorEmail: "editor@cobralearn.com",
              action: "AVATAR_UPDATED",
              module: "PROFILE_MANAGEMENT",
              entityId: "editor-1",
              ipAddress: null,
              metadata: {},
              createdAt: new Date(),
            },
          ],
          count: 1,
        },
      });

      render(<ActivitySessionsTab currentProfileId="editor-1" />);

      await waitFor(() => {
        expect(screen.getByText("Avatar photo updated")).toBeDefined();
        expect(screen.getByText("Actor: editor@cobralearn.com • Module: PROFILE_MANAGEMENT")).toBeDefined();
      });
    });
  });

  // =========================================================================
  // TASK 3: Secure Avatar Upload
  // =========================================================================
  describe("Task 3: Secure Avatar Upload Validation & Rollback", () => {
    it("enforces allowed avatar MIME types and 2MB limit", () => {
      expect(ALLOWED_AVATAR_MIMES.has("image/jpeg")).toBe(true);
      expect(ALLOWED_AVATAR_MIMES.has("image/png")).toBe(true);
      expect(ALLOWED_AVATAR_MIMES.has("image/webp")).toBe(true);
      expect(ALLOWED_AVATAR_MIMES.has("image/svg+xml")).toBe(false);
      expect(MAX_AVATAR_SIZE_BYTES).toBe(2 * 1024 * 1024);
    });

    it("rejects non-image or SVG upload attempts", async () => {
      const request = new Request("https://api.internal/admin/profile/avatar", {
        headers: { Cookie: "sb-access-token=valid-token" },
      });

      const mockPrisma = {} as unknown as PrismaClient;

      // SVG attempt
      await expect(
        uploadAvatarOperation(
          request,
          {
            originalFilename: "malicious.svg",
            mimeType: "image/svg+xml",
            base64Content: Buffer.from("<svg>alert(1)</svg>").toString("base64"),
          },
          mockPrisma
        )
      ).rejects.toThrow(/Unsupported avatar format/i);
    });

    it("rejects avatar files exceeding 2MB", async () => {
      const request = new Request("https://api.internal/admin/profile/avatar", {
        headers: { Cookie: "sb-access-token=valid-token" },
      });

      const mockPrisma = {} as unknown as PrismaClient;
      const oversizedBuffer = Buffer.alloc(2.5 * 1024 * 1024);

      await expect(
        uploadAvatarOperation(
          request,
          {
            originalFilename: "large.png",
            mimeType: "image/png",
            base64Content: oversizedBuffer.toString("base64"),
          },
          mockPrisma
        )
      ).rejects.toThrow(/exceeds maximum allowed 2.0 MB/i);
    });

    it("cleans up storage upload if database persistence fails (prevents orphaned files)", async () => {
      const request = new Request("https://api.internal/admin/profile/avatar", {
        headers: { Cookie: "sb-access-token=valid-token" },
      });

      // 1x1 valid PNG buffer
      const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockStorage = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ error: null }),
            getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://storage.supabase.co/avatars/admin-1/test.png" } }),
            remove: mockRemove,
          }),
        },
      } as any;

      const mockPrisma = {
        $transaction: vi.fn().mockRejectedValue(new Error("Database connection dropped")),
      } as unknown as PrismaClient;

      await expect(
        uploadAvatarOperation(
          request,
          {
            originalFilename: "avatar.png",
            mimeType: "image/png",
            base64Content: validPngBase64,
          },
          mockPrisma,
          mockStorage
        )
      ).rejects.toThrow("Database connection dropped");

      // Verify rollback cleanup was executed for admin-1's path
      expect(mockRemove).toHaveBeenCalledWith([expect.stringMatching(/^avatars\/admin-1\//)]);
    });

    it("ProfileInfoCard wires Change Photo button to file input and invokes onRemoveAvatar", async () => {
      const onUploadAvatar = vi.fn().mockResolvedValue(true);
      const onRemoveAvatar = vi.fn().mockResolvedValue(true);
      const onChange = vi.fn();

      render(
        <ProfileInfoCard
          profile={mockProfileState}
          formData={{
            fullName: "Sarah Jenkins",
            phone: "",
            designation: "Lead Administrator",
            bio: "",
            avatarUrl: null,
          }}
          onChange={onChange}
          onUploadAvatar={onUploadAvatar}
          onRemoveAvatar={onRemoveAvatar}
        />
      );

      const changePhotoBtn = screen.getByRole("button", { name: /change photo/i });
      expect(changePhotoBtn).toBeDefined();

      const removeBtn = screen.getByRole("button", { name: /remove/i });
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(onRemoveAvatar).toHaveBeenCalled();
        expect(onChange).toHaveBeenCalledWith({ avatarUrl: null });
      });
    });
  });

  // =========================================================================
  // TASK 4: Session & MFA Placeholder Honesty
  // =========================================================================
  describe("Task 4: Session & MFA Placeholder Honesty", () => {
    it("SecurityTab displays honest single active session and no fake remote sessions or revoke buttons", () => {
      render(<SecurityTab />);

      // Single active session
      expect(screen.getByText(/Current Browser Session/i)).toBeDefined();
      expect(screen.getByText(/Supabase Auth Session/i)).toBeDefined();
      expect(screen.getByText("Current")).toBeDefined();

      // No fake Android or secondary device
      expect(screen.queryByText(/Android/i)).toBeNull();
      expect(screen.queryByRole("button", { name: /^revoke$/i })).toBeNull();
    });

    it("SecurityTab displays honest MFA status and informative policy modal", () => {
      render(<SecurityTab />);

      expect(screen.getByText("Managed by Auth Provider")).toBeDefined();

      const detailsBtn = screen.getByRole("button", { name: /mfa details/i });
      fireEvent.click(detailsBtn);

      expect(screen.getByText("Multi-Factor Authentication")).toBeDefined();
      expect(screen.getAllByText(/Provider Policy/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Self-service in-portal MFA enrollment is not configured/i)).toBeDefined();
    });

    it("preserves working Change Password route navigation", () => {
      render(<SecurityTab />);

      const changePasswordBtn = screen.getByRole("button", { name: /change password/i });
      fireEvent.click(changePasswordBtn);

      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/profile/change-password" });
    });
  });

  // =========================================================================
  // PROFILE EDITING REGRESSION CHECK
  // =========================================================================
  describe("Profile Editing Security Constraints", () => {
    it("updateSelfProfileOperation rejects tampering with role or email", async () => {
      const request = new Request("https://api.internal/admin/profile/self", {
        headers: { Cookie: "sb-access-token=valid-token" },
      });

      const mockPrisma = {} as unknown as PrismaClient;

      await expect(
        updateSelfProfileOperation(
          request,
          {
            role: "SUPER_ADMIN" as any,
          },
          mockPrisma
        )
      ).rejects.toThrow(/Forbidden: Cannot self-assign or elevate administrative role/i);
    });
  });
});
