import React, { useEffect, useMemo, useState } from "react";
import nexusBgWebp from "@/assets/nexus-splash-widescreen.webp";
import nexusBgPng from "@/assets/nexus-splash-widescreen.png";
import { usePublicAppearance } from "@/lib/theme/public-appearance-context";
import { useSplashProgress } from "./use-splash-progress";

export interface NexusSplashScreenProps {
  forceShow?: boolean;
  minDurationMs?: number;
  onFinished?: () => void;
}

const INITIAL_NEXUS_STAGE = { progress: 25, statusText: "Initializing experience..." };

/**
 * CobraLearn Nexus — Approved Widescreen Cinematic Public Splash Screen
 * Reproduces the approved laptop-view reference mockup with pixel-to-pixel fidelity.
 */
export function NexusSplashScreen({
  forceShow = false,
  minDurationMs = 2000,
  onFinished,
}: NexusSplashScreenProps) {
  const [isMounted, setIsMounted] = useState(false);
  const publicAppearance = usePublicAppearance();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // usePublicAppearance() returns PublicAppearanceConfig directly.
  // When brandPrimaryColor or themePreset is present, appearance configuration is resolved.
  const hasAppearance = Boolean(
    publicAppearance && (publicAppearance.brandPrimaryColor || publicAppearance.themePreset)
  );

  const intermediateStage = useMemo(() => {
    return hasAppearance
      ? { progress: 65, statusText: "Configuring environment..." }
      : null;
  }, [hasAppearance]);

  // Genuine readiness: client DOM mounted AND public appearance resolved
  const isReady = isMounted && hasAppearance;

  const { visible, fading, progress, statusText, reducedMotion } = useSplashProgress({
    storageKey: "cobralearn_nexus_splash_done",
    initialStage: INITIAL_NEXUS_STAGE,
    intermediateStage,
    isReady,
    forceShow,
    minDurationMs,
  });

  useEffect(() => {
    if (!visible && onFinished) {
      onFinished();
    }
  }, [visible, onFinished]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="CobraLearn Nexus startup"
      data-testid="nexus-splash-screen"
      className={`fixed inset-0 w-screen h-screen h-[100dvh] z-[99999] overflow-hidden bg-[#020806] select-none transition-opacity ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      } ${reducedMotion ? "duration-75" : "duration-500 ease-out"}`}
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        border: "none",
        outline: "none",
      }}
    >
      {/* Accessible DOM announcements for assistive technologies and automated testing */}
      <div className="sr-only">
        <h1>
          <span>CobraLearn</span> <span>Nexus</span>
        </h1>
        <p>Projects. Innovation. Digital Excellence.</p>
      </div>

      {/* Edge-to-Edge 16:9 Widescreen Approved Visual Plate */}
      <div className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden z-0 flex items-center justify-center">
        <picture className="w-full h-full block">
          <source srcSet={nexusBgWebp} type="image/webp" />
          <img
            src={nexusBgPng}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center pointer-events-none select-none"
          />
        </picture>
      </div>

      {/* Vignette edge mask to guarantee seamless fullscreen border blend */}
      <div
        className="absolute inset-0 pointer-events-none select-none z-[1] bg-[radial-gradient(ellipse_at_center,transparent_60%,#020806_98%)]"
        aria-hidden="true"
      />

      {/* Dynamic Progress Bar & Status Text precisely calibrated over the artwork slot */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-[11vh] sm:pb-[11.5vh] md:pb-[12vh] pointer-events-none">
        {/* Dynamic Rounded Progress Bar */}
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="CobraLearn Nexus initialization progress"
          className="w-[260px] sm:w-[280px] md:w-[300px] h-[7px] sm:h-[8px] rounded-full bg-[#031518]/90 border border-teal-500/40 p-[1px] shadow-[0_0_15px_rgba(0,240,255,0.25)] overflow-hidden relative pointer-events-auto"
        >
          <div
            className={`h-full rounded-full bg-gradient-to-r from-[#00f0ff] to-[#00ff87] shadow-[0_0_12px_#00ff87] ${
              reducedMotion ? "" : "transition-all duration-300 ease-out"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Dynamic Status Text */}
        <p
          className="mt-2.5 text-[11px] sm:text-xs text-teal-300/85 font-mono tracking-wider text-center drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] pointer-events-auto"
          aria-live="polite"
        >
          {statusText}
        </p>
      </div>
    </div>
  );
}
