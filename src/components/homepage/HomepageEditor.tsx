import { useState, useEffect } from "react";
import { Home, ExternalLink, Save, RotateCcw, ImageIcon, Sparkles } from "lucide-react";
import { type HomepageSection } from "@/lib/homepage-data";
import { type HomepageSectionWithMedia } from "@/lib/server/homepage-operations";
import { MediaLibraryPicker } from "@/components/media/MediaLibraryPicker";
import { toast } from "sonner";

interface HomepageEditorProps {
  section: HomepageSection | HomepageSectionWithMedia;
  onUpdateSection: (updated: any) => void;
  onDraftChange?: (draft: Partial<HomepageSectionWithMedia> & { mediaPreviewUrl?: string | null }) => void;
  onReset: () => void;
}

export function HomepageEditor({ section, onUpdateSection, onDraftChange, onReset }: HomepageEditorProps) {
  const [title, setTitle] = useState(section.title);
  const [subtitle, setSubtitle] = useState(section.subtitle);
  const [badge, setBadge] = useState(section.badge || "");
  const [primaryLabel, setPrimaryLabel] = useState(section.primaryButtonLabel || "Explore Projects");
  const [primaryLink, setPrimaryLink] = useState(section.primaryButtonLink || "#projects");
  const [secondaryLabel, setSecondaryLabel] = useState(section.secondaryButtonLabel || "View Websites");
  const [secondaryLink, setSecondaryLink] = useState(section.secondaryButtonLink || "#websites");
  const [mediaAssetId, setMediaAssetId] = useState<string | null>((section as any).mediaAssetId || null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(
    (section as any).mediaAsset?.publicUrl || (section as any).mediaAsset?.url || null
  );
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const isHero = section.id === "sec-hero";

  useEffect(() => {
    setTitle(section.title);
    setSubtitle(section.subtitle);
    setBadge(section.badge || "");
    setPrimaryLabel(section.primaryButtonLabel || "Explore Projects");
    setPrimaryLink(section.primaryButtonLink || "#projects");
    setSecondaryLabel(section.secondaryButtonLabel || "View Websites");
    setSecondaryLink(section.secondaryButtonLink || "#websites");
    setMediaAssetId((section as any).mediaAssetId || null);
    setMediaPreviewUrl((section as any).mediaAsset?.publicUrl || (section as any).mediaAsset?.url || null);
  }, [section]);

  const notifyDraft = (changes: Partial<{
    title: string;
    subtitle: string;
    badge: string;
    primaryButtonLabel: string;
    primaryButtonLink: string;
    secondaryButtonLabel: string;
    secondaryButtonLink: string;
    mediaAssetId: string | null;
    mediaPreviewUrl: string | null;
  }>) => {
    if (!onDraftChange) return;
    onDraftChange({
      ...section,
      title: changes.title !== undefined ? changes.title : title,
      subtitle: changes.subtitle !== undefined ? changes.subtitle : subtitle,
      badge: changes.badge !== undefined ? (changes.badge.trim() || null) : (badge.trim() || null),
      primaryButtonLabel: changes.primaryButtonLabel !== undefined ? changes.primaryButtonLabel : primaryLabel,
      primaryButtonLink: changes.primaryButtonLink !== undefined ? changes.primaryButtonLink : primaryLink,
      secondaryButtonLabel: changes.secondaryButtonLabel !== undefined ? changes.secondaryButtonLabel : secondaryLabel,
      secondaryButtonLink: changes.secondaryButtonLink !== undefined ? changes.secondaryButtonLink : secondaryLink,
      mediaAssetId: changes.mediaAssetId !== undefined ? changes.mediaAssetId : mediaAssetId,
      mediaPreviewUrl: changes.mediaPreviewUrl !== undefined ? changes.mediaPreviewUrl : mediaPreviewUrl,
    });
  };

  const handleSave = () => {
    onUpdateSection({
      ...section,
      title,
      subtitle,
      badge: badge.trim() || null,
      primaryButtonLabel: primaryLabel,
      primaryButtonLink: primaryLink,
      secondaryButtonLabel: secondaryLabel,
      secondaryButtonLink: secondaryLink,
      // Hero section background media is fixed to the approved branding
      mediaAssetId: isHero ? null : mediaAssetId,
      mediaPreviewUrl: isHero ? null : mediaPreviewUrl,
      mediaAsset: isHero
        ? null
        : mediaPreviewUrl
        ? {
            id: mediaAssetId || "",
            publicUrl: mediaPreviewUrl,
            url: mediaPreviewUrl,
          }
        : null,
    });
  };

  const handleResetForm = () => {
    setTitle(section.title);
    setSubtitle(section.subtitle);
    setBadge(section.badge || "");
    setPrimaryLabel(section.primaryButtonLabel || "Explore Projects");
    setPrimaryLink(section.primaryButtonLink || "#projects");
    setSecondaryLabel(section.secondaryButtonLabel || "View Websites");
    setSecondaryLink(section.secondaryButtonLink || "#websites");
    const origMediaId = (section as any).mediaAssetId || null;
    const origMediaUrl = (section as any).mediaAsset?.publicUrl || (section as any).mediaAsset?.url || null;
    setMediaAssetId(origMediaId);
    setMediaPreviewUrl(origMediaUrl);
    if (onDraftChange) {
      onDraftChange({
        ...section,
        mediaPreviewUrl: origMediaUrl,
      });
    }
    onReset();
    toast.info("Form reset to saved section values.");
  };

  return (
    <div className="flex flex-col rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      {/* Header */}
      <div className="mb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Edit Section</h3>
        <p className="text-[12px] text-muted-foreground">Update content and settings for this section.</p>
      </div>

      {/* Section Selector */}
      <div className="mb-4">
        <label className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">
          Section
        </label>
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-brand/30 bg-background/60 px-3 py-2 text-[13px] font-medium text-foreground">
          <Home className="size-4 text-brand-bright" />
          <span className="flex-1 font-semibold">{section.name}</span>
          <span className="rounded bg-brand/15 px-2 py-0.5 text-[11px] font-mono text-brand-bright">
            {section.id}
          </span>
        </div>
      </div>

      {/* Content Form */}
      <div className="space-y-3.5">
        {/* Section Title */}
        <div>
          <label className="text-[12px] font-medium text-foreground/80">Section Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              notifyDraft({ title: e.target.value });
            }}
            className="mt-1 h-9 w-full rounded-lg border border-brand/25 bg-background/60 px-3 text-[13px] text-foreground focus:border-brand-bright/70 focus:outline-none"
          />
        </div>

        {/* Badge / Eyebrow */}
        <div>
          <label className="text-[12px] font-medium text-foreground/80">Badge / Eyebrow</label>
          <input
            type="text"
            value={badge}
            placeholder="e.g. LEARN • BUILD • GROW"
            onChange={(e) => {
              setBadge(e.target.value);
              notifyDraft({ badge: e.target.value });
            }}
            className="mt-1 h-9 w-full rounded-lg border border-brand/25 bg-background/60 px-3 text-[13px] text-foreground focus:border-brand-bright/70 focus:outline-none"
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className="text-[12px] font-medium text-foreground/80">Subtitle / Description</label>
          <textarea
            rows={3}
            value={subtitle}
            onChange={(e) => {
              setSubtitle(e.target.value);
              notifyDraft({ subtitle: e.target.value });
            }}
            className="mt-1 w-full rounded-lg border border-brand/25 bg-background/60 p-2.5 text-[12.5px] text-foreground focus:border-brand-bright/70 focus:outline-none"
          />
        </div>

        {/* Background Image: Core Hero banner is fixed, other sections support real media */}
        {isHero ? (
          <div className="rounded-lg border border-brand/25 bg-background/50 p-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-brand-bright">
              <Sparkles className="size-4" />
              <span>Approved Cinematic Hero Banner</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              The core Hero section uses the approved cinematic visual banner. Background media editing is disabled for Hero to preserve brand integrity.
            </p>
          </div>
        ) : (
          <div>
            <label className="text-[12px] font-medium text-foreground/80">Background Media</label>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-brand/35 bg-background flex items-center justify-center">
                {mediaPreviewUrl ? (
                  <img
                    src={mediaPreviewUrl}
                    alt="Section background"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-1 text-center text-muted-foreground">
                    <ImageIcon className="size-5 opacity-40" />
                    <span className="text-[8px] leading-none mt-1 opacity-60">None</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMediaPicker(true)}
                  className="rounded-lg border border-brand/40 bg-brand/15 px-3 py-1.5 text-[11.5px] font-semibold text-brand-bright hover:bg-brand/25 transition"
                >
                  {mediaPreviewUrl ? "Change Media" : "Select Media"}
                </button>
                {mediaAssetId && (
                  <button
                    type="button"
                    onClick={() => {
                      setMediaAssetId(null);
                      setMediaPreviewUrl(null);
                      notifyDraft({ mediaAssetId: null, mediaPreviewUrl: null });
                      toast.info("Removed background media.");
                    }}
                    className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-1.5 text-[11.5px] font-semibold text-red-400 hover:bg-red-900/30 transition"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Primary Button */}
        <div>
          <label className="text-[12px] font-medium text-foreground/80">Primary Button</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10.5px] text-muted-foreground">Label</span>
              <input
                type="text"
                value={primaryLabel}
                onChange={(e) => {
                  setPrimaryLabel(e.target.value);
                  notifyDraft({ primaryButtonLabel: e.target.value });
                }}
                className="mt-0.5 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2.5 text-[12px] text-foreground focus:border-brand-bright"
              />
            </div>
            <div>
              <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                Link <ExternalLink className="size-2.5" />
              </span>
              <input
                type="text"
                value={primaryLink}
                onChange={(e) => {
                  setPrimaryLink(e.target.value);
                  notifyDraft({ primaryButtonLink: e.target.value });
                }}
                className="mt-0.5 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2.5 text-[12px] text-foreground focus:border-brand-bright"
              />
            </div>
          </div>
        </div>

        {/* Secondary Button */}
        <div>
          <label className="text-[12px] font-medium text-foreground/80">Secondary Button</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10.5px] text-muted-foreground">Label</span>
              <input
                type="text"
                value={secondaryLabel}
                onChange={(e) => {
                  setSecondaryLabel(e.target.value);
                  notifyDraft({ secondaryButtonLabel: e.target.value });
                }}
                className="mt-0.5 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2.5 text-[12px] text-foreground focus:border-brand-bright"
              />
            </div>
            <div>
              <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                Link <ExternalLink className="size-2.5" />
              </span>
              <input
                type="text"
                value={secondaryLink}
                onChange={(e) => {
                  setSecondaryLink(e.target.value);
                  notifyDraft({ secondaryButtonLink: e.target.value });
                }}
                className="mt-0.5 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2.5 text-[12px] text-foreground focus:border-brand-bright"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-6 flex items-center justify-between border-t border-brand/20 pt-4">
        <button
          type="button"
          onClick={handleResetForm}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:bg-brand/10 hover:text-foreground transition"
        >
          <RotateCcw className="size-3.5" />
          <span>Reset</span>
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg border border-brand-bright/70 bg-gradient-to-r from-brand to-brand-bright px-4 py-2 text-[12.5px] font-bold text-background shadow-[0_0_15px_rgba(0,255,170,0.3)] transition hover:brightness-110"
        >
          <Save className="size-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {/* Media Library Picker Modal */}
      <MediaLibraryPicker
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        allowedTypes={["Image"]}
        initialCategory="General"
        onSelect={(selected) => {
          if (selected.length > 0) {
            const asset = selected[0]!;
            const resolvedUrl = asset.url || (asset as any).publicUrl || null;
            setMediaAssetId(asset.id);
            setMediaPreviewUrl(resolvedUrl);
            notifyDraft({ mediaAssetId: asset.id, mediaPreviewUrl: resolvedUrl });
            toast.success(`Selected "${asset.name}"`);
          }
          setShowMediaPicker(false);
        }}
      />
    </div>
  );
}
