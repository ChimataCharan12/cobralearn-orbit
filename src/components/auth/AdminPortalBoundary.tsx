import React, { useEffect, type ReactNode } from "react";
import { useRouter, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth/use-auth";
import { isExemptRoute } from "@/lib/auth/auth-error-handling";

interface AdminPortalBoundaryProps {
  children: ReactNode;
}

/**
 * CobraLearn Orbit — Administrative Route Boundary & Content Flash Prevention
 *
 * Ensures that protected administrative portal shells, navigation items,
 * and data-fetching views are NEVER mounted or rendered before authoritative
 * server-side administrator eligibility is confirmed.
 */
export function AdminPortalBoundary({ children }: AdminPortalBoundaryProps) {
  const {
    isAuthenticated,
    isEligibleAdmin,
    isMfaRequired,
    isLoading,
    isEligibilityLoading,
    isMfaLoading,
    adminProfile,
  } = useAuth();
  const router = useRouter();
  const navigate = useNavigate();

  // Determine current pathname from router state or window location
  const pathname =
    router.state.location.pathname ||
    (typeof window !== "undefined" ? window.location.pathname : "/");

  const isAdminRoute = pathname.startsWith("/admin");
  const isProtectedAdminRoute = isAdminRoute && !isExemptRoute(pathname);

  useEffect(() => {
    if (!isProtectedAdminRoute) return;
    if (isLoading || isEligibilityLoading || isMfaLoading) return;

    if (!isAuthenticated || isMfaRequired) {
      navigate({ to: "/admin" });
      return;
    }

    if (adminProfile?.mfaRecoveryPending) {
      navigate({ to: "/admin/mfa-recovery" });
      return;
    }

    if (!isEligibleAdmin) {
      navigate({ to: "/admin/access-denied" });
      return;
    }
  }, [
    isProtectedAdminRoute,
    isLoading,
    isEligibilityLoading,
    isMfaLoading,
    isAuthenticated,
    isMfaRequired,
    isEligibleAdmin,
    adminProfile?.mfaRecoveryPending,
    navigate,
  ]);

  // If outside Orbit or on a public admin route (e.g. /admin, /admin/session-expired), pass through
  if (!isProtectedAdminRoute) {
    return <>{children}</>;
  }

  // 1. While establishing session or validating server-side administrator eligibility
  if (isLoading || isEligibilityLoading || isMfaLoading) {
    return (
      <div className="dash-bg flex min-h-screen w-full items-center justify-center select-none">
        <div className="flex items-center gap-3 rounded-xl border border-[#00ff87]/30 bg-[#040e08]/90 px-6 py-3.5 text-xs text-[#00ff87] shadow-[0_0_25px_rgba(0,255,135,0.25)] backdrop-blur-xl">
          <span className="size-2 animate-ping rounded-full bg-[#00ff87]" />
          <span className="font-sans font-medium tracking-wider uppercase text-[11px] text-[#e2e8f0]">
            Verifying Administrator Authorization...
          </span>
        </div>
      </div>
    );
  }

  // 2. If unauthenticated or ineligible on a protected portal route:
  // Render nothing while navigation completes to guarantee zero content-flash
  if (!isAuthenticated || !isEligibleAdmin || isMfaRequired || adminProfile?.mfaRecoveryPending) {
    return null;
  }

  // 3. Authenticated AND active administrator confirmed
  return <>{children}</>;
}
