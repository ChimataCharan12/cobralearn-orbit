import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function TypographyCard() {
  const [primaryFont, setPrimaryFont] = useState("Inter (Default)");
  const [secondaryFont, setSecondaryFont] = useState("Poppins");
  const [fontWeight, setFontWeight] = useState("Medium 500");

  const handleReset = () => {
    setPrimaryFont("Inter (Default)");
    setSecondaryFont("Poppins");
    setFontWeight("Medium 500");
    toast.success("Typography settings reset to defaults.");
  };

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Typography</h3>
          <p className="text-[12px] text-muted-foreground">Set fonts and text styles for your website.</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset typography"
          className="flex size-7 items-center justify-center rounded-lg border border-brand/20 text-muted-foreground transition hover:border-brand-bright/50 hover:text-brand-bright hover:bg-brand/10"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2">
        {/* Controls Column */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11.5px] font-medium text-foreground/80">Primary Font</label>
              <select
                value={primaryFont}
                onChange={(e) => setPrimaryFont(e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
              >
                <option value="Inter (Default)">Inter (Default)</option>
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="Outfit">Outfit</option>
                <option value="Roboto">Roboto</option>
              </select>
            </div>

            <div>
              <label className="text-[11.5px] font-medium text-foreground/80">Secondary Font</label>
              <select
                value={secondaryFont}
                onChange={(e) => setSecondaryFont(e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
              >
                <option value="Poppins">Poppins</option>
                <option value="Space Grotesk">Space Grotesk</option>
                <option value="Inter">Inter</option>
                <option value="Outfit">Outfit</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Font Weight</label>
            <select
              value={fontWeight}
              onChange={(e) => setFontWeight(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="Regular 400">Regular 400</option>
              <option value="Medium 500">Medium 500</option>
              <option value="SemiBold 600">SemiBold 600</option>
              <option value="Bold 700">Bold 700</option>
            </select>
          </div>
        </div>

        {/* Live Font Hierarchy Sample Box */}
        <div className="flex flex-col justify-center rounded-lg border border-brand/15 bg-background/50 p-3.5 space-y-2">
          <div className="flex items-baseline justify-between border-b border-brand/10 pb-1.5">
            <span className="font-display text-[17px] font-bold text-foreground">Heading 1</span>
            <span className="text-[11px] text-muted-foreground font-mono">Inter / 64px / Bold</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-brand/10 pb-1.5">
            <span className="font-display text-[14px] font-semibold text-foreground">Heading 2</span>
            <span className="text-[11px] text-muted-foreground font-mono">Inter / 40px / SemiBold</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-brand/10 pb-1.5">
            <span className="font-display text-[13px] font-medium text-foreground">Heading 3</span>
            <span className="text-[11px] text-muted-foreground font-mono">Poppins / 28px / Medium</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-foreground/85">Body Text</span>
            <span className="text-[11px] text-muted-foreground font-mono">Inter / 16px / Regular</span>
          </div>
        </div>
      </div>
    </div>
  );
}
