import { useState } from "react";
import { Search, Globe, Share2, Twitter, Sparkles, Upload, FileCode } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { SettingRow } from "@/components/common/settings/SettingRow";
import { SettingToggle } from "@/components/common/settings/SettingToggle";
import { useSiteSettings } from "@/lib/site-settings-context";

export function SeoMetaTab() {
  const {
    draft,
    updateDraft,
    isSaving,
    canUpdateSettings,
  } = useSiteSettings();

  // Basic SEO (Live preview & local document state)
  const [seoTitle, setSeoTitle] = useState("CobraLearn Innotechcore — Digital Innovation & Showcase Portal");
  const [metaDescription, setMetaDescription] = useState(
    "Explore innovative showcase projects, web experiences, campaigns, and digital achievements with CobraLearn Innotechcore."
  );
  const [canonicalUrl, setCanonicalUrl] = useState("https://cobralearn.in");

  // Open Graph
  const [ogTitle, setOgTitle] = useState("CobraLearn Innotechcore — Architecting Digital Reality");
  const [ogDescription, setOgDescription] = useState(
    "A cinematic showcase of digital innovation, web experiences, real-time projects and achievements."
  );

  // Twitter / X Card
  const [twitterCardType, setTwitterCardType] = useState<"summary_large_image" | "summary">("summary_large_image");
  const [twitterTitle, setTwitterTitle] = useState("CobraLearn Innotechcore");
  const [twitterDescription, setTwitterDescription] = useState(
    "Industry-grade showcase portfolios, digital web experiences, and high-impact campaigns."
  );

  // Search Engine Directives
  const [allowIndexing, setAllowIndexing] = useState(true);
  const [sitemapEnabled, setSitemapEnabled] = useState(true);
  const [robotsConfig, setRobotsConfig] = useState(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: https://cobralearn.in/sitemap.xml`
  );

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="rounded-xl border border-brand/20 bg-panel/80 p-4">
        <h2 className="font-display text-[17px] font-bold text-foreground text-glow flex items-center gap-2">
          <Search className="size-4 text-brand-bright" />
          Search Engine Optimization (SEO) & Social Meta
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          Configure organic search metadata, Open Graph cards, Google SERP previews, and robots crawl directives.
        </p>
      </div>

      {/* Live SERP & Social Share Previews */}
      <SettingsCard
        title="Live Search & Social Previews"
        description="Real-time visual rendering of how your page appears in Google search results and social media shares."
        badge="Live Preview"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 1. Google SERP Preview */}
          <div className="rounded-xl border border-brand/25 bg-[#0a0e14] p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-brand-bright">
              <GoogleIcon className="size-3.5" />
              <span>Google Desktop Search Preview</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-mono">
                <span>{canonicalUrl}</span>
                <span>›</span>
                <span className="text-foreground/80">learn</span>
              </div>
              <h4 className="text-[15px] font-medium text-[#8ab4f8] hover:underline cursor-pointer line-clamp-1">
                {seoTitle || "Page Title Here"}
              </h4>
              <p className="text-[12px] text-[#bdc1c6] line-clamp-2 leading-relaxed">
                {metaDescription || "Enter your meta description below to preview how it will appear in search results."}
              </p>
            </div>
          </div>

          {/* 2. Social Share (Open Graph / X) Preview */}
          <div className="rounded-xl border border-brand/25 bg-[#0a0e14] overflow-hidden">
            <div className="p-2 border-b border-brand/15 bg-background/50 flex items-center justify-between">
              <span className="text-[11px] font-mono text-brand-bright flex items-center gap-1.5">
                <Share2 className="size-3.5" />
                Social Card Preview ({twitterCardType})
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">1200 × 630</span>
            </div>
            <div className="relative h-28 bg-gradient-to-tr from-emerald-950/80 via-black to-cyan-950/60 flex items-center justify-center border-b border-brand/20">
              <div className="text-center p-3">
                <span className="font-display font-bold text-sm text-brand-bright text-glow">
                  {ogTitle || "CobraLearn Innotechcore"}
                </span>
                <p className="text-[10px] text-foreground/75 mt-0.5 max-w-xs truncate">{ogDescription}</p>
              </div>
            </div>
            <div className="p-3 bg-panel/90 space-y-0.5">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">cobralearn.com</p>
              <p className="text-[12px] font-bold text-foreground truncate">{ogTitle}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{ogDescription}</p>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 1. Basic SEO Tags */}
      <SettingsCard
        title="Basic Search Engine Tags"
        description="Core HTML meta tags indexed by Google, Bing, and web crawlers."
        badge="HTML Tags"
      >
        <SettingRow
          label="Meta SEO Title"
          description="Optimal title length: 50–60 characters. Appears as the clickable headline in search engines."
          required
        >
          <div className="w-full">
            <input
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              className="w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            />
            <div className="flex justify-between text-[10.5px] text-muted-foreground mt-1 font-mono">
              <span>Recommended: 50-60 chars</span>
              <span className={seoTitle.length > 60 ? "text-amber-400" : "text-brand-bright"}>
                {seoTitle.length} characters
              </span>
            </div>
          </div>
        </SettingRow>

        <SettingRow
          label="Meta Description"
          description="Optimal description length: 140–160 characters. Summarizes the page content for search engines."
          required
        >
          <div className="w-full">
            <textarea
              rows={3}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              className="w-full rounded-lg border border-brand/20 bg-background/70 p-2.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none leading-relaxed"
            />
            <div className="flex justify-between text-[10.5px] text-muted-foreground mt-1 font-mono">
              <span>Recommended: 140-160 chars</span>
              <span className={metaDescription.length > 160 ? "text-amber-400" : "text-brand-bright"}>
                {metaDescription.length} characters
              </span>
            </div>
          </div>
        </SettingRow>

        <SettingRow
          label="Focus Keywords"
          description="Comma-separated target keywords and search phrases."
        >
          <input
            type="text"
            value={draft.metaKeywords.join(", ")}
            disabled={!canUpdateSettings || isSaving}
            onChange={(e) =>
              updateDraft(
                "metaKeywords",
                e.target.value
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean)
              )
            }
            className="w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
          />
        </SettingRow>

        <SettingRow
          label="Canonical URL"
          description="Prevents duplicate content penalties by declaring the authoritative link."
        >
          <input
            type="text"
            value={canonicalUrl}
            onChange={(e) => setCanonicalUrl(e.target.value)}
            className="w-full sm:w-96 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>
      </SettingsCard>

      {/* 2. Open Graph & Twitter Social Cards */}
      <SettingsCard
        title="Open Graph & Social Media Cards"
        description="Rich snippets rendered when users share your links on social feeds."
        badge="Open Graph"
      >
        <SettingRow
          label="OG Title (og:title)"
          description="Headline displayed when link is posted to LinkedIn, Facebook, or Discord."
        >
          <input
            type="text"
            value={ogTitle}
            onChange={(e) => setOgTitle(e.target.value)}
            className="w-full sm:w-96 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>

        <SettingRow
          label="OG Description (og:description)"
          description="Subtitle narrative for social cards."
        >
          <textarea
            rows={2}
            value={ogDescription}
            onChange={(e) => setOgDescription(e.target.value)}
            className="w-full rounded-lg border border-brand/20 bg-background/70 p-2.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>

        <SettingRow
          label="Twitter / X Card Type"
          description="Select standard summary or large hero image format."
        >
          <div className="inline-flex rounded-lg border border-brand/20 bg-background/50 p-1">
            <button
              type="button"
              onClick={() => setTwitterCardType("summary_large_image")}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                twitterCardType === "summary_large_image"
                  ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.2)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Large Image (1200×630)
            </button>
            <button
              type="button"
              onClick={() => setTwitterCardType("summary")}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                twitterCardType === "summary"
                  ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.2)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Compact Square (1:1)
            </button>
          </div>
        </SettingRow>

        <SettingRow
          label="Social Share Image (og:image)"
          description="Recommended aspect ratio 1.91:1 (1200x630px). Enter a root-relative path or URL."
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
            <input
              type="text"
              placeholder="/og-preview-default.png"
              value={draft.ogImageUrl || ""}
              disabled={!canUpdateSettings || isSaving}
              onChange={(e) => updateDraft("ogImageUrl", e.target.value.trim() ? e.target.value.trim() : null)}
              className="w-full sm:w-80 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => toast.info("Social image upload will connect to Media Library in Version 2.")}
              className="flex items-center gap-1.5 rounded-lg border border-brand/35 bg-brand/15 px-3 py-1.5 text-[12px] font-medium text-brand-bright hover:bg-brand/25 shrink-0"
            >
              <Upload className="size-3.5" />
              Upload Image
            </button>
          </div>
        </SettingRow>
      </SettingsCard>

      {/* 3. Search Engine Crawling & Robots Directives */}
      <SettingsCard
        title="Search Engine Indexing & Robots Directives"
        description="Control web crawler access, XML sitemap generation, and disallow rules."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Allow Search Engine Indexing"
          description="When disabled, emits 'noindex, nofollow' header to hide the website from search engine crawlers."
        >
          <SettingToggle
            checked={allowIndexing}
            onChange={setAllowIndexing}
            label="Search Indexing"
          />
        </SettingRow>

        <SettingRow
          label="Automatic XML Sitemap"
          description="Generates dynamic /sitemap.xml including all published projects and content."
        >
          <div className="flex items-center gap-3">
            <SettingToggle
              checked={sitemapEnabled}
              onChange={setSitemapEnabled}
              label="Enable Sitemap"
            />
            <button
              type="button"
              onClick={() => toast.info("XML sitemap regeneration is scheduled for Version 2. XML sitemap generation is handled dynamically.")}
              className="rounded-md border border-brand/25 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-brand-bright"
            >
              Regenerate
            </button>
          </div>
        </SettingRow>

        <SettingRow
          label="robots.txt Custom Directives"
          description="Custom rules served directly at yourdomain.com/robots.txt."
        >
          <div className="w-full">
            <textarea
              rows={5}
              value={robotsConfig}
              onChange={(e) => setRobotsConfig(e.target.value)}
              className="w-full rounded-lg border border-brand/20 bg-background/80 p-3 text-[12px] font-mono text-brand-bright focus:border-brand-bright focus:outline-none"
            />
          </div>
        </SettingRow>
      </SettingsCard>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}
