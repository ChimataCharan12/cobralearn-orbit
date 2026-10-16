import { useState } from "react";
import { LayoutGrid, RotateCcw, Check, Monitor, Smartphone, Tablet, Laptop } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { SettingRow } from "@/components/common/settings/SettingRow";
import { SettingToggle } from "@/components/common/settings/SettingToggle";

export function LayoutResponsiveTab() {
  // Container
  const [maxWidth, setMaxWidth] = useState("1280px");
  const [containerFluid, setContainerFluid] = useState(false);
  const [containerPadding, setContainerPadding] = useState(24);

  // Section
  const [sectionPaddingY, setSectionPaddingY] = useState(80);
  const [sectionMarginY, setSectionMarginY] = useState(40);
  const [sectionGap, setSectionGap] = useState(32);

  // Grid
  const [gridColumns, setGridColumns] = useState("12");
  const [columnGap, setColumnGap] = useState(24);
  const [rowGap, setRowGap] = useState(32);

  // Border Radius
  const [radiusSmall, setRadiusSmall] = useState(6);
  const [radiusMedium, setRadiusMedium] = useState(12);
  const [radiusLarge, setRadiusLarge] = useState(20);
  const [radiusFull, setRadiusFull] = useState(9999);

  // Responsive Breakpoints View Preview
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "laptop" | "tablet" | "mobile">("desktop");
  const [mobilePadding, setMobilePadding] = useState(16);
  const [tabletPadding, setTabletPadding] = useState(20);
  const [desktopPadding, setDesktopPadding] = useState(24);
  const [mobileFontScaling, setMobileFontScaling] = useState("90%");
  const [mobileSectionSpacing, setMobileSectionSpacing] = useState("48px");

  const handleReset = () => {
    setMaxWidth("1280px");
    setContainerFluid(false);
    setContainerPadding(24);
    setSectionPaddingY(80);
    setSectionMarginY(40);
    setSectionGap(32);
    setGridColumns("12");
    setColumnGap(24);
    setRowGap(32);
    setRadiusSmall(6);
    setRadiusMedium(12);
    setRadiusLarge(20);
    setRadiusFull(9999);
    setMobilePadding(16);
    setTabletPadding(20);
    setDesktopPadding(24);
    setMobileFontScaling("90%");
    setMobileSectionSpacing("48px");
    toast.info("Layout & responsive settings reset to standard grid defaults in view (preview-only).");
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-brand/20 bg-panel/80 p-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[17px] font-bold text-foreground text-glow flex items-center gap-2">
              <LayoutGrid className="size-4 text-brand-bright" />
              Layout & Responsive System
            </h2>
            <span className="text-[10px] font-semibold text-brand-cyan bg-brand/15 px-2 py-0.5 rounded border border-brand/30">
              Interactive Preview Sandbox
            </span>
          </div>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            Configure container widths, section rhythms, CSS grid gutters, and device breakpoint scaling in preview.
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

      {/* Live Schematic Interactive Wireframe */}
      <SettingsCard
        title="Interactive Layout Schematic Wireframe"
        description="Visual architectural representation of container bounds, section padding, and responsive gutters."
        badge="Schematic"
      >
        <div className="space-y-3">
          {/* Device Selector */}
          <div className="flex items-center justify-between border-b border-brand/15 pb-2.5">
            <span className="text-[12px] font-medium text-muted-foreground">Viewport Simulation:</span>
            <div className="inline-flex rounded-lg border border-brand/20 bg-background/60 p-1">
              {[
                { id: "desktop" as const, label: "Large Desktop (>1440px)", icon: Monitor },
                { id: "laptop" as const, label: "Desktop (1024-1440px)", icon: Laptop },
                { id: "tablet" as const, label: "Tablet (640-1024px)", icon: Tablet },
                { id: "mobile" as const, label: "Mobile (<640px)", icon: Smartphone },
              ].map((dev) => {
                const Icon = dev.icon;
                return (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => setPreviewDevice(dev.id)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition ${
                      previewDevice === dev.id
                        ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.2)]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span className="hidden sm:inline">{dev.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wireframe Box */}
          <div className="relative flex flex-col items-center justify-between rounded-xl border border-dashed border-brand/35 bg-background/50 p-5 overflow-hidden">
            {/* Top Section Padding Annotation */}
            <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
              <span className="h-px w-8 bg-brand/30" />
              <span>Section Top Padding:</span>
              <span className="text-brand-bright font-bold">
                {previewDevice === "mobile" ? mobileSectionSpacing : `${sectionPaddingY}px`}
              </span>
              <span className="h-px w-8 bg-brand/30" />
            </div>

            {/* Container Wireframe Box */}
            <div
              className={`my-4 transition-all duration-300 rounded-xl border border-brand-bright/70 bg-brand/10 p-4 shadow-[0_0_20px_rgba(0,255,170,0.15)] ${
                previewDevice === "mobile"
                  ? "w-full max-w-[280px]"
                  : previewDevice === "tablet"
                  ? "w-[80%] max-w-[500px]"
                  : previewDevice === "laptop"
                  ? "w-[90%] max-w-[720px]"
                  : "w-[95%] max-w-[900px]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-brand/20 pb-2">
                <span className="text-[11px] font-semibold text-foreground">
                  Main Content Container {containerFluid ? "(Fluid 100%)" : `(${maxWidth})`}
                </span>
                <span className="text-[10px] font-mono text-brand-bright">
                  Gutters: {previewDevice === "mobile" ? `${mobilePadding}px` : `${containerPadding}px`}
                </span>
              </div>

              {/* Grid Columns Wireframe Simulation */}
              <div
                className="mt-3 grid gap-2"
                style={{
                  gridTemplateColumns:
                    previewDevice === "mobile"
                      ? "repeat(2, minmax(0, 1fr))"
                      : previewDevice === "tablet"
                      ? "repeat(4, minmax(0, 1fr))"
                      : `repeat(${Math.min(Number(gridColumns), 12)}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({
                  length:
                    previewDevice === "mobile"
                      ? 2
                      : previewDevice === "tablet"
                      ? 4
                      : Math.min(Number(gridColumns), 12),
                }).map((_, i) => (
                  <div
                    key={i}
                    className="flex h-12 items-center justify-center rounded-md border border-brand/30 bg-panel/80 text-[10px] font-mono text-brand-bright/80"
                  >
                    Col {i + 1}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Row Gap: {rowGap}px</span>
                <span>Column Gap: {columnGap}px</span>
                <span>Radius: {radiusMedium}px</span>
              </div>
            </div>

            {/* Bottom Section Padding Annotation */}
            <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
              <span className="h-px w-8 bg-brand/30" />
              <span>Section Bottom Padding:</span>
              <span className="text-brand-bright font-bold">
                {previewDevice === "mobile" ? mobileSectionSpacing : `${sectionPaddingY}px`}
              </span>
              <span className="h-px w-8 bg-brand/30" />
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 1. Container Settings */}
      <SettingsCard
        title="Container Layout"
        description="Define central wrapper boundaries and horizontal gutters."
        badge="Container"
      >
        <SettingRow
          label="Maximum Container Width"
          description="The fixed maximum pixel width for central page content before letterboxing."
        >
          <div className="flex items-center gap-2">
            <select
              value={maxWidth}
              onChange={(e) => setMaxWidth(e.target.value)}
              disabled={containerFluid}
              className="rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-40"
            >
              <option value="1024px">1024px (Compact)</option>
              <option value="1200px">1200px (Standard SaaS)</option>
              <option value="1280px">1280px (Default 7XL)</option>
              <option value="1440px">1440px (Wide Cinematic)</option>
              <option value="1600px">1600px (Ultra-Wide)</option>
            </select>
          </div>
        </SettingRow>

        <SettingRow
          label="Fluid Full-Width Mode"
          description="Stretch container to 100% viewport width while retaining horizontal edge padding."
        >
          <SettingToggle
            checked={containerFluid}
            onChange={setContainerFluid}
            label="Fluid Container"
          />
        </SettingRow>

        <SettingRow
          label="Desktop Horizontal Padding"
          description="Side gutter distance between container edge and browser chrome on desktop screens."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-brand-bright min-w-[45px]">{containerPadding}px</span>
            <input
              type="range"
              min="12"
              max="64"
              step="4"
              value={containerPadding}
              onChange={(e) => setContainerPadding(Number(e.target.value))}
              className="w-48 accent-brand-bright"
            />
          </div>
        </SettingRow>
      </SettingsCard>

      {/* 2. Section Spacing & Rhythms */}
      <SettingsCard
        title="Section Spacing & Vertical Rhythm"
        description="Controls vertical breathing room between major site sections and hero modules."
        badge="Sections"
      >
        <SettingRow
          label="Section Vertical Padding"
          description="Top and bottom internal padding for page sections."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-brand-bright min-w-[45px]">{sectionPaddingY}px</span>
            <input
              type="range"
              min="40"
              max="160"
              step="8"
              value={sectionPaddingY}
              onChange={(e) => setSectionPaddingY(Number(e.target.value))}
              className="w-48 accent-brand-bright"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Section Outer Margin"
          description="External margin distance between stacked consecutive sections."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-brand-bright min-w-[45px]">{sectionMarginY}px</span>
            <input
              type="range"
              min="0"
              max="96"
              step="8"
              value={sectionMarginY}
              onChange={(e) => setSectionMarginY(Number(e.target.value))}
              className="w-48 accent-brand-bright"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Section Internal Gap"
          description="Default spacing between section header, lead paragraph, and main content cards."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-brand-bright min-w-[45px]">{sectionGap}px</span>
            <input
              type="range"
              min="16"
              max="64"
              step="4"
              value={sectionGap}
              onChange={(e) => setSectionGap(Number(e.target.value))}
              className="w-48 accent-brand-bright"
            />
          </div>
        </SettingRow>
      </SettingsCard>

      {/* 3. Grid System */}
      <SettingsCard
        title="CSS Grid System"
        description="Column counts and gutter spaces for multi-item card decks and project showcases."
        badge="Grid"
      >
        <SettingRow
          label="Base Column Count"
          description="Standard desktop grid structure."
        >
          <div className="inline-flex rounded-lg border border-brand/20 bg-background/50 p-1">
            {["4", "6", "12", "16"].map((cols) => (
              <button
                key={cols}
                type="button"
                onClick={() => setGridColumns(cols)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                  gridColumns === cols
                    ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.2)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {cols} Columns
              </button>
            ))}
          </div>
        </SettingRow>

        <SettingRow
          label="Column Gap (Horizontal Gutters)"
          description="Distance between grid columns."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-brand-bright min-w-[45px]">{columnGap}px</span>
            <input
              type="range"
              min="8"
              max="48"
              step="4"
              value={columnGap}
              onChange={(e) => setColumnGap(Number(e.target.value))}
              className="w-48 accent-brand-bright"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Row Gap (Vertical Gutters)"
          description="Distance between wrapped grid rows."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-brand-bright min-w-[45px]">{rowGap}px</span>
            <input
              type="range"
              min="8"
              max="64"
              step="4"
              value={rowGap}
              onChange={(e) => setRowGap(Number(e.target.value))}
              className="w-48 accent-brand-bright"
            />
          </div>
        </SettingRow>
      </SettingsCard>

      {/* 4. Global Border Radius System */}
      <SettingsCard
        title="Border Radius Hierarchy"
        description="Corner rounding scales applied to tags, cards, buttons, and modal dialogs."
        badge="Corner Radii"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-brand/20 bg-background/40 p-3 text-center space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground">Small (Tags/Badges)</span>
            <div
              className="mx-auto flex size-14 items-center justify-center border border-brand-bright/60 bg-brand/10 font-mono text-[12px] text-brand-bright"
              style={{ borderRadius: `${radiusSmall}px` }}
            >
              {radiusSmall}px
            </div>
            <input
              type="number"
              min="0"
              max="24"
              value={radiusSmall}
              onChange={(e) => setRadiusSmall(Number(e.target.value))}
              className="w-full rounded-lg border border-brand/20 bg-background/70 px-2 py-1 text-center font-mono text-[12px] text-foreground"
            />
          </div>

          <div className="rounded-xl border border-brand/20 bg-background/40 p-3 text-center space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground">Medium (Buttons/Inputs)</span>
            <div
              className="mx-auto flex size-14 items-center justify-center border border-brand-bright/60 bg-brand/10 font-mono text-[12px] text-brand-bright"
              style={{ borderRadius: `${radiusMedium}px` }}
            >
              {radiusMedium}px
            </div>
            <input
              type="number"
              min="0"
              max="32"
              value={radiusMedium}
              onChange={(e) => setRadiusMedium(Number(e.target.value))}
              className="w-full rounded-lg border border-brand/20 bg-background/70 px-2 py-1 text-center font-mono text-[12px] text-foreground"
            />
          </div>

          <div className="rounded-xl border border-brand/20 bg-background/40 p-3 text-center space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground">Large (Panels/Cards)</span>
            <div
              className="mx-auto flex size-14 items-center justify-center border border-brand-bright/60 bg-brand/10 font-mono text-[12px] text-brand-bright"
              style={{ borderRadius: `${radiusLarge}px` }}
            >
              {radiusLarge}px
            </div>
            <input
              type="number"
              min="0"
              max="48"
              value={radiusLarge}
              onChange={(e) => setRadiusLarge(Number(e.target.value))}
              className="w-full rounded-lg border border-brand/20 bg-background/70 px-2 py-1 text-center font-mono text-[12px] text-foreground"
            />
          </div>

          <div className="rounded-xl border border-brand/20 bg-background/40 p-3 text-center space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground">Full (Pill/Avatar)</span>
            <div
              className="mx-auto flex size-14 items-center justify-center border border-brand-bright/60 bg-brand/10 font-mono text-[11px] text-brand-bright rounded-full"
            >
              Pill
            </div>
            <div className="w-full rounded-lg border border-brand/20 bg-background/70 px-2 py-1 text-center font-mono text-[12px] text-muted-foreground">
              9999px
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 5. Responsive Breakpoint Customization */}
      <SettingsCard
        title="Responsive Breakpoint Fine-Tuning"
        description="Adapt spacing and text scales dynamically on handheld touch screens."
        badge="Breakpoints"
      >
        <SettingRow
          label="Mobile Horizontal Padding (<640px)"
          description="Edge inset on compact smartphone screens."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-brand-bright min-w-[45px]">{mobilePadding}px</span>
            <input
              type="range"
              min="8"
              max="32"
              step="2"
              value={mobilePadding}
              onChange={(e) => setMobilePadding(Number(e.target.value))}
              className="w-48 accent-brand-bright"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Tablet Horizontal Padding (640px - 1024px)"
          description="Edge inset on iPads and small tablets."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-brand-bright min-w-[45px]">{tabletPadding}px</span>
            <input
              type="range"
              min="12"
              max="40"
              step="2"
              value={tabletPadding}
              onChange={(e) => setTabletPadding(Number(e.target.value))}
              className="w-48 accent-brand-bright"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Mobile Font Scaling"
          description="Proportionally reduce heading font sizes on mobile viewports to prevent word wrapping."
        >
          <select
            value={mobileFontScaling}
            onChange={(e) => setMobileFontScaling(e.target.value)}
            className="rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="80%">80% Scale</option>
            <option value="85%">85% Scale</option>
            <option value="90%">90% Scale (Recommended)</option>
            <option value="95%">95% Scale</option>
            <option value="100%">100% (No reduction)</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Mobile Section Vertical Spacing"
          description="Tighter section spacing on mobile devices to prevent excessive scrolling."
        >
          <select
            value={mobileSectionSpacing}
            onChange={(e) => setMobileSectionSpacing(e.target.value)}
            className="rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="36px">Compact (36px)</option>
            <option value="48px">Standard Mobile (48px)</option>
            <option value="60px">Roomy (60px)</option>
          </select>
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
