import { useState } from "react";
import { Upload, Sparkles, Eye, RotateCcw, Check, Flame, Sliders } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { SettingRow } from "@/components/common/settings/SettingRow";
import { SettingToggle } from "@/components/common/settings/SettingToggle";

export function BackgroundsEffectsTab() {
  // Background State
  const [bgType, setBgType] = useState<"solid" | "gradient" | "image" | "video">("gradient");
  const [bgPosition, setBgPosition] = useState("center");
  const [bgSize, setBgSize] = useState("cover");
  const [bgRepeat, setBgRepeat] = useState("no-repeat");
  const [overlayOpacity, setOverlayOpacity] = useState(65);
  const [bgPattern, setBgPattern] = useState(0);

  // Atmospheric Effects
  const [glowEnabled, setGlowEnabled] = useState(true);
  const [glowIntensity, setGlowIntensity] = useState("medium");
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [lightTrailsEnabled, setLightTrailsEnabled] = useState(false);
  const [floatingElements, setFloatingElements] = useState(true);
  const [gridOverlay, setGridOverlay] = useState(true);
  const [noiseTexture, setNoiseTexture] = useState(true);
  const [vignetteEffect, setVignetteEffect] = useState(true);

  // Glass Effects
  const [glassmorphism, setGlassmorphism] = useState(true);
  const [blurIntensity, setBlurIntensity] = useState(16);
  const [transparency, setTransparency] = useState(75);
  const [borderGlow, setBorderGlow] = useState(true);

  // Cursor
  const [cursorType, setCursorType] = useState<"default" | "custom">("custom");
  const [cursorGlow, setCursorGlow] = useState(true);

  // Performance
  const [effectsQuality, setEffectsQuality] = useState("high");
  const [disableOnMobile, setDisableOnMobile] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const handleReset = () => {
    setBgType("gradient");
    setBgPosition("center");
    setBgSize("cover");
    setBgRepeat("no-repeat");
    setOverlayOpacity(65);
    setBgPattern(0);
    setGlowEnabled(true);
    setGlowIntensity("medium");
    setParticlesEnabled(true);
    setLightTrailsEnabled(false);
    setFloatingElements(true);
    setGridOverlay(true);
    setNoiseTexture(true);
    setVignetteEffect(true);
    setGlassmorphism(true);
    setBlurIntensity(16);
    setTransparency(75);
    setBorderGlow(true);
    setCursorType("custom");
    setCursorGlow(true);
    setEffectsQuality("high");
    setDisableOnMobile(true);
    setReduceMotion(false);
    toast.info("Backgrounds & Effects restored to default baseline in view (preview-only).");
  };

  return (
    <div className="space-y-4">
      {/* Tab Header Controls */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-brand/20 bg-panel/80 p-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[17px] font-bold text-foreground text-glow flex items-center gap-2">
              <Sparkles className="size-4 text-brand-bright" />
              Backgrounds & Atmospheric Effects
            </h2>
            <span className="text-[10px] font-semibold text-brand-cyan bg-brand/15 px-2 py-0.5 rounded border border-brand/30">
              Interactive Preview Sandbox
            </span>
          </div>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            Configure the public portal's backdrop, lighting blooms, particle fields, and glass materials in preview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/50 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:border-brand-bright/40 hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Reset Preview Defaults
          </button>
        </div>
      </div>

      {/* 1. Global Background Type */}
      <SettingsCard
        title="Background Canvas"
        description="Choose the core backdrop presentation across the website."
        badge="Canvas"
      >
        <SettingRow
          label="Background Style"
          description="Select whether the public site uses a pure solid color, radial gradient, artwork image, or ambient video loop."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["solid", "gradient", "image", "video"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setBgType(type)}
                className={`rounded-lg border px-3 py-2 text-center text-[12px] font-medium capitalize transition ${
                  bgType === type
                    ? "border-brand-bright bg-brand/20 text-brand-bright shadow-[0_0_10px_rgba(0,255,170,0.2)]"
                    : "border-brand/20 bg-background/50 text-foreground/80 hover:border-brand/40"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </SettingRow>

        {/* Pattern Selection */}
        <SettingRow
          label="Atmospheric Background Grid / Mesh"
          description="Preset geometric pattern overlaying the dark space."
        >
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 0, label: "Emerald Ray", desc: "Radial bloom rays" },
              { id: 1, label: "Dot Matrix", desc: "Subtle cyber dots" },
              { id: 2, label: "Topo Waves", desc: "Concentric curves" },
              { id: 3, label: "Cyber Grid", desc: "Perspective grid" },
            ].map((pattern) => (
              <button
                key={pattern.id}
                type="button"
                onClick={() => setBgPattern(pattern.id)}
                className={`group relative h-14 overflow-hidden rounded-lg border text-left transition-all ${
                  bgPattern === pattern.id
                    ? "border-brand-bright bg-brand/20 shadow-[0_0_12px_rgba(0,255,170,0.25)]"
                    : "border-brand/20 bg-background/50 hover:border-brand-bright/40"
                }`}
              >
                {/* Visual schematic of pattern */}
                {pattern.id === 0 && (
                  <div className="absolute inset-0 bg-[radial-gradient(#00f5a7_1px,transparent_1px)] [background-size:8px_8px] opacity-60" />
                )}
                {pattern.id === 1 && (
                  <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.3)_1.5px,transparent_1.5px)] [background-size:6px_6px]" />
                )}
                {pattern.id === 2 && (
                  <div className="absolute inset-0 opacity-40 [background:repeating-radial-gradient(circle_at_0_0,transparent_0,rgba(0,255,170,0.25)_2px,transparent_4px)]" />
                )}
                {pattern.id === 3 && (
                  <div className="absolute inset-0 opacity-30 [background:linear-gradient(rgba(0,255,170,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,170,0.3)_1px,transparent_1px)] [background-size:10px_10px]" />
                )}
                <div className="relative z-10 flex h-full items-end p-1.5">
                  <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/90 group-hover:text-brand-bright">
                    {pattern.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </SettingRow>

        {/* Background Image Upload & Parameters */}
        <div className="rounded-xl border border-brand/20 bg-background/30 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-foreground">Background Image Asset</span>
            <span className="text-[11px] text-muted-foreground font-mono">1920 × 1080 px Recommended</span>
          </div>
          <div
            onClick={() => toast.info("Opening system file picker for background image (WebP/PNG/JPG)")}
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand/35 bg-background/40 px-4 py-5 text-center cursor-pointer transition hover:border-brand-bright hover:bg-brand/5"
          >
            <Upload className="size-6 text-brand-bright" />
            <p className="mt-1.5 text-[12.5px] font-medium text-foreground">Click to upload custom background image</p>
            <p className="text-[11px] text-muted-foreground">Supports AVIF, WebP, PNG, JPG (Max 12MB)</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 pt-1">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Position</label>
              <select
                value={bgPosition}
                onChange={(e) => setBgPosition(e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-2.5 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
              >
                <option value="center">Center</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left top">Left Top</option>
                <option value="right top">Right Top</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Size</label>
              <select
                value={bgSize}
                onChange={(e) => setBgSize(e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-2.5 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
              >
                <option value="cover">Cover (Fill Screen)</option>
                <option value="contain">Contain (Fit Aspect)</option>
                <option value="auto">Original Auto</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Repeat</label>
              <select
                value={bgRepeat}
                onChange={(e) => setBgRepeat(e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-2.5 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
              >
                <option value="no-repeat">No Repeat</option>
                <option value="repeat">Repeat (Tiled)</option>
                <option value="repeat-x">Repeat X Only</option>
                <option value="repeat-y">Repeat Y Only</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Dark Overlay</span>
                <span className="font-mono text-brand-bright">{overlayOpacity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                className="mt-2.5 w-full accent-brand-bright"
              />
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 2. Atmospheric Effects */}
      <SettingsCard
        title="Atmospheric Effects"
        description="Configure dynamic light fields, particles, and cinematic layers."
        badge="Lighting & VFX"
      >
        <SettingRow
          label="Glow Blooms"
          description="Enable vibrant emerald and cyan ambient light blooms behind key headlines and hero cards."
        >
          <div className="flex items-center gap-3">
            <select
              value={glowIntensity}
              onChange={(e) => setGlowIntensity(e.target.value)}
              disabled={!glowEnabled}
              className="rounded-lg border border-brand/20 bg-background/70 px-2.5 py-1.5 text-[12px] text-foreground disabled:opacity-40"
            >
              <option value="subtle">Subtle Bloom (20%)</option>
              <option value="medium">Medium Glow (45%)</option>
              <option value="intense">Intense Radiance (75%)</option>
            </select>
            <SettingToggle
              checked={glowEnabled}
              onChange={setGlowEnabled}
              label="Enable Light Blooms"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Ambient Floating Particles"
          description="Drifting luminous cyber motes rendered in the background canvas."
        >
          <SettingToggle
            checked={particlesEnabled}
            onChange={setParticlesEnabled}
            label="Particles"
          />
        </SettingRow>

        <SettingRow
          label="Light Trails & Ray Traces"
          description="Subtle motion light paths following user interaction or scroll velocity."
        >
          <SettingToggle
            checked={lightTrailsEnabled}
            onChange={setLightTrailsEnabled}
            label="Light Trails"
          />
        </SettingRow>

        <SettingRow
          label="Floating Geometric Elements"
          description="Slowly rotating 3D glyphs and polyhedral shapes in empty negative space."
        >
          <SettingToggle
            checked={floatingElements}
            onChange={setFloatingElements}
            label="Floating Elements"
          />
        </SettingRow>

        <SettingRow
          label="Cyber Grid Perspective"
          description="Tron-inspired floor perspective grid fading into the horizon."
        >
          <SettingToggle
            checked={gridOverlay}
            onChange={setGridOverlay}
            label="Grid Overlay"
          />
        </SettingRow>

        <SettingRow
          label="Film Grain / Noise Texture"
          description="Subtle 2% film grain prevents color banding and enhances premium cinematic feel."
        >
          <SettingToggle
            checked={noiseTexture}
            onChange={setNoiseTexture}
            label="Noise Texture"
          />
        </SettingRow>

        <SettingRow
          label="Vignette Falloff"
          description="Darkened edges focusing eye attention toward the luminous center."
        >
          <SettingToggle
            checked={vignetteEffect}
            onChange={setVignetteEffect}
            label="Vignette"
          />
        </SettingRow>
      </SettingsCard>

      {/* 3. Glass Effects */}
      <SettingsCard
        title="Glass Effects (Glassmorphism)"
        description="Fine-tune frosted translucent panels, specular reflections, and border refractions."
        badge="Material"
      >
        <SettingRow
          label="Glassmorphism System"
          description="Apply backdrop-filter blur and semi-transparency across all floating cards and dropdowns."
        >
          <SettingToggle
            checked={glassmorphism}
            onChange={setGlassmorphism}
            label="Glassmorphism"
          />
        </SettingRow>

        <SettingRow
          label="Backdrop Blur Intensity"
          description="Gaussian blur radius applied behind translucent glass surfaces."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-brand-bright min-w-[45px]">{blurIntensity}px</span>
            <input
              type="range"
              min="4"
              max="36"
              step="2"
              value={blurIntensity}
              onChange={(e) => setBlurIntensity(Number(e.target.value))}
              className="w-48 accent-brand-bright"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Surface Transparency"
          description="Higher opacity provides stronger readability, lower opacity increases glass depth."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-brand-bright min-w-[45px]">{transparency}%</span>
            <input
              type="range"
              min="20"
              max="95"
              step="5"
              value={transparency}
              onChange={(e) => setTransparency(Number(e.target.value))}
              className="w-48 accent-brand-bright"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Edge Border Specular Glow"
          description="Subtle luminous green/cyan highlight along top and left card borders."
        >
          <SettingToggle
            checked={borderGlow}
            onChange={setBorderGlow}
            label="Border Glow"
          />
        </SettingRow>
      </SettingsCard>

      {/* 4. Interactive Cursor */}
      <SettingsCard
        title="Interactive Cursor"
        description="Customize the desktop mouse pointer for public visitors."
        badge="Interactive"
      >
        <SettingRow
          label="Cursor Mode"
          description="Choose between native browser arrow or bespoke futuristic circular follower cursor."
        >
          <div className="inline-flex rounded-lg border border-brand/20 bg-background/50 p-1">
            <button
              type="button"
              onClick={() => setCursorType("default")}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                cursorType === "default"
                  ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.2)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Default Native
            </button>
            <button
              type="button"
              onClick={() => setCursorType("custom")}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                cursorType === "custom"
                  ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.2)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Futuristic Reticle
            </button>
          </div>
        </SettingRow>

        <SettingRow
          label="Cursor Glow Particle Aura"
          description="Smooth ambient neon green halo trailing the cursor path."
        >
          <SettingToggle
            checked={cursorGlow}
            onChange={setCursorGlow}
            label="Cursor Glow"
          />
        </SettingRow>
      </SettingsCard>

      {/* 5. Performance & Mobile Constraints */}
      <SettingsCard
        title="Effects Performance & Optimization"
        description="Prevent GPU stutter on lower-spec hardware and mobile devices."
        badge="Performance"
      >
        <SettingRow
          label="Effects Rendering Quality"
          description="Adjust shader resolution and particle update loops."
        >
          <select
            value={effectsQuality}
            onChange={(e) => setEffectsQuality(e.target.value)}
            className="rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="ultra">Ultra (60 FPS Uncapped)</option>
            <option value="high">High (Recommended)</option>
            <option value="medium">Balanced (Medium GPU)</option>
            <option value="eco">Eco Mode (Battery Saver)</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Disable Heavy Effects on Mobile"
          description="Automatically turns off particles, continuous canvas noise, and custom cursor on touch screens."
        >
          <SettingToggle
            checked={disableOnMobile}
            onChange={setDisableOnMobile}
            label="Disable on Mobile"
          />
        </SettingRow>

        <SettingRow
          label="Force Reduce Motion Mode"
          description="Globally disable animated atmospheric effects for users who prefer static visual presentation."
        >
          <SettingToggle
            checked={reduceMotion}
            onChange={setReduceMotion}
            label="Reduce Motion"
          />
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
