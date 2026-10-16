import type { PrismaClient, Award, PublishStatus, MediaAsset, AwardGalleryItem } from "@prisma/client";
import { AdminPermissions } from "@/lib/auth/rbac";
import { requirePermission } from "@/lib/auth/server-auth";
import { createNotificationEvent } from "./notification-operations";

let defaultPrisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient> {
  if (!defaultPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

export type AwardWithMedia = Award & {
  thumbnail?: MediaAsset | null;
  gallery?: (AwardGalleryItem & { media: MediaAsset })[];
};

export interface CreateAwardPayload {
  name: string;
  slug?: string | undefined;
  context: string;
  organization: string;
  category: string;
  date?: string | undefined;
  description: string;
  fullDescription?: string | null | undefined;
  credentialUrl?: string | null | undefined;
  status?: PublishStatus | undefined;
  showOnHomepage?: boolean | undefined;
  displayOrder?: number | undefined;
  thumbnailId?: string | null | undefined;
  galleryMediaIds?: string[] | undefined;
}

export interface UpdateAwardPayload {
  name?: string | undefined;
  slug?: string | undefined;
  context?: string | undefined;
  organization?: string | undefined;
  category?: string | undefined;
  date?: string | undefined;
  description?: string | undefined;
  fullDescription?: string | null | undefined;
  credentialUrl?: string | null | undefined;
  status?: PublishStatus | undefined;
  showOnHomepage?: boolean | undefined;
  displayOrder?: number | undefined;
  thumbnailId?: string | null | undefined;
  galleryMediaIds?: string[] | undefined;
}

/**
 * Normalizes title into URL-safe slug.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validates that an optional or required URL doesn't use dangerous schemes (e.g. javascript:, data:, vbscript:).
 */
export function validateSafeUrl(urlStr: string | null | undefined, fieldName: string): string | null {
  if (!urlStr || !urlStr.trim()) return null;
  let trimmed = urlStr.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    throw new Error(`Validation Error: ${fieldName} cannot use dangerous protocol scheme`);
  }

  // Auto-normalize safe web addresses that lack protocol (e.g. "credential.net/123")
  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.includes("://")) {
      throw new Error(`Validation Error: ${fieldName} must use http:// or https:// protocol`);
    }
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Validation Error: ${fieldName} must use http:// or https:// protocol`);
    }
    if (!parsed.hostname || (!parsed.hostname.includes(".") && parsed.hostname !== "localhost")) {
      throw new Error(`Validation Error: ${fieldName} must be a valid URL`);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("Validation Error:")) throw err;
    throw new Error(`Validation Error: ${fieldName} must be a valid URL`);
  }

  return trimmed;
}

const VALID_PUBLISH_STATUSES: PublishStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

/**
 * Validates that the referenced thumbnail and gallery MediaAssets exist in the database.
 */
async function validateAwardMediaReference(
  prisma: PrismaClient,
  thumbnailId?: string | null,
  galleryMediaIds?: string[] | null
): Promise<void> {
  if (thumbnailId && typeof thumbnailId === "string" && thumbnailId.trim()) {
    const thumbAsset = await prisma.mediaAsset.findUnique({
      where: { id: thumbnailId.trim() },
      select: { id: true },
    });
    if (!thumbAsset) {
      throw new Error(`Validation Error: Thumbnail media asset "${thumbnailId}" does not exist in Media Library`);
    }
  }

  if (galleryMediaIds !== undefined && galleryMediaIds !== null) {
    if (!Array.isArray(galleryMediaIds)) {
      throw new Error("Validation Error: galleryMediaIds must be an array of strings");
    }
    if (galleryMediaIds.length > 5) {
      throw new Error("Validation Error: Maximum of 5 gallery images allowed");
    }
    for (const id of galleryMediaIds) {
      if (typeof id !== "string" || !id.trim()) {
        throw new Error("Validation Error: Each gallery media ID must be a non-empty string");
      }
    }
    const uniqueIds = new Set(galleryMediaIds.map((id) => id.trim()));
    if (uniqueIds.size !== galleryMediaIds.length) {
      throw new Error("Validation Error: Duplicate gallery media items are not permitted");
    }
    if (galleryMediaIds.length > 0) {
      const foundAssets = await prisma.mediaAsset.findMany({
        where: { id: { in: Array.from(uniqueIds) } },
        select: { id: true },
      });
      if (foundAssets.length !== uniqueIds.size) {
        const foundSet = new Set(foundAssets.map((a) => a.id));
        const missing = Array.from(uniqueIds).filter((id) => !foundSet.has(id));
        throw new Error(`Validation Error: Referenced gallery media asset(s) not found in Media Library: ${missing.join(", ")}`);
      }
    }
  }
}

