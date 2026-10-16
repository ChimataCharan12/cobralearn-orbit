import { ArrowRight, Sparkles, Zap } from "lucide-react";
import type { HomepageSectionWithMedia } from "@/lib/server/homepage-operations";
import { Button } from "@/components/ui/button";
import { resolveNavigationHref } from "@/lib/navigation-utils";
import { useRouterState } from "@tanstack/react-router";

interface PublicCmsSectionProps {
  section: HomepageSectionWithMedia;
  variant?: "featured" | "cta" | "custom";
}

export function PublicCmsSection({ section, variant = "custom" }: PublicCmsSectionProps) {
  if (section.enabled === false) return null;

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const bgImage = (section.mediaAsset as any)?.publicUrl || (section.mediaAsset as any)?.url || undefined;
  const isCta = variant === "cta" || section.id === "sec-cta";
  const isFeatured = variant === "featured" || section.id === "sec-featured";

  const primaryHref = resolveNavigationHref(section.primaryButtonLink || "#", pathname);
  const secondaryHref = resolveNavigationHref(section.secondaryButtonLink || "#", pathname);

  return (
    <section
      id={section.id}
      className={`relative w-full overflow-hidden border-t border-[oklch(0.75_0.08_170_/_0.2)] ${
        bgImage
          ? "bg-black py-16 sm:py-20 px-6 sm:px-12"
          : isCta
          ? "bg-gradient-to-b from-panel/90 via-panel to-background py-20 px-6 sm:px-12"
          : "bg-panel/75 py-16 px-6 sm:px-12"
      }`}
    >
      {/* Background Media / Ambient Glow */}
      {bgImage && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <img
            src={bgImage}
            alt=""
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/65 to-black/85" />
          <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px]" />
        </div>
      )}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-96 rounded-full bg-brand/10 blur-3xl z-0" />

      <div className="relative z-10 mx-auto max-w-5xl text-center space-y-6">
        {/* Badge */}
        {section.badge && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/35 bg-brand/10 px-3.5 py-1 text-[11px] font-semibold tracking-wider text-brand-bright uppercase">
            {isFeatured ? <Sparkles className="size-3" /> : <Zap className="size-3" />}
            <span>{section.badge}</span>
          </div>
        )}

        {/* Title */}
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
          {section.title}
        </h2>

        {/* Subtitle */}
        {section.subtitle && (
          <p className="mx-auto max-w-2xl text-[14px] leading-relaxed text-muted-foreground sm:text-[16px]">
            {section.subtitle}
          </p>
        )}

        {/* Actions */}
        {(section.primaryButtonLabel || section.secondaryButtonLabel) && (
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            {section.primaryButtonLabel && (
              <Button
                asChild
                className="h-11 rounded-lg border border-brand-bright/70 bg-gradient-to-r from-brand to-brand-bright px-6 text-[13px] font-bold text-background shadow-[0_0_20px_rgba(0,255,170,0.35)] transition hover:brightness-110"
              >
                <a href={primaryHref}>
                  <span>{section.primaryButtonLabel}</span>
                  <ArrowRight className="ml-2 size-4" />
                </a>
              </Button>
            )}
            {section.secondaryButtonLabel && (
              <Button
                variant="outline"
                asChild
                className="h-11 rounded-lg border border-brand/30 bg-background/60 px-5 text-[13px] font-medium text-foreground hover:border-brand-bright hover:text-brand-bright"
              >
                <a href={secondaryHref}>
                  <span>{section.secondaryButtonLabel}</span>
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
