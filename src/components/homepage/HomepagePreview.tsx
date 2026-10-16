import { useState, useMemo } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  ArrowRight,
  Code,
  Brain,
  Megaphone,
  Trophy,
  Sparkles,
  Zap,
  Eye,
} from "lucide-react";
import emblem from "@/assets/cobralearn-emblem.png";
import heroImage from "@/assets/cobralearn-hero.jpg";
import { type HomepageSectionWithMedia } from "@/lib/server/homepage-operations";

interface HomepagePreviewProps {
  sections: HomepageSectionWithMedia[];
  activeSectionId?: string;
  isDraft?: boolean;
}

export function HomepagePreview({
  sections = [],
  activeSectionId,
  isDraft = false,
}: HomepagePreviewProps) {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const deviceWidthClass =
    device === "mobile"
      ? "max-w-[360px]"
      : device === "tablet"
      ? "max-w-[540px]"
      : "w-full";

  // Ordered list of enabled sections matching public rendering rules
  const enabledSections = useMemo(() => {
    return [...sections]
      .filter((s) => s.enabled !== false)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [sections]);

  const resolveMediaUrl = (s: HomepageSectionWithMedia): string | null => {
    return (
      (s as any).mediaPreviewUrl ||
      (s as any).mediaAsset?.publicUrl ||
      (s as any).mediaAsset?.url ||
      null
    );
  };

  return (
    <div className="flex flex-col rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      {/* Top Preview Controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-brand/15 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Homepage Preview</h3>
          {isDraft && (
            <span className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-amber-400 border border-amber-500/30">
              <Eye className="size-3" />
              Live Draft Preview
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Device Toggles */}
          <div className="flex items-center rounded-lg border border-brand/25 bg-background/60 p-0.5">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              aria-label="Desktop Preview"
              className={`flex size-7 items-center justify-center rounded transition ${
                device === "desktop"
                  ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("tablet")}
              aria-label="Tablet Preview"
              className={`flex size-7 items-center justify-center rounded transition ${
                device === "tablet"
                  ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tablet className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              aria-label="Mobile Preview"
              className={`flex size-7 items-center justify-center rounded transition ${
                device === "mobile"
                  ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="size-3.5" />
            </button>
          </div>

          {/* View Live Site Button */}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-brand/35 bg-background/60 px-2.5 py-1 text-[11.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-brand-bright"
          >
            <span>View Live Site</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex justify-center overflow-hidden rounded-xl border border-brand/25 bg-background/95 p-3">
        <div className={`transition-all duration-300 ${deviceWidthClass} space-y-3.5`}>
          {/* Mini Public Navbar */}
          <header className="flex items-center justify-between rounded-lg border border-brand/20 bg-panel/90 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <img src={emblem} alt="" className="size-6 object-contain brand-glow" />
              <div className="leading-tight">
                <span className="font-display text-[11px] font-bold text-brand">CobraLearn</span>
                <span className="block text-[7.5px] tracking-wider text-brand-cyan">innotechcore</span>
              </div>
            </div>

            <nav className="hidden items-center gap-3 text-[10.5px] font-medium text-foreground/80 md:flex">
              <span className="text-brand-bright font-semibold">Home</span>
              <span>Projects</span>
              <span>Websites</span>
              <span>Advertisements</span>
              <span>Awards</span>
            </nav>

            <span className="rounded-md bg-brand-bright px-2.5 py-1 text-[10px] font-bold text-background shadow-[0_0_8px_rgba(0,255,170,0.4)]">
              Showcase
            </span>
          </header>

          {/* Render Sections strictly in persisted displayOrder (driven by same rules as public page) */}
          {enabledSections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-brand/25 p-8 text-center text-muted-foreground">
              <p className="text-[12px]">All homepage sections are currently disabled.</p>
              <p className="text-[11px] opacity-75 mt-1">Enable sections below to preview and display them publicly.</p>
            </div>
          ) : (
            enabledSections.map((sec) => {
              const isSectionActive = sec.id === activeSectionId;
              const hasDraft = isSectionActive && isDraft;
              const mediaUrl = resolveMediaUrl(sec);

              // 1. HERO BANNER SECTION
              if (sec.id === "sec-hero") {
                return (
                  <div
                    key={sec.id}
                    className="relative overflow-hidden rounded-xl border border-brand/30 bg-black min-h-[170px] p-4 sm:p-5 flex flex-col justify-between"
                  >
                    {/* Approved Fixed Cinematic Background Banner */}
                    <img
                      src={heroImage}
                      alt="Approved Hero Banner"
                      className="absolute inset-0 h-full w-full object-cover opacity-45"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

                    <div className="relative z-10 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-block font-display text-[9px] font-bold tracking-[0.25em] text-brand-bright uppercase">
                          {sec.badge || "LEARN • BUILD • GROW"}
                        </span>
                        {hasDraft && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300">
                            Draft
                          </span>
                        )}
                      </div>
                      <h4 className="font-display text-[17px] font-extrabold leading-tight text-foreground sm:text-[19px]">
                        {sec.title}
                      </h4>
                      <p className="text-[10.5px] leading-relaxed text-foreground/80 max-w-md line-clamp-2">
                        {sec.subtitle}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="flex items-center gap-1 rounded-md bg-brand-bright px-3 py-1 text-[10.5px] font-bold text-background shadow-[0_0_8px_rgba(0,255,170,0.3)]">
                          <span>{sec.primaryButtonLabel || "Explore Projects"}</span>
                          <ArrowRight className="size-2.5" />
                        </span>
                        {sec.secondaryButtonLabel && (
                          <span className="rounded-md border border-brand/35 bg-panel/80 px-2.5 py-1 text-[10.5px] font-semibold text-foreground/85">
                            {sec.secondaryButtonLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // 2. FEATURED SHOWCASE SECTION
              if (sec.id === "sec-featured") {
                return (
                  <div
                    key={sec.id}
                    className={`relative overflow-hidden rounded-xl border border-brand/25 p-4 text-center space-y-2.5 ${
                      mediaUrl ? "bg-black" : "bg-panel/90"
                    }`}
                  >
                    {/* Real background image if attached */}
                    {mediaUrl && (
                      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                        <img src={mediaUrl} alt="" className="h-full w-full object-cover object-center" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/65 to-black/85" />
                        <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px]" />
                      </div>
                    )}
                    <div className="relative z-10 space-y-1.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {sec.badge && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-brand/35 bg-brand/10 px-2.5 py-0.5 text-[9px] font-bold text-brand-bright uppercase">
                            <Sparkles className="size-2.5" />
                            {sec.badge}
                          </span>
                        )}
                        {hasDraft && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300">
                            Draft
                          </span>
                        )}
                      </div>
                      <h4 className="font-display text-[15px] font-bold text-white">
                        {sec.title}
                      </h4>
                      <p className="text-[10.5px] text-muted-foreground max-w-sm mx-auto line-clamp-2">
                        {sec.subtitle}
                      </p>
                      {sec.primaryButtonLabel && (
                        <div className="pt-1">
                          <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-brand to-brand-bright px-3 py-1 text-[10px] font-bold text-background">
                            <span>{sec.primaryButtonLabel}</span>
                            <ArrowRight className="size-2.5" />
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // 3. RECENT PROJECTS / SHOWCASE MODULES
              if (sec.id === "sec-projects") {
                return (
                  <div
                    key={sec.id}
                    className={`relative overflow-hidden space-y-2 rounded-xl border border-brand/20 p-3 ${
                      mediaUrl ? "bg-black" : "bg-panel/60"
                    }`}
                  >
                    {mediaUrl && (
                      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                        <img src={mediaUrl} alt="" className="h-full w-full object-cover object-center" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/65 to-black/85" />
                        <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px]" />
                      </div>
                    )}
                    <div className="relative z-10 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-display text-[12px] font-bold text-foreground">
                            {sec.title}
                          </h4>
                          <p className="text-[9.5px] text-muted-foreground line-clamp-1">{sec.subtitle}</p>
                        </div>
                        {hasDraft && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300">
                            Draft
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        <div className="rounded-lg border border-brand/30 bg-brand/10 p-1.5 text-center">
                          <Code className="mx-auto size-3.5 text-brand-bright" />
                          <p className="mt-0.5 text-[9.5px] font-bold text-foreground">Projects</p>
                        </div>
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-center">
                          <Brain className="mx-auto size-3.5 text-emerald-400" />
                          <p className="mt-0.5 text-[9.5px] font-bold text-foreground">Websites</p>
                        </div>
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-center">
                          <Megaphone className="mx-auto size-3.5 text-red-400" />
                          <p className="mt-0.5 text-[9.5px] font-bold text-foreground">Advertisements</p>
                        </div>
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 text-center">
                          <Trophy className="mx-auto size-3.5 text-amber-400" />
                          <p className="mt-0.5 text-[9.5px] font-bold text-foreground">Awards</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // 4. CALL TO ACTION SECTION
              if (sec.id === "sec-cta") {
                return (
                  <div
                    key={sec.id}
                    className={`relative overflow-hidden rounded-xl border border-brand/25 p-4 text-center space-y-2 ${
                      mediaUrl ? "bg-black" : "bg-gradient-to-b from-panel/95 to-background"
                    }`}
                  >
                    {mediaUrl && (
                      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                        <img src={mediaUrl} alt="" className="h-full w-full object-cover object-center" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/65 to-black/85" />
                        <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px]" />
                      </div>
                    )}
                    <div className="relative z-10 space-y-1">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[9px] font-bold text-brand-bright uppercase">
                          <Zap className="size-2.5" />
                          {sec.badge || "GET IN TOUCH"}
                        </span>
                        {hasDraft && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300">
                            Draft
                          </span>
                        )}
                      </div>
                      <h4 className="font-display text-[14px] font-bold text-white">{sec.title}</h4>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 max-w-sm mx-auto">{sec.subtitle}</p>
                      {sec.primaryButtonLabel && (
                        <div className="pt-1">
                          <span className="inline-flex items-center gap-1 rounded-md bg-brand-bright px-3 py-1 text-[10px] font-bold text-background shadow-[0_0_8px_rgba(0,255,170,0.3)]">
                            {sec.primaryButtonLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // 5. CUSTOM SECTION
              return (
                <div
                  key={sec.id}
                  className={`relative overflow-hidden rounded-xl border border-brand/20 p-3.5 text-center space-y-1.5 ${
                    mediaUrl ? "bg-black" : "bg-panel/75"
                  }`}
                >
                  {mediaUrl && (
                    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                      <img src={mediaUrl} alt="" className="h-full w-full object-cover object-center" />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/65 to-black/85" />
                      <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px]" />
                    </div>
                  )}
                  <div className="relative z-10 space-y-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[8.5px] font-mono text-brand-bright">
                        {sec.name}
                      </span>
                      {hasDraft && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300">
                          Draft
                        </span>
                      )}
                    </div>
                    <h4 className="font-display text-[13px] font-bold text-white">{sec.title}</h4>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{sec.subtitle}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
