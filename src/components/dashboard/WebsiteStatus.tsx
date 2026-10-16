import { ArrowRight, Clock, Database, ExternalLink, Globe } from "lucide-react";
import { images } from "@/lib/dashboard-data";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

export interface WebsiteStatusProps {
  siteUrl?: string;
  statusLabel?: string;
  statusSubtext?: string;
  lastUpdatedText?: string;
  mediaSummaryText?: string;
  isLoading?: boolean;
  isError?: boolean;
}

/**
 * Validates that an incoming URL string uses safe HTTP or HTTPS protocol.
 */
function getSafeHttpUrl(url?: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

export function WebsiteStatus({
  siteUrl = "",
  statusLabel,
  statusSubtext,
  lastUpdatedText,
  mediaSummaryText,
  isLoading = false,
  isError = false,
}: WebsiteStatusProps) {
  const { t } = useAdminAppearance();
  const safeUrl = getSafeHttpUrl(siteUrl);
  const isConfigured = Boolean(safeUrl && (!statusLabel || statusLabel === "Showcase Configured"));

  let resolvedLabel = statusLabel;
  let resolvedSubtext = statusSubtext;

  if (isLoading) {
    resolvedLabel = "Loading status...";
    resolvedSubtext = "Retrieving showcase configuration...";
  } else if (isError) {
    resolvedLabel = "Status Unavailable";
    resolvedSubtext = "Failed to load showcase configuration from database.";
  } else if (!safeUrl) {
    resolvedLabel = "Not Configured";
    resolvedSubtext = "Showcase URL has not been configured in site settings.";
  } else {
    resolvedLabel = statusLabel || "Showcase Configured";
    resolvedSubtext = statusSubtext || "Showcase URL is configured and active in site settings.";
  }

  let indicatorDot: React.ReactNode;
  let labelClassName = "text-foreground";

  if (isLoading) {
    indicatorDot = (
      <span className="size-3 animate-ping rounded-full bg-brand-bright/60" />
    );
    labelClassName = "text-brand-bright/80 animate-pulse";
  } else if (isError) {
    indicatorDot = (
      <span className="size-3 rounded-full bg-destructive shadow-[0_0_10px_var(--destructive)]" />
    );
    labelClassName = "text-destructive";
  } else if (isConfigured && safeUrl) {
    indicatorDot = (
      <span className="size-3 rounded-full bg-brand-bright shadow-[0_0_10px_var(--brand-bright),0_0_20px_var(--brand)]" />
    );
    labelClassName = "text-brand-bright text-glow";
  } else {
    indicatorDot = (
      <span className="size-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
    );
    labelClassName = "text-amber-400";
  }

  let liveUrlValue: React.ReactNode;
  if (isLoading) {
    liveUrlValue = <span className="inline-block h-4 w-36 animate-pulse rounded bg-foreground/15" />;
  } else if (isError) {
    liveUrlValue = <span className="text-foreground/50 italic">Unavailable</span>;
  } else if (safeUrl) {
    liveUrlValue = (
      <a
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-medium text-brand-cyan transition hover:underline hover:text-brand-bright"
      >
        {safeUrl} <ExternalLink className="size-3" />
      </a>
    );
  } else {
    liveUrlValue = <span className="text-foreground/50 italic">Not configured</span>;
  }

  let lastUpdatedValue: React.ReactNode;
  if (isLoading) {
    lastUpdatedValue = <span className="inline-block h-4 w-32 animate-pulse rounded bg-foreground/15" />;
  } else if (isError) {
    lastUpdatedValue = <span className="text-foreground/50 italic">Unavailable</span>;
  } else {
    lastUpdatedValue = lastUpdatedText || "No content updates yet";
  }

  let mediaSummaryValue: React.ReactNode;
  if (isLoading) {
    mediaSummaryValue = <span className="inline-block h-4 w-28 animate-pulse rounded bg-foreground/15" />;
  } else if (isError) {
    mediaSummaryValue = <span className="text-foreground/50 italic">Unavailable</span>;
  } else {
    mediaSummaryValue = mediaSummaryText || "0 files (0 MB)";
  }

  const rows = [
    { icon: Globe, label: t("common.liveUrl"), value: liveUrlValue },
    { icon: Clock, label: t("common.lastUpdated"), value: lastUpdatedValue },
    { icon: Database, label: t("common.totalMediaFiles"), value: mediaSummaryValue },
  ];

  return (
    <section className="dash-panel relative overflow-hidden rounded-xl border border-brand/28 p-5">
      {/* Background glowing line chart waveform — blended into panel */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 100"
        className="pointer-events-none absolute bottom-2 left-[18%] h-[55%] w-[46%] opacity-25"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
            <stop offset="30%" stopColor="var(--brand-bright)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--brand-bright)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="url(#waveGrad)"
          strokeWidth="1.6"
          points="0,95 40,90 70,82 100,86 130,65 160,72 190,50 220,58 250,36 280,42 310,22 340,28 370,12 400,4"
        />
        {/* Soft glow line below */}
        <polyline
          fill="none"
          stroke="var(--brand-bright)"
          strokeWidth="3"
          strokeOpacity="0.12"
          points="0,95 40,90 70,82 100,86 130,65 160,72 190,50 220,58 250,36 280,42 310,22 340,28 370,12 400,4"
        />
      </svg>

      <div className="relative grid gap-5 md:grid-cols-[1fr_240px]">
        <div>
          <h2 className="text-[16px] font-semibold text-foreground">{t("common.websiteStatus")}</h2>
          <p className={`mt-2 flex items-center gap-2.5 text-[22px] font-bold ${labelClassName}`}>
            {indicatorDot}
            {resolvedLabel}
          </p>
          <p className="mt-1 text-[13px] text-foreground/80">{resolvedSubtext}</p>

          <ul className="mt-4 space-y-3">
            {rows.map(({ icon: Icon, label, value }) => (
              <li key={label} className="flex gap-3.5 text-[13px]">
                <Icon className="mt-0.5 size-4.5 shrink-0 text-brand-bright/65" />
                <div>
                  <p className="font-semibold text-foreground/85">{label}</p>
                  <div className="text-foreground/65 mt-0.5">{value}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center justify-center gap-4">
          {/* Website preview */}
          <div className="relative w-full overflow-hidden rounded-lg border border-brand-bright/60 shadow-[0_0_18px_color-mix(in_oklab,var(--brand)_20%,transparent)]">
            <div className="pointer-events-none absolute inset-0 rounded-lg border border-brand-bright/20" />
            <img
              src={images.website}
              alt="Showcase website preview"
              loading="lazy"
              className="aspect-[2.2/1] w-full rounded-lg object-cover"
            />
          </div>

          {/* View Website button */}
          {!isLoading && !isError && safeUrl ? (
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="view-website-btn inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold text-brand-bright transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_22px_color-mix(in_oklab,var(--brand-bright)_35%,transparent)]"
            >
              {t("common.viewWebsite")} <ArrowRight className="size-4" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-border/40 bg-muted/20 px-5 py-2 text-[13px] font-semibold text-muted-foreground opacity-60"
            >
              {t("common.viewWebsite")} <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

