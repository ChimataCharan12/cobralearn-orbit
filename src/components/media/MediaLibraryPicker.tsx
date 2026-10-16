import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  X,
  Search,
  Check,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Archive,
  Plus,
  RotateCw,
  AlertTriangle,
  Loader2,
  UploadCloud,
} from "lucide-react";
import {
  type MediaCategory,
  type MediaItem,
  type MediaType,
  prismaAssetToMediaItem,
  UI_CATEGORY_TO_PRISMA,
} from "@/lib/media-data";
import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";

export interface MediaLibraryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (selected: MediaItem[]) => void;
  title?: string;
  allowedTypes?: MediaType[];
  initialCategory?: MediaCategory | "ALL";
  multiple?: boolean;
  maxSelection?: number;
  initialSelectedIds?: string[];
}

// Server-aligned limits (must match media-operations.ts constants)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_FILE_SIZE_MB = 50;

/**
 * Reads a File as a base64-encoded string (data URL → base64 portion only).
 */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Failed to read file as base64"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("File could not be read"));
    reader.readAsDataURL(file);
  });
}

export function MediaLibraryPicker({
  open,
  onClose,
  onSelect,
  title = "Select Media from Library",
  allowedTypes,
  initialCategory = "ALL",
  multiple = false,
  maxSelection = 10,
  initialSelectedIds,
}: MediaLibraryPickerProps) {
  // Central persistent media assets loaded from server
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Refs
  const requestIdRef = useRef(0);
  const prevOpenRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persistent media from server
  const loadMedia = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminClient.listAdminMedia();
      // Drop response if a newer request began or modal closed
      if (currentRequestId !== requestIdRef.current) return;

      if (!res.success || !res.data) {
        setError(res.error ?? "Failed to load media assets");
        setIsLoading(false);
        return;
      }
      const mapped = res.data.assets.map((asset) => prismaAssetToMediaItem(asset));
      setMediaItems(mapped);
      setIsLoading(false);
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      const msg = err instanceof Error ? err.message : "Failed to load media assets";
      setError(msg);
      setIsLoading(false);
    }
  }, []);

  // Modal lifecycle: load on open, discard on close, handle initial selection
  useEffect(() => {
    if (open) {
      loadMedia();
      if (!prevOpenRef.current) {
        // Modal transitioned from closed to open
        if (initialSelectedIds && initialSelectedIds.length > 0) {
          setSelectedIds(
            multiple ? initialSelectedIds.slice(0, maxSelection) : [initialSelectedIds[0]!]
          );
        } else {
          setSelectedIds([]);
        }
        setSearchQuery("");
        setSelectedType("ALL");
        setSelectedCategory(initialCategory);
      }
    } else {
      // Invalidate pending requests on close
      requestIdRef.current++;
    }
    prevOpenRef.current = open;
  }, [open, loadMedia, initialSelectedIds, multiple, maxSelection, initialCategory]);

  // Filter items in memory based on current search & filter criteria
  const filteredItems = useMemo(() => {
    let result = [...mediaItems];

    if (allowedTypes && allowedTypes.length > 0) {
      result = result.filter((m) => allowedTypes.includes(m.type));
    }

    if (selectedType !== "ALL") {
      result = result.filter((m) => m.type === selectedType);
    }

    if (selectedCategory !== "ALL") {
      result = result.filter((m) => m.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    return result;
  }, [mediaItems, allowedTypes, selectedType, selectedCategory, searchQuery]);

  if (!open) return null;

  const handleToggleSelect = (item: MediaItem) => {
    if (multiple) {
      if (selectedIds.includes(item.id)) {
        setSelectedIds((prev) => prev.filter((id) => id !== item.id));
      } else {
        if (selectedIds.length >= maxSelection) {
          toast.error(`Maximum selection limit of ${maxSelection} reached.`);
          return;
        }
        setSelectedIds((prev) => [...prev, item.id]);
      }
    } else {
      setSelectedIds([item.id]);
    }
  };

  const handleConfirm = () => {
    const selectedItems = mediaItems.filter((m) => selectedIds.includes(m.id));
    if (selectedItems.length === 0) {
      toast.error("Please select at least one media asset.");
      return;
    }
    onSelect(selectedItems);
    onClose();
    setSelectedIds([]);
  };

  const handleRefresh = () => {
    loadMedia();
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Prevent duplicate in-flight submissions
    if (isUploading) return;

    // Client-side SVG rejection (extension and MIME, including mismatched cases)
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isSvgExt = ext === "svg" || file.name.toLowerCase().endsWith(".svg");
    const isSvgMime =
      file.type === "image/svg+xml" || file.type.toLowerCase().includes("svg");

    if (isSvgExt || isSvgMime) {
      toast.error("SVG uploads are disabled for security reasons.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Size limit check (50 MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File exceeds maximum allowed size of ${MAX_FILE_SIZE_MB} MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);

    try {
      const base64Content = await readFileAsBase64(file);

      const targetCategory: MediaCategory =
        selectedCategory !== "ALL"
          ? (selectedCategory as MediaCategory)
          : (initialCategory !== "ALL" ? initialCategory : "Projects");
      const prismaCategory = UI_CATEGORY_TO_PRISMA[targetCategory] ?? "PROJECTS";

      const result = await adminClient.uploadMediaAsset({
        name: file.name,
        originalFilename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        base64Content,
        category: prismaCategory,
        altText: file.name.replace(/\.[^/.]+$/, ""),
      });

      if (!result.success || !result.data) {
        toast.error(result.error ?? "Upload failed. Please try again.");
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Map persistent response to UI item shape
      const newMediaItem = prismaAssetToMediaItem(result.data);

      // Prepend to local items list so it appears immediately
      setMediaItems((prev) => {
        const exists = prev.some((m) => m.id === newMediaItem.id);
        return exists ? prev : [newMediaItem, ...prev];
      });

      // Auto-select the newly uploaded asset respecting mode and limits
      if (multiple) {
        setSelectedIds((prev) => {
          if (prev.includes(newMediaItem.id)) return prev;
          if (prev.length >= maxSelection) {
            toast.info(
              `Uploaded "${newMediaItem.name}". Maximum selection limit of ${maxSelection} reached; asset was added to the library but not selected.`
            );
            return prev;
          }
          return [newMediaItem.id, ...prev];
        });
      } else {
        setSelectedIds([newMediaItem.id]);
      }

      toast.success(`"${newMediaItem.name}" uploaded successfully!`);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred during upload.";
      toast.error(message);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-brand/35 bg-[#080d0a] shadow-[0_0_40px_rgba(0,0,0,0.8),0_0_20px_color-mix(in_oklab,var(--brand)_15%,transparent)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-brand/20 px-6 py-4 bg-[#0b120e]">
          <div>
            <h2 className="font-display text-[18px] font-bold text-foreground text-glow">
              {title}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {multiple
                ? `Select up to ${maxSelection} assets from your central Media Library.`
                : "Select an asset to use in this section."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh media assets"
              aria-label="Refresh media assets"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-brand/15 hover:text-foreground disabled:opacity-40 cursor-pointer"
            >
              <RotateCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close picker"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-brand/15 hover:text-foreground cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="border-b border-brand/15 bg-panel/70 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search input */}
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search media by name or tags..."
                className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 pl-9 pr-3 text-[12.5px] text-foreground placeholder:text-muted-foreground/50 outline-none transition focus:border-brand-bright/70"
              />
            </div>

            {/* Type tabs */}
            <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-brand/20 bg-background/50 p-1">
              {[
                { label: "All", value: "ALL" },
                { label: "Images", value: "Image" },
                { label: "Videos", value: "Video" },
                { label: "Docs", value: "Document" },
                { label: "Others", value: "Others" },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setSelectedType(t.value)}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition cursor-pointer ${
                    selectedType === t.value
                      ? "bg-brand-bright text-black shadow-[0_0_8px_var(--brand-bright)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 rounded-lg border border-brand/25 bg-background/70 px-3 text-[12px] text-foreground outline-none transition focus:border-brand-bright/70 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="Projects">Projects</option>
              <option value="Websites">Websites</option>
              <option value="Advertisements">Advertisements</option>
              <option value="Awards">Awards</option>
              <option value="General">General</option>
            </select>

            {/* Quick Upload Button */}
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              title="Upload a new file to the Media Library"
              className="flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-brand/15 px-3 py-1.5 text-[12px] font-semibold text-brand-bright transition hover:bg-brand/25 hover:border-brand-bright disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  Upload New
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              data-testid="picker-file-input"
              aria-label="Upload new file"
              accept={allowedTypes?.includes("Image") ? "image/*" : undefined}
              onChange={handleQuickUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Media Grid / Loading / Error / Empty State */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[300px] max-h-[420px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-3 flex size-12 items-center justify-center rounded-2xl border border-brand/35 bg-brand/10 shadow-[0_0_20px_color-mix(in_oklab,var(--brand)_25%,transparent)]">
                <Loader2 className="size-6 animate-spin text-brand-bright" />
              </div>
              <h4 className="text-[14px] font-bold text-foreground">
                Loading Media Assets...
              </h4>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Fetching media files from your central storage.
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl border border-rose-500/35 bg-rose-500/10 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                <AlertTriangle className="size-6" />
              </div>
              <h4 className="mt-3.5 text-[14px] font-bold text-foreground">
                Failed to Load Media
              </h4>
              <p className="mt-1 text-[12px] text-muted-foreground max-w-sm">
                {error}
              </p>
              <button
                type="button"
                onClick={loadMedia}
                className="mt-4 flex items-center gap-2 rounded-lg bg-brand-bright px-4 py-2 text-[12.5px] font-bold text-black shadow-[0_0_12px_var(--brand-bright)] transition hover:bg-brand-bright/90 cursor-pointer"
              >
                <RotateCw className="size-3.5" />
                Retry
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="grid size-14 place-items-center rounded-2xl border border-brand/25 bg-panel/60 text-muted-foreground/60 shadow-[0_0_20px_color-mix(in_oklab,var(--brand)_10%,transparent)]">
                {searchQuery.trim() || selectedType !== "ALL" || selectedCategory !== "ALL" ? (
                  <Search className="size-7" />
                ) : (
                  <ImageIcon className="size-7" />
                )}
              </div>
              <h4 className="mt-3.5 text-[14px] font-bold text-foreground">
                {searchQuery.trim() || selectedType !== "ALL" || selectedCategory !== "ALL"
                  ? "No matching media assets"
                  : "No media assets found"}
              </h4>
              <p className="mt-1 text-[12px] text-muted-foreground max-w-sm">
                {searchQuery.trim() || selectedType !== "ALL" || selectedCategory !== "ALL"
                  ? "No media matches your search query or filter criteria."
                  : "Your central Media Library is currently empty."}
              </p>
              {searchQuery.trim() || selectedType !== "ALL" || selectedCategory !== "ALL" ? null : (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-brand-bright px-4 py-2 text-[12.5px] font-bold text-black shadow-[0_0_12px_var(--brand-bright)] transition hover:bg-brand-bright/90 disabled:opacity-50 cursor-pointer"
                >
                  <UploadCloud className="size-4" />
                  Upload New File
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleSelect(item)}
                    className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? "border-brand-bright bg-brand/20 shadow-[0_0_16px_color-mix(in_oklab,var(--brand-bright)_35%,transparent)] scale-[1.02]"
                        : "border-brand/25 bg-panel/70 hover:border-brand/60 hover:bg-panel"
                    }`}
                  >
                    {/* Media Thumbnail */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                      {item.thumbnail || item.url ? (
                        <img
                          src={item.thumbnail || item.url}
                          alt={item.name}
                          className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                          {item.type === "Image" && <ImageIcon className="size-6" />}
                          {item.type === "Video" && <VideoIcon className="size-6" />}
                          {item.type === "Document" && <FileText className="size-6" />}
                          {item.type === "Others" && <Archive className="size-6" />}
                        </div>
                      )}

                      {/* Selected Checkmark Badge */}
                      {isSelected && (
                        <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-brand-bright text-black shadow-[0_0_8px_var(--brand-bright)]">
                          <Check className="size-3.5 stroke-[3]" />
                        </div>
                      )}

                      {/* Type Badge */}
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-brand-bright backdrop-blur-sm">
                        {item.type}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="p-2.5">
                      <p className="truncate text-[12px] font-semibold text-foreground" title={item.name}>
                        {item.name}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10.5px] text-muted-foreground">
                        <span>{item.category}</span>
                        <span>{item.size}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between border-t border-brand/20 bg-[#0b120e] px-6 py-3.5">
          <span className="text-[12px] font-medium text-muted-foreground">
            {selectedIds.length > 0 ? (
              <span className="text-brand-bright font-semibold">
                {selectedIds.length} {selectedIds.length === 1 ? "asset" : "assets"} selected
                {multiple && ` (max ${maxSelection})`}
              </span>
            ) : (
              "No asset selected"
            )}
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-brand/28 bg-panel px-4 py-2 text-[12.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleConfirm}
              className="flex items-center gap-1.5 rounded-lg bg-brand-bright px-5 py-2 text-[12.5px] font-bold text-black shadow-[0_0_12px_color-mix(in_oklab,var(--brand-bright)_40%,transparent)] transition hover:bg-brand-bright/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check className="size-4 stroke-[2.5]" />
              Select Media
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

