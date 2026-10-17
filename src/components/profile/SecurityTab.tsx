import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Lock,
  Key,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Laptop,
  Smartphone,
  Tablet,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Info,
  Loader2,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/use-auth";
import { SignOutModal } from "@/components/modals/SignOutModal";
import { MfaEnrollmentCard } from "@/components/profile/MfaEnrollmentCard";
import { RecoveryCodesCard } from "@/components/profile/RecoveryCodesCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function SecurityTab() {
  const navigate = useNavigate();
  const { user, session, isAuthenticated, isLoading: authLoading, signOut } = useAuth();

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

  return (
    <div className="space-y-4 pt-1">
      {/* 1. PASSWORD MANAGEMENT CARD */}
      <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
            <Lock className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Password Management</h3>
            <p className="text-[12px] text-muted-foreground">Keep your account secure with a strong password.</p>
          </div>
        </div>

        {/* Inner Last Changed & Button Box */}
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-brand/15 bg-background/50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand-bright">
              <Key className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Account Credentials</p>
              <p className="text-[13px] font-semibold text-foreground">
                {user?.email || "Authenticated Administrator"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate({ to: "/admin/profile/change-password" })}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-brand-bright/70 bg-brand/15 px-4 py-2 text-[12.5px] font-bold text-brand-bright shadow-[0_0_14px_rgba(0,255,170,0.22)] transition hover:bg-brand/25 hover:brightness-110 cursor-pointer"
          >
            <span>Change Password</span>
          </button>
        </div>

        {/* Password Security Checklist */}
        <div className="mt-4 grid grid-cols-1 gap-2 pt-1 text-[12px] text-foreground/80 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 shrink-0 text-brand-bright" />
            <span>Use at least 8 characters</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 shrink-0 text-brand-bright" />
            <span>Include a mix of letters, numbers and symbols</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 shrink-0 text-brand-bright" />
            <span>Avoid using common passwords</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 shrink-0 text-brand-bright" />
            <span>Don't reuse passwords from other sites</span>
          </div>
        </div>
      </div>

      {/* 2. MULTI-FACTOR AUTHENTICATION (MFA) CARD */}
      <MfaEnrollmentCard />

      {/* 3. SINGLE-USE RECOVERY CODES CARD */}
      <RecoveryCodesCard />

      {/* 4. CONNECTED DEVICES / SESSIONS CARD */}
      <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
            <Laptop className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Connected Devices</h3>
            <p className="text-[12px] text-muted-foreground">Current authenticated browser session.</p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-brand/10">
          {authLoading ? (
            <div className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-brand-bright" />
              <span>Checking authentication session...</span>
            </div>
          ) : !isAuthenticated || (!session && !user) ? (
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
                    Active Supabase Auth Session
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

        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Remote multi-device session revocation is managed via your identity provider. To end this session, use the Sign Out button.
        </p>
      </div>

      {/* 4. SECURITY RECOMMENDATIONS CARD */}
      <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Security Recommendations</h3>
            <p className="text-[12px] text-muted-foreground">Keep your account secure with these recommendations.</p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-brand/10 text-[12.5px]">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5 text-foreground/90">
              <Lock className="size-4 text-brand-bright" />
              <span>Use a strong, unique password</span>
            </div>
            <span className="flex items-center gap-1 font-semibold text-brand-bright">
              <CheckCircle2 className="size-3.5" />
              <span>Good</span>
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5 text-foreground/90">
              <ShieldAlert className="size-4 text-amber-400" />
              <span>Enable two-factor authentication</span>
            </div>
            <span className="flex items-center gap-1 font-semibold text-amber-400">
              <AlertCircle className="size-3.5" />
              <span>Provider Policy</span>
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5 text-foreground/90">
              <Laptop className="size-4 text-brand-bright" />
              <span>Review active session security</span>
            </div>
            <span className="flex items-center gap-1 font-semibold text-brand-bright">
              <CheckCircle2 className="size-3.5" />
              <span>Active</span>
            </span>
          </div>
        </div>
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
