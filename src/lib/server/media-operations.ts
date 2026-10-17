import { randomBytes } from "node:crypto";
import type { PrismaClient, MediaAsset, MediaType, MediaCategory } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermission, requireAal2Permission } from "@/lib/auth/server-auth";
import { AdminPermissions } from "@/lib/auth/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Lazy-loaded Prisma client singleton
let defaultPrisma: PrismaClient | null = null;
async function getPrisma(): Promise<PrismaClient> {
  if (!defaultPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

export const DEFAULT_MEDIA_BUCKET = "media-library";
export const MAX_MEDIA_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB server limit
export const MAX_MEDIA_FILE_SIZE_MB = 50;

export const ALLOWED_MIME_TYPES = new Set([
  // Images (Raster formats only; SVG disabled for security)
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/avif": ["avif"],
  "video/mp4": ["mp4", "m4v"],
  "video/webm": ["webm"],
  "video/quicktime": ["mov", "qt"],
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "text/plain": ["txt", "text"],
};

export interface UploadMediaPayload {
  name: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  base64Content: string;
  category?: MediaCategory | undefined;
  altText?: string | null | undefined;
  description?: string | null | undefined;
  tags?: string[] | undefined;
  dimensions?: string | null | undefined;
  duration?: string | null | undefined;
}

export interface ListMediaOptions {
  category?: MediaCategory | undefined;
  mediaType?: MediaType | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface UpdateMediaPayload {
  name?: string | undefined;
  category?: MediaCategory | string | undefined;
  altText?: string | null | undefined;
  description?: string | null | undefined;
  tags?: string[] | undefined;
  [key: string]: unknown;
}

/**
 * Derives the schema MediaType enum from MIME type string.
 */
export function deriveMediaType(mimeType: string): MediaType {
  const lower = mimeType.toLowerCase();
  if (lower.startsWith("image/")) return "IMAGE";
  if (lower.startsWith("video/")) return "VIDEO";
  if (lower === "application/pdf" || lower.startsWith("text/") || lower.includes("document") || lower.includes("msword")) {
    return "DOCUMENT";
  }
  return "OTHER";
}

/**
 * Derives the schema MediaCategory enum.
 */
export function deriveMediaCategory(categoryStr?: string): MediaCategory {
  if (!categoryStr) return "PROJECTS";
  const norm = categoryStr.toUpperCase();
  if (norm === "PROJECTS") return "PROJECTS";
  if (norm === "WEBSITES") return "WEBSITES";
  if (norm === "ADVERTISEMENTS") return "ADVERTISEMENTS";
  if (norm === "AWARDS") return "AWARDS";
  return "GENERAL";
}

/**
 * Validates that the original file extension matches the declared MIME type.
 * Explicitly rejects .svg files across all declared MIME types.
 */
export function validateFileExtension(filename: string, mimeType: string): void {
  const normMime = mimeType.toLowerCase();
  const parts = filename.split(".");
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";

  // Strictly reject SVG files
  if (ext === "svg" || filename.toLowerCase().endsWith(".svg")) {
    throw new Error("Validation Error: SVG uploads are disabled for security reasons");
  }

  const allowedExts = MIME_TO_EXTENSIONS[normMime];
  if (!allowedExts) {
    throw new Error(`Validation Error: Unsupported MIME type "${mimeType}"`);
  }
  if (!ext || !allowedExts.includes(ext)) {
    throw new Error(
      `Validation Error: File extension ".${ext}" does not match declared MIME type "${mimeType}". Expected: ${allowedExts.map((e) => `.${e}`).join(", ")}`
    );
  }
}

/**
 * Proactively inspects file buffer content to detect SVG / XML markup masquerading under other types.
 * Hardened with context-aware XML namespace detection and tag-level boundary-resilient inspection
 * to prevent evasion while avoiding false positives on legitimate text and code snippets.
 */
export function isSvgContent(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;

  // 1. Context-aware XML SVG namespace attribute detection across sliding chunks
  // Matches xmlns="http://www.w3.org/2000/svg", xmlns:x='...', xmlns = "...", etc.
  // Avoids false positives on plain text prose mentioning the URL without XML attributes.
  const xmlSvgNsRegex = /xmlns(?::[a-z0-9_-]+)?\s*=\s*['"]https?:\/\/www\.w3\.org\/2000\/svg['"]/i;
  const doctypeSvgRegex = /<!doctype\s+svg[\s>]/i;

  const CHUNK_SIZE = 64 * 1024;
  const OVERLAP = 1024;

  for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE - OVERLAP) {
    const end = Math.min(buffer.length, offset + CHUNK_SIZE);
    const chunk = buffer.subarray(offset, end).toString("utf8");

    if (xmlSvgNsRegex.test(chunk) || doctypeSvgRegex.test(chunk)) {
      return true;
    }

    if (end === buffer.length) break;
  }

  // 2. Locate candidate opening <svg tags in the buffer
  // Scans for <svg or <[prefix]:svg followed by whitespace, '>', or '/'
  // Boundary-resilient: extracts from the candidate opening '<' up to the matching '>'
  // across the buffer rather than relying on fixed chunk boundaries.
  const TAG_SEARCH_WINDOW = 16 * 1024; // Up to 16 KB for opening tag attributes
  const svgAttrsRegex = /(?:viewbox\s*=|xmlns(?::[a-z0-9_-]+)?\s*=|version\s*=|width\s*=|height\s*=|fill\s*=|preserveaspectratio\s*=)/i;
  const svgChildOrClosingRegex = /(?:<\/(?:[a-z0-9_-]+:)?svg>|<(?:[a-z0-9_-]+:)?(?:circle|rect|path|line|polygon|polyline|ellipse|g|defs|text|use|image|script|style)[\s>\/])/i;

  const svgOpenTagCandidateRegex = /<(?:[a-z0-9_-]+:)?svg(?=[\s>\/])/gi;

  for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE - OVERLAP) {
    const end = Math.min(buffer.length, offset + CHUNK_SIZE);
    const chunk = buffer.subarray(offset, end).toString("utf8");

    let match: RegExpExecArray | null;
    svgOpenTagCandidateRegex.lastIndex = 0;
    while ((match = svgOpenTagCandidateRegex.exec(chunk)) !== null) {
      const tagStartInBuf = offset + match.index;
      const tagScanEnd = Math.min(buffer.length, tagStartInBuf + TAG_SEARCH_WINDOW);
      const tagContentSnippet = buffer.subarray(tagStartInBuf, tagScanEnd).toString("utf8");

      const closingBracketIndex = tagContentSnippet.indexOf(">");
      if (closingBracketIndex === -1) {
        // Safeguard: Candidate SVG opening tag exceeds inspection limit (16 KB) or is unclosed.
        // Fail closed and conservatively reject suspicious unclosed <svg payload.
        return true;
      }

      const openingTagOnly = tagContentSnippet.substring(0, closingBracketIndex + 1);

      if (svgAttrsRegex.test(openingTagOnly) || openingTagOnly.endsWith("/>")) {
        return true;
      }

      const remainingDocSlice = buffer.subarray(tagStartInBuf, Math.min(buffer.length, tagStartInBuf + 64 * 1024)).toString("utf8");
      if (
        svgChildOrClosingRegex.test(remainingDocSlice) ||
        /<\?xml[\s>]/i.test(chunk) ||
        /<!doctype[\s>]/i.test(chunk)
      ) {
        return true;
      }
    }

    if (end === buffer.length) break;
  }

  return false;
}

/**
 * Validates file content against declared MIME type using binary signatures (magic bytes).
 * Rejects SVG content regardless of declared MIME type or filename.
 */
export function validateAndSanitizeFileContent(
  buffer: Buffer,
  mimeType: string,
  _originalFilename: string
): Buffer {
  const normMime = mimeType.toLowerCase();

  // Strictly reject declared SVG uploads
  if (normMime === "image/svg+xml") {
    throw new Error("Validation Error: SVG uploads are disabled for security reasons");
  }

  // Verifies whether the buffer matches the authoritative binary signature (magic bytes)
  const isValidBinary = (mime: string, buf: Buffer): boolean => {
    switch (mime) {
      case "image/jpeg":
        return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      case "image/png": {
        const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        return buf.length >= 8 && pngHeader.every((byte, idx) => buf[idx] === byte);
      }
      case "image/gif": {
        if (buf.length < 6) return false;
        const magic = buf.subarray(0, 6).toString("ascii");
        return magic === "GIF87a" || magic === "GIF89a";
      }
      case "image/webp": {
        if (buf.length < 12) return false;
        const riff = buf.subarray(0, 4).toString("ascii");
        const webp = buf.subarray(8, 12).toString("ascii");
        return riff === "RIFF" && webp === "WEBP";
      }
      case "image/avif": {
        if (buf.length < 12) return false;
        const ftyp = buf.subarray(4, 8).toString("ascii");
        const brand = buf.subarray(8, 12).toString("ascii");
        return ftyp === "ftyp" && ["avif", "avis", "mif1"].includes(brand);
      }
      case "video/mp4": {
        if (buf.length < 8) return false;
        const ftyp = buf.subarray(4, 8).toString("ascii");
        return ftyp === "ftyp";
      }
      case "video/webm": {
        const webmHeader = [0x1a, 0x45, 0xdf, 0xa3];
        return buf.length >= 4 && webmHeader.every((byte, idx) => buf[idx] === byte);
      }
      case "video/quicktime": {
        if (buf.length < 8) return false;
        const ftyp = buf.subarray(4, 8).toString("ascii");
        const validBrands = ["ftyp", "moov", "wide", "mdat", "free", "skip"];
        return validBrands.includes(ftyp);
      }
      case "application/pdf":
        return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
      case "application/msword": {
        const oleHeader = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
        return buf.length >= 8 && oleHeader.every((byte, idx) => buf[idx] === byte);
      }
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        const zipHeader = [0x50, 0x4b, 0x03, 0x04];
        return buf.length >= 4 && zipHeader.every((byte, idx) => buf[idx] === byte);
      }
      default:
        return false;
    }
  };

  const isBinaryType = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ].includes(normMime);

  if (isBinaryType) {
    if (!isValidBinary(normMime, buffer)) {
      // If content is an SVG masquerading under a binary MIME type (e.g. svg renamed to .png), strictly reject as SVG
      if (isSvgContent(buffer)) {
        throw new Error("Validation Error: SVG uploads are disabled for security reasons");
      }
      throw new Error(`Validation Error: File content does not match declared MIME type "${mimeType}"`);
    }
    return buffer;
  }

  // Non-binary types (e.g. text/plain): strictly reject SVG content
  if (isSvgContent(buffer)) {
    throw new Error("Validation Error: SVG uploads are disabled for security reasons");
  }

  if (normMime === "text/plain") {
    const checkLen = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0x00) {
        throw new Error(`Validation Error: File content does not match declared MIME type "${mimeType}"`);
      }
    }
    return buffer;
  }

  throw new Error(`Validation Error: Unsupported MIME type "${mimeType}"`);
}

