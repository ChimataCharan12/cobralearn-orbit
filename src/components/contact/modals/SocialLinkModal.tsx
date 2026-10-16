import { useState, useEffect } from "react";
import { X, Globe, ExternalLink, Check } from "lucide-react";
import { type ContactSocialLink } from "@/lib/contact-data";
import { toast } from "sonner";

interface SocialLinkModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (link: Omit<ContactSocialLink, "id" | "order">) => void;
  initialData?: ContactSocialLink | null;
}

const PLATFORM_PRESETS = [
  { platform: "LinkedIn", icon: "Linkedin", urlPrefix: "https://linkedin.com/company/" },
  { platform: "Instagram", icon: "Instagram", urlPrefix: "https://instagram.com/" },
  { platform: "YouTube", icon: "Youtube", urlPrefix: "https://youtube.com/@" },
  { platform: "X (Twitter)", icon: "X", urlPrefix: "https://x.com/" },
  { platform: "GitHub", icon: "Github", urlPrefix: "https://github.com/" },
  { platform: "Discord", icon: "Globe", urlPrefix: "https://discord.gg/" },
  { platform: "Facebook", icon: "Globe", urlPrefix: "https://facebook.com/" },
  { platform: "Custom Platform", icon: "Globe", urlPrefix: "https://" },
];

export function SocialLinkModal({
  open,
  onClose,
  onSave,
  initialData,
}: SocialLinkModalProps) {
  const [platform, setPlatform] = useState(initialData?.platform || "LinkedIn");
  const [label, setLabel] = useState(initialData?.label || "LinkedIn");
  const [url, setUrl] = useState(initialData?.url || "https://");
  const [icon, setIcon] = useState(initialData?.icon || "Linkedin");
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);

  useEffect(() => {
    if (initialData) {
      setPlatform(initialData.platform);
      setLabel(initialData.label);
      setUrl(initialData.url);
      setIcon(initialData.icon);
      setEnabled(initialData.enabled);
    } else {
      setPlatform("LinkedIn");
      setLabel("LinkedIn");
      setUrl("https://linkedin.com");
      setIcon("Linkedin");
      setEnabled(true);
    }
  }, [initialData, open]);

  if (!open) return null;

  const handleSelectPreset = (preset: typeof PLATFORM_PRESETS[0]) => {
    setPlatform(preset.platform);
    setLabel(preset.platform);
    setIcon(preset.icon);
    if (url === "https://" || !url) {
      setUrl(preset.urlPrefix);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUrl = url.trim();
    if (!trimmedUrl || (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://"))) {
      toast.error("Please enter a valid URL starting with https:// or http://");
      return;
    }

    if (!label.trim()) {
      toast.error("Please enter a display label.");
      return;
    }

    onSave({
      platform: platform.trim(),
      label: label.trim(),
      url: trimmedUrl,
      icon,
      enabled,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-brand/35 bg-[#080d0a] shadow-[0_0_40px_rgba(0,0,0,0.8),0_0_20px_color-mix(in_oklab,var(--brand)_15%,transparent)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand/20 bg-[#0b120e] px-6 py-4">
          <div>
            <h2 className="font-display text-[17px] font-bold text-foreground text-glow">
              {initialData ? "Edit Social Link" : "Add Social Link"}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Configure target URL and visibility for public showcase.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-brand/15 hover:text-foreground cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Presets row */}
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1.5">
              Quick Preset Platform
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_PRESETS.slice(0, 5).map((preset) => (
                <button
                  key={preset.platform}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition ${
                    platform === preset.platform
                      ? "border-brand-bright bg-brand/25 text-brand-bright shadow-[0_0_8px_var(--brand-bright)]"
                      : "border-brand/20 bg-background/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {preset.platform}
                </button>
              ))}
            </div>
          </div>

          {/* Platform Name */}
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
              Platform Name <span className="text-brand-bright">*</span>
            </label>
            <input
              type="text"
              required
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>

          {/* Display Label */}
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
              Display Label / Alt Text <span className="text-brand-bright">*</span>
            </label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
              Profile URL <span className="text-brand-bright">*</span>
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://linkedin.com/company/cobralearn"
              className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] font-mono text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-brand/20 bg-background/50 p-3 pt-2">
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">Active on Public Website</p>
              <p className="text-[11px] text-muted-foreground">Show or hide this social icon.</p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                enabled ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ${
                  enabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-brand/15">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-brand/25 bg-panel px-4 py-2 text-[12.5px] font-semibold text-foreground/80 hover:bg-panel-strong cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-brand-bright px-5 py-2 text-[12.5px] font-bold text-black shadow-[0_0_12px_var(--brand-bright)] hover:bg-brand-bright/90 cursor-pointer"
            >
              <Check className="size-4 stroke-[2.5]" />
              <span>{initialData ? "Update Link" : "Add Link"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
