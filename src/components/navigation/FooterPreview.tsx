import { useState } from "react";
import { Monitor, Tablet, Smartphone, Linkedin, Github, Youtube, Instagram, Globe } from "lucide-react";
import type { FooterSectionWithLinks } from "@/lib/server/navigation-operations";
import type { GlobalSocialLink } from "@prisma/client";
import { BrandMark } from "@/components/public/BrandMark";

interface FooterPreviewProps {
  sections?: FooterSectionWithLinks[];
  socialLinks?: GlobalSocialLink[];
}

export function renderSocialIcon(platform: string, iconName?: string | null) {
  const p = (platform || "").toLowerCase();
  const icon = (iconName || "").toLowerCase();
  if (p.includes("instagram") || icon.includes("instagram")) return <Instagram className="size-3.5" />;
  if (p.includes("youtube") || icon.includes("youtube")) return <Youtube className="size-3.5" />;
  if (p.includes("linkedin") || icon.includes("linkedin")) return <Linkedin className="size-3.5" />;
  if (p.includes("github") || icon.includes("github")) return <Github className="size-3.5" />;
  if (p.includes("twitter") || p.includes("x") || icon.includes("twitter") || icon.includes("x")) return <span className="font-bold text-[11px]">𝕏</span>;
  return <Globe className="size-3.5" />;
}

const DEFAULT_FALLBACK_SECTIONS: FooterSectionWithLinks[] = [
  {
    id: "sec-default-showcase",
    title: "Showcase",
    iconName: "Box",
    displayOrder: 1,
    isVisible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    links: [
      { id: "def-1", footerSectionId: "sec-default-showcase", label: "Projects", url: "#projects", openInNewTab: false, displayOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: "def-2", footerSectionId: "sec-default-showcase", label: "Websites", url: "#websites", openInNewTab: false, displayOrder: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: "def-3", footerSectionId: "sec-default-showcase", label: "Advertisements", url: "#advertisements", openInNewTab: false, displayOrder: 3, createdAt: new Date(), updatedAt: new Date() },
      { id: "def-4", footerSectionId: "sec-default-showcase", label: "Awards", url: "#awards", openInNewTab: false, displayOrder: 4, createdAt: new Date(), updatedAt: new Date() },
    ],
  },
  {
    id: "sec-default-company",
    title: "Company",
    iconName: "Info",
    displayOrder: 2,
    isVisible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    links: [
      { id: "def-5", footerSectionId: "sec-default-company", label: "About Innotechcore", url: "#home", openInNewTab: false, displayOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: "def-6", footerSectionId: "sec-default-company", label: "Milestones", url: "#awards", openInNewTab: false, displayOrder: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: "def-7", footerSectionId: "sec-default-company", label: "Contact", url: "/contact", openInNewTab: false, displayOrder: 3, createdAt: new Date(), updatedAt: new Date() },
    ],
  },
  {
    id: "sec-default-legal",
    title: "Legal",
    iconName: "BookOpen",
    displayOrder: 3,
    isVisible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    links: [
      { id: "def-8", footerSectionId: "sec-default-legal", label: "Privacy Policy", url: "#privacy", openInNewTab: false, displayOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: "def-9", footerSectionId: "sec-default-legal", label: "Terms of Service", url: "#terms", openInNewTab: false, displayOrder: 2, createdAt: new Date(), updatedAt: new Date() },
    ],
  },
];

export function FooterPreview({ sections, socialLinks }: FooterPreviewProps = {}) {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const deviceWidthClass =
    device === "mobile"
      ? "max-w-[340px]"
      : device === "tablet"
      ? "max-w-[500px]"
      : "w-full";

  const sectionsToRender = (sections || []).filter((s) => s.isVisible !== false);
  const activeSocialLinks = (socialLinks || []).filter((s) => s.isEnabled !== false);

  return (
    <div className="flex flex-col rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      {/* Top Preview Controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-brand/15 pb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Footer Preview</h3>

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
      </div>

      {/* Preview Frame */}
      <div className="flex justify-center overflow-hidden rounded-xl border border-brand/25 bg-background/90 p-4">
        <footer className={`transition-all duration-300 ${deviceWidthClass} flex flex-col items-stretch`}>
          {/* Dynamic Sections Grid */}
          {sectionsToRender && sectionsToRender.length > 0 && (
            <div className="w-full py-6 border-b border-[oklch(0.75_0.08_170_/_0.2)]">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 text-left">
                {sectionsToRender.map((sec) => (
                  <div key={sec.id} className="space-y-2">
                    <h4 className="font-display text-[12px] font-bold text-white tracking-wider uppercase">
                      {sec.title}
                    </h4>
                    <ul className="space-y-1.5 text-[11px]">
                      {sec.links && sec.links.length > 0 ? (
                        sec.links.map((lnk) => (
                          <li key={lnk.id || lnk.label} className="text-[#94a3b8] truncate">
                            {lnk.label}
                          </li>
                        ))
                      ) : (
                        <li className="text-[10px] text-[#64748b] italic">No links configured</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Bar */}
          <div className="flex w-full min-h-[50px] flex-wrap items-center justify-between gap-3 pt-3">
            <BrandMark compact />
            <p className="flex items-center gap-2 text-[#00e5ff] font-semibold text-[8px] tracking-[0.25em]">
              INNOVATE <i className="inline-block size-1 rounded-full bg-[#00e5ff]" /> LEARN <i className="inline-block size-1 rounded-full bg-[#00e5ff]" /> ACHIEVE
            </p>
            <div className="flex items-center gap-2 text-muted-foreground">
              {activeSocialLinks.map((s) => (
                <span key={s.id} title={s.platform} className="hover:text-brand-bright cursor-pointer">
                  {renderSocialIcon(s.platform, s.iconName)}
                </span>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
