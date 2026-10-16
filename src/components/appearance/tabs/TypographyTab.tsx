import { useState } from "react";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { RotateCcw, Check, Loader2, Sparkles, AlertCircle, Info } from "lucide-react";
import { useAppearance } from "@/lib/theme/appearance-context";
import { toast } from "sonner";

// Fonts verified to be supported by __root.tsx Google Fonts link:
// https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&family=Oxanium:wght@400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap
const SUPPORTED_FONTS = [
  { id: "Orbitron", name: "Orbitron (Futuristic Display)", category: "Display / Headings" },
  { id: "Oxanium", name: "Oxanium (Tech Cyber Display)", category: "Display / Headings" },
  { id: "Rajdhani", name: "Rajdhani (Technical Condensed)", category: "Body / Technical UI" },
  { id: "Space Grotesk", name: "Space Grotesk (Clean Modernist)", category: "Display / Modern Sans" },
  { id: "Inter", name: "Inter (Universal Sans)", category: "Body / UI Default" },
];

export function TypographyTab() {
  const { currentValues, updateField, canUpdate, saveChanges, resetToSaved, isSaving, hasUnsavedChanges } =
    useAppearance();

  // Preview-only sample state for heading level testing
  const [previewSampleLevel, setPreviewSampleLevel] = useState<"H1" | "H2" | "H3" | "H4">("H1");

  return (
    <div className="space-y-4">
      {/* 1. Global Font Families (Persisted to AppearanceConfig) */}
      <SettingsCard
        title="Global Font Architecture"
        subtitle="Heading and body fonts persist directly to AppearanceConfig in PostgreSQL."
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
                    <span>Save Typography</span>
                  </>
                )}
              </button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Heading Font */}
          <div className="rounded-xl border border-brand/20 bg-background/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12.5px] font-semibold text-foreground">
                Primary Heading Font (<code className="text-brand-bright">fontHeading</code>)
              </label>
              <span className="font-mono text-[11px] text-brand-bright bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                Active: {currentValues.fontHeading}
              </span>
            </div>
            <select
              value={currentValues.fontHeading}
              onChange={(e) => updateField("fontHeading", e.target.value)}
              className="w-full rounded-lg border border-brand/25 bg-background/80 px-3 py-2 text-[13px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              {SUPPORTED_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.category}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Applied to page heroes, section titles, card headers, and stats numerals.
            </p>
          </div>

          {/* Body Font */}
          <div className="rounded-xl border border-brand/20 bg-background/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12.5px] font-semibold text-foreground">
                Primary Body Font (<code className="text-brand-bright">fontBody</code>)
              </label>
              <span className="font-mono text-[11px] text-brand-bright bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                Active: {currentValues.fontBody}
              </span>
            </div>
            <select
              value={currentValues.fontBody}
              onChange={(e) => updateField("fontBody", e.target.value)}
              className="w-full rounded-lg border border-brand/25 bg-background/80 px-3 py-2 text-[13px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              {SUPPORTED_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.category}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Applied to descriptive body copy, navigation labels, table cells, and captions.
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* 2. Live Typography Hierarchy Preview */}
      <SettingsCard
        title="Live Font Rendering Preview"
        subtitle="Interactive rendering of your selected Heading and Body font configuration."
      >
        <div className="rounded-xl border border-brand/25 bg-panel/90 p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-brand/15 pb-3">
            <div className="flex items-center gap-2">
              {(["H1", "H2", "H3", "H4"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPreviewSampleLevel(level)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    previewSampleLevel === level
                      ? "bg-brand/25 text-brand-bright border border-brand/40 shadow-[0_0_8px_rgba(0,255,170,0.2)]"
                      : "text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  {level} Preview
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              Family: {currentValues.fontHeading} / {currentValues.fontBody}
            </span>
          </div>

          <div className="space-y-2">
            {previewSampleLevel === "H1" && (
              <h1
                className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground text-glow"
                style={{ fontFamily: currentValues.fontHeading }}
              >
                Architecting Futuristic Digital Reality
              </h1>
            )}
            {previewSampleLevel === "H2" && (
              <h2
                className="text-xl sm:text-2xl font-bold text-foreground text-glow"
                style={{ fontFamily: currentValues.fontHeading }}
              >
                Autonomous Agent Workflow Engine & 3D Showcase
              </h2>
            )}
            {previewSampleLevel === "H3" && (
              <h3
                className="text-lg sm:text-xl font-semibold text-foreground text-glow"
                style={{ fontFamily: currentValues.fontHeading }}
              >
                Enterprise Real-Time Architecture & Analytics
              </h3>
            )}
            {previewSampleLevel === "H4" && (
              <h4
                className="text-base sm:text-lg font-semibold text-foreground"
                style={{ fontFamily: currentValues.fontHeading }}
              >
                Cybernetic Portal Interface & Visual Tokens
              </h4>
            )}

            <p
              className="text-[14px] leading-relaxed text-foreground/80 max-w-3xl pt-2"
              style={{ fontFamily: currentValues.fontBody }}
            >
              CobraLearn Innotechcore delivers state-of-the-art interactive web platforms with ultra-low latency,
              cinematic lighting blooms, and immersive engineering aesthetics. The active heading font is{" "}
              <strong className="text-brand-bright">{currentValues.fontHeading}</strong> and body text renders in{" "}
              <strong className="text-brand-bright">{currentValues.fontBody}</strong>.
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* 3. Advanced Sizing Notice (Honest Preview Status) */}
      <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-background/50 p-4 text-[12px] text-muted-foreground">
        <Info className="size-4 text-brand-bright shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Advanced Scale & Sizing Note: </span>
          <span>
            Font families (<code className="text-brand-bright">fontHeading</code>,{" "}
            <code className="text-brand-bright">fontBody</code>) are persisted directly to the database in Phase 1.
            Granular type scale, letter spacing, and line heights are governed by the established Tailwind fluid type system
            and will become configurable in a subsequent design engine phase.
          </span>
        </div>
      </div>
    </div>
  );
}
