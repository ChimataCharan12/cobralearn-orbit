import { useState, useRef } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  Github,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  Upload,
  Users,
  Video,
  X,
  AlignLeft,
} from "lucide-react";
import type { WebsiteItem, WebsiteStatus } from "@/lib/websites-data";
import { MediaLibraryPicker } from "@/components/media/MediaLibraryPicker";
import type { MediaItem } from "@/lib/media-data";
import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";

const CATEGORIES = [
  "EdTech / Learning Platform",
  "Education",
  "Analytics",
  "Healthcare",
  "E-Commerce",
  "Portfolio / Showcase",
  "Enterprise SaaS",
  "Community / Forum",
  "AI & Automation",
  "Productivity",
];

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];
const MAX_MEDIA_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Reads a File object into a base64 string (stripping the data:* prefix).
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

/**
 * Resolves reliable MIME type from file.type or file extension fallback.
 */
function getMimeTypeFromFile(file: File): string {
  if (file.type && ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return file.type.toLowerCase();
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    default:
      return file.type || "image/png";
  }
}

/**
 * Validates file type, size, and disallows dangerous formats like SVG before encoding.
 */
function validateImageFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isSvgExt = ext === "svg" || file.name.toLowerCase().endsWith(".svg");
  const isSvgMime = file.type === "image/svg+xml" || file.type.toLowerCase().includes("svg");
  if (isSvgExt || isSvgMime) {
    return "SVG uploads are disabled for security reasons.";
  }
  if (file.size === 0) {
    return "File is empty.";
  }
  if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
    return "File exceeds maximum allowed size of 50 MB.";
  }
  const detectedMime = getMimeTypeFromFile(file);
  if (!ALLOWED_IMAGE_TYPES.includes(detectedMime)) {
    return `Unsupported image type "${file.type || ext}". Allowed: JPEG, PNG, WebP, GIF, AVIF.`;
  }
  return null;
}

export type WebsiteFormData = {
  name: string;
  url: string;
  description: string;
  fullDescription: string;
  technologies: string[];
  status: WebsiteStatus;
  order: number;
  githubUrl: string;
  videoUrl: string;
  category: string;
  launchDate: string;
  teamSize: string;
  featured: boolean;
  tags: string[];
  thumbnailId: string | null;
  thumbnailPreview: string;
  galleryMediaIds: string[];
  galleryPreviews: string[];
};

function defaultFormData(website?: WebsiteItem | null): WebsiteFormData {
  if (website) {
    const galleryIds = website.gallery ? website.gallery.map((g) => g.mediaId) : [];
    const galleryUrls = website.gallery ? website.gallery.map((g) => g.url) : [];

    return {
      name: website.name || "",
      url: website.url || "",
      description: website.description || "",
      fullDescription: website.fullDescription || website.description || "",
      technologies: website.technologies ? [...website.technologies] : [],
      status: website.status || "Draft",
      order: website.order || 1,
      githubUrl: website.githubUrl || "",
      videoUrl: website.videoUrl || "",
      category: website.category || "",
      launchDate: website.launchDate || "",
      teamSize: website.teamSize || "",
      featured: Boolean(website.featured),
      tags: website.tags ? [...website.tags] : [],
      thumbnailId: website.thumbnailId || null,
      thumbnailPreview: website.image || "",
      galleryMediaIds: galleryIds,
      galleryPreviews: galleryUrls,
    };
  }
  return {
    name: "",
    url: "",
    description: "",
    fullDescription: "",
    technologies: [],
    status: "Draft",
    order: 1,
    githubUrl: "",
    videoUrl: "",
    category: "",
    launchDate: "",
    teamSize: "",
    featured: false,
    tags: [],
    thumbnailId: null,
    thumbnailPreview: "",
    galleryMediaIds: [],
    galleryPreviews: [],
  };
}

interface WebsiteFormProps {
  website?: WebsiteItem | null;
  isEdit?: boolean;
  isSaving?: boolean;
  onSave: (data: WebsiteFormData, status: WebsiteStatus) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onViewLive?: () => void;
  onPreview?: () => void;
  onDirtyChange?: (dirty: boolean, currentForm: WebsiteFormData) => void;
}

const cardCls =
  "dash-panel relative overflow-hidden rounded-xl border border-brand/28 p-5";
