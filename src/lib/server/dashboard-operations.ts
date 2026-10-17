import type { PrismaClient, AdminRole } from "@prisma/client";
import { requireAdminProfile } from "@/lib/auth/server-auth";
import { canPerform, AdminPermissions } from "@/lib/auth/rbac";

let defaultPrisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient> {
  if (!defaultPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

export interface MetricBreakdown {
  total: number;
  published: number;
  draft: number;
  current30Days: number;
  prev30Days: number;
  delta: number;
  comparisonText: string;
}

export interface DashboardStats {
  projects: MetricBreakdown;
  websites: MetricBreakdown;
  advertisements: MetricBreakdown;
  awards: MetricBreakdown;
}

export interface DashboardActivityItem {
  id: string;
  title: string;
  item: string;
  time: string;
  img: string | null;
  dot: "green" | "red" | "muted";
}

export interface DashboardRecentProject {
  id: string;
  name: string;
  tags: string[];
  status: "Published" | "Draft";
  img: string;
}

export interface DashboardRecentItem {
  id: string;
  name: string;
  status: "Published" | "Draft";
  img: string;
}

export interface DashboardMediaStats {
  totalFiles: number;
  totalBytes: number;
  formattedText: string;
}

export interface DashboardWebsiteStatus {
  siteUrl: string;
  statusLabel: string;
  statusSubtext: string;
  lastUpdatedText: string;
  isConfigured?: boolean;
}

/**
 * Validates that a string is a valid HTTP or HTTPS URL.
 */
export function isValidHttpUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export interface DashboardDataResult {
  stats: DashboardStats;
  recentActivity: DashboardActivityItem[];
  recentProjects: DashboardRecentProject[];
  recentAdvertisements: DashboardRecentItem[];
  recentAwards: DashboardRecentItem[];
  mediaStats: DashboardMediaStats;
  websiteStatus: DashboardWebsiteStatus;
  userRole: AdminRole;
}

/**
 * Safely formats raw byte counts into human-readable units (B, KB, MB, GB, TB).
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return "0 MB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = (bytes / Math.pow(1024, i)).toFixed(i >= 2 ? 1 : 0);
  return `${val} ${units[i]}`;
}

/**
 * Formats a Date into a relative or clean timestamp string.
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Just now";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Formats full timestamp for the "Last Updated" display.
 */
export function formatFullTimestamp(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Humanizes audit log action codes into clean UI labels.
 */
export function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    PROJECT_CREATE: "Project Created",
    PROJECT_UPDATE: "Project Updated",
    PROJECT_DELETE: "Project Deleted",
    WEBSITE_CREATE: "Website Created",
    WEBSITE_UPDATE: "Website Updated",
    WEBSITE_DELETE: "Website Deleted",
    ADVERTISEMENT_CREATE: "Advertisement Created",
    ADVERTISEMENT_UPDATE: "Advertisement Updated",
    ADVERTISEMENT_DELETE: "Advertisement Deleted",
    AWARD_CREATE: "Award Created",
    AWARD_UPDATE: "Award Updated",
    AWARD_DELETE: "Award Deleted",
    MEDIA_UPLOAD: "Media Uploaded",
    MEDIA_DELETE: "Media Deleted",
    PROFILE_UPDATE: "Profile Updated",
    AVATAR_UPDATE: "Avatar Updated",
    AVATAR_REMOVE: "Avatar Removed",
    LOGIN: "Administrator Signed In",
    PASSWORD_CHANGE: "Password Changed",
    ADMIN_STATUS_UPDATE: "Admin Status Changed",
    ROLE_ASSIGN: "Role Reassigned",
    "auth:password_changed": "Password Changed",
    "auth:password_reset_requested": "Password Reset Requested",
    "auth:password_reset_completed": "Password Reset Completed",
    "auth:password_reset_completion_failed": "Password Reset Completion Failed",
    "auth:recovery_codes_generated": "Recovery Codes Generated",
    "auth:recovery_code_redeemed": "Recovery Code Redeemed",
    "auth:recovery_code_redeem_failed": "Recovery Code Redemption Failed",
    "auth:recovery_code_throttled": "Recovery Code Throttled",
    "auth:login_throttled": "Login Throttled",
    "auth:recovery_throttled": "Recovery Throttled",
  };

  if (map[action]) return map[action];

  return action
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Computes a standardized 30-day vs preceding 30-day delta and comparison label.
 */
function computeComparisonText(current30Days: number, prev30Days: number, delta: number): string {
  if (current30Days === 0 && prev30Days === 0) {
    return "0 new in last 30d";
  }
  if (delta > 0) {
    return `+${delta} vs prev 30d`;
  }
  if (delta < 0) {
    return `${delta} vs prev 30d`;
  }
  return `+0 vs prev 30d (${current30Days} new)`;
}

/**
 * Calculates metrics and 30-day comparisons for an entity table.
 */
async function getEntityBreakdown(
  table: {
    count: (args?: any) => Promise<number>;
  },
  now: Date,
  thirtyDaysAgo: Date,
  sixtyDaysAgo: Date
): Promise<MetricBreakdown> {
  const [total, published, draft, current30Days, prev30Days] = await Promise.all([
    table.count(),
    table.count({ where: { status: "PUBLISHED" } }),
    table.count({ where: { status: "DRAFT" } }),
    table.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    table.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
  ]);

  const delta = current30Days - prev30Days;
  const comparisonText = computeComparisonText(current30Days, prev30Days, delta);

  return {
    total,
    published,
    draft,
    current30Days,
    prev30Days,
    delta,
    comparisonText,
  };
}

/**
 * Core server operation: Aggregates real PostgreSQL data for the Admin Dashboard.
 * Enforces authentication and role-based activity scoping.
 */
export async function getDashboardDataOperation(
  request: Request,
  prismaClient?: PrismaClient
): Promise<DashboardDataResult> {
  // 1. Authenticate administrator identity
  const { profile } = await requireAdminProfile(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // 2. Parallel aggregation of statistics across all 4 content domains
  const [projectsStats, websitesStats, adsStats, awardsStats] = await Promise.all([
    getEntityBreakdown(prisma.project, now, thirtyDaysAgo, sixtyDaysAgo),
    getEntityBreakdown(prisma.website, now, thirtyDaysAgo, sixtyDaysAgo),
    getEntityBreakdown(prisma.advertisement, now, thirtyDaysAgo, sixtyDaysAgo),
    getEntityBreakdown(prisma.award, now, thirtyDaysAgo, sixtyDaysAgo),
  ]);

  // 3. Parallel query for recent showcase content (limit 3 each)
  const [recentProjectsRaw, recentAdsRaw, recentAwardsRaw] = await Promise.all([
    prisma.project.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      include: { thumbnail: true },
    }),
    prisma.advertisement.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      include: { thumbnail: true },
    }),
    prisma.award.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      include: { thumbnail: true },
    }),
  ]);

  const recentProjects: DashboardRecentProject[] = recentProjectsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    tags: Array.isArray(p.tags) ? p.tags : [],
    status: p.status === "PUBLISHED" ? "Published" : "Draft",
    img: p.thumbnail?.publicUrl || "",
  }));

  const recentAdvertisements: DashboardRecentItem[] = recentAdsRaw.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status === "PUBLISHED" ? "Published" : "Draft",
    img: a.thumbnail?.publicUrl || "",
  }));

  const recentAwards: DashboardRecentItem[] = recentAwardsRaw.map((aw) => ({
    id: aw.id,
    name: aw.name,
    status: aw.status === "PUBLISHED" ? "Published" : "Draft",
    img: aw.thumbnail?.publicUrl || "",
  }));

  // 4. Media telemetry calculation
  const [mediaCount, mediaSizeAggregate] = await Promise.all([
    prisma.mediaAsset.count(),
    prisma.mediaAsset.aggregate({
      _sum: { fileSize: true },
    }),
  ]);

  const totalFiles = mediaCount;
  const totalBytes = Number(mediaSizeAggregate._sum.fileSize || 0n);
  const fileUnit = totalFiles === 1 ? "file" : "files";
  const mediaStats: DashboardMediaStats = {
    totalFiles,
    totalBytes,
    formattedText: `${totalFiles} ${fileUnit} (${formatBytes(totalBytes)})`,
  };

  // 5. Website status and latest content update
  const [siteSettings, latestProj, latestWeb, latestAd, latestAw] = await Promise.all([
    prisma.siteSettings.findUnique({ where: { id: "default" } }),
    prisma.project.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: "desc" } }),
    prisma.website.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: "desc" } }),
    prisma.advertisement.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: "desc" } }),
    prisma.award.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: "desc" } }),
  ]);

  const rawSiteUrl = siteSettings?.siteUrl?.trim();
  const isConfigured = isValidHttpUrl(rawSiteUrl);
  const siteUrl = isConfigured ? rawSiteUrl! : "";

  const candidateDates = [
    siteSettings?.updatedAt?.getTime(),
    latestProj?.updatedAt?.getTime(),
    latestWeb?.updatedAt?.getTime(),
    latestAd?.updatedAt?.getTime(),
    latestAw?.updatedAt?.getTime(),
  ].filter((t): t is number => typeof t === "number" && !isNaN(t));

  const maxUpdatedTime = candidateDates.length > 0 ? Math.max(...candidateDates) : null;
  const lastUpdatedText = maxUpdatedTime
    ? formatFullTimestamp(new Date(maxUpdatedTime))
    : "No content updates yet";

  const websiteStatus: DashboardWebsiteStatus = {
    siteUrl,
    statusLabel: isConfigured ? "Showcase Configured" : "Not Configured",
    statusSubtext: isConfigured
      ? "Showcase URL is configured and active in site settings."
      : "Showcase URL has not been configured in site settings.",
    lastUpdatedText,
    isConfigured,
  };

  // 6. Role-aware Recent Activity query
  // SUPER_ADMIN and ADMIN get global activity if they have AUDIT_LOG_READ.
  // EDITOR only receives their own self-scoped activity.
  const hasGlobalAuditAccess = canPerform(profile.role, AdminPermissions.AUDIT_LOG_READ);

  const rawAuditLogs = await prisma.adminAuditLog.findMany({
    where: hasGlobalAuditAccess ? {} : { actorId: profile.id },
    take: 8,
    orderBy: { createdAt: "desc" },
  });

  const recentActivity: DashboardActivityItem[] = rawAuditLogs.map((log) => {
    let itemName = log.module || "System";
    let img: string | null = null;

    if (log.metadata && typeof log.metadata === "object") {
      const meta = log.metadata as Record<string, unknown>;
      if (typeof meta.name === "string" && meta.name.trim()) {
        itemName = meta.name.trim();
      } else if (typeof meta.title === "string" && meta.title.trim()) {
        itemName = meta.title.trim();
      } else if (typeof meta.email === "string" && meta.email.trim()) {
        itemName = meta.email.trim();
      }
      if (typeof meta.thumbnailUrl === "string" && meta.thumbnailUrl.trim()) {
        img = meta.thumbnailUrl.trim();
      } else if (typeof meta.avatarUrl === "string" && meta.avatarUrl.trim()) {
        img = meta.avatarUrl.trim();
      }
    }

    const actionUpper = log.action.toUpperCase();
    let dot: "green" | "red" | "muted" = "muted";
    if (actionUpper.includes("DELETE") || actionUpper.includes("ARCHIVE") || actionUpper.includes("REMOVE")) {
      dot = "red";
    } else if (
      actionUpper.includes("CREATE") ||
      actionUpper.includes("PUBLISH") ||
      actionUpper.includes("UPDATE") ||
      actionUpper.includes("UPLOAD")
    ) {
      dot = "green";
    }

    return {
      id: log.id,
      title: humanizeAction(log.action),
      item: itemName,
      time: formatRelativeTime(log.createdAt, now),
      img,
      dot,
    };
  });

  return {
    stats: {
      projects: projectsStats,
      websites: websitesStats,
      advertisements: adsStats,
      awards: awardsStats,
    },
    recentActivity,
    recentProjects,
    recentAdvertisements,
    recentAwards,
    mediaStats,
    websiteStatus,
    userRole: profile.role,
  };
}
