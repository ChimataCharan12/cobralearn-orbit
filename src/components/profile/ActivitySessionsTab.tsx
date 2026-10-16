import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Laptop,
  Smartphone,
  Tablet,
  LogIn,
  Edit,
  Settings,
  Mail,
  ShieldAlert,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Crown,
  Trash2,
  Loader2,
  RotateCcw,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { adminClient } from "@/lib/api/admin-client";
import { useAuth } from "@/lib/auth/use-auth";
import { SignOutModal } from "@/components/modals/SignOutModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminAuditLog } from "@prisma/client";

interface ActivitySessionsTabProps {
  currentProfileId?: string | undefined;
}

function getClientDeviceInfo(): {
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet";
  summary: string;
} {
  if (typeof navigator === "undefined" || !navigator.userAgent) {
    return {
      browser: "Unknown Browser",
      os: "Unknown OS",
      deviceType: "desktop",
      summary: "Unknown Browser / OS",
    };
  }

  const ua = navigator.userAgent;
  let browser = "Web Browser";
  let os = "Unknown OS";
  let deviceType: "desktop" | "mobile" | "tablet" = "desktop";

  // Operating system detection
  if (/Windows NT/i.test(ua)) {
    os = "Windows";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macOS";
  } else if (/CrOS/i.test(ua)) {
    os = "ChromeOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  } else if (/Android/i.test(ua)) {
    os = "Android";
    deviceType = "mobile";
  } else if (/iPhone/i.test(ua)) {
    os = "iOS";
    deviceType = "mobile";
  } else if (/iPad/i.test(ua)) {
    os = "iPadOS";
    deviceType = "tablet";
  }

  // Browser detection
  if (/Edg\//i.test(ua)) {
    browser = "Microsoft Edge";
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    browser = "Opera";
  } else if (/Chrome\//i.test(ua) && !/Chromium|Edg/i.test(ua)) {
    browser = "Google Chrome";
  } else if (/Firefox\//i.test(ua)) {
    browser = "Mozilla Firefox";
  } else if (/Safari\//i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) {
    browser = "Apple Safari";
  }

  const summary =
    os !== "Unknown OS" && browser !== "Web Browser"
      ? `${browser} on ${os}`
      : browser !== "Web Browser"
      ? browser
      : os !== "Unknown OS"
      ? `${os} Device`
      : "Unknown Browser / OS";

  return { browser, os, deviceType, summary };
}

