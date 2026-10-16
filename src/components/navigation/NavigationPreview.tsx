import { useState } from "react";
import { Monitor, Tablet, Smartphone, ExternalLink, Menu, X } from "lucide-react";
import emblem from "@/assets/cobralearn-emblem.png";
import { type NavigationMenuItem } from "@/lib/navigation-data";

interface NavigationPreviewProps {
  items: NavigationMenuItem[];
}

export function NavigationPreview({ items }: NavigationPreviewProps) {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const deviceWidthClass =
    device === "mobile"
      ? "max-w-[340px]"
      : device === "tablet"
      ? "max-w-[500px]"
      : "w-full";

  const activeItems = items.filter((i) => i.status === "Active");

  return (
    <div className="flex flex-col rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      {/* Top Preview Controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-brand/15 pb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Navigation Preview</h3>

        <div className="flex items-center gap-3">
          {/* Device Toggles */}
          <div className="flex items-center rounded-lg border border-brand/25 bg-background/60 p-0.5">
            <button
              type="button"
              onClick={() => {
                setDevice("desktop");
                setMobileMenuOpen(false);
              }}
              aria-label="Desktop Preview"
              className={`flex size-7 items-center justify-center rounded transition ${
                device === "desktop"
                  ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDevice("tablet");
                setMobileMenuOpen(false);
              }}
              aria-label="Tablet Preview"
              className={`flex size-7 items-center justify-center rounded transition ${
                device === "tablet"
                  ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tablet className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDevice("mobile");
                setMobileMenuOpen(false);
              }}
              aria-label="Mobile Preview"
              className={`flex size-7 items-center justify-center rounded transition ${
                device === "mobile"
                  ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="size-3.5" />
            </button>
          </div>

          {/* View Live Site Button */}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-brand/35 bg-background/60 px-2.5 py-1 text-[11.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-brand-bright"
          >
            <span>View Live Site</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="flex justify-center overflow-hidden rounded-xl border border-brand/25 bg-background/90 p-3">
        <div className={`transition-all duration-300 ${deviceWidthClass} flex flex-col gap-2`}>
          <header className="flex items-center justify-between gap-2 rounded-lg border border-brand/20 bg-panel/90 px-3.5 py-2">
            {/* Logo */}
            <div className="flex items-center gap-1.5 shrink-0">
              <img src={emblem} alt="" className="size-6 object-contain brand-glow" />
              <div className="leading-tight">
                <span className="font-display text-[11px] font-bold text-brand">CobraLearn</span>
                <span className="block text-[7.5px] tracking-wider text-brand-cyan">innotechcore</span>
              </div>
            </div>

            {/* Desktop / Tablet View */}
            {device !== "mobile" ? (
              <nav className="flex items-center gap-2.5 text-[10.5px] font-medium text-foreground/80 flex-wrap">
                {activeItems.map((item) => {
                  const isButton = item.type === "Button";
                  if (isButton) {
                    return (
                      <span
                        key={item.id}
                        className="rounded-md bg-brand-bright px-2.5 py-1 text-[10px] font-bold text-background shadow-[0_0_8px_rgba(0,255,170,0.4)]"
                      >
                        {item.label}
                      </span>
                    );
                  }
                  return (
                    <span key={item.id} className="hover:text-brand-bright cursor-pointer">
                      {item.label}
                    </span>
                  );
                })}
                {activeItems.length === 0 && (
                  <span className="text-[10px] text-muted-foreground italic">No active nav items</span>
                )}
              </nav>
            ) : (
              /* Mobile View Hamburger */
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1 text-foreground/80 hover:text-brand-bright"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
            )}
          </header>

          {/* Mobile Dropdown Menu Preview */}
          {device === "mobile" && mobileMenuOpen && (
            <div className="rounded-lg border border-brand/20 bg-panel/95 p-3 space-y-2 animate-in fade-in duration-200">
              {activeItems.map((item) => {
                const isButton = item.type === "Button";
                return (
                  <div
                    key={item.id}
                    className={`text-[11px] py-1 px-2 rounded ${
                      isButton
                        ? "bg-brand-bright text-background font-bold text-center"
                        : "text-foreground/90 hover:text-brand-bright"
                    }`}
                  >
                    {item.label}
                  </div>
                );
              })}
              {activeItems.length === 0 && (
                <div className="text-[10px] text-muted-foreground italic text-center py-1">
                  No active nav items
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
