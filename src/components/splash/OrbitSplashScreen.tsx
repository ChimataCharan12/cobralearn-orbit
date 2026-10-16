import React, { useEffect, useMemo, useState } from "react";
import orbitBgWebp from "@/assets/orbit-splash-widescreen.webp";
import orbitBgPng from "@/assets/orbit-splash-widescreen.png";
import { useAuth } from "@/lib/auth/use-auth";
import { useSplashProgress } from "./use-splash-progress";

export interface OrbitSplashScreenProps {
  forceShow?: boolean;
  minDurationMs?: number;
  onFinished?: () => void;
}

const INITIAL_ORBIT_STAGE = { progress: 25, statusText: "Preparing workspace..." };

/**
 * CobraLearn Orbit — Approved Widescreen Futuristic Command-Center Private Splash Screen
 * Reproduces the approved laptop-view reference mockup with pixel-to-pixel fidelity.
 */
export function OrbitSplashScreen({
  forceShow = false,
  minDurationMs = 2000,
  onFinished,
}: OrbitSplashScreenProps) {
  const [isMounted, setIsMounted] = useState(false);
  const { isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Real readiness signals:
  // 1. Initial mount: 25% "Preparing workspace..."
  // 2. Auth session check in flight: 45% "Verifying security credentials..."
  // 3. Auth session resolved: 80% "Initializing control center..."
  // 4. Ready: 100% "Workspace ready"
  const intermediateStage = useMemo(() => {
    return isAuthLoading
      ? { progress: 45, statusText: "Verifying security credentials..." }
      : { progress: 80, statusText: "Initializing control center..." };
  }, [isAuthLoading]);

  // Genuine readiness: client DOM mounted AND auth session resolution completed
  const isReady = isMounted && !isAuthLoading;

  const { visible, fading, progress, statusText, reducedMotion } = useSplashProgress({
    storageKey: "cobralearn_orbit_splash_done",
    initialStage: INITIAL_ORBIT_STAGE,
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
      aria-label="CobraLearn Orbit startup"
      data-testid="orbit-splash-screen"
      className={`fixed inset-0 w-screen h-screen h-[100dvh] z-[99999] overflow-hidden bg-[#020604] select-none transition-opacity ${
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
          <span>CobraLearn</span> <span>Orbit</span>
        </h1>
        <p>Your digital ecosystem. One control center.</p>
      </div>

      {/* Edge-to-Edge 16:9 Widescreen Approved Visual Plate */}
      <div className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden z-0 flex items-center justify-center">
        <picture className="w-full h-full block">
          <source srcSet={orbitBgWebp} type="image/webp" />
          <img
            src={orbitBgPng}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center pointer-events-none select-none"
          />
        </picture>
      </div>

      {/* Vignette edge mask to guarantee seamless fullscreen border blend */}
      <div
        className="absolute inset-0 pointer-events-none select-none z-[1] bg-[radial-gradient(ellipse_at_center,transparent_60%,#020604_98%)]"
        aria-hidden="true"
      />

      {/* Dynamic Progress Bar & Status Text precisely calibrated over the artwork slot */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-[10vh] sm:pb-[10.5vh] md:pb-[11vh] pointer-events-none">
        {/* Dynamic Rounded Progress Bar */}
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="CobraLearn Orbit initialization progress"
          className="w-[260px] sm:w-[280px] md:w-[300px] h-[7px] sm:h-[8px] rounded-full bg-[#031411]/90 border border-emerald-500/40 p-[1px] shadow-[0_0_15px_rgba(0,255,135,0.25)] overflow-hidden relative pointer-events-auto"
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
          className="mt-2.5 text-[11px] sm:text-xs text-emerald-300/85 font-mono tracking-wider text-center drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] pointer-events-auto"
          aria-live="polite"
        >
          {statusText}
        </p>
      </div>
    </div>
  );
}
