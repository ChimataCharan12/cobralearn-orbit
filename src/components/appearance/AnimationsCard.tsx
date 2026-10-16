import { useState } from "react";
import { ArrowUp, Circle, ArrowLeft, Maximize2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function AnimationsCard() {
  const [enabled, setEnabled] = useState(true);
  const [animationStyle, setAnimationStyle] = useState("Smooth (Default)");
  const [pageTransitions, setPageTransitions] = useState("Fade + Slide");
  const [scrollAnimations, setScrollAnimations] = useState("Fade Up");
  const [activePreset, setActivePreset] = useState("fade-up");

  const handleReset = () => {
    setEnabled(true);
    setAnimationStyle("Smooth (Default)");
    setPageTransitions("Fade + Slide");
    setScrollAnimations("Fade Up");
    setActivePreset("fade-up");
    toast.success("Animation settings reset to defaults.");
  };

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Animations</h3>
          <p className="text-[12px] text-muted-foreground">Control animations and transitions across the website.</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset animations"
          className="flex size-7 items-center justify-center rounded-lg border border-brand/20 text-muted-foreground transition hover:border-brand-bright/50 hover:text-brand-bright hover:bg-brand/10"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2">
        {/* Left Controls */}
        <div className="space-y-3">
          {/* Enable Animations Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-foreground">Enable Animations</span>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                enabled ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Animation Style</label>
            <select
              value={animationStyle}
              onChange={(e) => setAnimationStyle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="Smooth (Default)">Smooth (Default)</option>
              <option value="Fast & Crisp">Fast & Crisp</option>
              <option value="Cinematic">Cinematic</option>
              <option value="Gentle">Gentle</option>
            </select>
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Page Transitions</label>
            <select
              value={pageTransitions}
              onChange={(e) => setPageTransitions(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="Fade + Slide">Fade + Slide</option>
              <option value="Fade Only">Fade Only</option>
              <option value="Slide Up">Slide Up</option>
              <option value="Scale Fade">Scale Fade</option>
            </select>
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Scroll Animations</label>
            <select
              value={scrollAnimations}
              onChange={(e) => setScrollAnimations(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="Fade Up">Fade Up</option>
              <option value="Fade In">Fade In</option>
              <option value="Reveal Left">Reveal Left</option>
              <option value="None">None</option>
            </select>
          </div>
        </div>

        {/* Right 2x2 Preset Selector Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Fade Up */}
          <button
            type="button"
            onClick={() => setActivePreset("fade-up")}
            className={`card-interactive flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
              activePreset === "fade-up"
                ? "border-brand-bright bg-brand/15 shadow-[0_0_14px_rgba(0,255,170,0.22)]"
                : "border-brand/15 bg-background/50 hover:border-brand-bright/40 hover:bg-background/80"
            }`}
          >
            <ArrowUp className={`size-5 ${activePreset === "fade-up" ? "text-brand-bright" : "text-foreground/75"}`} />
            <span className={`text-[12px] font-medium ${activePreset === "fade-up" ? "text-brand-bright font-semibold" : "text-foreground/80"}`}>
              Fade Up
            </span>
          </button>

          {/* Fade In */}
          <button
            type="button"
            onClick={() => setActivePreset("fade-in")}
            className={`card-interactive flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
              activePreset === "fade-in"
                ? "border-brand-bright bg-brand/15 shadow-[0_0_14px_rgba(0,255,170,0.22)]"
                : "border-brand/15 bg-background/50 hover:border-brand-bright/40 hover:bg-background/80"
            }`}
          >
            <Circle className={`size-4.5 ${activePreset === "fade-in" ? "text-brand-bright" : "text-foreground/75"}`} />
            <span className={`text-[12px] font-medium ${activePreset === "fade-in" ? "text-brand-bright font-semibold" : "text-foreground/80"}`}>
              Fade In
            </span>
          </button>

          {/* Slide Left */}
          <button
            type="button"
            onClick={() => setActivePreset("slide-left")}
            className={`card-interactive flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
              activePreset === "slide-left"
                ? "border-brand-bright bg-brand/15 shadow-[0_0_14px_rgba(0,255,170,0.22)]"
                : "border-brand/15 bg-background/50 hover:border-brand-bright/40 hover:bg-background/80"
            }`}
          >
            <ArrowLeft className={`size-5 ${activePreset === "slide-left" ? "text-brand-bright" : "text-foreground/75"}`} />
            <span className={`text-[12px] font-medium ${activePreset === "slide-left" ? "text-brand-bright font-semibold" : "text-foreground/80"}`}>
              Slide Left
            </span>
          </button>

          {/* Scale In */}
          <button
            type="button"
            onClick={() => setActivePreset("scale-in")}
            className={`card-interactive flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
              activePreset === "scale-in"
                ? "border-brand-bright bg-brand/15 shadow-[0_0_14px_rgba(0,255,170,0.22)]"
                : "border-brand/15 bg-background/50 hover:border-brand-bright/40 hover:bg-background/80"
            }`}
          >
            <Maximize2 className={`size-4.5 ${activePreset === "scale-in" ? "text-brand-bright" : "text-foreground/75"}`} />
            <span className={`text-[12px] font-medium ${activePreset === "scale-in" ? "text-brand-bright font-semibold" : "text-foreground/80"}`}>
              Scale In
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
