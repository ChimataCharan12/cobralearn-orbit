import { ArrowRight, ArrowLeft, Mail, ShieldCheck, ShieldAlert, Key, KeyRound, Loader2, AlertCircle, LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, Fragment, type FormEvent } from "react";

import { PasswordInput } from "@/components/PasswordInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/use-auth";
import { adminClient } from "@/lib/api/admin-client";
import {
  formatRecoveryCodeInput,
  isValidRecoveryCodeFormat,
  normalizeRecoveryCode,
} from "@/lib/auth/recovery-code-utils";

/**
 * Formats a duration in seconds to MM:SS string.
 */
export function formatMMSS(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

export function AdminLoginForm() {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownEmail, setCooldownEmail] = useState("");
  const navigate = useNavigate();
  const { user, session, signIn, verifyMfaChallenge, signOut, isMfaRequired, checkMfaState, refreshProfile } = useAuth();

  // Explicit Login State Machine: 'credentials' | 'mfa_challenge' | 'recovery_restricted'
  const [viewMode, setViewMode] = useState<"credentials" | "mfa_challenge" | "recovery_restricted">(
    isMfaRequired ? "mfa_challenge" : "credentials"
  );
  // Challenge method: 'totp' (default) | 'recovery_code'
  const [challengeMethod, setChallengeMethod] = useState<"totp" | "recovery_code">("totp");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const totpCode = digits.join("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const recoveryInputRef = useRef<HTMLInputElement | null>(null);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [mfaErrorMsg, setMfaErrorMsg] = useState<string | null>(null);

  // Synchronize state if an active session requires MFA elevation
  useEffect(() => {
    if (isMfaRequired) {
      setViewMode("mfa_challenge");
    }
  }, [isMfaRequired]);

  // Focus the appropriate input on challenge mount or method switch
  useEffect(() => {
    if (viewMode === "mfa_challenge") {
      if (challengeMethod === "totp") {
        const firstEmpty = digits.findIndex((d) => !d);
        const targetIdx = firstEmpty === -1 ? 0 : firstEmpty;
        inputRefs.current[targetIdx]?.focus();
      } else if (challengeMethod === "recovery_code") {
        recoveryInputRef.current?.focus();
      }
    }
  }, [viewMode, challengeMethod]);

  // Restore active cooldown from sessionStorage on page load/navigation
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("orbit_login_cooldown");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.cooldownUntil === "number") {
          const remaining = Math.max(0, Math.ceil((parsed.cooldownUntil - Date.now()) / 1000));
          if (remaining > 0) {
            setCooldownUntil(parsed.cooldownUntil);
            setCooldownSeconds(remaining);
            setCooldownEmail(parsed.email || "");
            setMessage(`Too many login attempts. Try again in ${formatMMSS(remaining)}.`);
          } else {
            sessionStorage.removeItem("orbit_login_cooldown");
            if (parsed.email) {
              adminClient.checkLoginEligibility(parsed.email).then((res) => {
                if (res.data && !res.data.allowed) {
                  const nextRetry = res.data.retryAfterSeconds || 60;
                  const nextUntil = Date.now() + nextRetry * 1000;
                  setCooldownUntil(nextUntil);
                  setCooldownSeconds(nextRetry);
                  setCooldownEmail(parsed.email);
                  setMessage(`Too many login attempts. Try again in ${formatMMSS(nextRetry)}.`);
                  try {
                    sessionStorage.setItem(
                      "orbit_login_cooldown",
                      JSON.stringify({ email: parsed.email, cooldownUntil: nextUntil, retryAfterSeconds: nextRetry })
                    );
                  } catch {}
                }
              }).catch(() => {});
            }
          }
        }
      }
    } catch {}
  }, []);

  // Live countdown timer ticking once per second
  useEffect(() => {
    if (cooldownSeconds <= 0 || !cooldownUntil) return;

    const timer = setInterval(async () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      if (remaining > 0) {
        setCooldownSeconds(remaining);
        setMessage(`Too many login attempts. Try again in ${formatMMSS(remaining)}.`);
      } else {
        clearInterval(timer);
        setCooldownSeconds(0);
        setCooldownUntil(null);
        try {
          sessionStorage.removeItem("orbit_login_cooldown");
        } catch {}

        // Re-evaluate eligibility with server before clearing message
        try {
          const res = await adminClient.checkLoginEligibility(cooldownEmail);
          if (!res.success) {
            setMessage("Rate limit evaluation unavailable. Please try again later.");
          } else if (res.data && !res.data.allowed) {
            const nextRetry = res.data.retryAfterSeconds || 60;
            const nextUntil = Date.now() + nextRetry * 1000;
            setCooldownSeconds(nextRetry);
            setCooldownUntil(nextUntil);
            try {
              sessionStorage.setItem(
                "orbit_login_cooldown",
                JSON.stringify({ email: cooldownEmail, cooldownUntil: nextUntil, retryAfterSeconds: nextRetry })
              );
            } catch {}
            setMessage(`Too many login attempts. Try again in ${formatMMSS(nextRetry)}.`);
          } else {
            setMessage("");
          }
        } catch {
          setMessage("Rate limit evaluation unavailable. Please try again later.");
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds, cooldownUntil, cooldownEmail]);

  /**
   * Primary credentials submission (Step 1)
   */
  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || cooldownSeconds > 0) return;

    setMessage("");
    setIsSubmitting(true);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");

    try {
      const result = await signIn(email, password);
      if (result.error || !result.data) {
        const retrySec = result.retryAfterSeconds ?? (result.error as any)?.retryAfterSeconds;
        if (typeof retrySec === "number" && retrySec > 0) {
          const until = Date.now() + retrySec * 1000;
          setCooldownUntil(until);
          setCooldownSeconds(retrySec);
          setCooldownEmail(email);
          try {
            sessionStorage.setItem(
              "orbit_login_cooldown",
              JSON.stringify({ email, cooldownUntil: until, retryAfterSeconds: retrySec })
            );
          } catch {}
          setMessage(`Too many login attempts. Try again in ${formatMMSS(retrySec)}.`);
        } else {
          setMessage(result.error?.message || "Invalid email or password.");
        }
      } else if (result.data.mfaRequired) {
        // Enrolled TOTP administrator: transition to MFA challenge screen
        try {
          sessionStorage.removeItem("orbit_login_cooldown");
        } catch {}
        setViewMode("mfa_challenge");
        setDigits(["", "", "", "", "", ""]);
        setMfaErrorMsg(null);
      } else {
        try {
          sessionStorage.removeItem("orbit_login_cooldown");
        } catch {}
        // Record login history with verified session token immediately following interactive login
        try {
          const token = result.data.session?.access_token;
          await adminClient.recordLoginHistory(token);
        } catch (err) {
          console.warn("[AdminLoginForm] Non-fatal: failed to record login history", err);
        }
        navigate({ to: "/admin/dashboard" });
      }
    } catch {
      setMessage("An unexpected error occurred during authentication.");
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Code input handlers with 6-box OTP auto-advance, backspace, arrow navigation, and pasting
   */
  const handleDigitChange = (index: number, val: string) => {
    const cleanVal = val.replace(/\D/g, "");
    if (!cleanVal) {
      const nextDigits = [...digits];
      nextDigits[index] = "";
      setDigits(nextDigits);
      setMfaErrorMsg(null);
      return;
    }

    if (cleanVal.length === 1) {
      const nextDigits = [...digits];
      nextDigits[index] = cleanVal;
      setDigits(nextDigits);
      setMfaErrorMsg(null);
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
      return;
    }

    // Multiple digits entered/pasted into this box
    const nextDigits = [...digits];
    const startIdx = cleanVal.length >= 6 ? 0 : index;
    for (let i = 0; i < cleanVal.length && startIdx + i < 6; i++) {
      const char = cleanVal[i];
      if (char !== undefined) {
        nextDigits[startIdx + i] = char;
      }
    }
    setDigits(nextDigits);
    setMfaErrorMsg(null);
    const targetIdx = Math.min(startIdx + cleanVal.length, 5);
    inputRefs.current[targetIdx]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const nextDigits = [...digits];
        nextDigits[index] = "";
        setDigits(nextDigits);
        setMfaErrorMsg(null);
      } else if (index > 0) {
        const nextDigits = [...digits];
        nextDigits[index - 1] = "";
        setDigits(nextDigits);
        setMfaErrorMsg(null);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const nextDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      if (i < pasted.length) {
        const char = pasted[i];
        if (char !== undefined) {
          nextDigits[i] = char;
        }
      }
    }
    setDigits(nextDigits);
    setMfaErrorMsg(null);
    const targetIdx = Math.min(pasted.length, 5);
    inputRefs.current[targetIdx]?.focus();
  };

  /**
   * MFA TOTP Challenge submission (Step 2)
   */
  async function submitMfaChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isVerifying) return;

    const cleanCode = totpCode.trim();
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setMfaErrorMsg("Please enter a valid 6-digit numeric code.");
      return;
    }

    setMfaErrorMsg(null);
    setIsVerifying(true);

    try {
      const result = await verifyMfaChallenge(cleanCode);
      if (result.error || !result.data) {
        const rawMsg = result.error?.message || "Invalid verification code.";
        let friendlyMsg = "Invalid verification code. Please check your authenticator app and try again.";
        if (rawMsg.includes("Inactive") || rawMsg.includes("deactivated") || rawMsg.includes("unprovisioned")) {
          friendlyMsg = "Access denied: Inactive or unprovisioned administrator.";
          setDigits(["", "", "", "", "", ""]);
        } else if (rawMsg.includes("MFA_REENROLLMENT_REQUIRED") || rawMsg.includes("re-enrollment")) {
          friendlyMsg = "Emergency recovery re-enrollment required. Please complete MFA setup.";
        } else if (rawMsg.includes("expired") || rawMsg.includes("Session") || rawMsg.includes("session")) {
          friendlyMsg = "Verification session expired. Please sign in again.";
        } else if (
          rawMsg.includes("Network") ||
          rawMsg.includes("timeout") ||
          rawMsg.includes("Failed to load") ||
          rawMsg.includes("Failed to verify") ||
          rawMsg.includes("database") ||
          rawMsg.includes("column")
        ) {
          friendlyMsg = rawMsg;
        }
        setMfaErrorMsg(sanitizeErrorMessage(friendlyMsg));
        setIsVerifying(false);
        return;
      }

      // Record login history with elevated session
      try {
        const token = result.data.session?.access_token;
        await adminClient.recordLoginHistory(token);
      } catch (err) {
        console.warn("[AdminLoginForm] Non-fatal: failed to record login history", err);
      }

      navigate({ to: "/admin/dashboard" });
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : "Verification failed.";
      setMfaErrorMsg(sanitizeErrorMessage(rawMsg));
    } finally {
      setIsVerifying(false);
    }
  }

  /**
   * MFA Login Recovery Challenge submission using single-use recovery code
   */
  async function submitRecoveryCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isVerifying) return;

    const normalized = normalizeRecoveryCode(recoveryCodeInput);
    if (!isValidRecoveryCodeFormat(normalized)) {
      setMfaErrorMsg("Please enter a valid 12-character recovery code (e.g. 2345-6789-ABCD).");
      return;
    }

    const targetUserId = user?.id || session?.user?.id;
    if (!targetUserId) {
      setMfaErrorMsg("Session expired. Please sign in again.");
      return;
    }

    setMfaErrorMsg(null);
    setIsVerifying(true);

    try {
      const result = await adminClient.verifyAndRedeemRecoveryCode(targetUserId, normalized);
      // Immediately clear in-memory code input to prevent credential exposure
      setRecoveryCodeInput("");

      if (!result.success || !result.data || !result.data.success) {
        const rawMsg = result.error || result.data?.error || "Invalid or already redeemed recovery code.";
        setMfaErrorMsg(sanitizeErrorMessage(rawMsg));
        setIsVerifying(false);
        return;
      }

      // Refresh MFA state and profile so the auth context reflects:
      // 1. Authenticator factor was deleted (isMfaEnrolled = false, isMfaRequired = false)
      // 2. Admin profile is active but quarantined (mfaRecoveryPending = true)
      try {
        await checkMfaState();
        await refreshProfile();
      } catch {
        // Non-blocking in mock or network-disconnected environments
      }

      // Successful single-use code redemption leads to restricted recovery state
      // Account is now in quarantine (mfaRecoveryPending = true) and requires replacement TOTP enrollment
      setViewMode("recovery_restricted");
    } catch (err) {
      setRecoveryCodeInput("");
      const rawMsg = err instanceof Error ? err.message : "Recovery verification failed.";
      setMfaErrorMsg(sanitizeErrorMessage(rawMsg));
    } finally {
      setIsVerifying(false);
    }
  }

  /**
   * Safe cancellation from challenge state back to credentials state:
   * Wipes any partial AAL1 session so no stale credentials or bypass is possible.
   */
  const handleBackToSignIn = async () => {
    setIsSubmitting(true);
    setMfaErrorMsg(null);
    setDigits(["", "", "", "", "", ""]);
    setRecoveryCodeInput("");
    setChallengeMethod("totp");
    try {
      await signOut();
    } catch {
      // Non-blocking cleanup
    } finally {
      setViewMode("credentials");
      setIsSubmitting(false);
    }
  };

  return (
    <section className="flex w-full lg:w-[44%] max-w-[460px] items-center justify-center my-auto py-2 lg:py-0">
      {/* Real Responsive Glassmorphism Login Card */}
      <div className="relative w-full overflow-hidden rounded-[20px] lg:rounded-[24px] border-[1.5px] border-[#00ff87]/50 bg-[#040e08]/85 p-5 sm:p-6 lg:p-6 xl:p-8 backdrop-blur-2xl shadow-[0_0_25px_rgba(0,255,135,0.3),0_0_60px_rgba(0,255,135,0.12),0_30px_80px_rgba(0,0,0,0.9),inset_0_0_25px_rgba(0,255,135,0.05)]">
        {/* Subtle Top-Right Amber Rim Glow from Background Environment */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#f59e0b]/20 blur-2xl"
        />

        {/* Top Border Green Highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[1px] w-[50%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#00ff87]/60 to-transparent"
        />

        {/* VIEW 1: TWO-FACTOR AUTHENTICATION CHALLENGE VIEW */}
        {viewMode === "mfa_challenge" ? (
          challengeMethod === "totp" ? (
            <div className="flex flex-col items-center text-center">
              {/* Top Centered Circular Key Icon Container */}
              <div className="mb-3 sm:mb-4 flex size-14 sm:size-16 items-center justify-center rounded-full bg-[#00ff87]/10 border border-[#00ff87]/30 text-[#00ff87] shadow-[0_0_20px_rgba(0,255,135,0.2)]">
                <Key className="size-6 sm:size-7 text-[#00ff87]" />
              </div>

              {/* Prominent Centered Heading */}
              <h2 className="font-sans text-[20px] sm:text-[22px] xl:text-[24px] font-bold leading-tight tracking-tight text-white">
                Enter Two-Factor <span className="text-[#00ff87]">Code</span>
              </h2>

              {/* Concise Centered Description */}
              <p className="mt-2 font-sans text-[12px] sm:text-[12.5px] xl:text-[13px] font-normal leading-relaxed text-[#94a3b8] max-w-[340px]">
                Please enter the 6-digit verification code generated by your authenticator app.
              </p>

              {/* MFA Form */}
              <form className="mt-4 sm:mt-5 flex w-full flex-col gap-3" onSubmit={submitMfaChallenge}>
                {/* 6-Digit Security Code Label */}
                <div id="otp-label" className="font-sans text-[12.5px] sm:text-[13px] font-semibold text-[#f1f5f9]">
                  6-Digit Security Code
                </div>

                {/* Six Individual Digit Boxes with Subtle Separator */}
                <div
                  role="group"
                  aria-label="6-Digit Security Code"
                  className="mt-1 flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  {digits.map((digit, index) => (
                    <Fragment key={index}>
                      <input
                        ref={(el) => {
                          inputRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        disabled={isVerifying}
                        aria-label={`Digit ${index + 1} of 6`}
                        aria-describedby="otp-label"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleDigitChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        className={`h-11 w-9.5 sm:h-13 sm:w-11 xl:h-14 xl:w-12 rounded-[10px] sm:rounded-[12px] border text-center font-mono text-[18px] sm:text-[20px] font-bold text-white transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] focus:outline-none focus:ring-2 focus:ring-[#00ff87]/40 disabled:opacity-50 disabled:cursor-not-allowed ${
                          digit
                            ? "border-[#00ff87]/60 bg-[#00ff87]/5"
                            : "border-[#00ff87]/25 bg-[#020905]/80"
                        } focus:border-[#00ff87] focus:shadow-[0_0_15px_rgba(0,255,135,0.4)]`}
                      />
                      {index === 2 && (
                        <span
                          aria-hidden="true"
                          className="text-[#94a3b8]/50 font-bold text-base sm:text-lg select-none px-1 sm:px-1.5 self-center"
                        >
                          -
                        </span>
                      )}
                    </Fragment>
                  ))}
                </div>

                {/* Verify & Continue Button */}
                <button
                  type="submit"
                  disabled={isVerifying || totpCode.length !== 6}
                  className="mt-2 flex h-[42px] xl:h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] text-[14.5px] sm:text-[15.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(0,255,135,0.5)] hover:shadow-[0_0_30px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify &amp; Continue</span>
                      <ArrowRight className="size-4 stroke-[2.5]" />
                    </>
                  )}
                </button>

                {/* Inline Sanitized Error */}
                {mfaErrorMsg && (
                  <div
                    role="alert"
                    className="mt-1 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/20 p-2.5 text-left text-[12px] text-red-400"
                  >
                    <AlertCircle className="size-4 shrink-0 text-red-400" />
                    <span>{mfaErrorMsg}</span>
                  </div>
                )}

                {/* AAL2 Security Notice */}
                <div className="mt-1.5 flex items-center justify-center gap-2 text-center text-[12px] sm:text-[12.5px] text-[#94a3b8]">
                  <ShieldCheck className="size-4 text-[#00ff87] shrink-0" />
                  <span>Session elevation to AAL2 required for Admin Access</span>
                </div>

                {/* Clear Alternative: Use Recovery Code */}
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setChallengeMethod("recovery_code");
                      setMfaErrorMsg(null);
                      setRecoveryCodeInput("");
                    }}
                    disabled={isVerifying}
                    className="font-sans text-[12px] font-medium text-[#00ff87] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    Lost access to your authenticator? Use a recovery code
                  </button>
                </div>

                {/* Bottom-Aligned Sign out and return to Login Action */}
                <div className="mt-3 pt-3 border-t border-white/5 text-center">
                  <button
                    type="button"
                    onClick={handleBackToSignIn}
                    disabled={isVerifying}
                    className="inline-flex items-center gap-2 font-sans text-[12.5px] font-medium text-[#94a3b8] hover:text-[#00ff87] transition-colors cursor-pointer disabled:opacity-50"
                    aria-label="Sign out and return to Login"
                  >
                    <LogOut className="size-3.5" />
                    <span>Sign out and return to Login</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* CHALLENGE METHOD: RECOVERY CODE VIEW */
            <div className="flex flex-col items-center text-center">
              {/* Top Centered Circular KeyRound Icon Container */}
              <div className="mb-3 sm:mb-4 flex size-14 sm:size-16 items-center justify-center rounded-full bg-[#00ff87]/10 border border-[#00ff87]/30 text-[#00ff87] shadow-[0_0_20px_rgba(0,255,135,0.2)]">
                <KeyRound className="size-6 sm:size-7 text-[#00ff87]" />
              </div>

              {/* Prominent Centered Heading */}
              <h2 className="font-sans text-[20px] sm:text-[22px] xl:text-[24px] font-bold leading-tight tracking-tight text-white">
                Enter Recovery <span className="text-[#00ff87]">Code</span>
              </h2>

              {/* Concise Centered Description */}
              <p className="mt-2 font-sans text-[12px] sm:text-[12.5px] xl:text-[13px] font-normal leading-relaxed text-[#94a3b8] max-w-[340px]">
                Please enter one of your 12-character emergency recovery codes (e.g. 2345-6789-ABCD).
              </p>

              {/* Recovery Code Form */}
              <form className="mt-4 sm:mt-5 flex w-full flex-col gap-3" onSubmit={submitRecoveryCode}>
                <div>
                  <div id="recovery-code-label" className="font-sans text-[12.5px] sm:text-[13px] font-semibold text-[#f1f5f9]">
                    12-Character Recovery Code
                  </div>
                  <div className="relative mt-1">
                    <input
                      ref={recoveryInputRef}
                      id="recovery-code-input"
                      name="recoveryCode"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="XXXX-XXXX-XXXX"
                      value={recoveryCodeInput}
                      disabled={isVerifying}
                      aria-labelledby="recovery-code-label"
                      onChange={(e) => {
                        const formatted = formatRecoveryCodeInput(e.target.value);
                        setRecoveryCodeInput(formatted);
                        setMfaErrorMsg(null);
                      }}
                      className="h-11 sm:h-12 w-full rounded-[10px] border border-[#00ff87]/25 bg-[#020905]/80 px-4 text-center font-mono text-[16px] sm:text-[18px] font-bold tracking-widest text-white placeholder:text-[#64748b] focus:border-[#00ff87] focus:outline-none focus:ring-2 focus:ring-[#00ff87]/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Redeem & Recover Button */}
                <button
                  type="submit"
                  disabled={isVerifying || normalizeRecoveryCode(recoveryCodeInput).length !== 12}
                  className="mt-2 flex h-[42px] xl:h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] text-[14.5px] sm:text-[15.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(0,255,135,0.5)] hover:shadow-[0_0_30px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Verifying Recovery Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Redeem &amp; Recover Account</span>
                      <ArrowRight className="size-4 stroke-[2.5]" />
                    </>
                  )}
                </button>

                {/* Inline Sanitized Error */}
                {mfaErrorMsg && (
                  <div
                    role="alert"
                    className="mt-1 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/20 p-2.5 text-left text-[12px] text-red-400"
                  >
                    <AlertCircle className="size-4 shrink-0 text-red-400" />
                    <span>{mfaErrorMsg}</span>
                  </div>
                )}

                {/* Quarantine Notice */}
                <div className="mt-1.5 flex items-center justify-center gap-2 text-center text-[12px] sm:text-[12.5px] text-amber-400/90">
                  <ShieldAlert className="size-4 text-amber-400 shrink-0" />
                  <span>Redemption initiates account quarantine &amp; MFA re-enrollment</span>
                </div>

                {/* Switch back to 6-digit TOTP */}
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setChallengeMethod("totp");
                      setMfaErrorMsg(null);
                      setDigits(["", "", "", "", "", ""]);
                    }}
                    disabled={isVerifying}
                    className="font-sans text-[12px] font-medium text-[#00ff87] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    Back to 6-digit verification code
                  </button>
                </div>

                {/* Bottom-Aligned Sign out and return to Login Action */}
                <div className="mt-3 pt-3 border-t border-white/5 text-center">
                  <button
                    type="button"
                    onClick={handleBackToSignIn}
                    disabled={isVerifying}
                    className="inline-flex items-center gap-2 font-sans text-[12.5px] font-medium text-[#94a3b8] hover:text-[#00ff87] transition-colors cursor-pointer disabled:opacity-50"
                    aria-label="Sign out and return to Login"
                  >
                    <LogOut className="size-3.5" />
                    <span>Sign out and return to Login</span>
                  </button>
                </div>
              </form>
            </div>
          )
        ) : viewMode === "recovery_restricted" ? (
          /* VIEW 1B: RESTRICTED RECOVERY STATE */
          <div className="flex flex-col items-center text-center">
            {/* Top Centered Circular ShieldAlert Icon Container */}
            <div className="mb-3 sm:mb-4 flex size-14 sm:size-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <ShieldAlert className="size-6 sm:size-7 text-amber-400" />
            </div>

            {/* Prominent Centered Heading */}
            <h2 className="font-sans text-[20px] sm:text-[22px] xl:text-[24px] font-bold leading-tight tracking-tight text-white">
              Account in <span className="text-amber-400">Restricted Recovery</span>
            </h2>

            {/* Concise Centered Description */}
            <p className="mt-2 font-sans text-[12px] sm:text-[12.5px] xl:text-[13px] font-normal leading-relaxed text-[#94a3b8] max-w-[340px]">
              Your recovery code was accepted and your lost authenticator factor has been deactivated.
              You must now configure and verify a replacement authenticator before normal administrative access is restored.
            </p>

            <div className="mt-5 flex w-full flex-col gap-3">
              <button
                type="button"
                onClick={() => navigate({ to: "/admin/mfa-recovery" })}
                className="flex h-[42px] xl:h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-amber-500 to-amber-600 text-[14.5px] sm:text-[15.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
              >
                <span>Proceed to MFA Re-Enrollment</span>
                <ArrowRight className="size-4 stroke-[2.5]" />
              </button>

              <div className="mt-2 pt-3 border-t border-white/5 text-center">
                <button
                  type="button"
                  onClick={handleBackToSignIn}
                  className="inline-flex items-center gap-2 font-sans text-[12.5px] font-medium text-[#94a3b8] hover:text-[#00ff87] transition-colors cursor-pointer"
                  aria-label="Sign out and return to Login"
                >
                  <LogOut className="size-3.5" />
                  <span>Sign out and return to Login</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: CREDENTIALS (EMAIL / PASSWORD) VIEW */
          <>
            {/* Welcome Back Header */}
            <p className="font-sans text-[10.5px] sm:text-[11px] font-semibold tracking-[0.32em] text-[#00ff87] uppercase">
              WELCOME BACK
            </p>
            <div className="mt-1.5 mb-2.5 h-[2px] w-5 rounded-full bg-[#00ff87]" />

            <h2 className="font-sans text-[24px] sm:text-[26px] xl:text-[28px] font-bold leading-none tracking-tight text-white">
              Sign In
            </h2>
            <p className="mt-0.5 font-sans text-[15px] sm:text-[16px] xl:text-[17px] font-normal leading-normal text-[#e2e8f0]">
              to Admin Portal
            </p>
            <p className="mt-1.5 font-sans text-[12px] sm:text-[12.5px] xl:text-[13px] font-normal leading-relaxed text-[#94a3b8]">
              Access your CobraLearn showcase dashboard
              <br />
              and manage your content.
            </p>

            {/* Form */}
            <form className="mt-3.5 sm:mt-4 xl:mt-5 flex flex-col gap-2.5 sm:gap-3" onSubmit={submitCredentials}>
              {/* Email Address */}
              <div>
                <Label htmlFor="email" className="font-sans text-[12.5px] sm:text-[13px] font-medium text-[#f1f5f9]">
                  Email Address
                </Label>
                <div className="relative mt-1 flex items-center">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 z-10 size-[16px] -translate-y-1/2 text-[#00ff87]"
                  />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email"
                    required
                    className="h-[40px] xl:h-[44px] w-full rounded-[10px] border border-[#00ff87]/25 bg-[#020905]/80 pl-10 text-[13px] text-white placeholder:text-[#64748b] focus-visible:border-[#00ff87] focus-visible:ring-1 focus-visible:ring-[#00ff87]/40 focus-visible:ring-offset-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password" className="font-sans text-[12.5px] sm:text-[13px] font-medium text-[#f1f5f9]">
                  Password
                </Label>
                <div className="mt-1">
                  <PasswordInput />
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="text-right -mt-1">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/admin/forgot-password" })}
                  className="font-sans text-[11.5px] sm:text-[12px] font-medium text-[#00ff87] hover:text-[#4ade80] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {/* Sign In Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || cooldownSeconds > 0}
                className="mt-0.5 flex h-[42px] xl:h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] text-[14.5px] sm:text-[15.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(0,255,135,0.5)] hover:shadow-[0_0_30px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Signing In..." : <>Sign In <ArrowRight className="size-4 stroke-[2.5]" /></>}
              </button>

              {message && (
                <p role="status" className="mt-0.5 text-center text-[11.5px] text-red-400">
                  {message}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </section>
  );
}