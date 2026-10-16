import { ListOrdered, BookOpen, Link2, Eye } from "lucide-react";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

interface NavigationStatsProps {
  navLinksCount: number;
  footerSectionsCount: number;
  footerLinksCount: number;
  status: string;
}

export function NavigationStats({
  navLinksCount,
  footerSectionsCount,
  footerLinksCount,
  status,
}: NavigationStatsProps) {
  const { t } = useAdminAppearance();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Navigation Links (Green) */}
      <div className="accent-green accent-card relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        {/* Top highlight streak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/40 to-transparent" />
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-brand/50 bg-brand/20 text-brand-bright shadow-[0_0_10px_rgba(0,255,170,0.2)]">
          <ListOrdered className="size-5" />
        </div>
        <div>
          <p className="font-display text-[22px] font-bold leading-tight text-foreground text-glow">{navLinksCount}</p>
          <p className="text-[12px] font-medium text-foreground/80">{t("navigation.navLinks")}</p>
        </div>
      </div>

      {/* 2. Footer Sections (Blue) */}
      <div className="accent-blue accent-card relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        {/* Top highlight streak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/50 bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
          <BookOpen className="size-5" />
        </div>
        <div>
          <p className="font-display text-[22px] font-bold leading-tight text-foreground text-glow">{footerSectionsCount}</p>
          <p className="text-[12px] font-medium text-foreground/80">{t("navigation.footerSections")}</p>
        </div>
      </div>

      {/* 3. Footer Links (Purple) */}
      <div className="accent-purple accent-card relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        {/* Top highlight streak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-purple-500/50 bg-purple-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
          <Link2 className="size-5" />
        </div>
        <div>
          <p className="font-display text-[22px] font-bold leading-tight text-foreground text-glow">{footerLinksCount}</p>
          <p className="text-[12px] font-medium text-foreground/80">{t("navigation.footerLinks")}</p>
        </div>
      </div>

      {/* 4. Live on Website (Amber) */}
      <div className="accent-amber accent-card relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        {/* Top highlight streak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/50 bg-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
          <Eye className="size-5" />
        </div>
        <div>
          <p className="font-display text-[20px] font-bold leading-tight text-foreground text-glow">{status}</p>
          <p className="text-[12px] font-medium text-foreground/80">{t("navigation.liveOnWebsite")}</p>
        </div>
      </div>
    </div>
  );
}
