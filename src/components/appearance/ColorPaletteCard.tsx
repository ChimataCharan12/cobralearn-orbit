import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface ColorItem {
  id: string;
  name: string;
  hex: string;
}

const DEFAULT_COLORS: ColorItem[] = [
  { id: "primary", name: "Primary", hex: "#00F5A7" },
  { id: "secondary", name: "Secondary", hex: "#0EA5E9" },
  { id: "accent", name: "Accent", hex: "#FACC15" },
  { id: "background", name: "Background", hex: "#080F0E" },
  { id: "surface", name: "Surface", hex: "#111827" },
  { id: "text-primary", name: "Text Primary", hex: "#F9FAFB" },
  { id: "text-secondary", name: "Text Secondary", hex: "#9CA3AF" },
];

export function ColorPaletteCard() {
  const [colors, setColors] = useState<ColorItem[]>(DEFAULT_COLORS);

  const handleColorChange = (id: string, newHex: string) => {
    setColors((prev) => prev.map((c) => (c.id === id ? { ...c, hex: newHex } : c)));
  };

  const handleReset = () => {
    setColors(DEFAULT_COLORS);
    toast.success("Color palette reset to default CobraLearn theme.");
  };

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Color Palette</h3>
          <p className="text-[12px] text-muted-foreground">Customize the main colors used across your website.</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset colors"
          className="flex size-7 items-center justify-center rounded-lg border border-brand/20 text-muted-foreground transition hover:border-brand-bright/50 hover:text-brand-bright hover:bg-brand/10"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 pt-1 sm:grid-cols-4 md:grid-cols-7">
        {colors.map((color) => (
          <div
            key={color.id}
            className="flex flex-col gap-1.5 rounded-lg border border-brand/15 bg-background/50 p-2 transition-all hover:border-brand-bright/40"
          >
            <div className="relative h-10 w-full overflow-hidden rounded-md border border-white/10 shadow-inner">
              <input
                type="color"
                value={color.hex}
                onChange={(e) => handleColorChange(color.id, e.target.value)}
                className="absolute -inset-2 size-14 cursor-pointer opacity-0"
              />
              <div
                className="h-full w-full"
                style={{ backgroundColor: color.hex }}
              />
            </div>
            <div>
              <p className="truncate text-[11px] font-semibold text-foreground/90">{color.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground uppercase">{color.hex}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