const inputCls =
  "w-full rounded-lg border border-brand/28 bg-panel px-3.5 py-2.5 text-[13.5px] text-foreground placeholder:text-muted-foreground/55 outline-none focus:border-brand-bright/70 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_12%,transparent)] transition-all";
const labelCls = "mb-1.5 block text-[13px] font-semibold text-foreground/85";
const cardHeaderIcon =
  "flex items-center gap-3 border-b border-brand/15 pb-3.5 mb-4";

export function WebsiteForm({
  website,
  isEdit = false,
  isSaving = false,
  onSave,
  onCancel,
  onDelete,
  onViewLive,
  onPreview,
  onDirtyChange,
}: WebsiteFormProps) {
  const [form, setForm] = useState<WebsiteFormData>(() => defaultFormData(website));
  const initialFormRef = useRef(JSON.stringify(defaultFormData(website)));
  const [techInput, setTechInput] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    url?: string;
    description?: string;
    thumbnail?: string;
  }>({});

  const nameInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [thumbnailPickerOpen, setThumbnailPickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);

  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  const set = (field: keyof WebsiteFormData, value: unknown) => {
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setForm((p) => {
      const updated = { ...p, [field]: value };
      if (onDirtyChange) {
        onDirtyChange(JSON.stringify(updated) !== initialFormRef.current, updated);
      }
      return updated;
    });
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    const validationErr = validateImageFile(file);
    if (validationErr) {
      toast.error(validationErr);
      return;
    }

    setIsUploadingThumbnail(true);
    try {
      const base64Content = await readFileAsBase64(file);
      const res = await adminClient.uploadMediaAsset({
        name: file.name,
        originalFilename: file.name,
        mimeType: getMimeTypeFromFile(file),
        size: file.size,
        base64Content,
        category: "WEBSITES",
        altText: file.name.replace(/\.[^/.]+$/, ""),
      });

      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to upload cover screenshot.");
        return;
      }

      const asset = res.data;
      setErrors((prev) => ({ ...prev, thumbnail: undefined }));
      setForm((p) => {
        const updated = {
          ...p,
          thumbnailId: asset.id,
          thumbnailPreview: asset.publicUrl || "",
        };
        if (onDirtyChange) {
          onDirtyChange(JSON.stringify(updated) !== initialFormRef.current, updated);
        }
        return updated;
      });
      toast.success(`Uploaded and set "${asset.name}" as cover image.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      toast.error(msg);
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleThumbnailSelect = (selected: MediaItem[]) => {
    if (selected[0]) {
      setErrors((prev) => ({ ...prev, thumbnail: undefined }));
      setForm((p) => {
        const updated = {
          ...p,
          thumbnailId: selected[0]!.id,
          thumbnailPreview: selected[0]!.thumbnail || selected[0]!.url || "",
        };
        if (onDirtyChange) {
          onDirtyChange(JSON.stringify(updated) !== initialFormRef.current, updated);
        }
        return updated;
      });
      toast.success(`Attached "${selected[0].name}" from Media Library.`);
    }
  };

  const handleRemoveThumbnail = () => {
    setForm((p) => {
      const updated = {
        ...p,
        thumbnailId: null,
        thumbnailPreview: "",
      };
      if (onDirtyChange) {
        onDirtyChange(JSON.stringify(updated) !== initialFormRef.current, updated);
      }
      return updated;
    });
  };

  const handleGallerySelect = (selected: MediaItem[]) => {
    const remaining = 10 - form.galleryMediaIds.length;
    const nonDuplicates = selected.filter((item) => !form.galleryMediaIds.includes(item.id));
    const toAdd = nonDuplicates.slice(0, remaining);
    if (toAdd.length === 0) {
      if (selected.length > 0 && nonDuplicates.length === 0) {
        toast.info("Selected screenshot(s) are already in the gallery.");
      }
      return;
    }

    const newIds = toAdd.map((item) => item.id);
    const newPreviews = toAdd
      .map((item) => item.thumbnail || item.url)
      .filter((url): url is string => Boolean(url));

    setForm((p) => {
      const updated = {
        ...p,
        galleryMediaIds: [...p.galleryMediaIds, ...newIds],
        galleryPreviews: [...p.galleryPreviews, ...newPreviews],
      };
      if (onDirtyChange) {
        onDirtyChange(JSON.stringify(updated) !== initialFormRef.current, updated);
      }
      return updated;
    });
    toast.success(`Added ${toAdd.length} screenshot(s) from Media Library.`);
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (files.length === 0) return;

    const remaining = 10 - form.galleryMediaIds.length;
    if (remaining <= 0) {
      toast.error("Maximum limit of 10 gallery screenshots reached.");
      return;
    }

    const toProcess = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.info(`Only the first ${remaining} image(s) will be uploaded to stay within the 10-image limit.`);
    }

    setIsUploadingGallery(true);
    const uploadedIds: string[] = [];
    const uploadedPreviews: string[] = [];

    for (const file of toProcess) {
      const validationErr = validateImageFile(file);
      if (validationErr) {
        toast.error(`"${file.name}": ${validationErr}`);
        continue;
      }

      try {
        const base64Content = await readFileAsBase64(file);
        const res = await adminClient.uploadMediaAsset({
          name: file.name,
          originalFilename: file.name,
          mimeType: getMimeTypeFromFile(file),
          size: file.size,
          base64Content,
          category: "WEBSITES",
          altText: file.name.replace(/\.[^/.]+$/, ""),
        });

        if (res.success && res.data) {
          const assetId = res.data.id;
          if (!form.galleryMediaIds.includes(assetId) && !uploadedIds.includes(assetId)) {
            uploadedIds.push(assetId);
            uploadedPreviews.push(res.data.publicUrl);
          }
        } else {
          toast.error(`"${file.name}": ${res.error || "Upload failed."}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        toast.error(`"${file.name}": ${msg}`);
      }
    }

    if (uploadedIds.length > 0) {
      setForm((p) => {
        const updated = {
          ...p,
          galleryMediaIds: [...p.galleryMediaIds, ...uploadedIds],
          galleryPreviews: [...p.galleryPreviews, ...uploadedPreviews],
        };
        if (onDirtyChange) {
          onDirtyChange(JSON.stringify(updated) !== initialFormRef.current, updated);
        }
        return updated;
      });
      toast.success(`Successfully uploaded and added ${uploadedIds.length} screenshot(s) to gallery.`);
    }

    setIsUploadingGallery(false);
  };

  const removeGallery = (i: number) => {
    setForm((p) => {
      const updated = {
        ...p,
        galleryPreviews: p.galleryPreviews.filter((_, idx) => idx !== i),
        galleryMediaIds: p.galleryMediaIds.filter((_, idx) => idx !== i),
      };
      if (onDirtyChange) {
        onDirtyChange(JSON.stringify(updated) !== initialFormRef.current, updated);
      }
      return updated;
    });
  };

  const moveGalleryItem = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= form.galleryMediaIds.length) return;

    setForm((p) => {
      const newMediaIds = [...p.galleryMediaIds];
      const newPreviews = [...p.galleryPreviews];

      const tempId = newMediaIds[index];
      const tempPreview = newPreviews[index];

      newMediaIds[index] = newMediaIds[targetIndex]!;
      newPreviews[index] = newPreviews[targetIndex]!;

      newMediaIds[targetIndex] = tempId!;
      newPreviews[targetIndex] = tempPreview!;

      const updated = {
        ...p,
        galleryMediaIds: newMediaIds,
        galleryPreviews: newPreviews,
      };
      if (onDirtyChange) {
        onDirtyChange(JSON.stringify(updated) !== initialFormRef.current, updated);
      }
      return updated;
    });
  };

  const addTech = () => {
    const v = techInput.trim();
    if (v && !form.technologies.includes(v)) {
      set("technologies", [...form.technologies, v]);
    }
    setTechInput("");
  };

  const removeTech = (t: string) =>
    set("technologies", form.technologies.filter((x) => x !== t));

  const validateAndSubmit = (status: WebsiteStatus) => {
    if (isUploadingThumbnail || isUploadingGallery) {
      toast.error("Please wait for media uploads to complete before saving.");
      return;
    }

    const newErrors: {
      name?: string;
      url?: string;
      description?: string;
      thumbnail?: string;
    } = {};

    if (!form.name.trim()) {
      newErrors.name = "Website name is required";
    }

    const trimmedUrl = form.url.trim();
    if (status === "Published") {
      if (!trimmedUrl) {
        newErrors.url = "Live Website URL is required to publish a website";
      } else if (/^(javascript|data|vbscript|file):/i.test(trimmedUrl)) {
        newErrors.url = "Dangerous or unsupported URL scheme is not allowed";
      }
    } else {
      // Draft / Archived: optional, but if entered must not use dangerous schemes
      if (trimmedUrl && /^(javascript|data|vbscript|file):/i.test(trimmedUrl)) {
        newErrors.url = "Dangerous or unsupported URL scheme is not allowed";
      }
    }

    if (!form.description.trim()) {
      newErrors.description = "Short description is required";
    }

    // Required thumbnail for both Draft and Publish
    if (!form.thumbnailId || !form.thumbnailId.trim()) {
      newErrors.thumbnail = "A cover screenshot or thumbnail is required before saving.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);

      if (newErrors.name) {
        nameInputRef.current?.focus();
      } else if (newErrors.url) {
        urlInputRef.current?.focus();
      } else if (newErrors.description) {
        descInputRef.current?.focus();
      } else if (newErrors.thumbnail) {
        thumbnailContainerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      }

      toast.error(
        newErrors.thumbnail && !newErrors.name && !newErrors.url && !newErrors.description
          ? "Please attach a cover screenshot or thumbnail from the Media Library."
          : "Please fill in all required fields."
      );
      return;
    }

    // Explicitly synchronize status with the action taken so UI and submitted payload never contradict each other
    const updatedForm: WebsiteFormData = {
      ...form,
      status,
      url: trimmedUrl,
    };
    setForm(updatedForm);
    if (onDirtyChange) {
      onDirtyChange(JSON.stringify(updatedForm) !== initialFormRef.current, updatedForm);
    }

    onSave(updatedForm, status);
  };

  const shortDescMax = 150;
  const fullDescMax = 2000;

  return (
    <div className="space-y-4">
      {/* ── ROW 1: Basic Information + Website Images ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* LEFT: Basic Information */}
        <section className={cardCls}>
          {/* Subtle top-edge light highlight */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-bright)_50%,transparent)] to-transparent" />

          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <Globe className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Basic Information</h2>
              <p className="text-[12px] text-muted-foreground">
                {isEdit ? "Update main details about the website." : "Enter essential website details."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Website Name */}
            <div>
              <label className={labelCls}>
                Website Name <span className="text-red-400">*</span>
              </label>
              <input
                ref={nameInputRef}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. CobraLearn Platform"
                className={`${inputCls} ${errors.name ? "border-red-500/70 focus:border-red-500" : ""}`}
              />
              {errors.name && <p className="mt-1 text-[11.5px] text-red-400 font-medium">{errors.name}</p>}
            </div>

            {/* Live Website URL */}
            <div>
              <label className={labelCls}>
                Live Website URL{" "}
                <span className="text-muted-foreground/55 font-normal">
                  (Required to Publish)
                </span>
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                <input
                  ref={urlInputRef}
                  value={form.url}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://cobralearn.dev"
                  className={`${inputCls} pl-9 ${errors.url ? "border-red-500/70 focus:border-red-500" : ""}`}
                />
                {form.url && (
                  <a
                    href={form.url}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-brand-bright transition"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
              {errors.url && <p className="mt-1 text-[11.5px] text-red-400 font-medium">{errors.url}</p>}
            </div>

            {/* Short Description */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className={labelCls}>
                  Short Description <span className="text-red-400">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {form.description.length}/{shortDescMax}
                </span>
              </div>
              <textarea
                ref={descInputRef}
                value={form.description}
                maxLength={shortDescMax}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brief summary of the website for showcase cards..."
                rows={3}
                className={`${inputCls} resize-none ${errors.description ? "border-red-500/70 focus:border-red-500" : ""}`}
              />
              {errors.description && <p className="mt-1 text-[11.5px] text-red-400 font-medium">{errors.description}</p>}
            </div>

            {/* Full / Rich Description */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className={labelCls}>
                  Full Overview / About <span className="text-muted-foreground/55 font-normal">(Optional)</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {form.fullDescription.length}/{fullDescMax}
                </span>
              </div>
              <textarea
                value={form.fullDescription}
                maxLength={fullDescMax}
                onChange={(e) => set("fullDescription", e.target.value)}
                placeholder="Detailed overview about architecture, impact and capabilities for detail page..."
                rows={4}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
        </section>

        {/* RIGHT: Website Images */}
        <section className={cardCls}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-bright)_50%,transparent)] to-transparent" />

          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <ImageIcon className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Website Images</h2>
              <p className="text-[12px] text-muted-foreground">
                {isEdit ? "Manage screenshot preview and gallery images." : "Upload website screenshot and gallery."}
              </p>
            </div>
          </div>

          {/* Thumbnail preview */}
          <div ref={thumbnailContainerRef} className="mb-4 scroll-mt-6">
            <label className={labelCls}>
              Screenshot / Cover Image <span className="text-red-400">*</span>
            </label>
            {form.thumbnailPreview ? (
              <div className={`relative overflow-hidden rounded-lg border shadow-[0_0_16px_color-mix(in_oklab,var(--brand)_14%,transparent)] ${errors.thumbnail ? "border-red-500/70" : "border-brand-bright/50"}`}>
                <img
                  src={form.thumbnailPreview}
                  alt="Website screenshot"
                  className="aspect-[16/9] w-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveThumbnail}
                  title="Remove cover from website"
                  className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur-md border border-brand/30 hover:border-brand-bright transition cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isUploadingThumbnail}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded border border-brand-bright/70 bg-background/90 px-2.5 py-1 text-[11.5px] font-semibold text-brand-bright backdrop-blur-md hover:bg-brand/20 transition cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingThumbnail ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
                    <span>{isUploadingThumbnail ? "Uploading..." : "Upload New"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isUploadingThumbnail}
                    onClick={() => setThumbnailPickerOpen(true)}
                    className="flex items-center gap-1.5 rounded border border-brand/40 bg-background/90 px-2.5 py-1 text-[11.5px] font-semibold text-foreground/90 backdrop-blur-md hover:border-brand-bright hover:text-brand-bright transition cursor-pointer disabled:opacity-50"
                  >
                    From Library
                  </button>
                </div>
                <span className="absolute bottom-2 right-2 text-[11px] text-muted-foreground/70 hidden sm:inline">
                  PNG, JPG, WebP (1920×1080)
                </span>
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-panel/60 py-7 text-center transition ${errors.thumbnail ? "border-red-500/70 bg-red-950/10" : "border-brand/40 hover:border-brand-bright"}`}>
                {isUploadingThumbnail ? (
                  <>
                    <Loader2 className="size-8 text-brand-bright animate-spin" />
                    <p className="text-[13px] font-medium text-foreground/70">Uploading screenshot to Media Library...</p>
                  </>
                ) : (
                  <>
                    <ImageIcon className="size-8 text-muted-foreground/50" />
                    <p className="text-[13px] font-medium text-foreground/70">Upload cover or choose from Media Library</p>
                    <p className="text-[11.5px] text-muted-foreground/60">PNG, JPG, WebP (Required: 1920×1080)</p>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 rounded-md bg-brand-bright px-3.5 py-1.5 text-[12.5px] font-semibold text-black transition hover:bg-brand-bright/85 cursor-pointer shadow-[0_0_10px_color-mix(in_oklab,var(--brand-bright)_30%,transparent)]"
                      >
                        <ImageIcon className="size-3.5" /> Upload Cover
                      </button>
                      <button
                        type="button"
                        onClick={() => setThumbnailPickerOpen(true)}
                        className="flex items-center gap-1.5 rounded-md border border-brand/40 bg-panel px-3.5 py-1.5 text-[12.5px] font-semibold text-foreground/90 transition hover:border-brand-bright hover:text-brand-bright cursor-pointer"
                      >
                        Select from Library
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {errors.thumbnail && (
              <p className="mt-1.5 text-[11.5px] text-red-400 font-medium">{errors.thumbnail}</p>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleThumbnailUpload}
          />

          {/* Gallery Screenshots */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className={labelCls}>
                Gallery Screenshots{" "}
                <span className="text-muted-foreground/60 font-normal">
                  ({form.galleryMediaIds.length}/10)
                </span>
              </label>
              {isUploadingGallery && (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-bright">
                  <Loader2 className="size-3 animate-spin" /> Uploading screenshots...
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {/* Add Images Controls */}
              {form.galleryMediaIds.length < 10 && (
                <>
                  <div
                    onClick={() => !isUploadingGallery && galleryInputRef.current?.click()}
                    className={`flex aspect-[4/3] w-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-brand/35 bg-panel/50 text-muted-foreground/60 transition hover:border-brand-bright hover:text-brand-bright ${isUploadingGallery ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <Upload className="size-4" />
                    <span className="text-[10px] font-semibold">Upload New</span>
                    <span className="text-[9px] text-center px-1 text-muted-foreground/50">
                      Max 10
                    </span>
                  </div>
                  <div
                    onClick={() => !isUploadingGallery && setGalleryPickerOpen(true)}
                    className={`flex aspect-[4/3] w-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-brand/35 bg-panel/50 text-muted-foreground/60 transition hover:border-brand-bright hover:text-foreground ${isUploadingGallery ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <FolderOpen className="size-4 text-brand-bright" />
                    <span className="text-[10px] font-semibold">From Library</span>
                    <span className="text-[9px] text-center px-1 text-muted-foreground/50">
                      Pick media
                    </span>
                  </div>
                </>
              )}

              {/* Gallery Items */}
              {form.galleryPreviews.map((src, i) => (
                <div
                  key={form.galleryMediaIds[i] || i}
                  className="group relative aspect-[4/3] w-[96px] overflow-hidden rounded-lg border border-brand/30 shadow-[0_0_8px_color-mix(in_oklab,var(--brand)_10%,transparent)]"
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  
                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => removeGallery(i)}
                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-background/85 text-foreground backdrop-blur-sm hover:bg-red-900/70 transition cursor-pointer"
                    title="Remove screenshot from website"
                  >
                    <X className="size-3" />
                  </button>

                  {/* Reorder Arrows on hover */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/75 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveGalleryItem(i, "left")}
                      className="text-muted-foreground hover:text-brand-bright disabled:opacity-30 cursor-pointer"
                      title="Move Left"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <span className="text-[9px] font-mono text-muted-foreground">{i + 1}</span>
                    <button
                      type="button"
                      disabled={i === form.galleryMediaIds.length - 1}
                      onClick={() => moveGalleryItem(i, "right")}
                      className="text-muted-foreground hover:text-brand-bright disabled:opacity-30 cursor-pointer"
                      title="Move Right"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleGalleryUpload}
            />
          </div>
        </section>
      </div>

      {/* Media Library Pickers */}
      <MediaLibraryPicker
        open={thumbnailPickerOpen}
        onClose={() => setThumbnailPickerOpen(false)}
        onSelect={handleThumbnailSelect}
        title="Select Website Cover Image"
        allowedTypes={["Image"]}
        initialCategory="Websites"
        multiple={false}
      />

      <MediaLibraryPicker
        open={galleryPickerOpen}
        onClose={() => setGalleryPickerOpen(false)}
        onSelect={handleGallerySelect}
        title="Select Website Screenshots"
        allowedTypes={["Image"]}
        initialCategory="Websites"
        multiple={true}
        maxSelection={10 - form.galleryMediaIds.length}
      />

      {/* ── ROW 2: Links | Technologies | Settings ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Website Links */}
        <section className={cardCls}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-bright)_50%,transparent)] to-transparent" />

          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <Link2 className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Project Links</h2>
              <p className="text-[12px] text-muted-foreground">Source code and video presentations.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>GitHub / Source Code <span className="text-muted-foreground/55 font-normal">(Optional)</span></label>
              <div className="relative">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                <input
                  value={form.githubUrl}
                  onChange={(e) => set("githubUrl", e.target.value)}
                  placeholder="https://github.com/..."
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Walkthrough Video URL <span className="text-muted-foreground/55 font-normal">(Optional)</span></label>
              <div className="relative">
                <Video className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                <input
                  value={form.videoUrl}
                  onChange={(e) => set("videoUrl", e.target.value)}
                  placeholder="https://youtube.com/..."
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Technologies Stack */}
        <section className={cardCls}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-bright)_50%,transparent)] to-transparent" />

          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <Globe className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Technologies</h2>
              <p className="text-[12px] text-muted-foreground">Frameworks, libraries and tools used.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTech())}
                placeholder="e.g. Next.js, Tailwind"
                className={inputCls}
              />
              <button
                type="button"
                onClick={addTech}
                className="shrink-0 rounded-lg border border-brand/35 bg-panel px-3.5 py-2 text-[13px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground cursor-pointer"
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {form.technologies.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded border border-brand/25 bg-brand/8 px-2 py-0.5 text-[11px] font-medium text-foreground/90"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTech(t)}
                    className="text-muted-foreground hover:text-red-400 transition"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Visibility & Ordering */}
        <section className={cardCls}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-bright)_50%,transparent)] to-transparent" />

          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <Globe className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Visibility & Order</h2>
              <p className="text-[12px] text-muted-foreground">Publishing state and display position.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as WebsiteStatus)}
                className={`${inputCls} appearance-none`}
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Display Order</label>
              <input
                type="number"
                min={0}
                value={form.order}
                onChange={(e) => set("order", parseInt(e.target.value, 10) || 0)}
                className={inputCls}
              />
            </div>

            <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => set("featured", e.target.checked)}
                className="size-4 rounded border-brand/30 bg-panel accent-brand-bright"
              />
              <span className="text-[13px] font-semibold text-foreground/90">
                Mark as Featured Website
              </span>
            </label>
          </div>
        </section>
      </div>

      {/* ── ROW 3: Additional Details ── */}
      <section className={cardCls}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-bright)_50%,transparent)] to-transparent" />

        <div className={cardHeaderIcon}>
          <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
            <AlignLeft className="size-4.5 text-brand-bright" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Additional Details</h2>
            <p className="text-[12px] text-muted-foreground">Category, release dates and metadata.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelCls}>Category <span className="text-muted-foreground/55 font-normal">(Optional)</span></label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className={`${inputCls} appearance-none`}
            >
              <option value="">Select category</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Launch Date <span className="text-muted-foreground/55 font-normal">(Optional)</span></label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
              <input
                value={form.launchDate}
                onChange={(e) => set("launchDate", e.target.value)}
                placeholder="e.g. Jan 2024"
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Team Size <span className="text-muted-foreground/55 font-normal">(Optional)</span></label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
              <input
                value={form.teamSize}
                onChange={(e) => set("teamSize", e.target.value)}
                placeholder="e.g. 1-5"
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── BOTTOM ACTIONS ── */}
      <div className="flex items-center justify-between border-t border-brand/12 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg border border-brand/28 bg-panel px-5 py-2.5 text-[13.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground cursor-pointer"
        >
          ← {isEdit ? "Back to Websites" : "Cancel"}
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving || isUploadingThumbnail || isUploadingGallery}
            onClick={() => validateAndSubmit("Draft")}
            className="rounded-lg border border-brand/35 bg-panel px-5 py-2.5 text-[13.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSaving ? "Saving..." : "Save as Draft"}
          </button>
          {isEdit ? (
            <>
              <button
                type="button"
                disabled={isSaving || isUploadingThumbnail || isUploadingGallery}
                onClick={() => validateAndSubmit(form.status)}
                className="rounded-lg border border-brand/45 bg-panel px-5 py-2.5 text-[13.5px] font-semibold text-brand-bright shadow-[0_0_12px_color-mix(in_oklab,var(--brand)_15%,transparent)] transition hover:border-brand-bright hover:bg-brand/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Update Website →"
                )}
              </button>
              {form.status === "Draft" && (
                <button
                  type="button"
                  disabled={isSaving || isUploadingThumbnail || isUploadingGallery}
                  onClick={() => validateAndSubmit("Published")}
                  className="flex items-center gap-2 rounded-lg bg-brand-bright px-6 py-2.5 text-[13.5px] font-bold text-black shadow-[0_0_18px_color-mix(in_oklab,var(--brand-bright)_45%,transparent),0_0_36px_color-mix(in_oklab,var(--brand)_22%,transparent)] transition hover:bg-brand-bright/90 hover:shadow-[0_0_24px_color-mix(in_oklab,var(--brand-bright)_55%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Publishing...
                    </>
                  ) : (
                    "Publish Website →"
                  )}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={isSaving || isUploadingThumbnail || isUploadingGallery}
              onClick={() => validateAndSubmit("Published")}
              className="flex items-center gap-2 rounded-lg bg-brand-bright px-6 py-2.5 text-[13.5px] font-bold text-black shadow-[0_0_18px_color-mix(in_oklab,var(--brand-bright)_45%,transparent),0_0_36px_color-mix(in_oklab,var(--brand)_22%,transparent)] transition hover:bg-brand-bright/90 hover:shadow-[0_0_24px_color-mix(in_oklab,var(--brand-bright)_55%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving...
                </>
              ) : (
                "Publish Website →"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
