import type { AdminRole } from "@prisma/client";

/**
 * CobraLearn InnoTechCore — Centralized Role-Based Access Control (RBAC) Permissions
 *
 * Defines explicit action-level permissions across all CMS, Media, Contact,
 * Appearance, Settings, Audit, and Governance domains.
 */
export const AdminPermissions = {
  // CMS Content Domains (Projects, Websites, Advertisements, Awards, Homepage, Navigation, Footer)
  CMS_CREATE: "cms:create",
  CMS_READ: "cms:read",
  CMS_UPDATE: "cms:update",
  CMS_DELETE: "cms:delete",

  // Media Library
  MEDIA_UPLOAD: "media:upload",
  MEDIA_READ: "media:read",
  MEDIA_UPDATE: "media:update",
  MEDIA_DELETE: "media:delete",

  // Contact Messages & Inquiries
  CONTACT_READ: "contact:read",
  CONTACT_UPDATE: "contact:update",
  CONTACT_DELETE: "contact:delete",

  // Global Site Configuration
  SETTINGS_READ: "settings:read",
  SETTINGS_UPDATE: "settings:update",

  // Appearance & Theme Customization
  APPEARANCE_READ: "appearance:read",
  APPEARANCE_UPDATE: "appearance:update",

  // Administrator & Governance Management
  ADMIN_READ: "admin:read",
  ADMIN_MANAGE: "admin:manage",
  ROLE_ASSIGN: "role:assign",

  // Audit Logs & Security Observability
  AUDIT_LOG_READ: "audit_log:read",
} as const;

export type AdminPermission = (typeof AdminPermissions)[keyof typeof AdminPermissions];

/**
 * Authoritative Permission Assignment Matrix per Role.
 *
 * Roles Hierarchy:
 * - SUPER_ADMIN: Full unrestricted administrative control over all domains.
 * - ADMIN: Content creation, deletion, media management, appearance, contact management, and audit log inspection. Cannot manage other admins or change master site settings.
 * - EDITOR: Content and media creation & editing. Read-only on contact, settings, and appearance. Cannot delete content/media or access audit logs.
 */
const ROLE_PERMISSIONS: Record<AdminRole, Set<AdminPermission>> = {
  SUPER_ADMIN: new Set<AdminPermission>(Object.values(AdminPermissions)),

  ADMIN: new Set<AdminPermission>([
    AdminPermissions.CMS_CREATE,
    AdminPermissions.CMS_READ,
    AdminPermissions.CMS_UPDATE,
    AdminPermissions.CMS_DELETE,
    AdminPermissions.MEDIA_UPLOAD,
    AdminPermissions.MEDIA_READ,
    AdminPermissions.MEDIA_UPDATE,
    AdminPermissions.MEDIA_DELETE,
    AdminPermissions.CONTACT_READ,
    AdminPermissions.CONTACT_UPDATE,
    AdminPermissions.CONTACT_DELETE,
    AdminPermissions.SETTINGS_READ,
    AdminPermissions.APPEARANCE_READ,
    AdminPermissions.APPEARANCE_UPDATE,
    AdminPermissions.ADMIN_READ,
    AdminPermissions.AUDIT_LOG_READ,
  ]),

  EDITOR: new Set<AdminPermission>([
    AdminPermissions.CMS_CREATE,
    AdminPermissions.CMS_READ,
    AdminPermissions.CMS_UPDATE,
    AdminPermissions.MEDIA_UPLOAD,
    AdminPermissions.MEDIA_READ,
    AdminPermissions.MEDIA_UPDATE,
    AdminPermissions.CONTACT_READ,
    AdminPermissions.SETTINGS_READ,
    AdminPermissions.APPEARANCE_READ,
  ]),
};

/**
 * Evaluates whether a given administrative role has permission to execute an action.
 */
export function canPerform(role: AdminRole, permission: AdminPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.has(permission);
}

/**
 * Returns all assigned permissions for a given role.
 */
export function getRolePermissions(role: AdminRole): AdminPermission[] {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return [];
  return Array.from(permissions);
}
