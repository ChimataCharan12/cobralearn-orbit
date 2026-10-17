import { Check, LogIn, ShieldCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { authService } from "@/lib/auth/auth-service";

export function PasswordUpdatedCard() {
  const navigate = useNavigate();

  // Ensure recovery session is cleared
  useEffect(() => {
    authService.signOut().catch(() => {});
  }, []);

  const handleReturnToLogin = async () => {
    try {
      await authService.signOut();
    } catch {
      // Non-fatal
    }
    navigate({ to: "/admin" });
  };

  return (
    <section className="flex w-full lg:w-[44%] max-w-[460px] items-center justify-center my-auto py-2 lg:py-0">
      {/* Real Responsive Glassmorphism Success Card */}
      <div className="relative w-full overflow-hidden rounded-[20px] lg:rounded-[24px] border-[1.5px] border-[#00ff87]/50 bg-[#040e08]/85 p-6 sm:p-8 xl:p-10 backdrop-blur-2xl text-center shadow-[0_0_25px_rgba(0,255,135,0.3),0_0_60px_rgba(0,255,135,0.12),0_30px_80px_rgba(0,0,0,0.9),inset_0_0_25px_rgba(0,255,135,0.05)]">
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

        {/* Circular Glowing Success Icon */}
        <div className="mx-auto flex size-20 sm:size-24 items-center justify-center rounded-full border border-[#00ff87]/30 bg-[#00ff87]/5 shadow-[0_0_35px_rgba(0,255,135,0.25)]">
          <div className="flex size-14 sm:size-16 items-center justify-center rounded-full border border-[#00ff87]/60 bg-[#00ff87]/15 shadow-[0_0_20px_rgba(0,255,135,0.4)]">
            <Check className="size-7 sm:size-8 text-[#00ff87] stroke-[3]" />
          </div>
        </div>

        {/* Title */}
        <h2 className="mt-5 sm:mt-6 font-sans text-[24px] sm:text-[26px] xl:text-[28px] font-bold leading-none tracking-tight text-white">
          Password <span className="text-[#00ff87] drop-shadow-[0_0_12px_rgba(0,255,135,0.4)]">Updated!</span>
        </h2>
        <p className="mt-2 font-sans text-[12.5px] sm:text-[13px] xl:text-[13.5px] font-normal leading-relaxed text-[#94a3b8]">
          Your admin password has been successfully updated.
        </p>

        {/* Security Info Card */}
        <div className="mt-5 sm:mt-6 flex items-start gap-2.5 rounded-[10px] border border-[#00ff87]/20 bg-[#00ff87]/5 p-3 text-left">
          <ShieldCheck className="size-4 shrink-0 text-[#00ff87] mt-0.5" />
          <p className="font-sans text-[11.5px] sm:text-[12px] text-[#cbd5e1] leading-snug">
            You can now sign in to your admin account using your new password and complete your authenticator challenge.
          </p>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          onClick={handleReturnToLogin}
          className="mt-5 sm:mt-6 flex h-[42px] xl:h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] text-[14.5px] sm:text-[15.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(0,255,135,0.5)] hover:shadow-[0_0_30px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
        >
          <LogIn className="size-4 stroke-[2.5]" />
          <span>Go to Admin Login &rarr;</span>
        </button>
      </div>
    </section>
  );
}
