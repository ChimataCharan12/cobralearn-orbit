import type { PrismaClient, HomepageSection, MediaAsset } from "@prisma/client";
import { AdminPermissions } from "@/lib/auth/rbac";
import { requirePermission, requireAal2Permission } from "@/lib/auth/server-auth";
import { INITIAL_HOMEPAGE_SECTIONS } from "@/lib/homepage-data";

let defaultPrisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient> {
  if (!defaultPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

export type HomepageSectionWithMedia = HomepageSection & {
  mediaAsset?: MediaAsset | null;
};

export interface CreateHomepageSectionPayload {
  name: string;
  iconName?: string;
  badge?: string | null;
  title: string;
  subtitle: string;
  primaryButtonLabel?: string | null;
  primaryButtonLink?: string | null;
  secondaryButtonLabel?: string | null;
  secondaryButtonLink?: string | null;
  mediaAssetId?: string | null;
  enabled?: boolean;
}

export interface UpdateHomepageSectionPayload {
  name?: string;
  iconName?: string;
  badge?: string | null;
  title?: string;
  subtitle?: string;
  primaryButtonLabel?: string | null;
  primaryButtonLink?: string | null;
  secondaryButtonLabel?: string | null;
  secondaryButtonLink?: string | null;
  mediaAssetId?: string | null;
  enabled?: boolean;
}

/**
 * Validates and sanitizes a URL to prevent dangerous executable schemes.
 */
export function validateSafeUrl(url?: string | null, fieldName: string = "URL"): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    throw new Error(`Validation Error: ${fieldName} cannot use dangerous protocol scheme`);
  }
  return trimmed;
}

/**
 * Idempotently initializes the approved 4 default homepage sections if none exist.
 * Preserves existing records; never overwrites admin modifications.
 */
export async function ensureDefaultHomepageSections(prisma: PrismaClient): Promise<void> {
  const count = await prisma.homepageSection.count();
  if (count > 0) return;

  for (const s of INITIAL_HOMEPAGE_SECTIONS) {
    await prisma.homepageSection.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        name: s.name,
        iconName: s.iconName,
        enabled: s.enabled,
        displayOrder: s.order,
        badge: s.badge || null,
        title: s.title,
        subtitle: s.subtitle,
        primaryButtonLabel: s.primaryButtonLabel || null,
        primaryButtonLink: s.primaryButtonLink || null,
        secondaryButtonLabel: s.secondaryButtonLabel || null,
        secondaryButtonLink: s.secondaryButtonLink || null,
      },
    });
  }
}

// =========================================================================
// 1. ADMIN PROTECTED OPERATIONS (RBAC Enforced)
// =========================================================================

/**
 * Lists all homepage sections for administrative management.
 * Requires CMS_READ permission.
 */
export async function listAdminHomepageSectionsOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<{ sections: HomepageSectionWithMedia[] }> {
  await requirePermission(request, AdminPermissions.CMS_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  await ensureDefaultHomepageSections(prisma);

  const sections = await prisma.homepageSection.findMany({
    include: { mediaAsset: true },
    orderBy: { displayOrder: "asc" },
  });

  return { sections };
}

/**
 * Updates an existing homepage section.
 * Requires CMS_UPDATE permission.
 */
export async function updateAdminHomepageSectionOperation(
  request: Request,
  id: string,
  payload: UpdateHomepageSectionPayload,
  prismaClient?: PrismaClient
): Promise<{ section: HomepageSectionWithMedia }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!id || !id.trim()) {
    throw new Error("Validation Error: Section ID is required");
  }

  const existing = await prisma.homepageSection.findUnique({
    where: { id: id.trim() },
  });
  if (!existing) {
    throw new Error(`Not Found: Homepage section "${id}" does not exist`);
  }

  // Validate fields if provided
  if (payload.title !== undefined && (!payload.title || !payload.title.trim())) {
    throw new Error("Validation Error: Section title cannot be empty");
  }
  if (payload.name !== undefined && (!payload.name || !payload.name.trim())) {
    throw new Error("Validation Error: Section name cannot be empty");
  }

  const primaryButtonLink = payload.primaryButtonLink !== undefined
    ? validateSafeUrl(payload.primaryButtonLink, "Primary Button Link")
    : undefined;
  const secondaryButtonLink = payload.secondaryButtonLink !== undefined
    ? validateSafeUrl(payload.secondaryButtonLink, "Secondary Button Link")
    : undefined;

  // Validate media asset if provided
  if (payload.mediaAssetId) {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: payload.mediaAssetId },
    });
    if (!asset) {
      throw new Error(`Validation Error: Referenced media asset "${payload.mediaAssetId}" not found`);
    }
  }

  const updatedSection = await prisma.$transaction(async (tx) => {
    const section = await tx.homepageSection.update({
      where: { id: id.trim() },
      data: {
        ...(payload.name !== undefined && { name: payload.name.trim() }),
        ...(payload.iconName !== undefined && { iconName: payload.iconName.trim() }),
        ...(payload.badge !== undefined && { badge: payload.badge?.trim() || null }),
        ...(payload.title !== undefined && { title: payload.title.trim() }),
        ...(payload.subtitle !== undefined && { subtitle: payload.subtitle.trim() }),
        ...(payload.primaryButtonLabel !== undefined && { primaryButtonLabel: payload.primaryButtonLabel?.trim() || null }),
        ...(primaryButtonLink !== undefined && { primaryButtonLink }),
        ...(payload.secondaryButtonLabel !== undefined && { secondaryButtonLabel: payload.secondaryButtonLabel?.trim() || null }),
        ...(secondaryButtonLink !== undefined && { secondaryButtonLink }),
        ...(payload.mediaAssetId !== undefined && { mediaAssetId: payload.mediaAssetId || null }),
        ...(payload.enabled !== undefined && { enabled: Boolean(payload.enabled) }),
      },
      include: { mediaAsset: true },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "HOMEPAGE_SECTION_UPDATED",
        module: "HOMEPAGE_CMS",
        entityId: section.id,
        metadata: {
          name: section.name,
          title: section.title,
          enabled: section.enabled,
        },
      },
    });

    return section;
  });

  return { section: updatedSection };
}

