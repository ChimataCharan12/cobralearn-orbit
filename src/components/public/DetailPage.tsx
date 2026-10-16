import { ArrowLeft, ExternalLink, Github, Video, Calendar, Users, Layers, Tag } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ShowcaseItem, ShowcaseType } from "@/data/showcase";
import type { PublicProjectDetailItem } from "@/lib/projects-data";
import type { PublicWebsiteDetailItem } from "@/lib/websites-data";
import type { PublicAdvertisementDetailItem } from "@/lib/advertisements-data";
import type { PublicAwardDetailItem } from "@/lib/awards-data";
import { BrandMark } from "./BrandMark";

export function DetailPage({
  item,
  type,
}: {
  item: ShowcaseItem | PublicProjectDetailItem | PublicWebsiteDetailItem | PublicAdvertisementDetailItem | PublicAwardDetailItem;
  type: ShowcaseType;
}) {
  const isProjectOrWebsite = type === "projects" || type === "websites";
  const detailItem = isProjectOrWebsite
    ? (item as Partial<PublicProjectDetailItem & PublicWebsiteDetailItem>)
    : null;
  const adItem = type === "advertisements"
    ? (item as Partial<PublicAdvertisementDetailItem>)
    : null;
  const awardItem = type === "awards"
    ? (item as Partial<PublicAwardDetailItem>)
    : null;
  const hasImage = Boolean(item.image && item.image.trim());
  const gallery = ("gallery" in item && Array.isArray(item.gallery))
    ? item.gallery.filter((img) => Boolean(img && img.url))
    : [];

  return (
    <main className={`detail-page accent-${item.accent} pb-24`}>
      <header>
        <BrandMark />
        <Link to="/" hash={type}>
          <ArrowLeft /> Back to showcase
        </Link>
      </header>

      {/* Hero / Thumbnail Image */}
      {hasImage && (
        <img
          src={item.image}
          alt={item.title}
          width={1280}
          height={720}
          className="detail-hero-img"
        />
      )}
      <div className="detail-overlay" />

      <section>
        <p>{detailItem?.category || adItem?.campaign || adItem?.brand || awardItem?.category || awardItem?.organization || type.toUpperCase()}</p>
        <h1>{item.title}</h1>
        <span>{item.description}</span>

        {/* Award Content */}
        {awardItem && (
          <div className="mt-8 space-y-8">
            {/* Metadata Badges: Dates, Issuer & Context */}
            {(awardItem.date || awardItem.organization || awardItem.context) && (
              <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
                {awardItem.date && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-panel/70 px-3 py-1.5">
                    <Calendar className="size-4 text-[var(--section-accent)]" />
                    <span>{awardItem.date}</span>
                  </div>
                )}
                {awardItem.organization && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-panel/70 px-3 py-1.5">
                    <Users className="size-4 text-[var(--section-accent)]" />
                    <span>Issuer: <strong className="text-foreground">{awardItem.organization}</strong></span>
                  </div>
                )}
                {awardItem.context && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-panel/70 px-3 py-1.5">
                    <Layers className="size-4 text-[var(--section-accent)]" />
                    <span>Context: <strong className="text-foreground">{awardItem.context}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Credential Link */}
            {awardItem.credentialUrl && (
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={awardItem.credentialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--section-accent)] bg-[var(--section-accent)]/20 px-4 py-2 text-[13px] font-semibold text-foreground shadow-[0_0_15px_color-mix(in_oklab,var(--section-accent)_25%,transparent)] transition hover:bg-[var(--section-accent)]/30 hover:scale-[1.02]"
                >
                  <ExternalLink className="size-4" /> View Credential / Certificate
                </a>
              </div>
            )}

            {/* Full Description */}
            {awardItem.fullDescription && awardItem.fullDescription !== awardItem.description && (
              <div>
                <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[var(--section-accent)]">
                  About the Achievement
                </h3>
                <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-foreground/85 font-normal">
                  {awardItem.fullDescription}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Advertisement Content */}
        {adItem && (
          <div className="mt-8 space-y-8">
            {/* Metadata Badges: Dates & Brand */}
            {(adItem.startDate || adItem.endDate || adItem.date || adItem.brand) && (
              <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
                {(adItem.startDate || adItem.endDate || adItem.date) && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-panel/70 px-3 py-1.5">
                    <Calendar className="size-4 text-[var(--section-accent)]" />
                    <span>
                      {adItem.startDate && adItem.endDate
                        ? `${adItem.startDate} — ${adItem.endDate}`
                        : adItem.date || adItem.startDate}
                    </span>
                  </div>
                )}
                {adItem.brand && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-panel/70 px-3 py-1.5">
                    <Users className="size-4 text-[var(--section-accent)]" />
                    <span>Brand: <strong className="text-foreground">{adItem.brand}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Campaign Link */}
            {adItem.campaignUrl && (
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={adItem.campaignUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--section-accent)] bg-[var(--section-accent)]/20 px-4 py-2 text-[13px] font-semibold text-foreground shadow-[0_0_15px_color-mix(in_oklab,var(--section-accent)_25%,transparent)] transition hover:bg-[var(--section-accent)]/30 hover:scale-[1.02]"
                >
                  <ExternalLink className="size-4" /> Visit Campaign
                </a>
              </div>
            )}

            {/* Full Description */}
            {adItem.fullDescription && adItem.fullDescription !== adItem.description && (
              <div>
                <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[var(--section-accent)]">
                  About the Campaign
                </h3>
                <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-foreground/85 font-normal">
                  {adItem.fullDescription}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Rich Content when available */}
        {detailItem && (
          <div className="mt-8 space-y-8">
            {/* Metadata Badges: Duration / Launch Date & Team Size */}
            {(detailItem.projectDuration || detailItem.launchDate || detailItem.teamSize) && (
              <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
                {detailItem.projectDuration && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-panel/70 px-3 py-1.5">
                    <Calendar className="size-4 text-[var(--section-accent)]" />
                    <span>Duration: <strong className="text-foreground">{detailItem.projectDuration}</strong></span>
                  </div>
                )}
                {detailItem.launchDate && !detailItem.projectDuration && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-panel/70 px-3 py-1.5">
                    <Calendar className="size-4 text-[var(--section-accent)]" />
                    <span>Launch: <strong className="text-foreground">{detailItem.launchDate}</strong></span>
                  </div>
                )}
                {detailItem.teamSize && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-panel/70 px-3 py-1.5">
                    <Users className="size-4 text-[var(--section-accent)]" />
                    <span>Team: <strong className="text-foreground">{detailItem.teamSize}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* External Links */}
            {(detailItem.liveUrl || detailItem.githubUrl || detailItem.videoUrl) && (
              <div className="flex flex-wrap items-center gap-3">
                {detailItem.liveUrl && (
                  <a
                    href={detailItem.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--section-accent)] bg-[var(--section-accent)]/20 px-4 py-2 text-[13px] font-semibold text-foreground shadow-[0_0_15px_color-mix(in_oklab,var(--section-accent)_25%,transparent)] transition hover:bg-[var(--section-accent)]/30 hover:scale-[1.02]"
                  >
                    <ExternalLink className="size-4" /> {type === "websites" ? "Visit Website" : "Live Demo"}
                  </a>
                )}
                {detailItem.githubUrl && (
                  <a
                    href={detailItem.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-brand/35 bg-panel/80 px-4 py-2 text-[13px] font-semibold text-foreground transition hover:border-brand-bright hover:bg-panel hover:scale-[1.02]"
                  >
                    <Github className="size-4" /> Source Code
                  </a>
                )}
                {detailItem.videoUrl && (
                  <a
                    href={detailItem.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-brand/35 bg-panel/80 px-4 py-2 text-[13px] font-semibold text-foreground transition hover:border-brand-bright hover:bg-panel hover:scale-[1.02]"
                  >
                    <Video className="size-4 text-[var(--section-accent)]" /> Watch Demo
                  </a>
                )}
              </div>
            )}

            {/* Technologies */}
            {detailItem.technologies && detailItem.technologies.length > 0 && (
              <div>
                <h3 className="mb-2.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[var(--section-accent)]">
                  <Layers className="size-3.5" /> Technologies Used
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detailItem.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-lg border border-[var(--section-accent)]/30 bg-[var(--section-accent)]/10 px-3 py-1 text-[12.5px] font-medium text-foreground shadow-sm"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Full Description */}
            {detailItem.fullDescription && detailItem.fullDescription !== detailItem.description && (
              <div>
                <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[var(--section-accent)]">
                  About the {type === "websites" ? "Website" : "Project"}
                </h3>
                <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-foreground/85 font-normal">
                  {detailItem.fullDescription}
                </p>
              </div>
            )}

            {/* Tags */}
            {detailItem.tags && detailItem.tags.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  <Tag className="size-3" /> Tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {detailItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-border/40 bg-panel/60 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Gallery Images */}
        {gallery.length > 0 && (
          <div className="pt-4">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-[var(--section-accent)]">
              {type === "websites"
                ? "Website Screenshots"
                : type === "advertisements"
                ? "Campaign Gallery"
                : type === "awards"
                ? "Award Gallery"
                : "Project Gallery"} ({gallery.length})
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 max-w-4xl">
              {gallery.map((img) => (
                <div
                  key={img.id}
                  className="group relative aspect-[16/10] overflow-hidden rounded-xl border border-brand/25 bg-panel/80 shadow-md transition hover:border-[var(--section-accent)] hover:shadow-[0_0_15px_color-mix(in_oklab,var(--section-accent)_30%,transparent)]"
                >
                  <img
                    src={img.url}
                    alt={img.altText || img.name || item.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <Link to="/" hash={type} className="detail-back">
          <ArrowLeft /> Explore the showcase
        </Link>
      </section>
    </main>
  );
}
