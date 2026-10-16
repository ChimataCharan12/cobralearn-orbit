import { useState } from "react";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { SettingToggle } from "@/components/common/settings/SettingToggle";
import { RotateCcw, Check, Loader2, Sparkles, AlertCircle, Info, ShieldAlert } from "lucide-react";
import { useAppearance } from "@/lib/theme/appearance-context";
import { toast } from "sonner";

export function AnimationsTab() {
  const { currentValues, updateField, canUpdate, saveChanges, resetToSaved, isSaving, hasUnsavedChanges } =
    useAppearance();

  // OS Reduced Motion simulation preview state
  const [osReducedMotionSimulated, setOsReducedMotionSimulated] = useState(false);

  // Playground interactive demo trigger
  const [demoTrigger, setDemoTrigger] = useState(0);

  return (
    <div className="space-y-4">
      {/* 1. Global Animation & Glow Engines (Persisted to AppearanceConfig) */}
      <SettingsCard
        title="Global Animation & Atmospheric Glow Controls"
        subtitle="Global animation and glow toggles persist directly to AppearanceConfig in PostgreSQL."
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
                    <span>Save Animations</span>
                  </>
                )}
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <SettingToggle
            label="Enable Global Animations (enableAnimations)"
            description="Master switch controlling micro-interactions, float transitions, and page motion graphics."
            checked={currentValues.enableAnimations}
            onChange={(checked) => updateField("enableAnimations", checked)}
          />

          <SettingToggle
            label="Enable Atmospheric Glow Effects (enableGlowEffects)"
            description="Controls neon aura blooms, glowing border halos, and radial lighting sweeps."
            checked={currentValues.enableGlowEffects}
            onChange={(checked) => updateField("enableGlowEffects", checked)}
          />
        </div>
      </SettingsCard>

      {/* 2. Interactive Animation Playground & Simulation */}
      <SettingsCard
        title="Animation & Glow Playground"
        subtitle="Test the visual response of motion and neon glow effects."
      >
        <div className="rounded-xl border border-brand/20 bg-background/50 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setDemoTrigger((prev) => prev + 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-bright/40 bg-brand/20 px-3.5 py-1.5 text-[12px] font-semibold text-brand-bright shadow-[0_0_10px_rgba(0,255,170,0.2)] hover:bg-brand/30 transition"
            >
              <Sparkles className="size-3.5" />
              Trigger Micro-Interaction Pulse
            </button>
            <span className="text-[11.5px] text-muted-foreground font-mono">
              Status: Animations {currentValues.enableAnimations ? "ENABLED" : "DISABLED"} | Glow{" "}
              {currentValues.enableGlowEffects ? "ENABLED" : "DISABLED"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div
              key={`box-1-${demoTrigger}`}
              className={`rounded-xl border p-4 transition-all duration-300 ${
                currentValues.enableAnimations ? "hover:-translate-y-1" : ""
              } ${
                currentValues.enableGlowEffects
                  ? "border-brand-bright/50 bg-panel shadow-[0_0_16px_rgba(0,255,170,0.18)]"
                  : "border-brand/20 bg-panel/60"
              }`}
            >
              <p className="text-[11.5px] font-mono text-brand-bright">Card Elevation</p>
              <p className="font-display text-[15px] font-bold text-foreground mt-1">Interactive Card Lift</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {currentValues.enableAnimations ? "Elevates on hover with smooth cubic bezier." : "Instant static hover."}
              </p>
            </div>

            <div
              key={`box-2-${demoTrigger}`}
              className={`rounded-xl border p-4 transition-all duration-300 ${
                currentValues.enableGlowEffects
                  ? "border-cyan-400/60 bg-panel shadow-[0_0_16px_rgba(0,229,255,0.2)]"
                  : "border-brand/20 bg-panel/60"
              }`}
            >
              <p className="text-[11.5px] font-mono text-cyan-400">Atmospheric Bloom</p>
              <p className="font-display text-[15px] font-bold text-foreground mt-1">Cyan Neon Halo</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {currentValues.enableGlowEffects ? "Deep atmospheric glow aura enabled." : "Flat high-contrast border."}
              </p>
            </div>

            <div
              key={`box-3-${demoTrigger}`}
              className={`rounded-xl border p-4 transition-all duration-300 ${
                currentValues.enableAnimations ? "hover:scale-[1.02]" : ""
              } ${
                currentValues.enableGlowEffects
                  ? "border-amber-400/60 bg-panel shadow-[0_0_16px_rgba(255,184,0,0.2)]"
                  : "border-brand/20 bg-panel/60"
              }`}
            >
              <p className="text-[11.5px] font-mono text-amber-400">Accent Callout</p>
              <p className="font-display text-[15px] font-bold text-foreground mt-1">Gold Pulse Ring</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Visual highlight token used for alerts and achievements.
              </p>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 3. Accessibility & OS Reduced Motion Status */}
      <SettingsCard
        title="Accessibility & Reduced-Motion Notice"
        subtitle="Understanding OS system preferences versus administrative global toggles."
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-background/50 p-4 text-[12px] text-muted-foreground">
            <Info className="size-4 text-brand-bright shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">OS Accessibility Standards: </span>
              <span>
                CobraLearn respects operating system level <code>prefers-reduced-motion: reduce</code> media queries
                automatically for users with vestibular motion sensitivities. The administrative toggles above
                control the master site-wide baseline configuration.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-brand/15 bg-background/40 p-3.5">
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">Test Reduced-Motion Simulator in Admin</p>
              <p className="text-[11px] text-muted-foreground">
                Preview-only toggle to inspect how cards respond when reduced-motion styles are enforced.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOsReducedMotionSimulated(!osReducedMotionSimulated);
                toast.info(`Reduced-motion preview simulation ${!osReducedMotionSimulated ? "enabled" : "disabled"}.`);
              }}
              className={`rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition ${
                osReducedMotionSimulated
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-brand/10 text-brand-bright border border-brand/20 hover:bg-brand/20"
              }`}
            >
              {osReducedMotionSimulated ? "Simulation Active" : "Simulate Reduced Motion"}
            </button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
