import { useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import logoImg from "@/assets/settings-logo-preview.png";
import favImg from "@/assets/settings-fav-preview.png";

export function GeneralInfoCard() {
  const [siteName, setSiteName] = useState("CobraLearn");
  const [siteTagline, setSiteTagline] = useState("Learn • Build • Grow");
  const [siteDesc, setSiteDesc] = useState(
    "CobraLearn is a learning platform to help students learn from industry experts, work on real-world projects, and grow their career."
  );
  const [siteUrl, setSiteUrl] = useState("https://cobralearn.com");

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="pb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">General Information</h3>
        <p className="text-[12px] text-muted-foreground">Basic information about your website.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 pt-1 lg:grid-cols-[1fr_210px]">
        {/* Left Form Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">
              Site Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[13px] text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Site Tagline</label>
            <input
              type="text"
              value={siteTagline}
              onChange={(e) => setSiteTagline(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[13px] text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-foreground/80">Site Description</label>
              <span className="text-[10.5px] text-muted-foreground">{siteDesc.length}/500</span>
            </div>
            <textarea
              rows={3}
              value={siteDesc}
              maxLength={500}
              onChange={(e) => setSiteDesc(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 p-3 text-[12.5px] leading-relaxed text-foreground focus:border-brand-bright focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">
              Website URL <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[13px] text-foreground focus:border-brand-bright focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Right Assets Upload Column */}
        <div className="space-y-4">
          {/* Site Logo */}
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Site Logo</label>
            <div className="relative mt-1 flex h-[85px] w-full items-center justify-center overflow-hidden rounded-xl border border-brand/25 bg-background/60 p-2">
              <button
                type="button"
                aria-label="Remove logo"
                className="absolute right-1.5 top-1.5 flex size-4.5 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
              <img src={logoImg} alt="CobraLearn Logo" className="max-h-full max-w-full object-contain" />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => toast.info("Select new site logo.")}
                className="flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/15 px-2.5 py-1 text-[11px] font-medium text-brand-bright hover:bg-brand/25"
              >
                <ImageIcon className="size-3" />
                <span>Change Logo</span>
              </button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">PNG, JPG, SVG (Recommended: 512x512)</p>
          </div>

          {/* Favicon */}
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Favicon</label>
            <div className="mt-1 flex items-center gap-3">
              <div className="relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-background/60 p-1">
                <button
                  type="button"
                  aria-label="Remove favicon"
                  className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-background text-muted-foreground hover:text-foreground"
                >
                  <X className="size-2.5" />
                </button>
                <img src={favImg} alt="Favicon" className="size-6 object-contain" />
              </div>

              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => toast.info("Select new favicon.")}
                  className="flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/15 px-2.5 py-1 text-[11px] font-medium text-brand-bright hover:bg-brand/25"
                >
                  <ImageIcon className="size-3" />
                  <span>Change Favicon</span>
                </button>
                <p className="mt-1 text-[10px] text-muted-foreground">PNG, ICO (Recommended: 64x64)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
