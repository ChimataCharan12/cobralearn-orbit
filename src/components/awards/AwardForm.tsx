import { useState, useRef } from "react";
import {
  AlignLeft,
  Award,
  Bold,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Code,
  ExternalLink,
  Eye,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Settings2,
  Star,
  Trash2,
  Underline,
  Upload,
  X,
} from "lucide-react";
import type { AwardItem, AwardStatus } from "@/lib/awards-data";
import { MediaLibraryPicker } from "@/components/media/MediaLibraryPicker";
import type { MediaItem } from "@/lib/media-data";
import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";

const CATEGORIES = [
  "Institutional",
  "Community",
  "Technical",
  "Competition",
  "Certification",
] as const;

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

export type AwardFormData = {
  name: string;
  context: string;
  organization: string;
  category: "Institutional" | "Community" | "Technical" | "Competition" | "Certification";
  date: string;
  order: number;
  status: AwardStatus;
  description: string;
  fullDescription: string;
  credentialUrl: string;
  showOnHomepage: boolean;
  thumbnailId: string | null;
  thumbnailPreview: string;
  galleryMediaIds: string[];
  galleryPreviews: string[];
};

function defaultAwardData(award?: AwardItem | null): AwardFormData {
  if (award) {
    return {
      name: award.name || "",
      context: award.context || "",
      organization: award.organization || "",
      category: (award.category as any) || "Institutional",
      date: award.date || "",
      order: award.order || 1,
      status: award.status || "Draft",
      description: award.description || "",
      fullDescription: award.fullDescription || award.description || "",
      credentialUrl: award.credentialUrl || "",
      showOnHomepage: award.showOnHomepage ?? true,
      thumbnailId: award.thumbnailId || null,
      thumbnailPreview: award.image || "",
      galleryMediaIds: award.galleryMediaIds || [],
      galleryPreviews: award.galleryPreviews || [],
    };
  }
  return {
    name: "",
    context: "",
    organization: "",
    category: "Institutional",
    date: "",
    order: 1,
    status: "Draft",
    description: "",
    fullDescription: "",
    credentialUrl: "",
    showOnHomepage: true,
    thumbnailId: null,
    thumbnailPreview: "",
    galleryMediaIds: [],
    galleryPreviews: [],
  };
}

interface AwardFormProps {
  award?: AwardItem | null;
  isEdit?: boolean;
  isSaving?: boolean;
  onSave: (data: AwardFormData, status: AwardStatus) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onDirtyChange?: (dirty: boolean, currentForm: AwardFormData) => void;
}

const cardCls =
  "dash-panel relative overflow-hidden rounded-xl border border-brand/28 p-5";
const inputCls =
  "w-full rounded-lg border border-brand/28 bg-panel px-3.5 py-2.5 text-[13.5px] text-foreground placeholder:text-muted-foreground/55 outline-none focus:border-brand-bright/70 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_12%,transparent)] transition-all";
const labelCls = "mb-1.5 block text-[13px] font-semibold text-foreground/85";
const cardHeaderIcon =
  "flex items-center gap-3 border-b border-brand/15 pb-3.5 mb-4";

function CategoryBadge({ category }: { category: string }) {
  let styleCls = "border-blue-500/30 bg-blue-500/10 text-blue-400";
  if (category === "Community") {
    styleCls = "border-purple-500/30 bg-purple-500/10 text-purple-300";
  } else if (category === "Technical") {
    styleCls = "border-brand-bright/35 bg-brand/12 text-brand-bright";
  } else if (category === "Competition") {
    styleCls = "border-amber-500/30 bg-amber-500/10 text-amber-300";
  } else if (category === "Certification") {
    styleCls = "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
  }

  return (
    <span
      className={`inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${styleCls}`}
    >
      {category}
    </span>
  );
}

