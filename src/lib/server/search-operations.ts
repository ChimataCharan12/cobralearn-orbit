import type { PrismaClient } from "@prisma/client";
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

export type GlobalSearchCategory =
  | "projects"
  | "websites"
  | "advertisements"
  | "awards"
  | "media"
  | "messages"
  | "settings";

export interface GlobalSearchResultItem {
  id: string;
  category: GlobalSearchCategory;
  title: string;
  subtitle: string;
  badge?: string | null;
  url: string;
  metadata?: Record<string, unknown>;
}

export interface GlobalSearchResultGroup {
  category: GlobalSearchCategory;
  label: string;
  items: GlobalSearchResultItem[];
}

export interface GlobalSearchResponse {
  query: string;
  groups: GlobalSearchResultGroup[];
  totalCount: number;
}

// Static Admin Navigation, Appearance & Settings Index for Instant Command Palette Discovery
const SETTINGS_SECTIONS_INDEX: Array<{
  id: string;
  title: string;
  subtitle: string;
  keywords: string[];
  url: string;
}> = [
  // Site Settings tabs
  {
    id: "settings-general",
    title: "Site Settings — General",
    subtitle: "Brand identity, website title, slogan, and metadata",
    keywords: ["general", "settings", "title", "slogan", "brand", "logo", "favicon", "site", "cobra", "cobralearn"],
    url: "/admin/settings?tab=general",
  },
  {
    id: "settings-seo",
    title: "Site Settings — SEO",
    subtitle: "Search engine tags, open graph, robots, and meta descriptions",
    keywords: ["seo", "meta", "search", "google", "robots", "sitemap", "keywords", "open graph"],
    url: "/admin/settings?tab=seo",
  },
  {
    id: "settings-integrations",
    title: "Site Settings — Integrations",
    subtitle: "Third-party APIs, webhooks, and analytics connectors",
    keywords: ["integrations", "api", "webhooks", "connectors", "third party"],
    url: "/admin/settings?tab=integrations",
  },
  {
    id: "settings-email",
    title: "Site Settings — Email Notifications",
    subtitle: "Email templates, automated alerts, and delivery preferences",
    keywords: ["email", "notifications", "alerts", "templates", "smtp", "mail"],
    url: "/admin/settings?tab=email",
  },
  {
    id: "settings-security",
    title: "Site Settings — Security",
    subtitle: "Session duration, password policies, and access controls",
    keywords: ["security", "password", "sessions", "access", "auth", "login"],
    url: "/admin/settings?tab=security",
  },
  {
    id: "settings-analytics",
    title: "Site Settings — Analytics",
    subtitle: "Audience traffic, visitor metrics, and telemetry",
    keywords: ["analytics", "traffic", "telemetry", "visitors", "views", "metrics"],
    url: "/admin/settings?tab=analytics",
  },
  {
    id: "settings-maintenance",
    title: "Site Settings — Maintenance",
    subtitle: "Maintenance mode banner, bypass tokens, and downtime controls",
    keywords: ["maintenance", "mode", "downtime", "bypass", "offline"],
    url: "/admin/settings?tab=maintenance",
  },
  {
    id: "settings-advanced",
    title: "Site Settings — Advanced",
    subtitle: "Data export, database backups, and developer tools",
    keywords: ["advanced", "backup", "export", "database", "data portability"],
    url: "/admin/settings?tab=advanced",
  },

  // Appearance tabs
  {
    id: "appearance-theme",
    title: "Appearance — Theme & Colors",
    subtitle: "Accent color palette, neon glows, and dark mode customization",
    keywords: ["appearance", "theme", "colors", "accent", "glow", "emerald", "cyan", "violet"],
    url: "/admin/appearance?tab=theme-colors",
  },
  {
    id: "appearance-typography",
    title: "Appearance — Typography",
    subtitle: "Display headers, body font styles, and reading scales",
    keywords: ["appearance", "typography", "fonts", "orbitron", "oxanium", "rajdhani"],
    url: "/admin/appearance?tab=typography",
  },
  {
    id: "appearance-animations",
    title: "Appearance — Animations",
    subtitle: "Transitions, hover micro-interactions, and motion intensity",
    keywords: ["appearance", "animations", "motion", "transitions", "effects"],
    url: "/admin/appearance?tab=animations",
  },
  {
    id: "appearance-branding",
    title: "Appearance — Branding & Logos",
    subtitle: "Hero logo upload, custom favicon, and showcase emblems",
    keywords: ["appearance", "branding", "logo", "emblem", "favicon"],
    url: "/admin/appearance?tab=branding",
  },

  // Profile tabs
  {
    id: "profile-info",
    title: "Admin Profile — Personal Information",
    subtitle: "Full name, avatar, bio, and contact designation",
    keywords: ["profile", "account", "name", "avatar", "bio", "designation"],
    url: "/admin/profile?tab=info",
  },
  {
    id: "profile-security",
    title: "Admin Profile — Password & Security",
    subtitle: "Password update, active sessions, and multi-factor setup",
    keywords: ["profile", "password", "security", "credentials"],
    url: "/admin/profile?tab=security",
  },
  {
    id: "profile-preferences",
    title: "Admin Profile — Notification & Language Preferences",
    subtitle: "Language preference (Hindi, Spanish, etc.), in-app notification toggles",
    keywords: ["preferences", "language", "notifications", "hindi", "spanish", "french", "german"],
    url: "/admin/profile?tab=preferences",
  },
  {
    id: "profile-activity",
    title: "Admin Profile — Audit Activity Log",
    subtitle: "Historical action timeline and session event logs",
    keywords: ["audit", "logs", "activity", "history", "timeline"],
    url: "/admin/profile?tab=activity",
  },

  // Direct Admin Hub Pages
  {
    id: "hub-dashboard",
    title: "Dashboard",
    subtitle: "Administrative home, live metrics, and quick actions",
    keywords: ["dashboard", "home", "metrics", "overview", "quick actions"],
    url: "/admin/dashboard",
  },
  {
    id: "hub-notifications",
    title: "Notifications Center",
    subtitle: "View and filter in-app alerts, inquiries, and content updates",
    keywords: ["notifications", "alerts", "inbox", "bell", "unread"],
    url: "/admin/notifications",
  },
  {
    id: "hub-media",
    title: "Media Library",
    subtitle: "Manage uploaded images, videos, banners, and documents",
    keywords: ["media", "library", "images", "videos", "uploads", "assets"],
    url: "/admin/media",
  },
  {
    id: "hub-homepage",
    title: "Homepage Management",
    subtitle: "Configure homepage showcase sections and featured items",
    keywords: ["homepage", "sections", "cms", "hero", "showcase"],
    url: "/admin/homepage",
  },
  {
    id: "hub-navigation",
    title: "Navigation & Footer",
    subtitle: "Header links, footer columns, and social menu buttons",
    keywords: ["navigation", "footer", "menus", "links", "navbar"],
    url: "/admin/navigation",
  },
  {
    id: "hub-contact-config",
    title: "Contact Page Configuration",
    subtitle: "Contact information, FAQs, and inquiry form settings",
    keywords: ["contact", "faqs", "form", "inquiries", "phone", "email", "support"],
    url: "/admin/contact",
  },
  {
    id: "hub-contact-messages",
    title: "Contact Messages & Inquiries",
    subtitle: "Review incoming visitor messages and send email replies",
    keywords: ["messages", "inbox", "inquiries", "visitor", "feedback", "leads"],
    url: "/admin/contact/messages",
  },
];

