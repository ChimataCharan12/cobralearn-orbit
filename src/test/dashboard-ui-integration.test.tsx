import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Route } from "@/routes/admin/dashboard";
import { WebsiteStatus } from "@/components/dashboard/WebsiteStatus";
import { useDashboardData } from "@/lib/dashboard/use-dashboard-data";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import type { DashboardDataResult } from "@/lib/server/dashboard-operations";

// Mock @tanstack/react-router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: any) => config,
  useNavigate: () => mockNavigate,
  useRouterState: () => ({ location: { pathname: "/admin/dashboard" } }),
  Link: ({ children, to, onClick }: any) => (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick();
        mockNavigate({ to });
      }}
    >
      {children}
    </a>
  ),
}));

// Mock auth hooks
vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "user-123", email: "admin@cobralearn.com" },
    isAuthenticated: true,
  }),
  useAuthGuard: vi.fn(),
}));

vi.mock("@/lib/auth/auth-service", () => ({
  authService: {
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
}));

vi.mock("@/lib/auth/use-admin-profile", () => ({
  useAdminProfile: vi.fn(),
}));

vi.mock("@/lib/dashboard/use-dashboard-data", () => ({
  useDashboardData: vi.fn(),
}));

describe("Dashboard Phase 1 — UI Integration, Data Wiring & Error Handling", () => {
  const mockDashboardData: DashboardDataResult = {
    stats: {
      projects: {
        total: 12,
        published: 8,
        draft: 4,
        current30Days: 5,
        prev30Days: 2,
        delta: 3,
        comparisonText: "+3 vs prev 30d",
      },
      websites: {
        total: 6,
        published: 5,
        draft: 1,
        current30Days: 2,
        prev30Days: 2,
        delta: 0,
        comparisonText: "+0 vs prev 30d (2 new)",
      },
      advertisements: {
        total: 4,
        published: 3,
        draft: 1,
        current30Days: 1,
        prev30Days: 3,
        delta: -2,
        comparisonText: "-2 vs prev 30d",
      },
      awards: {
        total: 7,
        published: 7,
        draft: 0,
        current30Days: 0,
        prev30Days: 0,
        delta: 0,
        comparisonText: "0 new in last 30d",
      },
    },
    recentActivity: [
      {
        id: "act-1",
        title: "Project Created",
        item: "Cyber Vision",
        time: "10m ago",
        img: null,
        dot: "green",
      },
      {
        id: "act-2",
        title: "Advertisement Deleted",
        item: "Summer Ad",
        time: "1h ago",
        img: null,
        dot: "red",
      },
    ],
    recentProjects: [
      {
        id: "p-1",
        name: "Cyber Vision System",
        tags: ["AI", "Robotics"],
        status: "Published",
        img: "https://media.test/thumb1.jpg",
      },
    ],
    recentAdvertisements: [
      {
        id: "ad-1",
        name: "Q4 Global Campaign",
        status: "Draft",
        img: "https://media.test/thumb2.jpg",
      },
    ],
    recentAwards: [
      {
        id: "aw-1",
        name: "Innovation Trophy 2026",
        status: "Published",
        img: "https://media.test/thumb3.jpg",
      },
    ],
    mediaStats: {
      totalFiles: 48,
      totalBytes: 157286400,
      formattedText: "48 files (150.0 MB)",
    },
    websiteStatus: {
      siteUrl: "https://showcase.cobralearn.com",
      statusLabel: "Showcase Configured",
      statusSubtext: "Showcase URL is configured and active in site settings.",
      lastUpdatedText: "Oct 12, 2026, 10:30 PM",
    },
    userRole: "ADMIN",
  };

  const DashboardComponent = Route.component as React.ComponentType;

  beforeEach(() => {
    vi.clearAllMocks();
    (useAdminProfile as any).mockReturnValue({
      profile: {
        id: "user-123",
        fullName: "Alexandra Vance",
        email: "alex@cobralearn.com",
        role: "ADMIN",
        avatarUrl: null,
      },
      isLoading: false,
      error: null,
    });
  });

  it("1. Renders Dashboard Welcome banner with dynamic administrator identity", () => {
    (useDashboardData as any).mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardComponent />);

    // Greeting should show real administrator name in both DashboardWelcome and AdminHeader
    const nameElements = screen.getAllByText("Alexandra Vance");
    expect(nameElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Welcome back,")).toBeDefined();
  });

  it("2. Renders all 4 StatCards with live counts, breakdown, and comparison deltas", () => {
    (useDashboardData as any).mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardComponent />);

    // Total counts
    expect(screen.getByText("12")).toBeDefined(); // Projects
    expect(screen.getByText("6")).toBeDefined();  // Websites
    expect(screen.getByText("4")).toBeDefined();  // Advertisements
    expect(screen.getByText("7")).toBeDefined();  // Awards

    // Breakdown strings
    expect(screen.getByText("Published: 8 | Draft: 4")).toBeDefined();
    expect(screen.getByText("Published: 5 | Draft: 1")).toBeDefined();
    expect(screen.getByText("Published: 3 | Draft: 1")).toBeDefined();
    expect(screen.getByText("Published: 7 | Draft: 0")).toBeDefined();

    // 30-day delta texts
    expect(screen.getByText("+3 vs prev 30d")).toBeDefined();
    expect(screen.getByText("+0 vs prev 30d (2 new)")).toBeDefined();
    expect(screen.getByText("-2 vs prev 30d")).toBeDefined();
    expect(screen.getByText("0 new in last 30d")).toBeDefined();
  });

  it("3. Renders Website Status with honest 'Showcase Configured' status, dynamic URL, and media telemetry", () => {
    (useDashboardData as any).mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardComponent />);

    // Honest status label and subtext
    expect(screen.getByText("Showcase Configured")).toBeDefined();
    expect(
      screen.getByText("Showcase URL is configured and active in site settings.")
    ).toBeDefined();

    // Live URL from database settings
    expect(screen.getAllByText("https://showcase.cobralearn.com").length).toBeGreaterThan(0);

    // Media stats from MediaAsset aggregation
    expect(screen.getByText("48 files (150.0 MB)")).toBeDefined();

    // Last updated timestamp
    expect(screen.getByText("Oct 12, 2026, 10:30 PM")).toBeDefined();
  });

  it("4. Renders live Recent Activity feed and recent content items", () => {
    (useDashboardData as any).mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardComponent />);

    // Recent activity items
    expect(screen.getByText("Project Created")).toBeDefined();
    expect(screen.getByText("Cyber Vision")).toBeDefined();
    expect(screen.getByText("Advertisement Deleted")).toBeDefined();
    expect(screen.getByText("Summer Ad")).toBeDefined();

    // Recent project, advertisement, and award cards
    expect(screen.getByText("Cyber Vision System")).toBeDefined();
    expect(screen.getByText("Q4 Global Campaign")).toBeDefined();
    expect(screen.getByText("Innovation Trophy 2026")).toBeDefined();
  });

  it("5. Displays loading indicator during initial fetch", () => {
    (useDashboardData as any).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardComponent />);

    expect(
      screen.getByText("Loading live dashboard metrics from database...")
    ).toBeDefined();
  });

  it("6. Displays recoverable error banner with working Retry Connection button", () => {
    const mockRefetch = vi.fn();
    (useDashboardData as any).mockReturnValue({
      data: null,
      isLoading: false,
      error: "Failed to connect to database. Network timeout.",
      refetch: mockRefetch,
    });

    render(<DashboardComponent />);

    expect(
      screen.getByText("Failed to connect to database. Network timeout.")
    ).toBeDefined();

    const retryBtn = screen.getByText("Retry Connection");
    expect(retryBtn).toBeDefined();

    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("7. Quick Actions render and navigate to respective create routes", () => {
    (useDashboardData as any).mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardComponent />);

    const addProjectBtn = screen.getByText("+ Add Project");
    fireEvent.click(addProjectBtn);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/projects/create" });

    const addWebsiteBtn = screen.getByText("+ Add Website");
    fireEvent.click(addWebsiteBtn);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/websites/create" });

    const addAdBtn = screen.getByText("+ Add Advertisement");
    fireEvent.click(addAdBtn);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/advertisements/create" });

    const addAwardBtn = screen.getByText("+ Add Award");
    fireEvent.click(addAwardBtn);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/awards/create" });
  });

  it("8. Empty states render truthfully when collections contain no records", () => {
    const emptyDashboardData: DashboardDataResult = {
      ...mockDashboardData,
      recentActivity: [],
      recentProjects: [],
      recentAdvertisements: [],
      recentAwards: [],
    };

    (useDashboardData as any).mockReturnValue({
      data: emptyDashboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardComponent />);

    expect(screen.getByText("No recent activity")).toBeDefined();
    expect(screen.getByText("No projects created yet")).toBeDefined();
    expect(screen.getByText("No advertisements yet")).toBeDefined();
    expect(screen.getByText("No awards yet")).toBeDefined();
  });

  it("9. Enforces noopener noreferrer and target=_blank on all valid external links", () => {
    (useDashboardData as any).mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardComponent />);

    const liveUrlAnchor = screen.getAllByRole("link").find(
      (el) => el.getAttribute("href") === "https://showcase.cobralearn.com" && el.textContent?.includes("View Website")
    );
    expect(liveUrlAnchor).toBeDefined();
    expect(liveUrlAnchor?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(liveUrlAnchor?.getAttribute("target")).toBe("_blank");

    const textUrlAnchor = screen.getAllByRole("link").find(
      (el) => el.getAttribute("href") === "https://showcase.cobralearn.com" && el.textContent?.includes("https://showcase.cobralearn.com")
    );
    expect(textUrlAnchor).toBeDefined();
    expect(textUrlAnchor?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(textUrlAnchor?.getAttribute("target")).toBe("_blank");
  });

  it("10. Rejects dangerous URL schemes (javascript:, data:) and renders non-clickable state", () => {
    // 1. javascript: scheme test
    const { unmount: unmount1 } = render(
      <WebsiteStatus
        siteUrl="javascript:alert('pwned')"
        statusLabel="Showcase Configured"
      />
    );

    // Label must be forced to Not Configured
    expect(screen.getByText("Not Configured")).toBeDefined();
    expect(screen.getByText("Showcase URL has not been configured in site settings.")).toBeDefined();
    expect(screen.getByText("Not configured")).toBeDefined();

    // Must NOT contain an anchor with javascript:
    const dangerousLinks = document.querySelectorAll('a[href^="javascript:"]');
    expect(dangerousLinks.length).toBe(0);

    // View Website CTA must be a disabled button
    const disabledBtn = screen.getByRole("button", { name: /view website/i });
    expect(disabledBtn).toBeDefined();
    expect(disabledBtn.hasAttribute("disabled")).toBe(true);

    unmount1();

    // 2. data: scheme test
    render(
      <WebsiteStatus
        siteUrl="data:text/html,<script>alert(1)</script>"
        statusLabel="Showcase Configured"
      />
    );
    expect(screen.getByText("Not Configured")).toBeDefined();
    const dataLinks = document.querySelectorAll('a[href^="data:"]');
    expect(dataLinks.length).toBe(0);
  });

  it("11. WebsiteStatus renders honest loading placeholders without misleading defaults", () => {
    render(<WebsiteStatus isLoading={true} />);

    // Must NOT render "Showcase Configured" or production URLs
    expect(screen.queryByText("Showcase Configured")).toBeNull();
    expect(screen.queryByText("https://cobralearn.com")).toBeNull();
    expect(screen.getByText("Loading status...")).toBeDefined();
    expect(screen.getByText("Retrieving showcase configuration...")).toBeDefined();

    // CTA must be disabled during load
    const cta = screen.getByRole("button", { name: /view website/i });
    expect(cta.hasAttribute("disabled")).toBe(true);
  });

  it("12. WebsiteStatus renders honest error state when data fetch fails", () => {
    render(<WebsiteStatus isError={true} />);

    // Must NOT render "Showcase Configured" or healthy data
    expect(screen.queryByText("Showcase Configured")).toBeNull();
    expect(screen.queryByText("https://cobralearn.com")).toBeNull();
    expect(screen.getByText("Status Unavailable")).toBeDefined();
    expect(screen.getByText("Failed to load showcase configuration from database.")).toBeDefined();

    // Placeholders are "Unavailable"
    const unavailables = screen.getAllByText("Unavailable");
    expect(unavailables.length).toBe(3);

    // CTA is disabled
    const cta = screen.getByRole("button", { name: /view website/i });
    expect(cta.hasAttribute("disabled")).toBe(true);
  });
});