/**
 * Lists all awards for administrative management (Includes Drafts & Archived).
 * Requires CMS_READ permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function listAdminAwardsOperation(
  request: Request,
  optionsOrPrisma?: { status?: PublishStatus | undefined; category?: string | undefined; search?: string | undefined } | PrismaClient,
  prismaClient?: PrismaClient | undefined
): Promise<{ awards: AwardWithMedia[] }> {
  const isPrisma = optionsOrPrisma && ("adminProfile" in optionsOrPrisma || "$transaction" in (optionsOrPrisma as any));
  const prismaInstance = isPrisma ? (optionsOrPrisma as PrismaClient) : prismaClient;
  const options = isPrisma ? undefined : (optionsOrPrisma as { status?: PublishStatus | undefined; category?: string | undefined; search?: string | undefined } | undefined);

  await requirePermission(request, AdminPermissions.CMS_READ, prismaInstance);
  const prisma = prismaInstance || (await getPrisma());

  const where: any = {};
  if (options?.status) {
    where.status = options.status;
  }
  if (options?.category && options.category.trim() && options.category !== "ALL") {
    where.category = options.category.trim();
  }
  if (options?.search && options.search.trim()) {
    const q = options.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { context: { contains: q, mode: "insensitive" } },
      { organization: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const awards = await prisma.award.findMany({
    where,
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return { awards };
}

/**
 * Retrieves a single award by ID or Slug for admin editing.
 * Requires CMS_READ permission.
 */
