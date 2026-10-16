import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import adBannerImg from "@/assets/banner-advertisements-cinematic.png";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

interface AdvertisementsBannerProps {
  pageTitle?: string;
  subtitle?: string;
  isActionPage?: boolean;
  actionTitle?: string;
}

export function AdvertisementsBanner({
  pageTitle,
  subtitle,
  isActionPage = false,
  actionTitle,
}: AdvertisementsBannerProps) {
  const { t } = useAdminAppearance();
  const displayTitle = !pageTitle || pageTitle === "Advertisements" ? t("banner.advertisements.title") : pageTitle;
  const displaySubtitle = !subtitle || subtitle === "Manage and showcase advertisement campaigns on your platform."
    ? t("banner.advertisements.subtitle")
    : subtitle;

  return (
    <section className="relative min-h-[148px] overflow-hidden rounded-xl border border-brand-bright/55 portal-button-glow">
      {/* Background Cinematic Megaphone & Environment Artwork */}
      <img
        src={adBannerImg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-[68%_50%]"
      />

      {/* Atmospheric Overlays for crisp left-side text legibility */}
      <div className="banner-overlay absolute inset-0 opacity-35 pointer-events-none" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[55%] bg-gradient-to-r from-background/90 via-background/40 to-transparent" />

      {/* Banner Content Container */}
      <div className="relative flex h-full flex-col justify-center px-7 py-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-brand-cyan">
          <Link to="/admin/dashboard" className="transition hover:text-brand-bright hover:underline">
            {t("nav.dashboard")}
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/70" />
          {isActionPage ? (
            <>
              <Link to="/admin/advertisements" className="transition hover:text-brand-bright hover:underline">
                {t("nav.advertisements")}
              </Link>
              <ChevronRight className="size-3 text-muted-foreground/70" />
              <span className="text-foreground/80">{actionTitle || displayTitle}</span>
            </>
          ) : (
            <span className="text-foreground/80">{t("nav.advertisements")}</span>
          )}
        </div>

        {/* Title & Subtitle */}
        <div className="mt-1.5 max-w-[55%]">
          <h1 className="font-display text-[34px] font-bold leading-tight text-foreground text-glow">
            {displayTitle}
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/75">
            {displaySubtitle}
          </p>
        </div>

        {/* Right Futuristic Vertical Slogan */}
        <div className="absolute right-7 hidden space-y-1.5 font-display text-[10.5px] font-semibold tracking-[0.55em] md:block text-right">
          <p className="text-brand/80">IDEAS</p>
          <p className="text-brand/80">CAMPAIGNS</p>
          <p className="flex items-center justify-end gap-2.5 text-brand-bright text-glow">
            BRANDS <span className="h-px w-6 rounded-full bg-brand-bright shadow-[0_0_8px_var(--brand-bright)]" />
          </p>
          <p className="text-brand/80">IMPACT</p>
        </div>
      </div>
    </section>
  );
}
