import { z } from "zod";
import { randomBytes } from "node:crypto";
import type { PrismaClient, AdminProfile, AdminRole, AdminAuditLog, SiteSettings, AppearanceConfig, ContactMessage, ContactMessageStatus, AdminLoginHistory } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseUserAgent } from "@/lib/server/user-agent";
import { AdminPermissions, canPerform } from "@/lib/auth/rbac";
import { extractTrustedClientIp, maskIpAddress } from "@/lib/server/client-ip";
import {
  requireAdminProfile,
  requirePermission,
  requireRole,
  requireAal2,
  requireAal2Permission,
  requireAal2Role,
  type AuthenticatedAdminContext,
} from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MfaRecoveryStatus, AdminMfaRecovery } from "@/lib/auth/mfa-recovery-types";
import { DEFAULT_MEDIA_BUCKET, validateAndSanitizeFileContent } from "@/lib/server/media-operations";
import {
  type PublicSiteSettings,
  DEFAULT_PUBLIC_SITE_SETTINGS,
} from "@/lib/public-metadata";
import {
  type PublicAppearanceConfig,
  DEFAULT_PUBLIC_APPEARANCE_CONFIG,
} from "@/lib/public-appearance";
import {
  type AdminPreferences,
  type UpdatePreferencesPayload,
  updatePreferencesPayloadSchema,
  mergeWithDefaultPreferences,
  MAX_PREFERENCES_PAYLOAD_BYTES,
} from "@/lib/preferences";
import { createNotificationEvent } from "./notification-operations";

let defaultPrisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient> {
  if (!defaultPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

export interface OperationSuccess<T> {
  success: true;
  data: T;
  actor?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface OperationFailure {
  success: false;
  error: string;
  statusCode: number;
}

export type OperationResult<T> = OperationSuccess<T> | OperationFailure;

/**
 * Strips sensitive fields from internal error messages.
 */
function sanitizeErrorMessage(error: unknown): { message: string; statusCode: number } {
  const rawMessage = error instanceof Error ? error.message : String(error);

  if (rawMessage.startsWith("Unauthorized") || rawMessage.includes("No valid Supabase session") || rawMessage.includes("No cookie header provided")) {
    return { message: "Unauthorized: Valid administrative session required", statusCode: 401 };
  }

  if (rawMessage.startsWith("Forbidden")) {
    // Keep high-level authorization reason without exposing system internals
    const sanitized = rawMessage.replace(/([a-zA-Z0-9_-]+\.){2,}[a-zA-Z0-9_-]+/g, "[REDACTED_TOKEN]");
    return { message: sanitized, statusCode: 403 };
  }

  return { message: "Internal server error", statusCode: 500 };
}

/**
 * Standard HTTP Response adapter for server endpoints.
 */
export async function executeProtectedOperation<T>(
  operation: () => Promise<T>
): Promise<Response> {
  try {
    const data = await operation();
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const { message, statusCode } = sanitizeErrorMessage(err);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// =========================================================================
// 1. IDENTITY & SELF-PROFILE OPERATIONS
// =========================================================================

/**
 * Resolves current verified administrator profile for the authenticated session.
 */
export async function getCurrentAdminProfileOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<AuthenticatedAdminContext> {
  return await requireAdminProfile(request, prismaClient, { allowQuarantined: true });
}

export interface UpdateSelfProfilePayload {
  fullName?: string;
  phone?: string | null;
  designation?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  preferences?: UpdatePreferencesPayload;
  // Forbidden fields for runtime detection
  id?: unknown;
  email?: unknown;
  role?: unknown;
  isActive?: unknown;
}

/**
 * Safely extracts and validates a Supabase Storage path for an administrator's avatar.
 * Strict requirements:
 * 1. Must be isolated strictly to `avatars/{adminId}/<filename>`.
 * 2. Rejects directory traversal (e.g., '..'), double slashes, or malicious characters.
 * 3. Never deletes objects belonging to another administrator or outside avatars directory.
 * 4. Verifies storage host / bucket namespace to avoid deleting external URLs.
 */
export function extractAvatarStoragePath(
  avatarUrl: string | null | undefined,
  adminId: string,
  bucket: string = DEFAULT_MEDIA_BUCKET
): string | null {
  if (!avatarUrl || typeof avatarUrl !== "string" || !adminId || typeof adminId !== "string") {
    return null;
  }

  const trimmed = avatarUrl.trim();
  if (!trimmed) return null;

  // Reject path traversal attempts immediately
  if (trimmed.includes("..") || trimmed.includes("%2e") || trimmed.includes("%2E")) {
    return null;
  }

  let pathname: string;
  let isKnownStorage = false;

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const parsed = new URL(trimmed);
      pathname = decodeURIComponent(parsed.pathname);

      const host = parsed.hostname.toLowerCase();
      const isKnownStorageHost =
        host.includes("supabase") ||
        host === "localhost" ||
        host === "127.0.0.1";
      const hasStoragePathPrefix = pathname.includes("/storage/v1/object/");

      if (isKnownStorageHost || hasStoragePathPrefix) {
        isKnownStorage = true;
      }
    } else {
      pathname = decodeURIComponent(trimmed);
      isKnownStorage = true;
    }
  } catch {
    return null;
  }

  if (!isKnownStorage) {
    return null;
  }

  // Normalize backslashes to forward slashes and collapse duplicate slashes
  pathname = pathname.replace(/\\/g, "/").replace(/\/+/g, "/");

  // Re-check for path traversal after URL decoding and normalization
  if (pathname.includes("..")) {
    return null;
  }

  // Look for the bucket marker or direct avatars folder
  // Typical Supabase URL: /storage/v1/object/public/<bucket>/avatars/<adminId>/<filename>
  // Or test/mock format: /avatars/<adminId>/<filename>
  const expectedFolder = `avatars/${adminId}/`;

  const folderIndex = pathname.indexOf(expectedFolder);
  if (folderIndex === -1) {
    return null;
  }

  // If a bucket prefix is present before avatars/, verify it matches the expected bucket
  const beforeFolder = pathname.substring(0, folderIndex);
  if (beforeFolder.includes("/object/public/")) {
    const bucketPart = beforeFolder.split("/object/public/")[1]?.replace(/\/$/, "");
    if (bucketPart && bucketPart !== bucket) {
      return null;
    }
  }

  const relativePath = pathname.substring(folderIndex);

  // Verify format: avatars/{adminId}/{filename}
  // filename should not have further subdirectories or dangerous characters
  const parts = relativePath.split("/");
  if (parts.length !== 3) {
    return null;
  }
  const [folder, targetAdminId, filename] = parts;
  if (folder !== "avatars" || targetAdminId !== adminId || !filename) {
    return null;
  }

  // Validate filename is safe (alphanumeric, dashes, underscores, dots)
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(filename)) {
    return null;
  }

  return `avatars/${adminId}/${filename}`;
}

/**
 * Safely cleans up a superseded or removed avatar object from Supabase Storage.
 *
 * Safety guarantees:
 * 1. Checks that the path is strictly within avatars/{adminId}/.
 * 2. Rejects path traversal and arbitrary external URLs.
 * 3. Verifies that the storage object is not still referenced by the active administrator profile.
 * 4. Never throws — catches storage errors and logs them so caller flow is not disrupted.
 */
export async function safelyCleanupPreviousAvatar(options: {
  previousAvatarUrl: string | null | undefined;
  adminId: string;
  prisma: PrismaClient;
  storage: SupabaseClient;
  bucket?: string;
}): Promise<{ cleaned: boolean; storagePath: string | null; warning?: string }> {
  const { previousAvatarUrl, adminId, prisma, storage, bucket = DEFAULT_MEDIA_BUCKET } = options;

  if (!previousAvatarUrl || !adminId) {
    return { cleaned: false, storagePath: null };
  }

  const oldStoragePath = extractAvatarStoragePath(previousAvatarUrl, adminId, bucket);
  if (!oldStoragePath) {
    // Not a valid storage path in this admin's avatar folder (e.g. external URL or invalid path)
    return { cleaned: false, storagePath: null };
  }

  // Safety check: ensure active profile does not still reference this storage path
  try {
    const active = await prisma.adminProfile.findUnique({
      where: { id: adminId },
      select: { avatarUrl: true },
    });
    if (active?.avatarUrl) {
      const activeStoragePath = extractAvatarStoragePath(active.avatarUrl, adminId, bucket);
      if (activeStoragePath === oldStoragePath) {
        // Still referenced by active profile! Do not delete!
        return {
          cleaned: false,
          storagePath: oldStoragePath,
          warning: "Aborted cleanup: storage path is still referenced by active profile",
        };
      }
    }
  } catch (err) {
    // If reading active profile fails, err on side of caution: do not delete
    console.warn(`[Avatar Cleanup] Could not verify active profile reference before cleanup:`, err);
    return {
      cleaned: false,
      storagePath: oldStoragePath,
      warning: "Aborted cleanup: unable to verify active profile reference",
    };
  }

  // Perform physical removal from Supabase Storage
  try {
    const storageApi = (storage as any).storage ?? storage;
    const { error: removeError } = await storageApi
      .from(bucket)
      .remove([oldStoragePath]);

    if (removeError) {
      const warnMsg = `Storage cleanup failed for "${oldStoragePath}": ${removeError.message || "Unknown error"}`;
      console.warn(`[Avatar Cleanup] ${warnMsg}`);
      return { cleaned: false, storagePath: oldStoragePath, warning: warnMsg };
    }

    return { cleaned: true, storagePath: oldStoragePath };
  } catch (storageErr) {
    const errMsg = storageErr instanceof Error ? storageErr.message : String(storageErr);
    const warnMsg = `Storage cleanup exception for "${oldStoragePath}": ${errMsg}`;
    console.warn(`[Avatar Cleanup] ${warnMsg}`);
    return { cleaned: false, storagePath: oldStoragePath, warning: warnMsg };
  }
}

/**
 * Updates self-service profile fields for the authenticated administrator.
 * Strictly prohibits modifying id, email, role, or isActive.
 */
export async function updateSelfProfileOperation(
  request: Request,
  payload: UpdateSelfProfilePayload,
  prismaClient?: PrismaClient,
  storageClientOverride?: SupabaseClient
): Promise<{ profile: AdminProfile }> {
  const clientIp = extractTrustedClientIp(request.headers);
  const context = await requireAal2(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  // Strict validation: Reject tampering with immutable/privileged fields
  if (payload.id !== undefined && payload.id !== context.profile.id) {
    throw new Error("Forbidden: Cannot modify account ID");
  }
  if (payload.email !== undefined && payload.email !== context.profile.email) {
    throw new Error("Forbidden: Email modification requires verified email change flow");
  }
  if (payload.role !== undefined && payload.role !== context.profile.role) {
    throw new Error("Forbidden: Cannot self-assign or elevate administrative role");
  }
  if (payload.isActive !== undefined && payload.isActive !== context.profile.isActive) {
    throw new Error("Forbidden: Cannot self-modify active account status");
  }

  const updateData: {
    fullName?: string;
    phone?: string | null;
    designation?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    preferences?: any;
  } = {};

  if (typeof payload.fullName === "string" && payload.fullName.trim().length > 0) {
    updateData.fullName = payload.fullName.trim();
  }
  if (payload.phone !== undefined) {
    updateData.phone = payload.phone;
  }
  if (payload.designation !== undefined) {
    updateData.designation = payload.designation;
  }
  if (payload.avatarUrl !== undefined) {
    updateData.avatarUrl = payload.avatarUrl;
  }
  if (payload.bio !== undefined) {
    updateData.bio = payload.bio;
  }

  if (payload.preferences !== undefined) {
    if (typeof payload.preferences !== "object" || payload.preferences === null || Array.isArray(payload.preferences)) {
      throw new Error("Validation Error: Preferences payload must be an object");
    }
    const rawPrefStr = JSON.stringify(payload.preferences);
    if (Buffer.byteLength(rawPrefStr, "utf8") > MAX_PREFERENCES_PAYLOAD_BYTES) {
      throw new Error("Validation Error: Preferences payload exceeds maximum allowed size of 4 KB");
    }
    const parseResult = updatePreferencesPayloadSchema.safeParse(payload.preferences);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Validation Error: Invalid preferences data (${issues})`);
    }
  }

  let previousAvatarUrl: string | null = null;
  const isAvatarChanging = payload.avatarUrl !== undefined;

  // Atomically update profile and record audit log inside a transaction
  const result = await prisma.$transaction(async (tx) => {
    if (isAvatarChanging) {
      const current = await tx.adminProfile.findUnique({
        where: { id: context.profile.id },
        select: { avatarUrl: true },
      });
      previousAvatarUrl = current?.avatarUrl ?? context.profile.avatarUrl;
    }

    if (payload.preferences !== undefined) {
      const current = await tx.adminProfile.findUnique({
        where: { id: context.profile.id },
        select: { preferences: true },
      });
      const currentPrefs = mergeWithDefaultPreferences(current?.preferences);
      const mergedNotifs = payload.preferences.notifications
        ? { ...currentPrefs.notifications, ...payload.preferences.notifications }
        : currentPrefs.notifications;
      const mergedPortal = payload.preferences.portal
        ? { ...currentPrefs.portal, ...payload.preferences.portal }
        : currentPrefs.portal;

      updateData.preferences = {
        notifications: mergedNotifs,
        portal: mergedPortal,
      } as any;
    }

    const updated = await tx.adminProfile.update({
      where: { id: context.profile.id },
      data: updateData,
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "SELF_PROFILE_UPDATED",
        module: "PROFILE_MANAGEMENT",
        entityId: context.profile.id,
        metadata: {
          updatedFields: Object.keys(updateData),
          ...(payload.avatarUrl === null ? { avatarRemoved: true, previousAvatarUrl } : {}),
          ...(payload.preferences !== undefined ? { preferencesUpdated: true } : {}),
        },
        ipAddress: maskIpAddress(clientIp),
      },
    });

    return updated;
  });

  // Post-commit cleanup: only after database update has safely committed!
  if (
    isAvatarChanging &&
    previousAvatarUrl &&
    previousAvatarUrl !== payload.avatarUrl
  ) {
    let storage: SupabaseClient | null = storageClientOverride || null;
    if (!storage) {
      try {
        storage = getSupabaseAdminClient();
      } catch (clientErr) {
        console.warn("[Avatar Cleanup] Supabase admin client unavailable for storage cleanup:", clientErr);
      }
    }
    if (storage) {
      await safelyCleanupPreviousAvatar({
        previousAvatarUrl,
        adminId: context.profile.id,
        prisma,
        storage,
        bucket: DEFAULT_MEDIA_BUCKET,
      });
    }
  }

  return { profile: result };
}

/**
 * Updates notification and/or portal preferences for the authenticated administrator.
 * Validates payload size (<= 4 KB) and schema, prevents lost updates by deep-merging
 * with existing preferences in PostgreSQL, and records an audit log.
 */
export async function updateSelfPreferencesOperation(
  request: Request,
  payload: UpdatePreferencesPayload,
  prismaClient?: PrismaClient
): Promise<{ preferences: AdminPreferences; profile: AdminProfile }> {
  const clientIp = extractTrustedClientIp(request.headers);
  const context = await requireAal2(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Validation Error: Preferences payload must be an object");
  }

  const rawPrefStr = JSON.stringify(payload);
  if (Buffer.byteLength(rawPrefStr, "utf8") > MAX_PREFERENCES_PAYLOAD_BYTES) {
    throw new Error("Validation Error: Preferences payload exceeds maximum allowed size of 4 KB");
  }

  const parseResult = updatePreferencesPayloadSchema.safeParse(payload);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Validation Error: Invalid preferences data (${issues})`);
  }

  const validated = parseResult.data;

  // Atomically deep-merge and persist preferences with audit logging
  const { updatedProfile, mergedPreferences } = await prisma.$transaction(async (tx) => {
    const current = await tx.adminProfile.findUnique({
      where: { id: context.profile.id },
      select: { preferences: true },
    });
    const currentPrefs = mergeWithDefaultPreferences(current?.preferences);

    const mergedNotifs = validated.notifications
      ? { ...currentPrefs.notifications, ...validated.notifications }
      : currentPrefs.notifications;

    const mergedPortal = validated.portal
      ? { ...currentPrefs.portal, ...validated.portal }
      : currentPrefs.portal;

    const finalPreferences: AdminPreferences = {
      notifications: mergedNotifs,
      portal: mergedPortal,
    };

    const p = await tx.adminProfile.update({
      where: { id: context.profile.id },
      data: {
        preferences: finalPreferences as any,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "PREFERENCES_UPDATED",
        module: "PROFILE_MANAGEMENT",
        entityId: context.profile.id,
        metadata: {
          updatedSections: Object.keys(validated),
        },
        ipAddress: maskIpAddress(clientIp),
      },
    });

    return { updatedProfile: p, mergedPreferences: finalPreferences };
  });

  return { preferences: mergedPreferences, profile: updatedProfile };
}

export interface UploadAvatarPayload {
  originalFilename: string;
  mimeType: string;
  base64Content: string;
}

export const ALLOWED_AVATAR_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Uploads a validated administrator avatar image to Supabase Storage and updates AdminProfile.avatarUrl.
 * Enforces server-side raster format checking (rejects SVG), strict 2MB limit, collision-resistant tenant-scoped paths,
 * post-commit cleanup of previous avatars, and rolls back orphaned storage uploads if database persistence fails.
 */
export async function uploadAvatarOperation(
  request: Request,
  payload: UploadAvatarPayload,
  prismaClient?: PrismaClient,
  storageClientOverride?: SupabaseClient
): Promise<{ avatarUrl: string; profile: AdminProfile }> {
  const clientIp = extractTrustedClientIp(request.headers);
  const context = await requireAal2(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.originalFilename || !payload.originalFilename.trim()) {
    throw new Error("Validation Error: Original filename is required");
  }

  const normMime = payload.mimeType?.toLowerCase()?.trim();
  if (!normMime || !ALLOWED_AVATAR_MIMES.has(normMime)) {
    throw new Error(
      `Validation Error: Unsupported avatar format "${payload.mimeType}". Allowed: JPEG, PNG, WebP, GIF, AVIF`
    );
  }

  if (!payload.base64Content || !payload.base64Content.trim()) {
    throw new Error("Validation Error: Avatar image content is required");
  }

  const cleanBase64 = payload.base64Content.replace(/^data:[A-Za-z0-9/+.-]+;base64,/, "");
  const fileBuffer = Buffer.from(cleanBase64, "base64");

  if (fileBuffer.length > MAX_AVATAR_SIZE_BYTES) {
    throw new Error(
      `Validation Error: Avatar file size (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed 2.0 MB`
    );
  }

  // Validate buffer magic bytes & strictly reject SVG content
  validateAndSanitizeFileContent(fileBuffer, normMime, payload.originalFilename);

  // Safe extension
  const rawExt = payload.originalFilename.split(".").pop()?.toLowerCase() || "png";
  const safeExt = rawExt.replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";

  // Collision-resistant, tenant-scoped storage path under admin ID
  const storagePath = `avatars/${context.profile.id}/${Date.now()}-${randomBytes(6).toString("hex")}.${safeExt}`;
  const bucket = DEFAULT_MEDIA_BUCKET;

  const storage = storageClientOverride || getSupabaseAdminClient();
  const storageApi = (storage as any).storage ?? storage;

  // Upload to Supabase Storage
  const { error: uploadError } = await storageApi
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: normMime,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage Error: Failed to upload avatar (${uploadError.message})`);
  }

  const { data: urlData } = storageApi.from(bucket).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  let previousAvatarUrl: string | null = null;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.adminProfile.findUnique({
        where: { id: context.profile.id },
        select: { avatarUrl: true },
      });
      previousAvatarUrl = current?.avatarUrl ?? context.profile.avatarUrl;

      const p = await tx.adminProfile.update({
        where: { id: context.profile.id },
        data: { avatarUrl: publicUrl },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: context.profile.id,
          actorEmail: context.profile.email,
          action: "AVATAR_UPDATED",
          module: "PROFILE_MANAGEMENT",
          entityId: context.profile.id,
          metadata: {
            storagePath,
            fileSize: fileBuffer.length,
            mimeType: normMime,
            previousAvatarUrl,
          },
          ipAddress: maskIpAddress(clientIp),
        },
      });

      return p;
    });

    // Post-commit cleanup: only after database update has safely committed!
    if (previousAvatarUrl && previousAvatarUrl !== publicUrl) {
      await safelyCleanupPreviousAvatar({
        previousAvatarUrl,
        adminId: context.profile.id,
        prisma,
        storage,
        bucket,
      });
    }

    return { avatarUrl: publicUrl, profile: updated };
  } catch (dbErr) {
    // Avoid orphaned file in storage if DB persistence fails (compensating rollback for new upload)
    try {
      await storageApi.from(bucket).remove([storagePath]);
    } catch {
      // Ignore cleanup error to preserve main db error
    }
    throw dbErr;
  }
}

// =========================================================================
// 2. ADMINISTRATOR GOVERNANCE OPERATIONS (Super Admin / Admin)
// =========================================================================

/**
 * Lists all registered administrative profiles with role & status.
 * Requires ADMIN_READ permission (SUPER_ADMIN, ADMIN).
 */
export async function listAdminProfilesOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<{ profiles: Array<Omit<AdminProfile, "avatarUrl" | "bio" | "phone">> }> {
  await requirePermission(request, AdminPermissions.ADMIN_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const rawProfiles = await prisma.adminProfile.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      designation: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      mfaRecoveryPending: true,
      mfaRecoveryAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { profiles: rawProfiles };
}

/**
 * Updates an administrator's active status (deactivation / reactivation).
 * Requires ADMIN_MANAGE permission (SUPER_ADMIN only).
 * Prohibits deactivating the final active Super Admin with transactional concurrency safety.
 * Triggers provider global session revocation on deactivation.
 */
export async function updateAdminStatusOperation(
  request: Request,
  payload: { targetAdminId: string; isActive: boolean },
  prismaClient?: PrismaClient,
  supabaseAdminOverride?: SupabaseClient
): Promise<{ success: boolean; targetAdminId: string; isActive: boolean; sessionRevocation?: "completed" | "limited" }> {
  const clientIp = extractTrustedClientIp(request.headers);
  const context = await requireAal2(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  // Enforce ADMIN_MANAGE RBAC permission with failed attempt auditing
  if (!canPerform(context.profile.role, AdminPermissions.ADMIN_MANAGE)) {
    if (prisma && typeof prisma.adminAuditLog?.create === "function") {
      try {
        await prisma.adminAuditLog.create({
          data: {
            actorId: context.profile.id,
            actorEmail: context.profile.email,
            action: "ADMIN_STATUS_UPDATE_FAILED",
            module: "ADMIN_GOVERNANCE",
            entityId: payload?.targetAdminId || "unknown",
            metadata: {
              reason: "unauthorized_role",
              requiredPermission: AdminPermissions.ADMIN_MANAGE,
              actorRole: context.profile.role,
            },
            ipAddress: maskIpAddress(clientIp),
          },
        });
      } catch {}
    }
    throw new Error(
      `Forbidden: Role "${context.profile.role}" lacks required permission: "${AdminPermissions.ADMIN_MANAGE}"`
    );
  }

  if (!payload.targetAdminId || typeof payload.isActive !== "boolean") {
    throw new Error("Forbidden: Invalid admin status update parameters");
  }

  // Transaction for status update and sole active Super Admin invariant check
  const txResult = await prisma.$transaction(async (tx) => {
    const target = await tx.adminProfile.findUnique({
      where: { id: payload.targetAdminId },
    });

    if (!target) {
      await tx.adminAuditLog.create({
        data: {
          actorId: context.profile.id,
          actorEmail: context.profile.email,
          action: "ADMIN_STATUS_UPDATE_FAILED",
          module: "ADMIN_GOVERNANCE",
          entityId: payload.targetAdminId,
          metadata: {
            reason: "target_not_found",
          },
          ipAddress: maskIpAddress(clientIp),
        },
      });
      throw new Error("Forbidden: Target administrator profile not found");
    }

    // If deactivating a Super Admin, verify that at least one OTHER active Super Admin exists
    if (target.role === "SUPER_ADMIN" && !payload.isActive) {
      const activeSuperAdmins = await tx.adminProfile.findMany({
        where: { role: "SUPER_ADMIN", isActive: true },
      });

      if (activeSuperAdmins.length <= 1) {
        await tx.adminAuditLog.create({
          data: {
            actorId: context.profile.id,
            actorEmail: context.profile.email,
            action: "ADMIN_STATUS_UPDATE_FAILED",
            module: "ADMIN_GOVERNANCE",
            entityId: payload.targetAdminId,
            metadata: {
              targetEmail: target.email,
              targetRole: target.role,
              attemptedAction: "DEACTIVATE",
              reason: "sole_active_super_admin",
            },
            ipAddress: maskIpAddress(clientIp),
          },
        });
        throw new Error("Forbidden: Cannot deactivate the sole active Super Admin");
      }
    }

    const updated = await tx.adminProfile.update({
      where: { id: payload.targetAdminId },
      data: { isActive: payload.isActive },
    });

    return { updated, targetEmail: target.email, targetRole: target.role };
  });

  // Global session revocation on deactivation (performed outside the DB transaction)
  let sessionRevocation: "completed" | "limited" | undefined = undefined;
  if (!payload.isActive) {
    sessionRevocation = "limited";
    try {
      const supabaseAdmin = supabaseAdminOverride || getSupabaseAdminClient();
      if (typeof (supabaseAdmin.auth.admin as any)?.signOut === "function") {
        const { error: revokeError } = await (supabaseAdmin.auth.admin as any).signOut(
          payload.targetAdminId,
          "global"
        );
        if (!revokeError) {
          sessionRevocation = "completed";
        }
      }
    } catch {
      sessionRevocation = "limited";
    }
  }

  // Authoritative audit logging with masked IP and sessionRevocation status
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: payload.isActive ? "ADMIN_ACTIVATED" : "ADMIN_DEACTIVATED",
        module: "ADMIN_GOVERNANCE",
        entityId: payload.targetAdminId,
        metadata: {
          targetEmail: txResult.targetEmail,
          targetRole: txResult.targetRole,
          changedTo: payload.isActive,
          ...(sessionRevocation ? { sessionRevocation } : {}),
        },
        ipAddress: maskIpAddress(clientIp),
      },
    });
  } catch (auditErr) {
    console.warn("[AdminOperations] Failed to record status change audit log:", auditErr);
  }

  await createNotificationEvent(
    {
      category: "SECURITY_ALERT",
      title: "Admin Account Status Changed",
      message: `${txResult.updated.email} status was changed to ${txResult.updated.isActive ? "active" : "inactive"} by ${context.profile.fullName || context.profile.email}.`,
      link: "/admin/profile",
      targetRoles: ["SUPER_ADMIN", "ADMIN"],
    },
    prismaClient
  );

  return {
    success: true,
    targetAdminId: txResult.updated.id,
    isActive: txResult.updated.isActive,
    ...(sessionRevocation ? { sessionRevocation } : {}),
  };
}

const ROLE_RANK: Record<AdminRole, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  EDITOR: 1,
};

function isRoleDemotion(previousRole: AdminRole, newRole: AdminRole): boolean {
  return (ROLE_RANK[newRole] ?? 0) < (ROLE_RANK[previousRole] ?? 0);
}

/**
 * Assigns or changes an administrator's role.
 * Requires ROLE_ASSIGN permission (SUPER_ADMIN only).
 * Prohibits demoting the final active Super Admin with transactional concurrency safety.
 * Triggers provider global session revocation when demoting privileges.
 */
export async function assignAdminRoleOperation(
  request: Request,
  payload: { targetAdminId: string; newRole: AdminRole },
  prismaClient?: PrismaClient,
  supabaseAdminOverride?: SupabaseClient
): Promise<{ success: boolean; targetAdminId: string; newRole: AdminRole; sessionRevocation?: "completed" | "limited" }> {
  const clientIp = extractTrustedClientIp(request.headers);
  const context = await requireAal2(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  // Enforce ROLE_ASSIGN RBAC permission with failed attempt auditing
  if (!canPerform(context.profile.role, AdminPermissions.ROLE_ASSIGN)) {
    if (prisma && typeof prisma.adminAuditLog?.create === "function") {
      try {
        await prisma.adminAuditLog.create({
          data: {
            actorId: context.profile.id,
            actorEmail: context.profile.email,
            action: "ADMIN_ROLE_ASSIGNMENT_FAILED",
            module: "ADMIN_GOVERNANCE",
            entityId: payload?.targetAdminId || "unknown",
            metadata: {
              reason: "unauthorized_role",
              requiredPermission: AdminPermissions.ROLE_ASSIGN,
              actorRole: context.profile.role,
            },
            ipAddress: maskIpAddress(clientIp),
          },
        });
      } catch {}
    }
    throw new Error(
      `Forbidden: Role "${context.profile.role}" lacks required permission: "${AdminPermissions.ROLE_ASSIGN}"`
    );
  }

  const validRoles: AdminRole[] = ["SUPER_ADMIN", "ADMIN", "EDITOR"];
  if (!payload.targetAdminId || !validRoles.includes(payload.newRole)) {
    throw new Error("Forbidden: Invalid role assignment parameters");
  }

  const txResult = await prisma.$transaction(async (tx) => {
    const target = await tx.adminProfile.findUnique({
      where: { id: payload.targetAdminId },
    });

    if (!target) {
      await tx.adminAuditLog.create({
        data: {
          actorId: context.profile.id,
          actorEmail: context.profile.email,
          action: "ADMIN_ROLE_ASSIGNMENT_FAILED",
          module: "ADMIN_GOVERNANCE",
          entityId: payload.targetAdminId,
          metadata: {
            reason: "target_not_found",
          },
          ipAddress: maskIpAddress(clientIp),
        },
      });
      throw new Error("Forbidden: Target administrator profile not found");
    }

    // If demoting an existing Super Admin, verify that another active Super Admin exists
    if (target.role === "SUPER_ADMIN" && payload.newRole !== "SUPER_ADMIN") {
      const activeSuperAdmins = await tx.adminProfile.findMany({
        where: { role: "SUPER_ADMIN", isActive: true },
      });

      if (activeSuperAdmins.length <= 1) {
        await tx.adminAuditLog.create({
          data: {
            actorId: context.profile.id,
            actorEmail: context.profile.email,
            action: "ADMIN_ROLE_ASSIGNMENT_FAILED",
            module: "ADMIN_GOVERNANCE",
            entityId: payload.targetAdminId,
            metadata: {
              targetEmail: target.email,
              currentRole: target.role,
              attemptedRole: payload.newRole,
              reason: "sole_active_super_admin",
            },
            ipAddress: maskIpAddress(clientIp),
          },
        });
        throw new Error("Forbidden: Cannot demote the sole active Super Admin");
      }
    }

    const updated = await tx.adminProfile.update({
      where: { id: payload.targetAdminId },
      data: { role: payload.newRole },
    });

    return {
      updated,
      targetEmail: target.email,
      previousRole: target.role,
      isDemotion: isRoleDemotion(target.role, payload.newRole),
    };
  });

  // Attempt global session revocation if the role change reduces privileges (demotion)
  let sessionRevocation: "completed" | "limited" | undefined = undefined;
  if (txResult.isDemotion) {
    sessionRevocation = "limited";
    try {
      const supabaseAdmin = supabaseAdminOverride || getSupabaseAdminClient();
      if (typeof (supabaseAdmin.auth.admin as any)?.signOut === "function") {
        const { error: revokeError } = await (supabaseAdmin.auth.admin as any).signOut(
          payload.targetAdminId,
          "global"
        );
        if (!revokeError) {
          sessionRevocation = "completed";
        }
      }
    } catch {
      sessionRevocation = "limited";
    }
  }

  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "ADMIN_ROLE_ASSIGNED",
        module: "ADMIN_GOVERNANCE",
        entityId: payload.targetAdminId,
        metadata: {
          targetEmail: txResult.targetEmail,
          previousRole: txResult.previousRole,
          newRole: payload.newRole,
          isDemotion: txResult.isDemotion,
          ...(sessionRevocation ? { sessionRevocation } : {}),
        },
        ipAddress: maskIpAddress(clientIp),
      },
    });
  } catch (auditErr) {
    console.warn("[AdminOperations] Failed to record role assignment audit log:", auditErr);
  }

  void createNotificationEvent(
    {
      category: "SECURITY_ALERT",
      title: "Administrative Role Updated",
      message: `Your administrative role has been updated to ${txResult.updated.role} by ${context.profile.fullName || context.profile.email}.`,
      link: "/admin/profile",
      targetAdminId: txResult.updated.id,
    },
    prismaClient
  );

  return {
    success: true,
    targetAdminId: txResult.updated.id,
    newRole: txResult.updated.role,
    ...(sessionRevocation ? { sessionRevocation } : {}),
  };
}

// =========================================================================
// 3. GLOBAL SITE SETTINGS OPERATIONS
// =========================================================================

/**
 * Reads global site settings configuration.
 * Requires SETTINGS_READ permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function getGlobalSettingsOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<SiteSettings | null> {
  await requirePermission(request, AdminPermissions.SETTINGS_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  return await prisma.siteSettings.findUnique({
    where: { id: "default" },
  });
}

export interface SettingsEnvironmentStatus {
  resendConfigured: boolean;
  turnstileConfigured: boolean;
  cdnConfigured: boolean;
  analyticsConfigured: boolean;
}

export function evaluateSettingsEnvironmentStatus(): SettingsEnvironmentStatus {
  return {
    resendConfigured: Boolean(process.env["RESEND_API_KEY"]),
    turnstileConfigured: Boolean(process.env["TURNSTILE_SECRET_KEY"]),
    cdnConfigured: Boolean(
      process.env["CLOUDFLARE_API_TOKEN"] || process.env["CDN_ZONE_ID"]
    ),
    analyticsConfigured: Boolean(
      process.env["GA_MEASUREMENT_ID"] || process.env["VITE_GA_MEASUREMENT_ID"]
    ),
  };
}

/**
 * Direct evaluation handler for environment status.
 * Requires SETTINGS_READ (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function getSettingsEnvironmentStatus(
  req: Request,
  prismaClient?: PrismaClient
): Promise<{ status: SettingsEnvironmentStatus }> {
  // Ensure the caller is an authenticated administrator
  await getGlobalSettingsOperation(req, prismaClient);

  return {
    status: evaluateSettingsEnvironmentStatus(),
  };
}

// =========================================================================
// 3. GLOBAL SITE SETTINGS & APPEARANCE VALIDATION SCHEMAS
// =========================================================================

import {
  HEX_COLOR_REGEX,
  updateSiteSettingsSchema,
  type UpdateSiteSettingsInput,
  updateAppearanceConfigSchema,
  type UpdateAppearanceConfigInput,
} from "@/lib/validation/settings-schemas";

export {
  HEX_COLOR_REGEX,
  updateSiteSettingsSchema,
  type UpdateSiteSettingsInput,
  updateAppearanceConfigSchema,
  type UpdateAppearanceConfigInput,
};



/**
 * Updates global site settings configuration.
 * Requires SETTINGS_UPDATE permission (SUPER_ADMIN only).
 * Performs strict runtime validation, allowlisting, and protects singleton ID.
 */
export async function updateGlobalSettingsOperation(
  request: Request,
  payload: { settings: UpdateSiteSettingsInput },
  prismaClient?: PrismaClient
): Promise<SiteSettings> {
  const context = await requireAal2Permission(request, AdminPermissions.SETTINGS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload || typeof payload !== "object" || !payload.settings || typeof payload.settings !== "object") {
    throw new Error("Validation Error: Invalid settings update payload structure");
  }
  if ("id" in (payload.settings as Record<string, unknown>)) {
    throw new Error("Validation Error: Cannot modify singleton settings ID");
  }
  if ("updatedAt" in (payload.settings as Record<string, unknown>)) {
    throw new Error("Validation Error: Cannot modify system timestamps");
  }

  const parseResult = updateSiteSettingsSchema.safeParse(payload.settings);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => `${i.path.join(".") || "settings"}: ${i.message}`).join("; ");
    throw new Error(`Validation Error: Invalid settings update payload (${issues})`);
  }
  const validated = parseResult.data;

  // Strict allowlist: only supported schema fields can ever be set
  const cleanSettings: Partial<Omit<SiteSettings, "id" | "updatedAt">> = {};
  if (validated.siteName !== undefined) cleanSettings.siteName = validated.siteName;
  if (validated.tagline !== undefined) cleanSettings.tagline = validated.tagline;
  if (validated.siteDescription !== undefined) cleanSettings.siteDescription = validated.siteDescription;
  if (validated.siteUrl !== undefined) cleanSettings.siteUrl = validated.siteUrl;
  if (validated.contactEmail !== undefined) cleanSettings.contactEmail = validated.contactEmail;
  if (validated.contactPhone !== undefined) cleanSettings.contactPhone = validated.contactPhone;
  if (validated.contactAddress !== undefined) cleanSettings.contactAddress = validated.contactAddress;
  if (validated.businessHours !== undefined) cleanSettings.businessHours = validated.businessHours;
  if (validated.timezone !== undefined) cleanSettings.timezone = validated.timezone;
  if (validated.dateFormat !== undefined) cleanSettings.dateFormat = validated.dateFormat;
  if (validated.timeFormat !== undefined) cleanSettings.timeFormat = validated.timeFormat;
  if (validated.defaultLanguage !== undefined) cleanSettings.defaultLanguage = validated.defaultLanguage;
  if (validated.metaKeywords !== undefined) cleanSettings.metaKeywords = validated.metaKeywords;
  if (validated.ogImageUrl !== undefined) cleanSettings.ogImageUrl = validated.ogImageUrl;
  if (validated.notifyOnNewMessage !== undefined) cleanSettings.notifyOnNewMessage = validated.notifyOnNewMessage;
  if (validated.notificationEmail !== undefined) cleanSettings.notificationEmail = validated.notificationEmail;

  const clientIp = extractTrustedClientIp(request.headers);

  // Protect the Site Settings singleton ID: "default" can never be overridden
  const updatedSettings = await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: {
      ...cleanSettings,
      id: "default",
    },
    update: cleanSettings,
  });

  // Record audit log using verified actor identity
  await prisma.adminAuditLog.create({
    data: {
      actorId: context.profile.id,
      actorEmail: context.profile.email,
      action: "SETTINGS_UPDATED",
      module: "GLOBAL_SETTINGS",
      entityId: "default",
      metadata: {
        updatedFields: Object.keys(cleanSettings),
      },
      ipAddress: maskIpAddress(clientIp),
    },
  });

  await createNotificationEvent(
    {
      category: "ADMIN_ACTIVITY",
      title: "Site Settings Updated",
      message: `${context.profile.fullName || context.profile.email} updated global site settings.`,
      link: "/admin/settings",
    },
    prismaClient
  );

  return updatedSettings;
}

export const updateSiteSettingsOperation = updateGlobalSettingsOperation;


// =========================================================================
// 3B. APPEARANCE CONFIGURATION OPERATIONS
// =========================================================================

/**
 * Reads global appearance configuration.
 * Requires APPEARANCE_READ permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function getAppearanceConfigOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<AppearanceConfig | null> {
  await requirePermission(request, AdminPermissions.APPEARANCE_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  return await prisma.appearanceConfig.findUnique({
    where: { id: "default" },
  });
}

/**
 * Updates global appearance configuration.
 * Requires APPEARANCE_UPDATE permission (SUPER_ADMIN and ADMIN).
 * Performs strict runtime validation, allowlisting, and protects singleton ID.
 */
export async function updateAppearanceConfigOperation(
  request: Request,
  payload: { appearance: UpdateAppearanceConfigInput },
  prismaClient?: PrismaClient
): Promise<AppearanceConfig> {
  const context = await requireAal2Permission(request, AdminPermissions.APPEARANCE_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload || typeof payload !== "object" || !payload.appearance || typeof payload.appearance !== "object") {
    throw new Error("Validation Error: Invalid appearance update payload structure");
  }
  if ("id" in (payload.appearance as Record<string, unknown>)) {
    throw new Error("Validation Error: Cannot modify singleton appearance ID");
  }
  if ("updatedAt" in (payload.appearance as Record<string, unknown>)) {
    throw new Error("Validation Error: Cannot modify system timestamps");
  }

  const parseResult = updateAppearanceConfigSchema.safeParse(payload.appearance);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => `${i.path.join(".") || "appearance"}: ${i.message}`).join("; ");
    throw new Error(`Validation Error: Invalid appearance update payload (${issues})`);
  }
  const validated = parseResult.data;

  // Strict allowlist: only supported schema fields can ever be set
  const cleanAppearance: Partial<Omit<AppearanceConfig, "id" | "updatedAt">> = {};
  if (validated.themePreset !== undefined) cleanAppearance.themePreset = validated.themePreset;
  if (validated.brandPrimaryColor !== undefined) cleanAppearance.brandPrimaryColor = validated.brandPrimaryColor;
  if (validated.brandSecondaryColor !== undefined) cleanAppearance.brandSecondaryColor = validated.brandSecondaryColor;
  if (validated.brandAccentColor !== undefined) cleanAppearance.brandAccentColor = validated.brandAccentColor;
  if (validated.fontHeading !== undefined) cleanAppearance.fontHeading = validated.fontHeading;
  if (validated.fontBody !== undefined) cleanAppearance.fontBody = validated.fontBody;
  if (validated.logoAssetId !== undefined) cleanAppearance.logoAssetId = validated.logoAssetId;
  if (validated.faviconAssetId !== undefined) cleanAppearance.faviconAssetId = validated.faviconAssetId;
  if (validated.enableGlowEffects !== undefined) cleanAppearance.enableGlowEffects = validated.enableGlowEffects;
  if (validated.enableAnimations !== undefined) cleanAppearance.enableAnimations = validated.enableAnimations;

  const clientIp = extractTrustedClientIp(request.headers);

  // Protect the Appearance singleton ID: "default" can never be overridden
  const updatedAppearance = await prisma.appearanceConfig.upsert({
    where: { id: "default" },
    create: {
      ...cleanAppearance,
      id: "default",
    },
    update: cleanAppearance,
  });

  // Record audit log using verified actor identity
  await prisma.adminAuditLog.create({
    data: {
      actorId: context.profile.id,
      actorEmail: context.profile.email,
      action: "APPEARANCE_UPDATED",
      module: "APPEARANCE",
      entityId: "default",
      metadata: {
        updatedFields: Object.keys(cleanAppearance),
      },
      ipAddress: maskIpAddress(clientIp),
    },
  });

  await createNotificationEvent(
    {
      category: "ADMIN_ACTIVITY",
      title: "Appearance Updated",
      message: `${context.profile.fullName || context.profile.email} updated global appearance configuration.`,
      link: "/admin/appearance",
    },
    prismaClient
  );

  return updatedAppearance;
}

// =========================================================================
// 4. SECURITY AUDIT LOGS OPERATIONS
// =========================================================================

/**
 * Retrieves administrative audit logs.
 * Requires AUDIT_LOG_READ permission (SUPER_ADMIN, ADMIN).
 */
export async function getAuditLogsOperation(
  request: Request,
  pagination?: { limit?: number; offset?: number },
  prismaClient?: PrismaClient
) {
  await requireAal2Permission(request, AdminPermissions.AUDIT_LOG_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const limit = Math.min(pagination?.limit || 50, 100);
  const offset = pagination?.offset || 0;

  const logs = await prisma.adminAuditLog.findMany({
    take: limit,
    skip: offset,
    orderBy: { createdAt: "desc" },
  });

  return { logs, count: logs.length };
}

/**
 * Retrieves audit logs scoped strictly to the authenticated administrator.
 * Derives actorId exclusively from verified server-side admin context.
 * Accessible to any active administrator (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function getSelfAuditLogsOperation(
  request: Request,
  pagination?: { limit?: number; offset?: number },
  prismaClient?: PrismaClient
): Promise<{ logs: AdminAuditLog[]; count: number }> {
  const context = await requireAdminProfile(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const limit = Math.min(Math.max(pagination?.limit || 30, 1), 100);
  const offset = Math.max(pagination?.offset || 0, 0);

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      OR: [
        { actorId: context.profile.id },
        { entityId: context.profile.id },
      ],
    },
    take: limit,
    skip: offset,
    orderBy: { createdAt: "desc" },
  });

  return { logs, count: logs.length };
}

// =========================================================================
// 5. CONTACT INQUIRY MANAGEMENT OPERATIONS
// =========================================================================

/**
 * Lists contact messages & inquiries.
 * Requires CONTACT_READ permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function listContactInquiriesOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<{ messages: ContactMessage[] }> {
  await requirePermission(request, AdminPermissions.CONTACT_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { messages };
}

/**
 * Updates contact message status.
 * Requires CONTACT_UPDATE permission (SUPER_ADMIN, ADMIN).
 */
export async function updateContactInquiryStatusOperation(
  request: Request,
  payload: { messageId: string; status: ContactMessageStatus },
  prismaClient?: PrismaClient
): Promise<ContactMessage> {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const updated = await prisma.contactMessage.update({
    where: { id: payload.messageId },
    data: { status: payload.status },
  });

  await prisma.adminAuditLog.create({
    data: {
      actorId: context.profile.id,
      actorEmail: context.profile.email,
      action: "CONTACT_STATUS_UPDATED",
      module: "CONTACT_INQUIRIES",
      entityId: payload.messageId,
      metadata: { newStatus: payload.status },
    },
  });

  return updated;
}

/**
 * Deletes a contact message inquiry.
 * Requires CONTACT_DELETE permission (SUPER_ADMIN, ADMIN).
 */
export async function deleteContactInquiryOperation(
  request: Request,
  payload: { messageId: string },
  prismaClient?: PrismaClient
): Promise<{ success: boolean; deletedId: string }> {
  const context = await requireAal2Permission(request, AdminPermissions.CONTACT_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  await prisma.contactMessage.delete({
    where: { id: payload.messageId },
  });

  await prisma.adminAuditLog.create({
    data: {
      actorId: context.profile.id,
      actorEmail: context.profile.email,
      action: "CONTACT_DELETED",
      module: "CONTACT_INQUIRIES",
      entityId: payload.messageId,
    },
  });

  return { success: true, deletedId: payload.messageId };
}

// =========================================================================
// 6. PUBLIC WEBSITE OPERATIONS (Separated & Unauthenticated)
// =========================================================================

/**
 * Public website read endpoint — does NOT require administrator authentication.
 */
export async function getPublicWebsiteContentOperation(
  prismaClient?: PrismaClient
): Promise<{ siteName: string; isPublic: true }> {
  // Public data read without auth check
  return {
    siteName: "CobraLearn Innotechcore",
    isPublic: true,
  };
}

/**
 * Public site settings read endpoint — does NOT require administrator authentication.
 * Returns only explicitly allowlisted metadata fields (siteName, siteDescription, ogImageUrl, metaKeywords, siteUrl).
 * Never exposes secrets, administrative fields, or internal configuration.
 */
export async function getPublicSiteSettingsOperation(
  prismaClient?: PrismaClient
): Promise<PublicSiteSettings> {
  const prisma = prismaClient || (await getPrisma());
  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: "default" },
      select: {
        siteName: true,
        siteDescription: true,
        ogImageUrl: true,
        metaKeywords: true,
        siteUrl: true,
      },
    });

    if (!settings) {
      return DEFAULT_PUBLIC_SITE_SETTINGS;
    }

    return {
      siteName: settings.siteName || DEFAULT_PUBLIC_SITE_SETTINGS.siteName,
      siteDescription: settings.siteDescription || DEFAULT_PUBLIC_SITE_SETTINGS.siteDescription,
      ogImageUrl: settings.ogImageUrl ?? null,
      metaKeywords: Array.isArray(settings.metaKeywords) ? settings.metaKeywords : DEFAULT_PUBLIC_SITE_SETTINGS.metaKeywords,
      siteUrl: settings.siteUrl || DEFAULT_PUBLIC_SITE_SETTINGS.siteUrl,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[getPublicSiteSettingsOperation] Error fetching site settings, falling back to defaults:", error);
    }
    return DEFAULT_PUBLIC_SITE_SETTINGS;
  }
}

/**
 * Public appearance configuration read endpoint — does NOT require administrator authentication.
 * Returns only explicitly allowlisted appearance fields.
 * Gracefully resolves logo and favicon asset URLs and falls back to safe defaults on error.
 */
export async function getPublicAppearanceConfigOperation(
  prismaClient?: PrismaClient
): Promise<PublicAppearanceConfig> {
  const prisma = prismaClient || (await getPrisma());
  try {
    const config = await prisma.appearanceConfig.findUnique({
      where: { id: "default" },
      include: {
        logoAsset: {
          select: { publicUrl: true },
        },
        faviconAsset: {
          select: { publicUrl: true },
        },
      },
    });

    if (!config) {
      return DEFAULT_PUBLIC_APPEARANCE_CONFIG;
    }

    return {
      themePreset: config.themePreset || DEFAULT_PUBLIC_APPEARANCE_CONFIG.themePreset,
      brandPrimaryColor: config.brandPrimaryColor || DEFAULT_PUBLIC_APPEARANCE_CONFIG.brandPrimaryColor,
      brandSecondaryColor: config.brandSecondaryColor || DEFAULT_PUBLIC_APPEARANCE_CONFIG.brandSecondaryColor,
      brandAccentColor: config.brandAccentColor || DEFAULT_PUBLIC_APPEARANCE_CONFIG.brandAccentColor,
      fontHeading: config.fontHeading || DEFAULT_PUBLIC_APPEARANCE_CONFIG.fontHeading,
      fontBody: config.fontBody || DEFAULT_PUBLIC_APPEARANCE_CONFIG.fontBody,
      enableAnimations: config.enableAnimations ?? true,
      enableGlowEffects: config.enableGlowEffects ?? true,
      logoUrl: config.logoAsset?.publicUrl || null,
      faviconUrl: config.faviconAsset?.publicUrl || null,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[getPublicAppearanceConfigOperation] Error fetching appearance config, falling back to defaults:", error);
    }
    return DEFAULT_PUBLIC_APPEARANCE_CONFIG;
  }
}

/**
 * Public contact form submission endpoint — does NOT require admin authentication.
 */
export async function submitPublicContactMessageOperation(
  payload: { fullName: string; email: string; subject: string; message: string },
  prismaClient?: PrismaClient
): Promise<{ success: boolean; id: string }> {
  if (!payload.fullName || !payload.email || !payload.message) {
    throw new Error("Invalid submission: missing required contact fields");
  }

  const prisma = prismaClient || (await getPrisma());
  const created = await prisma.contactMessage.create({
    data: {
      fullName: payload.fullName,
      email: payload.email,
      subject: payload.subject || "General Inquiry",
      message: payload.message,
      status: "NEW",
    },
  });

  return { success: true, id: created.id };
}

// =========================================================================
// 8. ADMIN LOGIN HISTORY OPERATIONS
// =========================================================================

export interface RecordLoginResult {
  success: boolean;
  duplicate?: boolean;
  id?: string;
}

export interface GetSelfLoginHistoryResult {
  items: AdminLoginHistory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Records an authenticated administrator's successful login event.
 * Enforces:
 * - Server-controlled identity resolution via requireAdminProfile
 * - Deterministic idempotency via database unique constraint on sessionId
 * - Bounded User-Agent metadata (max 500 chars, parsed into browser/os/deviceType)
 * - Zero IP address storage by default
 * - Timestamp server-controlled (loginAt defaults to database CURRENT_TIMESTAMP)
 *
 * ARCHITECTURAL LIMITATION & SECURITY NOTICE:
 * In a client-driven auth architecture where credentials are submitted directly to Supabase Auth,
 * the application server is called immediately upon client-side login completion.
 * The database unique constraint on sessionId guarantees that each authenticated session can only
 * ever be recorded at most once (preventing duplicate entries or replay attacks using the same session).
 * However, the application server does not directly participate in password verification;
 * true server-side proof of interactive login would require server-side authentication mediation
 * or Supabase Auth webhooks.
 */
export async function recordAdminLoginOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<RecordLoginResult> {
  const context = await requireAdminProfile(request, prismaClient, { allowQuarantined: true });
  const prisma = prismaClient || (await getPrisma());

  // 1. Extract and sanitize User-Agent (from request headers or ambient server context)
  let rawUa = request.headers.get("user-agent") || "";
  if (!rawUa) {
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const ambientReq = getRequest();
      if (ambientReq) {
        rawUa = ambientReq.headers.get("user-agent") || "";
      }
    } catch {
      // Standalone or non-HTTP context
    }
  }
  const boundedUa = rawUa.trim().slice(0, 500) || null;
  const parsedUa = parseUserAgent(boundedUa);

  // 2. Extract verified sessionId from Authorization Bearer token JWT or verified cookie session
  let sessionId: string | null = null;
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token) {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
          const payload = JSON.parse(payloadJson);
          if (payload && typeof payload.session_id === "string" && payload.session_id.trim().length > 0) {
            sessionId = payload.session_id.trim();
          }
        }
      } catch {
        // Gracefully ignore malformed tokens; verified session required below
      }
    }
  }

  // If not in Bearer header, check verified session from cookies
  if (!sessionId) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (cookieHeader) {
      try {
        const cookieMap = new Map<string, string>();
        cookieHeader.split(";").forEach((pair) => {
          const [key, ...vals] = pair.trim().split("=");
          if (key) cookieMap.set(key, vals.join("="));
        });
        const { getSupabaseServerClient } = await import("@/lib/supabase/server");
        const supabase = getSupabaseServerClient({
          get: (name: string) => cookieMap.get(name),
        });
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (session) {
          if (typeof (session as any).id === "string" && (session as any).id.trim().length > 0) {
            sessionId = (session as any).id.trim();
          } else if (session.access_token) {
            const parts = session.access_token.split(".");
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
              if (payload && typeof payload.session_id === "string" && payload.session_id.trim().length > 0) {
                sessionId = payload.session_id.trim();
              }
            }
          }
        }
      } catch {
        // Cookie verification failed or unavailable
      }
    }
  }

  // Fail closed if no verified session identifier could be established
  if (!sessionId) {
    throw new Error("Validation Error: Missing or unverifiable session identifier");
  }

  try {
    const record = await prisma.adminLoginHistory.create({
      data: {
        adminId: context.profile.id,
        email: context.profile.email,
        sessionId,
        userAgent: boundedUa,
        browser: parsedUa.browser,
        os: parsedUa.os,
        deviceType: parsedUa.deviceType,
      },
    });

    // Update lastLoginAt on profile
    await prisma.adminProfile.update({
      where: { id: context.profile.id },
      data: { lastLoginAt: record.loginAt },
    }).catch(() => {});

    return { success: true, id: record.id };
  } catch (err: any) {
    // Gracefully handle duplicate sessionId collision (at-most-once semantics)
    if (err?.code === "P2002" || err?.message?.includes("Unique constraint failed")) {
      return { success: true, duplicate: true };
    }
    const sanitizedError = err instanceof Error ? err.message : "Database write failure";
    console.error("[recordAdminLoginOperation] Failed to insert admin login history:", {
      adminId: context.profile.id,
      error: sanitizedError,
    });
    // For quarantined admins or database write issues during recovery, do not break the MFA re-enrollment flow
    if (context.profile.mfaRecoveryPending) {
      return { success: false, duplicate: false };
    }
    throw err;
  }
}

/**
 * Retrieves the login history scoped strictly to the authenticated administrator.
 * Uses index @@index([adminId, loginAt(sort: Desc)]) for optimal pagination.
 */
export async function getSelfLoginHistoryOperation(
  request: Request,
  pagination?: { page?: number; limit?: number },
  prismaClient?: PrismaClient
): Promise<GetSelfLoginHistoryResult> {
  const context = await requireAdminProfile(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const page = Math.max(1, Number(pagination?.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(pagination?.limit) || 10));
  const skip = (page - 1) * limit;

  const where = { adminId: context.profile.id };

  const [total, items] = await Promise.all([
    prisma.adminLoginHistory.count({ where }),
    prisma.adminLoginHistory.findMany({
      where,
      orderBy: { loginAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// =========================================================================
// 8. EMERGENCY MFA RESET & RECOVERY OPERATIONS (Phase 4.6)
// =========================================================================

export interface EmergencyMfaResetPayload {
  targetId: string;
  expectedEmail: string;
  justification: string;
}

export interface EmergencyMfaResetResult {
  recoveryId: string;
  targetId: string;
  targetEmail: string;
  status: MfaRecoveryStatus;
  factorId?: string | null;
  message: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Track A — Web Portal Peer Recovery:
 * Initiated by an active SUPER_ADMIN with a server-verified AAL2 session targeting an ADMIN or EDITOR.
 * - Prohibits self-reset.
 * - Prohibits web reset of SUPER_ADMIN targets.
 * - Validates target email, active status, and non-empty justification.
 * - Acquires transactional lock, persists recovery intent (PENDING) and quarantine state before external mutation.
 * - Deletes only the specifically identified verified TOTP factor via deleteFactor({ id, userId }).
 * - Handles ambiguous / failed deletions safely (quarantine retained, RECONCILIATION_REQUIRED).
 */
export async function emergencyMfaResetOperation(
  request: Request,
  payload: EmergencyMfaResetPayload,
  prismaClient?: PrismaClient,
  mockSupabaseAdminClient?: any
): Promise<EmergencyMfaResetResult> {
  const clientIp = extractTrustedClientIp(request.headers);

  // 1. Authenticate actor and enforce active SUPER_ADMIN at AAL2
  const context = await requireAal2Role(request, ["SUPER_ADMIN"], prismaClient);
  const prisma = prismaClient || (await getPrisma());

  // 2. Validate input parameters
  if (!payload.targetId || !UUID_REGEX.test(payload.targetId)) {
    throw new Error("Validation: A valid target administrator UUID is required");
  }

  const expectedEmail = (payload.expectedEmail || "").trim().toLowerCase();
  if (!expectedEmail || !expectedEmail.includes("@")) {
    throw new Error("Validation: A valid expected target email is required");
  }

  const justification = (payload.justification || "").trim();
  if (justification.length < 10) {
    throw new Error("Validation: A meaningful justification of at least 10 characters is required");
  }

  // 3. Query and validate target administrator
  const target = await prisma.adminProfile.findUnique({
    where: { id: payload.targetId },
  });

  if (!target) {
    throw new Error("Target administrator profile not found");
  }

  // 4. Policy enforcement: Prohibit self-reset
  if (context.profile.id === target.id) {
    throw new Error("Forbidden: Self-recovery through web portal is prohibited");
  }

  // 5. Policy enforcement: Prohibit web reset of SUPER_ADMIN target
  if (target.role === "SUPER_ADMIN") {
    throw new Error("Forbidden: Web-based recovery targeting SUPER_ADMIN is prohibited. Host CLI break-glass must be used.");
  }

  // 6. Validate expected email match (case-insensitive)
  if (target.email.toLowerCase() !== expectedEmail) {
    throw new Error("Validation: Expected email does not match target administrator record");
  }

  // 7. Validate target is active
  if (!target.isActive) {
    throw new Error("Target administrator is deactivated");
  }

  // 8. Atomic acquisition of quarantine and recovery record
  // Serializes concurrent requests and prevents races between web and CLI operations
  const now = new Date();
  let recoveryRecord: any;

  try {
    recoveryRecord = await prisma.$transaction(async (tx) => {
      // Row-locking conditional update: Only succeeds if target is currently NOT quarantined and is active
      const updateRes = await tx.adminProfile.updateMany({
        where: {
          id: target.id,
          mfaRecoveryPending: false,
          isActive: true,
        },
        data: {
          mfaRecoveryPending: true,
          mfaRecoveryAt: now,
        },
      });

      if (updateRes.count === 0) {
        throw new Error("Conflict: Target administrator already has an active emergency recovery in progress or is inactive");
      }

      const rec = await tx.adminMfaRecovery.create({
        data: {
          actorType: "SUPER_ADMIN_PEER",
          actorId: context.profile.id,
          actorEmail: context.profile.email,
          actorIdentifier: null,
          targetId: target.id,
          targetEmail: target.email,
          targetRoleSnapshot: target.role,
          justification,
          status: "PENDING",
          initiatedAt: now,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: context.profile.id,
          actorEmail: context.profile.email,
          action: "MFA_RECOVERY_REQUESTED",
          module: "SECURITY_RECOVERY",
          entityId: target.id,
          metadata: {
            recoveryId: rec.id,
            targetEmail: target.email,
            targetRole: target.role,
            justification,
            initiatedAt: now.toISOString(),
          },
          ipAddress: maskIpAddress(clientIp),
        },
      });

      return rec;
    });
  } catch (txErr: any) {
    if (
      txErr?.code === "P2002" ||
      txErr?.message?.includes("unique_active_admin_mfa_recovery") ||
      txErr?.message?.includes("Unique constraint failed") ||
      txErr?.message?.includes("already has an active emergency recovery")
    ) {
      throw new Error("Target administrator already has an active emergency recovery in progress");
    }
    throw txErr;
  }

  // 9. External mutation: Inspect factors using Supabase Auth Admin API
  const supabaseAdmin = mockSupabaseAdminClient || getSupabaseAdminClient();
  let listRes: any;
  try {
    listRes = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: target.id });
  } catch (listErr: any) {
    // If factor inspection fails before deletion attempt, factor remains intact
    await prisma.adminMfaRecovery.update({
      where: { id: recoveryRecord.id },
      data: {
        status: "FAILED",
        failureCategory: "LIST_FACTORS_ERROR",
        failureReason: listErr?.message || "Failed to list factors from Supabase Auth",
      },
    });
    await prisma.adminProfile.update({
      where: { id: target.id },
      data: { mfaRecoveryPending: false, mfaRecoveryAt: null },
    });
    throw new Error(`Failed to inspect factors: ${listErr?.message || "Unknown error"}`);
  }

  if (listRes?.error) {
    await prisma.adminMfaRecovery.update({
      where: { id: recoveryRecord.id },
      data: {
        status: "FAILED",
        failureCategory: "LIST_FACTORS_ERROR",
        failureReason: listRes.error.message,
      },
    });
    await prisma.adminProfile.update({
      where: { id: target.id },
      data: { mfaRecoveryPending: false, mfaRecoveryAt: null },
    });
    throw new Error(`Supabase Auth error listing factors: ${listRes.error.message}`);
  }

  const factors = listRes.data?.factors || [];
  const verifiedTotp = factors.filter(
    (f: any) => f.factor_type === "totp" && f.status === "verified"
  );

  if (verifiedTotp.length === 0) {
    await prisma.adminMfaRecovery.update({
      where: { id: recoveryRecord.id },
      data: {
        status: "FAILED",
        failureCategory: "NO_VERIFIED_TOTP_FACTOR",
        failureReason: "Target administrator has no verified TOTP factor enrolled",
      },
    });
    await prisma.adminProfile.update({
      where: { id: target.id },
      data: { mfaRecoveryPending: false, mfaRecoveryAt: null },
    });
    throw new Error("Target administrator has no verified TOTP factor to reset");
  }

  // Identify specific verified TOTP factor
  const factorToDelete = verifiedTotp[0];

  // 10. Remove only the specifically identified verified TOTP factor
  let deleteRes: any = null;
  let deleteThrown: any = null;

  try {
    deleteRes = await supabaseAdmin.auth.admin.mfa.deleteFactor({
      id: factorToDelete.id,
      userId: target.id,
    });
  } catch (err) {
    deleteThrown = err;
  }

  // 11. Handle deletion failures and ambiguous outcomes safely
  if (deleteThrown || (deleteRes && deleteRes.error)) {
    // Re-check authoritative factor state to determine if factor is still intact
    let recheckRes: any = null;
    try {
      recheckRes = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: target.id });
    } catch {
      // Re-check also failed; strictly ambiguous
    }

    const intactFactor = recheckRes?.data?.factors?.find((f: any) => f.id === factorToDelete.id);

    if (intactFactor) {
      // Factor is definitely still intact in Supabase
      await prisma.adminMfaRecovery.update({
        where: { id: recoveryRecord.id },
        data: {
          status: "FAILED",
          failureCategory: "DELETION_FAILED_FACTOR_INTACT",
          failureReason:
            deleteThrown?.message ||
            deleteRes?.error?.message ||
            "Factor deletion failed but factor remains intact",
        },
      });
      await prisma.adminProfile.update({
        where: { id: target.id },
        data: { mfaRecoveryPending: false, mfaRecoveryAt: null },
      });
      throw new Error(
        `Factor deletion failed: ${deleteThrown?.message || deleteRes?.error?.message}`
      );
    } else {
      // Outcome ambiguous: MUST retain quarantine and mark RECONCILIATION_REQUIRED
      await prisma.adminMfaRecovery.update({
        where: { id: recoveryRecord.id },
        data: {
          status: "RECONCILIATION_REQUIRED",
          factorId: factorToDelete.id,
          failureCategory: "AMBIGUOUS_DELETION_OUTCOME",
          failureReason:
            deleteThrown?.message ||
            deleteRes?.error?.message ||
            "Deletion outcome ambiguous; retaining quarantine for reconciliation",
        },
      });
      try {
        await prisma.adminAuditLog.create({
          data: {
            actorId: context.profile.id,
            actorEmail: context.profile.email,
            action: "MFA_RECOVERY_RECONCILIATION_REQUIRED",
            module: "SECURITY_RECOVERY",
            entityId: target.id,
            metadata: {
              recoveryId: recoveryRecord.id,
              factorId: factorToDelete.id,
              reason: "provider_deletion_ambiguous",
            },
            ipAddress: maskIpAddress(clientIp),
          },
        });
      } catch {
        // Audit write failure must not release quarantine
      }
      return {
        recoveryId: recoveryRecord.id,
        targetId: target.id,
        targetEmail: target.email,
        status: "RECONCILIATION_REQUIRED",
        factorId: factorToDelete.id,
        message:
          "Factor deletion outcome is ambiguous. Administrator remains quarantined; reconciliation required.",
      };
    }
  }

  // 12. Confirmed factor deletion: record factor-deleted state
  const factorDeletedAt = new Date();
  try {
    await prisma.adminMfaRecovery.update({
      where: { id: recoveryRecord.id },
      data: {
        status: "FACTOR_DELETED",
        factorId: factorToDelete.id,
        factorDeletedAt,
      },
    });
  } catch (postDelErr: any) {
    // Supabase factor was confirmed deleted; if DB update fails, NEVER clear quarantine!
    console.error("[emergencyMfaResetOperation] Post-deletion DB update failed:", postDelErr);
    try {
      await prisma.adminMfaRecovery.update({
        where: { id: recoveryRecord.id },
        data: {
          status: "RECONCILIATION_REQUIRED",
          factorId: factorToDelete.id,
          reconciliationNotes: `Post-deletion DB update failed: ${postDelErr?.message || "DB error"}. Quarantine preserved.`,
        },
      });
    } catch {
      // AdminProfile.mfaRecoveryPending is already true
    }
  }

  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "MFA_RECOVERY_FACTOR_DELETED",
        module: "SECURITY_RECOVERY",
        entityId: target.id,
        metadata: {
          recoveryId: recoveryRecord.id,
          deletedFactorId: factorToDelete.id,
          factorDeletedAt: factorDeletedAt.toISOString(),
        },
        ipAddress: maskIpAddress(clientIp),
      },
    });
  } catch {
    // Post-deletion audit failure must not release quarantine
  }

  return {
    recoveryId: recoveryRecord.id,
    targetId: target.id,
    targetEmail: target.email,
    status: "FACTOR_DELETED",
    factorId: factorToDelete.id,
    message:
      "Emergency MFA recovery initialized. Verified TOTP factor deleted and administrator quarantined pending re-enrollment.",
  };
}

export interface CompleteMfaReenrollmentResult {
  success: boolean;
  recoveryId: string;
  targetId: string;
  newFactorId: string;
  message: string;
}

/**
 * Phase 4 — Independently Verified MFA Re-Enrollment:
 * Called by the quarantined administrator after successfully verifying a fresh TOTP factor.
 * - Authenticates the caller with allowQuarantined: true.
 * - Queries Supabase Auth Admin API independently for factors.
 * - Verifies that a verified TOTP factor exists that is NOT the deleted factor.
 * - Verifies factor creation timestamp is compatible with recovery initiation timestamp.
 * - In an atomic transaction, updates recovery to COMPLETED, writes audit log, and clears mfaRecoveryPending.
 */
export async function completeMfaReenrollmentOperation(
  request: Request,
  prismaClient?: PrismaClient,
  mockSupabaseAdminClient?: any
): Promise<CompleteMfaReenrollmentResult> {
  const clientIp = extractTrustedClientIp(request.headers);
  const context = await requireAdminProfile(request, prismaClient, { allowQuarantined: true });
  const prisma = prismaClient || (await getPrisma());

  if (!context.profile.mfaRecoveryPending) {
    throw new Error("No MFA recovery pending for this account");
  }

  // Locate the active factor-deleted recovery record for this target
  const recovery = await prisma.adminMfaRecovery.findFirst({
    where: {
      targetId: context.profile.id,
      status: "FACTOR_DELETED",
    },
    orderBy: { initiatedAt: "desc" },
  });

  if (!recovery) {
    throw new Error("No eligible factor-deleted recovery record found for this administrator");
  }

  // Query Supabase Admin API authoritatively
  const supabaseAdmin = mockSupabaseAdminClient || getSupabaseAdminClient();
  const listRes = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: context.profile.id });

  if (listRes?.error || !listRes?.data) {
    throw new Error(
      `Failed to verify MFA factors from identity provider: ${listRes?.error?.message || "Unknown error"}`
    );
  }

  const factors = listRes.data.factors || [];
  const verifiedTotp = factors.filter(
    (f: any) => f.factor_type === "totp" && f.status === "verified"
  );

  if (verifiedTotp.length === 0) {
    throw new Error("Re-enrollment verification failed: No verified TOTP factor found");
  }

  // Must not be the previously deleted factor
  const newFactor = verifiedTotp.find((f: any) => f.id !== recovery.factorId);
  if (!newFactor) {
    throw new Error("Re-enrollment verification failed: Only the previously deleted factor was found");
  }

  // Check creation timestamp against recovery initiation timestamp (with 5000ms clock skew buffer)
  if (!newFactor.created_at || typeof newFactor.created_at !== "string") {
    throw new Error("Re-enrollment verification failed: Factor creation timestamp is missing");
  }

  const factorCreatedTime = Date.parse(newFactor.created_at);
  if (isNaN(factorCreatedTime) || !Number.isFinite(factorCreatedTime)) {
    throw new Error("Re-enrollment verification failed: Factor creation timestamp is invalid");
  }

  const recoveryInitiatedTime = new Date(recovery.initiatedAt).getTime();
  if (isNaN(recoveryInitiatedTime) || !Number.isFinite(recoveryInitiatedTime)) {
    throw new Error("Re-enrollment verification failed: Recovery initiation timestamp is invalid");
  }

  if (factorCreatedTime < recoveryInitiatedTime - 5000) {
    throw new Error(
      "Re-enrollment verification failed: Factor was created before recovery was initiated"
    );
  }

  // Concurrency-safe atomic transaction to complete recovery and lift quarantine
  const completedAt = new Date();
  await prisma.$transaction(async (tx) => {
    // Conditional atomic update on AdminProfile
    const profileUpdateRes = await tx.adminProfile.updateMany({
      where: {
        id: context.profile.id,
        mfaRecoveryPending: true,
      },
      data: {
        mfaRecoveryPending: false,
        mfaRecoveryAt: null,
      },
    });

    if (profileUpdateRes.count === 0) {
      throw new Error("Concurrent modification: Recovery is no longer pending or already completed");
    }

    // Conditional atomic update on AdminMfaRecovery
    const recoveryUpdateRes = await tx.adminMfaRecovery.updateMany({
      where: {
        id: recovery.id,
        status: "FACTOR_DELETED",
      },
      data: {
        status: "COMPLETED",
        completedAt,
        reconciliationNotes: `Re-enrolled factor ID: ${newFactor.id}`,
      },
    });

    if (recoveryUpdateRes.count === 0) {
      throw new Error("Concurrent modification: Recovery record is no longer in FACTOR_DELETED state");
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "MFA_RECOVERY_COMPLETED",
        module: "SECURITY_RECOVERY",
        entityId: context.profile.id,
        metadata: {
          recoveryId: recovery.id,
          newFactorId: newFactor.id,
          completedAt: completedAt.toISOString(),
        },
        ipAddress: maskIpAddress(clientIp),
      },
    });
  });

  return {
    success: true,
    recoveryId: recovery.id,
    targetId: context.profile.id,
    newFactorId: newFactor.id,
    message: "MFA re-enrollment verified. Emergency recovery completed successfully.",
  };
}

export interface ReconcileMfaRecoveryPayload {
  recoveryId: string;
  notes?: string;
}

export interface ReconcileMfaRecoveryResult {
  recoveryId: string;
  targetId: string;
  status: MfaRecoveryStatus;
  mfaRecoveryPending: boolean;
  message: string;
}

/**
 * Phase 5 — Safe Reconciliation Operation:
 * - Loads persisted recovery operation.
 * - Rechecks authoritative Supabase factor state.
 * - Preserves quarantine whenever the outcome remains uncertain.
 * - Never removes additional factors automatically.
 * - Never clears quarantine without confirmed factor integrity.
 * - Records reconciliation result durably.
 */
export async function reconcileMfaRecoveryOperation(
  request: Request,
  payload: ReconcileMfaRecoveryPayload,
  prismaClient?: PrismaClient,
  mockSupabaseAdminClient?: any
): Promise<ReconcileMfaRecoveryResult> {
  const clientIp = extractTrustedClientIp(request.headers);
  const context = await requireAal2Role(request, ["SUPER_ADMIN"], prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const recovery = await prisma.adminMfaRecovery.findUnique({
    where: { id: payload.recoveryId },
  });

  if (!recovery) {
    throw new Error("Recovery record not found");
  }

  const supabaseAdmin = mockSupabaseAdminClient || getSupabaseAdminClient();
  const listRes = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: recovery.targetId });

  if (listRes?.error || !listRes?.data) {
    throw new Error(
      `Reconciliation query failed: ${listRes?.error?.message || "Failed to list factors"}`
    );
  }

  const factors = listRes.data.factors || [];
  const targetProfile = await prisma.adminProfile.findUnique({
    where: { id: recovery.targetId },
  });

  if (!targetProfile) {
    throw new Error("Target administrator profile not found");
  }

  const reconciledAt = new Date();
  let updatedStatus: MfaRecoveryStatus = recovery.status;
  let shouldQuarantine = targetProfile.mfaRecoveryPending;

  if (recovery.status === "PENDING" || recovery.status === "RECONCILIATION_REQUIRED") {
    const verifiedTotpFactors = factors.filter(
      (f: any) => f.factor_type === "totp" && f.status === "verified"
    );

    if (!recovery.factorId) {
      // factorId was never recorded or is absent
      if (verifiedTotpFactors.length > 0) {
        // Ambiguous: target still has verified factor(s) but recovery has no factorId.
        // Never delete an arbitrary factor. Retain quarantine and require manual inspection.
        updatedStatus = "RECONCILIATION_REQUIRED";
        shouldQuarantine = true;
        await prisma.adminMfaRecovery.update({
          where: { id: recovery.id },
          data: {
            status: "RECONCILIATION_REQUIRED",
            reconciledAt,
            reconciledByActorId: context.profile.id,
            reconciliationNotes:
              (payload.notes ? `${payload.notes}. ` : "") +
              "Ambiguous state: recovery record missing factorId but target has verified factors in Supabase. Quarantine retained; manual administrative inspection required.",
          },
        });
        await prisma.adminProfile.update({
          where: { id: targetProfile.id },
          data: { mfaRecoveryPending: true },
        });
      } else {
        // Target has NO verified TOTP factors in Supabase at all.
        // Account is factor-free and ready for re-enrollment.
        updatedStatus = "FACTOR_DELETED";
        shouldQuarantine = true;
        await prisma.adminMfaRecovery.update({
          where: { id: recovery.id },
          data: {
            status: "FACTOR_DELETED",
            factorDeletedAt: recovery.factorDeletedAt || reconciledAt,
            reconciledAt,
            reconciledByActorId: context.profile.id,
            reconciliationNotes:
              payload.notes ||
              "Reconciled: Target has no active verified TOTP factors in Supabase. Quarantine retained pending re-enrollment.",
          },
        });
        await prisma.adminProfile.update({
          where: { id: targetProfile.id },
          data: { mfaRecoveryPending: true },
        });
      }
    } else {
      // Authoritative factor comparison by specific factor ID
      const factorExists = factors.some((f: any) => f.id === recovery.factorId);

      if (!factorExists) {
        // Factor was confirmed deleted from Supabase
        updatedStatus = "FACTOR_DELETED";
        shouldQuarantine = true;
        await prisma.adminMfaRecovery.update({
          where: { id: recovery.id },
          data: {
            status: "FACTOR_DELETED",
            factorDeletedAt: recovery.factorDeletedAt || reconciledAt,
            reconciledAt,
            reconciledByActorId: context.profile.id,
            reconciliationNotes:
              payload.notes || "Reconciled: factor confirmed deleted from Supabase",
          },
        });
        await prisma.adminProfile.update({
          where: { id: targetProfile.id },
          data: { mfaRecoveryPending: true },
        });
      } else {
        // Factor is still intact in Supabase
        updatedStatus = "FAILED";
        shouldQuarantine = false;
        await prisma.adminMfaRecovery.update({
          where: { id: recovery.id },
          data: {
            status: "FAILED",
            failureCategory: "RECONCILED_FACTOR_INTACT",
            reconciledAt,
            reconciledByActorId: context.profile.id,
            reconciliationNotes:
              payload.notes || "Reconciled: factor confirmed still intact in Supabase; released quarantine",
          },
        });
        await prisma.adminProfile.update({
          where: { id: targetProfile.id },
          data: { mfaRecoveryPending: false, mfaRecoveryAt: null },
        });
      }
    }
  }

  await prisma.adminAuditLog.create({
    data: {
      actorId: context.profile.id,
      actorEmail: context.profile.email,
      action: "MFA_RECOVERY_RECONCILED",
      module: "SECURITY_RECOVERY",
      entityId: recovery.targetId,
      metadata: {
        recoveryId: recovery.id,
        targetEmail: recovery.targetEmail,
        previousStatus: recovery.status,
        newStatus: updatedStatus,
        notes: payload.notes,
      },
      ipAddress: maskIpAddress(clientIp),
    },
  });

  return {
    recoveryId: recovery.id,
    targetId: recovery.targetId,
    status: updatedStatus,
    mfaRecoveryPending: shouldQuarantine,
    message: `Recovery operation reconciled. Status: ${updatedStatus}. Quarantine: ${shouldQuarantine ? "active" : "released"}.`,
  };
}

/**
 * Retrieves the current MFA recovery status for a given administrator.
 * Only the administrator themselves or a SUPER_ADMIN may inspect this status.
 */
export async function getMfaRecoveryStatusOperation(
  request: Request,
  targetId?: string,
  prismaClient?: PrismaClient
): Promise<{ pending: boolean; recovery: AdminMfaRecovery | null }> {
  const context = await requireAdminProfile(request, prismaClient, { allowQuarantined: true });
  const prisma = prismaClient || (await getPrisma());

  const effectiveTargetId = targetId || context.profile.id;

  // Authorization check: self or SUPER_ADMIN
  if (effectiveTargetId !== context.profile.id && context.profile.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden: Insufficient permissions to view recovery status");
  }

  const profile = await prisma.adminProfile.findUnique({
    where: { id: effectiveTargetId },
  });

  if (!profile) {
    throw new Error("Administrator profile not found");
  }

  const recovery = await prisma.adminMfaRecovery.findFirst({
    where: { targetId: effectiveTargetId },
    orderBy: { createdAt: "desc" },
  });

  return {
    pending: profile.mfaRecoveryPending,
    recovery,
  };
}