function formatSessionExpiry(expiresAt?: number | null): string | null {
  if (typeof expiresAt !== "number" || isNaN(expiresAt) || expiresAt <= 0) {
    return null;
  }
  const date = new Date(expiresAt * 1000);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivitySessionsTab({ currentProfileId }: ActivitySessionsTabProps) {
  const navigate = useNavigate();
  const { session, isAuthenticated, isLoading: authLoading, signOut } = useAuth();

  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);

  const deviceInfo = getClientDeviceInfo();
  const expiryText = formatSessionExpiry(session?.expires_at);

  const DeviceIcon =
    deviceInfo.deviceType === "mobile"
      ? Smartphone
      : deviceInfo.deviceType === "tablet"
      ? Tablet
      : Laptop;

  const handleSignOut = async () => {
    try {
      await signOut();
      setSignOutModalOpen(false);
      navigate({ to: "/admin" });
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  };

  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    setLogsError(null);

    try {
      const res = await adminClient.getSelfAuditLogs({ limit: 30 });
      if (res.success && res.data) {
        setAuditLogs(res.data.logs || []);
      } else {
        setLogsError(res.error || "Unable to load audit activities");
      }
    } catch (err: unknown) {
      setLogsError(err instanceof Error ? err.message : "Unable to load audit activities");
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const mapActionToMeta = (action: string) => {
    switch (action) {
      case "SELF_PROFILE_UPDATED":
        return {
          title: "Profile updated",
          description: "Updated personal and professional administrator details.",
          icon: Edit,
          colorClass: "text-blue-400",
          bgClass: "bg-blue-500/15 border-blue-500/30",
        };
      case "AVATAR_UPDATED":
        return {
          title: "Avatar photo updated",
          description: "Uploaded and updated administrator profile photo.",
          icon: Edit,
          colorClass: "text-brand-bright",
          bgClass: "bg-brand/15 border-brand/30",
        };
      case "ADMIN_ACTIVATED":
        return {
          title: "Administrator activated",
          description: "Reactivated an administrative team member profile.",
          icon: CheckCircle2,
          colorClass: "text-brand-bright",
          bgClass: "bg-brand/15 border-brand/30",
        };
      case "ADMIN_DEACTIVATED":
        return {
          title: "Administrator deactivated",
          description: "Deactivated administrative account access.",
          icon: ShieldAlert,
          colorClass: "text-red-400",
          bgClass: "bg-red-500/15 border-red-500/30",
        };
      case "ADMIN_ROLE_ASSIGNED":
        return {
          title: "Role permissions changed",
          description: "Modified administrative role assignment.",
          icon: Crown,
          colorClass: "text-amber-400",
          bgClass: "bg-amber-500/15 border-amber-500/30",
        };
      case "SETTINGS_UPDATED":
        return {
          title: "Site settings updated",
          description: "Modified global site configuration parameters.",
          icon: Settings,
          colorClass: "text-cyan-400",
          bgClass: "bg-cyan-500/15 border-cyan-500/30",
        };
      case "CONTACT_STATUS_UPDATED":
        return {
          title: "Contact message updated",
          description: "Changed inquiry resolution status.",
          icon: Mail,
          colorClass: "text-purple-400",
          bgClass: "bg-purple-500/15 border-purple-500/30",
        };
      case "CONTACT_DELETED":
        return {
          title: "Contact message deleted",
          description: "Removed customer inquiry record.",
          icon: Trash2,
          colorClass: "text-red-400",
          bgClass: "bg-red-500/15 border-red-500/30",
        };
      case "INITIAL_ADMIN_PROVISIONED":
        return {
          title: "Root super admin provisioned",
          description: "Initial Super Administrator profile initialized.",
          icon: Crown,
          colorClass: "text-amber-400",
          bgClass: "bg-amber-500/15 border-amber-500/30",
        };
      default:
        return {
          title: action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
          description: "Administrative governance operation recorded.",
          icon: Clock,
          colorClass: "text-brand-bright",
          bgClass: "bg-brand/15 border-brand/30",
        };
    }
  };

  return (
    <div className="space-y-4 pt-1">
      {/* 1. RECENT ACTIVITY CARD (Hydrated from PostgreSQL AdminAuditLog) */}
      <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
              <Clock className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Recent Activity</h3>
              <p className="text-[12px] text-muted-foreground">
                Your verified administrative audit timeline from PostgreSQL.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-background/60 px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:border-brand-bright/50 hover:bg-brand/10 hover:text-brand-bright cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`size-3.5 ${isLoadingLogs ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Timeline Content */}
        {isLoadingLogs ? (
          <div className="flex min-h-[160px] items-center justify-center py-8">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-brand-bright" />
              <span>Loading audit activity from database...</span>
            </div>
          </div>
        ) : logsError ? (
          <div className="my-4 rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-center">
            <p className="text-[13px] text-red-400">{logsError}</p>
            <button
              type="button"
              onClick={fetchLogs}
              className="mt-2 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-1 text-[12px] font-medium text-red-300 transition hover:bg-red-950/50 cursor-pointer"
            >
              Retry Loading
            </button>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="my-6 text-center py-6 border border-dashed border-brand/15 rounded-lg">
            <Clock className="mx-auto size-8 text-muted-foreground/50 mb-2" />
            <p className="text-[13px] font-medium text-foreground/80">No audit activity recorded yet</p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              Administrative profile changes and management actions will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="relative mt-5 pl-2">
            {/* Vertical Connecting Line */}
            <div className="absolute left-[21px] top-3 bottom-3 w-[2px] bg-brand/20" />

            <div className="space-y-4">
              {auditLogs.map((log) => {
                const meta = mapActionToMeta(log.action);
                const Icon = meta.icon;
                const formattedDate = new Date(log.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div key={log.id} className="relative flex items-start gap-3.5">
                    {/* Circular Icon Badge */}
                    <div
                      className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border shadow ${meta.bgClass} ${meta.colorClass}`}
                    >
                      <Icon className="size-4" />
                    </div>

                    {/* Activity Details */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-bold text-foreground">{meta.title}</p>
                        <span className="text-[11.5px] text-muted-foreground">{formattedDate}</span>
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-0.5">{meta.description}</p>
                      <p className="text-[10.5px] font-mono text-muted-foreground/60 mt-0.5">
                        Actor: {log.actorEmail} • Module: {log.module}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. ACTIVE SESSIONS CARD */}
      <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
            <Laptop className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Active Sessions</h3>
            <p className="text-[12px] text-muted-foreground">
              Current authenticated administrative session.
            </p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-brand/10">
          {authLoading ? (
            <div className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-brand-bright" />
              <span>Checking authentication session...</span>
            </div>
          ) : !isAuthenticated || !session ? (
            <div className="flex items-center gap-3 py-3 text-muted-foreground">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertCircle className="size-4" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">No Active Session</p>
                <p className="text-[11.5px] text-muted-foreground">
                  Authentication session is inactive or not established.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-1">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-bright border border-brand/20">
                  <DeviceIcon className="size-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    Current Browser Session{" "}
                    <span className="text-muted-foreground font-normal text-[12px]">({deviceInfo.summary})</span>{" "}
                    <span className="text-brand-bright font-medium text-[12px]">(Active Device)</span>
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    Active Supabase Session
                    {expiryText ? ` • Expires: ${expiryText}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-bright/15 border border-brand-bright/40 px-2.5 py-0.5 text-[11px] font-semibold text-brand-bright">
                  Current
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-foreground transition cursor-pointer rounded-md hover:bg-white/5"
                      aria-label="Session options"
                    >
                      <MoreVertical className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 border-brand/30 bg-panel-strong backdrop-blur-xl">
                    <DropdownMenuItem
                      onClick={() => setSignOutModalOpen(true)}
                      className="cursor-pointer gap-2 text-[12.5px] text-destructive focus:bg-destructive/15 focus:text-destructive"
                    >
                      <LogOut className="size-4" />
                      <span>Sign out from this device</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. LOGIN & SECURITY AUDIT SUMMARY CARD */}
      <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
              <LogIn className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Session & Security Status</h3>
              <p className="text-[12px] text-muted-foreground">
                Authentication security and session verification status.
              </p>
            </div>
          </div>
        </div>

        {/* Security Summary Table */}
        <div className="mt-4 overflow-x-auto rounded-lg border border-brand/15 bg-background/50">
          <table className="w-full text-left text-[12.5px]">
            <thead className="border-b border-brand/15 bg-brand/5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3.5">Audit Scope</th>
                <th className="py-2.5 px-3.5">Verification Mechanism</th>
                <th className="py-2.5 px-3.5">Backend Persistence</th>
                <th className="py-2.5 px-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand/10">
              <tr className="hover:bg-brand/5 transition-colors">
                <td className="py-2.5 px-3.5 font-medium text-foreground">Authentication Session</td>
                <td className="py-2.5 px-3.5 text-foreground/85">Supabase Auth Session</td>
                <td className="py-2.5 px-3.5 text-muted-foreground">PostgreSQL AdminProfile</td>
                <td className="py-2.5 px-3.5 text-right">
                  {authLoading ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400">
                      <Loader2 className="size-3 animate-spin" />
                      <span>Checking...</span>
                    </span>
                  ) : isAuthenticated && session ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-bright/15 border border-brand-bright/40 px-2.5 py-0.5 text-[11px] font-semibold text-brand-bright">
                      <CheckCircle2 className="size-3" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-red-400">
                      <AlertCircle className="size-3" />
                      <span>Inactive</span>
                    </span>
                  )}
                </td>
              </tr>
              <tr className="hover:bg-brand/5 transition-colors">
                <td className="py-2.5 px-3.5 font-medium text-foreground">Audit Logging Engine</td>
                <td className="py-2.5 px-3.5 text-foreground/85">Audit Query Read Status</td>
                <td className="py-2.5 px-3.5 text-muted-foreground">PostgreSQL AdminAuditLog</td>
                <td className="py-2.5 px-3.5 text-right">
                  {isLoadingLogs ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400">
                      <Loader2 className="size-3 animate-spin" />
                      <span>Checking...</span>
                    </span>
                  ) : logsError ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-red-400">
                      <AlertCircle className="size-3" />
                      <span>Unavailable</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-bright/15 border border-brand-bright/40 px-2.5 py-0.5 text-[11px] font-semibold text-brand-bright">
                      <CheckCircle2 className="size-3" />
                      <span>Connected</span>
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2.5 text-[11px] text-muted-foreground/70">
          Audit logging status reflects current query accessibility to PostgreSQL AdminAuditLog.
        </p>
      </div>

      {/* Real Sign Out Confirmation Modal */}
      <SignOutModal
        open={signOutModalOpen}
        onOpenChange={setSignOutModalOpen}
        onConfirm={handleSignOut}
        onCancel={() => setSignOutModalOpen(false)}
      />
    </div>
  );
}
