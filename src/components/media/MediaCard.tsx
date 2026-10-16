import { Play, FileText, Box, MoreVertical, Eye, Copy, Download, Trash2 } from "lucide-react";
import { type MediaItem } from "@/lib/media-data";
import { useState } from "react";
import { toast } from "sonner";

interface MediaCardProps {
  item: MediaItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onPreview: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}

export function MediaCard({
  item,
  isSelected,
  onToggleSelect,
  onPreview,
  onDelete,
}: MediaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.url) {
      navigator.clipboard.writeText(item.url);
      toast.success("Asset URL copied to clipboard.");
    } else {
      toast.error("No direct URL available for this asset.");
    }
    setMenuOpen(false);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.url) {
      const link = document.createElement("a");
      link.href = item.url;
      link.download = item.name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast.error("Download unavailable: Asset does not have a public URL.");
    }
    setMenuOpen(false);
  };

  return (
    <div
      onClick={() => onPreview(item)}
      className={`card-interactive group relative flex flex-col justify-between overflow-hidden rounded-xl border p-2.5 cursor-pointer ${
        isSelected
          ? "border-brand-bright bg-panel shadow-[0_0_18px_rgba(0,255,170,0.25)]"
          : "border-brand/25 bg-panel/85"
      }`}
    >
      {/* Top highlight streak */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/35 to-transparent transition-opacity duration-300 opacity-60 group-hover:opacity-100" />
      {/* Thumbnail Area */}
      <div className="relative h-[115px] w-full overflow-hidden rounded-lg bg-background/80">
        {/* Checkbox (top-left) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(item.id);
          }}
          className="absolute left-2 top-2 z-10 flex size-5 items-center justify-center rounded border border-brand/50 bg-background/85 transition hover:border-brand-bright"
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            className="size-3.5 accent-[#00e599] cursor-pointer"
          />
        </div>

        {/* Options Button (top-right) */}
        <div className="absolute right-2 top-2 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            aria-label="Options"
            className="flex size-6 items-center justify-center rounded-md border border-brand/30 bg-background/85 text-foreground/80 transition hover:border-brand-bright hover:text-brand-bright"
          >
            <MoreVertical className="size-3.5" />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-7 z-20 w-36 rounded-lg border border-brand/35 bg-panel-strong p-1 shadow-xl backdrop-blur-md"
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onPreview(item);
                }}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12px] text-foreground/85 hover:bg-brand/20 hover:text-brand-bright"
              >
                <Eye className="size-3.5" /> View Details
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12px] text-foreground/85 hover:bg-brand/20 hover:text-brand-bright"
              >
                <Copy className="size-3.5" /> Copy Link
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12px] text-foreground/85 hover:bg-brand/20 hover:text-brand-bright"
              >
                <Download className="size-3.5" /> Download
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(item);
                }}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-950/40"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            </div>
          )}
        </div>

        {/* Thumbnail Preview Display */}
        {item.type === "Image" && item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : item.type === "Video" ? (
          <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-950/50 via-panel to-background">
            {item.thumbnail ? (
              <img src={item.thumbnail} alt="" className="h-full w-full object-cover opacity-60" />
            ) : null}
            <div className="absolute flex size-10 items-center justify-center rounded-full border border-purple-400/60 bg-purple-500/30 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)] backdrop-blur-sm">
              <Play className="ml-0.5 size-4 fill-current" />
            </div>
            {item.duration && (
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
                {item.duration}
              </span>
            )}
          </div>
        ) : item.type === "Document" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-blue-950/40 via-panel to-background p-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg border border-blue-500/50 bg-blue-500/20 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
              <FileText className="size-5" />
            </div>
            <span className="rounded bg-red-500/25 px-2 py-0.5 text-[10px] font-bold tracking-wider text-red-400 border border-red-500/40">
              {item.name.endsWith(".pdf") ? "PDF" : "PPTX"}
            </span>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-amber-950/40 via-panel to-background p-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg border border-amber-500/50 bg-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
              <Box className="size-5" />
            </div>
            <span className="rounded bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-400 border border-amber-500/40">
              ZIP
            </span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-2.5 space-y-1.5">
        {/* Filename */}
        <p className="truncate font-display text-[12.5px] font-semibold text-foreground" title={item.name}>
          {item.name}
        </p>

        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Type Badge */}
          {item.type === "Image" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/15 px-2 py-0.5 text-[10.5px] font-medium text-brand-bright">
              <span className="size-1.5 rounded-full bg-brand-bright" />
              Image
            </span>
          ) : item.type === "Video" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/15 px-2 py-0.5 text-[10.5px] font-medium text-purple-400">
              <span className="size-1.5 rounded-full bg-purple-400" />
              Video
            </span>
          ) : item.type === "Document" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/15 px-2 py-0.5 text-[10.5px] font-medium text-blue-400">
              <span className="size-1.5 rounded-full bg-blue-400" />
              Document
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-medium text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-400" />
              Others
            </span>
          )}

          {/* Category Badge */}
          <span className="inline-block rounded-full border border-border/50 bg-background/60 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
            {item.category}
          </span>
        </div>

        {/* Size & Date Footer */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground/75">
          <span>{item.size}</span>
          <span>{item.date}</span>
        </div>
      </div>
    </div>
  );
}
