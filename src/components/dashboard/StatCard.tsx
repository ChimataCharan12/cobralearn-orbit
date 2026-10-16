import { ArrowRight, ArrowUpRight, Box, Megaphone, Monitor, Trophy } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import type { Accent } from "@/lib/dashboard-data";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

const icons = {
  projects: Box,
  websites: Monitor,
  ads: Megaphone,
  awards: Trophy,
} as const;

export function StatCard(p: {
  k: keyof typeof icons;
  title: string;
  value: number;
  delta: number;
  published: number;
  draft: number;
  accent: Accent;
  comparisonText?: string;
}) {
  const Icon = icons[p.k];
  const navigate = useNavigate();
  const { t } = useAdminAppearance();

  const handleCardClick = () => {
    if (p.k === "projects") {
      navigate({ to: "/admin/projects" });
    } else if (p.k === "websites") {
      navigate({ to: "/admin/websites" });
    } else if (p.k === "ads") {
      navigate({ to: "/admin/advertisements" });
    } else if (p.k === "awards") {
      navigate({ to: "/admin/awards" });
    }
  };

  return (
    <article
      onClick={handleCardClick}
      className={`accent-${p.accent} accent-card relative flex cursor-pointer gap-4 rounded-xl p-4 transition-all duration-300 hover:scale-[1.015] hover:translate-y-[-2px]`}
    >
      {/* Subtle top-edge highlight streak */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--ac)_60%,transparent)] to-transparent" />

      {/* Icon container with internal glow */}
      <span className="accent-icon-box grid size-12 shrink-0 place-items-center rounded-lg">
        <Icon className="accent-text size-6 drop-shadow-[0_0_6px_var(--ac)]" />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold tracking-wide text-foreground/85">{p.title}</p>
        <p className="mt-1 flex items-baseline gap-2.5">
          <span className="text-[32px] font-bold leading-none text-foreground drop-shadow-[0_0_8px_color-mix(in_oklab,var(--ac)_20%,transparent)]">
            {p.value}
          </span>
          {p.comparisonText ? (
            <span className="flex items-center gap-0.5 text-[11px] font-medium accent-text">
              {p.delta > 0 && <ArrowUpRight className="size-3.5" />}
              {p.comparisonText}
            </span>
          ) : p.delta > 0 ? (
            <span className="flex items-center gap-0.5 text-[12.5px] font-semibold accent-text">
              <ArrowUpRight className="size-4" />+{p.delta}
            </span>
          ) : null}
        </p>
        <p className="mt-2 text-[11.5px] text-foreground/65">
          {t("common.published")}: {p.published} &nbsp;|&nbsp; {t("common.draft")}: {p.draft}
        </p>
      </div>

      {/* Arrow circle button */}
      <button
        type="button"
        aria-label={`Open ${p.title}`}
        onClick={(e) => {
          e.stopPropagation();
          handleCardClick();
        }}
        className="accent-circle-btn absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full transition-all duration-200 hover:scale-110"
      >
        <ArrowRight className="accent-text size-4" />
      </button>
    </article>
  );
}