export function AwardForm({
  award,
  isEdit = false,
  isSaving = false,
  onSave,
  onCancel,
  onDelete,
  onDirtyChange,
}: AwardFormProps) {
  const [form, setForm] = useState<AwardFormData>(() => defaultAwardData(award));
  const initialFormRef = useRef(JSON.stringify(defaultAwardData(award)));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<{
    name?: string | undefined;
    context?: string | undefined;
    organization?: string | undefined;
    description?: string | undefined;
    credentialUrl?: string | undefined;
    thumbnail?: string | undefined;
  }>({});

  const nameInputRef = useRef<HTMLInputElement>(null);
  const contextInputRef = useRef<HTMLInputElement>(null);
  const organizationInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  const [certPickerOpen, setCertPickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof AwardFormData, value: unknown) => {
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

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        category: "AWARDS",
        altText: file.name.replace(/\.[^/.]+$/, ""),
      });

      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to upload certificate image.");
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
      toast.success(`Uploaded and set "${asset.name}" as award certificate.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      toast.error(msg);
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleCertSelect = (selected: MediaItem[]) => {
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
      toast.success(`Attached "${selected[0]!.name}" from Media Library.`);
    }
  };

  const handleGallerySelect = (selected: MediaItem[]) => {
    const remaining = 5 - form.galleryMediaIds.length;
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

    const remaining = 5 - form.galleryMediaIds.length;
    if (remaining <= 0) {
      toast.error("Maximum limit of 5 gallery images reached.");
      return;
    }

    const toProcess = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.info(`Only the first ${remaining} image(s) will be uploaded to stay within the 5-image limit.`);
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
          category: "AWARDS",
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

      const tempId = newMediaIds[index]!;
      newMediaIds[index] = newMediaIds[targetIndex]!;
      newMediaIds[targetIndex] = tempId;

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

  const validateAndSubmit = (status: AwardStatus) => {
    if (isUploadingThumbnail) {
      toast.error("Please wait for the image upload to complete before saving.");
      return;
    }
    if (isUploadingGallery) {
      toast.error("Please wait for the gallery images upload to complete before saving.");
      return;
    }

    const newErrors: {
      name?: string;
      context?: string;
      organization?: string;
      description?: string;
      credentialUrl?: string;
      thumbnail?: string;
    } = {};

    if (!form.name.trim()) {
      newErrors.name = "Award title is required";
    } else if (form.name.trim().length > 255) {
      newErrors.name = "Award title cannot exceed 255 characters";
    }

    if (!form.context.trim()) {
      newErrors.context = "Context is required (e.g. Annual Summit, Global Competition)";
    } else if (form.context.trim().length > 255) {
      newErrors.context = "Context cannot exceed 255 characters";
    }

    if (!form.organization.trim()) {
      newErrors.organization = "Organization / Issuing Body is required";
    } else if (form.organization.trim().length > 255) {
      newErrors.organization = "Organization cannot exceed 255 characters";
    }

    if (!form.description.trim()) {
      newErrors.description = "Short description is required";
    } else if (form.description.trim().length > 1000) {
      newErrors.description = "Description cannot exceed 1000 characters";
    }

    if (form.credentialUrl.trim()) {
      const urlLower = form.credentialUrl.trim().toLowerCase();
      if (
        urlLower.startsWith("javascript:") ||
        urlLower.startsWith("data:") ||
        urlLower.startsWith("vbscript:") ||
        urlLower.startsWith("file:")
      ) {
        newErrors.credentialUrl = "Dangerous URL protocol schemes are not allowed";
      }
    }

    // Mandatory thumbnail for both Draft and Publish (Rule 2)
    if (!form.thumbnailId || !form.thumbnailId.trim()) {
      newErrors.thumbnail = "Thumbnail image is required. Please upload or select a cover image from the Media Library.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);

      if (newErrors.name) {
        nameInputRef.current?.focus();
      } else if (newErrors.context) {
        contextInputRef.current?.focus();
      } else if (newErrors.organization) {
        organizationInputRef.current?.focus();
      } else if (newErrors.description) {
        descInputRef.current?.focus();
      } else if (newErrors.credentialUrl) {
        urlInputRef.current?.focus();
      } else if (newErrors.thumbnail) {
        thumbnailContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      const firstErrMsg = Object.values(newErrors)[0];
      toast.error(firstErrMsg || "Please correct the highlighted form errors before saving.");
      return;
    }

    onSave(form, status);
  };

  const shortDescMax = 1000;
  const fullDescMax = 20000;

  return (
    <div className="space-y-4">
      {/* ── ROW 1: Award Details & Award Images ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Award Details Card */}
        <section className={cardCls}>
          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <AlignLeft className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Award Details</h2>
              <p className="text-[12px] text-muted-foreground">
                {isEdit
                  ? "Update main information about the award or achievement."
                  : "Add main information about the award or achievement."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className={labelCls}>
                Award Title <span className="text-red-400">*</span>
              </label>
              <input
                ref={nameInputRef}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Best Emerging Tech Platform 2026"
                className={`${inputCls} ${
                  errors.name ? "border-red-500/70 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" : ""
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-[11.5px] font-medium text-red-400">{errors.name}</p>
              )}
            </div>

            {/* Context & Organization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Context / Event <span className="text-red-400">*</span>
                </label>
                <input
                  ref={contextInputRef}
                  value={form.context}
                  onChange={(e) => set("context", e.target.value)}
                  placeholder="e.g. National EdTech Summit, Global Hackathon"
                  className={`${inputCls} ${
                    errors.context ? "border-red-500/70 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" : ""
                  }`}
                />
                {errors.context && (
                  <p className="mt-1 text-[11.5px] font-medium text-red-400">{errors.context}</p>
                )}
              </div>

              <div>
                <label className={labelCls}>
                  Organization / Issuer <span className="text-red-400">*</span>
                </label>
                <input
                  ref={organizationInputRef}
                  value={form.organization}
                  onChange={(e) => set("organization", e.target.value)}
                  placeholder="e.g. IEEE, Tech Council of India, Google"
                  className={`${inputCls} ${
                    errors.organization ? "border-red-500/70 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" : ""
                  }`}
                />
                {errors.organization && (
                  <p className="mt-1 text-[11.5px] font-medium text-red-400">{errors.organization}</p>
                )}
              </div>
            </div>

            {/* Category & Achievement Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value as any)}
                  className={`${inputCls} appearance-none`}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Achievement Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                  <input
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                    placeholder="e.g. Apr 2026 or 2026-04-15"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
            </div>

            {/* Credential URL */}
            <div>
              <label className={labelCls}>Credential / Verification URL (Optional)</label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                <input
                  ref={urlInputRef}
                  value={form.credentialUrl}
                  onChange={(e) => set("credentialUrl", e.target.value)}
                  placeholder="https://credentials.verify.org/cert/12345"
                  className={`${inputCls} pl-9 ${
                    errors.credentialUrl ? "border-red-500/70 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" : ""
                  }`}
                />
              </div>
              {errors.credentialUrl && (
                <p className="mt-1 text-[11.5px] font-medium text-red-400">{errors.credentialUrl}</p>
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
                placeholder="Brief summary of the recognition (featured on showcase cards)"
                rows={2}
                className={`${inputCls} resize-none ${
                  errors.description ? "border-red-500/70 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" : ""
                }`}
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                {errors.description ? (
                  <span className="font-medium text-red-400">{errors.description}</span>
                ) : (
                  <span />
                )}
                <span>
                  {form.description.length}/{shortDescMax}
                </span>
              </div>
            </div>

            {/* Full Description */}
            <div>
              <label className={labelCls}>Full Description (Optional)</label>
              <div className="rounded-t-lg border border-b-0 border-brand/28 bg-panel-strong px-3 py-2 flex flex-wrap items-center gap-1">
                <span className="text-[11.5px] font-semibold text-muted-foreground mr-2">Markdown / Plain Text</span>
                {[Bold, Italic, List, ListOrdered, Link2, Code].map((Icon, idx) => (
                  <span
                    key={idx}
                    className="grid size-6 place-items-center rounded text-muted-foreground/60 select-none"
                  >
                    <Icon className="size-3.5" />
                  </span>
                ))}
              </div>
              <textarea
                value={form.fullDescription}
                onChange={(e) => set("fullDescription", e.target.value.slice(0, fullDescMax))}
                placeholder="Detailed story, selection criteria, or achievement highlights..."
                rows={4}
                className={`${inputCls} rounded-t-none resize-none`}
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {form.fullDescription.length}/{fullDescMax}
              </p>
            </div>
          </div>
        </section>

        {/* Award Images Card */}
        <section className={cardCls}>
          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <ImageIcon className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Award Media</h2>
              <p className="text-[12px] text-muted-foreground">
                Upload or select certificate image and inspect media configuration.
              </p>
            </div>
          </div>

          {/* Certificate / Primary Image */}
          <div ref={thumbnailContainerRef} className="mb-5">
            <label className={labelCls}>
              Certificate / Primary Thumbnail Image <span className="text-red-400">*</span>
            </label>
            {form.thumbnailPreview ? (
              <div
                className={`relative overflow-hidden rounded-lg border shadow-[0_0_16px_color-mix(in_oklab,var(--brand)_14%,transparent)] ${
                  errors.thumbnail
                    ? "border-red-500/80 shadow-[0_0_16px_rgba(239,68,68,0.25)]"
                    : "border-brand-bright/50"
                }`}
              >
                <img
                  src={form.thumbnailPreview}
                  alt="Certificate"
                  className="aspect-[16/10] w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    set("thumbnailId", null);
                    set("thumbnailPreview", "");
                  }}
                  className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur-md border border-brand/30 hover:border-brand-bright transition"
                  title="Remove certificate"
                >
                  <X className="size-3.5" />
                </button>
                <div className="absolute bottom-2 left-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isUploadingThumbnail}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded border border-brand-bright/70 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-brand-bright backdrop-blur-md hover:bg-brand/15 transition disabled:opacity-50"
                  >
                    {isUploadingThumbnail ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Upload className="size-3" />
                    )}
                    Upload New
                  </button>
                  <button
                    type="button"
                    onClick={() => setCertPickerOpen(true)}
                    className="flex items-center gap-1.5 rounded border border-brand-bright/70 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur-md hover:bg-brand/15 transition"
                  >
                    <FolderOpen className="size-3 text-brand-bright" /> From Library
                  </button>
                </div>
                <span className="absolute bottom-2 right-2 text-[11px] text-muted-foreground/80 bg-background/70 px-2 py-0.5 rounded backdrop-blur-sm">
                  Verified MediaAsset
                </span>
              </div>
            ) : (
              <div
                className={`flex flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed py-8 text-center transition-all ${
                  errors.thumbnail
                    ? "border-red-500/80 bg-red-950/15"
                    : "border-brand/40 bg-panel/60"
                }`}
              >
                <ImageIcon
                  className={`size-8 ${
                    errors.thumbnail ? "text-red-400" : "text-muted-foreground/50"
                  }`}
                />
                <p className="text-[13px] font-medium text-foreground/80">
                  Select or upload certificate / award image
                </p>
                <p className="text-[11.5px] text-muted-foreground/60">
                  PNG, JPG, WebP (Max 50MB) — Required for Draft and Published awards
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isUploadingThumbnail}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-md bg-brand-bright px-3.5 py-1.5 text-[12.5px] font-semibold text-black transition hover:bg-brand-bright/85 disabled:opacity-50"
                  >
                    {isUploadingThumbnail ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    Upload Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setCertPickerOpen(true)}
                    className="flex items-center gap-1.5 rounded-md border border-brand/35 bg-panel px-3.5 py-1.5 text-[12.5px] font-semibold text-foreground/90 transition hover:border-brand-bright hover:text-foreground"
                  >
                    <FolderOpen className="size-3.5 text-brand-bright" /> Select from Library
                  </button>
                </div>
              </div>
            )}
            {errors.thumbnail && (
              <p className="mt-1.5 text-[12px] font-medium text-red-400 flex items-center gap-1">
                <span>⚠</span> {errors.thumbnail}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCertUpload}
            />
          </div>

          {/* Gallery Images (Max 5) */}
          <div className="mt-5 border-t border-brand/15 pt-5">
            <label className={labelCls}>
              Award Gallery Images{" "}
              <span className="text-muted-foreground/60 font-normal">
                ({form.galleryPreviews.length}/5)
              </span>
            </label>
            <div className="flex flex-wrap gap-2.5">
              {/* Add Images Controls */}
              {form.galleryPreviews.length < 5 && (
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
                          Max {5 - form.galleryPreviews.length}
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
                    title="Remove from award gallery"
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

      {/* ── ROW 2: Display Settings & Live Preview ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Display Settings */}
        <section className={cardCls}>
          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <Settings2 className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Display Settings</h2>
              <p className="text-[12px] text-muted-foreground">
                Control showcase visibility, lifecycle status, and ordering.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Display Order</label>
                <input
                  type="number"
                  min={0}
                  value={form.order}
                  onChange={(e) => set("order", Number(e.target.value) || 0)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Status</label>
                <div className="relative">
                  <div
                    className={`absolute left-3 top-1/2 -translate-y-1/2 size-2 rounded-full ${
                      form.status === "Published"
                        ? "bg-brand-bright shadow-[0_0_5px_var(--brand-bright)]"
                        : form.status === "Draft"
                        ? "bg-brand-gold shadow-[0_0_5px_var(--brand-gold)]"
                        : "bg-muted-foreground"
                    }`}
                  />
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as AwardStatus)}
                    className={`${inputCls} pl-7 appearance-none`}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Show on Homepage Toggle */}
            <div className="pt-2">
              <label className={labelCls}>Showcase Visibility</label>
              <div className="flex items-center gap-3">
                <Star
                  className={`size-5 ${
                    form.showOnHomepage ? "text-yellow-400" : "text-muted-foreground/40"
                  }`}
                  fill={form.showOnHomepage ? "currentColor" : "none"}
                />
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.showOnHomepage}
                  onClick={() => set("showOnHomepage", !form.showOnHomepage)}
                  className={`relative h-6 w-11 rounded-full border transition-all duration-200 ${
                    form.showOnHomepage
                      ? "border-brand-bright bg-brand shadow-[0_0_10px_color-mix(in_oklab,var(--brand-bright)_35%,transparent)]"
                      : "border-border/40 bg-muted/40"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                      form.showOnHomepage ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
                <span className="text-[12.5px] text-foreground/80">
                  Featured in Awards showcase section on homepage
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Live Preview Card */}
        <section className={cardCls}>
          <div className={cardHeaderIcon}>
            <span className="accent-green accent-icon-box grid size-9 place-items-center rounded-lg">
              <Eye className="size-4.5 text-brand-bright" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Live Showcase Preview</h2>
              <p className="text-[12px] text-muted-foreground">
                Preview how this achievement appears on the public website.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-brand/35 bg-panel-strong p-4 shadow-[0_0_25px_color-mix(in_oklab,var(--brand)_15%,transparent)]">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-brand/30 bg-black/60">
              {form.thumbnailPreview ? (
                <img
                  src={form.thumbnailPreview}
                  alt="Award Preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                  <Award className="size-12" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <div className="absolute top-2.5 left-2.5">
                <CategoryBadge category={form.category} />
              </div>
            </div>

            <div className="mt-3.5 space-y-1.5">
              <h3 className="text-[16px] font-bold text-foreground truncate">
                {form.name || "Award Title"}
              </h3>
              <p className="text-[12px] font-medium text-brand-bright/90">
                {form.organization || "Issuing Body"}{" "}
                {form.context && `• ${form.context}`}{" "}
                {form.date && `• ${form.date}`}
              </p>
              <p className="text-[12px] leading-relaxed text-foreground/75 line-clamp-2">
                {form.description || "Short description will appear here on the card."}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ── BOTTOM ACTIONS ── */}
      <div className="flex items-center justify-between border-t border-brand/12 pt-4">
        {isEdit ? (
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-950/20 px-5 py-2.5 text-[13.5px] font-semibold text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)] transition hover:bg-red-900/30 hover:border-red-400 hover:text-red-300"
          >
            <Trash2 className="size-4" /> Delete Award
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 rounded-lg border border-brand/28 bg-panel px-5 py-2.5 text-[13.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground"
          >
            ← Cancel
          </button>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => validateAndSubmit("Draft")}
            className="rounded-lg border border-brand/35 bg-panel px-5 py-2.5 text-[13.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save as Draft"}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => validateAndSubmit("Published")}
            className="flex items-center gap-2 rounded-lg bg-brand-bright px-6 py-2.5 text-[13.5px] font-bold text-black shadow-[0_0_18px_color-mix(in_oklab,var(--brand-bright)_45%,transparent),0_0_36px_color-mix(in_oklab,var(--brand)_22%,transparent)] transition hover:bg-brand-bright/90 hover:shadow-[0_0_24px_color-mix(in_oklab,var(--brand-bright)_55%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : isEdit ? "Update Award →" : "Create Award →"}
          </button>
        </div>
      </div>

      {/* Media Library Pickers */}
      <MediaLibraryPicker
        open={certPickerOpen}
        onClose={() => setCertPickerOpen(false)}
        onSelect={handleCertSelect}
        title="Select Award Certificate Image"
        allowedTypes={["Image"]}
        initialCategory="Awards"
        multiple={false}
        initialSelectedIds={form.thumbnailId ? [form.thumbnailId] : []}
      />

      <MediaLibraryPicker
        open={galleryPickerOpen}
        onClose={() => setGalleryPickerOpen(false)}
        onSelect={handleGallerySelect}
        title="Select Award Gallery Images"
        allowedTypes={["Image"]}
        initialCategory="Awards"
        multiple={true}
        maxSelection={Math.max(1, 5 - form.galleryMediaIds.length)}
        initialSelectedIds={form.galleryMediaIds}
      />
    </div>
  );
}
