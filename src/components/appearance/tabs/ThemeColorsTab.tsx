import { useState } from "react";
import { Moon, RotateCcw, Check, Sparkles, Loader2, Info } from "lucide-react";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { useAppearance } from "@/lib/theme/appearance-context";
import { toast } from "sonner";

const PRESETS = [
  {
    id: "dark",
    name: "CobraLearn Default (Dark)",
    desc: "Signature Emerald Neon with Obsidian Dark Glass",
    primary: "#00FF87",
    secondary: "#00E5FF",
    accent: "#FFB800",
  },
  {
    id: "emerald-night",
    name: "Emerald Night",
    desc: "Vivid Forest Emerald with Deep Teal",
    primary: "#10B981",
    secondary: "#06B6D4",
    accent: "#F59E0B",
  },
  {
    id: "midnight",
    name: "Midnight Cyber",
    desc: "Cyber Neon Cyan with Pitch-Black Backdrop",
    primary: "#06B6D4",
    secondary: "#3B82F6",
    accent: "#EC4899",
  },
  {
    id: "custom",
    name: "Custom Palette",
    desc: "Custom color hex values configured by administrator",
    primary: "#8B5CF6",
    secondary: "#EC4899",
    accent: "#FACC15",
  },
];

export function ThemeColorsTab() {
  const { currentValues, updateField, canUpdate, saveChanges, resetToSaved, isSaving, hasUnsavedChanges } =
    useAppearance();

  const handleApplyPreset = (presetId: string) => {
    const found = PRESETS.find((p) => p.id === presetId);
    if (!found) return;

    updateField("themePreset", presetId);
    if (presetId !== "custom") {
      updateField("brandPrimaryColor", found.primary);
      updateField("brandSecondaryColor", found.secondary);
      updateField("brandAccentColor", found.accent);
    }
    toast.info(`Applied ${found.name} preset in view. Click "Save Changes" to persist.`);
  };

  const handleColorChange = (key: "brandPrimaryColor" | "brandSecondaryColor" | "brandAccentColor", val: string) => {
    updateField(key, val);
    updateField("themePreset", "custom");
  };

  return (
    <div className="space-y-4">
      {/* 1. Theme Mode Card — Strictly Dark-Only Governance */}
      <SettingsCard
        title="Theme System"
        subtitle="CobraLearn Innotechcore operates exclusively on a dark cinematic interface architecture."
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-brand-bright/40 bg-brand/10 p-4 shadow-[0_0_18px_rgba(0,255,170,0.14)]">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-brand-bright/50 bg-background/80 p-2.5 text-brand-bright">
              <Moon className="size-6 drop-shadow-[0_0_8px_var(--brand-bright)]" />
            </div>
            <div>
              <p className="font-display text-[14px] font-bold text-brand-bright text-glow">
                Dark Mode Active (System Standard)
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Obsidian backdrops with high-contrast emerald neon, cyan accents, and deep glass containers.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-bright/30 bg-brand/20 px-3 py-1 text-[11px] font-semibold text-brand-bright">
            <Sparkles className="size-3" />
            <span>Exclusive Portal Identity</span>
          </div>
        </div>
      </SettingsCard>

      {/* 2. Theme Presets (Persisted to AppearanceConfig.themePreset) */}
      <SettingsCard
        title="Curated Color Presets"
        subtitle="Apply pre-balanced neon color harmonies to your website branding."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => {
            const isSelected = currentValues.themePreset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleApplyPreset(p.id)}
                className={`card-interactive flex flex-col justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                  isSelected
                    ? "border-brand-bright bg-brand/15 shadow-[0_0_14px_rgba(0,255,170,0.22)]"
                    : "border-brand/15 bg-background/50 hover:border-brand-bright/40 hover:bg-background/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-display text-[13px] font-bold text-foreground">{p.name}</p>
                    {isSelected && <Check className="size-4 text-brand-bright" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{p.desc}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-brand/10">
                  <span className="size-5 rounded-full border border-white/20" style={{ backgroundColor: p.primary }} />
                  <span className="size-5 rounded-full border border-white/20" style={{ backgroundColor: p.secondary }} />
                  <span className="size-5 rounded-full border border-white/20" style={{ backgroundColor: p.accent }} />
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>

      {/* 3. Core Brand Colors (Persisted to AppearanceConfig) */}
      <SettingsCard
        title="Core Brand Color Tokens"
        subtitle="These hex values persist directly to AppearanceConfig in PostgreSQL."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetToSaved}
              disabled={!hasUnsavedChanges || isSaving}
              className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/60 px-3 py-1.5 text-[12px] font-medium text-foreground hover:border-brand-bright hover:text-brand-bright transition disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              <span>Discard Edits</span>
            </button>
            {canUpdate && (
              <button
                type="button"
                onClick={() => saveChanges()}
                disabled={!hasUnsavedChanges || isSaving}
                className="flex items-center gap-1.5 rounded-lg border border-brand-bright/50 bg-brand-bright/20 px-3.5 py-1.5 text-[12px] font-semibold text-brand-bright shadow-[0_0_12px_rgba(0,255,170,0.22)] hover:bg-brand-bright/30 transition disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    <span>Save Colors</span>
                  </>
                )}
              </button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Primary Color */}
          <div className="flex flex-col gap-2 rounded-xl border border-brand/20 bg-background/50 p-3.5 transition-all hover:border-brand-bright/40">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-foreground">Brand Primary Color</span>
              <span className="font-mono text-[11px] font-bold text-brand-bright uppercase">
                {currentValues.brandPrimaryColor}
              </span>
            </div>
            <div className="relative h-14 w-full overflow-hidden rounded-lg border border-white/10 shadow-inner group">
              <input
                type="color"
                value={currentValues.brandPrimaryColor}
                onChange={(e) => handleColorChange("brandPrimaryColor", e.target.value)}
                className="absolute -inset-4 size-24 cursor-pointer opacity-0"
              />
              <div className="h-full w-full" style={{ backgroundColor: currentValues.brandPrimaryColor }} />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition text-[11px] text-white font-medium">
                Click to Pick Color
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Neon glow accents, buttons, and prominent headings.
            </p>
          </div>

          {/* Secondary Color */}
          <div className="flex flex-col gap-2 rounded-xl border border-brand/20 bg-background/50 p-3.5 transition-all hover:border-brand-bright/40">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-foreground">Brand Secondary Color</span>
              <span className="font-mono text-[11px] font-bold text-brand-bright uppercase">
                {currentValues.brandSecondaryColor}
              </span>
            </div>
            <div className="relative h-14 w-full overflow-hidden rounded-lg border border-white/10 shadow-inner group">
              <input
                type="color"
                value={currentValues.brandSecondaryColor}
                onChange={(e) => handleColorChange("brandSecondaryColor", e.target.value)}
                className="absolute -inset-4 size-24 cursor-pointer opacity-0"
              />
              <div className="h-full w-full" style={{ backgroundColor: currentValues.brandSecondaryColor }} />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition text-[11px] text-white font-medium">
                Click to Pick Color
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Interface highlights, secondary borders, and subtle glows.
            </p>
          </div>

          {/* Accent Color */}
          <div className="flex flex-col gap-2 rounded-xl border border-brand/20 bg-background/50 p-3.5 transition-all hover:border-brand-bright/40">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-foreground">Brand Accent Color</span>
              <span className="font-mono text-[11px] font-bold text-brand-bright uppercase">
                {currentValues.brandAccentColor}
              </span>
            </div>
            <div className="relative h-14 w-full overflow-hidden rounded-lg border border-white/10 shadow-inner group">
              <input
                type="color"
                value={currentValues.brandAccentColor}
                onChange={(e) => handleColorChange("brandAccentColor", e.target.value)}
                className="absolute -inset-4 size-24 cursor-pointer opacity-0"
              />
              <div className="h-full w-full" style={{ backgroundColor: currentValues.brandAccentColor }} />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition text-[11px] text-white font-medium">
                Click to Pick Color
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Special badges, warning indicators, and celebratory highlights.
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* 4. Live Contrast & Surface Preview */}
      <SettingsCard
        title="Live Contrast & Surface Preview"
        subtitle="Visual simulation of how the currently selected brand colors contrast on obsidian glass."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-brand/25 bg-background p-4 shadow-lg">
            <p className="text-[11px] font-mono text-muted-foreground">Obsidian Canvas Surface</p>
            <p
              className="mt-2 font-display text-[16px] font-bold text-glow"
              style={{ color: currentValues.brandPrimaryColor }}
            >
              Primary Neon Highlight
            </p>
            <p className="text-[12px] text-foreground/80 mt-1">Deep obsidian base backdrop.</p>
          </div>

          <div className="rounded-xl border border-brand/35 bg-panel p-4 shadow-lg">
            <p className="text-[11px] font-mono text-muted-foreground">Elevated Glass Container</p>
            <p
              className="mt-2 font-display text-[16px] font-bold text-glow"
              style={{ color: currentValues.brandSecondaryColor }}
            >
              Secondary Cyan Glow
            </p>
            <p className="text-[12px] text-foreground/80 mt-1">Frosted glass container with ambient bloom.</p>
          </div>

          <div
            className="rounded-xl border p-4 shadow-[0_0_20px_rgba(0,255,170,0.18)]"
            style={{
              borderColor: currentValues.brandPrimaryColor,
              backgroundColor: "rgba(10, 16, 20, 0.85)",
            }}
          >
            <p className="text-[11px] font-mono" style={{ color: currentValues.brandAccentColor }}>
              Active Neon Accent
            </p>
            <p
              className="mt-2 font-display text-[16px] font-bold text-glow"
              style={{ color: currentValues.brandPrimaryColor }}
            >
              High Intensity Glow
            </p>
            <p className="text-[12px] text-foreground/80 mt-1">Used for CTAs, active pills, and focus rings.</p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
