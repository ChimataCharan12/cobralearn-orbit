import { useState } from "react";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { SettingRow } from "@/components/common/settings/SettingRow";
import { SettingToggle } from "@/components/common/settings/SettingToggle";
import { ArrowRight, Trash2, CheckCircle, AlertTriangle, AlertCircle, Info, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function ComponentsTab() {
  // Button settings
  const [btnHeight, setBtnHeight] = useState("40px (Medium)");
  const [btnRadius, setBtnRadius] = useState("10px");
  const [btnWeight, setBtnWeight] = useState("700 (Bold)");
  const [btnShadow, setBtnShadow] = useState(true);
  const [btnHoverEffect, setBtnHoverEffect] = useState("Glow + Brightness");

  // Card settings
  const [cardRadius, setCardRadius] = useState("14px");
  const [cardHoverLift, setCardHoverLift] = useState(true);
  const [cardHoverGlow, setCardHoverGlow] = useState(true);
  const [cardBlur, setCardBlur] = useState("14px");

  // Input settings
  const [inputHeight, setInputHeight] = useState("38px");
  const [inputRadius, setInputRadius] = useState("8px");
  const [inputFocusGlow, setInputFocusGlow] = useState(true);

  // Nav settings
  const [navHeight, setNavHeight] = useState("64px");
  const [navLinkSpacing, setNavLinkSpacing] = useState("24px");

  // Modal settings
  const [modalRadius, setModalRadius] = useState("16px");
  const [modalOverlayOpacity, setModalOverlayOpacity] = useState("75%");
  const [modalBlur, setModalBlur] = useState("12px");

  const handleReset = () => {
    setBtnHeight("40px (Medium)");
    setBtnRadius("10px");
    setBtnWeight("700 (Bold)");
    setBtnShadow(true);
    setBtnHoverEffect("Glow + Brightness");
    setCardRadius("14px");
    setCardHoverLift(true);
    setCardHoverGlow(true);
    setCardBlur("14px");
    setInputHeight("38px");
    setInputRadius("8px");
    setInputFocusGlow(true);
    setNavHeight("64px");
    setNavLinkSpacing("24px");
    setModalRadius("16px");
    setModalOverlayOpacity("75%");
    setModalBlur("12px");
    toast.info("Component preview styles reset to design system defaults in view (preview-only).");
  };

  return (
    <div className="space-y-4">
      {/* Informational Scope Badge */}
      <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-panel/80 p-4 text-[12.5px] text-muted-foreground">
        <Info className="size-4 text-brand-bright shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Interactive Component Sandbox (Preview-Only): </span>
          <span>
            These interactive sliders simulate component radiuses, glass blur, and button padding inside the portal
            preview. Component style variables will persist in a future advanced customization phase.
          </span>
        </div>
      </div>

      {/* 1. Buttons System */}
      <SettingsCard
        title="Button Components"
        subtitle="Global sizing, corner radius, elevation, and hover interactions for button variants."
        action={
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/60 px-3 py-1.5 text-[12px] font-medium text-foreground hover:border-brand-bright hover:text-brand-bright transition"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset Styles</span>
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Controls */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">Default Height</label>
                <select
                  value={btnHeight}
                  onChange={(e) => setBtnHeight(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
                >
                  <option value="36px (Small)">36px (Small)</option>
                  <option value="40px (Medium)">40px (Medium)</option>
                  <option value="46px (Large)">46px (Large)</option>
                </select>
              </div>

              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">Border Radius</label>
                <select
                  value={btnRadius}
                  onChange={(e) => setBtnRadius(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
                >
                  <option value="6px">6px (Subtle)</option>
                  <option value="10px">10px (Default)</option>
                  <option value="14px">14px (Rounded)</option>
                  <option value="9999px">9999px (Pill)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">Font Weight</label>
                <select
                  value={btnWeight}
                  onChange={(e) => setBtnWeight(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
                >
                  <option value="500 (Medium)">500 (Medium)</option>
                  <option value="600 (SemiBold)">600 (SemiBold)</option>
                  <option value="700 (Bold)">700 (Bold)</option>
                </select>
              </div>

              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">Hover Effect</label>
                <select
                  value={btnHoverEffect}
                  onChange={(e) => setBtnHoverEffect(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
                >
                  <option value="Glow + Brightness">Glow + Brightness</option>
                  <option value="Lift + Glow">Lift + Glow</option>
                  <option value="Scale Up">Scale Up</option>
                  <option value="Solid Highlight">Solid Highlight</option>
                </select>
              </div>
            </div>

            <SettingToggle
              label="Enable Neon Glow Shadow"
              description="Renders ambient light bloom around high-priority action buttons"
              checked={btnShadow}
              onChange={setBtnShadow}
            />
          </div>

          {/* Interactive Button Preview */}
          <div className="flex flex-col justify-center rounded-xl border border-brand/25 bg-[#080F0E] p-4">
            <p className="text-[11.5px] font-mono text-muted-foreground mb-3">Live Interactive Button Preview</p>
            <div className="flex flex-wrap items-center gap-3">
              {/* Primary */}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-brand-bright bg-gradient-to-r from-brand to-brand-bright px-4 py-2 text-[12.5px] font-bold text-background shadow-[0_0_16px_rgba(0,255,170,0.35)] transition hover:brightness-110"
              >
                <span>Primary CTA</span>
                <ArrowRight className="size-3.5" />
              </button>

              {/* Secondary */}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-brand-cyan/60 bg-brand-cyan/20 px-4 py-2 text-[12.5px] font-semibold text-brand-cyan hover:bg-brand-cyan/30 transition"
              >
                <span>Secondary</span>
              </button>

              {/* Outline */}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-brand/35 bg-background/60 px-4 py-2 text-[12.5px] font-medium text-foreground hover:border-brand-bright hover:text-brand-bright transition"
              >
                <span>Outline</span>
              </button>

              {/* Ghost */}
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
              >
                Ghost
              </button>

              {/* Danger */}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/30 px-3.5 py-2 text-[12.5px] font-semibold text-red-400 hover:bg-red-950/50 hover:border-red-500 transition"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 2. Cards & Containers */}
      <SettingsCard
        title="Card & Glass Panel System"
        subtitle="Configure the dark glass base, corner radius, backdrop blur, and hover dynamics."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">Corner Radius</label>
                <select
                  value={cardRadius}
                  onChange={(e) => setCardRadius(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
                >
                  <option value="10px">10px (Compact)</option>
                  <option value="14px">14px (Standard)</option>
                  <option value="18px">18px (Smooth)</option>
                  <option value="24px">24px (Large)</option>
                </select>
              </div>

              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">Glass Blur</label>
                <select
                  value={cardBlur}
                  onChange={(e) => setCardBlur(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
                >
                  <option value="8px">8px (Light)</option>
                  <option value="14px">14px (Balanced)</option>
                  <option value="24px">24px (Deep Frost)</option>
                </select>
              </div>
            </div>

            <SettingToggle
              label="Interactive Hover Lift (-2px)"
              description="Slight upward translation when mouse enters card"
              checked={cardHoverLift}
              onChange={setCardHoverLift}
            />

            <SettingToggle
              label="Interactive Ambient Bloom"
              description="Expanded glowing border streak and internal diffuse lighting"
              checked={cardHoverGlow}
              onChange={setCardHoverGlow}
            />
          </div>

          {/* Live Card Preview */}
          <div className="flex items-center justify-center rounded-xl border border-brand/25 bg-[#080F0E] p-4">
            <div className="card-interactive w-full max-w-[340px] rounded-xl border border-brand/35 bg-panel p-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-brand/10 pb-2 mb-2">
                <span className="font-display text-[13px] font-bold text-foreground">Interactive Card Sample</span>
                <span className="text-[10px] font-mono text-brand-bright">Hover Me</span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Hover over this card to preview the subtle lift, illuminated top streak, and ambient emerald glow.
              </p>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 3. Inputs & Badges */}
      <SettingsCard
        title="Inputs, Form Controls & Badges"
        subtitle="Configure text fields, dropdown aesthetics, and contextual badge pills."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Input Controls */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">Input Height</label>
                <select
                  value={inputHeight}
                  onChange={(e) => setInputHeight(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
                >
                  <option value="34px">34px (Compact)</option>
                  <option value="38px">38px (Standard)</option>
                  <option value="44px">44px (Spacious)</option>
                </select>
              </div>

              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">Input Radius</label>
                <select
                  value={inputRadius}
                  onChange={(e) => setInputRadius(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
                >
                  <option value="6px">6px</option>
                  <option value="8px">8px (Default)</option>
                  <option value="12px">12px</option>
                </select>
              </div>
            </div>

            <SettingToggle
              label="Input Focus Neon Glow"
              description="Emits emerald border glow ring when an input receives focus"
              checked={inputFocusGlow}
              onChange={setInputFocusGlow}
            />

            <div>
              <label className="text-[11.5px] font-medium text-foreground/80">Live Input Field Test</label>
              <input
                type="text"
                placeholder="Type here to test focus glow..."
                className="mt-1.5 w-full rounded-lg border border-brand/25 bg-background/70 px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:border-brand-bright focus:outline-none focus:ring-1 focus:ring-brand-bright"
              />
            </div>
          </div>

          {/* Badges Preview */}
          <div className="flex flex-col justify-center rounded-xl border border-brand/25 bg-[#080F0E] p-4">
            <p className="text-[11.5px] font-mono text-muted-foreground mb-3">Live Badge Variants</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
                <CheckCircle className="size-3.5" />
                <span>Success / Published</span>
              </span>

              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-400">
                <AlertTriangle className="size-3.5" />
                <span>Warning / Draft</span>
              </span>

              <span className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-[11px] font-bold text-red-400">
                <AlertCircle className="size-3.5" />
                <span>Error / Offline</span>
              </span>

              <span className="flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-brand-cyan/15 px-3 py-1 text-[11px] font-bold text-brand-cyan">
                <Info className="size-3.5" />
                <span>Neutral / Info</span>
              </span>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 4. Navigation & Modal Specifications */}
      <SettingsCard
        title="Navigation Bar & Modal Dialog System"
        subtitle="Global height, link spacing, dialog overlays, and elevation settings."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Navbar Height</label>
            <input
              type="text"
              value={navHeight}
              onChange={(e) => setNavHeight(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-2.5 py-1.5 text-[12px] text-foreground font-mono"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Navbar Link Spacing</label>
            <input
              type="text"
              value={navLinkSpacing}
              onChange={(e) => setNavLinkSpacing(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-2.5 py-1.5 text-[12px] text-foreground font-mono"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Modal Corner Radius</label>
            <input
              type="text"
              value={modalRadius}
              onChange={(e) => setModalRadius(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-2.5 py-1.5 text-[12px] text-foreground font-mono"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Modal Overlay Darkness</label>
            <input
              type="text"
              value={modalOverlayOpacity}
              onChange={(e) => setModalOverlayOpacity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-2.5 py-1.5 text-[12px] text-foreground font-mono"
            />
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
