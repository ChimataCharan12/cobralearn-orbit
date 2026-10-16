import type {
  PrismaClient,
  NavigationItem,
  FooterSection,
  FooterLink,
  GlobalSocialLink,
  NavItemType,
  NavItemStatus,
} from "@prisma/client";
import { AdminPermissions } from "@/lib/auth/rbac";
import { requirePermission } from "@/lib/auth/server-auth";
import {
  INITIAL_NAV_ITEMS,
  INITIAL_FOOTER_SECTIONS,
} from "@/lib/navigation-data";

let defaultPrisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient> {
  if (!defaultPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

export type FooterSectionWithLinks = FooterSection & {
  links: FooterLink[];
};

export interface CreateNavItemPayload {
  label: string;
  link: string;
  type?: "Internal" | "External" | "Button" | NavItemType;
  status?: "Active" | "Inactive" | NavItemStatus;
  iconName?: string | null;
  openInNewTab?: boolean;
  buttonStyle?: string | null;
}

export interface UpdateNavItemPayload {
  label?: string;
  link?: string;
  type?: "Internal" | "External" | "Button" | NavItemType;
  status?: "Active" | "Inactive" | NavItemStatus;
  iconName?: string | null;
  openInNewTab?: boolean;
  buttonStyle?: string | null;
}

export interface FooterLinkInput {
  id?: string;
  label: string;
  url: string;
  openInNewTab?: boolean;
  displayOrder?: number;
}

export interface CreateFooterSectionPayload {
  title: string;
  iconName?: string | null;
  isVisible?: boolean;
  links?: FooterLinkInput[];
}

export interface UpdateFooterSectionPayload {
  title?: string;
  iconName?: string | null;
  isVisible?: boolean;
  links?: FooterLinkInput[];
}

export interface CreateSocialLinkPayload {
  platform: string;
  url: string;
  iconName?: string | null;
  handle?: string | null;
  isEnabled?: boolean;
}

export interface UpdateSocialLinkPayload {
  platform?: string;
  url?: string;
  iconName?: string | null;
  handle?: string | null;
  isEnabled?: boolean;
}

/**
 * Validates and sanitizes a URL or link destination to reject dangerous schemes.
 */
export function validateSafeLink(link: string, fieldName = "Link"): string {
  if (!link || !link.trim()) {
    throw new Error(`Validation Error: ${fieldName} is required`);
  }
  const trimmed = link.trim();
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

function normalizeType(type?: string): NavItemType {
  if (!type) return "INTERNAL";
  const upper = type.toUpperCase();
  if (upper === "EXTERNAL") return "EXTERNAL";
  if (upper === "BUTTON") return "BUTTON";
  return "INTERNAL";
}

function normalizeStatus(status?: string): NavItemStatus {
  if (!status) return "ACTIVE";
  const upper = status.toUpperCase();
  if (upper === "INACTIVE") return "INACTIVE";
  return "ACTIVE";
}

/**
 * Idempotently seeds default Navigation, Footer sections, and Social links if tables are empty.
 */
export async function ensureDefaultNavigationAndFooter(prisma: PrismaClient): Promise<void> {
  const [navCount, footerCount, socialCount] = await Promise.all([
    prisma.navigationItem.count(),
    prisma.footerSection.count(),
    prisma.globalSocialLink.count(),
  ]);

  // If any navigation/footer configuration already exists, do not re-seed tables
  // that may have been intentionally emptied by an administrator.
  if (navCount > 0 || footerCount > 0 || socialCount > 0) {
    return;
  }

  if (navCount === 0) {
    for (const item of INITIAL_NAV_ITEMS) {
      await prisma.navigationItem.upsert({
        where: { id: item.id },
        update: {},
        create: {
          id: item.id,
          label: item.label,
          link: item.link,
          type: normalizeType(item.type),
          status: normalizeStatus(item.status),
          iconName: item.iconName || null,
          openInNewTab: Boolean(item.openInNewTab),
          buttonStyle: item.buttonStyle || null,
          displayOrder: item.order,
        },
      });
    }
  }

  if (footerCount === 0) {
    for (let i = 0; i < INITIAL_FOOTER_SECTIONS.length; i++) {
      const sec = INITIAL_FOOTER_SECTIONS[i];
      const existing = await prisma.footerSection.findUnique({ where: { id: sec.id } });
      if (!existing) {
        await prisma.footerSection.create({
          data: {
            id: sec.id,
            title: sec.title,
            iconName: sec.iconName || null,
            displayOrder: i + 1,
            isVisible: true,
            links: {
              create: sec.links.map((link, linkIdx) => ({
                label: link.label,
                url: link.url,
                displayOrder: linkIdx + 1,
                openInNewTab: false,
              })),
            },
          },
        });
      }
    }
  }

  if (socialCount === 0) {
    const defaultSocials = [
      { id: "soc-1", platform: "LinkedIn", url: "https://linkedin.com", iconName: "Linkedin", displayOrder: 1 },
      { id: "soc-2", platform: "GitHub", url: "https://github.com", iconName: "Github", displayOrder: 2 },
      { id: "soc-3", platform: "YouTube", url: "https://youtube.com", iconName: "Youtube", displayOrder: 3 },
      { id: "soc-4", platform: "X (Twitter)", url: "https://x.com", iconName: "Twitter", displayOrder: 4 },
      { id: "soc-5", platform: "Instagram", url: "https://instagram.com", iconName: "Instagram", displayOrder: 5 },
    ];
    for (const soc of defaultSocials) {
      await prisma.globalSocialLink.upsert({
        where: { id: soc.id },
        update: {},
        create: {
          id: soc.id,
          platform: soc.platform,
          url: soc.url,
          iconName: soc.iconName,
          displayOrder: soc.displayOrder,
          isEnabled: true,
        },
      });
    }
  }
}

// =========================================================================
// 1. ADMIN PROTECTED NAVIGATION OPERATIONS (RBAC Enforced)
// =========================================================================

export async function listAdminNavigationOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<{
  navItems: NavigationItem[];
  footerSections: FooterSectionWithLinks[];
  socialLinks: GlobalSocialLink[];
}> {
  await requirePermission(request, AdminPermissions.CMS_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  await ensureDefaultNavigationAndFooter(prisma);

  const [navItems, footerSections, socialLinks] = await Promise.all([
    prisma.navigationItem.findMany({
      orderBy: { displayOrder: "asc" },
    }),
    prisma.footerSection.findMany({
      include: {
        links: {
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.globalSocialLink.findMany({
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  return { navItems, footerSections, socialLinks };
}

export async function createAdminNavItemOperation(
  request: Request,
  payload: CreateNavItemPayload,
  prismaClient?: PrismaClient
): Promise<{ navItem: NavigationItem }> {
  const context = await requirePermission(request, AdminPermissions.CMS_CREATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.label || !payload.label.trim()) {
    throw new Error("Validation Error: Navigation item label is required");
  }
  const link = validateSafeLink(payload.link, "Navigation Link / URL");

  const lastItem = await prisma.navigationItem.findFirst({
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  const displayOrder = (lastItem?.displayOrder ?? 0) + 1;
  const newId = `nav-${Date.now()}`;

  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.navigationItem.create({
      data: {
        id: newId,
        label: payload.label.trim(),
        link,
        type: normalizeType(payload.type as string),
        status: normalizeStatus(payload.status as string),
        iconName: payload.iconName?.trim() || null,
        openInNewTab: Boolean(payload.openInNewTab),
        buttonStyle: payload.buttonStyle?.trim() || null,
        displayOrder,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "NAV_ITEM_CREATED",
        module: "NAVIGATION_CMS",
        entityId: item.id,
        metadata: { label: item.label, link: item.link },
      },
    });

    return item;
  });

  return { navItem: created };
}

export async function updateAdminNavItemOperation(
  request: Request,
  id: string,
  payload: UpdateNavItemPayload,
  prismaClient?: PrismaClient
): Promise<{ navItem: NavigationItem }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!id || !id.trim()) {
    throw new Error("Validation Error: Navigation item ID is required");
  }

  const existing = await prisma.navigationItem.findUnique({
    where: { id: id.trim() },
  });
  if (!existing) {
    throw new Error(`Not Found: Navigation item "${id}" does not exist`);
  }

  if (payload.label !== undefined && (!payload.label || !payload.label.trim())) {
    throw new Error("Validation Error: Navigation item label cannot be empty");
  }
  const link = payload.link !== undefined ? validateSafeLink(payload.link, "Navigation Link / URL") : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.navigationItem.update({
      where: { id: id.trim() },
      data: {
        ...(payload.label !== undefined && { label: payload.label.trim() }),
        ...(link !== undefined && { link }),
        ...(payload.type !== undefined && { type: normalizeType(payload.type as string) }),
        ...(payload.status !== undefined && { status: normalizeStatus(payload.status as string) }),
        ...(payload.iconName !== undefined && { iconName: payload.iconName?.trim() || null }),
        ...(payload.openInNewTab !== undefined && { openInNewTab: Boolean(payload.openInNewTab) }),
        ...(payload.buttonStyle !== undefined && { buttonStyle: payload.buttonStyle?.trim() || null }),
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "NAV_ITEM_UPDATED",
        module: "NAVIGATION_CMS",
        entityId: item.id,
        metadata: { label: item.label, status: item.status },
      },
    });

    return item;
  });

  return { navItem: updated };
}

export async function deleteAdminNavItemOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
): Promise<{ deletedId: string }> {
  const context = await requirePermission(request, AdminPermissions.CMS_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const existing = await prisma.navigationItem.findUnique({
    where: { id: id.trim() },
  });
  if (!existing) {
    throw new Error(`Not Found: Navigation item "${id}" does not exist`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.navigationItem.delete({
      where: { id: id.trim() },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "NAV_ITEM_DELETED",
        module: "NAVIGATION_CMS",
        entityId: id.trim(),
        metadata: { label: existing.label },
      },
    });
  });

  return { deletedId: id.trim() };
}

export async function reorderAdminNavItemsOperation(
  request: Request,
  orderedIds: string[],
  prismaClient?: PrismaClient
): Promise<{ success: boolean }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error("Validation Error: orderedIds must be a non-empty array");
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (typeof id === "string" && id.trim()) {
        await tx.navigationItem.update({
          where: { id: id.trim() },
          data: { displayOrder: i + 1 },
        });
      }
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "NAV_ITEMS_REORDERED",
        module: "NAVIGATION_CMS",
        metadata: { count: orderedIds.length },
      },
    });
  });

  return { success: true };
}

// =========================================================================
// 2. ADMIN PROTECTED FOOTER OPERATIONS (RBAC Enforced)
// =========================================================================

export async function createAdminFooterSectionOperation(
  request: Request,
  payload: CreateFooterSectionPayload,
  prismaClient?: PrismaClient
): Promise<{ section: FooterSectionWithLinks }> {
  const context = await requirePermission(request, AdminPermissions.CMS_CREATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.title || !payload.title.trim()) {
    throw new Error("Validation Error: Footer section title is required");
  }

  const lastSec = await prisma.footerSection.findFirst({
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  const displayOrder = (lastSec?.displayOrder ?? 0) + 1;
  const newId = `footer-${Date.now()}`;

  const created = await prisma.$transaction(async (tx) => {
    const sec = await tx.footerSection.create({
      data: {
        id: newId,
        title: payload.title.trim(),
        iconName: payload.iconName?.trim() || "Info",
        isVisible: payload.isVisible !== undefined ? Boolean(payload.isVisible) : true,
        displayOrder,
        links: {
          create: (payload.links || []).map((l, idx) => ({
            label: l.label.trim(),
            url: validateSafeLink(l.url, `Link "${l.label}" URL`),
            openInNewTab: Boolean(l.openInNewTab),
            displayOrder: idx + 1,
          })),
        },
      },
      include: { links: { orderBy: { displayOrder: "asc" } } },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "FOOTER_SECTION_CREATED",
        module: "FOOTER_CMS",
        entityId: sec.id,
        metadata: { title: sec.title },
      },
    });

    return sec;
  });

  return { section: created };
}

export async function updateAdminFooterSectionOperation(
  request: Request,
  id: string,
  payload: UpdateFooterSectionPayload,
  prismaClient?: PrismaClient
): Promise<{ section: FooterSectionWithLinks }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!id || !id.trim()) {
    throw new Error("Validation Error: Footer section ID is required");
  }

  const existing = await prisma.footerSection.findUnique({
    where: { id: id.trim() },
    include: { links: true },
  });
  if (!existing) {
    throw new Error(`Not Found: Footer section "${id}" does not exist`);
  }

  if (payload.title !== undefined && (!payload.title || !payload.title.trim())) {
    throw new Error("Validation Error: Footer section title cannot be empty");
  }

  const updated = await prisma.$transaction(async (tx) => {
    // 1. Update section details
    await tx.footerSection.update({
      where: { id: id.trim() },
      data: {
        ...(payload.title !== undefined && { title: payload.title.trim() }),
        ...(payload.iconName !== undefined && { iconName: payload.iconName?.trim() || null }),
        ...(payload.isVisible !== undefined && { isVisible: Boolean(payload.isVisible) }),
      },
    });

    // 2. Synchronize links if provided
    if (payload.links !== undefined) {
      // Remove previous links and insert new links
      await tx.footerLink.deleteMany({
        where: { footerSectionId: id.trim() },
      });

      if (payload.links.length > 0) {
        await tx.footerLink.createMany({
          data: payload.links.map((l, idx) => ({
            footerSectionId: id.trim(),
            label: l.label.trim(),
            url: validateSafeLink(l.url, `Link "${l.label}" URL`),
            openInNewTab: Boolean(l.openInNewTab),
            displayOrder: idx + 1,
          })),
        });
      }
    }

    const full = await tx.footerSection.findUnique({
      where: { id: id.trim() },
      include: { links: { orderBy: { displayOrder: "asc" } } },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "FOOTER_SECTION_UPDATED",
        module: "FOOTER_CMS",
        entityId: id.trim(),
        metadata: { title: full?.title },
      },
    });

    return full!;
  });

  return { section: updated };
}

export async function deleteAdminFooterSectionOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
): Promise<{ deletedId: string }> {
  const context = await requirePermission(request, AdminPermissions.CMS_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const existing = await prisma.footerSection.findUnique({
    where: { id: id.trim() },
  });
  if (!existing) {
    throw new Error(`Not Found: Footer section "${id}" does not exist`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.footerSection.delete({
      where: { id: id.trim() },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "FOOTER_SECTION_DELETED",
        module: "FOOTER_CMS",
        entityId: id.trim(),
        metadata: { title: existing.title },
      },
    });
  });

  return { deletedId: id.trim() };
}

export async function reorderAdminFooterSectionsOperation(
  request: Request,
  orderedIds: string[],
  prismaClient?: PrismaClient
): Promise<{ success: boolean }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error("Validation Error: orderedIds must be a non-empty array");
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (typeof id === "string" && id.trim()) {
        await tx.footerSection.update({
          where: { id: id.trim() },
          data: { displayOrder: i + 1 },
        });
      }
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "FOOTER_SECTIONS_REORDERED",
        module: "FOOTER_CMS",
        metadata: { count: orderedIds.length },
      },
    });
  });

  return { success: true };
}

// =========================================================================
// 2.5 ADMIN SOCIAL LINKS OPERATIONS (RBAC Enforced)
// =========================================================================

