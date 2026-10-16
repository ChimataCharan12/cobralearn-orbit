import { FileText, FolderPlus, Image as ImageIcon, Sparkles, Upload, Video } from "lucide-react";
import emblem from "@/assets/cobralearn-emblem.png";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

export function MediaEmptyState({
  onUpload,
  onUploadClick,
  onClearFilters,
  hasFilters,
}: {
  onUpload?: () => void;
  onUploadClick?: () => void;
  onClearFilters?: () => void;
  hasFilters?: boolean;
}) {
  const { t } = useAdminAppearance();
  const handleUpload = onUpload || onUploadClick || (() => {});
  const featureCards = [
    {
      icon: ImageIcon,
      title: "Images & Banners",
      subtitle: "PNG, JPG, WebP, SVG",
    },
    {
      icon: Video,
      title: "Video Assets",
      subtitle: "MP4, WebM, Clips",
    },
    {
      icon: FileText,
      title: "Documents",
      subtitle: "PDFs & Certificates",
    },
    {
      icon: Sparkles,
      title: "Optimized Delivery",
      subtitle: "Fast CDN Preview",
    },
  ];

  return (
    <div className="relative min-h-[500px] w-full overflow-hidden rounded-[18px] border border-[#00ff87]/25 bg-[#040e08]/75 backdrop-blur-xl p-6 sm:p-8 lg:p-10 flex flex-col items-center text-center justify-between shadow-[0_0_25px_rgba(0,255,135,0.1),0_20px_60px_rgba(0,0,0,0.8),inset_0_0_25px_rgba(0,255,135,0.03)]">
      {/* Top Center Glow & Artwork */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 size-60 rounded-full bg-[#00ff87]/12 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* Emblem Artwork */}
        <div className="flex justify-center">
          <img
            src={emblem}
            alt="CobraLearn Emblem"
            className="emblem-float size-28 sm:size-36 object-contain drop-shadow-[0_0_30px_rgba(0,255,135,0.7)] drop-shadow-[0_0_60px_rgba(0,255,135,0.3)]"
          />
        </div>

        {/* Heading & Descriptions */}
        <h3 className="mt-4 font-sans text-[24px] sm:text-[26px] font-bold tracking-tight text-white">
          {t("empty.noMediaTitle")}
        </h3>
        <p className="mt-1.5 font-sans text-[13px] sm:text-[13.5px] text-[#cbd5e1]">
          {hasFilters
            ? t("table.noItemsMatch")
            : t("empty.noMediaDesc")}
        </p>
        <p className="mt-0.5 font-sans text-[12px] sm:text-[12.5px] text-[#94a3b8]">
          {t("empty.noMediaHelp")}
        </p>

        {/* CTA Buttons */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {hasFilters && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="flex items-center gap-2 rounded-xl border border-brand/35 bg-panel px-4 py-2.5 text-[13.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground"
            >
              Clear Filters
            </button>
          )}
          <button
            type="button"
            onClick={handleUpload}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] px-6 py-2.5 text-[13.5px] font-bold text-[#02180c] shadow-[0_0_20px_rgba(0,255,135,0.4)] hover:shadow-[0_0_30px_rgba(0,255,135,0.6)] hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Upload className="size-4 stroke-[2.5]" />
            <span>{t("empty.uploadMediaBtn")}</span>
          </button>
        </div>
      </div>

      {/* 4 Feature Cards at Bottom */}
      <div className="relative z-10 mt-8 sm:mt-10 grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {featureCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="group flex flex-col items-center justify-center rounded-[12px] border border-[#00ff87]/20 bg-[#020905]/80 p-4 text-center backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] hover:border-[#00ff87]/45 hover:bg-[#00ff87]/10 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex size-10 items-center justify-center rounded-full border border-[#00ff87]/30 bg-[#00ff87]/10 group-hover:scale-110 group-hover:bg-[#00ff87]/20 transition-all duration-300 shadow-[0_0_12px_rgba(0,255,135,0.25)]">
                <Icon className="size-5 text-[#00ff87]" />
              </div>
              <p className="mt-2.5 font-sans text-[13.5px] font-bold text-white group-hover:text-[#00ff87] transition-colors">
                {card.title}
              </p>
              <p className="font-sans text-[11.5px] text-[#94a3b8]">
                {card.subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
