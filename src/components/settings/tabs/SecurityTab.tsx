import { useState, useEffect } from "react";
import {
  Shield,
  Key,
  Lock,
  UserCheck,
  Smartphone,
  Globe,
  CheckCircle2,
  AlertTriangle,
  History,
  Laptop,
  Trash2,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { SettingRow } from "@/components/common/settings/SettingRow";
import { SettingToggle } from "@/components/common/settings/SettingToggle";
import { adminClient } from "@/lib/api/admin-client";
import type { AdminAuditLog } from "@prisma/client";

const AUDIT_PAGE_SIZE = 25;

function formatAuditTimestamp(dateVal: Date | string | undefined | null): string {
  if (!dateVal) return "—";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

interface ActiveSession {
  id: string;
  device: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export function SecurityTab() {
  // Admin Security
  const [sessionTimeout, setSessionTimeout] = useState("60m");
  const [loginAttempts, setLoginAttempts] = useState("5");
  const [minPasswordLength, setMinPasswordLength] = useState("12");
  const [requireUppercase, setRequireUppercase] = useState(true);
  const [requireNumbers, setRequireNumbers] = useState(true);
  const [requireSymbols, setRequireSymbols] = useState(true);

  // Authentication
  const [ssoGoogle, setSsoGoogle] = useState(false);
  const [ssoGithub, setSsoGithub] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [passkeySupport, setPasskeySupport] = useState(true);

  // Protection
  const [captchaOnLogin, setCaptchaOnLogin] = useState(true);
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState(120);
  const [hstsHeaders, setHstsHeaders] = useState(true);
  const [xFrameDeny, setXFrameDeny] = useState(true);
  const [cspEnabled, setCspEnabled] = useState(true);

  // Active Sessions
  const [sessions] = useState<ActiveSession[]>([
    {
      id: "sess_1",
      device: "Current Browser Session",
      ip: "Local Session",
      location: "Verified Active",
      lastActive: "Active Now",
      isCurrent: true,
    },
    {
      id: "sess_2",
      device: "Remote Mobile Client",
      ip: "198.51.100.24",
      location: "Bengaluru, India",
      lastActive: "2 hours ago",
      isCurrent: false,
    },
  ]);

  // Audit History Log (Live PostgreSQL AdminAuditLog)
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const retryLogs = () => {
    setFetchTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchAuditLogs() {
      setIsLoadingLogs(true);
      setLogsError(null);

      try {
        const offset = Math.max(0, (auditPage - 1) * AUDIT_PAGE_SIZE);
        const res = await adminClient.getAuditLogs({
          limit: AUDIT_PAGE_SIZE,
          offset,
        });

        if (!isMounted) return;

        if (res.success && res.data) {
          setAuditLogs(res.data.logs || []);
        } else {
          setLogsError(res.error || "Failed to load audit logs");
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setLogsError(err instanceof Error ? err.message : "Failed to load audit logs");
      } finally {
        if (isMounted) {
          setIsLoadingLogs(false);
        }
      }
    }

    fetchAuditLogs();

    return () => {
      isMounted = false;
    };
  }, [auditPage, fetchTrigger]);

  const handleTerminateSession = (_id: string) => {
    toast.info("Session revocation from the admin portal is scheduled for Version 2. Remote session revocation is managed via Supabase Auth.");
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="rounded-xl border border-brand/20 bg-panel/80 p-4">
        <h2 className="font-display text-[17px] font-bold text-foreground text-glow flex items-center gap-2">
          <Shield className="size-4 text-brand-bright" />
          Security Architecture & Access Controls
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          Configure authentication rules, session timeouts, multi-factor verification, and audit logs.
        </p>
      </div>

      {/* Security Architecture Notice */}
      <div className="flex items-center gap-2.5 rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-[12.5px] text-cyan-300">
        <Shield className="size-4 shrink-0 text-cyan-400" />
        <span>
          <strong>Security Architecture Notice:</strong> Administrative access policies, session lifespans, and MFA enforcement are governed by Supabase Auth and server edge middleware.
        </span>
      </div>

      {/* 1. Admin Security Policies */}
      <SettingsCard
        title="Admin Security & Password Policy"
        description="Thresholds for idle session termination and password complexity requirements."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Idle Session Timeout"
          description="Inactivity duration before the admin is automatically logged out."
        >
          <select
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(e.target.value)}
            className="rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="15m">15 Minutes (Strict)</option>
            <option value="30m">30 Minutes</option>
            <option value="60m">1 Hour (Recommended)</option>
            <option value="240m">4 Hours</option>
            <option value="1440m">24 Hours</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Max Failed Login Attempts"
          description="Number of bad passwords before locking account for 30 minutes."
        >
          <select
            value={loginAttempts}
            onChange={(e) => setLoginAttempts(e.target.value)}
            className="rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="3">3 Attempts (High Security)</option>
            <option value="5">5 Attempts (Standard)</option>
            <option value="10">10 Attempts</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Minimum Password Length"
          description="Number of characters required for all admin passwords."
        >
          <select
            value={minPasswordLength}
            onChange={(e) => setMinPasswordLength(e.target.value)}
            className="rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none font-mono"
          >
            <option value="8">8 Characters</option>
            <option value="10">10 Characters</option>
            <option value="12">12 Characters (Recommended)</option>
            <option value="16">16 Characters (Military Grade)</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Password Complexity Requirements"
          description="Enforce uppercase, numbers, and special symbol rules."
        >
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={requireUppercase}
                onChange={(e) => setRequireUppercase(e.target.checked)}
                className="rounded accent-brand-bright"
              />
              Uppercase (A-Z)
            </label>
            <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={requireNumbers}
                onChange={(e) => setRequireNumbers(e.target.checked)}
                className="rounded accent-brand-bright"
              />
              Numbers (0-9)
            </label>
            <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={requireSymbols}
                onChange={(e) => setRequireSymbols(e.target.checked)}
                className="rounded accent-brand-bright"
              />
              Symbols (!@#$)
            </label>
          </div>
        </SettingRow>
      </SettingsCard>

      {/* 2. Authentication Methods & SSO */}
      <SettingsCard
        title="Authentication Methods & Multi-Factor (MFA)"
        description="Single Sign-On (SSO) providers and hardware security keys."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Two-Factor Authentication (2FA / TOTP)"
          description="Mandatory 6-digit authenticator code (Google Authenticator, 1Password) on sign-in."
        >
          <SettingToggle
            checked={twoFactorAuth}
            onChange={setTwoFactorAuth}
            label="Enforce 2FA"
          />
        </SettingRow>

        <SettingRow
          label="FIDO2 WebAuthn & Passkeys"
          description="Allows biometric unlock using Touch ID, Windows Hello, or YubiKey."
        >
          <SettingToggle
            checked={passkeySupport}
            onChange={setPasskeySupport}
            label="Passkeys"
          />
        </SettingRow>

        {/* SSO Providers */}
        <div className="pt-2 border-t border-brand/10 space-y-3">
          <span className="text-[12.5px] font-semibold text-foreground">Enterprise Single Sign-On (SSO)</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-brand/20 bg-background/40 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 font-bold text-foreground">
                  G
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-foreground">Google Workspace SSO</p>
                  <p className="text-[10.5px] text-muted-foreground">OAuth 2.0 Client</p>
                </div>
              </div>
              <SettingToggle
                checked={ssoGoogle}
                onChange={setSsoGoogle}
                label="Google"
              />
            </div>

            <div className="rounded-xl border border-brand/20 bg-background/40 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 font-bold text-foreground">
                  GH
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-foreground">GitHub Organizations</p>
                  <p className="text-[10.5px] text-brand-bright font-mono">Team: innotechcore</p>
                </div>
              </div>
              <SettingToggle
                checked={ssoGithub}
                onChange={setSsoGithub}
                label="GitHub"
              />
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 3. Threat Protection & HTTP Headers */}
      <SettingsCard
        title="Network Defense & HTTP Security Headers"
        description="Edge mitigation against clickjacking, script injection, and automated scraping."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Bot Verification on Admin Sign-In"
          description="Require invisible Turnstile validation before processing credentials."
        >
          <SettingToggle
            checked={captchaOnLogin}
            onChange={setCaptchaOnLogin}
            label="Bot Defense"
          />
        </SettingRow>

        <SettingRow
          label="API Rate Limiting"
          description="Max allowed requests per client IP per minute before returning 429."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-brand-bright min-w-[60px]">{rateLimitPerMinute} req/m</span>
            <input
              type="range"
              min="30"
              max="300"
              step="10"
              value={rateLimitPerMinute}
              onChange={(e) => setRateLimitPerMinute(Number(e.target.value))}
              className="w-48 accent-brand-bright"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Strict-Transport-Security (HSTS)"
          description="Instructs browsers to only connect over HTTPS with max-age=31536000."
        >
          <SettingToggle
            checked={hstsHeaders}
            onChange={setHstsHeaders}
            label="HSTS"
          />
        </SettingRow>

        <SettingRow
          label="Frame Protection (X-Frame-Options: DENY)"
          description="Prevents clickjacking by blocking iframe embedding of the admin portal."
        >
          <SettingToggle
            checked={xFrameDeny}
            onChange={setXFrameDeny}
            label="X-Frame"
          />
        </SettingRow>

        <SettingRow
          label="Content Security Policy (CSP)"
          description="Restricts authorized origins for scripts, styles, and web workers."
        >
          <SettingToggle
            checked={cspEnabled}
            onChange={setCspEnabled}
            label="CSP"
          />
        </SettingRow>
      </SettingsCard>

      {/* 4. Active Sessions Management */}
      <SettingsCard
        title="Active Administrative Sessions"
        description="Inspect and terminate signed-in devices connected to this admin portal."
        badge="Coming Soon — Version 2"
      >
        <div className="space-y-2.5">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-brand/20 bg-background/50 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg border border-brand/20 bg-background">
                  <Laptop className="size-4 text-brand-bright" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[12.5px] font-semibold text-foreground">{sess.device}</p>
                    {sess.isCurrent && (
                      <span className="rounded bg-brand-bright/20 px-1.5 py-0.5 text-[9.5px] font-bold text-brand-bright">
                        CURRENT SESSION
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    IP: {sess.ip} • {sess.location} • {sess.lastActive}
                  </p>
                </div>
              </div>
              {!sess.isCurrent && (
                <button
                  type="button"
                  onClick={() => handleTerminateSession(sess.id)}
                  className="inline-flex items-center gap-1 self-start sm:self-center rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="size-3" />
                  Terminate
                </button>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* 5. Security Audit History */}
      <SettingsCard
        title="Security Audit & Activity History"
        description="Chronological log of administrative operations, security events, and configuration updates."
        badge="Live Records"
      >
        {isLoadingLogs ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-brand-bright" />
            <span>Loading audit records from database...</span>
          </div>
        ) : logsError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-red-400 text-[12.5px] font-medium">
              <AlertTriangle className="size-4" />
              <span>{logsError}</span>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              {logsError.toLowerCase().includes("forbidden") || logsError.toLowerCase().includes("unauthorized")
                ? "Viewing administrative audit records requires SUPER_ADMIN or ADMIN privileges (AUDIT_LOG_READ)."
                : "Unable to retrieve audit history records. Check network connectivity or server logs."}
            </p>
            <button
              type="button"
              onClick={retryLogs}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1 text-[11.5px] font-medium text-red-300 hover:bg-red-500/20 transition"
            >
              <RefreshCw className="size-3" />
              Retry Loading
            </button>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-brand/20 bg-background/30 p-8 text-center space-y-1">
            <History className="size-5 text-muted-foreground mx-auto mb-1 opacity-60" />
            <p className="text-[12.5px] font-medium text-foreground">No Audit Records Found</p>
            <p className="text-[11.5px] text-muted-foreground">
              Administrative mutations and security events will be displayed here as operations occur.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-brand/15 text-[11px] font-mono text-muted-foreground">
                    <th className="pb-2">Timestamp</th>
                    <th className="pb-2">Account</th>
                    <th className="pb-2">IP Address</th>
                    <th className="pb-2">Method / Action</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand/10">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="text-foreground/90">
                      <td className="py-2.5 font-mono text-[11px] text-muted-foreground">
                        {formatAuditTimestamp(log.createdAt)}
                      </td>
                      <td className="py-2.5 font-medium">{log.actorEmail}</td>
                      <td className="py-2.5 font-mono text-[11px] text-brand-bright">
                        {log.ipAddress || "—"}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground/90 font-mono text-[11.5px] block">
                            {log.action}
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            {log.module}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          RECORDED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-brand/10 pt-3 text-[12px]">
              <span className="text-[11.5px] text-muted-foreground font-mono">
                Page {auditPage} • {auditLogs.length} record{auditLogs.length !== 1 ? "s" : ""} shown (Limit {AUDIT_PAGE_SIZE})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={auditPage <= 1 || isLoadingLogs}
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand/20 bg-background/60 px-2.5 py-1 text-[11.5px] font-medium text-foreground/80 hover:text-foreground hover:border-brand-bright disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="size-3.5" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={auditLogs.length < AUDIT_PAGE_SIZE || isLoadingLogs}
                  onClick={() => setAuditPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand/20 bg-background/60 px-2.5 py-1 text-[11.5px] font-medium text-foreground/80 hover:text-foreground hover:border-brand-bright disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