export async function getAdminAwardByIdOperation(
  request: Request,
  idOrSlug: string,
  prismaClient?: PrismaClient
): Promise<{ award: AwardWithMedia | null }> {
  await requirePermission(request, AdminPermissions.CMS_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!idOrSlug || !idOrSlug.trim()) {
    return { award: null };
  }

  const award = await prisma.award.findFirst({
    where: {
      OR: [{ id: idOrSlug.trim() }, { slug: idOrSlug.trim() }],
    },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  return { award };
}

/**
 * Creates a new award in PostgreSQL with audit log.
 * Requires CMS_CREATE permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function createAdminAwardOperation(
  request: Request,
  payload: CreateAwardPayload,
  prismaClient?: PrismaClient
): Promise<{ award: AwardWithMedia }> {
  const context = await requirePermission(request, AdminPermissions.CMS_CREATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.name || !payload.name.trim()) {
    throw new Error("Validation Error: Award title is required");
  }
  if (payload.name.trim().length > 255) {
    throw new Error("Validation Error: Award title cannot exceed 255 characters");
  }

  if (!payload.context || !payload.context.trim()) {
    throw new Error("Validation Error: Context is required");
  }
  if (payload.context.trim().length > 255) {
    throw new Error("Validation Error: Context cannot exceed 255 characters");
  }

  if (!payload.organization || !payload.organization.trim()) {
    throw new Error("Validation Error: Organization is required");
  }
  if (payload.organization.trim().length > 255) {
    throw new Error("Validation Error: Organization cannot exceed 255 characters");
  }

  if (!payload.category || !payload.category.trim()) {
    throw new Error("Validation Error: Category is required");
  }
  if (payload.category.trim().length > 100) {
    throw new Error("Validation Error: Category cannot exceed 100 characters");
  }

  if (!payload.description || !payload.description.trim()) {
    throw new Error("Validation Error: Description is required");
  }
  if (payload.description.trim().length > 1000) {
    throw new Error("Validation Error: Description cannot exceed 1000 characters");
  }

  if (payload.fullDescription && payload.fullDescription.trim().length > 20000) {
    throw new Error("Validation Error: Full description cannot exceed 20000 characters");
  }

  // Validate status
  const status: PublishStatus = payload.status || "DRAFT";
  if (!VALID_PUBLISH_STATUSES.includes(status)) {
    throw new Error(`Validation Error: Invalid award status "${status}"`);
  }

  // Mandatory real thumbnail for both Save as Draft and Publish (Rule 2)
  if (!payload.thumbnailId || !payload.thumbnailId.trim()) {
    throw new Error("Validation Error: Thumbnail image is required. Please upload or select a cover image from the Media Library.");
  }
  const thumbnailId = payload.thumbnailId.trim();

  // Validate Credential URL (optional, but if provided must be safe)
  const credentialUrl = payload.credentialUrl && payload.credentialUrl.trim()
    ? validateSafeUrl(payload.credentialUrl, "Credential URL")
    : null;

  // Date field handling (date is non-nullable string in schema)
  const date = payload.date && payload.date.trim()
    ? payload.date.trim()
    : new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });

  const name = payload.name.trim();
  const rawSlug = payload.slug?.trim() || slugify(name);
  const slug = slugify(rawSlug);

  if (!slug) {
    throw new Error("Validation Error: Unable to generate a valid slug from name");
  }

  // Check unique slug constraint
  const existing = await prisma.award.findFirst({
    where: { slug },
  });
  if (existing) {
    throw new Error(`Conflict: An award with slug "${slug}" already exists`);
  }

  // Validate Media Asset Reference
  await validateAwardMediaReference(prisma, thumbnailId, payload.galleryMediaIds);

  // Execute in atomic transaction: create award, create gallery items, record audit log
  const createdAward = await prisma.$transaction(async (tx) => {
    const aw = await tx.award.create({
      data: {
        name,
        slug,
        context: payload.context.trim(),
        organization: payload.organization.trim(),
        category: payload.category.trim(),
        date,
        description: payload.description.trim(),
        fullDescription: payload.fullDescription?.trim() || null,
        credentialUrl,
        status,
        showOnHomepage: payload.showOnHomepage !== undefined ? Boolean(payload.showOnHomepage) : true,
        displayOrder: typeof payload.displayOrder === "number" ? payload.displayOrder : 0,
        thumbnailId,
      },
    });

    // Create gallery associations if provided
    if (payload.galleryMediaIds && payload.galleryMediaIds.length > 0) {
      await Promise.all(
        payload.galleryMediaIds.map((mediaId, idx) =>
          tx.awardGalleryItem.create({
            data: {
              awardId: aw.id,
              mediaId,
              displayOrder: idx,
            },
          })
        )
      );
    }

    // Record Audit Log
    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "AWARD_CREATED",
        module: "AWARDS_CMS",
        entityId: aw.id,
        metadata: {
          name: aw.name,
          organization: aw.organization,
          category: aw.category,
          slug: aw.slug,
          status: aw.status,
          galleryCount: payload.galleryMediaIds?.length || 0,
        },
      },
    });

    return aw;
  });

  // Re-read with relations
  const fullAward = await prisma.award.findUniqueOrThrow({
    where: { id: createdAward.id },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (createdAward.status === "PUBLISHED") {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Award Published",
        message: `${context.profile.fullName || context.profile.email} published award "${fullAward.name}".`,
        link: "/admin/awards",
        eventKey: `award:published:${createdAward.id}`,
      },
      prismaClient
    );
  }

  return { award: fullAward };
}

/**
 * Updates an existing award in PostgreSQL with audit log.
 * Requires CMS_UPDATE permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function updateAdminAwardOperation(
  request: Request,
  id: string,
  payload: UpdateAwardPayload,
  prismaClient?: PrismaClient
): Promise<{ award: AwardWithMedia }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const existing = await prisma.award.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error(`Not Found: Award with ID "${id}" does not exist`);
  }

  const updateData: any = {};

  if (payload.name !== undefined) {
    if (!payload.name.trim()) {
      throw new Error("Validation Error: Award title cannot be empty");
    }
    if (payload.name.trim().length > 255) {
      throw new Error("Validation Error: Award title cannot exceed 255 characters");
    }
    updateData.name = payload.name.trim();
  }

  if (payload.slug !== undefined) {
    const normalizedSlug = slugify(payload.slug);
    if (!normalizedSlug) {
      throw new Error("Validation Error: Slug cannot be empty");
    }
    if (normalizedSlug !== existing.slug) {
      const conflict = await prisma.award.findFirst({
        where: { slug: normalizedSlug, id: { not: id } },
      });
      if (conflict) {
        throw new Error(`Conflict: An award with slug "${normalizedSlug}" already exists`);
      }
      updateData.slug = normalizedSlug;
    }
  }

  if (payload.context !== undefined) {
    if (!payload.context.trim()) {
      throw new Error("Validation Error: Context cannot be empty");
    }
    if (payload.context.trim().length > 255) {
      throw new Error("Validation Error: Context cannot exceed 255 characters");
    }
    updateData.context = payload.context.trim();
  }

  if (payload.organization !== undefined) {
    if (!payload.organization.trim()) {
      throw new Error("Validation Error: Organization cannot be empty");
    }
    if (payload.organization.trim().length > 255) {
      throw new Error("Validation Error: Organization cannot exceed 255 characters");
    }
    updateData.organization = payload.organization.trim();
  }

  if (payload.category !== undefined) {
    if (!payload.category.trim()) {
      throw new Error("Validation Error: Category cannot be empty");
    }
    if (payload.category.trim().length > 100) {
      throw new Error("Validation Error: Category cannot exceed 100 characters");
    }
    updateData.category = payload.category.trim();
  }

  if (payload.description !== undefined) {
    if (!payload.description.trim()) {
      throw new Error("Validation Error: Description cannot be empty");
    }
    if (payload.description.trim().length > 1000) {
      throw new Error("Validation Error: Description cannot exceed 1000 characters");
    }
    updateData.description = payload.description.trim();
  }

  if (payload.fullDescription !== undefined) {
    if (payload.fullDescription && payload.fullDescription.trim().length > 20000) {
      throw new Error("Validation Error: Full description cannot exceed 20000 characters");
    }
    updateData.fullDescription = payload.fullDescription?.trim() || null;
  }

  if (payload.date !== undefined) {
    updateData.date = payload.date.trim();
  }

  if (payload.credentialUrl !== undefined) {
    updateData.credentialUrl = payload.credentialUrl && payload.credentialUrl.trim()
      ? validateSafeUrl(payload.credentialUrl, "Credential URL")
      : null;
  }

  if (payload.status !== undefined) {
    if (!VALID_PUBLISH_STATUSES.includes(payload.status)) {
      throw new Error(`Validation Error: Invalid award status "${payload.status}"`);
    }
    updateData.status = payload.status;
  }

  if (payload.showOnHomepage !== undefined) {
    updateData.showOnHomepage = Boolean(payload.showOnHomepage);
  }

  if (payload.displayOrder !== undefined) {
    updateData.displayOrder = payload.displayOrder;
  }

  // Required thumbnail: A real thumbnail is required for both Draft and Publish
  if (payload.thumbnailId !== undefined) {
    if (!payload.thumbnailId || !payload.thumbnailId.trim()) {
      throw new Error("Validation Error: Thumbnail image is required. Please upload or select a cover image from the Media Library.");
    }
    updateData.thumbnailId = payload.thumbnailId.trim();
  } else if (!existing.thumbnailId || !existing.thumbnailId.trim()) {
    throw new Error("Validation Error: Thumbnail image is required. Please upload or select a cover image from the Media Library.");
  }

  // Validate Media Asset Reference if changed or existing
  await validateAwardMediaReference(prisma, updateData.thumbnailId || existing.thumbnailId, payload.galleryMediaIds);

  // Execute in transaction
  await prisma.$transaction(async (tx) => {
    await tx.award.update({
      where: { id },
      data: updateData,
    });

    // Update gallery items if provided
    if (payload.galleryMediaIds !== undefined) {
      await tx.awardGalleryItem.deleteMany({
        where: { awardId: id },
      });

      if (payload.galleryMediaIds.length > 0) {
        await Promise.all(
          payload.galleryMediaIds.map((mediaId, idx) =>
            tx.awardGalleryItem.create({
              data: {
                awardId: id,
                mediaId,
                displayOrder: idx,
              },
            })
          )
        );
      }
    }

    // Record Audit Log
    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "AWARD_UPDATED",
        module: "AWARDS_CMS",
        entityId: id,
        metadata: {
          changes: Object.keys(updateData),
          hasGalleryUpdate: payload.galleryMediaIds !== undefined,
        },
      },
    });
  });

  const updatedAward = await prisma.award.findUniqueOrThrow({
    where: { id },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  const wasPublished = existing.status === "PUBLISHED";
  const newStatus = updateData.status !== undefined ? updateData.status : existing.status;
  const isNowPublished = newStatus === "PUBLISHED";
  const isNowArchived = newStatus === "ARCHIVED";

  if (!wasPublished && isNowPublished) {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Award Published",
        message: `${context.profile.fullName || context.profile.email} published award "${updatedAward.name}".`,
        link: "/admin/awards",
        eventKey: `award:published:${id}`,
      },
      prismaClient
    );
  } else if (wasPublished && isNowPublished) {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Award Updated",
        message: `${context.profile.fullName || context.profile.email} updated award "${updatedAward.name}".`,
        link: "/admin/awards",
      },
      prismaClient
    );
  } else if (wasPublished && isNowArchived) {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Award Archived",
        message: `${context.profile.fullName || context.profile.email} archived award "${updatedAward.name}".`,
        link: "/admin/awards",
        eventKey: `award:archived:${id}`,
      },
      prismaClient
    );
  }

  return { award: updatedAward };
}

/**
 * Deletes an award from PostgreSQL.
 * Requires CMS_DELETE permission (SUPER_ADMIN, ADMIN only; rejected for EDITOR).
 */
export async function deleteAdminAwardOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
): Promise<{ success: boolean; deletedId: string }> {
  const context = await requirePermission(request, AdminPermissions.CMS_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const award = await prisma.award.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!award) {
    throw new Error(`Not Found: Award with ID "${id}" does not exist`);
  }

  await prisma.$transaction(async (tx) => {
    // Delete the award record (Preserves shared MediaAsset)
    await tx.award.delete({
      where: { id },
    });

    // Record Audit Log
    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "AWARD_DELETED",
        module: "AWARDS_CMS",
        entityId: id,
        metadata: {
          deletedAwardName: award.name,
          deletedSlug: award.slug,
        },
      },
    });
  });

  if (award.status === "PUBLISHED") {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Award Deleted",
        message: `${context.profile.fullName || context.profile.email} deleted award "${award.name}".`,
        link: "/admin/awards",
        eventKey: `award:deleted:${id}`,
      },
      prismaClient
    );
  }

  return { success: true, deletedId: id };
}

