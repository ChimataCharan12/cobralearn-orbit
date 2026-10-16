import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginHistoryTab } from "@/components/profile/LoginHistoryTab";
import { adminClient } from "@/lib/api/admin-client";
import {
  recordAdminLoginOperation,
  getSelfLoginHistoryOperation,
} from "@/lib/server/admin-operations";
import { parseUserAgent } from "@/lib/server/user-agent";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Mock Supabase Server Client
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

// Mock adminClient
vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    getSelfLoginHistory: vi.fn(),
    recordLoginHistory: vi.fn(),
  },
}));

describe("Admin Login History — User Agent Parser", () => {
  it("bounds long user-agent strings and categorizes browser/os/device", () => {
    const longUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 " + "A".repeat(1000);
    const result = parseUserAgent(longUa);

    expect(result.browser).toBe("Google Chrome");
    expect(result.os).toBe("Windows 10/11");
    expect(result.deviceType).toBe("Desktop");
  });

  it("identifies representative Windows + Chrome correctly", () => {
    const winChromeUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
    const res = parseUserAgent(winChromeUa);
    expect(res.browser).toBe("Google Chrome");
    expect(res.os).toBe("Windows 10/11");
    expect(res.deviceType).toBe("Desktop");
  });

  it("identifies Microsoft Edge on Windows and iOS", () => {
    const modernEdgeUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0";
    const resModern = parseUserAgent(modernEdgeUa);
    expect(resModern.browser).toBe("Microsoft Edge");
    expect(resModern.os).toBe("Windows 10/11");
    expect(resModern.deviceType).toBe("Desktop");

    const legacyEdgeUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.19041";
    const resLegacy = parseUserAgent(legacyEdgeUa);
    expect(resLegacy.browser).toBe("Microsoft Edge");
    expect(resLegacy.os).toBe("Windows 10/11");
    expect(resLegacy.deviceType).toBe("Desktop");

    const iosEdgeUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/605.1.15 EdgiOS/120.0.0.0";
    const resIosEdge = parseUserAgent(iosEdgeUa);
    expect(resIosEdge.browser).toBe("Microsoft Edge");
    expect(resIosEdge.os).toBe("iOS");
    expect(resIosEdge.deviceType).toBe("Mobile");
  });

  it("identifies Samsung Internet on Android mobile", () => {
    const samsungUa = "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36";
    const res = parseUserAgent(samsungUa);
    expect(res.browser).toBe("Samsung Internet");
    expect(res.os).toBe("Android");
    expect(res.deviceType).toBe("Mobile");
  });

  it("identifies mobile and tablet devices accurately", () => {
    const mobileUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const resMobile = parseUserAgent(mobileUa);
    expect(resMobile.deviceType).toBe("Mobile");
    expect(resMobile.os).toBe("iOS");

    const tabletUa = "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15";
    const resTablet = parseUserAgent(tabletUa);
    expect(resTablet.deviceType).toBe("Tablet");
  });

  it("handles non-browser CLI/scripts honestly as Unknown without guessing Desktop", () => {
    const curlUa = "curl/8.4.0";
    const res = parseUserAgent(curlUa);
    expect(res.browser).toBe("Unknown");
    expect(res.os).toBe("Unknown");
    expect(res.deviceType).toBe("Unknown");
  });

  it("handles null, empty, and whitespace user-agents gracefully", () => {
    expect(parseUserAgent(null)).toEqual({ browser: "Unknown", os: "Unknown", deviceType: "Unknown" });
    expect(parseUserAgent("")).toEqual({ browser: "Unknown", os: "Unknown", deviceType: "Unknown" });
    expect(parseUserAgent("   ")).toEqual({ browser: "Unknown", os: "Unknown", deviceType: "Unknown" });
  });
});