/**
 * Creates a new homepage section.
 * Requires CMS_CREATE permission.
 */
export async function createAdminHomepageSectionOperation(
  request: Request,
  payload: CreateHomepageSectionPayload,
  prismaClient?: PrismaClient
): Promise<{ section: HomepageSectionWithMedia }> {
  const context = await requirePermission(request, AdminPermissions.CMS_CREATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.name || !payload.name.trim()) {
    throw new Error("Validation Error: Section name is required");
  }
  if (!payload.title || !payload.title.trim()) {
    throw new Error("Validation Error: Section title is required");
  }

  const primaryButtonLink = validateSafeUrl(payload.primaryButtonLink, "Primary Button Link");
  const secondaryButtonLink = validateSafeUrl(payload.secondaryButtonLink, "Secondary Button Link");

  // Determine next display order
  const lastSection = await prisma.homepageSection.findFirst({
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  const displayOrder = (lastSection?.displayOrder ?? 0) + 1;
  const newId = `sec-${Date.now()}`;

  const createdSection = await prisma.$transaction(async (tx) => {
    const section = await tx.homepageSection.create({
      data: {
        id: newId,
        name: payload.name.trim(),
        iconName: payload.iconName?.trim() || "Star",
        enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : true,
        displayOrder,
        badge: payload.badge?.trim() || null,
        title: payload.title.trim(),
        subtitle: payload.subtitle?.trim() || "",
        primaryButtonLabel: payload.primaryButtonLabel?.trim() || null,
        primaryButtonLink,
        secondaryButtonLabel: payload.secondaryButtonLabel?.trim() || null,
        secondaryButtonLink,
        mediaAssetId: payload.mediaAssetId || null,
      },
      include: { mediaAsset: true },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "HOMEPAGE_SECTION_CREATED",
        module: "HOMEPAGE_CMS",
        entityId: section.id,
        metadata: {
          name: section.name,
          title: section.title,
        },
      },
    });

    return section;
  });

  return { section: createdSection };
}

/**
 * Reorders homepage sections.
 * Requires CMS_UPDATE permission.
 */
export async function reorderAdminHomepageSectionsOperation(
  request: Request,
  orderedIds: string[],
  prismaClient?: PrismaClient
): Promise<{ success: boolean }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error("Validation Error: orderedIds must be a non-empty array of section IDs");
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (typeof id === "string" && id.trim()) {
        await tx.homepageSection.update({
          where: { id: id.trim() },
          data: { displayOrder: i + 1 },
        });
      }
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "HOMEPAGE_SECTIONS_REORDERED",
        module: "HOMEPAGE_CMS",
        metadata: { count: orderedIds.length },
      },
    });
  });

  return { success: true };
}

/**
 * Deletes a custom homepage section. Core sections cannot be deleted.
 * Requires CMS_DELETE permission.
 */
export async function deleteAdminHomepageSectionOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
): Promise<{ deletedId: string }> {
  const context = await requireAal2Permission(request, AdminPermissions.CMS_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const coreIds = new Set(["sec-hero", "sec-featured", "sec-projects", "sec-cta"]);
  if (coreIds.has(id.trim())) {
    throw new Error(`Validation Error: Core homepage section "${id}" cannot be deleted. You may disable it instead.`);
  }

  const existing = await prisma.homepageSection.findUnique({
    where: { id: id.trim() },
  });
  if (!existing) {
    throw new Error(`Not Found: Homepage section "${id}" does not exist`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.homepageSection.delete({
      where: { id: id.trim() },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "HOMEPAGE_SECTION_DELETED",
        module: "HOMEPAGE_CMS",
        entityId: id.trim(),
        metadata: { name: existing.name },
      },
    });
  });

  return { deletedId: id.trim() };
}

// =========================================================================
// 2. PUBLIC HOMEPAGE OPERATIONS (No Auth Required)
// =========================================================================

/**
 * Retrieves enabled homepage sections for public rendering.
 */
export async function getPublicHomepageSectionsOperation(
  prismaClient?: PrismaClient
): Promise<{ sections: HomepageSectionWithMedia[] }> {
  const prisma = prismaClient || (await getPrisma());

  await ensureDefaultHomepageSections(prisma);

  const sections = await prisma.homepageSection.findMany({
    where: { enabled: true },
    include: { mediaAsset: true },
    orderBy: { displayOrder: "asc" },
  });

  return { sections };
}
