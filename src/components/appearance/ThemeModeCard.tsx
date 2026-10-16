import { Sun, Moon, Monitor, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface ThemeModeCardProps {
  currentTheme: "light" | "dark" | "system";
  onThemeChange: (theme: "light" | "dark" | "system") => void;
}

export function ThemeModeCard({ currentTheme, onThemeChange }: ThemeModeCardProps) {
  const handleReset = () => {
    onThemeChange("dark");
    toast.success("Theme mode reset to Dark Mode.");
  };

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Theme Mode</h3>
          <p className="text-[12px] text-muted-foreground">Choose the overall theme for your website.</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset theme"
          className="flex size-7 items-center justify-center rounded-lg border border-brand/20 text-muted-foreground transition hover:border-brand-bright/50 hover:text-brand-bright hover:bg-brand/10"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-1">
        {/* Light Mode */}
        <button
          type="button"
          onClick={() => {
            onThemeChange("light");
            toast.info("Light Mode preview enabled.");
          }}
          className={`card-interactive flex flex-col items-center justify-center gap-2 rounded-xl border p-3.5 transition-all duration-200 cursor-pointer ${
            currentTheme === "light"
              ? "border-brand-bright bg-brand/15 shadow-[0_0_14px_rgba(0,255,170,0.22)]"
              : "border-brand/15 bg-background/50 hover:border-brand-bright/40 hover:bg-background/80"
          }`}
        >
          <Sun className="size-5 text-foreground/80" />
          <span className="text-[12.5px] font-medium text-foreground">Light Mode</span>
        </button>

        {/* Dark Mode */}
        <button
          type="button"
          onClick={() => {
            onThemeChange("dark");
            toast.success("Dark Mode enabled.");
          }}
          className={`card-interactive flex flex-col items-center justify-center gap-2 rounded-xl border p-3.5 transition-all duration-200 cursor-pointer ${
            currentTheme === "dark"
              ? "border-brand-bright bg-brand/15 shadow-[0_0_16px_rgba(0,255,170,0.25)]"
              : "border-brand/15 bg-background/50 hover:border-brand-bright/40 hover:bg-background/80"
          }`}
        >
          <Moon className="size-5 text-brand-bright drop-shadow-[0_0_6px_var(--brand-bright)]" />
          <span className="text-[12.5px] font-semibold text-brand-bright text-glow">Dark Mode</span>
        </button>

        {/* System Default */}
        <button
          type="button"
          onClick={() => {
            onThemeChange("system");
            toast.info("System Default theme enabled.");
          }}
          className={`card-interactive flex flex-col items-center justify-center gap-2 rounded-xl border p-3.5 transition-all duration-200 cursor-pointer ${
            currentTheme === "system"
              ? "border-brand-bright bg-brand/15 shadow-[0_0_14px_rgba(0,255,170,0.22)]"
              : "border-brand/15 bg-background/50 hover:border-brand-bright/40 hover:bg-background/80"
          }`}
        >
          <Monitor className="size-5 text-foreground/80" />
          <span className="text-[12.5px] font-medium text-foreground">System Default</span>
        </button>
      </div>
    </div>
  );
}
