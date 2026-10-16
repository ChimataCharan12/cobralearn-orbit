import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export function AdditionalSettingsCard() {
  const [glassmorphism, setGlassmorphism] = useState(true);
  const [gradientBg, setGradientBg] = useState(true);
  const [smoothHover, setSmoothHover] = useState(true);
  const [customCursor, setCustomCursor] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState(0);

  const handleUploadClick = () => {
    toast.info("Select background image (1920x1080).");
  };

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="pb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Additional Settings</h3>
        <p className="text-[12px] text-muted-foreground">Configure additional appearance options.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 pt-1 md:grid-cols-2">
        {/* Left Column: Toggles */}
        <div className="space-y-3">
          {/* Glassmorphism */}
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-foreground">Glassmorphism Effect</span>
            <button
              type="button"
              onClick={() => setGlassmorphism(!glassmorphism)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                glassmorphism ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  glassmorphism ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Gradient Backgrounds */}
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-foreground">Gradient Backgrounds</span>
            <button
              type="button"
              onClick={() => setGradientBg(!gradientBg)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                gradientBg ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  gradientBg ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Smooth Hover Effects */}
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-foreground">Smooth Hover Effects</span>
            <button
              type="button"
              onClick={() => setSmoothHover(!smoothHover)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                smoothHover ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  smoothHover ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Custom Cursor */}
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-foreground">Custom Cursor</span>
            <button
              type="button"
              onClick={() => setCustomCursor(!customCursor)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                customCursor ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  customCursor ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Reduce Motion */}
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-foreground">Reduce Motion (Accessibility)</span>
            <button
              type="button"
              onClick={() => setReduceMotion(!reduceMotion)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                reduceMotion ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  reduceMotion ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Right Column: Background Pattern & Image */}
        <div className="space-y-3.5">
          {/* Background Pattern */}
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Background Pattern</label>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {/* Pattern 0: Glowing green rays */}
              <button
                type="button"
                onClick={() => setSelectedPattern(0)}
                className={`card-interactive relative h-12 overflow-hidden rounded-lg border transition-all ${
                  selectedPattern === 0
                    ? "border-brand-bright bg-brand/20 shadow-[0_0_12px_rgba(0,255,170,0.25)]"
                    : "border-brand/20 bg-background/50 hover:border-brand-bright/40"
                }`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(#00f5a7_1px,transparent_1px)] [background-size:8px_8px] opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-bright/40 to-transparent" />
              </button>

              {/* Pattern 1: Dot Matrix */}
              <button
                type="button"
                onClick={() => setSelectedPattern(1)}
                className={`card-interactive relative h-12 overflow-hidden rounded-lg border transition-all ${
                  selectedPattern === 1
                    ? "border-brand-bright bg-brand/20 shadow-[0_0_12px_rgba(0,255,170,0.25)]"
                    : "border-brand/20 bg-background/50 hover:border-brand-bright/40"
                }`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.25)_1.5px,transparent_1.5px)] [background-size:6px_6px]" />
              </button>

              {/* Pattern 2: Topo waves */}
              <button
                type="button"
                onClick={() => setSelectedPattern(2)}
                className={`card-interactive relative h-12 overflow-hidden rounded-lg border transition-all ${
                  selectedPattern === 2
                    ? "border-brand-bright bg-brand/20 shadow-[0_0_12px_rgba(0,255,170,0.25)]"
                    : "border-brand/20 bg-background/50 hover:border-brand-bright/40"
                }`}
              >
                <div className="absolute inset-0 opacity-40 [background:repeating-radial-gradient(circle_at_0_0,transparent_0,rgba(0,255,170,0.2)_2px,transparent_4px)]" />
              </button>

              {/* Pattern 3: Cyber Mesh */}
              <button
                type="button"
                onClick={() => setSelectedPattern(3)}
                className={`card-interactive relative h-12 overflow-hidden rounded-lg border transition-all ${
                  selectedPattern === 3
                    ? "border-brand-bright bg-brand/20 shadow-[0_0_12px_rgba(0,255,170,0.25)]"
                    : "border-brand/20 bg-background/50 hover:border-brand-bright/40"
                }`}
              >
                <div className="absolute inset-0 opacity-30 [background:linear-gradient(rgba(0,255,170,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,170,0.3)_1px,transparent_1px)] [background-size:10px_10px]" />
              </button>
            </div>
          </div>

          {/* Background Image Upload Box */}
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Background Image (Optional)</label>
            <div
              onClick={handleUploadClick}
              className="card-interactive mt-1.5 flex flex-col items-center justify-center rounded-xl border border-dashed border-brand/35 bg-background/40 px-4 py-3.5 text-center cursor-pointer transition hover:border-brand-bright/70 hover:bg-brand/5"
            >
              <Upload className="size-5 text-brand-bright" />
              <p className="mt-1 text-[12px] font-medium text-foreground">Click to upload background image</p>
              <p className="text-[10px] text-muted-foreground">PNG, JPG, WebP (Recommended: 1920x1080)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
