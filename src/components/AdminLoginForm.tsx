import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";

import { PasswordInput } from "@/components/PasswordInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/use-auth";
import { adminClient } from "@/lib/api/admin-client";

/**
 * Formats a duration in seconds to MM:SS string.
 */
export function formatMMSS(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AdminLoginForm() {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownEmail, setCooldownEmail] = useState("");
  const navigate = useNavigate();
  const { signIn } = useAuth();

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

  async function submit(event: FormEvent<HTMLFormElement>) {
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
        <form className="mt-3.5 sm:mt-4 xl:mt-5 flex flex-col gap-2.5 sm:gap-3" onSubmit={submit}>
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

          {/* Divider */}
          <div className="my-0.5 flex items-center gap-2.5">
            <div className="h-px flex-1 bg-white/10" />
            <span className="font-sans text-[9.5px] sm:text-[10px] font-semibold tracking-[0.14em] text-[#64748b]">
              OR CONTINUE WITH
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* SSO Button */}
          <button
            type="button"
            className="flex h-[38px] xl:h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#00ff87]/25 bg-[#020905]/65 text-[12px] sm:text-[12.5px] font-medium text-[#e2e8f0] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:border-[#00ff87]/45 hover:bg-[#00ff87]/10 transition-all cursor-pointer"
          >
            <ShieldCheck className="size-3.5 text-[#00ff87]" />
            Sign in with SSO (Admin Only)
          </button>

          {message && (
            <p role="status" className="mt-0.5 text-center text-[11.5px] text-red-400">
              {message}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}