/**
 * Reorders award entries in PostgreSQL using sequential displayOrder values.
 * Requires CMS_UPDATE permission.
 */
export async function reorderAdminAwardsOperation(
  request: Request,
  orderedIds: string[],
  prismaClient?: PrismaClient
): Promise<{ success: boolean }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error("Validation Error: orderedIds must be a non-empty array of award IDs");
  }

  const uniqueIds = Array.from(new Set(orderedIds));
  if (uniqueIds.length !== orderedIds.length) {
    throw new Error("Validation Error: orderedIds cannot contain duplicate IDs");
  }

  // Verify all IDs exist in database
  const count = await prisma.award.count({
    where: { id: { in: orderedIds } },
  });
  if (count !== orderedIds.length) {
    throw new Error("Validation Error: One or more award IDs in orderedIds do not exist");
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        tx.award.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "AWARDS_REORDERED",
        module: "AWARDS_CMS",
        metadata: {
          count: orderedIds.length,
          orderedIds,
        },
      },
    });
  });

  return { success: true };
}

/**
 * Retrieves published awards for public showcase display.
 * Unauthenticated (Public Access).
 */
export async function getPublicAwardsOperation(
  prismaClient?: PrismaClient,
  options?: { homepageOnly?: boolean }
): Promise<{ awards: AwardWithMedia[] }> {
  const prisma = prismaClient || (await getPrisma());

  const where: any = { status: "PUBLISHED" };
  if (options?.homepageOnly) {
    where.showOnHomepage = true;
  }

  const awards = await prisma.award.findMany({
    where,
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return { awards };
}

/**
 * Retrieves a single published award by Slug for public detail viewing.
 * Unauthenticated (Public Access). Fails with null if draft, archived, or non-existent.
 */
export async function getPublicAwardBySlugOperation(
  slug: string,
  prismaClient?: PrismaClient
): Promise<{ award: AwardWithMedia | null }> {
  const prisma = prismaClient || (await getPrisma());

  if (!slug || !slug.trim()) {
    return { award: null };
  }

  const award = await prisma.award.findFirst({
    where: {
      slug: slug.trim(),
      status: "PUBLISHED",
    },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  return { award };
}
