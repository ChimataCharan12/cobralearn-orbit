import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/lib/auth/auth-service";

export function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Dynamic or active validation checking
  const hasMinLength = newPassword.length >= 8;
  const hasUpperLower = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

  const passedCount = [hasMinLength, hasUpperLower, hasNumber, hasSpecial].filter(Boolean).length;
  // If user hasn't typed yet, default visual display matches mockup (or adapts dynamically)
  const displayScore = newPassword ? passedCount : 4;
  const strengthText = newPassword.length === 0 ? "Strong" : passedCount <= 1 ? "Weak" : passedCount <= 3 ? "Medium" : "Strong";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const result = await authService.updatePassword(newPassword);
      if (result.error) {
        setError(result.error.message || "Failed to reset password.");
        setIsSubmitting(false);
      } else {
        navigate({ to: "/admin/password-updated" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
      setIsSubmitting(false);
    }
  }

  return (
    <section className="flex w-full lg:w-[44%] max-w-[460px] items-center justify-center my-auto py-2 lg:py-0">
      {/* Real Responsive Glassmorphism Reset Password Card */}
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

        {/* Title */}
        <h2 className="font-sans text-[24px] sm:text-[26px] xl:text-[28px] font-bold leading-none tracking-tight text-white">
          Reset <span className="text-[#00ff87] drop-shadow-[0_0_12px_rgba(0,255,135,0.4)]">Password</span>
        </h2>
        <p className="mt-1.5 font-sans text-[12px] sm:text-[12.5px] xl:text-[13px] font-normal leading-relaxed text-[#94a3b8]">
          Enter your new password below to complete the reset process.
        </p>

        {/* Form */}
        <form className="mt-3.5 sm:mt-4 xl:mt-5 flex flex-col gap-2.5 sm:gap-3" onSubmit={handleSubmit}>
          {/* New Password */}
          <div>
            <Label htmlFor="new-password" className="font-sans text-[12.5px] sm:text-[13px] font-medium text-[#f1f5f9]">
              New Password
            </Label>
            <div className="relative mt-1 flex items-center">
              <LockKeyhole
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-[16px] -translate-y-1/2 text-[#00ff87]"
              />
              <Input
                id="new-password"
                name="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password"
                required
                className="h-[40px] xl:h-[44px] w-full rounded-[10px] border border-[#00ff87]/25 bg-[#020905]/80 pl-10 pr-10 text-[13px] text-white placeholder:text-[#64748b] focus-visible:border-[#00ff87] focus-visible:ring-1 focus-visible:ring-[#00ff87]/40 focus-visible:ring-offset-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] transition-colors hover:text-white cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Password Strength Indicator */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-1.5">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    step <= displayScore
                      ? "bg-[#00ff87] shadow-[0_0_8px_rgba(0,255,135,0.7)]"
                      : "bg-[#1e293b]"
                  }`}
                />
              ))}
            </div>
            <span className="font-sans text-[11px] sm:text-[11.5px] text-[#94a3b8] whitespace-nowrap">
              Password strength:{" "}
              <span className="text-[#00ff87] font-semibold">{strengthText}</span>
            </span>
          </div>

          {/* Password Requirement Checklist */}
          <div className="space-y-1 rounded-[8px] py-1">
            <div className="flex items-center gap-2 font-sans text-[11px] sm:text-[11.5px] text-[#cbd5e1]">
              <CheckCircle2
                className={`size-3.5 shrink-0 ${
                  !newPassword || hasMinLength ? "text-[#00ff87]" : "text-[#64748b]"
                }`}
              />
              <span>At least 8 characters</span>
            </div>
            <div className="flex items-center gap-2 font-sans text-[11px] sm:text-[11.5px] text-[#cbd5e1]">
              <CheckCircle2
                className={`size-3.5 shrink-0 ${
                  !newPassword || hasUpperLower ? "text-[#00ff87]" : "text-[#64748b]"
                }`}
              />
              <span>Include uppercase and lowercase letters</span>
            </div>
            <div className="flex items-center gap-2 font-sans text-[11px] sm:text-[11.5px] text-[#cbd5e1]">
              <CheckCircle2
                className={`size-3.5 shrink-0 ${
                  !newPassword || hasNumber ? "text-[#00ff87]" : "text-[#64748b]"
                }`}
              />
              <span>Include a number</span>
            </div>
            <div className="flex items-center gap-2 font-sans text-[11px] sm:text-[11.5px] text-[#cbd5e1]">
              <CheckCircle2
                className={`size-3.5 shrink-0 ${
                  !newPassword || hasSpecial ? "text-[#00ff87]" : "text-[#64748b]"
                }`}
              />
              <span>Include a special character</span>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <Label htmlFor="confirm-password" className="font-sans text-[12.5px] sm:text-[13px] font-medium text-[#f1f5f9]">
              Confirm New Password
            </Label>
            <div className="relative mt-1 flex items-center">
              <LockKeyhole
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-[16px] -translate-y-1/2 text-[#00ff87]"
              />
              <Input
                id="confirm-password"
                name="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                placeholder="Confirm your new password"
                required
                className="h-[40px] xl:h-[44px] w-full rounded-[10px] border border-[#00ff87]/25 bg-[#020905]/80 pl-10 pr-10 text-[13px] text-white placeholder:text-[#64748b] focus-visible:border-[#00ff87] focus-visible:ring-1 focus-visible:ring-[#00ff87]/40 focus-visible:ring-offset-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] transition-colors hover:text-white cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-[11.5px] text-red-400">
              {error}
            </p>
          )}

          {/* Reset Password Submit Button */}
          <button
            type="submit"
            className="mt-1 flex h-[42px] xl:h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] text-[14.5px] sm:text-[15.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(0,255,135,0.5)] hover:shadow-[0_0_30px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
          >
            <ShieldCheck className="size-4 stroke-[2.5]" />
            <span>Reset Password &rarr;</span>
          </button>
        </form>
      </div>
    </section>
  );
}
