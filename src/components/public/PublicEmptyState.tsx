import { ArrowRight, PackageOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";

export interface PublicEmptyStateProps {
  title?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
}

export function PublicEmptyState({
  title = "Nothing Here Yet",
  description = "This section is currently empty.\nCheck back later for exciting updates!",
  ctaText = "Explore CobraLearn",
  ctaLink = "/",
}: PublicEmptyStateProps) {
  return (
    <div className="relative mx-auto my-8 sm:my-12 flex w-full max-w-2xl flex-col items-center justify-center overflow-hidden rounded-[24px] border border-[#00ff87]/25 bg-[#040e08]/75 p-8 sm:p-12 text-center backdrop-blur-2xl shadow-[0_0_35px_rgba(0,255,135,0.12),0_20px_60px_rgba(0,0,0,0.8),inset_0_0_25px_rgba(0,255,135,0.03)]">
      {/* Ambient Radial Bloom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 size-56 rounded-full bg-[#00ff87]/15 blur-3xl"
      />

      {/* Center 3D Isometric Neon Cube / Box Icon */}
      <div className="relative z-10 flex size-24 sm:size-28 items-center justify-center rounded-2xl border border-[#00ff87]/35 bg-[#02180c]/80 shadow-[0_0_30px_rgba(0,255,135,0.35),inset_0_0_20px_rgba(0,255,135,0.1)] group">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#00ff87]/10 to-transparent animate-pulse pointer-events-none" />
        <PackageOpen className="size-12 sm:size-14 text-[#00ff87] stroke-[1.8] drop-shadow-[0_0_12px_rgba(0,255,135,0.8)]" />
      </div>

      {/* Title */}
      <h2 className="relative z-10 mt-6 font-display text-[26px] sm:text-[30px] font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
        {title}
      </h2>

      {/* Description */}
      <p className="relative z-10 mt-2.5 whitespace-pre-line font-sans text-[13.5px] sm:text-[14px] leading-relaxed text-[#94a3b8] max-w-md mx-auto">
        {description}
      </p>

      {/* CTA Button */}
      <div className="relative z-10 mt-6 sm:mt-7">
        <Link
          to={ctaLink}
          className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] px-7 text-[13.5px] sm:text-[14px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(0,255,135,0.5)] hover:shadow-[0_0_30px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
        >
          <span>{ctaText}</span>
          <ArrowRight className="size-4 stroke-[2.5]" />
        </Link>
      </div>
    </div>
  );
}
