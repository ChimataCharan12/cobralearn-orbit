import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Key,
  RefreshCw,
  QrCode,
  ArrowRight,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/use-auth";
import { authService } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";

interface TransientEnrollmentState {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

/**
 * Sanitizes error messages to guarantee no secrets, URIs, or tokens leak into the UI.
 */
function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/(Bearer\s+[A-Za-z0-9\-._~+/]+=*)/gi, "[REDACTED]")
    .replace(/(secret=[A-Z0-9]+)/gi, "secret=[REDACTED]")
    .replace(/(otpauth:\/\/[^\s]+)/gi, "[REDACTED_URI]");
}

export function MfaRecoveryCard() {
  const navigate = useNavigate();
  const { adminProfile, refreshProfile, signOut, checkMfaState } = useAuth();

  const isMountedRef = useRef(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [enrollmentData, setEnrollmentData] = useState<TransientEnrollmentState | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clientValidationError, setClientValidationError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    startEnrollment();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Generates a fresh replacement TOTP factor:
   * 1. Cleans up unverified factors if any exist.
   * 2. Enrolls new TOTP factor at AAL1.
   * 3. Stores QR code and secret in transient in-memory state only.
   */
  const startEnrollment = async () => {
    setIsInitializing(true);
    setErrorMessage(null);
    setClientValidationError(null);
    setVerificationCode("");
    setShowManualKey(false);

    try {
      // 1. Audit and clean up any lingering unverified factors
      const factorsRes = await authService.listMfaFactors();
      if (!factorsRes.error && factorsRes.data) {
        const allFactors = factorsRes.data.all || factorsRes.data.totp || [];
        const unverified = allFactors.filter(
          (f) => f.factor_type === "totp" && f.status === "unverified"
        );
        for (const factor of unverified) {
          try {
            await authService.unenrollMfa(factor.id);
          } catch {
            // Non-blocking cleanup
          }
        }
      }

      // 2. Request fresh TOTP enrollment from Supabase
      let enrollRes = await authService.enrollTotp({
        friendlyName: "CobraLearn Orbit Admin (Recovery)",
      });

      // Handle duplicate friendly name gracefully
      if (enrollRes.error && enrollRes.error.message?.includes("already exists")) {
        const conflictRes = await authService.listMfaFactors();
        const conflictFactor = (conflictRes.data?.all || []).find(
          (f) => f.friendly_name === "CobraLearn Orbit Admin (Recovery)" && f.status === "unverified"
        );
        if (conflictFactor) {
          await authService.unenrollMfa(conflictFactor.id);
          enrollRes = await authService.enrollTotp({
            friendlyName: "CobraLearn Orbit Admin (Recovery)",
          });
        }
      }

      if (enrollRes.error || !enrollRes.data) {
        throw enrollRes.error || new Error("Failed to initialize replacement authenticator factor.");
      }

      if (!isMountedRef.current) return;

      setEnrollmentData({
        factorId: enrollRes.data.id,
        qrCode: enrollRes.data.totp.qr_code,
        secret: enrollRes.data.totp.secret,
        uri: enrollRes.data.totp.uri,
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      const rawMsg = err instanceof Error ? err.message : "Failed to initialize replacement MFA factor.";
      const safeMsg = sanitizeErrorMessage(rawMsg);
      setErrorMessage(safeMsg);
      toast.error(safeMsg);
    } finally {
      if (isMountedRef.current) {
        setIsInitializing(false);
      }
    }
  };

  /**
   * Code input change handler: strictly digits only, max 6 characters.
   */
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const numericVal = rawVal.replace(/\D/g, "").slice(0, 6);
    setVerificationCode(numericVal);
    setClientValidationError(null);
    setErrorMessage(null);
  };

  /**
   * Verifies the fresh TOTP factor and lifts the quarantine.
   */
  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!enrollmentData) {
      setErrorMessage("Enrollment session expired. Please restart setup.");
      return;
    }

    const cleanCode = verificationCode.trim();
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setClientValidationError("Please enter a valid 6-digit numeric verification code.");
      return;
    }

    if (isVerifying) return;

    setIsVerifying(true);
    setErrorMessage(null);
    setClientValidationError(null);

    try {
      // 1. Verify TOTP code against Supabase factor (upgrades session from AAL1 to AAL2)
      const verifyRes = await authService.challengeAndVerifyMfa(enrollmentData.factorId, cleanCode);
      if (verifyRes.error || !verifyRes.data) {
        throw (
          verifyRes.error ||
          new Error("Invalid verification code. Please check your authenticator app and try again.")
        );
      }

      // 2. Authoritatively verify with server that replacement factor is verified & lift quarantine
      const reenrollRes = await adminClient.completeMfaReenrollment();
      if (!reenrollRes.success) {
        throw new Error(
          reenrollRes.error || "Server could not verify re-enrollment to lift quarantine."
        );
      }

      // 3. Immediately clear transient secret and in-memory state
      setEnrollmentData(null);
      setVerificationCode("");

      // 4. Refresh authoritative profile and MFA state
      await checkMfaState();
      await refreshProfile();

      toast.success("MFA re-enrollment verified successfully. Quarantine lifted!");

      // 5. Navigate to protected admin dashboard
      navigate({ to: "/admin/dashboard" });
    } catch (err) {
      if (!isMountedRef.current) return;
      const rawMsg = err instanceof Error ? err.message : "Verification failed. Please try again.";
      const safeMsg = sanitizeErrorMessage(rawMsg);
      setErrorMessage(safeMsg);
      toast.error(safeMsg);
    } finally {
      if (isMountedRef.current) {
        setIsVerifying(false);
      }
    }
  };

  /**
   * Copies the base32 secret to clipboard securely.
   */
  const handleCopySecret = async () => {
    if (!enrollmentData?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollmentData.secret);
      setCopiedSecret(true);
      toast.success("Secret key copied to clipboard.");
      setTimeout(() => {
        if (isMountedRef.current) setCopiedSecret(false);
      }, 2500);
    } catch {
      toast.error("Failed to copy secret key.");
    }
  };

  /**
   * Safe cancellation: signs out and clears session to prevent lingering partial auth.
   */
  const handleCancelAndSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authService.signOut();
      try {
        await signOut();
      } catch {
        // Non-blocking
      }
    } catch {
      // Non-blocking
    } finally {
      navigate({ to: "/admin" });
    }
  };

  return (
    <section className="flex w-full lg:w-[48%] max-w-[500px] items-center justify-center my-auto py-2 lg:py-0">
      {/* Real Responsive Glassmorphism Recovery Re-Enrollment Card */}
      <div className="relative w-full overflow-hidden rounded-[20px] lg:rounded-[24px] border-[1.5px] border-amber-500/40 bg-[#040e08]/90 p-5 sm:p-6 lg:p-7 backdrop-blur-2xl shadow-[0_0_25px_rgba(245,158,11,0.25),0_0_60px_rgba(245,158,11,0.1),0_30px_80px_rgba(0,0,0,0.9),inset_0_0_25px_rgba(245,158,11,0.05)]">
        {/* Subtle Top-Right Amber Rim Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/20 blur-2xl"
        />

        {/* Top Border Amber Highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[1px] w-[60%] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-500/70 to-transparent"
        />

        {/* Header Section */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
            <ShieldAlert className="size-7 text-amber-400" />
          </div>

          <h2 className="font-sans text-[20px] sm:text-[22px] font-bold leading-tight tracking-tight text-white">
            MFA <span className="text-amber-400">Re-Enrollment</span>
          </h2>

          <p className="mt-1.5 font-sans text-[12px] sm:text-[12.5px] font-normal leading-relaxed text-[#94a3b8] max-w-[360px]">
            Your lost authenticator has been deactivated. Configure and verify a replacement authenticator to restore administrative access.
          </p>
        </div>

        {/* Alert Banner */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
          <AlertCircle className="size-4 shrink-0 text-amber-400 mt-0.5" />
          <p className="text-[11.5px] leading-relaxed text-amber-200/90">
            Account quarantined in recovery mode. Protected administrative operations remain restricted until verification is complete.
          </p>
        </div>

        {/* Card Body */}
        {isInitializing ? (
          <div className="my-8 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="size-8 animate-spin text-amber-400" />
            <p className="text-[13px] font-medium text-[#94a3b8]">
              Initializing replacement authenticator factor...
            </p>
          </div>
        ) : errorMessage && !enrollmentData ? (
          <div className="my-6 flex flex-col items-center gap-4 text-center">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[12.5px] text-destructive">
              {errorMessage}
            </div>
            <button
              type="button"
              onClick={startEnrollment}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-[13px] font-semibold text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
            >
              <RefreshCw className="size-4" />
              <span>Retry Initialization</span>
            </button>
          </div>
        ) : enrollmentData ? (
          <form onSubmit={handleVerify} className="mt-5 flex flex-col gap-4">
            {/* Step 1: QR Code & Manual Key */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-black/40 p-3.5 text-center">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white/90 mb-2.5">
                <QrCode className="size-4 text-[#00ff87]" />
                <span>1. Scan with your authenticator app</span>
              </div>

              {/* QR Code Container */}
              <div className="rounded-lg bg-white p-2.5 shadow-md">
                <img
                  src={enrollmentData.qrCode}
                  alt="MFA QR Code"
                  className="size-36 sm:size-40 object-contain"
                />
              </div>

              {/* Toggle Manual Key */}
              <button
                type="button"
                onClick={() => setShowManualKey((prev) => !prev)}
                className="mt-2.5 text-[11px] font-medium text-[#00ff87] hover:underline cursor-pointer"
              >
                {showManualKey ? "Hide manual setup key" : "Can't scan? View manual key"}
              </button>

              {showManualKey && (
                <div className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 p-2.5 text-left">
                  <span className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Secret Key</span>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <code className="font-mono text-[11px] font-semibold text-amber-300 break-all select-all">
                      {enrollmentData.secret}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      aria-label="Copy secret"
                      className="flex size-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition cursor-pointer"
                    >
                      {copiedSecret ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Verification Code Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="totp-code" className="flex items-center gap-1.5 text-[12px] font-semibold text-white/90">
                <Key className="size-3.5 text-[#00ff87]" />
                <span>2. Enter 6-digit verification code</span>
              </label>

              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verificationCode}
                onChange={handleCodeChange}
                placeholder="000000"
                disabled={isVerifying}
                autoFocus
                className="h-11 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-center font-mono text-[18px] tracking-[0.3em] font-bold text-white placeholder:text-white/20 focus:border-[#00ff87] focus:outline-none focus:ring-1 focus:ring-[#00ff87] disabled:opacity-50"
              />

              {clientValidationError && (
                <p className="text-[11.5px] text-amber-400 mt-0.5">{clientValidationError}</p>
              )}

              {errorMessage && (
                <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-[12px] text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={isVerifying || verificationCode.length !== 6}
              className="mt-1 flex h-[42px] xl:h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-[14.5px] sm:text-[15.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="size-4 animate-spin text-[#02180c]" />
                  <span>Verifying &amp; Restoring Access...</span>
                </>
              ) : (
                <>
                  <span>Verify Code &amp; Restore Access</span>
                  <ArrowRight className="size-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>
        ) : null}

        {/* Footer Cancel / Sign Out */}
        <div className="mt-4 pt-3 border-t border-white/10 text-center">
          <button
            type="button"
            onClick={handleCancelAndSignOut}
            disabled={isSigningOut || isVerifying}
            className="inline-flex items-center gap-1.5 font-sans text-[12px] font-medium text-[#94a3b8] hover:text-[#00ff87] transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSigningOut ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Signing out...</span>
              </>
            ) : (
              <>
                <LogOut className="size-3.5" />
                <span>Cancel and return to Sign In</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