/**
 * Generates a sanitized, collision-resistant storage path.
 * Format: {category}/{timestamp}-{randomHex}.{ext}
 */
export function generateStoragePath(category: MediaCategory, originalFilename: string): string {
  const rawExt = originalFilename.split(".").pop()?.toLowerCase() || "bin";
  const safeExt = rawExt.replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
  const timestamp = Date.now();
  const randomHex = randomBytes(8).toString("hex");
  const folder = category.toLowerCase();
  return `${folder}/${timestamp}-${randomHex}.${safeExt}`;
}

// =========================================================================
// 1. ADMIN PROTECTED MEDIA OPERATIONS
// =========================================================================

/**
 * Uploads a media asset to Supabase Storage and creates a persistent MediaAsset record in PostgreSQL.
 * Requires MEDIA_UPLOAD permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function uploadMediaAssetOperation(
  request: Request,
  payload: UploadMediaPayload,
  prismaClient?: PrismaClient,
  storageClientOverride?: SupabaseClient
): Promise<{ asset: MediaAsset }> {
  // 1. Enforce RBAC & Active Admin session
  const context = await requirePermission(request, AdminPermissions.MEDIA_UPLOAD, prismaClient);
  const prisma = prismaClient || (await getPrisma());
  const storage = storageClientOverride || getSupabaseAdminClient();

  // 2. Validate input metadata
  if (!payload.name || !payload.name.trim()) {
    throw new Error("Validation Error: Media asset name is required");
  }
  if (!payload.originalFilename || !payload.originalFilename.trim()) {
    throw new Error("Validation Error: Original filename is required");
  }
  if (!payload.mimeType || !ALLOWED_MIME_TYPES.has(payload.mimeType.toLowerCase())) {
    throw new Error(`Validation Error: Unsupported MIME type "${payload.mimeType}". Allowed: JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, PDF`);
  }
  if (!payload.base64Content || !payload.base64Content.trim()) {
    throw new Error("Validation Error: File content is required");
  }

  // 3. Decode base64 and validate byte size
  const cleanBase64 = payload.base64Content.replace(/^data:([A-Za-z0-9/+.-]+);base64,/, "");
  const fileBuffer = Buffer.from(cleanBase64, "base64");
  const actualSize = fileBuffer.length;

  if (actualSize === 0) {
    throw new Error("Validation Error: Uploaded file is empty");
  }
  if (actualSize > MAX_MEDIA_FILE_SIZE_BYTES) {
    throw new Error(`Validation Error: File size (${(actualSize / (1024 * 1024)).toFixed(1)} MB) exceeds server limit of 50 MB`);
  }

  // 3b. Validate file extension matches declared MIME type
  validateFileExtension(payload.originalFilename, payload.mimeType);

  // 3c. Validate file content signature (magic bytes) and sanitize SVG if applicable
  const validatedBuffer = validateAndSanitizeFileContent(fileBuffer, payload.mimeType, payload.originalFilename);
  const finalSize = validatedBuffer.length;

  const category = payload.category ? deriveMediaCategory(payload.category) : "PROJECTS";
  const mediaType = deriveMediaType(payload.mimeType);
  const storagePath = generateStoragePath(category, payload.originalFilename);
  const bucket = DEFAULT_MEDIA_BUCKET;
  const fileExt = originalExt(payload.originalFilename);

  // 4. Upload object to Supabase Storage
  const { error: storageError } = await storage.storage
    .from(bucket)
    .upload(storagePath, validatedBuffer, {
      contentType: payload.mimeType,
      upsert: false,
    });

  if (storageError) {
    throw new Error(`Storage Upload Error: ${storageError.message}`);
  }

  // 5. Retrieve public URL
  const { data: publicUrlData } = storage.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = publicUrlData?.publicUrl;

  if (!publicUrl) {
    // Compensating cleanup
    await storage.storage.from(bucket).remove([storagePath]).catch(() => {});
    throw new Error("Storage Upload Error: Failed to generate public URL for uploaded asset");
  }

  // 6. Create PostgreSQL MediaAsset record with atomic compensating cleanup
  try {
    const asset = await prisma.$transaction(async (tx) => {
      const createdAsset = await tx.mediaAsset.create({
        data: {
          name: payload.name.trim(),
          originalFilename: payload.originalFilename.trim(),
          bucket,
          storagePath,
          publicUrl,
          mediaType,
          category,
          mimeType: payload.mimeType.toLowerCase(),
          fileSize: BigInt(finalSize),
          fileExtension: fileExt,
          dimensions: payload.dimensions?.trim() || null,
          duration: payload.duration?.trim() || null,
          altText: payload.altText?.trim() || payload.name.trim(),
          description: payload.description?.trim() || null,
          tags: payload.tags || [],
          uploadedById: context.profile.id,
        },
      });

      // Record Audit Log
      await tx.adminAuditLog.create({
        data: {
          actorId: context.profile.id,
          actorEmail: context.profile.email,
          action: "MEDIA_UPLOADED",
          module: "MEDIA_CMS",
          entityId: createdAsset.id,
          metadata: {
            name: createdAsset.name,
            bucket: createdAsset.bucket,
            storagePath: createdAsset.storagePath,
            size: finalSize,
            mimeType: createdAsset.mimeType,
          },
        },
      });

      return createdAsset;
    });

    return { asset };
  } catch (dbError) {
    // Compensating cleanup: remove uploaded file from Storage if DB write fails
    try {
      await storage.storage.from(bucket).remove([storagePath]);
    } catch (cleanupErr) {
      console.error("Compensating cleanup failed for storagePath:", storagePath, cleanupErr);
    }
    const msg = dbError instanceof Error ? dbError.message : "Database failure during media registration";
    throw new Error(`Media Registration Error: ${msg}`);
  }
}

/**
 * Lists all persisted MediaAssets with optional category and search filters.
 * Requires MEDIA_READ permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function listAdminMediaAssetsOperation(
  request: Request,
  options?: ListMediaOptions,
  prismaClient?: PrismaClient
): Promise<{ assets: MediaAsset[]; totalCount: number }> {
  await requirePermission(request, AdminPermissions.MEDIA_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const where: any = {};
  if (options?.category) {
    where.category = deriveMediaCategory(options.category);
  }
  if (options?.mediaType) {
    where.mediaType = options.mediaType;
  }
  if (options?.search && options.search.trim()) {
    const q = options.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { originalFilename: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { altText: { contains: q, mode: "insensitive" } },
      { tags: { has: q } },
    ];
  }

  const [assets, totalCount] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return { assets, totalCount };
}

/**
 * Retrieves a single MediaAsset by its UUID.
 * Requires MEDIA_READ permission.
 */
export async function getAdminMediaAssetByIdOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
): Promise<{ asset: MediaAsset | null }> {
  await requirePermission(request, AdminPermissions.MEDIA_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
  });

  return { asset };
}

const IMMUTABLE_MEDIA_FIELDS = [
  "id",
  "bucket",
  "storagePath",
  "publicUrl",
  "originalFilename",
  "mimeType",
  "fileSize",
  "fileExtension",
  "mediaType",
  "dimensions",
  "duration",
  "uploadedById",
  "createdAt",
  "updatedAt",
];

const VALID_MEDIA_CATEGORIES: Set<string> = new Set([
  "ADVERTISEMENTS",
  "WEBSITES",
  "AWARDS",
  "PROJECTS",
  "GENERAL",
]);

/**
 * Updates an existing MediaAsset's metadata in PostgreSQL with transactional audit logging.
 * Requires MEDIA_UPDATE permission (SUPER_ADMIN, ADMIN, EDITOR).
 * Rejects modifications to immutable storage and integrity fields.
 */
export async function updateAdminMediaAssetOperation(
  request: Request,
  id: string,
  payload: UpdateMediaPayload,
  prismaClient?: PrismaClient
): Promise<{ asset: MediaAsset }> {
  // 1. Enforce RBAC & Active Admin session
  const context = await requirePermission(request, AdminPermissions.MEDIA_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  // 2. Validate asset ID
  if (!id || typeof id !== "string" || !id.trim()) {
    throw new Error("Validation Error: Media asset ID is required");
  }
  const cleanId = id.trim();

  // 3. Reject any payload containing immutable system/storage fields
  if (payload && typeof payload === "object") {
    for (const key of IMMUTABLE_MEDIA_FIELDS) {
      if (key in payload) {
        throw new Error(`Validation Error: Attempt to modify immutable field "${key}"`);
      }
    }
  } else {
    throw new Error("Validation Error: Payload must be an object");
  }

  // 4. Confirm media asset exists
  const existing = await prisma.mediaAsset.findUnique({
    where: { id: cleanId },
  });

  if (!existing) {
    throw new Error("Not Found: Media asset does not exist");
  }

  // 5. Validate editable fields
  const updateData: {
    name?: string;
    category?: MediaCategory;
    altText?: string | null;
    description?: string | null;
    tags?: string[];
  } = {};

  // 5a. Name validation (required if provided, non-empty, max 255 chars)
  if (payload.name !== undefined) {
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      throw new Error("Validation Error: Media asset name is required");
    }
    const trimmedName = payload.name.trim();
    if (trimmedName.length > 255) {
      throw new Error("Validation Error: Media asset name exceeds maximum length of 255 characters");
    }
    updateData.name = trimmedName;
  }

  // 5b. Category validation (must be valid MediaCategory enum)
  if (payload.category !== undefined) {
    if (typeof payload.category !== "string" || !payload.category.trim()) {
      throw new Error("Validation Error: Invalid media category");
    }
    const normCategory = payload.category.trim().toUpperCase();
    if (!VALID_MEDIA_CATEGORIES.has(normCategory)) {
      throw new Error(
        `Validation Error: Invalid media category "${payload.category}". Allowed: ADVERTISEMENTS, WEBSITES, AWARDS, PROJECTS, GENERAL`
      );
    }
    updateData.category = normCategory as MediaCategory;
  }

  // 5c. Alt text validation (nullable, max 500 chars)
  if (payload.altText !== undefined) {
    if (payload.altText === null || payload.altText === "") {
      updateData.altText = null;
    } else if (typeof payload.altText === "string") {
      const trimmedAlt = payload.altText.trim();
      if (trimmedAlt.length > 500) {
        throw new Error("Validation Error: Alt text exceeds maximum length of 500 characters");
      }
      updateData.altText = trimmedAlt.length > 0 ? trimmedAlt : null;
    } else {
      throw new Error("Validation Error: Alt text must be a string or null");
    }
  }

  // 5d. Description validation (nullable, max 2000 chars)
  if (payload.description !== undefined) {
    if (payload.description === null || payload.description === "") {
      updateData.description = null;
    } else if (typeof payload.description === "string") {
      const trimmedDesc = payload.description.trim();
      if (trimmedDesc.length > 2000) {
        throw new Error("Validation Error: Description exceeds maximum length of 2000 characters");
      }
      updateData.description = trimmedDesc.length > 0 ? trimmedDesc : null;
    } else {
      throw new Error("Validation Error: Description must be a string or null");
    }
  }

  // 5e. Tags validation (array of max 20 strings, each max 50 chars, deduplicated)
  if (payload.tags !== undefined) {
    if (!Array.isArray(payload.tags)) {
      throw new Error("Validation Error: Tags must be an array of strings");
    }
    if (payload.tags.length > 20) {
      throw new Error("Validation Error: Maximum of 20 tags allowed");
    }
    const processedTags: string[] = [];
    const seen = new Set<string>();
    for (const tag of payload.tags) {
      if (typeof tag !== "string") {
        throw new Error("Validation Error: Each tag must be a string");
      }
      const trimmedTag = tag.trim();
      if (!trimmedTag) continue;
      if (trimmedTag.length > 50) {
        throw new Error("Validation Error: Tag exceeds maximum length of 50 characters");
      }
      const lower = trimmedTag.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        processedTags.push(trimmedTag);
      }
    }
    if (processedTags.length > 20) {
      throw new Error("Validation Error: Maximum of 20 tags allowed");
    }
    updateData.tags = processedTags;
  }

  // 6. Execute atomic update and audit log in Prisma transaction
  const updatedAsset = await prisma.$transaction(async (tx) => {
    const asset = await tx.mediaAsset.update({
      where: { id: cleanId },
      data: updateData,
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "MEDIA_UPDATED",
        module: "MEDIA_CMS",
        entityId: asset.id,
        metadata: {
          previous: {
            name: existing.name,
            category: existing.category,
            altText: existing.altText,
            description: existing.description,
            tags: existing.tags,
          },
          updated: {
            name: updateData.name ?? existing.name,
            category: updateData.category ?? existing.category,
            altText: updateData.altText !== undefined ? updateData.altText : existing.altText,
            description: updateData.description !== undefined ? updateData.description : existing.description,
            tags: updateData.tags ?? existing.tags,
          },
        },
      },
    });

    return asset;
  });

  return { asset: updatedAsset };
}