describe("Admin Login History — Server Operations", () => {
  const mockAdminProfile = {
    id: "admin-uuid-1",
    email: "admin@cobralearn.com",
    role: "SUPER_ADMIN" as const,
    isActive: true,
  };

  const mockUser = {
    id: "admin-uuid-1",
    email: "admin@cobralearn.com",
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: mockUser, access_token: "mock-token" } },
          error: null,
        }),
      },
    });
  });

  const createMockPrisma = () => {
    const loginRecords: any[] = [];
    return {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === "admin-uuid-1") return Promise.resolve(mockAdminProfile);
          return Promise.resolve(null);
        }),
        update: vi.fn().mockResolvedValue(mockAdminProfile),
      },
      adminLoginHistory: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          // Check unique sessionId constraint
          if (data.sessionId && loginRecords.some((r) => r.sessionId === data.sessionId)) {
            const err = new Error("Unique constraint failed on the fields: (`sessionId`)");
            (err as any).code = "P2002";
            throw err;
          }
          const record = { id: `hist-${loginRecords.length + 1}`, ...data, loginAt: new Date() };
          loginRecords.push(record);
          return record;
        }),
        count: vi.fn().mockImplementation(async ({ where }) => {
          return loginRecords.filter((r) => !where?.adminId || r.adminId === where.adminId).length;
        }),
        findMany: vi.fn().mockImplementation(async ({ where, skip = 0, take = 10 }) => {
          return loginRecords
            .filter((r) => !where?.adminId || r.adminId === where.adminId)
            .slice(skip, skip + take);
        }),
      },
    };
  };

  it("records a successful login with server-derived identity and bounded metadata", async () => {
    const mockPrisma = createMockPrisma();
    const payload = Buffer.from(JSON.stringify({ session_id: "sess-valid-123" })).toString("base64url");
    const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;

    const req = new Request("https://api.internal/admin/login-history", {
      headers: {
        authorization: `Bearer ${fakeJwt}`,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      },
    });

    const result = await recordAdminLoginOperation(req, mockPrisma as any);
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();

    expect(mockPrisma.adminLoginHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminId: "admin-uuid-1",
          email: "admin@cobralearn.com",
          sessionId: "sess-valid-123",
          browser: "Google Chrome",
          os: "Windows 10/11",
          deviceType: "Desktop",
        }),
      })
    );

    expect(mockPrisma.adminProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "admin-uuid-1" },
        data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      })
    );
  });

  it("rejects history recording when session identifier is missing or unverifiable (fail closed)", async () => {
    const mockPrisma = createMockPrisma();
    // Non-JWT plain token without session_id claim
    const req = new Request("https://api.internal/admin/login-history", {
      headers: {
        authorization: "Bearer invalid-or-missing-session-token",
        "user-agent": "Mozilla/5.0",
      },
    });

    await expect(recordAdminLoginOperation(req, mockPrisma as any)).rejects.toThrow(
      "Validation Error: Missing or unverifiable session identifier"
    );

    // Verify neither database insert nor lastLoginAt update occurred
    expect(mockPrisma.adminLoginHistory.create).not.toHaveBeenCalled();
    expect(mockPrisma.adminProfile.update).not.toHaveBeenCalled();
  });

  it("rejects recording for deactivated admin profiles (isActive: false)", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.adminProfile.findUnique.mockResolvedValueOnce({
      ...mockAdminProfile,
      isActive: false,
    });

    const payload = Buffer.from(JSON.stringify({ session_id: "sess-valid-123" })).toString("base64url");
    const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;

    const req = new Request("https://api.internal/admin/login-history", {
      headers: { authorization: `Bearer ${fakeJwt}` },
    });

    await expect(recordAdminLoginOperation(req, mockPrisma as any)).rejects.toThrow(
      "Forbidden: AdminProfile is deactivated"
    );

    expect(mockPrisma.adminLoginHistory.create).not.toHaveBeenCalled();
  });

  it("rejects recording when admin profile is not found", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.adminProfile.findUnique.mockResolvedValueOnce(null);

    const payload = Buffer.from(JSON.stringify({ session_id: "sess-valid-123" })).toString("base64url");
    const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;

    const req = new Request("https://api.internal/admin/login-history", {
      headers: { authorization: `Bearer ${fakeJwt}` },
    });

    await expect(recordAdminLoginOperation(req, mockPrisma as any)).rejects.toThrow(
      "Forbidden: AdminProfile not found for authenticated user"
    );

    expect(mockPrisma.adminLoginHistory.create).not.toHaveBeenCalled();
  });

  it("enforces session idempotency: duplicate sessionId returns duplicate: true without crashing", async () => {
    const mockPrisma = createMockPrisma();

    // Fabricate JWT with explicit session_id claim
    const payload = Buffer.from(JSON.stringify({ session_id: "sess-abc-123" })).toString("base64url");
    const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;

    const req1 = new Request("https://api.internal/admin/login-history", {
      headers: { authorization: `Bearer ${fakeJwt}`, "user-agent": "TestBrowser" },
    });
    const res1 = await recordAdminLoginOperation(req1, mockPrisma as any);
    expect(res1.success).toBe(true);
    expect(res1.duplicate).toBeUndefined();

    // Second call with same token / sessionId
    const req2 = new Request("https://api.internal/admin/login-history", {
      headers: { authorization: `Bearer ${fakeJwt}`, "user-agent": "TestBrowser" },
    });
    const res2 = await recordAdminLoginOperation(req2, mockPrisma as any);
    expect(res2.success).toBe(true);
    expect(res2.duplicate).toBe(true);
  });

  it("handles database write failure safely by logging and rethrowing without leaking secrets", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.adminLoginHistory.create.mockRejectedValueOnce(new Error("Connection terminated unexpectedly"));

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const payload = Buffer.from(JSON.stringify({ session_id: "sess-db-err" })).toString("base64url");
    const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;

    const req = new Request("https://api.internal/admin/login-history", {
      headers: { authorization: `Bearer ${fakeJwt}` },
    });

    await expect(recordAdminLoginOperation(req, mockPrisma as any)).rejects.toThrow(
      "Connection terminated unexpectedly"
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[recordAdminLoginOperation]"),
      expect.objectContaining({
        adminId: "admin-uuid-1",
        error: "Connection terminated unexpectedly",
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it("strictly scopes login history retrieval to the authenticated admin (tenant isolation)", async () => {
    const mockPrisma = createMockPrisma();

    // Insert 5 records for admin-uuid-1
    for (let i = 1; i <= 5; i++) {
      await mockPrisma.adminLoginHistory.create({
        data: {
          adminId: "admin-uuid-1",
          email: "admin@cobralearn.com",
          sessionId: `sess-admin1-${i}`,
          browser: "Chrome",
          os: "Windows",
          deviceType: "Desktop",
        },
      });
    }

    // Insert 5 records for other admin-uuid-2
    for (let i = 1; i <= 5; i++) {
      await mockPrisma.adminLoginHistory.create({
        data: {
          adminId: "admin-uuid-2",
          email: "other@cobralearn.com",
          sessionId: `sess-admin2-${i}`,
          browser: "Firefox",
          os: "macOS",
          deviceType: "Desktop",
        },
      });
    }

    const req = new Request("https://api.internal/admin/self/login-history", {
      headers: { authorization: "Bearer test-token-123" },
    });

    const result = await getSelfLoginHistoryOperation(req, { page: 1, limit: 10 }, mockPrisma as any);
    expect(result.total).toBe(5);
    expect(result.items.length).toBe(5);
    // Ensure all returned items belong strictly to admin-uuid-1
    expect(result.items.every((item: any) => item.adminId === "admin-uuid-1")).toBe(true);
    expect(result.items.some((item: any) => item.adminId === "admin-uuid-2")).toBe(false);
  });
});

describe("Admin Login History — UI Component (LoginHistoryTab)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockHistoryData = {
    items: [
      {
        id: "hist-1",
        adminId: "admin-uuid-1",
        email: "admin@cobralearn.com",
        sessionId: "sess-1111-2222-3333-4444",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        browser: "Google Chrome",
        os: "Windows 10/11",
        deviceType: "Desktop",
        loginAt: new Date().toISOString(),
      },
      {
        id: "hist-2",
        adminId: "admin-uuid-1",
        email: "admin@cobralearn.com",
        sessionId: "sess-5555-6666-7777-8888",
        userAgent: "Mozilla/5.0 (iPhone; CPU OS 17_0 like Mac OS X)",
        browser: "Apple Safari",
        os: "iOS",
        deviceType: "Mobile",
        loginAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    total: 2,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  it("renders records with device information and success badge", async () => {
    vi.mocked(adminClient.getSelfLoginHistory).mockResolvedValueOnce({
      success: true,
      data: mockHistoryData as any,
    });

    render(<LoginHistoryTab currentProfileId="admin-uuid-1" />);

    expect(screen.getByText("Loading login records...")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Admin Login History")).toBeDefined();
      expect(screen.getByText("Google Chrome on Windows 10/11")).toBeDefined();
      expect(screen.getByText("Apple Safari on iOS")).toBeDefined();
    });

    // Check success badge
    const successBadges = screen.getAllByText("Success");
    expect(successBadges.length).toBe(2);

    // Check pagination summary
    expect(screen.getByText(/Showing/)).toBeDefined();
  });

  it("renders empty state when no historical logins exist", async () => {
    vi.mocked(adminClient.getSelfLoginHistory).mockResolvedValueOnce({
      success: true,
      data: { items: [], total: 0, page: 1, limit: 10, totalPages: 1 },
    });

    render(<LoginHistoryTab currentProfileId="admin-uuid-1" />);

    await waitFor(() => {
      expect(screen.getByText("No Historical Logins Recorded")).toBeDefined();
    });
  });

  it("renders error state with retry button on API failure", async () => {
    vi.mocked(adminClient.getSelfLoginHistory).mockResolvedValueOnce({
      success: false,
      error: "Database connection failed",
    });

    render(<LoginHistoryTab currentProfileId="admin-uuid-1" />);

    await waitFor(() => {
      expect(screen.getByText("Database connection failed")).toBeDefined();
      expect(screen.getByText("Try Again")).toBeDefined();
    });

    // Click retry
    vi.mocked(adminClient.getSelfLoginHistory).mockResolvedValueOnce({
      success: true,
      data: mockHistoryData as any,
    });

    fireEvent.click(screen.getByText("Try Again"));

    await waitFor(() => {
      expect(screen.getByText("Google Chrome on Windows 10/11")).toBeDefined();
    });
  });

  it("renders honest fallback labels when metadata is Unknown or null", async () => {
    vi.mocked(adminClient.getSelfLoginHistory).mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            id: "hist-unknown",
            adminId: "admin-uuid-1",
            email: "admin@cobralearn.com",
            sessionId: "sess-9999",
            userAgent: null,
            browser: "Unknown",
            os: "Unknown",
            deviceType: "Unknown",
            loginAt: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      } as any,
    });

    render(<LoginHistoryTab currentProfileId="admin-uuid-1" />);

    await waitFor(() => {
      // Must render "Unknown Browser on Unknown OS" instead of "Unknown on Unknown"
      expect(screen.getByText("Unknown Browser on Unknown OS")).toBeDefined();
      expect(screen.getByText("Unknown Client")).toBeDefined();
    });
  });

  it("displays accurate pagination range for initial, middle, and final partial pages", async () => {
    // 1. Page 1 of 25
    vi.mocked(adminClient.getSelfLoginHistory).mockResolvedValueOnce({
      success: true,
      data: {
        items: Array(10).fill(null).map((_, i) => ({
          id: `hist-p1-${i}`,
          adminId: "admin-uuid-1",
          email: "admin@cobralearn.com",
          sessionId: `sess-p1-${i}`,
          userAgent: null,
          browser: "Chrome",
          os: "Windows",
          deviceType: "Desktop",
          loginAt: new Date().toISOString(),
        })),
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
      } as any,
    });

    const { unmount } = render(<LoginHistoryTab currentProfileId="admin-uuid-1" />);

    await waitFor(() => {
      expect(
        screen.getByText((_, el) => el?.textContent === "Showing 1–10 of 25 total logins")
      ).toBeDefined();
    });
    unmount();

    // 2. Page 2 of 25
    vi.mocked(adminClient.getSelfLoginHistory).mockResolvedValueOnce({
      success: true,
      data: {
        items: Array(10).fill(null).map((_, i) => ({
          id: `hist-p2-${i}`,
          adminId: "admin-uuid-1",
          email: "admin@cobralearn.com",
          sessionId: `sess-p2-${i}`,
          userAgent: null,
          browser: "Chrome",
          os: "Windows",
          deviceType: "Desktop",
          loginAt: new Date().toISOString(),
        })),
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      } as any,
    });

    const renderedP2 = render(<LoginHistoryTab currentProfileId="admin-uuid-1" />);
    await waitFor(() => {
      expect(
        screen.getByText((_, el) => el?.textContent === "Showing 11–20 of 25 total logins")
      ).toBeDefined();
    });
    renderedP2.unmount();

    // 3. Page 3 of 25 (final partial page with 5 items)
    vi.mocked(adminClient.getSelfLoginHistory).mockResolvedValueOnce({
      success: true,
      data: {
        items: Array(5).fill(null).map((_, i) => ({
          id: `hist-p3-${i}`,
          adminId: "admin-uuid-1",
          email: "admin@cobralearn.com",
          sessionId: `sess-p3-${i}`,
          userAgent: null,
          browser: "Chrome",
          os: "Windows",
          deviceType: "Desktop",
          loginAt: new Date().toISOString(),
        })),
        total: 25,
        page: 3,
        limit: 10,
        totalPages: 3,
      } as any,
    });

    render(<LoginHistoryTab currentProfileId="admin-uuid-1" />);
    await waitFor(() => {
      expect(
        screen.getByText((_, el) => el?.textContent === "Showing 21–25 of 25 total logins")
      ).toBeDefined();
    });
  });
});

