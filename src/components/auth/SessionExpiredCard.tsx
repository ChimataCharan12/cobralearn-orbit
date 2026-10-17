import { ArrowRight, Clock, Home, LogIn } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { safeRedirect } from "@/lib/auth/safe-redirect";

export function SessionExpiredCard() {
  const navigate = useNavigate();

  let nextParam: string | null = null;
  if (typeof window !== "undefined") {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      nextParam = urlParams.get("next");
    } catch {}
  }
  const safeNext = safeRedirect(nextParam, "");

  const handleSignInAgain = () => {
    if (
      safeNext &&
      safeNext !== "/admin" &&
      safeNext !== "/admin/" &&
      safeNext !== "/admin/login" &&
      safeNext !== "/admin/session-expired"
    ) {
      navigate({ to: "/admin", search: { next: safeNext } as any });
    } else {
      navigate({ to: "/admin" });
    }
  };

  return (
    <section className="flex w-full lg:w-[44%] max-w-[460px] items-center justify-center my-auto py-2 lg:py-0">
      {/* Real Responsive Glassmorphism Session Expired Card */}
      <div className="relative w-full overflow-hidden rounded-[20px] lg:rounded-[24px] border-[1.5px] border-[#00ff87]/50 bg-[#040e08]/85 p-6 sm:p-8 xl:p-10 backdrop-blur-2xl text-center shadow-[0_0_25px_rgba(0,255,135,0.3),0_0_60px_rgba(0,255,135,0.12),0_30px_80px_rgba(0,0,0,0.9),inset_0_0_25px_rgba(0,255,135,0.05)]">
        {/* Amber Rim Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#f59e0b]/25 blur-2xl"
        />

        {/* Top Border Amber Highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[1px] w-[50%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#f59e0b]/60 to-transparent"
        />

        {/* Circular Glowing Clock Icon */}
        <div className="mx-auto flex size-20 sm:size-24 items-center justify-center rounded-full border border-[#f59e0b]/35 bg-[#f59e0b]/5 shadow-[0_0_35px_rgba(245,158,11,0.25)]">
          <div className="flex size-14 sm:size-16 items-center justify-center rounded-full border border-[#f59e0b]/60 bg-[#f59e0b]/15 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            <Clock className="size-7 sm:size-8 text-[#fbbf24] stroke-[2.5]" />
          </div>
        </div>

        {/* Title */}
        <h2 className="mt-5 sm:mt-6 font-sans text-[24px] sm:text-[26px] xl:text-[28px] font-bold leading-none tracking-tight text-white">
          Session <span className="text-[#fbbf24] drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]">Expired</span>
        </h2>
        <p className="mx-auto mt-2 max-w-[340px] font-sans text-[12.5px] sm:text-[13px] xl:text-[13.5px] font-normal leading-relaxed text-[#94a3b8]">
          Your admin session has expired for security reasons. Please sign in again to continue.
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          {/* Primary Action: Sign In Again */}
          <button
            type="button"
            onClick={handleSignInAgain}
            className="flex h-[42px] xl:h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] text-[14.5px] sm:text-[15.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(0,255,135,0.5)] hover:shadow-[0_0_30px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
          >
            <LogIn className="size-4 stroke-[2.5]" />
            <span>Sign In Again &rarr;</span>
          </button>

          {/* Secondary Action: Return to Home */}
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="flex h-[38px] xl:h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#00ff87]/25 bg-[#020905]/65 text-[12px] sm:text-[12.5px] font-medium text-[#e2e8f0] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:border-[#00ff87]/45 hover:bg-[#00ff87]/10 transition-all cursor-pointer"
          >
            <Home className="size-3.5 text-[#00ff87]" />
            <span>Return to Home &rarr;</span>
          </button>
        </div>
      </div>
    </section>
  );
}