export async function createAdminSocialLinkOperation(
  request: Request,
  payload: CreateSocialLinkPayload,
  prismaClient?: PrismaClient
): Promise<{ socialLink: GlobalSocialLink }> {
  const context = await requirePermission(request, AdminPermissions.CMS_CREATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.platform || !payload.platform.trim()) {
    throw new Error("Validation Error: Platform name is required");
  }
  const url = validateSafeLink(payload.url, `Social Link "${payload.platform}" URL`);

  const lastSocial = await prisma.globalSocialLink.findFirst({
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  const displayOrder = (lastSocial?.displayOrder ?? 0) + 1;
  const newId = `soc-${Date.now()}`;

  const created = await prisma.$transaction(async (tx) => {
    const link = await tx.globalSocialLink.create({
      data: {
        id: newId,
        platform: payload.platform.trim(),
        url,
        iconName: payload.iconName?.trim() || payload.platform.trim(),
        handle: payload.handle?.trim() || null,
        isEnabled: payload.isEnabled !== undefined ? Boolean(payload.isEnabled) : true,
        displayOrder,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "SOCIAL_LINK_CREATED",
        module: "NAVIGATION_CMS",
        entityId: link.id,
        metadata: { platform: link.platform, url: link.url },
      },
    });

    return link;
  });

  return { socialLink: created };
}

export async function updateAdminSocialLinkOperation(
  request: Request,
  id: string,
  payload: UpdateSocialLinkPayload,
  prismaClient?: PrismaClient
): Promise<{ socialLink: GlobalSocialLink }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!id || !id.trim()) {
    throw new Error("Validation Error: Social link ID is required");
  }

  const existing = await prisma.globalSocialLink.findUnique({
    where: { id: id.trim() },
  });
  if (!existing) {
    throw new Error(`Not Found: Social link "${id}" does not exist`);
  }

  if (payload.platform !== undefined && (!payload.platform || !payload.platform.trim())) {
    throw new Error("Validation Error: Platform name cannot be empty");
  }

  const url = payload.url !== undefined
    ? validateSafeLink(payload.url, `Social Link "${payload.platform || existing.platform}" URL`)
    : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const link = await tx.globalSocialLink.update({
      where: { id: id.trim() },
      data: {
        ...(payload.platform !== undefined && { platform: payload.platform.trim() }),
        ...(url !== undefined && { url }),
        ...(payload.iconName !== undefined && { iconName: payload.iconName?.trim() || "Globe" }),
        ...(payload.handle !== undefined && { handle: payload.handle?.trim() || null }),
        ...(payload.isEnabled !== undefined && { isEnabled: Boolean(payload.isEnabled) }),
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "SOCIAL_LINK_UPDATED",
        module: "NAVIGATION_CMS",
        entityId: link.id,
        metadata: { platform: link.platform },
      },
    });

    return link;
  });

  return { socialLink: updated };
}

export async function deleteAdminSocialLinkOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
): Promise<{ deletedId: string }> {
  const context = await requirePermission(request, AdminPermissions.CMS_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const existing = await prisma.globalSocialLink.findUnique({
    where: { id: id.trim() },
  });
  if (!existing) {
    throw new Error(`Not Found: Social link "${id}" does not exist`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.globalSocialLink.delete({
      where: { id: id.trim() },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "SOCIAL_LINK_DELETED",
        module: "NAVIGATION_CMS",
        entityId: id.trim(),
        metadata: { platform: existing.platform },
      },
    });
  });

  return { deletedId: id.trim() };
}

export async function reorderAdminSocialLinksOperation(
  request: Request,
  orderedIds: string[],
  prismaClient?: PrismaClient
): Promise<{ success: boolean }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error("Validation Error: orderedIds must be a non-empty array");
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (typeof id === "string" && id.trim()) {
        await tx.globalSocialLink.update({
          where: { id: id.trim() },
          data: { displayOrder: i + 1 },
        });
      }
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "SOCIAL_LINKS_REORDERED",
        module: "NAVIGATION_CMS",
        metadata: { count: orderedIds.length },
      },
    });
  });

  return { success: true };
}

// =========================================================================
// 3. PUBLIC NAVIGATION & FOOTER OPERATIONS (No Auth Required)
// =========================================================================

export async function getPublicNavigationAndFooterOperation(
  prismaClient?: PrismaClient
): Promise<{
  navItems: NavigationItem[];
  footerSections: FooterSectionWithLinks[];
  socialLinks: GlobalSocialLink[];
}> {
  const prisma = prismaClient || (await getPrisma());

  await ensureDefaultNavigationAndFooter(prisma);

  const [navItems, footerSections, socialLinks] = await Promise.all([
    prisma.navigationItem.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.footerSection.findMany({
      where: { isVisible: true },
      include: {
        links: { orderBy: { displayOrder: "asc" } },
      },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.globalSocialLink.findMany({
      where: { isEnabled: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  return { navItems, footerSections, socialLinks };
}
