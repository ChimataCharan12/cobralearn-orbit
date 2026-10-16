import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { NexusSplashScreen } from "@/components/splash/NexusSplashScreen";
import { OrbitSplashScreen } from "@/components/splash/OrbitSplashScreen";
import { AppSplashOrchestrator } from "@/components/splash/AppSplashOrchestrator";
import { resetSplashDocumentLoadState } from "@/components/splash/use-splash-progress";
import * as PublicAppearanceModule from "@/lib/theme/public-appearance-context";
import * as AuthModule from "@/lib/auth/use-auth";
import { DEFAULT_PUBLIC_APPEARANCE_CONFIG } from "@/lib/public-appearance";

describe("CobraLearn Nexus & Orbit Pixel-Reference Splash Screens", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSplashDocumentLoadState();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("CobraLearn Nexus (Public Splash Screen)", () => {
    it("renders as a true fullscreen viewport-level overlay with no centered image constraints", () => {
      vi.spyOn(PublicAppearanceModule, "usePublicAppearance").mockReturnValue({
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
      });

      render(<NexusSplashScreen forceShow />);

      const overlay = screen.getByTestId("nexus-splash-screen");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass("fixed", "inset-0", "w-screen", "z-[99999]");
      expect(overlay.style.width).toBe("100vw");
      expect(overlay.style.height).toBe("100vh");

      // Verify the background image has object-cover (not object-contain or max-w constraint)
      const img = overlay.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveClass("w-full", "h-full", "object-cover", "object-center");
    });

    it("displays the approved public branding, exact tagline, and initial progress state", () => {
      vi.spyOn(PublicAppearanceModule, "usePublicAppearance").mockReturnValue({
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
      });

      render(<NexusSplashScreen forceShow />);

      expect(screen.getByText("CobraLearn")).toBeInTheDocument();
      expect(screen.getByText("Nexus")).toBeInTheDocument();
      expect(
        screen.getByText("Projects. Innovation. Digital Excellence.")
      ).toBeInTheDocument();

      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toBeInTheDocument();
      // Mounted with real appearance resolves to 100% "Ready"
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(progressbar).toHaveAttribute("aria-valuenow", "100");
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    it("enforces minimum 2-second visible duration even when readiness is immediately true", () => {
      vi.spyOn(PublicAppearanceModule, "usePublicAppearance").mockReturnValue({
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
      });

      render(<NexusSplashScreen forceShow />);

      // At 500ms (fast initialization), splash must STILL be visible
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByTestId("nexus-splash-screen")).toBeInTheDocument();

      // At 1500ms, splash must STILL be visible
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId("nexus-splash-screen")).toBeInTheDocument();

      // Advance to 2000ms minimum duration gate
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Complete hold (200ms) + fade (400ms) duration
      act(() => {
        vi.advanceTimersByTime(700);
      });
      expect(screen.queryByTestId("nexus-splash-screen")).not.toBeInTheDocument();
    });

    it("keeps splash visible beyond 2 seconds if application is still initializing", () => {
      // Mock appearance as temporarily unresolved
      vi.spyOn(PublicAppearanceModule, "usePublicAppearance").mockReturnValue(null as any);

      const { rerender } = render(<NexusSplashScreen forceShow />);

      // 2000ms elapses, but readiness is false
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId("nexus-splash-screen")).toBeInTheDocument();

      // Appearance resolves at 3000ms
      vi.spyOn(PublicAppearanceModule, "usePublicAppearance").mockReturnValue({
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
      });
      rerender(<NexusSplashScreen forceShow />);

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

      // Dismisses once both minimum duration AND readiness are satisfied
      act(() => {
        vi.advanceTimersByTime(700);
      });
      expect(screen.queryByTestId("nexus-splash-screen")).not.toBeInTheDocument();
    });

    it("displays on each new document load and avoids replaying during internal navigation", () => {
      vi.spyOn(PublicAppearanceModule, "usePublicAppearance").mockReturnValue({
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
      });

      // Document Load 1: Splash runs and completes
      const { unmount } = render(<NexusSplashScreen />);
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      act(() => {
        vi.advanceTimersByTime(700);
      });
      unmount();

      // Internal client-side navigation within Document Load 1: does not replay
      const { container: internalNavContainer, unmount: unmountNav } = render(<NexusSplashScreen />);
      expect(internalNavContainer.firstChild).toBeNull();
      unmountNav();

      // New Document Load (simulated browser reload via F5 / Ctrl+R): resets document lifecycle
      resetSplashDocumentLoadState();
      const { container: reloadedContainer } = render(<NexusSplashScreen />);
      expect(reloadedContainer.firstChild).not.toBeNull();
      expect(screen.getByTestId("nexus-splash-screen")).toBeInTheDocument();
    });
  });

  describe("CobraLearn Orbit (Private Management Splash Screen)", () => {
    it("renders as a true fullscreen viewport-level overlay with no centered image constraints", () => {
      vi.spyOn(AuthModule, "useAuth").mockReturnValue({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: true,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      render(<OrbitSplashScreen forceShow />);

      const overlay = screen.getByTestId("orbit-splash-screen");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass("fixed", "inset-0", "w-screen", "z-[99999]");
      expect(overlay.style.width).toBe("100vw");
      expect(overlay.style.height).toBe("100vh");

      const img = overlay.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveClass("w-full", "h-full", "object-cover", "object-center");
    });

    it("displays private branding, exact tagline, and dynamic auth security progress", () => {
      vi.spyOn(AuthModule, "useAuth").mockReturnValue({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: true, // Auth verification in flight
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      render(<OrbitSplashScreen forceShow />);

      expect(screen.getByText("CobraLearn")).toBeInTheDocument();
      expect(screen.getByText("Orbit")).toBeInTheDocument();
      expect(
        screen.getByText("Your digital ecosystem. One control center.")
      ).toBeInTheDocument();

      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toHaveAttribute("aria-valuenow", "45");
      expect(screen.getByText("Verifying security credentials...")).toBeInTheDocument();
    });

    it("enforces minimum 2-second visible duration even when auth check resolves fast", () => {
      vi.spyOn(AuthModule, "useAuth").mockReturnValue({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false, // Fast auth check
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      render(<OrbitSplashScreen forceShow />);

      // At 500ms, progress has reached 100% "Ready", but splash remains visible
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByTestId("orbit-splash-screen")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

      // At 1500ms, still visible
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId("orbit-splash-screen")).toBeInTheDocument();

      // Reach 2000ms minimum duration gate
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Complete hold/fade duration
      act(() => {
        vi.advanceTimersByTime(700);
      });
      expect(screen.queryByTestId("orbit-splash-screen")).not.toBeInTheDocument();
    });

    it("displays on each new document load and avoids replaying during internal admin navigation", () => {
      vi.spyOn(AuthModule, "useAuth").mockReturnValue({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      // Document Load 1
      const { unmount } = render(<OrbitSplashScreen />);
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      act(() => {
        vi.advanceTimersByTime(700);
      });
      unmount();

      // Internal navigation
      const { container: internalNavContainer, unmount: unmountNav } = render(<OrbitSplashScreen />);
      expect(internalNavContainer.firstChild).toBeNull();
      unmountNav();

      // Browser reload (new document load)
      resetSplashDocumentLoadState();
      const { container: reloadedContainer } = render(<OrbitSplashScreen />);
      expect(reloadedContainer.firstChild).not.toBeNull();
      expect(screen.getByTestId("orbit-splash-screen")).toBeInTheDocument();
    });
  });

  describe("AppSplashOrchestrator Route Partitioning", () => {
    it("renders Nexus splash on public routes and never leaks Orbit splash", () => {
      vi.spyOn(PublicAppearanceModule, "usePublicAppearance").mockReturnValue({
        ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
      });

      render(<AppSplashOrchestrator currentPath="/" />);

      expect(screen.getByTestId("nexus-splash-screen")).toBeInTheDocument();
      expect(screen.queryByTestId("orbit-splash-screen")).not.toBeInTheDocument();
    });

    it("renders Orbit splash on admin routes and never leaks Nexus splash", () => {
      vi.spyOn(AuthModule, "useAuth").mockReturnValue({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: true,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      render(<AppSplashOrchestrator currentPath="/admin/dashboard" />);

      expect(screen.getByTestId("orbit-splash-screen")).toBeInTheDocument();
      expect(screen.queryByTestId("nexus-splash-screen")).not.toBeInTheDocument();
    });
  });
});
