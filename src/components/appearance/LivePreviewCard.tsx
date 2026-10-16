import { useState } from "react";
import { Monitor, Tablet, Smartphone, Play, ArrowRight } from "lucide-react";
import emblem from "@/assets/cobralearn-emblem.png";
import heroImg from "@/assets/appearance-hero-preview.png";

export function LivePreviewCard() {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      {/* Header with Device Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div>
          <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Live Preview</h3>
          <p className="text-[12px] text-muted-foreground">See how your changes look on the website.</p>
        </div>

        {/* Device Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-brand/20 bg-background/60 p-1">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] transition cursor-pointer ${
              device === "desktop"
                ? "border border-brand-bright/70 bg-brand/20 text-brand-bright font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Monitor className="size-3.5" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice("tablet")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] transition cursor-pointer ${
              device === "tablet"
                ? "border border-brand-bright/70 bg-brand/20 text-brand-bright font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Tablet className="size-3.5" />
            <span>Tablet</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] transition cursor-pointer ${
              device === "mobile"
                ? "border border-brand-bright/70 bg-brand/20 text-brand-bright font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="size-3.5" />
            <span>Mobile</span>
          </button>
        </div>
      </div>

      {/* Website Preview Window */}
      <div
        className={`mx-auto overflow-hidden rounded-xl border border-brand/25 bg-[#080F0E] shadow-2xl transition-all duration-300 ${
          device === "desktop" ? "w-full" : device === "tablet" ? "max-w-[85%]" : "max-w-[65%]"
        }`}
      >
        {/* Mini Navbar */}
        <div className="flex items-center justify-between border-b border-brand/15 px-3.5 py-2 bg-background/80">
          <div className="flex items-center gap-1.5">
            <img src={emblem} alt="Logo" className="size-5 object-contain" />
            <span className="font-display text-[12px] font-bold text-foreground">
              CobraLearn <span className="text-[9px] font-normal text-brand-cyan">innotechcore</span>
            </span>
          </div>

          <div className="hidden items-center gap-3 text-[11px] text-foreground/80 md:flex">
            <span>Home</span>
            <span>Courses</span>
            <span>Workshops</span>
            <span>Projects</span>
            <span>Blog</span>
          </div>

          <button
            type="button"
            className="rounded-md border border-brand-bright bg-brand-bright px-2.5 py-0.5 text-[10.5px] font-bold text-background shadow-[0_0_8px_rgba(0,255,170,0.3)]"
          >
            Get Started
          </button>
        </div>

        {/* Hero Section */}
        <div className="relative flex items-center justify-between px-5 py-6 overflow-hidden">
          {/* Subtle background ambient glow */}
          <div className="pointer-events-none absolute -left-10 -top-10 size-48 rounded-full bg-brand/15 blur-2xl" />

          {/* Left Hero Content */}
          <div className="relative z-10 max-w-[62%]">
            <p className="font-display text-[9.5px] font-bold tracking-[0.25em] text-brand-bright">
              LEARN • BUILD • GROW
            </p>
            <h2 className="mt-1 font-display text-[22px] font-extrabold leading-tight text-foreground">
              Future Skills <br />
              <span className="bg-gradient-to-r from-brand-bright via-brand-cyan to-white bg-clip-text text-transparent">
                For a Better Tomorrow
              </span>
            </h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/75">
              Join CobraLearn to learn from industry experts, work on real-world projects, and grow your career.
            </p>

            {/* CTAs */}
            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1 rounded-md border border-brand-bright/80 bg-brand-bright px-3 py-1 text-[11px] font-bold text-background shadow-[0_0_12px_rgba(0,255,170,0.35)]"
              >
                <span>Explore Courses</span>
                <ArrowRight className="size-3" />
              </button>

              <button
                type="button"
                className="flex items-center gap-1 rounded-md border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-white/10"
              >
                <Play className="size-3 fill-current text-white/80" />
                <span>Watch Video</span>
              </button>
            </div>
          </div>

          {/* Right Hero Image */}
          <div className="relative z-10 hidden sm:block">
            <div className="relative overflow-hidden rounded-xl border border-brand/30 shadow-[0_0_16px_rgba(0,255,170,0.2)]">
              <img
                src={heroImg}
                alt="Student coding"
                className="h-[120px] w-auto object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