export interface DeleteMediaResult {
  success: boolean;
  deletedId: string;
  databaseDeleted: boolean;
  storageDeleted: boolean;
  storageWarning?: string | null;
}

/**
 * Safely deletes a MediaAsset from PostgreSQL and Supabase Storage after verifying no active references.
 * Requires MEDIA_DELETE permission (SUPER_ADMIN, ADMIN only; rejected for EDITOR).
 */
export async function deleteAdminMediaAssetOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient,
  storageClientOverride?: SupabaseClient
): Promise<DeleteMediaResult> {
  const context = await requireAal2Permission(request, AdminPermissions.MEDIA_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());
  const storage = storageClientOverride || getSupabaseAdminClient();

  const asset: any = await prisma.mediaAsset.findUnique({
    where: { id },
    include: {
      projectThumbnails: { select: { id: true, name: true } },
      projectGalleryItems: { select: { projectId: true } },
      websiteThumbnails: { select: { id: true, name: true } },
      websiteGalleryItems: { select: { websiteId: true } },
      advertisementThumbnails: { select: { id: true, name: true } },
      advertisementGalleryItems: { select: { advertisementId: true } },
      awardThumbnails: { select: { id: true, name: true } },
      awardGalleryItems: { select: { awardId: true } },
      appearanceLogos: { select: { id: true } },
      appearanceFavicons: { select: { id: true } },
      homepageSections: { select: { id: true, name: true } },
      contactHeroBackgrounds: { select: { id: true } },
    },
  });

  if (!asset) {
    throw new Error("Not Found: Media asset does not exist");
  }

  // Cross-module reference safeguards
  const usageReasons: string[] = [];
  if (asset.projectThumbnails && asset.projectThumbnails.length > 0) {
    usageReasons.push(`thumbnail for Project(s): ${asset.projectThumbnails.map((p: any) => `"${p.name}"`).join(", ")}`);
  }
  if (asset.projectGalleryItems && asset.projectGalleryItems.length > 0) {
    usageReasons.push(`gallery item in ${asset.projectGalleryItems.length} Project(s)`);
  }
  if (asset.websiteThumbnails && asset.websiteThumbnails.length > 0) {
    usageReasons.push(`thumbnail for Website(s): ${asset.websiteThumbnails.map((w: any) => `"${w.name}"`).join(", ")}`);
  }
  if (asset.websiteGalleryItems && asset.websiteGalleryItems.length > 0) {
    usageReasons.push(`gallery item in ${asset.websiteGalleryItems.length} Website(s)`);
  }
  if (asset.advertisementThumbnails && asset.advertisementThumbnails.length > 0) {
    usageReasons.push(`thumbnail for Advertisement(s): ${asset.advertisementThumbnails.map((a: any) => `"${a.name}"`).join(", ")}`);
  }
  if (asset.advertisementGalleryItems && asset.advertisementGalleryItems.length > 0) {
    usageReasons.push(`gallery item in ${asset.advertisementGalleryItems.length} Advertisement(s)`);
  }
  if (asset.awardThumbnails && asset.awardThumbnails.length > 0) {
    usageReasons.push(`thumbnail for Award(s): ${asset.awardThumbnails.map((a: any) => `"${a.name}"`).join(", ")}`);
  }
  if (asset.awardGalleryItems && asset.awardGalleryItems.length > 0) {
    usageReasons.push(`gallery item in ${asset.awardGalleryItems.length} Award(s)`);
  }
  if (asset.appearanceLogos && asset.appearanceLogos.length > 0) {
    usageReasons.push(`active Logo in Appearance Settings`);
  }
  if (asset.appearanceFavicons && asset.appearanceFavicons.length > 0) {
    usageReasons.push(`active Favicon in Appearance Settings`);
  }
  if (asset.homepageSections && asset.homepageSections.length > 0) {
    usageReasons.push(`media in Homepage section(s): ${asset.homepageSections.map((s: any) => `"${s.name}"`).join(", ")}`);
  }
  if (asset.contactHeroBackgrounds && asset.contactHeroBackgrounds.length > 0) {
    usageReasons.push(`hero background in Contact Page configuration`);
  }

  if (usageReasons.length > 0) {
    throw new Error(`Referential Integrity Error: Cannot delete media asset "${asset.name}" because it is currently in use as ${usageReasons.join("; ")}`);
  }

  // Execute database deletion and audit log in transaction
  await prisma.$transaction(async (tx) => {
    await tx.mediaAsset.delete({
      where: { id },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "MEDIA_DELETED",
        module: "MEDIA_CMS",
        entityId: id,
        metadata: {
          name: asset.name,
          bucket: asset.bucket,
          storagePath: asset.storagePath,
        },
      },
    });
  });

  // Remove physical object from Storage
  let storageDeleted = false;
  let storageWarning: string | null = null;

  try {
    const { data: removeData, error: removeError } = await storage.storage
      .from(asset.bucket)
      .remove([asset.storagePath]);

    if (removeError) {
      storageDeleted = false;
      storageWarning = `Physical storage cleanup failed: ${removeError.message || "Storage service error"}. File object at "${asset.storagePath}" in bucket "${asset.bucket}" may remain orphaned.`;
      console.warn(
        `Warning: Storage object cleanup failed for asset ${id} (bucket: ${asset.bucket}, path: ${asset.storagePath}):`,
        removeError
      );
    } else {
      storageDeleted = true;
    }
  } catch (storageErr: unknown) {
    storageDeleted = false;
    const errMsg = storageErr instanceof Error ? storageErr.message : String(storageErr);
    storageWarning = `Physical storage cleanup exception: ${errMsg}. File object at "${asset.storagePath}" in bucket "${asset.bucket}" may remain orphaned.`;
    console.warn(
      `Warning: Exception during storage cleanup for asset ${id} (bucket: ${asset.bucket}, path: ${asset.storagePath}):`,
      storageErr
    );
  }

  return {
    success: true,
    deletedId: id,
    databaseDeleted: true,
    storageDeleted,
    storageWarning,
  };
}

function originalExt(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "bin" : "bin";
}
