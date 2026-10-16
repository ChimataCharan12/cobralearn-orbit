import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import bannerWebsitesImg from "@/assets/banner-websites-cinematic.png";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

export interface WebsitesBannerProps {
  pageTitle?: string;
  subtitle?: string;
  isActionPage?: boolean;
  actionTitle?: string;
  actionButtons?: React.ReactNode;
}

export function WebsitesBanner({
  pageTitle,
  subtitle,
  isActionPage = false,
  actionTitle,
  actionButtons,
}: WebsitesBannerProps) {
  const { t } = useAdminAppearance();
  const displayTitle = !pageTitle || pageTitle === "Websites" ? t("banner.websites.title") : pageTitle;
  const displaySubtitle = !subtitle || subtitle === "Manage and showcase websites built and deployed by you or your team."
    ? t("banner.websites.subtitle")
    : subtitle;

  return (
    <section className="relative min-h-[148px] overflow-hidden rounded-xl border border-brand-bright/55 portal-button-glow">
      {/* Background cinematic artwork with glowing cyber globe, floating browser screens, and mountains */}
      <img
        src={bannerWebsitesImg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* Atmospheric Overlays for text legibility */}
      <div className="banner-overlay absolute inset-0 opacity-25 pointer-events-none" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[52%] bg-gradient-to-r from-background/90 via-background/40 to-transparent" />

      {/* Banner Content Container */}
      <div className={`relative flex h-full min-h-[148px] flex-col ${actionButtons ? "justify-between" : "justify-center"} px-7 py-5`}>
        {/* Top bar: Breadcrumb + optional action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-brand-cyan">
            <Link to="/admin/dashboard" className="transition hover:text-brand-bright hover:underline">
              {t("nav.dashboard")}
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/70" />
            {isActionPage ? (
              <>
                <Link to="/admin/websites" className="transition hover:text-brand-bright hover:underline">
                  {t("nav.websites")}
                </Link>
                <ChevronRight className="size-3 text-muted-foreground/70" />
                <span className="text-foreground/80">{actionTitle || displayTitle}</span>
              </>
            ) : (
              <span className="text-foreground/80">{t("nav.websites")}</span>
            )}
          </div>

          {/* Action buttons (e.g. for Edit page: View Live Site, Preview, Delete) */}
          {actionButtons && (
            <div className="flex items-center gap-2.5">
              {actionButtons}
            </div>
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

        {/* Right Futuristic Vertical Slogan — MODERN / WEBSITES — / REAL / IMPACT */}
        <div className={`absolute right-7 ${actionButtons ? "bottom-4 hidden space-y-1 font-display text-[9.5px] font-semibold tracking-[0.5em] xl:block text-left" : "top-1/2 -translate-y-1/2 hidden space-y-1.5 font-display text-[10.5px] font-semibold tracking-[0.55em] md:block text-left"}`}>
          <p className="text-brand/80">MODERN</p>
          <p className="flex items-center gap-2 text-brand-bright text-glow">
            WEBSITES <span className="h-[1.5px] w-6 rounded-full bg-brand-bright shadow-[0_0_8px_var(--brand-bright)]" />
          </p>
          <p className="text-brand/80">REAL</p>
          <p className="text-brand/80">IMPACT</p>
        </div>
      </div>
    </section>
  );
}

