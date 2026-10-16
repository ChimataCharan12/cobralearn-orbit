import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import bannerProjectsImg from "@/assets/banner-projects-cinematic.png";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

export interface ProjectsBannerProps {
  pageTitle?: string;
  subtitle?: string;
  isActionPage?: boolean;
  actionTitle?: string;
  actionButtons?: React.ReactNode;
}

export function ProjectsBanner({
  pageTitle,
  subtitle,
  isActionPage = false,
  actionTitle,
  actionButtons,
}: ProjectsBannerProps) {
  const { t } = useAdminAppearance();
  const displayTitle = !pageTitle || pageTitle === "Projects" ? t("banner.projects.title") : pageTitle;
  const displaySubtitle = !subtitle || subtitle === "Manage and showcase your innovative projects. Add, edit, reorder and control visibility."
    ? t("banner.projects.subtitle")
    : subtitle;

  return (
    <section className="relative min-h-[148px] overflow-hidden rounded-xl border border-brand-bright/55 portal-button-glow">
      {/* Background cinematic artwork with glowing 3D cube, floating project screens, and mountains */}
      <img
        src={bannerProjectsImg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* Atmospheric overlays for text legibility */}
      <div className="banner-overlay absolute inset-0 opacity-25 pointer-events-none" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[52%] bg-gradient-to-r from-background/90 via-background/40 to-transparent" />

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
                <Link to="/admin/projects" className="transition hover:text-brand-bright hover:underline">
                  {t("nav.projects")}
                </Link>
                <ChevronRight className="size-3 text-muted-foreground/70" />
                <span className="text-foreground/80">{actionTitle || displayTitle}</span>
              </>
            ) : (
              <span className="text-foreground/80">{t("nav.projects")}</span>
            )}
          </div>

          {/* Action buttons (e.g. for Edit page: View on Website, Preview, Delete) */}
          {actionButtons && (
            <div className="flex items-center gap-2.5">
              {actionButtons}
            </div>
          )}
        </div>

        {/* Header Text */}
        <div className="mt-1.5 max-w-[55%]">
          <h1 className="font-display text-[34px] font-bold leading-tight text-foreground text-glow">
            {displayTitle}
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/75">
            {displaySubtitle}
          </p>
        </div>

        {/* Right Slogan — SHARE / INNOVATION / INSPIRE / GROWTH */}
        <div className={`absolute right-7 ${actionButtons ? "bottom-4 hidden space-y-1 font-display text-[9.5px] font-semibold tracking-[0.5em] xl:block text-left" : "top-1/2 -translate-y-1/2 hidden space-y-1.5 font-display text-[10.5px] font-semibold tracking-[0.55em] md:block text-left"}`}>
          <p className="text-brand/80">SHARE</p>
          <p className="text-brand-bright text-glow">INNOVATION</p>
          <p className="text-brand/80">INSPIRE</p>
          <p className="text-brand/80">GROWTH</p>
        </div>
      </div>
    </section>
  );
}

