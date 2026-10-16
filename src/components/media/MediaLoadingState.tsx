import environment from "@/assets/cobralearn-admin-environment.jpg";
import emblem from "@/assets/cobralearn-emblem.png";

export function MediaLoadingState({
  progress,
  viewMode = "grid",
}: {
  progress?: number | undefined;
  viewMode?: "grid" | "list";
}) {
  const isIndeterminate = typeof progress !== "number";
  const boundedProgress =
    typeof progress === "number" ? Math.min(100, Math.max(0, progress)) : undefined;

  return (
    <div className="relative min-h-[500px] w-full overflow-hidden rounded-[18px] border border-[#00ff87]/25 bg-[#020604] flex flex-col items-center justify-center text-center p-6 sm:p-10 shadow-[0_0_25px_rgba(0,255,135,0.15),0_20px_60px_rgba(0,0,0,0.8)]">
      {/* Background Environment Artwork */}
      <img
        src={environment}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-60 mix-blend-luminosity"
      />

      {/* Atmospheric Overlays & Glows */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#020604]/80 via-[#020604]/40 to-[#020604]/90" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-72 rounded-full bg-[#00ff87]/15 blur-3xl"
      />

      {/* Center 3D Emblem Artwork */}
      <div className="relative z-10 mb-6 flex justify-center">
        <img
          src={emblem}
          alt="CobraLearn Emblem"
          className="emblem-float size-32 sm:size-40 object-contain drop-shadow-[0_0_35px_rgba(0,255,135,0.8)] drop-shadow-[0_0_70px_rgba(0,255,135,0.35)]"
        />
      </div>

      {/* Text Hierarchy */}
      <div className="relative z-10 space-y-1">
        <h3 className="font-sans text-[22px] sm:text-[24px] font-bold tracking-tight text-white drop-shadow-[0_0_16px_rgba(0,255,135,0.4)]">
          Loading Media Assets...
        </h3>
        <p className="font-sans text-[12.5px] sm:text-[13px] text-[#94a3b8]">
          Please wait while we index your media library, images, and video assets.
        </p>
      </div>

      {/* Progress Bar: Indeterminate shimmer by default; exact % only when measurable */}
      <div className="relative z-10 mt-5 flex w-full max-w-[360px] sm:max-w-[400px] items-center gap-3.5">
        <div className="relative h-2 sm:h-2.5 flex-1 overflow-hidden rounded-full border border-[#00ff87]/30 bg-[#02180c]/90 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]">
          {isIndeterminate ? (
            <div
              data-testid="indeterminate-progress-bar"
              className="h-full rounded-full bg-gradient-to-r from-transparent via-[#00ff87] to-transparent shadow-[0_0_14px_rgba(0,255,135,0.85)] progress-indeterminate"
            />
          ) : (
            <div
              data-testid="determinate-progress-bar"
              className="h-full rounded-full bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] shadow-[0_0_14px_rgba(0,255,135,0.85)] transition-all duration-500 ease-out"
              style={{ width: `${boundedProgress}%` }}
            />
          )}
        </div>
        {!isIndeterminate && (
          <span
            data-testid="progress-percentage"
            className="font-sans text-[12px] sm:text-[12.5px] font-semibold text-[#00ff87] drop-shadow-[0_0_8px_rgba(0,255,135,0.6)]"
          >
            {boundedProgress}%
          </span>
        )}
      </div>
    </div>
  );
}
