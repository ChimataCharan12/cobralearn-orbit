import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function LayoutSpacingCard() {
  const [containerWidth, setContainerWidth] = useState("1200px (Default)");
  const [sectionSpacing, setSectionSpacing] = useState("Large (80px)");
  const [borderRadius, setBorderRadius] = useState("Medium (12px)");

  const handleReset = () => {
    setContainerWidth("1200px (Default)");
    setSectionSpacing("Large (80px)");
    setBorderRadius("Medium (12px)");
    toast.success("Layout & spacing reset to defaults.");
  };

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Layout & Spacing</h3>
          <p className="text-[12px] text-muted-foreground">Customize container width, spacing and border radius.</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset layout"
          className="flex size-7 items-center justify-center rounded-lg border border-brand/20 text-muted-foreground transition hover:border-brand-bright/50 hover:text-brand-bright hover:bg-brand/10"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2">
        {/* Dropdowns */}
        <div className="space-y-2.5">
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Container Width</label>
            <select
              value={containerWidth}
              onChange={(e) => setContainerWidth(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="1200px (Default)">1200px (Default)</option>
              <option value="1400px (Wide)">1400px (Wide)</option>
              <option value="1024px (Compact)">1024px (Compact)</option>
            </select>
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Section Spacing</label>
            <select
              value={sectionSpacing}
              onChange={(e) => setSectionSpacing(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="Large (80px)">Large (80px)</option>
              <option value="Medium (60px)">Medium (60px)</option>
              <option value="Extra Large (100px)">Extra Large (100px)</option>
            </select>
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Border Radius</label>
            <select
              value={borderRadius}
              onChange={(e) => setBorderRadius(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="Medium (12px)">Medium (12px)</option>
              <option value="Small (8px)">Small (8px)</option>
              <option value="Large (16px)">Large (16px)</option>
              <option value="Full Round (24px)">Full Round (24px)</option>
            </select>
          </div>
        </div>

        {/* Visual Container Schematic Wireframe */}
        <div className="relative flex flex-col items-center justify-between rounded-xl border border-dashed border-brand/30 bg-background/40 p-4">
          <span className="text-[10.5px] font-mono text-muted-foreground/80">
            Section Padding <span className="text-brand-bright font-bold">110px</span>
          </span>

          {/* Inner Content Box */}
          <div className="my-2.5 flex w-[85%] items-center justify-center rounded-xl border border-brand-bright/70 bg-brand/10 py-3.5 shadow-[0_0_16px_rgba(0,255,170,0.18)]">
            <div className="text-center">
              <p className="text-[11px] font-semibold text-foreground/90">Content Width</p>
              <p className="font-mono text-[13px] font-bold text-brand-bright text-glow">1200px</p>
            </div>
          </div>

          <span className="text-[10.5px] font-mono text-muted-foreground/80">
            Section Padding <span className="text-brand-bright font-bold">80px</span>
          </span>
        </div>
      </div>
    </div>
  );
}
