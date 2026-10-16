import { useState } from "react";
import {
  Sparkles,
  RotateCcw,
  Plus,
  X,
  Image as ImageIcon,
  ExternalLink,
  Search,
  Check,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { MediaLibraryPicker } from "@/components/media/MediaLibraryPicker";
import { type MediaItem } from "@/lib/media-data";
import { useContactConfig } from "@/lib/contact-store";

interface GeneralHeroTabProps {
  onMarkDirty?: () => void;
}

export function GeneralHeroTab({ onMarkDirty }: GeneralHeroTabProps) {
  const {
    config,
    updateConfig,
    resetConfigToDefault,
    addKeyword,
    removeKeyword,
    reorderKeywords,
  } = useContactConfig();

  const [newTagInput, setNewTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const hero = config.hero;
  const seo = config.seo;

  const handleFieldChange = (field: string, value: any) => {
    updateConfig((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        [field]: value,
      },
    }));
    onMarkDirty?.();
  };

  const handleSeoChange = (field: string, value: string) => {
    updateConfig((prev) => ({
      ...prev,
      seo: {
        ...prev.seo,
        [field]: value,
      },
    }));
    onMarkDirty?.();
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    addKeyword(newTagInput);
    setNewTagInput("");
    setIsAddingTag(false);
    toast.success(`Keyword tag added.`);
    onMarkDirty?.();
  };

  const handleRemoveTag = (id: string) => {
    removeKeyword(id);
    toast.info("Keyword tag removed.");
    onMarkDirty?.();
  };

  const handleMoveTag = (index: number, direction: "up" | "down") => {
    const copy = [...hero.keywords];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= copy.length) return;
    const [moved] = copy.splice(index, 1);
    if (!moved) return;
    copy.splice(targetIndex, 0, moved);
    reorderKeywords(copy.map((k, i) => ({ ...k, order: i + 1 })));
    onMarkDirty?.();
  };

  const handleMediaSelect = (selected: MediaItem[]) => {
    const item = selected[0];
    if (item) {
      updateConfig((prev) => ({
        ...prev,
        hero: {
          ...prev.hero,
          backgroundImage: item.url || item.thumbnail || null,
          backgroundImageId: item.id || null,
        },
      }));
      toast.success("Hero background updated from Media Library.");
      onMarkDirty?.();
    }
  };

  const handleRemoveBackground = () => {
    updateConfig((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        backgroundImage: null,
        backgroundImageId: null,
      },
    }));
    toast.info("Hero background image removed.");
    onMarkDirty?.();
  };

  const handleResetHero = () => {
    resetConfigToDefault();
    toast.info("Hero & General settings reset to defaults.");
    onMarkDirty?.();
  };

  return (
    <div className="space-y-6">
      {/* 2-Column Main Layout: Left Column (Form Fields), Right Column (Live Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-6 items-start">
        {/* Left Column */}
        <div className="space-y-6">
          {/* 1. Hero Section Content Card */}
          <div className="rounded-2xl border border-brand/25 bg-panel/85 p-5 sm:p-6 backdrop-blur-xl shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-brand/15">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg border border-brand/35 bg-brand/10 text-brand-bright">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h3 className="font-display text-[15px] font-bold text-foreground text-glow">
                    Hero Section Content
                  </h3>
                  <p className="text-[12px] text-muted-foreground">
                    Manage the main heading, description and hero content for your contact page.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetHero}
                className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/50 px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground transition hover:border-brand-bright/40 hover:text-foreground cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset to Default</span>
              </button>
            </div>

            <div className="space-y-4 pt-4">
              {/* Section Label */}
              <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-3 items-center">
                <div>
                  <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                    Section #
                  </label>
                  <input
                    type="text"
                    value={hero.sectionNumber}
                    onChange={(e) => handleFieldChange("sectionNumber", e.target.value)}
                    className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] font-mono text-amber-400 focus:border-brand-bright focus:outline-none"
                    placeholder="01"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                    Section Label
                  </label>
                  <input
                    type="text"
                    value={hero.sectionLabel}
                    onChange={(e) => handleFieldChange("sectionLabel", e.target.value)}
                    className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] font-mono text-brand-bright focus:border-brand-bright focus:outline-none uppercase tracking-wider"
                    placeholder="CONTACT"
                  />
                </div>
              </div>

              {/* Main Heading */}
              <div>
                <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                  Main Heading
                </label>
                <input
                  type="text"
                  value={hero.mainHeading}
                  onChange={(e) => handleFieldChange("mainHeading", e.target.value)}
                  className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[13px] font-bold text-white focus:border-brand-bright focus:outline-none uppercase"
                  placeholder="LET'S BUILD"
                />
              </div>

              {/* Highlight Heading */}
              <div>
                <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                  Highlight Glowing Heading
                </label>
                <input
                  type="text"
                  value={hero.highlightHeading}
                  onChange={(e) => handleFieldChange("highlightHeading", e.target.value)}
                  className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[13px] font-bold text-brand-bright focus:border-brand-bright focus:outline-none uppercase"
                  placeholder="SOMETHING TOGETHER"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11.5px] font-semibold text-foreground/80">
                    Description
                  </label>
                  <span className="text-[10.5px] font-mono text-muted-foreground">
                    {hero.description.length}/300
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={hero.description}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  className="w-full rounded-lg border border-brand/25 bg-background/70 p-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none resize-none leading-relaxed"
                  placeholder="Have a project, partnership, or idea in mind?..."
                />
              </div>

              {/* Hero Keywords / Tags Manager */}
              <div className="pt-2 border-t border-brand/10">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                    <span>Hero Keywords / Tags</span>
                    <span className="text-[10.5px] font-normal text-muted-foreground">
                      ({hero.keywords.length} tags)
                    </span>
                  </label>
                  {!isAddingTag && (
                    <button
                      type="button"
                      onClick={() => setIsAddingTag(true)}
                      className="flex items-center gap-1 text-[11.5px] font-semibold text-brand-bright hover:underline cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Add Tag</span>
                    </button>
                  )}
                </div>

                {isAddingTag && (
                  <div className="flex items-center gap-2 mb-3 p-2 rounded-lg border border-brand/35 bg-background/80">
                    <input
                      type="text"
                      autoFocus
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Enter keyword tag (e.g. INNOVATION)"
                      className="flex-1 h-8 rounded border border-brand/20 bg-background/90 px-2.5 text-[12px] uppercase text-white outline-none focus:border-brand-bright"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="h-8 rounded bg-brand-bright px-3 text-[11.5px] font-bold text-black hover:bg-brand-bright/90 cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingTag(false);
                        setNewTagInput("");
                      }}
                      className="h-8 rounded border border-brand/20 px-2.5 text-[11.5px] text-muted-foreground hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  {hero.keywords.map((kw, index) => (
                    <div
                      key={kw.id}
                      className="flex items-center justify-between rounded-lg border border-brand/20 bg-background/60 px-3 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-muted-foreground w-4">
                          {index + 1}.
                        </span>
                        <span className="font-display text-[12px] font-bold tracking-wider text-brand-bright">
                          {kw.text}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveTag(index, "up")}
                          className="px-1 text-[11px] text-muted-foreground hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === hero.keywords.length - 1}
                          onClick={() => handleMoveTag(index, "down")}
                          className="px-1 text-[11px] text-muted-foreground hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(kw.id)}
                          className="p-1 text-muted-foreground hover:text-red-400 transition cursor-pointer"
                          title="Remove tag"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Hero Background Card */}
          <div className="rounded-2xl border border-brand/25 bg-panel/85 p-5 sm:p-6 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-2.5 pb-4 border-b border-brand/15">
              <div className="grid size-8 place-items-center rounded-lg border border-brand/35 bg-brand/10 text-brand-bright">
                <ImageIcon className="size-4" />
              </div>
              <div>
                <h3 className="font-display text-[15px] font-bold text-foreground text-glow">
                  Hero Background
                </h3>
                <p className="text-[12px] text-muted-foreground">
                  Select background artwork from your central Media Library.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative h-24 w-44 rounded-xl border border-brand/35 bg-black/50 overflow-hidden shrink-0">
                {hero.backgroundImage ? (
                  <img
                    src={hero.backgroundImage}
                    alt="Hero Background"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/50 text-[11px]">
                    No image set
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[12px] text-foreground font-semibold">
                  Current Background Image
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Recommended: 1920 × 1080 (JPG/PNG/WebP)
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMediaPickerOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-brand/15 px-3 py-1.5 text-[12px] font-semibold text-brand-bright hover:bg-brand/25 transition cursor-pointer"
                  >
                    <ImageIcon className="size-3.5" />
                    <span>Change Image</span>
                  </button>
                  {hero.backgroundImage && (
                    <button
                      type="button"
                      onClick={handleRemoveBackground}
                      className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-1.5 text-[12px] font-medium text-red-400 hover:bg-red-950/40 transition cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. SEO Settings Card */}
          <div className="rounded-2xl border border-brand/25 bg-panel/85 p-5 sm:p-6 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-2.5 pb-4 border-b border-brand/15">
              <div className="grid size-8 place-items-center rounded-lg border border-brand/35 bg-brand/10 text-brand-bright">
                <Search className="size-4" />
              </div>
              <div>
                <h3 className="font-display text-[15px] font-bold text-foreground text-glow">
                  SEO Settings (Contact Page)
                </h3>
                <p className="text-[12px] text-muted-foreground">
                  Manage meta title and description for search engines and social shares.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11.5px] font-semibold text-foreground/80">
                    Page Title
                  </label>
                  <span className="text-[10.5px] font-mono text-muted-foreground">
                    {seo.pageTitle.length}/60
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={60}
                  value={seo.pageTitle}
                  onChange={(e) => handleSeoChange("pageTitle", e.target.value)}
                  className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11.5px] font-semibold text-foreground/80">
                    Meta Description
                  </label>
                  <span className="text-[10.5px] font-mono text-muted-foreground">
                    {seo.metaDescription.length}/160
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={160}
                  value={seo.metaDescription}
                  onChange={(e) => handleSeoChange("metaDescription", e.target.value)}
                  className="w-full rounded-lg border border-brand/25 bg-background/70 p-3 text-[12px] text-foreground focus:border-brand-bright focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Preview Panel */}
        <div className="sticky top-4 rounded-2xl border border-brand/30 bg-panel-strong/90 p-5 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-brand/15">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand-bright animate-pulse shadow-[0_0_8px_var(--brand-bright)]" />
              <h3 className="font-display text-[14.5px] font-bold text-white tracking-wide">
                Live Preview
              </h3>
            </div>
            <a
              href="/contact"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11.5px] font-medium text-brand-bright hover:underline"
            >
              <ExternalLink className="size-3.5" />
              <span>Open in New Tab</span>
            </a>
          </div>

          <p className="text-[11.5px] text-muted-foreground">
            This is how your hero section appears to public visitors on the website.
          </p>

          {/* Mini Hero Card Representation */}
          <div className="relative overflow-hidden rounded-xl border border-brand/30 bg-[#020b06] p-4 text-left shadow-inner">
            {/* Background image if set */}
            {hero.backgroundImage && (
              <img
                src={hero.backgroundImage}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-25 filter brightness-75 pointer-events-none"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020b06]/80 to-[#020b06] pointer-events-none" />

            <div className="relative z-10 space-y-2.5">
              {/* Eyebrow */}
              <div className="flex items-center gap-1.5">
                <span className="font-display text-[11px] font-bold text-[#f59e0b]">
                  {hero.sectionNumber}
                </span>
                <span className="h-[1px] w-3 bg-[#f59e0b]/60" />
                <span className="font-display text-[10px] font-bold text-[#00ff87] tracking-wider">
                  {hero.sectionLabel}
                </span>
              </div>

              {/* Title */}
              <div className="font-display text-[17px] font-extrabold uppercase leading-tight text-white">
                <p>{hero.mainHeading}</p>
                <p className="text-[#00ff87] text-glow">{hero.highlightHeading}</p>
              </div>

              {/* Subtitle */}
              <p className="text-[11px] text-[#94a3b8] line-clamp-3 leading-relaxed">
                {hero.description}
              </p>

              {/* Keywords representation */}
              {hero.keywords.length > 0 && (
                <div className="pt-2 border-t border-brand/15">
                  <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#64748b] mb-1.5">
                    Hero Keywords
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {hero.keywords.map((kw) => (
                      <span
                        key={kw.id}
                        className="rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 font-display text-[9.5px] font-bold tracking-wider text-brand-bright"
                      >
                        {kw.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Media Library Picker Modal */}
      <MediaLibraryPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        title="Select Hero Background Image"
        allowedTypes={["Image"]}
        multiple={false}
      />
    </div>
  );
}
