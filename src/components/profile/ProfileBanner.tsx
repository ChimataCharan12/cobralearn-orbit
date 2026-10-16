import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import bannerProfileImg from "@/assets/banner-profile-cinematic.png";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

export function ProfileBanner() {
  const { t } = useAdminAppearance();

  return (
    <section className="relative min-h-[148px] overflow-hidden rounded-xl border border-brand-bright/55 portal-button-glow">
      {/* Background Cinematic Administrator Profile & Shield Artwork — Fully illuminated & bright */}
      <img
        src={bannerProfileImg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* Subtle localized left gradient strictly behind text */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-background/70 via-background/25 to-transparent" />

      {/* Content Container */}
      <div className="relative flex h-full min-h-[148px] flex-col justify-center px-7 py-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-brand-cyan">
          <Link to="/admin/dashboard" className="transition hover:text-brand-bright hover:underline">
            {t("nav.dashboard")}
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/70" />
          <span className="text-foreground/80">{t("nav.adminProfile")}</span>
        </div>

        {/* Title & Subtitle */}
        <div className="mt-1.5 max-w-[55%]">
          <h1 className="font-display text-[34px] font-bold leading-tight text-foreground text-glow drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {t("banner.profile.title")}
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
            {t("banner.profile.subtitle")}
          </p>
        </div>

        {/* Right Slogan — MANAGE / YOUR PROFILE / SECURE / STAY PRODUCTIVE */}
        <div className="absolute right-7 top-1/2 -translate-y-1/2 hidden space-y-1.5 font-display text-[10.5px] font-semibold tracking-[0.55em] md:block text-left">
          <p className="text-brand/80">MANAGE</p>
          <p className="text-brand/80">YOUR PROFILE</p>
          <p className="text-brand-bright text-glow">SECURE</p>
          <p className="text-brand/80">STAY PRODUCTIVE</p>
        </div>
      </div>
    </section>
  );
}
