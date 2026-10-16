import type { PrismaClient, AdminNotification, AdminProfile, AdminRole } from "@prisma/client";
import { requireAdminProfile } from "@/lib/auth/server-auth";
import { mergeWithDefaultPreferences, type AdminPreferences } from "@/lib/preferences";

let defaultPrisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient> {
  if (!defaultPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

export type NotificationCategory =
  | "CONTACT_INQUIRY"
  | "CONTENT_UPDATE"
  | "SECURITY_ALERT"
  | "ADMIN_ACTIVITY"
  | "SYSTEM_ANNOUNCEMENT";

export interface CreateNotificationParams {
  category: NotificationCategory;
  title: string;
  message: string;
  link?: string | null;
  eventKey?: string | null;
  excludeActorId?: string | null;
  targetAdminId?: string | null;
  targetRoles?: AdminRole[] | null;
}

/**
 * Retrieves the authenticated administrator's notifications and unread count.
 * Restricts query strictly to the verified administrator ID from the session.
 */
export async function getSelfNotificationsOperation(
  request: Request,
  options?: { limit?: number; unreadOnly?: boolean; category?: string },
  prismaClient?: PrismaClient
): Promise<{ notifications: AdminNotification[]; unreadCount: number }> {
  const context = await requireAdminProfile(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());
  const adminId = context.profile.id;

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const unreadOnly = Boolean(options?.unreadOnly);
  const categoryFilter = options?.category && options.category !== "ALL" ? options.category : undefined;

  const [notifications, unreadCount] = await Promise.all([
    prisma.adminNotification.findMany({
      where: {
        adminId,
        ...(unreadOnly ? { isRead: false } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.adminNotification.count({
      where: {
        adminId,
        isRead: false,
      },
    }),
  ]);

  return { notifications, unreadCount };
}

/**
 * Marks a specific notification as read, enforcing strict recipient scoping.
 */
export async function markNotificationReadOperation(
  request: Request,
  notificationId: string,
  prismaClient?: PrismaClient
): Promise<{ success: true; notification: AdminNotification }> {
  const context = await requireAdminProfile(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!notificationId || typeof notificationId !== "string") {
    throw new Error("Validation Error: notificationId must be a non-empty string");
  }

  const existing = await prisma.adminNotification.findUnique({
    where: { id: notificationId },
  });

  if (!existing) {
    throw new Error("Not Found: Notification does not exist");
  }

  if (existing.adminId !== context.profile.id) {
    throw new Error("Forbidden: You are not authorized to modify this notification");
  }

  const updated = await prisma.adminNotification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return { success: true, notification: updated };
}

/**
 * Marks all unread notifications as read for the authenticated administrator.
 */
export async function markAllNotificationsReadOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<{ success: true; count: number }> {
  const context = await requireAdminProfile(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const result = await prisma.adminNotification.updateMany({
    where: {
      adminId: context.profile.id,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return { success: true, count: result.count };
}

/**
 * Creates database-backed in-app notifications for authorized administrators
 * whose saved preferences opt-in to the specific category.
 *
 * Designed to be resilient: errors are caught and logged so notification creation
 * never disrupts or fails the primary application operation.
 */
export async function createNotificationEvent(
  params: CreateNotificationParams,
  prismaClient?: PrismaClient
): Promise<number> {
  try {
    let prisma = prismaClient;
    if (!prisma || typeof prisma.adminProfile?.findMany !== "function") {
      try {
        const defaultPrismaClient = await getPrisma();
        if (defaultPrismaClient && typeof defaultPrismaClient.adminProfile?.findMany === "function") {
          prisma = defaultPrismaClient;
        }
      } catch {
        // fallback to provided client
      }
    }

    if (!prisma?.adminProfile || typeof prisma.adminProfile.findMany !== "function") {
      return 0;
    }

    // 1. Fetch active administrators
    let admins: AdminProfile[] = [];
    if (params.targetAdminId) {
      const target = await prisma.adminProfile.findUnique({
        where: { id: params.targetAdminId },
      });
      if (target && target.isActive) {
        admins = [target];
      }
    } else {
      admins = await prisma.adminProfile.findMany({
        where: {
          isActive: true,
          ...(params.targetRoles && params.targetRoles.length > 0
            ? { role: { in: params.targetRoles } }
            : {}),
        },
      });
    }

    if (admins.length === 0) return 0;

    // 2. Filter recipients based on saved preferences & exclusion criteria
    const eligibleAdminIds: string[] = [];

    for (const admin of admins) {
      if (params.excludeActorId && admin.id === params.excludeActorId) {
        continue;
      }

      const prefs: AdminPreferences = mergeWithDefaultPreferences(admin.preferences);
      let isOptedIn = false;

      switch (params.category) {
        case "CONTACT_INQUIRY":
          isOptedIn = prefs.notifications.contactInquiries;
          break;
        case "CONTENT_UPDATE":
          isOptedIn = prefs.notifications.contentUpdates;
          break;
        case "SECURITY_ALERT":
          isOptedIn = prefs.notifications.securityAlerts;
          break;
        case "ADMIN_ACTIVITY":
          isOptedIn = prefs.notifications.adminActivities;
          break;
        case "SYSTEM_ANNOUNCEMENT":
          isOptedIn = prefs.notifications.systemAnnouncements;
          break;
        default:
          isOptedIn = true;
      }

      if (isOptedIn) {
        eligibleAdminIds.push(admin.id);
      }
    }

    if (eligibleAdminIds.length === 0) return 0;

    // 3. Create notifications, deduplicating against eventKey if provided
    let createdCount = 0;

    for (const adminId of eligibleAdminIds) {
      if (params.eventKey) {
        const existing = await prisma.adminNotification.findFirst({
          where: {
            adminId,
            eventKey: params.eventKey,
          },
        });
        if (existing) {
          continue; // Already notified for this event
        }
      }

      await prisma.adminNotification.create({
        data: {
          adminId,
          category: params.category,
          title: params.title.slice(0, 200),
          message: params.message.slice(0, 1000),
          link: params.link ? params.link.slice(0, 500) : null,
          eventKey: params.eventKey ? params.eventKey.slice(0, 100) : null,
        },
      });
      createdCount++;
    }

    return createdCount;
  } catch (err: unknown) {
    // Fail-safe: Notification delivery errors must never corrupt underlying business logic
    console.warn("[NotificationEvent] Failed to dispatch in-app notification:", err);
    return 0;
  }
}
