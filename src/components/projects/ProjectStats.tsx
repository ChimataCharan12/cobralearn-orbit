import { Box, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

interface ProjectStatsProps {
  total: number;
  published: number;
  draft: number;
  archived: number;
  onAddClick?: () => void;
}

export function ProjectStats({
  total,
  published,
  draft,
  archived,
  onAddClick,
}: ProjectStatsProps) {
  const { t } = useAdminAppearance();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_auto]">
      {/* Total Projects Card */}
      <div className="accent-green accent-card relative flex items-center gap-3.5 rounded-xl p-4 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--ac)_55%,transparent)] to-transparent" />
        <span className="accent-icon-box grid size-11 shrink-0 place-items-center rounded-lg">
          <Box className="accent-text size-5 drop-shadow-[0_0_5px_var(--ac)]" />
        </span>
        <div>
          <p className="text-[26px] font-bold leading-none text-foreground">{total}</p>
          <p className="mt-1 text-[12.5px] font-medium text-foreground/70">{t("stats.totalProjects")}</p>
        </div>
      </div>

      {/* Published Card */}
      <div className="accent-green accent-card relative flex items-center gap-3.5 rounded-xl p-4 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--ac)_55%,transparent)] to-transparent" />
        <span className="accent-icon-box grid size-11 shrink-0 place-items-center rounded-lg">
          <span className="size-3.5 rounded-full bg-brand-bright shadow-[0_0_8px_var(--brand-bright),0_0_16px_var(--brand)]" />
        </span>
        <div>
          <p className="text-[26px] font-bold leading-none text-foreground">{published}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-bright">
            <span className="size-1.5 rounded-full bg-brand-bright shadow-[0_0_5px_var(--brand-bright)]" />
            {t("common.published")}
          </p>
        </div>
      </div>

      {/* Draft Card */}
      <div className="accent-amber accent-card relative flex items-center gap-3.5 rounded-xl p-4 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--ac)_55%,transparent)] to-transparent" />
        <span className="accent-icon-box grid size-11 shrink-0 place-items-center rounded-lg">
          <span className="size-3.5 rounded-full bg-brand-gold shadow-[0_0_8px_var(--brand-gold),0_0_16px_oklch(0.78_0.18_58)]" />
        </span>
        <div>
          <p className="text-[26px] font-bold leading-none text-foreground">{draft}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-gold">
            <span className="size-1.5 rounded-full bg-brand-gold shadow-[0_0_5px_var(--brand-gold)]" />
            {t("common.draft")}
          </p>
        </div>
      </div>

      {/* Archived Card */}
      <div className="accent-muted accent-card relative flex items-center gap-3.5 rounded-xl p-4 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--ac)_40%,transparent)] to-transparent" />
        <span className="accent-icon-box grid size-11 shrink-0 place-items-center rounded-lg">
          <span className="size-3.5 rounded-full bg-muted-foreground/60 shadow-[0_0_6px_rgba(150,160,180,0.3)]" />
        </span>
        <div>
          <p className="text-[26px] font-bold leading-none text-foreground">{archived}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
            <span className="size-1.5 rounded-full bg-muted-foreground/60" />
            {t("common.archived")}
          </p>
        </div>
      </div>

      {/* Add Project Button */}
      <div className="flex items-center sm:col-span-2 lg:col-span-1">
        <Link
          to="/admin/projects/create"
          id="add-project-btn"
          onClick={onAddClick}
          className="accent-green accent-card flex h-[72px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-bold text-brand-bright transition-all duration-200 hover:scale-[1.02] hover:translate-y-[-2px]"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-bright)_70%,transparent)] to-transparent" />
          <span className="accent-icon-box grid size-9 place-items-center rounded-lg mr-1">
            <Plus className="size-5 stroke-[2.5] text-brand-bright drop-shadow-[0_0_6px_var(--brand-bright)]" />
          </span>
          {t("stats.addProject")}
        </Link>
      </div>
    </div>
  );
}
