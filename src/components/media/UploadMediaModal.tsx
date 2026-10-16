import { useState, useRef, useEffect } from "react";
import {
  X,
  UploadCloud,
  Upload,
  Check,
  Info,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Archive,
  Globe,
  Lock,
  Copyright,
  FileCode,
} from "lucide-react";
import {
  type MediaItem,
  type MediaType,
  type MediaCategory,
  mapPrismaCategoryToUi,
  prismaAssetToMediaItem,
  type PrismaMediaAssetInput,
  UI_CATEGORY_TO_PRISMA,
  PRISMA_CATEGORY_TO_UI,
} from "@/lib/media-data";
import { toast } from "sonner";

export {
  mapPrismaCategoryToUi,
  prismaAssetToMediaItem,
  type PrismaMediaAssetInput,
  UI_CATEGORY_TO_PRISMA,
  PRISMA_CATEGORY_TO_UI,
};

interface UploadMediaModalProps {
  open: boolean;
  onClose: () => void;
  onAddMedia: (media: MediaItem) => void;
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

export function UploadMediaModal({ open, onClose, onAddMedia }: UploadMediaModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<MediaType>("Image");
  const [category, setCategory] = useState<MediaCategory>("Projects");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [altText, setAltText] = useState("");
  const [visibility, setVisibility] = useState("Private (Admin Only)");
  const [usageRights, setUsageRights] = useState("Internal Use");
  const [fileSizeDisplay, setFileSizeDisplay] = useState("-");
  const [fileTypeDisplay, setFileTypeDisplay] = useState("-");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke the blob URL when it changes or when the component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      handleReset();
    }
  }, [open]);

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileName("");
    setFileType("Image");
    setCategory("Projects");
    setDescription("");
    setTags("");
    setAltText("");
    setVisibility("Private (Admin Only)");
    setUsageRights("Internal Use");
    setFileSizeDisplay("-");
    setFileTypeDisplay("-");
    setUploading(false);
    setIsDragging(false);
  };

  if (!open) return null;

  const processFile = (file: File) => {
    // Client-side SVG rejection (mirrors server-side security policy)
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "svg" || file.type === "image/svg+xml") {
      toast.error("SVG uploads are disabled for security reasons.");
      return;
    }

    // Enforce server-aligned 50 MB limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File exceeds maximum allowed size of ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setFileName(file.name);

    // Format file size display
    if (file.size < 1024 * 1024) {
      setFileSizeDisplay(`${(file.size / 1024).toFixed(1)} KB`);
    } else {
      setFileSizeDisplay(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
    }

    // Determine type & extension display
    const extUpper = ext.toUpperCase() || "FILE";
    let detectedType: MediaType = "Others";

    if (file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(file.name)) {
      detectedType = "Image";
    } else if (file.type.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name)) {
      detectedType = "Video";
    } else if (
      file.type.startsWith("application/pdf") ||
      /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt)$/i.test(file.name)
    ) {
      detectedType = "Document";
    }

    setFileType(detectedType);
    setFileTypeDisplay(`${extUpper} (${detectedType === "Others" ? "Archive" : detectedType})`);

    // Create a transient blob URL for in-modal preview only (never persisted)
    if (detectedType === "Image" || detectedType === "Video") {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload.");
      return;
    }

    if (!fileName.trim()) {
      toast.error("Please enter a file name.");
      return;
    }

    if (!category) {
      toast.error("Please select a category.");
      return;
    }

    // Prevent duplicate in-flight submissions
    if (uploading) return;

    setUploading(true);

    try {
      // Convert file bytes to base64 for the server payload
      const base64Content = await readFileAsBase64(selectedFile);

      const { adminClient } = await import("@/lib/api/admin-client");

      const result = await adminClient.uploadMediaAsset({
        name: fileName.trim(),
        originalFilename: selectedFile.name,
        mimeType: selectedFile.type,
        size: selectedFile.size,
        base64Content,
        category: UI_CATEGORY_TO_PRISMA[category] ?? "PROJECTS",
        altText: altText.trim() || null,
        description: description.trim() || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });

      if (!result.success || !result.data) {
        toast.error(result.error ?? "Upload failed. Please try again.");
        setUploading(false);
        return;
      }

      // Map the persistent server asset to the UI MediaItem shape
      const newItem = prismaAssetToMediaItem(
        result.data,
        { fileType, visibility, usageRights }
      );

      onAddMedia(newItem);
      toast.success(`"${newItem.name}" uploaded successfully!`);

      // Revoke the transient preview URL before closing the modal
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      setUploading(false);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast.error(message);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-brand/35 bg-[#080d0a] shadow-[0_0_40px_rgba(0,0,0,0.8),0_0_20px_color-mix(in_oklab,var(--brand)_15%,transparent)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand/20 px-6 py-4.5 bg-[#0b120e]">
          <div>
            <h2 className="font-display text-[20px] font-bold text-foreground text-glow">
              Upload Media
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Add new images, videos, or documents to your library.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-brand/15 hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            {/* Left Column: Form Sections */}
            <div className="space-y-5">
              {/* Section 1: Select File */}
              <div>
                <h3 className="mb-2 text-[13.5px] font-bold text-foreground">
                  <span className="text-brand-bright">1.</span> Select File
                </h3>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                    isDragging
                      ? "border-brand-bright bg-brand/15 shadow-[0_0_20px_color-mix(in_oklab,var(--brand-bright)_25%,transparent)]"
                      : "border-brand/40 bg-panel/50 hover:border-brand-bright hover:bg-brand/5"
                  }`}
                >
                  <div className="flex size-11 items-center justify-center rounded-full border border-brand-bright/40 bg-brand/20 text-brand-bright shadow-[0_0_15px_color-mix(in_oklab,var(--brand-bright)_30%,transparent)]">
                    <UploadCloud className="size-5.5" />
                  </div>
                  <p className="mt-3 text-[13px] font-semibold text-foreground">
                    Drag and drop your files here, or{" "}
                    <span className="text-brand-bright underline underline-offset-2">browse</span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Supports JPG, PNG, WEBP, MP4, PDF, PPTX, ZIP up to {MAX_FILE_SIZE_MB} MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.pdf,.pptx,.docx,.xlsx,.zip,.rar"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Section 2: File Details */}
              <div>
                <h3 className="mb-2.5 text-[13.5px] font-bold text-foreground">
                  <span className="text-brand-bright">2.</span> File Details
                </h3>
                <div className="space-y-3.5">
                  {/* File Name */}
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-foreground/85">
                      File Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="e.g. campus-connect-banner.jpg"
                      className="h-9 w-full rounded-lg border border-brand/28 bg-panel px-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none transition focus:border-brand-bright/70 focus:shadow-[0_0_0_2px_color-mix(in_oklab,var(--brand)_15%,transparent)]"
                    />
                  </div>

                  {/* Type & Category */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[12px] font-semibold text-foreground/85">
                        Type <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={fileType}
                          onChange={(e) => {
                            const val = e.target.value as MediaType;
                            setFileType(val);
                            setFileTypeDisplay(val);
                          }}
                          className="h-9 w-full rounded-lg border border-brand/28 bg-panel pl-8 pr-3 text-[12.5px] text-foreground outline-none transition focus:border-brand-bright/70"
                        >
                          <option value="Image">Image</option>
                          <option value="Video">Video</option>
                          <option value="Document">Document</option>
                          <option value="Others">Others / Archive</option>
                        </select>
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {fileType === "Image" && <ImageIcon className="size-3.5" />}
                          {fileType === "Video" && <VideoIcon className="size-3.5" />}
                          {fileType === "Document" && <FileText className="size-3.5" />}
                          {fileType === "Others" && <Archive className="size-3.5" />}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[12px] font-semibold text-foreground/85">
                        Category <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as MediaCategory)}
                        className="h-9 w-full rounded-lg border border-brand/28 bg-panel px-3 text-[12.5px] text-foreground outline-none transition focus:border-brand-bright/70"
                      >
                        <option value="Projects">Projects</option>
                        <option value="Websites">Websites</option>
                        <option value="Advertisements">Advertisements</option>
                        <option value="Awards">Awards</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-foreground/85">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                      placeholder="Add a brief description of this media (optional)..."
                      rows={2}
                      className="w-full resize-none rounded-lg border border-brand/28 bg-panel p-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/50 outline-none transition focus:border-brand-bright/70"
                    />
                    <p className="mt-0.5 text-right text-[11px] text-muted-foreground">
                      {description.length}/200
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 3: Additional Information */}
              <div>
                <h3 className="mb-2.5 text-[13.5px] font-bold text-foreground">
                  <span className="text-brand-bright">3.</span> Additional Information
                </h3>
                <div className="space-y-3.5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[12px] font-semibold text-foreground/85">
                        Tags (comma separated)
                      </label>
                      <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="e.g. banner, hero, campus, dashboard"
                        className="h-9 w-full rounded-lg border border-brand/28 bg-panel px-3 text-[12.5px] text-foreground placeholder:text-muted-foreground/50 outline-none transition focus:border-brand-bright/70"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[12px] font-semibold text-foreground/85">
                        Alt Text (for images)
                      </label>
                      <input
                        type="text"
                        value={altText}
                        onChange={(e) => setAltText(e.target.value)}
                        placeholder="e.g. Campus Connect Banner"
                        disabled={fileType !== "Image"}
                        className="h-9 w-full rounded-lg border border-brand/28 bg-panel px-3 text-[12.5px] text-foreground placeholder:text-muted-foreground/50 outline-none transition focus:border-brand-bright/70 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[12px] font-semibold text-foreground/85">
                        Visibility <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={visibility}
                          onChange={(e) => setVisibility(e.target.value)}
                          className="h-9 w-full rounded-lg border border-brand/28 bg-panel pl-8 pr-3 text-[12.5px] text-foreground outline-none transition focus:border-brand-bright/70"
                        >
                          <option value="Private (Admin Only)">Private (Admin Only)</option>
                          <option value="Public (Showcase)">Public (Showcase)</option>
                          <option value="Internal">Internal</option>
                        </select>
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {visibility.includes("Private") ? (
                            <Lock className="size-3.5" />
                          ) : (
                            <Globe className="size-3.5" />
                          )}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[12px] font-semibold text-foreground/85">
                        Usage Rights
                      </label>
                      <div className="relative">
                        <select
                          value={usageRights}
                          onChange={(e) => setUsageRights(e.target.value)}
                          className="h-9 w-full rounded-lg border border-brand/28 bg-panel pl-8 pr-3 text-[12.5px] text-foreground outline-none transition focus:border-brand-bright/70"
                        >
                          <option value="Internal Use">Internal Use</option>
                          <option value="Commercial">Commercial</option>
                          <option value="Creative Commons">Creative Commons</option>
                          <option value="Client Owned">Client Owned</option>
                        </select>
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <Copyright className="size-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: File Information */}
              <div>
                <h3 className="mb-2 text-[13.5px] font-bold text-foreground">
                  <span className="text-brand-bright">4.</span> File Information
                </h3>
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-brand/25 bg-panel/70 p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-brand/30 bg-brand/15 text-brand-bright">
                      <FileText className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Estimated Size</p>
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {fileSizeDisplay}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-brand/30 bg-brand/15 text-brand-bright">
                      <FileCode className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">File Type</p>
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {fileTypeDisplay}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Preview & Requirements Panels */}
            <div className="space-y-4">
              {/* Preview Panel */}
              <div>
                <h3 className="mb-2 text-[13.5px] font-bold text-foreground">Preview</h3>
                <div className="flex min-h-[220px] flex-col items-center justify-center overflow-hidden rounded-xl border border-brand/25 bg-panel/80 p-4 text-center">
                  {previewUrl && fileType === "Image" ? (
                    <div className="relative flex max-h-[200px] w-full items-center justify-center overflow-hidden rounded-lg">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-[190px] w-auto rounded-lg object-contain"
                      />
                    </div>
                  ) : previewUrl && fileType === "Video" ? (
                    <video
                      src={previewUrl}
                      controls
                      className="max-h-[190px] w-full rounded-lg object-contain"
                    />
                  ) : selectedFile ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <div className="grid size-12 place-items-center rounded-xl border border-brand-bright/40 bg-brand/20 text-brand-bright">
                        {fileType === "Document" ? (
                          <FileText className="size-6" />
                        ) : (
                          <Archive className="size-6" />
                        )}
                      </div>
                      <p className="max-w-[200px] truncate text-[12.5px] font-semibold text-foreground">
                        {selectedFile.name}
                      </p>
                      <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand-bright">
                        {fileTypeDisplay}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="grid size-12 place-items-center rounded-xl border border-brand/20 bg-background/50 text-muted-foreground/50">
                        <ImageIcon className="size-6" />
                      </div>
                      <p className="mt-3 text-[13px] font-semibold text-foreground/80">
                        No file selected
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                        Upload a file to see preview here.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* File Requirements Panel */}
              <div className="rounded-xl border border-brand/25 bg-panel/60 p-4">
                <div className="mb-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
                  <Info className="size-4 text-brand-bright" />
                  <span>File Requirements</span>
                </div>
                <ul className="space-y-2 text-[11.5px] text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brand-bright" />
                    <span>Maximum file size: {MAX_FILE_SIZE_MB} MB</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brand-bright" />
                    <span>Supported images: JPG, PNG, WEBP</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brand-bright" />
                    <span>Supported videos: MP4, WEBM</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brand-bright" />
                    <span>Supported documents: PDF, PPTX, DOCX, XLSX, ZIP</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brand-bright" />
                    <span>High quality files recommended</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-brand/20 bg-[#0b120e] px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-brand/28 bg-panel px-4 py-2 text-[12.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-upload-btn"
            disabled={uploading}
            onClick={handleConfirmUpload}
            className="flex items-center gap-2 rounded-lg bg-brand-bright px-5 py-2 text-[13px] font-bold text-black shadow-[0_0_15px_color-mix(in_oklab,var(--brand-bright)_40%,transparent)] transition hover:bg-brand-bright/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Upload className="size-4 stroke-[2.5]" />
            <span>{uploading ? "Uploading..." : "Confirm Upload"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
