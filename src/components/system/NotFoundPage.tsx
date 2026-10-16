import { Home, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import environment from "@/assets/cobralearn-404-bg.jpg";
import emblem from "@/assets/cobralearn-emblem.png";

export function NotFoundPage() {
  return (
    <main className="relative min-h-screen lg:h-dvh lg:min-h-0 lg:max-h-dvh w-full overflow-x-hidden overflow-y-auto lg:overflow-hidden bg-[#020604] flex flex-col items-center justify-between py-5 sm:py-7 px-4 select-none">
      {/* 1. Pure Clean Scenery Background Plate (Ultra-bright, no darkening overlay) */}
      <img
        src={environment}
        alt="CobraLearn 404 Environment"
        aria-hidden="true"
        className="fixed inset-0 h-full w-full object-cover object-center pointer-events-none z-0"
      />

      {/* 2. Top Branding */}
      <header className="relative z-10 flex flex-col items-center text-center pt-1 sm:pt-2">
        <Link
          to="/"
          className="group flex items-center gap-2.5 sm:gap-3.5 text-left transition-transform hover:scale-[1.02] active:scale-[0.99] cursor-pointer"
        >
          <img
            src={emblem}
            alt="CobraLearn Emblem"
            width={48}
            height={48}
            className="size-10 sm:size-11 object-contain drop-shadow-[0_0_14px_rgba(0,255,135,0.75)] transition-transform group-hover:rotate-3"
          />
          <div className="flex flex-col justify-center">
            <span className="font-sans text-[26px] sm:text-[29px] md:text-[30px] font-bold leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d2ff] drop-shadow-[0_0_12px_rgba(0,255,135,0.45)]">
              CobraLearn
            </span>
            <span className="mt-0.5 font-sans text-[11px] sm:text-[12px] font-semibold tracking-wider text-[#38ef7d] flex items-center gap-1">
              <span className="inline-block w-2.5 h-[1px] bg-[#38ef7d]/60" />
              Innotechcore
              <span className="inline-block w-2.5 h-[1px] bg-[#38ef7d]/60" />
            </span>
          </div>
        </Link>

        {/* Slogan */}
        <p className="mt-2 font-sans text-[11px] sm:text-[11.5px] font-semibold tracking-[0.48em] text-[#00ff87] uppercase drop-shadow-[0_0_8px_rgba(0,255,135,0.55)]">
          LEARN &nbsp;•&nbsp; BUILD &nbsp;•&nbsp; GROW
        </p>
      </header>

      {/* 3. Central 404 Showcase */}
      <section className="relative z-10 my-auto flex flex-col items-center text-center max-w-3xl px-4 py-2 sm:py-3">
        {/* Futuristic 4 - Emblem - 4 Unified Composition */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6 select-none">
          {/* Left "4" - Metallic Silver & Rich CobraLearn Green Fusion */}
          <span
            className="font-display text-[clamp(5.5rem,14vw,11rem)] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-[linear-gradient(170deg,#ffffff_0%,#e2e8f0_22%,#a7f3d0_42%,#00ff87_65%,#00e676_82%,#047857_100%)] drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)] drop-shadow-[0_0_18px_rgba(0,255,135,0.55)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
            style={{
              WebkitTextStroke: "1.5px rgba(0, 255, 135, 0.85)",
            }}
          >
            4
          </span>

          {/* Center "0" - Exact Admin Login Cobra Emblem */}
          <div className="relative flex items-center justify-center px-1">
            {/* Ambient Energy Glow Aura */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#00ff87]/35 via-[#00f28f]/25 to-[#00d2ff]/20 blur-2xl animate-pulse" />
            <img
              src={emblem}
              alt="0 (Cobra Emblem)"
              width={180}
              height={180}
              className="emblem-float size-[clamp(80px,13vw,160px)] object-contain drop-shadow-[0_0_35px_rgba(0,255,135,0.95)] drop-shadow-[0_0_80px_rgba(0,255,135,0.5)] transition-transform"
            />
          </div>

          {/* Right "4" - Metallic Silver & Rich CobraLearn Green Fusion */}
          <span
            className="font-display text-[clamp(5.5rem,14vw,11rem)] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-[linear-gradient(170deg,#ffffff_0%,#e2e8f0_22%,#a7f3d0_42%,#00ff87_65%,#00e676_82%,#047857_100%)] drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)] drop-shadow-[0_0_18px_rgba(0,255,135,0.55)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
            style={{
              WebkitTextStroke: "1.5px rgba(0, 255, 135, 0.85)",
            }}
          >
            4
          </span>
        </div>

        {/* Page Not Found Heading */}
        <h1 className="mt-3 sm:mt-4 font-sans text-[28px] sm:text-[34px] md:text-[38px] font-bold tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]">
          Page{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] drop-shadow-[0_0_20px_rgba(0,255,135,0.7)]">
            Not Found
          </span>
        </h1>

        {/* Description text */}
        <p className="mt-1.5 sm:mt-2 font-sans text-[13.5px] sm:text-[14.5px] text-[#cbd5e1] max-w-md mx-auto leading-relaxed drop-shadow-[0_1px_8px_rgba(0,0,0,0.95)]">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Action Buttons */}
        <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {/* Primary: Return to Home */}
          <Link
            to="/"
            className="inline-flex h-[42px] sm:h-[44px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] px-6 text-[13.5px] sm:text-[14px] font-bold text-[#02180c] shadow-[0_0_24px_rgba(0,255,135,0.6)] hover:shadow-[0_0_36px_rgba(0,255,135,0.85)] hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            <Home className="size-4 stroke-[2.5]" />
            <span>Return to Home &rarr;</span>
          </Link>

          {/* Secondary: Go to Dashboard */}
          <Link
            to="/admin/dashboard"
            className="inline-flex h-[42px] sm:h-[44px] items-center justify-center gap-2 rounded-[14px] border border-[#00ff87]/50 bg-[#020e06]/80 backdrop-blur-md px-6 text-[13.5px] sm:text-[14px] font-semibold text-white shadow-[0_0_15px_rgba(0,255,135,0.15)] hover:border-[#00ff87]/90 hover:bg-[#00ff87]/15 hover:shadow-[0_0_25px_rgba(0,255,135,0.35)] active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            <Search className="size-4 text-[#00ff87] stroke-[2.5]" />
            <span>Go to Dashboard &rarr;</span>
          </Link>
        </div>
      </section>

      {/* 4. Footer */}
      <footer className="relative z-10 text-[11px] sm:text-[11.5px] text-[#64748b] pb-1 tracking-wide">
        CobraLearn Innotechcore &copy; {new Date().getFullYear()}
      </footer>
    </main>
  );
}
