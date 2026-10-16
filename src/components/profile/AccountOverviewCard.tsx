import { Crown, ShieldCheck, ShieldAlert, Calendar, Clock, Terminal, Globe, Compass, Loader2 } from "lucide-react";
import type { AdminProfile } from "@prisma/client";
import { useAuth } from "@/lib/auth/use-auth";
import {
  DEFAULT_PORTAL_PREFERENCES,
  mergeWithDefaultPreferences,
} from "@/lib/preferences";

interface AccountOverviewCardProps {
  profile?: AdminProfile | null;
}

export function AccountOverviewCard({ profile }: AccountOverviewCardProps) {
  const { session, isAuthenticated, isLoading: authLoading } = useAuth();

  const roleName =
    profile?.role === "SUPER_ADMIN"
      ? "Super Administrator"
      : profile?.role === "ADMIN"
      ? "Administrator"
      : profile?.role === "EDITOR"
      ? "Content Editor"
      : "Administrator";

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).getFullYear().toString()
    : "2026";

  const lastLoginText = profile?.lastLoginAt
    ? new Date(profile.lastLoginAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Current Session";

  const isActive = profile?.isActive ?? true;

  const prefs = mergeWithDefaultPreferences(profile?.preferences);
  const language = prefs.portal.language || DEFAULT_PORTAL_PREFERENCES.language;
  const timezone = prefs.portal.timezone || DEFAULT_PORTAL_PREFERENCES.timezone;

  const sessionStatusText = authLoading
    ? "Checking..."
    : isAuthenticated && session
    ? "Active Session"
    : "Inactive";

  const items = [
    {
      icon: Crown,
      label: "Role",
      value: roleName,
      isGold: profile?.role === "SUPER_ADMIN",
    },
    {
      icon: isActive ? ShieldCheck : ShieldAlert,
      label: "Account Status",
      value: isActive ? "Active" : "Deactivated",
      isStatus: true,
      isDanger: !isActive,
    },
    { icon: Calendar, label: "Member Since", value: memberSince },
    { icon: Clock, label: "Last Login", value: lastLoginText },
    {
      icon: Terminal,
      label: "Session Security",
      value: sessionStatusText,
      isSessionStatus: true,
      isLoading: authLoading,
      isActive: isAuthenticated && Boolean(session),
    },
    { icon: Globe, label: "Default Language", value: language },
    { icon: Compass, label: "Timezone", value: timezone },
  ];

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="pb-3 border-b border-brand/10">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Account Overview</h3>
        <p className="text-[12px] text-muted-foreground">Key information about your account.</p>
      </div>

      <div className="divide-y divide-brand/10 text-[12.5px]">
        {items.map((it) => {
          const Icon = it.icon;

          return (
            <div key={it.label} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5 text-foreground/80">
                <Icon
                  className={`size-4 shrink-0 ${
                    it.isDanger ? "text-red-400" : "text-brand-bright/80"
                  }`}
                />
                <span>{it.label}</span>
              </div>

              <div>
                {it.isGold ? (
                  <span className="font-semibold text-amber-400">{it.value}</span>
                ) : it.isStatus ? (
                  <span
                    className={`flex items-center gap-1.5 font-semibold ${
                      it.isDanger ? "text-red-400" : "text-brand-bright"
                    }`}
                  >
                    <span
                      className={`size-2 rounded-full ${
                        it.isDanger
                          ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                          : "bg-brand-bright shadow-[0_0_8px_var(--brand-bright)]"
                      }`}
                    />
                    <span>{it.value}</span>
                  </span>
                ) : it.isSessionStatus ? (
                  <span
                    className={`flex items-center gap-1.5 font-semibold ${
                      it.isLoading
                        ? "text-blue-400"
                        : it.isActive
                        ? "text-brand-bright"
                        : "text-red-400"
                    }`}
                  >
                    {it.isLoading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <span
                        className={`size-2 rounded-full ${
                          it.isActive
                            ? "bg-brand-bright shadow-[0_0_8px_var(--brand-bright)]"
                            : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                        }`}
                      />
                    )}
                    <span>{it.value}</span>
                  </span>
                ) : (
                  <span className="font-medium text-foreground/90">{it.value}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