/**
 * Executes a server-side, multi-module search across authorized CMS records,
 * Media assets, Contact inquiries (RBAC protected), and administrative pages.
 */
export async function searchGlobalAdminOperation(
  request: Request,
  query: string,
  prismaClient?: PrismaClient
): Promise<GlobalSearchResponse> {
  // 1. Authenticate identity (Fail Closed)
  const context = await requireAdminProfile(request, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const sanitizedQuery = (query || "").trim();
  if (sanitizedQuery.length < 2) {
    return { query: sanitizedQuery, groups: [], totalCount: 0 };
  }

  // Prevent unbounded query execution
  const boundedQuery = sanitizedQuery.slice(0, 100);
  const qLower = boundedQuery.toLowerCase();
  const limitPerCategory = 6;

  // 2. Query CMS Content & Media Assets in parallel
  const [projects, websites, ads, awards, media] = await Promise.all([
    // Projects
    prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: boundedQuery, mode: "insensitive" } },
          { description: { contains: boundedQuery, mode: "insensitive" } },
          { category: { contains: boundedQuery, mode: "insensitive" } },
        ],
      },
      take: limitPerCategory,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        status: true,
      },
    }),

    // Websites
    prisma.website.findMany({
      where: {
        OR: [
          { name: { contains: boundedQuery, mode: "insensitive" } },
          { description: { contains: boundedQuery, mode: "insensitive" } },
          { category: { contains: boundedQuery, mode: "insensitive" } },
          { url: { contains: boundedQuery, mode: "insensitive" } },
        ],
      },
      take: limitPerCategory,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        status: true,
        url: true,
      },
    }),

    // Advertisements
    prisma.advertisement.findMany({
      where: {
        OR: [
          { name: { contains: boundedQuery, mode: "insensitive" } },
          { campaign: { contains: boundedQuery, mode: "insensitive" } },
          { brand: { contains: boundedQuery, mode: "insensitive" } },
          { description: { contains: boundedQuery, mode: "insensitive" } },
        ],
      },
      take: limitPerCategory,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        campaign: true,
        brand: true,
        description: true,
        status: true,
      },
    }),

    // Awards
    prisma.award.findMany({
      where: {
        OR: [
          { name: { contains: boundedQuery, mode: "insensitive" } },
          { organization: { contains: boundedQuery, mode: "insensitive" } },
          { context: { contains: boundedQuery, mode: "insensitive" } },
          { category: { contains: boundedQuery, mode: "insensitive" } },
          { description: { contains: boundedQuery, mode: "insensitive" } },
        ],
      },
      take: limitPerCategory,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        organization: true,
        context: true,
        category: true,
        status: true,
      },
    }),

    // Media Assets
    prisma.mediaAsset.findMany({
      where: {
        OR: [
          { name: { contains: boundedQuery, mode: "insensitive" } },
          { originalFilename: { contains: boundedQuery, mode: "insensitive" } },
          { altText: { contains: boundedQuery, mode: "insensitive" } },
          { description: { contains: boundedQuery, mode: "insensitive" } },
        ],
      },
      take: limitPerCategory,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        originalFilename: true,
        mediaType: true,
        category: true,
        mimeType: true,
      },
    }),
  ]);

  // 3. Contact Messages query (Strictly RBAC-Restricted to users with CONTACT_READ)
  let contactMessages: Array<{
    id: string;
    fullName: string;
    email: string;
    subject: string;
    message: string;
    status: string;
  }> = [];

  const canReadContact = canPerform(context.profile.role, AdminPermissions.CONTACT_READ);
  if (canReadContact && typeof prisma.contactMessage?.findMany === "function") {
    contactMessages = await prisma.contactMessage.findMany({
      where: {
        OR: [
          { fullName: { contains: boundedQuery, mode: "insensitive" } },
          { email: { contains: boundedQuery, mode: "insensitive" } },
          { subject: { contains: boundedQuery, mode: "insensitive" } },
          { message: { contains: boundedQuery, mode: "insensitive" } },
        ],
      },
      take: limitPerCategory,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        subject: true,
        message: true,
        status: true,
      },
    });
  }

  // 4. Match Settings & System Pages
  const matchedSettings = SETTINGS_SECTIONS_INDEX.filter((section) => {
    return (
      section.title.toLowerCase().includes(qLower) ||
      section.subtitle.toLowerCase().includes(qLower) ||
      section.keywords.some((k) => k.includes(qLower) || qLower.includes(k))
    );
  }).slice(0, limitPerCategory);

  // 5. Structure into categories
  const groups: GlobalSearchResultGroup[] = [];

  if (projects.length > 0) {
    groups.push({
      category: "projects",
      label: "Projects",
      items: projects.map((p) => ({
        id: p.id,
        category: "projects",
        title: p.name,
        subtitle: p.description?.slice(0, 90) || p.category || "Project record",
        badge: p.status,
        url: `/admin/projects/edit?id=${p.id}`,
      })),
    });
  }

  if (websites.length > 0) {
    groups.push({
      category: "websites",
      label: "Websites",
      items: websites.map((w) => ({
        id: w.id,
        category: "websites",
        title: w.name,
        subtitle: w.url || w.description?.slice(0, 90) || "Website record",
        badge: w.status,
        url: `/admin/websites/edit?id=${w.id}`,
      })),
    });
  }

  if (ads.length > 0) {
    groups.push({
      category: "advertisements",
      label: "Advertisements",
      items: ads.map((a) => ({
        id: a.id,
        category: "advertisements",
        title: a.name,
        subtitle: a.campaign ? `Campaign: ${a.campaign}` : a.brand || "Advertisement",
        badge: a.status,
        url: `/admin/advertisements/edit?id=${a.id}`,
      })),
    });
  }

  if (awards.length > 0) {
    groups.push({
      category: "awards",
      label: "Awards & Achievements",
      items: awards.map((aw) => ({
        id: aw.id,
        category: "awards",
        title: aw.name,
        subtitle: aw.organization ? `${aw.organization} — ${aw.context || ""}` : aw.category,
        badge: aw.status,
        url: `/admin/awards/edit?id=${aw.id}`,
      })),
    });
  }

  if (media.length > 0) {
    groups.push({
      category: "media",
      label: "Media Assets",
      items: media.map((m) => ({
        id: m.id,
        category: "media",
        title: m.name || m.originalFilename,
        subtitle: `${m.category} • ${m.mimeType || m.mediaType}`,
        badge: m.mediaType,
        url: "/admin/media",
      })),
    });
  }

  if (contactMessages.length > 0) {
    groups.push({
      category: "messages",
      label: "Contact Messages",
      items: contactMessages.map((msg) => ({
        id: msg.id,
        category: "messages",
        title: msg.fullName,
        subtitle: `${msg.subject} — ${msg.message?.slice(0, 60)}...`,
        badge: msg.status,
        url: "/admin/contact/messages",
      })),
    });
  }

  if (matchedSettings.length > 0) {
    groups.push({
      category: "settings",
      label: "Settings & Administration",
      items: matchedSettings.map((s) => ({
        id: s.id,
        category: "settings",
        title: s.title,
        subtitle: s.subtitle,
        badge: "Settings",
        url: s.url,
      })),
    });
  }

  const totalCount = groups.reduce((acc, g) => acc + g.items.length, 0);

  return {
    query: boundedQuery,
    groups,
    totalCount,
  };
}
