import { ArrowRight, Code2, Lightbulb, Megaphone, Mouse } from "lucide-react";
import heroImage from "@/assets/cobralearn-hero.jpg";
import type { HomepageSectionWithMedia } from "@/lib/server/homepage-operations";
import { resolveNavigationHref } from "@/lib/navigation-utils";
import { useRouterState } from "@tanstack/react-router";

const services = [
  { icon: Megaphone, title: "Advertisements", text: "Creative Ideas. Real Impact." },
  { icon: Code2, title: "Web Development", text: "Modern Websites. Powerful Presence." },
  { icon: Lightbulb, title: "Projects", text: "Learn. Build. Innovate." },
];

interface HeroProps {
  section?: HomepageSectionWithMedia;
}

export function Hero({ section }: HeroProps = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Core Hero section background banner is approved and fixed to cinematic branding
  const bgImage = heroImage;
  const rawBadge = section?.badge || "LEARN • BUILD • GROW";
  const badgeParts = rawBadge.split(/[•·|]/).map((s) => s.trim()).filter(Boolean);

  const rawTitle = section?.title || "CobraLearn Innotechcore";
  let brandMain = "CobraLearn";
  let brandSub = "Innotechcore";
  if (rawTitle.toLowerCase().includes("innotechcore")) {
    brandMain = rawTitle.replace(/innotechcore/i, "").trim() || "CobraLearn";
    brandSub = "Innotechcore";
  } else {
    brandMain = rawTitle;
    brandSub = "";
  }

  const lead = section?.subtitle || "Your trusted partner in digital innovation.";
  const primaryHref = resolveNavigationHref(section?.primaryButtonLink || "#projects", pathname);
  const primaryLabel = section?.primaryButtonLabel || "Explore Projects";
  const secondaryHref = section?.secondaryButtonLink
    ? resolveNavigationHref(section.secondaryButtonLink, pathname)
    : undefined;
  const secondaryLabel = section?.secondaryButtonLabel || undefined;

  return (
    <section id="home" className="hero">
      <img
        src={bgImage}
        alt="Futuristic cobra rising above an open book in a luminous technology landscape"
        width={1920}
        height={912}
        className="hero-image"
      />
      <div className="hero-shade" />
      <div className="hero-grid" />
      <div className="hero-content">
        <p className="eyebrow">
          {badgeParts.length > 1 ? (
            badgeParts.map((part, i) => (
              <span key={i}>
                {i > 0 && <i />}
                {part}
              </span>
            ))
          ) : (
            rawBadge
          )}
        </p>
        <p className="welcome">Welcome to</p>
        <h1>
          <span>{brandMain}</span>
          {brandSub && <small>{brandSub}</small>}
        </h1>
        <p className="hero-lead">{lead}</p>
        <p className="hero-copy">
          We create impactful solutions through
          <br />
          <b>Advertisements, Web Development</b> and <b>Real-Time Projects</b>
          <br />
          to help you learn, build and grow in the digital world.
        </p>

        {/* Hero CTA Action Buttons */}
        <div className="hero-actions flex flex-wrap items-center gap-3 pt-5">
          <a
            href={primaryHref}
            className="hero-btn-primary inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand to-brand-bright px-5 py-2.5 text-[12.5px] font-bold text-background shadow-[0_0_16px_rgba(0,255,170,0.35)] transition hover:brightness-110"
          >
            <span>{primaryLabel}</span>
            <ArrowRight className="size-3.5" />
          </a>
          {secondaryLabel && secondaryHref && (
            <a
              href={secondaryHref}
              className="hero-btn-secondary inline-flex items-center gap-2 rounded-lg border border-brand/35 bg-panel/80 px-4 py-2.5 text-[12.5px] font-semibold text-foreground/90 hover:border-brand-bright hover:text-brand-bright transition"
            >
              <span>{secondaryLabel}</span>
            </a>
          )}
        </div>
      </div>
      <div className="service-rail">
        {services.map(({ icon: Icon, title, text }) => (
          <div className="service-item" key={title}>
            <span>
              <Icon />
            </span>
            <div>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
          </div>
        ))}
      </div>
      <a href={primaryHref} className="scroll-cue">
        <Mouse /> <span>{primaryLabel}</span>
      </a>
    </section>
  );
}
