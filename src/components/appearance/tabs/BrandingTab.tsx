import { useState } from "react";
import { ShieldCheck, Upload, RotateCcw, Check, Image as ImageIcon, Trash2, Info, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { MediaLibraryPicker } from "@/components/media/MediaLibraryPicker";
import { useAppearance } from "@/lib/theme/appearance-context";
import type { MediaItem } from "@/lib/media-data";

export function BrandingTab() {
  const {
    currentValues,
    updateField,
    canUpdate,
    saveChanges,
    resetToSaved,
    isSaving,
    hasUnsavedChanges,
    logoAsset,
    faviconAsset,
    setLogoAsset,
    setFaviconAsset,
  } = useAppearance();

  // Media picker modal states
  const [pickerTarget, setPickerTarget] = useState<"logo" | "favicon" | null>(null);

  const handleMediaSelect = (selected: MediaItem[]) => {
    if (!selected.length) return;
    const item = selected[0];

    if (pickerTarget === "logo") {
      updateField("logoAssetId", item.id);
      setLogoAsset({
        id: item.id,
        title: item.title,
        altText: item.altText,
        fileUrl: item.fileUrl,
        thumbnailUrl: item.thumbnailUrl,
        fileType: item.fileType as any,
        category: item.category as any,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        width: item.width,
        height: item.height,
        duration: null,
        storageKey: "",
        tags: [],
        uploadedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      toast.success(`Selected "${item.title}" as primary logo.`);
    } else if (pickerTarget === "favicon") {
      updateField("faviconAssetId", item.id);
      setFaviconAsset({
        id: item.id,
        title: item.title,
        altText: item.altText,
        fileUrl: item.fileUrl,
        thumbnailUrl: item.thumbnailUrl,
        fileType: item.fileType as any,
        category: item.category as any,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        width: item.width,
        height: item.height,
        duration: null,
        storageKey: "",
        tags: [],
        uploadedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      toast.success(`Selected "${item.title}" as site favicon.`);
    }
    setPickerTarget(null);
  };

  const handleRemoveLogo = () => {
    updateField("logoAssetId", null);
    setLogoAsset(null);
    toast.info("Cleared primary logo selection in view.");
  };

  const handleRemoveFavicon = () => {
    updateField("faviconAssetId", null);
    setFaviconAsset(null);
    toast.info("Cleared favicon selection in view.");
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-brand/20 bg-panel/80 p-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-[17px] font-bold text-foreground text-glow flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand-bright" />
            Brand Visual Assets (Logo & Favicon)
          </h2>
          <p className="text-[12.5px] text-muted-foreground">
            Connect verified Media Library assets to <code>logoAssetId</code> and <code>faviconAssetId</code> in AppearanceConfig.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetToSaved}
            disabled={!hasUnsavedChanges || isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/50 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:border-brand-bright/40 hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" />
            Discard Edits
          </button>
          {canUpdate && (
            <button
              type="button"
              onClick={() => saveChanges()}
              disabled={!hasUnsavedChanges || isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-bright/50 bg-brand-bright/15 px-4 py-1.5 text-[12px] font-semibold text-brand-bright shadow-[0_0_12px_rgba(0,255,170,0.2)] transition hover:bg-brand-bright/25 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Save Branding Assets
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 1. Logos System */}
      <SettingsCard
        title="Primary Navbar Logo"
        subtitle="Stored as verified MediaAsset reference (logoAssetId) in AppearanceConfig."
      >
        <div className="rounded-xl border border-brand/20 bg-background/50 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-xl border border-brand/30 bg-panel/90 p-2 shadow-inner">
                {logoAsset?.fileUrl ? (
                  <img
                    src={logoAsset.fileUrl}
                    alt={logoAsset.altText || "Selected Logo"}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="size-8 text-brand/40" />
                )}
              </div>
              <div>
                <p className="font-semibold text-[13px] text-foreground">
                  {logoAsset ? logoAsset.title : "Default Vector Cobra Emblem"}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                  Asset ID: {currentValues.logoAssetId || "None (Using Default Branding)"}
                </p>
                {logoAsset && (
                  <p className="text-[11px] text-brand-bright mt-0.5">
                    {logoAsset.width}×{logoAsset.height} px • {(logoAsset.fileSize / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPickerTarget("logo")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-[12px] font-semibold text-brand-bright transition hover:bg-brand/20"
              >
                <Upload className="size-3.5" />
                Choose from Media Library
              </button>
              {currentValues.logoAssetId && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-300 transition hover:bg-red-500/20"
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 2. Favicon System */}
      <SettingsCard
        title="Browser Tab Favicon"
        subtitle="Stored as verified MediaAsset reference (faviconAssetId) in AppearanceConfig."
      >
        <div className="rounded-xl border border-brand/20 bg-background/50 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-xl border border-brand/30 bg-panel/90 p-2 shadow-inner">
                {faviconAsset?.fileUrl ? (
                  <img
                    src={faviconAsset.fileUrl}
                    alt={faviconAsset.altText || "Selected Favicon"}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="size-6 text-brand/40" />
                )}
              </div>
              <div>
                <p className="font-semibold text-[13px] text-foreground">
                  {faviconAsset ? faviconAsset.title : "Default Portal Favicon (/favicon.png)"}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                  Asset ID: {currentValues.faviconAssetId || "None (Using System Default)"}
                </p>
                {faviconAsset && (
                  <p className="text-[11px] text-brand-bright mt-0.5">
                    {faviconAsset.width}×{faviconAsset.height} px • {(faviconAsset.fileSize / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPickerTarget("favicon")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-[12px] font-semibold text-brand-bright transition hover:bg-brand/20"
              >
                <Upload className="size-3.5" />
                Choose from Media Library
              </button>
              {currentValues.faviconAssetId && (
                <button
                  type="button"
                  onClick={handleRemoveFavicon}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-300 transition hover:bg-red-500/20"
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 3. Site Settings Architecture Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-background/50 p-4 text-[12px] text-muted-foreground">
        <Info className="size-4 text-brand-bright shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Site Settings Ownership Notice: </span>
          <span>
            Brand Name, Tagline, SEO Description, and OpenGraph social banner metadata are managed exclusively under{" "}
            <strong>Site Settings → SEO & Metadata</strong>. This ensures single-source-of-truth governance without
            duplicate database entries.
          </span>
        </div>
      </div>

      {/* Media Picker Modal */}
      {pickerTarget && (
        <MediaLibraryPicker
          open={Boolean(pickerTarget)}
          onClose={() => setPickerTarget(null)}
          onSelect={handleMediaSelect}
          title={pickerTarget === "logo" ? "Select Navbar Logo Asset" : "Select Browser Favicon Asset"}
          allowedTypes={["Image"]}
          multiple={false}
          initialCategory="BRANDING"
        />
      )}
    </div>
  );
}
