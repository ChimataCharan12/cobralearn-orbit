import { ArrowLeft, ArrowRight, CheckCircle2, Info, Mail, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminClient } from "@/lib/api/admin-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await adminClient.requestPasswordReset(email);
    } catch {
      // Return generic confirmation even on non-network errors to maintain indistinguishable anti-enumeration
    } finally {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }
  }

  return (
    <section className="flex w-full lg:w-[44%] max-w-[460px] items-center justify-center my-auto py-2 lg:py-0">
      {/* Real Responsive Glassmorphism Forgot Password Card */}
      <div className="relative w-full overflow-hidden rounded-[20px] lg:rounded-[24px] border-[1.5px] border-[#00ff87]/50 bg-[#040e08]/85 p-5 sm:p-6 lg:p-6 xl:p-8 backdrop-blur-2xl shadow-[0_0_25px_rgba(0,255,135,0.3),0_0_60px_rgba(0,255,135,0.12),0_30px_80px_rgba(0,0,0,0.9),inset_0_0_25px_rgba(0,255,135,0.05)]">
        {/* Subtle Top-Right Amber Rim Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#f59e0b]/20 blur-2xl"
        />

        {/* Top Border Green Highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[1px] w-[50%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#00ff87]/60 to-transparent"
        />

        {/* Back to Login Header */}
        <button
          type="button"
          onClick={() => navigate({ to: "/admin" })}
          className="group inline-flex items-center gap-1.5 font-sans text-[11px] sm:text-[11.5px] font-semibold tracking-wide text-[#00ff87] hover:text-[#4ade80] transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5 text-[#00ff87]" />
          Back to Login
        </button>
        <div className="mt-2.5 mb-2.5 h-[2px] w-5 rounded-full bg-[#00ff87] shadow-[0_0_8px_rgba(0,255,135,0.8)]" />

        {isSubmitted ? (
          /* In-Place Generic Success Confirmation */
          <div className="mt-2 text-left space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full border border-[#00ff87]/40 bg-[#00ff87]/10 shadow-[0_0_15px_rgba(0,255,135,0.3)]">
                <CheckCircle2 className="size-5 text-[#00ff87]" />
              </div>
              <div>
                <h2 className="font-sans text-[22px] sm:text-[24px] font-bold leading-none tracking-tight text-white">
                  Check Your <span className="text-[#00ff87]">Email</span>
                </h2>
                <p className="mt-1 font-sans text-[11.5px] text-[#94a3b8]">
                  Password reset instructions dispatched
                </p>
              </div>
            </div>

            <p className="font-sans text-[12.5px] sm:text-[13px] font-normal leading-relaxed text-[#cbd5e1]">
              If an account is associated with this email address, a secure password reset link has been dispatched. Please check your inbox and follow the instructions in the email.
            </p>

            <div className="flex items-start gap-2.5 rounded-[10px] border border-[#00ff87]/20 bg-[#00ff87]/5 p-3 text-left">
              <Info className="size-4 shrink-0 text-[#00ff87] mt-0.5" />
              <p className="font-sans text-[11px] sm:text-[11.5px] text-[#94a3b8] leading-tight">
                For security reasons, the link will expire in 1 hour. If you do not see the email, please check your spam or junk folder.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => navigate({ to: "/admin" })}
                className="flex h-[42px] xl:h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] text-[14.5px] sm:text-[15.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(0,255,135,0.5)] hover:shadow-[0_0_30px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
              >
                <ShieldCheck className="size-4 stroke-[2.5]" />
                <span>Return to Admin Login &rarr;</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail("");
                }}
                className="flex h-[36px] w-full items-center justify-center gap-2 rounded-[9px] border border-white/10 bg-transparent text-[11.5px] text-[#94a3b8] hover:text-white hover:border-white/20 transition-all cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>Try another email address</span>
              </button>
            </div>
          </div>
        ) : (
          /* Password Reset Request Form */
          <>
            {/* Title */}
            <h2 className="font-sans text-[24px] sm:text-[26px] xl:text-[28px] font-bold leading-none tracking-tight text-white">
              Forgot <span className="text-[#00ff87] drop-shadow-[0_0_12px_rgba(0,255,135,0.4)]">Password?</span>
            </h2>
            <p className="mt-1.5 font-sans text-[12px] sm:text-[12.5px] xl:text-[13px] font-normal leading-relaxed text-[#94a3b8]">
              No worries! Enter your admin email address and we'll send you a link to reset your password.
            </p>

            {/* Form */}
            <form className="mt-3.5 sm:mt-4 xl:mt-5 flex flex-col gap-2.5 sm:gap-3" onSubmit={handleSubmit}>
              {/* Admin Email Address */}
              <div>
                <Label htmlFor="admin-email" className="font-sans text-[12.5px] sm:text-[13px] font-medium text-[#f1f5f9]">
                  Admin Email Address
                </Label>
                <div className="relative mt-1 flex items-center">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 z-10 size-[16px] -translate-y-1/2 text-[#00ff87]"
                  />
                  <Input
                    id="admin-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your admin email address"
                    required
                    className="h-[40px] xl:h-[44px] w-full rounded-[10px] border border-[#00ff87]/25 bg-[#020905]/80 pl-10 text-[13px] text-white placeholder:text-[#64748b] focus-visible:border-[#00ff87] focus-visible:ring-1 focus-visible:ring-[#00ff87]/40 focus-visible:ring-offset-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
                  />
                </div>
                <p className="mt-1 font-sans text-[11px] sm:text-[11.5px] text-[#64748b]">
                  Example: admin@cobralearn.in
                </p>
              </div>

              {/* Send Reset Link Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 flex h-[42px] xl:h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] text-[14.5px] sm:text-[15.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(0,255,135,0.5)] hover:shadow-[0_0_30px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-80"
              >
                <Send className="size-4 -rotate-12 stroke-[2.5]" />
                <span>{isSubmitting ? "Sending..." : "Send Reset Link \u2192"}</span>
              </button>

              {/* Divider */}
              <div className="my-0.5 flex items-center gap-2.5">
                <div className="h-px flex-1 bg-white/10" />
                <span className="font-sans text-[9.5px] sm:text-[10px] font-semibold tracking-[0.14em] text-[#64748b]">
                  OR
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Secondary Button: Back to Admin Login */}
              <button
                type="button"
                onClick={() => navigate({ to: "/admin" })}
                className="flex h-[38px] xl:h-[42px] w-full items-center justify-between px-3.5 rounded-[10px] border border-[#00ff87]/25 bg-[#020905]/65 text-[12px] sm:text-[12.5px] font-medium text-[#e2e8f0] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:border-[#00ff87]/45 hover:bg-[#00ff87]/10 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-[#00ff87]" />
                  Back to Admin Login
                </span>
                <ArrowRight className="size-3.5 text-[#00ff87]" />
              </button>

              {/* Informational Security Box */}
              <div className="mt-1 flex items-start gap-2.5 rounded-[10px] border border-[#00ff87]/20 bg-[#00ff87]/5 p-2.5 sm:p-3 text-left">
                <Info className="size-4 shrink-0 text-[#00ff87] mt-0.5" />
                <p className="font-sans text-[11px] sm:text-[11.5px] text-[#94a3b8] leading-tight">
                  We'll send a secure link to your email address. The link will expire in 1 hour for security reasons.
                </p>
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
