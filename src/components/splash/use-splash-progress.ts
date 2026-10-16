import { useEffect, useRef, useState } from "react";

export interface SplashStage {
  progress: number;
  statusText: string;
}

export interface UseSplashProgressOptions {
  storageKey: string;
  initialStage: SplashStage;
  isReady: boolean;
  intermediateStage?: SplashStage | null;
  error?: Error | null;
  forceShow?: boolean;
  minDurationMs?: number;
}

export interface SplashProgressState {
  visible: boolean;
  fading: boolean;
  progress: number;
  statusText: string;
  hasError: boolean;
  reducedMotion: boolean;
  minDurationElapsed: boolean;
}

/**
 * Document-load-scoped completion tracking:
 * Resets on every full browser reload (F5 / Ctrl+R / direct URL visit).
 * Stays true during in-app client-side navigation to prevent splash flashing.
 */
const documentLoadCompletedFlags = new Map<string, boolean>();

export function resetSplashDocumentLoadState() {
  documentLoadCompletedFlags.clear();
}

/**
 * Derives dynamic, monotonic splash progress strictly from real readiness signals.
 * Enforces a minimum visible duration (~2000ms) alongside genuine readiness confirmation.
 * Plays on every full browser reload, but avoids replaying on internal client navigations.
 */
export function useSplashProgress({
  storageKey,
  initialStage,
  isReady,
  intermediateStage,
  error,
  forceShow = false,
  minDurationMs = 2000,
}: UseSplashProgressOptions): SplashProgressState {
  // Check document-load lifecycle state:
  // Fresh document load = false (splash displays)
  // Subsequent client navigation within the same document = true (splash does not replay)
  const [visible, setVisible] = useState<boolean>(() => {
    if (forceShow) return true;
    if (typeof window === "undefined") return false;
    return !documentLoadCompletedFlags.get(storageKey);
  });

  const [fading, setFading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(initialStage.progress);
  const [statusText, setStatusText] = useState<string>(initialStage.statusText);
  const [hasError, setHasError] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [minDurationElapsed, setMinDurationElapsed] = useState<boolean>(false);

  // Enforce monotonic progress: progress can only increase during a startup run
  const maxProgressRef = useRef<number>(initialStage.progress);
  const setMonotonicProgress = (next: number, nextStatus: string) => {
    const clamped = Math.min(100, Math.max(maxProgressRef.current, Math.round(next)));
    maxProgressRef.current = clamped;
    setProgress(clamped);
    setStatusText(nextStatus);
  };

  // Detect reduced-motion preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mediaQuery.matches);

      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    } catch {
      // Graceful fallback
    }
  }, []);

  // Minimum visible duration gate (default 2000ms)
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      setMinDurationElapsed(true);
    }, minDurationMs);

    return () => clearTimeout(timer);
  }, [visible, minDurationMs]);

  // Handle intermediate & ready progress states using primitive comparisons
  const intermediateProgress = intermediateStage?.progress;
  const intermediateStatus = intermediateStage?.statusText;

  useEffect(() => {
    if (!visible) return;

    if (error) {
      setHasError(true);
      setMonotonicProgress(100, "Initialization completed with fallback");
      return;
    }

    if (isReady) {
      const readyLabel =
        intermediateStatus === "Workspace ready" ? "Workspace ready" : "Ready";
      setMonotonicProgress(100, readyLabel);
    } else if (intermediateProgress !== undefined && intermediateStatus) {
      setMonotonicProgress(intermediateProgress, intermediateStatus);
    }
  }, [intermediateProgress, intermediateStatus, isReady, error, visible]);

  // Dismissal gate: requires BOTH actual application readiness confirmed AND minimum duration elapsed
  useEffect(() => {
    if (!visible) return;

    if (!isReady || !minDurationElapsed || hasError) {
      return;
    }

    const holdDuration = reducedMotion ? 50 : 200;
    const fadeDuration = reducedMotion ? 50 : 400;

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, holdDuration);

    const dismissTimer = setTimeout(() => {
      documentLoadCompletedFlags.set(storageKey, true);
      setVisible(false);
    }, holdDuration + fadeDuration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [isReady, minDurationElapsed, hasError, reducedMotion, storageKey, visible]);

  return {
    visible,
    fading,
    progress,
    statusText,
    hasError,
    reducedMotion,
    minDurationElapsed,
  };
}
