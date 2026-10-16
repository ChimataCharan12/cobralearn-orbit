import { useState, useRef } from "react";
import {
  Bold,
  Calendar,
  Code,
  ExternalLink,
  FolderOpen,
  Github,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Monitor,
  Plus,
  Settings2,
  Star,
  Underline,
  Upload,
  Users,
  Video,
  X,
  AlignLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ProjectItem, ProjectStatus } from "@/lib/projects-data";
import { MediaLibraryPicker } from "@/components/media/MediaLibraryPicker";
import type { MediaItem } from "@/lib/media-data";
import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";

const CATEGORIES = [
  "Full Stack Development",
  "Frontend Development",
  "Backend Development",
  "Mobile Development",
  "AI / ML",
  "Data Science",
  "DevOps",
  "Cybersecurity",
  "Game Development",
  "Blockchain",
  "Education",
  "Healthcare",
  "E-Commerce",
  "Productivity",
];

export type ProjectFormData = Omit<ProjectItem, "id" | "image" | "extraTechCount"> & {
  fullDescription: string;
  githubUrl: string;
  videoUrl: string;
  category: string;
  projectDuration: string;
  teamSize: string;
  featured: boolean;
  thumbnailId: string | null;
  thumbnailPreview: string;
  galleryMediaIds: string[];
  galleryPreviews: string[];
};

function defaultFormData(project?: ProjectItem | null): ProjectFormData {
  if (project) {
    return {
      name: project.name,
      description: project.description,
      fullDescription: project.fullDescription || project.description || "",
      technologies: [...project.technologies],
      status: project.status,
      order: project.order,
      liveUrl: project.liveUrl || "",
      githubUrl: project.githubUrl || "",
      videoUrl: project.videoUrl || "",
      category: project.category || "",
      projectDuration: project.projectDuration || "",
      teamSize: project.teamSize || "",
      featured: Boolean(project.featured),
      tags: project.tags || [],
      thumbnailId: project.thumbnailId || null,
      thumbnailPreview: project.thumbnailId ? (project.image || "") : "",
      galleryMediaIds: project.galleryMediaIds ? [...project.galleryMediaIds] : [],
      galleryPreviews: project.galleryPreviews ? [...project.galleryPreviews] : [],
    };
  }
  return {
    name: "",
    description: "",
    fullDescription: "",
    technologies: [],
    status: "Draft",
    order: 1,
    liveUrl: "",
    githubUrl: "",
    videoUrl: "",
    category: "",
    projectDuration: "",
    teamSize: "",
    featured: false,
    tags: [],
    thumbnailId: null,
    thumbnailPreview: "",
    galleryMediaIds: [],
    galleryPreviews: [],
  };
}

interface ProjectFormProps {
  project?: ProjectItem | null;
  isEdit?: boolean;
  isSaving?: boolean;
  onSave: (data: ProjectFormData, status: ProjectStatus) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onViewOnWebsite?: () => void;
  onPreview?: () => void;
  onDirtyChange?: (dirty: boolean, currentForm: ProjectFormData) => void;
}

const cardCls =
  "dash-panel relative overflow-hidden rounded-xl border border-brand/28 p-5";
const inputCls =
  "w-full rounded-lg border border-brand/28 bg-panel px-3.5 py-2.5 text-[13.5px] text-foreground placeholder:text-muted-foreground/55 outline-none focus:border-brand-bright/70 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_12%,transparent)] transition-all";
const labelCls = "mb-1.5 block text-[13px] font-semibold text-foreground/85";
const cardHeaderIcon =
  "flex items-center gap-3 border-b border-brand/15 pb-3.5 mb-4";

const MAX_MEDIA_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

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

type ProjectFormErrors = {
  name?: string | undefined;
  description?: string | undefined;
  thumbnail?: string | undefined;
};

