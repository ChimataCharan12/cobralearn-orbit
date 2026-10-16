import { LayoutGrid, Eye, Calendar, Plus } from "lucide-react";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

interface HomepageStatsProps {
  totalSections: number;
  status: string;
  lastUpdated: string;
  onAddSection: () => void;
}

export function HomepageStats({
  totalSections,
  status,
  lastUpdated,
  onAddSection,
}: HomepageStatsProps) {
  const { t } = useAdminAppearance();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Sections (Green) */}
      <div className="accent-green accent-card relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        {/* Top highlight streak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/40 to-transparent" />
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-brand/50 bg-brand/20 text-brand-bright shadow-[0_0_10px_rgba(0,255,170,0.2)]">
          <LayoutGrid className="size-5" />
        </div>
        <div>
          <p className="font-display text-[22px] font-bold leading-tight text-foreground text-glow">{totalSections}</p>
          <p className="text-[12px] font-medium text-foreground/80">{t("homepage.totalSections")}</p>
        </div>
      </div>

      {/* 2. Current Status (Cyan / Blue) */}
      <div className="accent-cyan accent-card relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        {/* Top highlight streak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/40 to-transparent" />
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-brand-cyan/50 bg-brand-cyan/20 text-brand-cyan shadow-[0_0_10px_rgba(0,229,255,0.2)]">
          <Eye className="size-5" />
        </div>
        <div>
          <p className="font-display text-[20px] font-bold leading-tight text-foreground text-glow">{status}</p>
          <p className="text-[12px] font-medium text-foreground/80">{t("homepage.currentStatus")}</p>
        </div>
      </div>

      {/* 3. Last Updated (Purple) */}
      <div className="accent-purple accent-card relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        {/* Top highlight streak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-purple-500/50 bg-purple-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
          <Calendar className="size-5" />
        </div>
        <div>
          <p className="font-display text-[18px] font-bold leading-tight text-foreground text-glow">{lastUpdated}</p>
          <p className="text-[12px] font-medium text-foreground/80">{t("common.lastUpdated")}</p>
        </div>
      </div>

      {/* 4. Add Section Button */}
      <button
        type="button"
        onClick={onAddSection}
        className="flex h-full min-h-[58px] items-center justify-center gap-2 rounded-xl border border-brand-bright/70 bg-gradient-to-r from-brand/90 to-brand-bright text-[14px] font-bold text-background shadow-[0_0_24px_rgba(0,255,170,0.35)] transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px] hover:brightness-110 hover:shadow-[0_0_32px_rgba(0,255,170,0.5)]"
      >
        <Plus className="size-5" />
        <span>{t("homepage.addSection")}</span>
      </button>
    </div>
  );
}
