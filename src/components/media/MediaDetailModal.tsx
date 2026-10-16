import {
  X,
  Copy,
  Download,
  Trash2,
  Calendar,
  HardDrive,
  Tag,
  Pencil,
  Save,
  Loader2,
  FileText,
  Plus,
} from "lucide-react";
import {
  type MediaItem,
  type MediaCategory,
  UI_CATEGORY_TO_PRISMA,
  prismaAssetToMediaItem,
} from "@/lib/media-data";
import { adminClient } from "@/lib/api/admin-client";
import type { UpdateMediaPayload } from "@/lib/server/media-operations";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface MediaDetailModalProps {
  item: MediaItem | null;
  open: boolean;
  onClose: () => void;
  onDelete: (item: MediaItem) => void;
  onUpdate?: (updatedItem: MediaItem) => void;
}

const CATEGORY_OPTIONS: MediaCategory[] = [
  "General",
  "Projects",
  "Websites",
  "Awards",
  "Advertisements",
];

export function MediaDetailModal({
  item,
  open,
  onClose,
  onDelete,
  onUpdate,
}: MediaDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MediaCategory>("General");
  const [altText, setAltText] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync form state when item or open changes
  useEffect(() => {
    if (item && open) {
      setName(item.name || "");
      setCategory(item.category || "General");
      setAltText(item.altText || "");
      setDescription(item.description || "");
      setTags(item.tags ? [...item.tags] : []);
      setTagInput("");
      setErrors({});
      setIsEditing(false);
      setIsSaving(false);
    }
  }, [item, open]);

  // Handle Escape key to close or cancel edit
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isSaving) return;
        if (isEditing) {
          handleCancelEdit();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isSaving, isEditing, item]);

  if (!open || !item) return null;

  const handleCancelEdit = () => {
    if (isSaving) return;
    setName(item.name || "");
    setCategory(item.category || "General");
    setAltText(item.altText || "");
    setDescription(item.description || "");
    setTags(item.tags ? [...item.tags] : []);
    setTagInput("");
    setErrors({});
    setIsEditing(false);
  };

  const handleCopy = () => {
    if (item.url) {
      navigator.clipboard.writeText(item.url);
      toast.success("Public asset URL copied to clipboard.");
    } else {
      toast.error("No direct URL available for this asset.");
    }
  };

  const handleDownload = () => {
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
  };

  const handleAddTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (trimmed.length > 50) {
      setErrors((prev) => ({ ...prev, tags: "Each tag must be 50 characters or less." }));
      return;
    }
    const lower = trimmed.toLowerCase();
    if (tags.some((t) => t.toLowerCase() === lower)) {
      setErrors((prev) => ({ ...prev, tags: "This tag has already been added." }));
      return;
    }
    if (tags.length >= 20) {
      setErrors((prev) => ({ ...prev, tags: "Maximum of 20 tags allowed." }));
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setTagInput("");
    setErrors((prev) => {
      const next = { ...prev };
      delete next.tags;
      return next;
    });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.tags;
      return next;
    });
  };

  const handleSave = async () => {
    if (!item || isSaving) return;

    const newErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = "Media asset name is required.";
    } else if (trimmedName.length > 255) {
      newErrors.name = "Asset name must be 255 characters or less.";
    }

    if (altText && altText.length > 500) {
      newErrors.altText = "Alt text must be 500 characters or less.";
    }

    if (description && description.length > 2000) {
      newErrors.description = "Description must be 2000 characters or less.";
    }

    if (tags.length > 20) {
      newErrors.tags = "Maximum of 20 tags allowed.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fix the validation errors before saving.");
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      const prismaCategory = UI_CATEGORY_TO_PRISMA[category] || "GENERAL";
      const payload: UpdateMediaPayload = {
        name: trimmedName,
        category: prismaCategory,
        altText: altText.trim() ? altText.trim() : null,
        description: description.trim() ? description.trim() : null,
        tags,
      };

      const res = await adminClient.updateAdminMedia(item.id, payload);

      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to update media asset.");
        setIsSaving(false);
        return;
      }

      const updatedMediaItem = prismaAssetToMediaItem(res.data);
      onUpdate?.(updatedMediaItem);
      toast.success("Media asset updated successfully.");
      setIsEditing(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update media asset.";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-detail-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          if (isEditing) {
            handleCancelEdit();
          } else {
            onClose();
          }
        }
      }}
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-brand/40 bg-panel p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand/20 pb-4">
          <div className="max-w-[75%]">
            <h2
              id="media-detail-modal-title"
              className="truncate font-display text-[20px] font-bold text-foreground text-glow"
              title={isEditing ? "Edit Asset Metadata" : item.name}
            >
              {isEditing ? "Edit Asset Metadata" : item.name}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {isEditing ? `Modify editable properties for ${item.name}` : "Asset Details & Metadata"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-brand/35 bg-brand/10 px-3 py-1.5 text-[12px] font-semibold text-brand-bright hover:bg-brand/20 hover:border-brand-bright transition"
              >
                <Pencil className="size-3.5" /> Edit
              </button>
            )}
            <button
              type="button"
              onClick={isEditing ? handleCancelEdit : onClose}
              disabled={isSaving}
              aria-label="Close"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-brand/15 hover:text-foreground disabled:opacity-50"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content Body: View Mode */}
        {!isEditing ? (
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Left: Preview Box */}
            <div className="flex flex-col gap-3">
              <div className="flex h-[240px] items-center justify-center overflow-hidden rounded-xl border border-brand/25 bg-background/70 p-2">
                {item.type === "Image" && (item.thumbnail || item.url) ? (
                  <img
                    src={item.thumbnail || item.url}
                    alt={item.altText || item.name}
                    className="h-full w-full object-contain rounded-lg"
                  />
                ) : item.type === "Video" && item.url ? (
                  <video
                    src={item.url}
                    controls
                    className="h-full w-full object-contain rounded-lg"
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : item.type === "Document" ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-center p-4">
                    <div className="flex size-14 items-center justify-center rounded-xl border border-blue-500/50 bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                      <FileText className="size-7" />
                    </div>
                    <span className="font-semibold text-foreground text-[14px]">
                      {item.name.endsWith(".pdf") ? "PDF Document" : "Document File"}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      {item.size} • {item.mimeType || "document"}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
                    <div className="flex size-14 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand-bright">
                      <HardDrive className="size-7" />
                    </div>
                    <span className="text-[14px] font-semibold text-foreground">{item.type} File</span>
                    <span className="text-[12px]">{item.size}</span>
                  </div>
                )}
              </div>

              {/* Direct CDN Link Box */}
              {item.url ? (
                <div className="rounded-lg border border-brand/25 bg-background/60 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Direct CDN Link</p>
                  <p className="truncate text-[12px] font-mono text-brand-cyan" title={item.url}>
                    {item.url}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border/25 bg-background/40 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Direct CDN Link</p>
                  <p className="text-[12px] text-muted-foreground italic">No public URL available</p>
                </div>
              )}
            </div>

            {/* Right: Metadata Table */}
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between border-b border-brand/15 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="size-4 text-brand-cyan" /> Type
                </span>
                <span className="font-semibold text-brand-bright">{item.type}</span>
              </div>

              <div className="flex items-center justify-between border-b border-brand/15 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="size-4 text-brand-cyan" /> Category
                </span>
                <span className="font-semibold text-foreground">{item.category}</span>
              </div>

              <div className="flex items-center justify-between border-b border-brand/15 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="size-4 text-brand-cyan" /> File Size
                </span>
                <span className="font-semibold text-foreground">{item.size}</span>
              </div>

              {item.dimensions && (
                <div className="flex items-center justify-between border-b border-brand/15 pb-2">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    Dimensions
                  </span>
                  <span className="font-semibold text-foreground">{item.dimensions}</span>
                </div>
              )}

              {item.duration && (
                <div className="flex items-center justify-between border-b border-brand/15 pb-2">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    Duration
                  </span>
                  <span className="font-semibold text-foreground">{item.duration}</span>
                </div>
              )}

              {item.mimeType && (
                <div className="flex items-center justify-between border-b border-brand/15 pb-2">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    MIME Type
                  </span>
                  <span className="font-semibold text-foreground">{item.mimeType}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-brand/15 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="size-4 text-brand-cyan" /> Upload Date
                </span>
                <span className="font-semibold text-foreground">{item.date}</span>
              </div>

              <div className="border-b border-brand/15 pb-2">
                <span className="block text-muted-foreground text-[12px] mb-0.5">Alt Text</span>
                <span className="font-medium text-foreground">
                  {item.altText || <span className="italic text-muted-foreground/70">None</span>}
                </span>
              </div>

              <div className="border-b border-brand/15 pb-2">
                <span className="block text-muted-foreground text-[12px] mb-0.5">Description</span>
                <p className="font-medium text-foreground text-[12.5px] leading-relaxed whitespace-pre-wrap">
                  {item.description || <span className="italic text-muted-foreground/70">None</span>}
                </p>
              </div>

              <div>
                <span className="block text-muted-foreground text-[12px] mb-1.5">Tags</span>
                {item.tags && item.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="rounded-full border border-brand/35 bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand-bright"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="italic text-muted-foreground/70">No tags</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Content Body: Edit Mode */
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Left: Read-Only Overview & Preview */}
            <div className="space-y-4">
              <div className="flex h-[180px] items-center justify-center overflow-hidden rounded-xl border border-brand/25 bg-background/70 p-2">
                {item.type === "Image" && (item.thumbnail || item.url) ? (
                  <img
                    src={item.thumbnail || item.url}
                    alt={item.name}
                    className="h-full w-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground p-3 text-center">
                    <HardDrive className="size-8 text-brand-bright mb-1" />
                    <span className="text-[13px] font-semibold text-foreground">{item.name}</span>
                    <span className="text-[11px]">{item.size} • {item.type}</span>
                  </div>
                )}
              </div>

              {/* Read-Only Specs Box */}
              <div className="rounded-xl border border-brand/20 bg-background/50 p-3 space-y-2 text-[12px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>Type:</span>
                  <span className="font-semibold text-brand-bright">{item.type}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>File Size:</span>
                  <span className="font-semibold text-foreground">{item.size}</span>
                </div>
                {item.mimeType && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>MIME Type:</span>
                    <span className="font-semibold text-foreground">{item.mimeType}</span>
                  </div>
                )}
                {item.dimensions && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Dimensions:</span>
                    <span className="font-semibold text-foreground">{item.dimensions}</span>
                  </div>
                )}
                {item.duration && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Duration:</span>
                    <span className="font-semibold text-foreground">{item.duration}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Uploaded:</span>
                  <span className="font-semibold text-foreground">{item.date}</span>
                </div>
              </div>
            </div>

            {/* Right: Editable Form Fields */}
            <div className="space-y-3.5">
              {/* Name */}
              <div>
                <label htmlFor="edit-media-name" className="block text-[12.5px] font-medium text-foreground mb-1">
                  Asset Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="edit-media-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.name;
                        return next;
                      });
                    }
                  }}
                  maxLength={255}
                  disabled={isSaving}
                  placeholder="Enter asset title..."
                  className="w-full rounded-lg border border-brand/30 bg-background/80 px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-brand-bright focus:outline-none"
                />
                {errors.name && <p className="mt-1 text-[11px] text-red-400">{errors.name}</p>}
              </div>

              {/* Category */}
              <div>
                <label htmlFor="edit-media-category" className="block text-[12.5px] font-medium text-foreground mb-1">
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  id="edit-media-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MediaCategory)}
                  disabled={isSaving}
                  className="w-full rounded-lg border border-brand/30 bg-background/80 px-3 py-1.5 text-[13px] text-foreground focus:border-brand-bright focus:outline-none"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Alt Text */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="edit-media-alt-text" className="text-[12.5px] font-medium text-foreground">
                    Alt Text
                  </label>
                  <span className="text-[11px] text-muted-foreground">{altText.length}/500</span>
                </div>
                <input
                  id="edit-media-alt-text"
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  maxLength={500}
                  disabled={isSaving}
                  placeholder="Image description for accessibility..."
                  className="w-full rounded-lg border border-brand/30 bg-background/80 px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-brand-bright focus:outline-none"
                />
                {errors.altText && <p className="mt-1 text-[11px] text-red-400">{errors.altText}</p>}
              </div>

              {/* Description */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="edit-media-description" className="text-[12.5px] font-medium text-foreground">
                    Description
                  </label>
                  <span className="text-[11px] text-muted-foreground">{description.length}/2000</span>
                </div>
                <textarea
                  id="edit-media-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  disabled={isSaving}
                  placeholder="Detailed asset description..."
                  className="w-full rounded-lg border border-brand/30 bg-background/80 px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-brand-bright focus:outline-none resize-none"
                />
                {errors.description && <p className="mt-1 text-[11px] text-red-400">{errors.description}</p>}
              </div>

              {/* Tags */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="edit-media-tag-input" className="text-[12.5px] font-medium text-foreground">
                    Tags
                  </label>
                  <span className="text-[11px] text-muted-foreground">{tags.length}/20</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="edit-media-tag-input"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    maxLength={50}
                    disabled={isSaving || tags.length >= 20}
                    placeholder="Type tag and press Add..."
                    className="flex-1 rounded-lg border border-brand/30 bg-background/80 px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-brand-bright focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag()}
                    disabled={isSaving || !tagInput.trim() || tags.length >= 20}
                    className="flex items-center gap-1 rounded-lg border border-brand/40 bg-brand/15 px-3 py-1.5 text-[12px] font-semibold text-brand-bright hover:bg-brand/25 disabled:opacity-50 transition"
                  >
                    <Plus className="size-3.5" /> Add
                  </button>
                </div>
                {errors.tags && <p className="mt-1 text-[11px] text-red-400">{errors.tags}</p>}

                {/* Tag Pills */}
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-full border border-brand/35 bg-brand/15 px-2.5 py-0.5 text-[11px] font-medium text-brand-bright"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          disabled={isSaving}
                          aria-label={`Remove tag ${t}`}
                          className="hover:text-red-400 focus:outline-none"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-brand/20 pt-4">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onDelete(item);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/20 px-3.5 py-2 text-[12.5px] font-semibold text-red-400 transition hover:bg-red-900/30"
              >
                <Trash2 className="size-4" /> Delete Asset
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg border border-brand/35 bg-panel px-3.5 py-2 text-[12.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-brand-bright"
                >
                  <Copy className="size-4" /> Copy Link
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!item.url}
                  className="flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-gradient-to-r from-brand to-brand-bright px-4 py-2 text-[12.5px] font-bold text-background shadow-[0_0_12px_rgba(0,255,170,0.3)] transition hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Download className="size-4" /> Download
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-[11.5px] text-muted-foreground">
                Unsaved changes will be discarded on Cancel.
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="rounded-lg border border-brand/30 bg-background/60 px-4 py-2 text-[12.5px] font-semibold text-foreground/80 hover:bg-brand/10 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-gradient-to-r from-brand to-brand-bright px-4 py-2 text-[12.5px] font-bold text-background shadow-[0_0_12px_rgba(0,255,170,0.3)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