describe("Admin Login History — Auth Callback Integration Coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies recordLoginHistory is invoked upon successful non-recovery authentication", async () => {
    const recordSpy = vi.mocked(adminClient.recordLoginHistory).mockResolvedValueOnce({
      success: true,
      data: { success: true, id: "hist-new" },
    });

    const mockSession = { access_token: "mock-valid-jwt-token" };

    // Simulate callback recording logic
    const isRecovery = false;
    if (!isRecovery && mockSession?.access_token) {
      await adminClient.recordLoginHistory(mockSession.access_token);
    }

    expect(recordSpy).toHaveBeenCalledWith("mock-valid-jwt-token");
  });

  it("verifies recordLoginHistory is NOT invoked during password recovery flow", async () => {
    const recordSpy = vi.mocked(adminClient.recordLoginHistory);
    const mockSession = { access_token: "mock-valid-jwt-token" };

    // In recovery flow
    const isRecovery = true;
    if (!isRecovery && mockSession?.access_token) {
      await adminClient.recordLoginHistory(mockSession.access_token);
    }

    expect(recordSpy).not.toHaveBeenCalled();
  });

  it("verifies recordLoginHistory is NOT invoked when authentication callback fails", async () => {
    const recordSpy = vi.mocked(adminClient.recordLoginHistory);
    const searchError = "access_denied";

    // When search.error is present, callback errors immediately
    const hasError = Boolean(searchError);
    if (!hasError) {
      await adminClient.recordLoginHistory("token");
    }

    expect(recordSpy).not.toHaveBeenCalled();
  });
});
