import { useState, useEffect, useRef } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Key,
  RefreshCw,
  Info,
  QrCode,
} from "lucide-react";
import type { Factor } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/use-auth";
import { authService } from "@/lib/auth/auth-service";
import { adminClient } from "@/lib/api/admin-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export function MfaEnrollmentCard() {
  const { isMfaEnrolled, verifiedFactorId, checkMfaState, adminProfile, refreshProfile } = useAuth();

  // Enrollment workflow state
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [pendingFactor, setPendingFactor] = useState<Factor | null>(null);
  const [enrollmentData, setEnrollmentData] = useState<TransientEnrollmentState | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clientValidationError, setClientValidationError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);

  // Policy Details Modal state (preserved for administrative policy transparency)
  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  const isMountedRef = useRef(true);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Ensure transient secrets are never retained on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      setEnrollmentData(null);
      setVerificationCode("");
    };
  }, []);

  // Inspect authoritative factor list for pending unverified factors when unenrolled
  useEffect(() => {
    if (!isMfaEnrolled && !isSettingUp) {
      authService
        .listMfaFactors()
        .then((res) => {
          if (!isMountedRef.current) return;
          const allFactors = res.data?.all || [];
          const unv = allFactors.filter(
            (f) => f.factor_type === "totp" && f.status === "unverified"
          );
          setPendingFactor(unv.length > 0 ? unv[0] : null);
        })
        .catch(() => {
          // Non-blocking background audit
        });
    } else {
      setPendingFactor(null);
    }
  }, [isMfaEnrolled, isSettingUp]);

  // Focus input when setup mode opens
  useEffect(() => {
    if (isSettingUp && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [isSettingUp]);

  /**
   * Refreshes authoritative MFA factor state
   */
  const handleRefreshState = async () => {
    setIsRefreshing(true);
    try {
      const [state, factorsRes] = await Promise.all([
        checkMfaState(),
        authService.listMfaFactors(),
      ]);

      const unv = (factorsRes.data?.all || []).filter(
        (f) => f.factor_type === "totp" && f.status === "unverified"
      );
      setPendingFactor(unv.length > 0 ? unv[0] : null);

      if (state.isMfaEnrolled) {
        toast.success("Two-Factor Authentication is active and verified.");
      } else {
        toast.info("Two-Factor Authentication is not currently enabled.");
      }
    } catch {
      toast.error("Failed to refresh MFA state.");
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  };

  /**
   * Safely cleans up an existing unverified factor by ID:
   * 1. Verifies the factor is unverified.
   * 2. Strictly confirms the factor ID is not the verified factor ID.
   * 3. Refreshes authoritative factor list.
   */
  const handleCleanupPendingFactor = async () => {
    if (!pendingFactor) return;
    setIsCleaningUp(true);
    setErrorMessage(null);

    try {
      // Re-verify authoritative status
      const authState = await checkMfaState();
      if (authState.isMfaEnrolled) {
        toast.info("Two-Factor Authentication is already active.");
        setPendingFactor(null);
        return;
      }

      // Strictly guard: ensure factor is unverified and not verifiedFactorId
      if (pendingFactor.status === "unverified" && pendingFactor.id !== authState.verifiedFactorId) {
        await authService.unenrollMfa(pendingFactor.id);
      }

      // Refresh authoritative factor list
      const refreshed = await authService.listMfaFactors();
      const stillPending = (refreshed.data?.all || []).filter(
        (f) => f.factor_type === "totp" && f.status === "unverified"
      );
      setPendingFactor(stillPending.length > 0 ? stillPending[0] : null);
      toast.success("Previous unverified MFA setup removed. You can now enable MFA.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to clean up pending MFA factor.";
      const safeMsg = sanitizeErrorMessage(msg);
      setErrorMessage(safeMsg);
      toast.error(safeMsg);
    } finally {
      if (isMountedRef.current) {
        setIsCleaningUp(false);
      }
    }
  };

  /**
   * Initiates TOTP MFA enrollment:
   * 1. Re-verifies authoritative state to avoid duplicate factors.
   * 2. Cleans up any prior abandoned unverified factors by factor ID.
   * 3. Refreshes factor state to confirm clean slate.
   * 4. Calls authService.enrollTotp().
   * 5. Handles duplicate friendly name gracefully without leaving UI stuck.
   * 6. Holds QR code and secret ONLY in transient component memory.
   */
  const handleStartEnrollment = async () => {
    if (isMfaEnrolled) {
      toast.info("Two-Factor Authentication is already active.");
      return;
    }

    setIsEnrolling(true);
    setErrorMessage(null);
    setClientValidationError(null);
    setVerificationCode("");
    setShowManualKey(false);

    try {
      // 1. Authoritative pre-check
      const authoritative = await checkMfaState();
      if (authoritative.isMfaEnrolled) {
        toast.info("Two-Factor Authentication is already active.");
        if (isMountedRef.current) setIsEnrolling(false);
        return;
      }

      // 2. Safe pending factor audit & cleanup
      const factorsRes = await authService.listMfaFactors();
      if (factorsRes.error) {
        throw factorsRes.error;
      }

      // Synchronize immediately if authoritative factor check reveals an active verified factor
      if (factorsRes.data?.verifiedTotp) {
        await checkMfaState();
        toast.info("Two-Factor Authentication is already active.");
        if (isMountedRef.current) setIsEnrolling(false);
        return;
      }

      // Inspect data.all to capture all unverified factors
      const allFactors = factorsRes.data?.all || factorsRes.data?.totp || [];
      const unverified = allFactors.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified"
      );

      for (const unv of unverified) {
        // Strictly guard: NEVER unenroll any verified factor
        if (unv.id !== authoritative.verifiedFactorId && unv.status === "unverified") {
          await authService.unenrollMfa(unv.id);
        }
      }

      // Refresh factors list after cleanup to confirm clean slate
      if (unverified.length > 0) {
        await authService.listMfaFactors();
      }

      // 3. Request fresh TOTP factor from Supabase
      let enrollRes = await authService.enrollTotp({
        friendlyName: "CobraLearn Orbit Admin",
      });

      // Handle duplicate friendly-name error safely if Supabase still reports it
      if (enrollRes.error && enrollRes.error.message?.includes("already exists")) {
        const conflictRes = await authService.listMfaFactors();
        if (conflictRes.data?.verifiedTotp) {
          await checkMfaState();
          toast.info("Two-Factor Authentication is already active.");
          if (isMountedRef.current) setIsEnrolling(false);
          return;
        }

        const conflictFactor = (conflictRes.data?.all || []).find(
          (f) => f.friendly_name === "CobraLearn Orbit Admin" && f.status === "unverified"
        );

        if (
          conflictFactor &&
          conflictFactor.id !== authoritative.verifiedFactorId &&
          conflictFactor.status === "unverified"
        ) {
          await authService.unenrollMfa(conflictFactor.id);
          await authService.listMfaFactors();
          enrollRes = await authService.enrollTotp({
            friendlyName: "CobraLearn Orbit Admin",
          });
        }
      }

      if (enrollRes.error || !enrollRes.data) {
        throw enrollRes.error || new Error("Failed to initialize authenticator enrollment.");
      }

      if (!isMountedRef.current) return;

      // Transient in-memory storage only
      setEnrollmentData({
        factorId: enrollRes.data.id,
        qrCode: enrollRes.data.totp.qr_code,
        secret: enrollRes.data.totp.secret,
        uri: enrollRes.data.totp.uri,
      });
      setPendingFactor(null);
      setIsSettingUp(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const rawMsg = err instanceof Error ? err.message : "Failed to start MFA enrollment.";
      const safeMsg = sanitizeErrorMessage(rawMsg);
      setErrorMessage(safeMsg);
      toast.error(safeMsg);

      // Re-check factors if an unverified factor exists to provide reset option
      try {
        const refreshCheck = await authService.listMfaFactors();
        const unv = (refreshCheck.data?.all || []).filter(
          (f) => f.factor_type === "totp" && f.status === "unverified"
        );
        if (unv.length > 0) {
          setPendingFactor(unv[0]);
        }
      } catch {
        // Non-blocking
      }
    } finally {
      if (isMountedRef.current) {
        setIsEnrolling(false);
      }
    }
  };

  /**
   * Code input change handler with strict numeric-only client validation
   */
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Strip all non-digit characters and limit to 6 digits
    const numericVal = rawVal.replace(/\D/g, "").slice(0, 6);
    setVerificationCode(numericVal);
    setClientValidationError(null);
    setErrorMessage(null);
  };

  /**
   * Verifies the 6-digit TOTP code against the enrolled factor:
   * 1. Client-side format validation (6 digits).
   * 2. Atomic challenge and verify via authService.challengeAndVerifyMfa().
   * 3. Authoritatively refreshes auth state.
   * 4. Wipes transient secret immediately.
   */
  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!enrollmentData) {
      setErrorMessage("Enrollment session expired. Please restart setup.");
      return;
    }

    const cleanCode = verificationCode.trim();
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setClientValidationError("Please enter a valid 6-digit numeric code.");
      return;
    }

    if (isVerifying) return; // Prevent duplicate submission

    setIsVerifying(true);
    setErrorMessage(null);
    setClientValidationError(null);

    try {
      const verifyRes = await authService.challengeAndVerifyMfa(enrollmentData.factorId, cleanCode);
      if (verifyRes.error || !verifyRes.data) {
        throw (
          verifyRes.error ||
          new Error("Invalid verification code. Please check your authenticator app and try again.")
        );
      }

      // Re-fetch authoritative MFA factor and assurance level state
      const mfaState = await checkMfaState();
      if (!mfaState.isMfaEnrolled) {
        // Fallback: check factors list directly from Supabase
        const factorsRes = await authService.listMfaFactors();
        if (!factorsRes.data?.verifiedTotp) {
          throw new Error("MFA verification could not be confirmed. Please check your authenticator code and try again.");
        }
      }

      if (!isMountedRef.current) return;

      // Wipe transient secret immediately upon confirmation
      setEnrollmentData(null);
      setVerificationCode("");
      setPendingFactor(null);
      setIsSettingUp(false);

      // If user was quarantined in MFA recovery, call server completion
      if (adminProfile?.mfaRecoveryPending) {
        const reenrollRes = await adminClient.completeMfaReenrollment();
        if (!reenrollRes.success) {
          throw new Error(
            reenrollRes.error || "Server could not verify re-enrollment to lift quarantine."
          );
        }
        await refreshProfile();
        toast.success("Emergency MFA re-enrollment verified. Quarantine lifted!");
      } else {
        toast.success("Two-Factor Authentication enabled successfully!");
      }
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
   * Safe cancellation:
   * 1. Unenrolls the pending unverified factor if one was created.
   * 2. Strictly avoids unenrolling any verified factor.
   * 3. Wipes transient secrets from memory immediately.
   */
  const handleCancelSetup = async () => {
    const pendingId = enrollmentData?.factorId;

    // Immediately clear in-memory credentials
    setEnrollmentData(null);
    setVerificationCode("");
    setErrorMessage(null);
    setClientValidationError(null);
    setIsSettingUp(false);
    setCopiedSecret(false);
    setShowManualKey(false);

    if (adminProfile?.mfaRecoveryPending) {
      toast.info(
        "Setup paused. Your account remains in emergency recovery quarantine until MFA enrollment is completed."
      );
    }

    if (pendingId && pendingId !== verifiedFactorId) {
      try {
        await authService.unenrollMfa(pendingId);
        await authService.listMfaFactors();
      } catch {
        // Non-blocking cleanup
      }
    }
    setPendingFactor(null);

    toast.info("MFA setup cancelled. No factor was activated.");
  };

  /**
   * Copies the transient secret key to clipboard without logging
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

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
      {/* CARD HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
            {isMfaEnrolled ? <ShieldCheck className="size-5" /> : <Shield className="size-5" />}
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-foreground text-glow">
              Multi-Factor Authentication (MFA)
            </h3>
            <p className="text-[12px] text-muted-foreground">
              Add an extra layer of security to your administrative account using TOTP.
            </p>
          </div>
        </div>

        {/* REFRESH STATE BUTTON */}
        {!isSettingUp && (
          <button
            type="button"
            onClick={handleRefreshState}
            disabled={isRefreshing}
            aria-label="Refresh MFA Status"
            className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/50 px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground transition hover:border-brand-bright/40 hover:text-brand-bright disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-brand-bright" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}
      </div>

      {/* EMERGENCY MFA RECOVERY QUARANTINE BANNER */}
      {adminProfile?.mfaRecoveryPending && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-300">
          <ShieldAlert className="size-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-amber-200">
              Emergency MFA Recovery Active
            </p>
            <p className="text-[12px] text-amber-300/90 mt-1 leading-relaxed">
              Your administrative account is currently quarantined following an emergency MFA reset. General administrative operations are restricted. You must enroll and verify a new authenticator factor to restore full administrative privileges.
            </p>
          </div>
        </div>
      )}

      {/* VIEW 1: ACTIVE / ENROLLED STATE */}
      {isMfaEnrolled && !isSettingUp && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-500/25 bg-emerald-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                MFA Status
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                <p className="text-[13.5px] font-semibold text-emerald-400">Enabled &amp; Protected</p>
              </div>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                Time-based One-Time Password (TOTP) authenticator is active for this account.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11.5px] font-semibold text-emerald-300">
              AAL2 Enforced
            </span>
            <button
              type="button"
              onClick={() => setPolicyModalOpen(true)}
              className="flex items-center justify-center gap-1 rounded-lg border border-brand/30 bg-background/60 px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:border-brand-bright/50 hover:bg-brand/10 hover:text-brand-bright cursor-pointer"
            >
              <span>MFA Details</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: UNENROLLED / IDLE STATE */}
      {!isMfaEnrolled && !isSettingUp && (
        <>
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-brand/15 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  MFA Status
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="size-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
                  <p className="text-[13.5px] font-semibold text-foreground">Not Enabled</p>
                  <span className="text-[12px] font-normal text-muted-foreground">•</span>
                  <p className="text-[12px] font-normal text-muted-foreground">Managed by Auth Provider</p>
                </div>
                <p className="text-[11.5px] text-muted-foreground mt-0.5">
                  Protect your administrative account with an authenticator app (Google Authenticator, 1Password, etc.).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPolicyModalOpen(true)}
                className="flex items-center justify-center gap-1 rounded-lg border border-brand/30 bg-background/60 px-3 py-2 text-[12px] font-medium text-foreground transition hover:border-brand-bright/50 hover:bg-brand/10 hover:text-brand-bright cursor-pointer"
              >
                <span>MFA Details</span>
              </button>

              <button
                type="button"
                onClick={handleStartEnrollment}
                disabled={isEnrolling}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-brand-bright/70 bg-brand/15 px-4 py-2 text-[12.5px] font-bold text-brand-bright shadow-[0_0_14px_rgba(0,255,170,0.22)] transition hover:bg-brand/25 hover:brightness-110 disabled:opacity-50 cursor-pointer"
              >
                {isEnrolling ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Preparing Setup...</span>
                  </>
                ) : (
                  <>
                    <Key className="size-4" />
                    <span>Enable MFA</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Pending Unverified Factor Recovery Banner */}
          {pendingFactor && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-[12.5px] text-amber-300">
                <AlertCircle className="size-4 shrink-0 text-amber-400" />
                <span>
                  An incomplete MFA setup was detected ({pendingFactor.friendly_name || "Authenticator"}). Clean up this pending setup to start fresh.
                </span>
              </div>
              <button
                type="button"
                onClick={handleCleanupPendingFactor}
                disabled={isCleaningUp || isEnrolling}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[12px] font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isCleaningUp ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-3.5" />
                    <span>Reset Pending Setup</span>
                  </>
                )}
              </button>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[12.5px] text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </>
      )}

      {/* VIEW 3: INLINE MFA ENROLLMENT SETUP FLOW */}
      {!isMfaEnrolled && isSettingUp && enrollmentData && (
        <div className="mt-4 rounded-xl border border-brand/30 bg-background/70 p-5 shadow-inner">
          <div className="flex items-center justify-between border-b border-brand/15 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-brand/15 text-brand-bright">
                <QrCode className="size-4" />
              </div>
              <h4 className="font-display text-[14px] font-bold text-foreground">
                Set Up Authenticator App
              </h4>
            </div>
            <button
              type="button"
              onClick={handleCancelSetup}
              disabled={isVerifying}
              className="text-[12px] font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              Cancel Setup
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* LEFT COLUMN: QR CODE & INSTRUCTIONS */}
            <div className="flex flex-col items-center justify-center rounded-lg border border-brand/15 bg-panel/60 p-4 text-center">
              <p className="text-[12.5px] font-medium text-foreground mb-3">
                1. Scan QR Code in your authenticator app
              </p>

              {/* QR Code SVG Image (Data URL) */}
              <div className="relative rounded-lg bg-white p-3 shadow-md border border-neutral-200">
                <img
                  src={enrollmentData.qrCode}
                  alt="MFA Authenticator QR Code"
                  className="size-44 object-contain"
                />
              </div>

              {/* MANUAL ENTRY FALLBACK */}
              <div className="mt-4 w-full">
                <button
                  type="button"
                  onClick={() => setShowManualKey((prev) => !prev)}
                  className="text-[11.5px] font-medium text-brand-bright hover:underline cursor-pointer"
                >
                  {showManualKey ? "Hide manual setup key" : "Can't scan QR code? View manual setup key"}
                </button>

                {showManualKey && (
                  <div className="mt-2.5 rounded-lg border border-brand/20 bg-background/80 p-3 text-left">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Account Secret Key
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <code className="font-mono text-[12px] font-semibold text-brand-bright tracking-wider select-all break-all">
                        {enrollmentData.secret}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        aria-label="Copy secret key"
                        className="flex size-8 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand-bright hover:bg-brand/20 transition cursor-pointer"
                      >
                        {copiedSecret ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-[10.5px] text-muted-foreground">
                      Enter this key manually into Google Authenticator or 1Password.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: 6-DIGIT CODE CONFIRMATION FORM */}
            <form onSubmit={handleVerify} className="flex flex-col justify-between space-y-4">
              <div>
                <p className="text-[12.5px] font-medium text-foreground">
                  2. Enter 6-digit confirmation code
                </p>
                <p className="text-[11.5px] text-muted-foreground mt-0.5">
                  Enter the code displayed in your authenticator app to verify the setup.
                </p>

                <div className="mt-4 space-y-2">
                  <label
                    htmlFor="mfa-verify-code-input"
                    className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    Confirmation Code
                  </label>
                  <input
                    id="mfa-verify-code-input"
                    ref={codeInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={handleCodeChange}
                    disabled={isVerifying}
                    className="w-full rounded-lg border border-brand/30 bg-background/80 px-4 py-2.5 font-mono text-[18px] font-bold text-center tracking-[0.4em] text-foreground placeholder:text-muted-foreground/40 focus:border-brand-bright focus:outline-none focus:ring-1 focus:ring-brand-bright disabled:opacity-50"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Exactly 6 numeric digits required.
                  </p>
                </div>

                {/* Validation and Error Alerts */}
                {clientValidationError && (
                  <div
                    role="alert"
                    className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[12px] text-amber-400"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{clientValidationError}</span>
                  </div>
                )}

                {errorMessage && (
                  <div
                    role="alert"
                    className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-[12px] text-destructive"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancelSetup}
                  disabled={isVerifying}
                  className="rounded-lg border border-brand/20 bg-background/50 px-4 py-2 text-[12.5px] font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={verificationCode.length !== 6 || isVerifying}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-brand-bright/70 bg-brand/20 px-5 py-2 text-[12.5px] font-bold text-brand-bright shadow-[0_0_14px_rgba(0,255,170,0.22)] transition hover:bg-brand/30 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      <span>Confirm &amp; Activate</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MFA POLICY INFORMATION MODAL (Transparent Provider Policy & Instructions) */}
      <Dialog open={policyModalOpen} onOpenChange={setPolicyModalOpen}>
        <DialogContent className="border border-brand/30 bg-[#040e08]/95 p-6 backdrop-blur-2xl text-foreground max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display text-[18px] font-bold text-foreground text-glow flex items-center gap-2">
              <Shield className="size-5 text-brand-bright" />
              Multi-Factor Authentication
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-muted-foreground pt-1">
              Multi-factor authentication status and organizational policy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3 text-[12.5px]">
            <div className="rounded-lg border border-brand/20 bg-background/60 p-3.5">
              <p className="font-semibold text-foreground">Provider Policy</p>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                MFA is configured directly through your Supabase Auth / OAuth identity provider.
              </p>
            </div>

            <div className="rounded-lg border border-brand/20 bg-background/60 p-3.5">
              <p className="font-semibold text-foreground">Self-Service Enrollment</p>
              <div className="mt-1 flex items-start gap-2 text-[11.5px]">
                <Info className="size-4 shrink-0 text-brand-bright mt-0.5" />
                <span className="text-muted-foreground">
                  {isMfaEnrolled ? (
                    "Your administrative account currently has an active TOTP factor enrolled and verified."
                  ) : (
                    "Self-service in-portal MFA enrollment is available using the 'Enable MFA' button above. Self-service in-portal MFA enrollment is not configured for unverified tiers. Contact your organization administrator if you require emergency reset assistance."
                  )}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPolicyModalOpen(false)}
                className="rounded-lg border border-brand/25 bg-background/60 px-4 py-2 text-[12.5px] font-medium text-foreground transition hover:bg-background/90 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
