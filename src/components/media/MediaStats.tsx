import { ImageIcon, Video, FileText, Box, Upload } from "lucide-react";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

interface MediaStatsProps {
  imageCount: number;
  imageSize: string;
  videoCount: number;
  videoSize: string;
  documentCount: number;
  documentSize: string;
  otherCount: number;
  otherSize: string;
  onUploadClick: () => void;
}

export function MediaStats({
  imageCount,
  imageSize,
  videoCount,
  videoSize,
  documentCount,
  documentSize,
  otherCount,
  otherSize,
  onUploadClick,
}: MediaStatsProps) {
  const { t } = useAdminAppearance();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {/* 1. Images Card (Emerald Green) */}
      <div className="accent-green accent-card relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        {/* Top highlight streak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/40 to-transparent" />
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-brand/50 bg-brand/20 text-brand-bright shadow-[0_0_10px_rgba(0,255,170,0.2)]">
          <ImageIcon className="size-5" />
        </div>
        <div>
          <p className="font-display text-[22px] font-bold leading-tight text-foreground text-glow">{imageCount}</p>
          <p className="text-[12px] font-medium text-foreground/80">{t("media.images")}</p>
          <p className="text-[11px] text-muted-foreground/75">{imageSize}</p>
        </div>
      </div>

      {/* 2. Videos Card (Purple) */}
      <div className="accent-purple accent-card relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        {/* Top highlight streak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-purple-500/50 bg-purple-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
          <Video className="size-5" />
        </div>
        <div>
          <p className="font-display text-[22px] font-bold leading-tight text-foreground text-glow">{videoCount}</p>
          <p className="text-[12px] font-medium text-foreground/80">{t("media.videos")}</p>
          <p className="text-[11px] text-muted-foreground/75">{videoSize}</p>
        </div>
      </div>

      {/* 3. Documents Card (Blue) */}
      <div className="accent-blue accent-card relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        {/* Top highlight streak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/50 bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
          <FileText className="size-5" />
        </div>
        <div>
          <p className="font-display text-[22px] font-bold leading-tight text-foreground text-glow">{documentCount}</p>
          <p className="text-[12px] font-medium text-foreground/80">{t("media.documents")}</p>
          <p className="text-[11px] text-muted-foreground/75">{documentSize}</p>
        </div>
      </div>

      {/* 4. Others Card (Gold / Amber) */}
      <div className="accent-amber accent-card relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px]">
        {/* Top highlight streak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/50 bg-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
          <Box className="size-5" />
        </div>
        <div>
          <p className="font-display text-[22px] font-bold leading-tight text-foreground text-glow">{otherCount}</p>
          <p className="text-[12px] font-medium text-foreground/80">{t("media.others")}</p>
          <p className="text-[11px] text-muted-foreground/75">{otherSize}</p>
        </div>
      </div>

      {/* 5. Upload Media Button */}
      <button
        type="button"
        onClick={onUploadClick}
        className="col-span-2 flex h-full min-h-[64px] items-center justify-center gap-2.5 rounded-xl border border-brand-bright/70 bg-gradient-to-r from-brand/90 to-brand-bright text-[14px] font-bold text-background shadow-[0_0_24px_rgba(0,255,170,0.35)] transition-all duration-200 hover:scale-[1.015] hover:translate-y-[-1px] hover:brightness-110 hover:shadow-[0_0_32px_rgba(0,255,170,0.5)] lg:col-span-1"
      >
        <Upload className="size-5" />
        <span>{t("stats.uploadMedia")}</span>
      </button>
    </div>
  );
}
