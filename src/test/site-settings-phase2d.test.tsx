import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { SecurityTab } from "@/components/settings/tabs/SecurityTab";
import { adminClient } from "@/lib/api/admin-client";
import type { AdminAuditLog } from "@prisma/client";

// Mock Supabase Server Client
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

// Mock adminClient
vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    getAuditLogs: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("Phase 2D: Security Audit History Live Data Integration", () => {
  const sampleAuditLogs: AdminAuditLog[] = [
    {
      id: "audit-1",
      actorId: "admin-uuid-1",
      actorEmail: "lead.sec@cobralearn.in",
      action: "SETTINGS_GLOBAL_UPDATE",
      module: "SETTINGS",
      entityId: "default-settings",
      metadata: { siteName: "CobraLearn Innotechcore" },
      ipAddress: "203.0.113.195",
      createdAt: new Date("2026-10-12T14:32:00Z"),
    },
    {
      id: "audit-2",
      actorId: "admin-uuid-2",
      actorEmail: "ops@cobralearn.in",
      action: "MEDIA_ASSET_UPLOAD",
      module: "MEDIA_LIBRARY",
      entityId: "asset-123",
      metadata: { filename: "banner.png" },
      ipAddress: null, // Test fallback to em dash
      createdAt: new Date("2026-10-11T09:15:00Z"),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Mock row removed and real records rendered", async () => {
    vi.mocked(adminClient.getAuditLogs).mockResolvedValue({
      success: true,
      data: {
        logs: sampleAuditLogs,
        count: 2,
      },
    });

    render(<SecurityTab />);

    // Old hardcoded mock strings should not exist
    expect(screen.queryByText("Admin Authentication")).toBeNull();
    expect(screen.queryByText("Current Session")).toBeNull();

    // Live data should be rendered
    await waitFor(() => {
      expect(screen.getByText("lead.sec@cobralearn.in")).toBeInTheDocument();
      expect(screen.getByText("ops@cobralearn.in")).toBeInTheDocument();
    });
  });

  it("2. Displays loading indicator while audit records are fetching", async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(adminClient.getAuditLogs).mockReturnValue(pendingPromise as any);

    render(<SecurityTab />);

    expect(screen.getByText(/Loading audit records from database/i)).toBeInTheDocument();

    // Resolve promise
    await act(async () => {
      resolvePromise!({
        success: true,
        data: { logs: sampleAuditLogs, count: 2 },
      });
    });

    await waitFor(() => {
      expect(screen.queryByText(/Loading audit records from database/i)).toBeNull();
    });
  });

  it("3. Displays empty state when no audit records exist", async () => {
    vi.mocked(adminClient.getAuditLogs).mockResolvedValue({
      success: true,
      data: {
        logs: [],
        count: 0,
      },
    });

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByText("No Audit Records Found")).toBeInTheDocument();
    });
  });

  it("4. Displays recoverable error state with retry action", async () => {
    vi.mocked(adminClient.getAuditLogs).mockResolvedValueOnce({
      success: false,
      error: "PostgreSQL connection timed out",
    });

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByText("PostgreSQL connection timed out")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry loading/i })).toBeInTheDocument();
    });

    // Mock successful recovery on retry
    vi.mocked(adminClient.getAuditLogs).mockResolvedValueOnce({
      success: true,
      data: {
        logs: sampleAuditLogs,
        count: 2,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /retry loading/i }));

    await waitFor(() => {
      expect(screen.getByText("lead.sec@cobralearn.in")).toBeInTheDocument();
    });
    expect(adminClient.getAuditLogs).toHaveBeenCalledTimes(2);
  });

  it("5. Handles authorization-denied (403) gracefully with clear role requirement", async () => {
    vi.mocked(adminClient.getAuditLogs).mockResolvedValue({
      success: false,
      error: "Forbidden: Insufficient privileges for action audit_log:read",
    });

    render(<SecurityTab />);

    await waitFor(() => {
      expect(
        screen.getByText(/Forbidden: Insufficient privileges for action audit_log:read/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/requires SUPER_ADMIN or ADMIN privileges/i)
      ).toBeInTheDocument();
    });
  });

  it("6. Correct field mapping and truthful RECORDED status", async () => {
    vi.mocked(adminClient.getAuditLogs).mockResolvedValue({
      success: true,
      data: {
        logs: sampleAuditLogs,
        count: 2,
      },
    });

    render(<SecurityTab />);

    await waitFor(() => {
      // Account
      expect(screen.getByText("lead.sec@cobralearn.in")).toBeInTheDocument();
      expect(screen.getByText("ops@cobralearn.in")).toBeInTheDocument();

      // IP address & fallback em dash
      expect(screen.getByText("203.0.113.195")).toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();

      // Action / Module
      expect(screen.getByText("SETTINGS_GLOBAL_UPDATE")).toBeInTheDocument();
      expect(screen.getByText("SETTINGS")).toBeInTheDocument();
      expect(screen.getByText("MEDIA_ASSET_UPLOAD")).toBeInTheDocument();
      expect(screen.getByText("MEDIA_LIBRARY")).toBeInTheDocument();

      // Truthful status badge (not false SUCCESS / LOGIN)
      const badges = screen.getAllByText("RECORDED");
      expect(badges.length).toBe(2);
    });
  });

  it("7. Pagination controls, boundary disabling, and navigation", async () => {
    // Generate a full page of 25 records
    const fullPageLogs: AdminAuditLog[] = Array.from({ length: 25 }, (_, i) => ({
      id: `audit-${i}`,
      actorId: `admin-${i}`,
      actorEmail: `admin${i}@cobralearn.in`,
      action: "CONTENT_PUBLISH",
      module: "PROJECTS",
      entityId: `entity-${i}`,
      metadata: null,
      ipAddress: "192.168.1.1",
      createdAt: new Date("2026-10-10T12:00:00Z"),
    }));

    vi.mocked(adminClient.getAuditLogs).mockResolvedValue({
      success: true,
      data: {
        logs: fullPageLogs,
        count: 25,
      },
    });

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByText("admin0@cobralearn.in")).toBeInTheDocument();
    });

    // Previous is disabled on page 1
    const prevBtn = screen.getByRole("button", { name: /previous/i });
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Mock page 2 with fewer than 25 records (end of list)
    const page2Logs: AdminAuditLog[] = [
      {
        id: "audit-26",
        actorId: "admin-26",
        actorEmail: "admin26@cobralearn.in",
        action: "CONTENT_DELETE",
        module: "PROJECTS",
        entityId: "entity-26",
        metadata: null,
        ipAddress: "192.168.1.2",
        createdAt: new Date("2026-10-09T10:00:00Z"),
      },
    ];

    vi.mocked(adminClient.getAuditLogs).mockResolvedValueOnce({
      success: true,
      data: {
        logs: page2Logs,
        count: 1,
      },
    });

    // Click Next
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(adminClient.getAuditLogs).toHaveBeenCalledWith({
        limit: 25,
        offset: 25,
      });
      expect(screen.getByText("admin26@cobralearn.in")).toBeInTheDocument();
    });

    // On page 2, Previous is enabled and Next is disabled (since < 25 records returned)
    expect(screen.getByRole("button", { name: /previous/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();

    // Click Previous to return to page 1
    vi.mocked(adminClient.getAuditLogs).mockResolvedValueOnce({
      success: true,
      data: {
        logs: fullPageLogs,
        count: 25,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /previous/i }));

    await waitFor(() => {
      expect(adminClient.getAuditLogs).toHaveBeenCalledWith({
        limit: 25,
        offset: 0,
      });
    });
  });

  it("8. Protects against stale requests when component unmounts", async () => {
    let resolveStalePromise: (value: any) => void;
    const slowPromise = new Promise((resolve) => {
      resolveStalePromise = resolve;
    });

    vi.mocked(adminClient.getAuditLogs).mockReturnValue(slowPromise as any);

    const { unmount } = render(<SecurityTab />);

    // Unmount before response arrives
    unmount();

    // Resolving after unmount should not cause uncaught error
    await act(async () => {
      resolveStalePromise!({
        success: true,
        data: { logs: sampleAuditLogs, count: 2 },
      });
    });
  });
});
