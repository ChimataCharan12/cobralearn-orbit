import { ArrowLeft, ArrowRight, Home, LockKeyhole } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export function AccessDeniedCard() {
  const navigate = useNavigate();

  return (
    <section className="flex w-full lg:w-[44%] max-w-[460px] items-center justify-center my-auto py-2 lg:py-0">
      {/* Real Responsive Glassmorphism Access Denied Card */}
      <div className="relative w-full overflow-hidden rounded-[20px] lg:rounded-[24px] border-[1.5px] border-[#00ff87]/50 bg-[#040e08]/85 p-6 sm:p-8 xl:p-10 backdrop-blur-2xl text-center shadow-[0_0_25px_rgba(0,255,135,0.3),0_0_60px_rgba(0,255,135,0.12),0_30px_80px_rgba(0,0,0,0.9),inset_0_0_25px_rgba(0,255,135,0.05)]">
        {/* Red Rim Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#ef4444]/25 blur-2xl"
        />

        {/* Top Border Red Highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[1px] w-[50%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#ef4444]/60 to-transparent"
        />

        {/* Circular Glowing Red Lock Icon */}
        <div className="mx-auto flex size-20 sm:size-24 items-center justify-center rounded-full border border-[#ef4444]/35 bg-[#ef4444]/5 shadow-[0_0_35px_rgba(239,68,68,0.25)]">
          <div className="flex size-14 sm:size-16 items-center justify-center rounded-full border border-[#ef4444]/60 bg-[#ef4444]/15 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
            <LockKeyhole className="size-7 sm:size-8 text-[#ef4444] stroke-[2.5]" />
          </div>
        </div>

        {/* Title */}
        <h2 className="mt-5 sm:mt-6 font-sans text-[24px] sm:text-[26px] xl:text-[28px] font-bold leading-none tracking-tight text-white">
          Access <span className="text-[#ef4444] drop-shadow-[0_0_12px_rgba(239,68,68,0.45)]">Denied</span>
        </h2>
        <p className="mx-auto mt-2 max-w-[340px] font-sans text-[12.5px] sm:text-[13px] xl:text-[13.5px] font-normal leading-relaxed text-[#94a3b8]">
          You don't have permission to access this area. Please contact an administrator if you believe this is a mistake.
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          {/* Primary Action: Back to Dashboard */}
          <button
            type="button"
            onClick={() => navigate({ to: "/admin/dashboard" })}
            className="flex h-[42px] xl:h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] text-[14.5px] sm:text-[15.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(0,255,135,0.5)] hover:shadow-[0_0_30px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
          >
            <ArrowLeft className="size-4 stroke-[2.5]" />
            <span>Back to Dashboard</span>
            <ArrowRight className="size-4 stroke-[2.5]" />
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
