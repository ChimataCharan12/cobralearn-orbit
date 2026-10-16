import { Award, Medal, Plus, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import emblem from "@/assets/cobralearn-emblem.png";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

export function AwardsEmptyState({ onAddAward }: { onAddAward: () => void }) {
  const { t } = useAdminAppearance();

  const featureCards = [
    {
      icon: Sparkles,
      title: "Recognitions",
      subtitle: "Industry Honors",
    },
    {
      icon: Trophy,
      title: "Competitions",
      subtitle: "Hackathons & Events",
    },
    {
      icon: Medal,
      title: "Certificates",
      subtitle: "Credentials & Badges",
    },
    {
      icon: ShieldCheck,
      title: "Institutional",
      subtitle: "Verified Achievements",
    },
  ];

  return (
    <div className="relative min-h-[500px] w-full overflow-hidden rounded-[18px] border border-[#00ff87]/25 bg-[#040e08]/75 backdrop-blur-xl p-6 sm:p-8 lg:p-10 flex flex-col items-center text-center justify-between shadow-[0_0_25px_rgba(0,255,135,0.1),0_20px_60px_rgba(0,0,0,0.8),inset_0_0_25px_rgba(0,255,135,0.03)]">
      {/* Top Center Glow & Artwork */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 size-60 rounded-full bg-[#00ff87]/12 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* Emblem Artwork */}
        <div className="flex justify-center">
          <img
            src={emblem}
            alt="CobraLearn Emblem"
            className="emblem-float size-28 sm:size-36 object-contain drop-shadow-[0_0_30px_rgba(0,255,135,0.7)] drop-shadow-[0_0_60px_rgba(0,255,135,0.3)]"
          />
        </div>

        {/* Heading & Descriptions */}
        <h3 className="mt-4 font-sans text-[24px] sm:text-[26px] font-bold tracking-tight text-white">
          {t("empty.noAwardsTitle")}
        </h3>
        <p className="mt-1.5 font-sans text-[13px] sm:text-[13.5px] text-[#cbd5e1]">
          {t("empty.noAwardsDesc")}
        </p>
        <p className="mt-0.5 font-sans text-[12px] sm:text-[12.5px] text-[#94a3b8]">
          {t("empty.noAwardsHelp")}
        </p>

        {/* CTA Button */}
        <button
          type="button"
          onClick={onAddAward}
          className="mt-5 flex h-[40px] items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] px-6 text-[13.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(0,255,135,0.5)] hover:shadow-[0_0_30px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
        >
          <Plus className="size-4 stroke-[3]" />
          <span>{t("empty.addAwardBtn")}</span>
        </button>
      </div>

      {/* 4 Feature Cards at Bottom */}
      <div className="relative z-10 mt-8 sm:mt-10 grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {featureCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="group flex flex-col items-center justify-center rounded-[12px] border border-[#00ff87]/20 bg-[#020905]/80 p-4 text-center backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] hover:border-[#00ff87]/45 hover:bg-[#00ff87]/10 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex size-10 items-center justify-center rounded-full border border-[#00ff87]/30 bg-[#00ff87]/10 group-hover:scale-110 group-hover:bg-[#00ff87]/20 transition-all duration-300 shadow-[0_0_12px_rgba(0,255,135,0.25)]">
                <Icon className="size-5 text-[#00ff87]" />
              </div>
              <p className="mt-2.5 font-sans text-[13.5px] font-bold text-white group-hover:text-[#00ff87] transition-colors">
                {card.title}
              </p>
              <p className="font-sans text-[11.5px] text-[#94a3b8]">
                {card.subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
