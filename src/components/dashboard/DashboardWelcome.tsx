import bannerDashboardImg from "@/assets/banner-dashboard-cinematic.png";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

export function DashboardWelcome() {
  const { profile } = useAdminProfile();
  const { t } = useAdminAppearance();
  const displayName = profile?.fullName?.trim() || (profile?.email ? profile.email.split("@")[0] : "Admin") || "Admin";

  return (
    <section className="relative min-h-[148px] overflow-hidden rounded-xl border border-brand-bright/55 portal-button-glow">
      {/* Background cinematic artwork */}
      <img
        src={bannerDashboardImg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* Atmospheric overlays for text legibility */}
      <div className="banner-overlay absolute inset-0 opacity-25 pointer-events-none" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[50%] bg-gradient-to-r from-background/90 via-background/40 to-transparent" />

      {/* Content */}
      <div className="relative flex h-full min-h-[148px] items-center px-7 py-5">
        <div className="max-w-[55%]">
          <p className="text-[20px] font-medium leading-none text-foreground/85">{t("dashboard.welcomeBack")}</p>
          <p className="mt-1 font-display text-[38px] font-bold leading-tight text-foreground text-glow truncate max-w-full">
            {displayName}
          </p>
          <p className="mt-2 hidden text-[13px] leading-relaxed text-foreground/75 sm:block">
            {t("dashboard.welcomeSubtitle")}
          </p>
        </div>

        {/* Right Slogan — LEARN / BUILD — / GROW */}
        <div className="absolute right-7 top-1/2 -translate-y-1/2 hidden space-y-1.5 font-display text-[10.5px] font-semibold tracking-[0.55em] md:block text-left">
          <p className="text-brand/80">{t("dashboard.sloganLearn")}</p>
          <p className="flex items-center gap-2 text-brand-bright text-glow">
            {t("dashboard.sloganBuild")} <span className="h-[1.5px] w-6 rounded-full bg-brand-bright shadow-[0_0_8px_var(--brand-bright)]" />
          </p>
          <p className="text-brand/80">{t("dashboard.sloganGrow")}</p>
        </div>
      </div>
    </section>
  );
}

