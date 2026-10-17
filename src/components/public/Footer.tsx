import { Instagram, Linkedin, Youtube, Github, Globe } from "lucide-react";
import type { GlobalSocialLink } from "@prisma/client";
import type { FooterSectionWithLinks } from "@/lib/server/navigation-operations";
import { BrandMark } from "./BrandMark";
import { isSectionAnchor, resolveNavigationHref } from "@/lib/navigation-utils";
import { useRouterState } from "@tanstack/react-router";

export interface FooterProps {
  sections?: FooterSectionWithLinks[];
  socialLinks?: GlobalSocialLink[];
}

export function renderSocialIcon(platform: string, iconName?: string | null) {
  const p = (platform || "").toLowerCase();
  const icon = (iconName || "").toLowerCase();
  if (p.includes("instagram") || icon.includes("instagram")) return <Instagram className="size-4" />;
  if (p.includes("youtube") || icon.includes("youtube")) return <Youtube className="size-4" />;
  if (p.includes("linkedin") || icon.includes("linkedin")) return <Linkedin className="size-4" />;
  if (p.includes("github") || icon.includes("github")) return <Github className="size-4" />;
  if (p.includes("twitter") || p.includes("x") || icon.includes("twitter") || icon.includes("x")) return <span className="font-bold text-[13px] leading-none">𝕏</span>;
  return <Globe className="size-4" />;
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

export function Footer({ sections, socialLinks }: FooterProps = {}) {
  let pathname = "/";
  try {
    pathname = useRouterState({ select: (s) => s.location.pathname });
  } catch {
    // Non-router context (e.g. tests without RouterProvider)
    if (typeof window !== "undefined") {
      pathname = window.location.pathname || "/";
    }
  }

  const isSectionsConfigured = sections !== undefined;
  const sectionsToRender = isSectionsConfigured
    ? sections.filter((s) => s.isVisible !== false)
    : [];

  const activeSocialLinks = (socialLinks || []).filter((s) => s.isEnabled !== false);

  return (
    <footer className="site-footer flex flex-col items-stretch">
      {/* Dynamic Sections Grid */}
      {sectionsToRender && sectionsToRender.length > 0 && (
        <div className="w-full py-10 border-b border-[oklch(0.75_0.08_170_/_0.2)]">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 text-left">
            {sectionsToRender.map((sec) => (
              <div key={sec.id} className="space-y-3">
                <h4 className="font-display text-[13px] font-bold text-white tracking-wider uppercase">
                  {sec.title}
                </h4>
                <ul className="space-y-2 text-[12px]">
                  {sec.links && sec.links.length > 0 ? (
                    sec.links.map((lnk) => {
                      const resolvedHref = resolveNavigationHref(lnk.url, pathname);
                      const isAnchor = isSectionAnchor(resolvedHref) || isSectionAnchor(lnk.url);
                      const target = !isAnchor && lnk.openInNewTab ? "_blank" : undefined;
                      const rel = !isAnchor && lnk.openInNewTab ? "noreferrer" : undefined;
                      return (
                        <li key={lnk.id || lnk.label}>
                          <a
                            href={resolvedHref}
                            target={target}
                            rel={rel}
                            className="text-[#94a3b8] transition-colors duration-200 hover:text-[#00ff87] hover:drop-shadow-[0_0_6px_#00ff87]"
                          >
                            {lnk.label}
                          </a>
                        </li>
                      );
                    })
                  ) : (
                    <li className="text-[11px] text-[#64748b] italic">No links configured</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <div className="flex w-full min-h-[70px] flex-wrap items-center justify-between gap-4 py-4">
        <BrandMark compact />
        <p className="flex items-center gap-[18px] text-[#00e5ff] font-semibold text-[9px] tracking-[0.35em]">
          INNOVATE <i className="inline-block size-1 rounded-full bg-[#00e5ff]" /> LEARN <i className="inline-block size-1 rounded-full bg-[#00e5ff]" /> ACHIEVE
        </p>
        <div className="socials">
          {activeSocialLinks.map((s) => (
            <a
              key={s.id}
              href={s.url}
              aria-label={s.platform}
              target="_blank"
              rel="noreferrer"
            >
              {renderSocialIcon(s.platform, s.iconName)}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
