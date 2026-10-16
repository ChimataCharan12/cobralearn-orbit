import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Branded, lightweight top-bar transition indicator for the CobraLearn Admin Portal.
 * Uses TanStack Router's navigation lifecycle to detect genuine route transitions.
 * - Debounces display (100ms) to avoid flashing on instant navigations.
 * - Employs a fail-safe timer (8s) to prevent stuck indicators.
 * - Strictly scopes to admin routes to preserve public showcase website appearance.
 */
export function AdminRouteTransitionIndicator() {
  const isLoading = useRouterState({ select: (s) => Boolean(s.isLoading) });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminRoute = typeof pathname === "string" && pathname.startsWith("/admin");

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAdminRoute) {
      setVisible(false);
      return;
    }

    let delayTimer: NodeJS.Timeout | null = null;
    let failsafeTimer: NodeJS.Timeout | null = null;

    if (isLoading) {
      // 100ms debounce to prevent flashing on instant transitions
      delayTimer = setTimeout(() => {
        setVisible(true);
      }, 100);

      // Fail-safe cleanup: prevent stuck loader if router transition stalls
      failsafeTimer = setTimeout(() => {
        setVisible(false);
      }, 8000);
    } else {
      setVisible(false);
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (failsafeTimer) clearTimeout(failsafeTimer);
    };
  }, [isLoading, isAdminRoute]);

  if (!visible || !isAdminRoute) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="Route loading"
      aria-busy="true"
      data-testid="admin-route-transition-indicator"
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[2.5px] w-full overflow-hidden bg-transparent"
    >
      <div className="h-full w-full bg-gradient-to-r from-transparent via-[#00ff87] to-transparent shadow-[0_0_12px_#00ff87] progress-indeterminate" />
    </div>
  );
}
