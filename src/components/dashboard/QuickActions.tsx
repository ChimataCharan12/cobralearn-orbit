import { Box, Megaphone, Monitor, Trophy } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";
import type { TranslationKey } from "@/lib/i18n/translations";

const actions: {
  labelKey: TranslationKey;
  accent: string;
  icon: any;
  to: string;
}[] = [
  {
    labelKey: "dashboard.addProject",
    accent: "amber",
    icon: Box,
    to: "/admin/projects/create",
  },
  {
    labelKey: "dashboard.addWebsite",
    accent: "green",
    icon: Monitor,
    to: "/admin/websites/create",
  },
  {
    labelKey: "dashboard.addAd",
    accent: "red",
    icon: Megaphone,
    to: "/admin/advertisements/create",
  },
  {
    labelKey: "dashboard.addAward",
    accent: "gold",
    icon: Trophy,
    to: "/admin/awards/create",
  },
];

export function QuickActions() {
  const navigate = useNavigate();
  const { t } = useAdminAppearance();

  return (
    <section className="dash-panel rounded-xl border border-brand/28 p-5">
      <h2 className="text-[16px] font-semibold text-foreground">{t("dashboard.quickActions")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {actions.map(({ labelKey, accent, icon: Icon, to }) => (
          <button
            key={labelKey}
            type="button"
            onClick={() => navigate({ to })}
            className={`accent-${accent} accent-card flex h-[62px] cursor-pointer items-center gap-3.5 rounded-lg px-4 text-[13px] font-semibold text-foreground/90 transition-all duration-200 hover:scale-[1.02] hover:translate-y-[-1px]`}
          >
            {/* Top-edge highlight */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--ac)_55%,transparent)] to-transparent" />

            <span className="accent-icon-box grid size-8 shrink-0 place-items-center rounded-md">
              <Icon className="accent-text size-4 drop-shadow-[0_0_5px_var(--ac)]" />
            </span>
            <span className="text-foreground">{t(labelKey)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