export function ProjectForm({
  project,
  isEdit = false,
  isSaving = false,
  onSave,
  onCancel,
  onDelete,
  onViewOnWebsite,
  onPreview,
  onDirtyChange,
}: ProjectFormProps) {
  const [form, setForm] = useState<ProjectFormData>(() => defaultFormData(project));
  const initialFormRef = useRef(JSON.stringify(defaultFormData(project)));
  const [techInput, setTechInput] = useState("");

  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  const [thumbnailPickerOpen, setThumbnailPickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);

  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isDirty = JSON.stringify(form) !== initialFormRef.current;

  const set = (field: keyof ProjectFormData, value: unknown) => {
    if (errors[field as keyof ProjectFormErrors]) {
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

  const validateForm = (): boolean => {
    const newErrors: ProjectFormErrors = {};
    if (!form.name.trim()) {
      newErrors.name = "Project title is required";
    }
    if (!form.description.trim()) {
      newErrors.description = "Short description is required";
    }
    if (!form.thumbnailId || !form.thumbnailId.trim()) {
      newErrors.thumbnail = "A thumbnail or cover image is required before saving.";
    }

    setErrors(newErrors);

    if (newErrors.name) {
      nameInputRef.current?.focus();
      return false;
    }
    if (newErrors.description) {
      descInputRef.current?.focus();
      return false;
    }
    if (newErrors.thumbnail) {
      thumbnailContainerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      toast.error(
        !newErrors.name && !newErrors.description
          ? "Please attach a thumbnail or cover image from the Media Library."
          : "Please fill in all required fields."
      );
      return false;
    }
    return true;
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

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (thumbInputRef.current) thumbInputRef.current.value = "";
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
        category: "PROJECTS",
        altText: file.name.replace(/\.[^/.]+$/, ""),
      });

      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to upload thumbnail.");
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
      toast.success(`Uploaded and set "${asset.name}" as thumbnail.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      toast.error(msg);
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleGallerySelect = (selected: MediaItem[]) => {
    const remaining = 10 - form.galleryMediaIds.length;
    // Disallow duplicates already in gallery
    const nonDuplicates = selected.filter((item) => !form.galleryMediaIds.includes(item.id));
    const toAdd = nonDuplicates.slice(0, remaining);
    if (toAdd.length === 0) {
      if (selected.length > 0 && nonDuplicates.length === 0) {
        toast.info("Selected image(s) are already in the gallery.");
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
    toast.success(`Added ${toAdd.length} image(s) from Media Library.`);
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (files.length === 0) return;

    const remaining = 10 - form.galleryMediaIds.length;
    if (remaining <= 0) {
      toast.error("Maximum limit of 10 gallery images reached.");
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
          category: "PROJECTS",
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
      toast.success(`Successfully uploaded and added ${uploadedIds.length} image(s) to gallery.`);
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

      // Swap IDs
      const tempId = newMediaIds[index]!;
      newMediaIds[index] = newMediaIds[targetIndex]!;
      newMediaIds[targetIndex] = tempId;

      // Swap Previews
      const tempPreview = newPreviews[index]!;
      newPreviews[index] = newPreviews[targetIndex]!;
      newPreviews[targetIndex] = tempPreview;

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

  const handleCancelClick = () => {
    onCancel();
  };

  const shortDescMax = 150;
  const fullDescMax = 2000;

  return (
    <div className="space-y-4">
      {/* ── MAIN GRID ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* LEFT: Basic Information */}
        <section className={cardCls}>
          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <AlignLeft className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Basic Information</h2>
              <p className="text-[12px] text-muted-foreground">
                {isEdit ? "Update the main details about your project." : "Add the main details about your project."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Project Title */}
            <div>
              <label className={labelCls}>
                Project Title <span className="text-red-400">*</span>
              </label>
              <input
                ref={nameInputRef}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Enter project title"
                className={`${inputCls} ${errors.name ? "border-red-500/70 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" : ""}`}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && (
                <p className="mt-1 text-[12px] font-medium text-red-400" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Short Description */}
            <div>
              <label className={labelCls}>
                Short Description <span className="text-red-400">*</span>
              </label>
              <textarea
                ref={descInputRef}
                value={form.description}
                onChange={(e) => set("description", e.target.value.slice(0, shortDescMax))}
                placeholder="Brief description (shown on cards)"
                rows={2}
                className={`${inputCls} resize-none ${errors.description ? "border-red-500/70 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" : ""}`}
                aria-invalid={Boolean(errors.description)}
              />
              {errors.description && (
                <p className="mt-1 text-[12px] font-medium text-red-400" role="alert">
                  {errors.description}
                </p>
              )}
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {form.description.length}/{shortDescMax}
              </p>
            </div>

            {/* Full Description */}
            <div>
              <label className={labelCls}>
                Full Description <span className="text-red-400">*</span>
              </label>
              {/* Rich text-like toolbar */}
              <div className="rounded-t-lg border border-b-0 border-brand/28 bg-panel-strong px-3 py-2 flex flex-wrap items-center gap-1">
                <select className="rounded border border-brand/20 bg-panel px-1.5 py-0.5 text-[11.5px] text-foreground/80 outline-none mr-1">
                  <option>Paragraph</option>
                  <option>Heading 1</option>
                  <option>Heading 2</option>
                </select>
                {[
                  [Bold, "Bold"],
                  [Italic, "Italic"],
                  [Underline, "Underline"],
                  [List, "Bullet List"],
                  [ListOrdered, "Numbered List"],
                  [AlignLeft, "Align"],
                  [Link2, "Link"],
                  [ImageIcon, "Image"],
                  [Code, "Code"],
                ].map(([Icon, title]) => (
                  <button
                    key={String(title)}
                    type="button"
                    title={String(title)}
                    className="grid size-7 place-items-center rounded text-muted-foreground transition hover:bg-brand/12 hover:text-foreground"
                  >
                    {/* @ts-ignore */}
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
              <textarea
                value={form.fullDescription}
                onChange={(e) => set("fullDescription", e.target.value.slice(0, fullDescMax))}
                placeholder="Write a detailed description about the project..."
                rows={6}
                className={`${inputCls} rounded-t-none resize-none`}
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {form.fullDescription.length}/{fullDescMax}
              </p>
            </div>
          </div>
        </section>

        {/* RIGHT: Project Images */}
        <section className={cardCls}>
          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <ImageIcon className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Project Images</h2>
              <p className="text-[12px] text-muted-foreground">
                {isEdit ? "Manage thumbnail and gallery images." : "Upload project thumbnail and gallery images."}
              </p>
            </div>
          </div>

          {/* Thumbnail */}
          <div ref={thumbnailContainerRef} className="mb-4 scroll-mt-6">
            <label className={labelCls}>
              Thumbnail Image <span className="text-red-400">*</span>
            </label>
            {form.thumbnailPreview ? (
              <div className={`relative mb-4 overflow-hidden rounded-lg border shadow-[0_0_16px_color-mix(in_oklab,var(--brand)_14%,transparent)] ${errors.thumbnail ? "border-red-500/70" : "border-brand-bright/50"}`}>
                <img
                  src={form.thumbnailPreview}
                  alt="Thumbnail"
                  className="aspect-[16/9] w-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveThumbnail}
                  title="Remove thumbnail from project"
                  aria-label="Remove thumbnail"
                  disabled={isUploadingThumbnail}
                  className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur-md border border-brand/30 hover:border-brand-bright transition cursor-pointer disabled:opacity-50"
                >
                  <X className="size-3.5" />
                </button>
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => thumbInputRef.current?.click()}
                    disabled={isUploadingThumbnail}
                    aria-label="Upload New Thumbnail"
                    className="flex items-center gap-1.5 rounded border border-brand-bright/70 bg-background/90 px-2.5 py-1 text-[11.5px] font-semibold text-brand-bright backdrop-blur-md hover:bg-brand/20 transition cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingThumbnail ? (
                      <>
                        <Loader2 className="size-3 animate-spin text-brand-bright" /> Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="size-3" /> Upload New
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setThumbnailPickerOpen(true)}
                    disabled={isUploadingThumbnail}
                    aria-label="Choose Thumbnail from Library"
                    className="flex items-center gap-1.5 rounded border border-brand/40 bg-background/90 px-2.5 py-1 text-[11.5px] font-semibold text-foreground/90 backdrop-blur-md hover:border-brand-bright hover:text-brand-bright transition cursor-pointer disabled:opacity-50"
                  >
                    <FolderOpen className="size-3" /> From Library
                  </button>
                </div>
                <span className="absolute bottom-2 right-2 text-[11px] text-muted-foreground/70 hidden sm:inline">
                  PNG, JPG, WebP (1280×720)
                </span>
              </div>
            ) : (
              <div className={`mb-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-panel/60 py-7 text-center transition ${errors.thumbnail ? "border-red-500/70" : "border-brand/40 hover:border-brand-bright"}`}>
                {isUploadingThumbnail ? (
                  <>
                    <Loader2 className="size-8 animate-spin text-brand-bright" />
                    <p className="text-[13px] font-semibold text-brand-bright">Uploading thumbnail...</p>
                    <p className="text-[11.5px] text-muted-foreground/60">Converting and uploading to Media Library...</p>
                  </>
                ) : (
                  <>
                    <ImageIcon className="size-8 text-muted-foreground/50" />
                    <p className="text-[13px] font-medium text-foreground/70">Upload thumbnail or choose from Media Library</p>
                    <p className="text-[11.5px] text-muted-foreground/60">PNG, JPG, WebP (Recommended: 1280×720)</p>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => thumbInputRef.current?.click()}
                        disabled={isUploadingThumbnail}
                        aria-label="Upload Thumbnail"
                        className="flex items-center gap-1.5 rounded-md bg-brand-bright px-3.5 py-1.5 text-[12.5px] font-semibold text-black transition hover:bg-brand-bright/85 cursor-pointer shadow-[0_0_10px_color-mix(in_oklab,var(--brand-bright)_30%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload className="size-3.5" /> Upload Thumbnail
                      </button>
                      <button
                        type="button"
                        onClick={() => setThumbnailPickerOpen(true)}
                        disabled={isUploadingThumbnail}
                        aria-label="Choose Thumbnail from Library"
                        className="flex items-center gap-1.5 rounded-md border border-brand/40 bg-panel px-3.5 py-1.5 text-[12.5px] font-semibold text-foreground/90 transition hover:border-brand-bright hover:text-brand-bright cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FolderOpen className="size-3.5" /> Select from Library
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
            ref={thumbInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            aria-label="Upload thumbnail image"
            className="hidden"
            onChange={handleThumbnailUpload}
          />

          {/* Gallery Images */}
          <div>
            <label className={labelCls}>
              Gallery Images{" "}
              <span className="text-muted-foreground/60 font-normal">
                ({form.galleryPreviews.length}/10)
              </span>
            </label>
            <div className="flex flex-wrap gap-2.5">
              {/* Add Images Controls */}
              {form.galleryPreviews.length < 10 && (
                <>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isUploadingGallery}
                    aria-label="Upload New Gallery Images"
                    className="flex aspect-[4/3] w-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-brand/35 bg-panel/50 text-muted-foreground/60 transition hover:border-brand-bright hover:text-brand-bright disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingGallery ? (
                      <>
                        <Loader2 className="size-4 animate-spin text-brand-bright" />
                        <span className="text-[10px] font-semibold text-brand-bright">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" />
                        <span className="text-[10px] font-semibold">Upload New</span>
                        <span className="text-[9px] text-center px-1 text-muted-foreground/50">
                          Max {10 - form.galleryPreviews.length}
                        </span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryPickerOpen(true)}
                    disabled={isUploadingGallery}
                    aria-label="Choose Gallery Images from Library"
                    className="flex aspect-[4/3] w-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-brand/35 bg-panel/50 text-muted-foreground/60 transition hover:border-brand-bright hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FolderOpen className="size-4 text-brand-bright" />
                    <span className="text-[10px] font-semibold">From Library</span>
                    <span className="text-[9px] text-center px-1 text-muted-foreground/50">
                      Pick media
                    </span>
                  </button>
                </>
              )}

              {/* Gallery Items */}
              {form.galleryPreviews.map((src, i) => (
                <div
                  key={i}
                  className="group/item relative aspect-[4/3] w-[100px] overflow-hidden rounded-lg border border-brand/30 shadow-[0_0_8px_color-mix(in_oklab,var(--brand)_10%,transparent)]"
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeGallery(i)}
                    aria-label="Remove gallery image"
                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-background/85 text-foreground backdrop-blur-sm hover:bg-red-900/70 transition cursor-pointer"
                    title="Remove from project gallery"
                  >
                    <X className="size-3" />
                  </button>

                  {/* Move Left / Right Controls */}
                  <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => moveGalleryItem(i, "left")}
                      disabled={i === 0}
                      aria-label="Move gallery image left"
                      title={i === 0 ? "Already first image" : "Move left"}
                      className="grid size-5 place-items-center rounded bg-background/90 text-foreground/90 backdrop-blur-sm transition hover:bg-brand/40 hover:text-brand-bright disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      <ChevronLeft className="size-3" />
                    </button>
                    <span className="rounded bg-background/85 px-1 py-0.5 text-[9px] font-mono font-bold text-brand-bright backdrop-blur-sm">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveGalleryItem(i, "right")}
                      disabled={i === form.galleryPreviews.length - 1}
                      aria-label="Move gallery image right"
                      title={i === form.galleryPreviews.length - 1 ? "Already last image" : "Move right"}
                      className="grid size-5 place-items-center rounded bg-background/90 text-foreground/90 backdrop-blur-sm transition hover:bg-brand/40 hover:text-brand-bright disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      <ChevronRight className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              multiple
              aria-label="Upload gallery images"
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
        title="Select Project Thumbnail"
        allowedTypes={["Image"]}
        initialCategory="Projects"
        multiple={false}
        initialSelectedIds={form.thumbnailId ? [form.thumbnailId] : []}
      />

      <MediaLibraryPicker
        open={galleryPickerOpen}
        onClose={() => setGalleryPickerOpen(false)}
        onSelect={handleGallerySelect}
        title="Select Project Gallery Images"
        allowedTypes={["Image"]}
        initialCategory="Projects"
        multiple={true}
        maxSelection={10 - form.galleryMediaIds.length}
        initialSelectedIds={form.galleryMediaIds}
      />

      {/* ── ROW 2: Links | Technologies | Settings ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Project Links */}
        <section className={cardCls}>
          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <Link2 className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Project Links</h2>
              <p className="text-[12px] text-muted-foreground">
                {isEdit ? "Update relevant links for your project." : "Add relevant links for your project."}
              </p>
            </div>
          </div>
          <div className="space-y-3.5">
            <div>
              <label className={labelCls}>Live Project URL</label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                <input
                  value={form.liveUrl || ""}
                  onChange={(e) => set("liveUrl", e.target.value)}
                  placeholder="https://example.com"
                  className={`${inputCls} pl-9`}
                />
                {form.liveUrl && (
                  <a href={form.liveUrl} target="_blank" rel="noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-brand-bright transition">
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            </div>
            <div>
              <label className={labelCls}>GitHub Repository</label>
              <div className="relative">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                <input
                  value={form.githubUrl}
                  onChange={(e) => set("githubUrl", e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className={`${inputCls} pl-9`}
                />
                {form.githubUrl && (
                  <a href={form.githubUrl} target="_blank" rel="noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-brand-bright transition">
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            </div>
            <div>
              <label className={labelCls}>Demo Video URL <span className="text-muted-foreground/55 font-normal">(Optional)</span></label>
              <div className="relative">
                <Video className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                <input
                  value={form.videoUrl}
                  onChange={(e) => set("videoUrl", e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className={`${inputCls} pl-9`}
                />
                {form.videoUrl && (
                  <a href={form.videoUrl} target="_blank" rel="noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-brand-bright transition">
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Technologies */}
        <section className={cardCls}>
          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <Settings2 className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Technologies</h2>
              <p className="text-[12px] text-muted-foreground">
                {isEdit ? "Manage the technologies used in this project." : "Add technologies used in this project."}
              </p>
            </div>
          </div>
          <label className={labelCls}>Add Technology</label>
          <div className="flex gap-2">
            <input
              value={techInput}
              onChange={(e) => setTechInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTech())}
              placeholder="Type and press Enter"
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              onClick={addTech}
              className="flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-brand/15 px-4 text-[13px] font-semibold text-brand-bright transition hover:bg-brand/25 hover:border-brand-bright"
            >
              Add
            </button>
          </div>
          <p className="mt-3 mb-1.5 text-[12.5px] font-semibold text-foreground/70">Selected Technologies</p>
          <div className="flex flex-wrap gap-1.5">
            {form.technologies.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1 text-[12px] font-medium text-foreground/90"
              >
                {t}
                <button type="button" onClick={() => removeTech(t)} className="text-muted-foreground/60 hover:text-red-400 transition ml-0.5">
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {form.technologies.length === 0 && (
              <p className="text-[12px] text-muted-foreground/55 italic">No technologies added yet.</p>
            )}
          </div>
        </section>

        {/* Project Settings */}
        <section className={cardCls}>
          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <Monitor className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Project Settings</h2>
              <p className="text-[12px] text-muted-foreground">Control how this project appears.</p>
            </div>
          </div>
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Status <span className="text-red-400">*</span></label>
                <div className="relative">
                  <div className={`absolute left-3 top-1/2 -translate-y-1/2 size-2 rounded-full ${form.status === "Published" ? "bg-brand-bright shadow-[0_0_5px_var(--brand-bright)]" : form.status === "Draft" ? "bg-brand-gold shadow-[0_0_5px_var(--brand-gold)]" : "bg-muted-foreground"}`} />
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as ProjectStatus)}
                    className={`${inputCls} pl-7 appearance-none`}
                  >
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Display Order <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  min={1}
                  value={form.order}
                  onChange={(e) => set("order", Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Featured Project</label>
              <div className="flex items-center gap-3">
                <Star className={`size-5 ${form.featured ? "text-yellow-400" : "text-muted-foreground/40"}`} fill={form.featured ? "currentColor" : "none"} />
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.featured}
                  onClick={() => set("featured", !form.featured)}
                  className={`relative h-6 w-11 rounded-full border transition-all duration-200 ${form.featured ? "border-brand-bright bg-brand shadow-[0_0_10px_color-mix(in_oklab,var(--brand-bright)_35%,transparent)]" : "border-border/40 bg-muted/40"}`}
                >
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all duration-200 ${form.featured ? "left-5" : "left-0.5"}`} />
                </button>
                <span className="text-[12.5px] text-foreground/70">Show as featured project on homepage</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Additional Details ── */}
      <section className={cardCls}>
        <div className={cardHeaderIcon}>
          <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
            <AlignLeft className="size-4.5 text-brand-bright" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Additional Details</h2>
            <p className="text-[12px] text-muted-foreground">
              {isEdit ? "Update category, duration, and team details." : "Add more information to enhance your project."}
            </p>
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
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Project Duration <span className="text-muted-foreground/55 font-normal">(Optional)</span></label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
              <input
                value={form.projectDuration}
                onChange={(e) => set("projectDuration", e.target.value)}
                placeholder="e.g. Jan 2024 - Mar 2024"
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
                placeholder="e.g. 1, 2-5, 5+"
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
          onClick={handleCancelClick}
          className="flex items-center gap-2 rounded-lg border border-brand/28 bg-panel px-5 py-2.5 text-[13.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground cursor-pointer"
        >
          ← {isEdit ? "Back to Projects" : "Cancel"}
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving || isUploadingThumbnail || isUploadingGallery}
            onClick={() => {
              if (!validateForm()) return;
              set("status", "Draft");
              onSave({ ...form, status: "Draft" }, "Draft");
            }}
            className="rounded-lg border border-brand/35 bg-panel px-5 py-2.5 text-[13.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : isUploadingThumbnail || isUploadingGallery ? "Uploading Media..." : "Save as Draft"}
          </button>
          {isEdit ? (
            <>
              <button
                type="button"
                disabled={isSaving || isUploadingThumbnail || isUploadingGallery}
                onClick={() => {
                  if (!validateForm()) return;
                  onSave(form, form.status);
                }}
                className="rounded-lg border border-brand/45 bg-panel px-5 py-2.5 text-[13.5px] font-semibold text-brand-bright shadow-[0_0_12px_color-mix(in_oklab,var(--brand)_15%,transparent)] transition hover:border-brand-bright hover:bg-brand/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : isUploadingThumbnail || isUploadingGallery ? "Uploading Media..." : "Save Changes"}
              </button>
              {form.status === "Draft" && (
                <button
                  type="button"
                  disabled={isSaving || isUploadingThumbnail || isUploadingGallery}
                  onClick={() => {
                    if (!validateForm()) return;
                    set("status", "Published");
                    onSave({ ...form, status: "Published" }, "Published");
                  }}
                  className="flex items-center gap-2 rounded-lg bg-brand-bright px-6 py-2.5 text-[13.5px] font-bold text-black shadow-[0_0_18px_color-mix(in_oklab,var(--brand-bright)_45%,transparent),0_0_36px_color-mix(in_oklab,var(--brand)_22%,transparent)] transition hover:bg-brand-bright/90 hover:shadow-[0_0_24px_color-mix(in_oklab,var(--brand-bright)_55%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? "Saving..." : isUploadingThumbnail || isUploadingGallery ? "Uploading Media..." : "Publish Project →"}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={isSaving || isUploadingThumbnail || isUploadingGallery}
              onClick={() => {
                if (!validateForm()) return;
                set("status", "Published");
                onSave({ ...form, status: "Published" }, "Published");
              }}
              className="flex items-center gap-2 rounded-lg bg-brand-bright px-6 py-2.5 text-[13.5px] font-bold text-black shadow-[0_0_18px_color-mix(in_oklab,var(--brand-bright)_45%,transparent),0_0_36px_color-mix(in_oklab,var(--brand)_22%,transparent)] transition hover:bg-brand-bright/90 hover:shadow-[0_0_24px_color-mix(in_oklab,var(--brand-bright)_55%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : isUploadingThumbnail || isUploadingGallery ? "Uploading Media..." : "Publish Project →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
