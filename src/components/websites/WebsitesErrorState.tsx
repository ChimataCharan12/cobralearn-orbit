import { AlertTriangle, ArrowLeft, Info, RotateCw } from "lucide-react";
import environment from "@/assets/cobralearn-admin-environment.jpg";
import emblem from "@/assets/cobralearn-emblem.png";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

export function WebsitesErrorState({
  onRetry,
  onGoBack,
}: {
  onRetry: () => void;
  onGoBack: () => void;
}) {
  const { t } = useAdminAppearance();

  return (
    <div className="relative min-h-[500px] w-full overflow-hidden rounded-[18px] border border-[#ef4444]/35 bg-[#040806]/85 backdrop-blur-xl p-6 sm:p-10 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(239,68,68,0.15),0_20px_60px_rgba(0,0,0,0.8),inset_0_0_30px_rgba(239,68,68,0.04)]">
      {/* Background with Crimson Red Hue */}
      <img
        src={environment}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-40 mix-blend-luminosity filter saturate-50"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#180305]/80 via-[#0a0203]/70 to-[#040806]/90" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-80 rounded-full bg-[#ef4444]/15 blur-3xl"
      />

      {/* Center 3D Emblem with Red Warning Aura */}
      <div className="relative z-10 mb-4 flex flex-col items-center">
        <div className="relative flex justify-center">
          <img
            src={emblem}
            alt="CobraLearn Emblem"
            className="emblem-float size-28 sm:size-36 object-contain opacity-75 filter drop-shadow-[0_0_30px_rgba(239,68,68,0.7)] drop-shadow-[0_0_60px_rgba(239,68,68,0.3)]"
          />
          {/* Warning Icon Badge */}
          <div className="absolute -bottom-2 flex size-11 items-center justify-center rounded-full border border-[#ef4444]/70 bg-[#1c0507] shadow-[0_0_20px_rgba(239,68,68,0.8)]">
            <AlertTriangle className="size-6 text-[#ef4444] stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Heading & Subtitle */}
      <div className="relative z-10 space-y-1 mt-2">
        <h3 className="font-sans text-[24px] sm:text-[26px] font-bold tracking-tight text-white">
          {t("error.somethingWentWrong")}
        </h3>
        <p className="font-sans text-[13px] sm:text-[13.5px] text-[#cbd5e1]">
          {t("error.failedToLoad")}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-3">
        {/* Primary Try Again Button */}
        <button
          type="button"
          onClick={onRetry}
          className="flex h-[38px] items-center justify-center gap-2 rounded-[9px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] px-5 text-[13px] font-bold text-[#02180c] shadow-[0_0_20px_rgba(0,255,135,0.5)] hover:shadow-[0_0_28px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
        >
          <RotateCw className="size-3.5 stroke-[2.5]" />
          <span>{t("error.tryAgain")}</span>
        </button>

        {/* Secondary Go Back Button */}
        <button
          type="button"
          onClick={onGoBack}
          className="flex h-[38px] items-center justify-center gap-2 rounded-[9px] border border-[#00ff87]/30 bg-[#020905]/70 px-5 text-[12.5px] font-medium text-[#e2e8f0] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:border-[#00ff87]/50 hover:bg-[#00ff87]/10 transition-all cursor-pointer"
        >
          <ArrowLeft className="size-3.5 text-[#00ff87]" />
          <span>{t("error.goBack")}</span>
        </button>
      </div>

      {/* Bottom Informational Callout */}
      <div className="relative z-10 mt-6 flex items-center gap-2 rounded-[8px] border border-[#00ff87]/20 bg-[#020905]/80 px-4 py-2 text-[11.5px] text-[#94a3b8]">
        <Info className="size-3.5 text-[#00ff87] shrink-0" />
        <span>If the problem persists, please contact the administrator.</span>
      </div>
    </div>
  );
}
