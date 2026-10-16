import React from "react";
import { useRouterState } from "@tanstack/react-router";
import { NexusSplashScreen } from "./NexusSplashScreen";
import { OrbitSplashScreen } from "./OrbitSplashScreen";

export interface AppSplashOrchestratorProps {
  currentPath?: string;
}

function RoutedSplash() {
  const pathname = useRouterState({ select: (s) => s?.location?.pathname || "" });
  const isAdminRoute = typeof pathname === "string" && pathname.startsWith("/admin");
  return isAdminRoute ? <OrbitSplashScreen /> : <NexusSplashScreen />;
}

/**
 * Route-aware startup splash orchestrator:
 * - Directs public routes to CobraLearn Nexus splash.
 * - Directs admin routes to CobraLearn Orbit splash.
 * - Strictly preserves security boundaries, auth checks, and avoids replaying on internal navigation.
 */
export function AppSplashOrchestrator({ currentPath }: AppSplashOrchestratorProps = {}) {
  if (typeof currentPath === "string") {
    const isAdminRoute = currentPath.startsWith("/admin");
    return isAdminRoute ? <OrbitSplashScreen /> : <NexusSplashScreen />;
  }

  return <RoutedSplash />;
}
