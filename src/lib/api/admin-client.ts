import type { AdminProfile, AdminRole, AdminAuditLog, SiteSettings, AppearanceConfig, AdminNotification, AdminLoginHistory } from "@prisma/client";
import {
  getGlobalSettingsServerFn,
  updateGlobalSettingsServerFn,
  getAppearanceConfigServerFn,
  updateAppearanceConfigServerFn,
  getSettingsEnvironmentStatusServerFn,
  getPublicSiteSettingsServerFn,
  getPublicAppearanceConfigServerFn,
  type SettingsEnvironmentStatus,
} from "@/lib/server/settings-server-fns";
import {
  type PublicSiteSettings,
  DEFAULT_PUBLIC_SITE_SETTINGS,
} from "@/lib/public-metadata";
import {
  type PublicAppearanceConfig,
  DEFAULT_PUBLIC_APPEARANCE_CONFIG,
} from "@/lib/public-appearance";
export type { SettingsEnvironmentStatus, PublicSiteSettings, PublicAppearanceConfig };
import { supabase } from "@/lib/supabase/browser";
import {
  getSelfProfileServerFn,
  updateSelfProfileServerFn,
  updateSelfPreferencesServerFn,
  uploadAvatarServerFn,
  listTeamProfilesServerFn,
  updateAdminStatusServerFn,
  assignAdminRoleServerFn,
  getAuditLogsServerFn,
  getSelfAuditLogsServerFn,
  recordLoginHistoryServerFn,
  getSelfLoginHistoryServerFn,
} from "@/lib/server/profile-server-fns";
import {
  getSelfNotificationsServerFn,
  markNotificationReadServerFn,
  markAllNotificationsReadServerFn,
} from "@/lib/server/notification-server-fns";
import { searchGlobalAdminServerFn } from "@/lib/server/search-server-fns";
import type { GlobalSearchResponse, GlobalSearchResultItem, GlobalSearchResultGroup } from "@/lib/server/search-operations";
export type { GlobalSearchResponse, GlobalSearchResultItem, GlobalSearchResultGroup };
import type { UpdatePreferencesPayload, AdminPreferences } from "@/lib/preferences";
import { getDashboardDataServerFn } from "@/lib/server/dashboard-server-fns";
import type { DashboardDataResult } from "@/lib/server/dashboard-operations";
export type { DashboardDataResult };
import type {
  UpdateSelfProfilePayload,
  UploadAvatarPayload,
  UpdateSiteSettingsInput,
  UpdateAppearanceConfigInput,
  RecordLoginResult,
  GetSelfLoginHistoryResult,
} from "@/lib/server/admin-operations";
export type { UploadAvatarPayload, UpdateSiteSettingsInput, UpdateAppearanceConfigInput, RecordLoginResult, GetSelfLoginHistoryResult };
import type {
  ProjectWithMedia,
  CreateProjectPayload,
  UpdateProjectPayload,
} from "@/lib/server/projects-operations";
import {
  listAdminProjectsServerFn,
  getAdminProjectByIdServerFn,
  createAdminProjectServerFn,
  updateAdminProjectServerFn,
  deleteAdminProjectServerFn,
  reorderAdminProjectsServerFn,
  getPublicProjectsServerFn,
  getPublicProjectBySlugServerFn,
} from "@/lib/server/projects-server-fns";
import type {
  WebsiteWithMedia,
  CreateWebsitePayload,
  UpdateWebsitePayload,
} from "@/lib/server/websites-operations";
import {
  listAdminWebsitesServerFn,
  getAdminWebsiteByIdServerFn,
  createAdminWebsiteServerFn,
  updateAdminWebsiteServerFn,
  deleteAdminWebsiteServerFn,
  reorderAdminWebsitesServerFn,
  getPublicWebsitesServerFn,
  getPublicWebsiteBySlugServerFn,
} from "@/lib/server/websites-server-fns";
import type {
  AdvertisementWithMedia,
  CreateAdvertisementPayload,
  UpdateAdvertisementPayload,
} from "@/lib/server/advertisements-operations";
import {
  listAdminAdvertisementsServerFn,
  getAdminAdvertisementByIdServerFn,
  createAdminAdvertisementServerFn,
  updateAdminAdvertisementServerFn,
  deleteAdminAdvertisementServerFn,
  reorderAdminAdvertisementsServerFn,
  getPublicAdvertisementsServerFn,
  getPublicAdvertisementBySlugServerFn,
} from "@/lib/server/advertisements-server-fns";
import type {
  AwardWithMedia,
  CreateAwardPayload,
  UpdateAwardPayload,
} from "@/lib/server/awards-operations";
import {
  listAdminAwardsServerFn,
  getAdminAwardByIdServerFn,
  createAdminAwardServerFn,
  updateAdminAwardServerFn,
  deleteAdminAwardServerFn,
  reorderAdminAwardsServerFn,
  getPublicAwardsServerFn,
  getPublicAwardBySlugServerFn,
} from "@/lib/server/awards-server-fns";
import type { MediaAsset } from "@prisma/client";
import type { UploadMediaPayload, ListMediaOptions, UpdateMediaPayload, DeleteMediaResult } from "@/lib/server/media-operations";
export type { DeleteMediaResult };
import {
  uploadAdminMediaServerFn,
  listAdminMediaServerFn,
  getAdminMediaByIdServerFn,
  deleteAdminMediaServerFn,
  updateAdminMediaServerFn,
} from "@/lib/server/media-server-fns";
import type {
  HomepageSectionWithMedia,
  CreateHomepageSectionPayload,
  UpdateHomepageSectionPayload,
} from "@/lib/server/homepage-operations";
import {
  listAdminHomepageSectionsServerFn,
  updateAdminHomepageSectionServerFn,
  createAdminHomepageSectionServerFn,
  reorderAdminHomepageSectionsServerFn,
  deleteAdminHomepageSectionServerFn,
  getPublicHomepageSectionsServerFn,
} from "@/lib/server/homepage-server-fns";
import type {
  FooterSectionWithLinks,
  CreateNavItemPayload,
  UpdateNavItemPayload,
  CreateFooterSectionPayload,
  UpdateFooterSectionPayload,
  CreateSocialLinkPayload,
  UpdateSocialLinkPayload,
} from "@/lib/server/navigation-operations";
import {
  listAdminNavigationServerFn,
  createAdminNavItemServerFn,
  updateAdminNavItemServerFn,
  deleteAdminNavItemServerFn,
  reorderAdminNavItemsServerFn,
  createAdminFooterSectionServerFn,
  updateAdminFooterSectionServerFn,
  deleteAdminFooterSectionServerFn,
  reorderAdminFooterSectionsServerFn,
  createAdminSocialLinkServerFn,
  updateAdminSocialLinkServerFn,
  deleteAdminSocialLinkServerFn,
  reorderAdminSocialLinksServerFn,
  getPublicNavigationAndFooterServerFn,
} from "@/lib/server/navigation-server-fns";
import type { NavigationItem, GlobalSocialLink, ContactMessage } from "@prisma/client";
import type {
  UpdateContactConfigPayload,
  CreateHighlightPayload,
  UpdateHighlightPayload,
  CreateFaqPayload,
  UpdateFaqPayload,
  CreateSocialLinkPayload as CreateContactSocialLinkPayload,
  UpdateSocialLinkPayload as UpdateContactSocialLinkPayload,
  SubmitContactMessagePayload,
  ListMessagesFilter,
} from "@/lib/server/contact-operations";
import {
  getAdminContactConfigServerFn,
  updateAdminContactConfigServerFn,
  listAdminContactHighlightsServerFn,
  createAdminContactHighlightServerFn,
  updateAdminContactHighlightServerFn,
  deleteAdminContactHighlightServerFn,
  reorderAdminContactHighlightsServerFn,
  listAdminContactFaqsServerFn,
  createAdminContactFaqServerFn,
  updateAdminContactFaqServerFn,
  deleteAdminContactFaqServerFn,
  reorderAdminContactFaqsServerFn,
  listAdminContactSocialLinksServerFn,
  createAdminContactSocialLinkServerFn,
  updateAdminContactSocialLinkServerFn,
  deleteAdminContactSocialLinkServerFn,
  reorderAdminContactSocialLinksServerFn,
  listAdminContactMessagesServerFn,
  getAdminContactMessageDetailServerFn,
  updateAdminContactMessageStatusServerFn,
  deleteAdminContactMessageServerFn,
  bulkUpdateAdminContactMessageStatusServerFn,
  bulkDeleteAdminContactMessagesServerFn,
  sendAdminContactMessageReplyServerFn,
  listAdminContactMessageRepliesServerFn,
  getPublicContactConfigServerFn,
  submitPublicContactMessageServerFn,
} from "@/lib/server/contact-server-fns";


import {
  evaluateLoginRateLimitServerFn,
  requestPasswordResetServerFn,
} from "@/lib/server/auth-rate-limit-server-fns";
import { handleAuthError } from "@/lib/auth/auth-error-handling";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function formatClientErrorMessage(err: unknown, defaultMessage: string): string {
  handleAuthError(err);
  if (err instanceof Error) {
    if (
      err.message.includes("No cookie header provided") ||
      err.message.includes("No valid Supabase session") ||
      err.message.startsWith("Unauthorized")
    ) {
      return "Unauthorized: Valid administrative session required";
    }
    return err.message;
  }
  return defaultMessage;
}

async function getAuthToken(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  } catch {
    return undefined;
  }
}

/**
 * Creates an authenticated Request object using the current Supabase session token.
 */
async function createAuthenticatedRequest(url: string, method: string = "GET", body?: unknown): Promise<Request> {
  let token: string | undefined;

  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  } catch (err) {
    // In SSR or test environments, session might be null or handled via cookies
  }

  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const init: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

if (typeof window !== "undefined") {
  const w = window as any;
  w.process = w.process || { env: {} };
  w.process.env = w.process.env || {};
  if (!w.process.env.TSS_SERVER_FN_BASE) {
    w.process.env.TSS_SERVER_FN_BASE = "/_serverFn/";
  }
}

/**
 * Normalizes and executes client RPC requests, handling missing/undefined server function bases.
 */
async function rpcFetchFallback(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
  if (urlStr.includes("undefinedeyJ") || urlStr.startsWith("undefined")) {
    urlStr = urlStr.replace(/^.*?undefined/, "/_serverFn/");
  }
  return fetch(urlStr, init);
}

/**
 * Client-side interface to call administrative server operations.
 */
export const adminClient = {
  // =========================================================================
  // IDENTITY & GOVERNANCE
  // =========================================================================

  /**
   * Pre-flight evaluation of login rate limits (per-IP, global, and per-account HMAC).
   * Supports peek: true to inspect cooldown without incrementing attempts.
   */
  async evaluateLoginRateLimit(
    email: string,
    options?: { peek?: boolean }
  ): Promise<ApiResponse<{ allowed: boolean; message?: string; retryAfterSeconds?: number }>> {
    try {
      if (process.env.VITEST && !process.env.TEST_WITH_SERVER) {
        const { evaluateLoginRateLimitOperation } = await import("@/lib/server/auth-rate-limit-operations");
        const req = new Request("https://api.internal/auth/rate-limit/login", {
          method: "POST",
          headers: { "x-real-ip": "127.0.0.1" },
        });
        const result = await evaluateLoginRateLimitOperation(req, { email, peek: options?.peek });
        return { success: true, data: result };
      }

      const result = await evaluateLoginRateLimitServerFn({
        data: { email, peek: options?.peek },
        fetch: rpcFetchFallback as any,
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Rate limit evaluation failed");
      return { success: false, error: message };
    }
  },

  /**
   * Re-evaluates login eligibility without consuming an attempt (peek mode).
   */
  async checkLoginEligibility(
    email: string
  ): Promise<ApiResponse<{ allowed: boolean; message?: string; retryAfterSeconds?: number }>> {
    return this.evaluateLoginRateLimit(email, { peek: true });
  },

  /**
   * Dispatches password recovery request with server-enforced rate limiting and generic response.
   */
  async requestPasswordReset(email: string, redirectTo?: string): Promise<ApiResponse<{ message: string }>> {
    try {
      if (process.env.VITEST && !process.env.TEST_WITH_SERVER) {
        const { requestPasswordResetOperation } = await import("@/lib/server/auth-rate-limit-operations");
        const req = new Request("https://api.internal/auth/rate-limit/recovery", {
          method: "POST",
          headers: { "x-real-ip": "127.0.0.1" },
        });
        const result = await requestPasswordResetOperation(req, { email, redirectTo });
        return { success: true, data: result };
      }

      const result = await requestPasswordResetServerFn({
        data: { email, redirectTo },
        fetch: rpcFetchFallback as any,
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to submit password reset request");
      return { success: false, error: message };
    }
  },

  /**
   * Loads the verified AdminProfile for the authenticated session.
   */
  async getSelfProfile(): Promise<ApiResponse<AdminProfile>> {
    try {
      const authToken = await getAuthToken();
      const result = await getSelfProfileServerFn({
        data: {
          authToken,
        },
      });
      return { success: true, data: result.profile };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load admin profile");
      return { success: false, error: message };
    }
  },

  /**
   * Updates self-service profile fields in PostgreSQL.
   */
  async updateSelfProfile(payload: UpdateSelfProfilePayload): Promise<ApiResponse<AdminProfile>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateSelfProfileServerFn({
        data: {
          payload,
          authToken,
        },
      });
      return { success: true, data: result.profile };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update profile");
      return { success: false, error: message };
    }
  },

  /**
   * Updates self-service notification and portal preferences in PostgreSQL.
   */
  async updateSelfPreferences(payload: UpdatePreferencesPayload): Promise<ApiResponse<{ preferences: AdminPreferences; profile: AdminProfile }>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateSelfPreferencesServerFn({
        data: {
          payload,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update preferences");
      return { success: false, error: message };
    }
  },

  /**
   * Uploads an avatar image and updates self AdminProfile.avatarUrl.
   */
  async uploadAvatar(payload: UploadAvatarPayload): Promise<ApiResponse<{ avatarUrl: string; profile: AdminProfile }>> {
    try {
      const authToken = await getAuthToken();
      const result = await uploadAvatarServerFn({
        data: {
          payload,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to upload avatar");
      return { success: false, error: message };
    }
  },

  /**
   * Lists all administrative team profiles (Requires ADMIN_READ).
   */
  async listTeamProfiles(): Promise<ApiResponse<Array<Omit<AdminProfile, "avatarUrl" | "bio" | "phone">>>> {
    try {
      const authToken = await getAuthToken();
      const result = await listTeamProfilesServerFn({
        data: {
          authToken,
        },
      });
      return { success: true, data: result.profiles };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load team roster");
      return { success: false, error: message };
    }
  },

  /**
   * Updates active status for an administrator (Requires ADMIN_MANAGE).
   */
  async updateAdminStatus(targetAdminId: string, isActive: boolean): Promise<ApiResponse<{ targetAdminId: string; isActive: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminStatusServerFn({
        data: {
          targetAdminId,
          isActive,
          authToken,
        },
      });
      return { success: true, data: { targetAdminId: result.targetAdminId, isActive: result.isActive } };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update administrator status");
      return { success: false, error: message };
    }
  },

  /**
   * Assigns a new administrative role (Requires ROLE_ASSIGN).
   */
  async assignAdminRole(targetAdminId: string, newRole: AdminRole): Promise<ApiResponse<{ targetAdminId: string; newRole: AdminRole }>> {
    try {
      const authToken = await getAuthToken();
      const result = await assignAdminRoleServerFn({
        data: {
          targetAdminId,
          newRole,
          authToken,
        },
      });
      return { success: true, data: { targetAdminId: result.targetAdminId, newRole: result.newRole } };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to assign administrative role");
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves administrative audit logs (Requires AUDIT_LOG_READ).
   */
  async getAuditLogs(pagination?: { limit?: number; offset?: number }): Promise<ApiResponse<{ logs: AdminAuditLog[]; count: number }>> {
    try {
      const authToken = await getAuthToken();
      const result = await getAuditLogsServerFn({
        data: {
          limit: pagination?.limit,
          offset: pagination?.offset,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load audit logs");
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves self administrative audit logs scoped strictly to authenticated admin.
   * Accessible to any authenticated admin role (SUPER_ADMIN, ADMIN, EDITOR).
   */
  async getSelfAuditLogs(pagination?: { limit?: number; offset?: number }): Promise<ApiResponse<{ logs: AdminAuditLog[]; count: number }>> {
    try {
      const authToken = await getAuthToken();
      const result = await getSelfAuditLogsServerFn({
        data: {
          limit: pagination?.limit,
          offset: pagination?.offset,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load activity logs");
      return { success: false, error: message };
    }
  },

  /**
   * Records a successful administrator login event immediately following authentication.
   */
  async recordLoginHistory(explicitAuthToken?: string): Promise<ApiResponse<RecordLoginResult>> {
    try {
      const authToken = explicitAuthToken || (await getAuthToken());
      const result = await recordLoginHistoryServerFn({
        data: { authToken },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to record login history");
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves self-scoped login history for the authenticated administrator.
   */
  async getSelfLoginHistory(pagination?: { page?: number; limit?: number }): Promise<ApiResponse<GetSelfLoginHistoryResult>> {
    try {
      const authToken = await getAuthToken();
      const result = await getSelfLoginHistoryServerFn({
        data: {
          page: pagination?.page,
          limit: pagination?.limit,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load login history");
      return { success: false, error: message };
    }
  },

  // =========================================================================
  // IN-APP NOTIFICATIONS (TanStack Start Server Function Boundary)
  // =========================================================================

  /**
   * Retrieves persistent in-app notifications and unread count for current administrator.
   */
  async getNotifications(options?: { limit?: number; unreadOnly?: boolean; category?: string }): Promise<ApiResponse<{ notifications: AdminNotification[]; unreadCount: number }>> {
    try {
      const authToken = await getAuthToken();
      const result = await getSelfNotificationsServerFn({
        data: {
          limit: options?.limit,
          unreadOnly: options?.unreadOnly,
          category: options?.category,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load notifications");
      return { success: false, error: message };
    }
  },

  /**
   * Marks a specific notification as read.
   */
  async markNotificationRead(notificationId: string): Promise<ApiResponse<{ notification: AdminNotification }>> {
    try {
      const authToken = await getAuthToken();
      const result = await markNotificationReadServerFn({
        data: {
          notificationId,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to mark notification as read");
      return { success: false, error: message };
    }
  },

  /**
   * Marks all notifications as read for current administrator.
   */
  async markAllNotificationsRead(): Promise<ApiResponse<{ count: number }>> {
    try {
      const authToken = await getAuthToken();
      const result = await markAllNotificationsReadServerFn({
        data: {
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to mark all notifications as read");
      return { success: false, error: message };
    }
  },

  // =========================================================================
  // PROJECTS CMS MODULE (TanStack Start Server Function Boundary)
  // =========================================================================

  /**
   * Lists all projects for admin management (Requires CMS_READ).
   */
  async listAdminProjects(options?: { status?: any; search?: string }): Promise<ApiResponse<ProjectWithMedia[]>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminProjectsServerFn({
        data: {
          status: options?.status,
          search: options?.search,
          authToken,
        },
      });
      return { success: true, data: result.projects };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load projects");
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves a project by ID or Slug for admin editing (Requires CMS_READ).
   */
  async getAdminProject(idOrSlug: string): Promise<ApiResponse<ProjectWithMedia | null>> {
    try {
      const authToken = await getAuthToken();
      const result = await getAdminProjectByIdServerFn({
        data: {
          idOrSlug,
          authToken,
        },
      });
      return { success: true, data: result.project };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load project");
      return { success: false, error: message };
    }
  },

  /**
   * Creates a new project in PostgreSQL (Requires CMS_CREATE).
   */
  async createAdminProject(payload: CreateProjectPayload): Promise<ApiResponse<ProjectWithMedia>> {
    try {
      const authToken = await getAuthToken();
      const result = await createAdminProjectServerFn({
        data: {
          payload,
          authToken,
        },
      });
      return { success: true, data: result.project };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to create project");
      return { success: false, error: message };
    }
  },

  /**
   * Updates an existing project in PostgreSQL (Requires CMS_UPDATE).
   */
  async updateAdminProject(id: string, payload: UpdateProjectPayload): Promise<ApiResponse<ProjectWithMedia>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminProjectServerFn({
        data: {
          id,
          payload,
          authToken,
        },
      });
      return { success: true, data: result.project };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update project");
      return { success: false, error: message };
    }
  },

  /**
   * Deletes a project from PostgreSQL (Requires CMS_DELETE).
   */
  async deleteAdminProject(id: string): Promise<ApiResponse<{ deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminProjectServerFn({
        data: {
          id,
          authToken,
        },
      });
      return { success: true, data: { deletedId: result.deletedId } };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete project");
      return { success: false, error: message };
    }
  },

  /**
   * Reorders projects in PostgreSQL (Requires CMS_UPDATE).
   */
  async reorderAdminProjects(orderedIds: string[]): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await reorderAdminProjectsServerFn({
        data: {
          orderedIds,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to reorder projects");
      return { success: false, error: message };
    }
  },

  // =========================================================================
  // WEBSITES CMS MODULE (TanStack Start Server Function Boundary)
  // =========================================================================

  /**
   * Lists all websites for admin management (Requires CMS_READ).
   */
  async listAdminWebsites(options?: { status?: any; search?: string }): Promise<ApiResponse<WebsiteWithMedia[]>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminWebsitesServerFn({
        data: {
          status: options?.status,
          search: options?.search,
          authToken,
        },
      });
      return { success: true, data: result.websites };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load websites");
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves a website by ID or Slug for admin editing (Requires CMS_READ).
   */
  async getAdminWebsite(idOrSlug: string): Promise<ApiResponse<WebsiteWithMedia | null>> {
    try {
      const authToken = await getAuthToken();
      const result = await getAdminWebsiteByIdServerFn({
        data: {
          idOrSlug,
          authToken,
        },
      });
      return { success: true, data: result.website };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load website");
      return { success: false, error: message };
    }
  },

  /**
   * Creates a new website in PostgreSQL (Requires CMS_CREATE).
   */
  async createAdminWebsite(payload: CreateWebsitePayload): Promise<ApiResponse<WebsiteWithMedia>> {
    try {
      const authToken = await getAuthToken();
      const result = await createAdminWebsiteServerFn({
        data: {
          payload,
          authToken,
        },
      });
      return { success: true, data: result.website };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to create website");
      return { success: false, error: message };
    }
  },

  /**
   * Updates an existing website in PostgreSQL (Requires CMS_UPDATE).
   */
  async updateAdminWebsite(id: string, payload: UpdateWebsitePayload): Promise<ApiResponse<WebsiteWithMedia>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminWebsiteServerFn({
        data: {
          id,
          payload,
          authToken,
        },
      });
      return { success: true, data: result.website };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update website");
      return { success: false, error: message };
    }
  },

  /**
   * Deletes a website from PostgreSQL (Requires CMS_DELETE).
   */
  async deleteAdminWebsite(id: string): Promise<ApiResponse<{ deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminWebsiteServerFn({
        data: {
          id,
          authToken,
        },
      });
      return { success: true, data: { deletedId: result.deletedId } };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete website");
      return { success: false, error: message };
    }
  },

  /**
   * Reorders websites in PostgreSQL (Requires CMS_UPDATE).
   */
  async reorderAdminWebsites(orderedIds: string[]): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await reorderAdminWebsitesServerFn({
        data: {
          orderedIds,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to reorder websites");
      return { success: false, error: message };
    }
  },

  // =========================================================================
  // ADVERTISEMENTS CMS MODULE (TanStack Start Server Function Boundary)
  // =========================================================================

  /**
   * Lists all advertisements for admin management (Requires CMS_READ).
   */
  async listAdminAdvertisements(options?: { status?: any; campaign?: string; search?: string }): Promise<ApiResponse<AdvertisementWithMedia[]>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminAdvertisementsServerFn({
        data: {
          status: options?.status,
          campaign: options?.campaign,
          search: options?.search,
          authToken,
        },
      });
      return { success: true, data: result.advertisements };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load advertisements");
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves an advertisement by ID or Slug for admin editing (Requires CMS_READ).
   */
  async getAdminAdvertisement(idOrSlug: string): Promise<ApiResponse<AdvertisementWithMedia | null>> {
    try {
      const authToken = await getAuthToken();
      const result = await getAdminAdvertisementByIdServerFn({
        data: {
          idOrSlug,
          authToken,
        },
      });
      return { success: true, data: result.advertisement };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load advertisement");
      return { success: false, error: message };
    }
  },

  /**
   * Creates a new advertisement in PostgreSQL (Requires CMS_CREATE).
   */
  async createAdminAdvertisement(payload: CreateAdvertisementPayload): Promise<ApiResponse<AdvertisementWithMedia>> {
    try {
      const authToken = await getAuthToken();
      const result = await createAdminAdvertisementServerFn({
        data: {
          payload,
          authToken,
        },
      });
      return { success: true, data: result.advertisement };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to create advertisement");
      return { success: false, error: message };
    }
  },

  /**
   * Updates an existing advertisement in PostgreSQL (Requires CMS_UPDATE).
   */
  async updateAdminAdvertisement(id: string, payload: UpdateAdvertisementPayload): Promise<ApiResponse<AdvertisementWithMedia>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminAdvertisementServerFn({
        data: {
          id,
          payload,
          authToken,
        },
      });
      return { success: true, data: result.advertisement };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update advertisement");
      return { success: false, error: message };
    }
  },

  /**
   * Deletes an advertisement from PostgreSQL (Requires CMS_DELETE).
   */
  async deleteAdminAdvertisement(id: string): Promise<ApiResponse<{ deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminAdvertisementServerFn({
        data: {
          id,
          authToken,
        },
      });
      return { success: true, data: { deletedId: result.deletedId } };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete advertisement");
      return { success: false, error: message };
    }
  },

  /**
   * Reorders advertisements in PostgreSQL (Requires CMS_UPDATE).
   */
  async reorderAdminAdvertisements(orderedIds: string[]): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await reorderAdminAdvertisementsServerFn({
        data: {
          orderedIds,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to reorder advertisements");
      return { success: false, error: message };
    }
  },

  // =========================================================================
  // AWARDS & ACHIEVEMENTS CMS MODULE (TanStack Start Server Function Boundary)
  // =========================================================================

  /**
   * Lists all awards for admin management (Requires CMS_READ).
   */
  async listAdminAwards(options?: { status?: any; category?: string; search?: string }): Promise<ApiResponse<AwardWithMedia[]>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminAwardsServerFn({
        data: {
          status: options?.status,
          category: options?.category,
          search: options?.search,
          authToken,
        },
      });
      return { success: true, data: result.awards };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load awards");
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves an award by ID or Slug for admin editing (Requires CMS_READ).
   */
  async getAdminAward(idOrSlug: string): Promise<ApiResponse<AwardWithMedia | null>> {
    try {
      const authToken = await getAuthToken();
      const result = await getAdminAwardByIdServerFn({
        data: {
          idOrSlug,
          authToken,
        },
      });
      return { success: true, data: result.award };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load award");
      return { success: false, error: message };
    }
  },

  /**
   * Creates a new award in PostgreSQL (Requires CMS_CREATE).
   */
  async createAdminAward(payload: CreateAwardPayload): Promise<ApiResponse<AwardWithMedia>> {
    try {
      const authToken = await getAuthToken();
      const result = await createAdminAwardServerFn({
        data: {
          payload,
          authToken,
        },
      });
      return { success: true, data: result.award };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to create award");
      return { success: false, error: message };
    }
  },

  /**
   * Updates an existing award in PostgreSQL (Requires CMS_UPDATE).
   */
  async updateAdminAward(id: string, payload: UpdateAwardPayload): Promise<ApiResponse<AwardWithMedia>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminAwardServerFn({
        data: {
          id,
          payload,
          authToken,
        },
      });
      return { success: true, data: result.award };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update award");
      return { success: false, error: message };
    }
  },

  /**
   * Deletes an award from PostgreSQL (Requires CMS_DELETE).
   */
  async deleteAdminAward(id: string): Promise<ApiResponse<{ deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminAwardServerFn({
        data: {
          id,
          authToken,
        },
      });
      return { success: true, data: { deletedId: result.deletedId } };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete award");
      return { success: false, error: message };
    }
  },

  /**
   * Reorders awards in PostgreSQL (Requires CMS_UPDATE).
   */
  async reorderAdminAwards(orderedIds: string[]): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await reorderAdminAwardsServerFn({
        data: {
          orderedIds,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to reorder awards");
      return { success: false, error: message };
    }
  },

  // =========================================================================
  // MEDIA LIBRARY CMS MODULE (TanStack Start Server Function Boundary)
  // =========================================================================

  /**
   * Uploads a media asset to Supabase Storage and records it in PostgreSQL (Requires MEDIA_UPLOAD).
   */
  async uploadMediaAsset(payload: UploadMediaPayload): Promise<ApiResponse<MediaAsset>> {
    try {
      const authToken = await getAuthToken();
      const result = await uploadAdminMediaServerFn({
        data: {
          payload,
          authToken,
        },
      });
      return { success: true, data: result.asset };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to upload media asset");
      return { success: false, error: message };
    }
  },

  /**
   * Lists all media assets for administrative management (Requires MEDIA_READ).
   */
  async listAdminMedia(options?: ListMediaOptions): Promise<ApiResponse<{ assets: MediaAsset[]; totalCount: number }>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminMediaServerFn({
        data: {
          options,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load media assets");
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves a single media asset by ID (Requires MEDIA_READ).
   */
  async getAdminMedia(id: string): Promise<ApiResponse<MediaAsset | null>> {
    try {
      const authToken = await getAuthToken();
      const result = await getAdminMediaByIdServerFn({
        data: {
          id,
          authToken,
        },
      });
      return { success: true, data: result.asset };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load media asset");
      return { success: false, error: message };
    }
  },

  /**
   * Deletes a media asset from PostgreSQL and Supabase Storage (Requires MEDIA_DELETE).
   */
  async deleteAdminMedia(id: string): Promise<ApiResponse<DeleteMediaResult>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminMediaServerFn({
        data: {
          id,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete media asset");
      return { success: false, error: message };
    }
  },

  /**
   * Updates an existing media asset's metadata (Requires MEDIA_UPDATE).
   */
  async updateAdminMedia(id: string, payload: UpdateMediaPayload): Promise<ApiResponse<MediaAsset>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminMediaServerFn({
        data: {
          id,
          payload,
          authToken,
        },
      });
      return { success: true, data: result.asset };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update media asset");
      return { success: false, error: message };
    }
  },

  // =========================================================================
  // PUBLIC SHOWCASE (No Auth Required)
  // =========================================================================

  /**
   * Retrieves published projects for the public showcase website.
   */
  async getPublicProjects(): Promise<ApiResponse<ProjectWithMedia[]>> {
    try {
      const result = await getPublicProjectsServerFn();
      return { success: true, data: result.projects };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load public projects";
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves a single published project by slug for public detail page.
   */
  async getPublicProjectBySlug(slug: string): Promise<ApiResponse<ProjectWithMedia | null>> {
    try {
      const result = await getPublicProjectBySlugServerFn({
        data: { slug },
      });
      return { success: true, data: result.project };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load project details";
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves published websites for the public showcase website.
   */
  async getPublicWebsites(): Promise<ApiResponse<WebsiteWithMedia[]>> {
    try {
      const result = await getPublicWebsitesServerFn();
      return { success: true, data: result.websites };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load public websites";
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves a single published website by slug for public detail page.
   */
  async getPublicWebsiteBySlug(slug: string): Promise<ApiResponse<WebsiteWithMedia | null>> {
    try {
      const result = await getPublicWebsiteBySlugServerFn({
        data: { slug },
      });
      return { success: true, data: result.website };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load website details";
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves published advertisements for the public showcase website.
   */
  async getPublicAdvertisements(options?: { homepageOnly?: boolean }): Promise<ApiResponse<AdvertisementWithMedia[]>> {
    try {
      const result = await getPublicAdvertisementsServerFn({
        data: options,
      });
      return { success: true, data: result.advertisements };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load public advertisements";
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves a single published advertisement by slug for public detail page.
   */
  async getPublicAdvertisementBySlug(slug: string): Promise<ApiResponse<AdvertisementWithMedia | null>> {
    try {
      const result = await getPublicAdvertisementBySlugServerFn({
        data: { slug },
      });
      return { success: true, data: result.advertisement };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load advertisement details";
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves published awards for the public showcase website.
   */
  async getPublicAwards(options?: { homepageOnly?: boolean }): Promise<ApiResponse<AwardWithMedia[]>> {
    try {
      const result = await getPublicAwardsServerFn({
        data: options,
      });
      return { success: true, data: result.awards };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load public awards";
      return { success: false, error: message };
    }
  },

  /**
   * Retrieves a single published award by slug for public detail page.
   */
  async getPublicAwardBySlug(slug: string): Promise<ApiResponse<AwardWithMedia | null>> {
    try {
      const result = await getPublicAwardBySlugServerFn({
        data: { slug },
      });
      return { success: true, data: result.award };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load award details";
      return { success: false, error: message };
    }
  },

  // =========================================================================
  // HOMEPAGE MANAGEMENT MODULE
  // =========================================================================

  async listAdminHomepageSections(): Promise<ApiResponse<HomepageSectionWithMedia[]>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminHomepageSectionsServerFn({ data: { authToken } });
      return { success: true, data: result.sections };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load homepage sections");
      return { success: false, error: message };
    }
  },

  async updateAdminHomepageSection(id: string, payload: UpdateHomepageSectionPayload): Promise<ApiResponse<HomepageSectionWithMedia>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminHomepageSectionServerFn({ data: { id, payload, authToken } });
      return { success: true, data: result.section };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update homepage section");
      return { success: false, error: message };
    }
  },

  async createAdminHomepageSection(payload: CreateHomepageSectionPayload): Promise<ApiResponse<HomepageSectionWithMedia>> {
    try {
      const authToken = await getAuthToken();
      const result = await createAdminHomepageSectionServerFn({ data: { payload, authToken } });
      return { success: true, data: result.section };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to create homepage section");
      return { success: false, error: message };
    }
  },

  async reorderAdminHomepageSections(orderedIds: string[]): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await reorderAdminHomepageSectionsServerFn({ data: { orderedIds, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to reorder homepage sections");
      return { success: false, error: message };
    }
  },

  async deleteAdminHomepageSection(id: string): Promise<ApiResponse<{ deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminHomepageSectionServerFn({ data: { id, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete homepage section");
      return { success: false, error: message };
    }
  },

  async getPublicHomepageSections(): Promise<ApiResponse<HomepageSectionWithMedia[]>> {
    try {
      const result = await getPublicHomepageSectionsServerFn();
      return { success: true, data: result.sections };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load public homepage sections";
      return { success: false, error: message };
    }
  },

  // =========================================================================
  // NAVIGATION & FOOTER MODULE
  // =========================================================================

  async listAdminNavigation(): Promise<ApiResponse<{
    navItems: NavigationItem[];
    footerSections: FooterSectionWithLinks[];
    socialLinks: GlobalSocialLink[];
  }>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminNavigationServerFn({ data: { authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load navigation and footer content");
      return { success: false, error: message };
    }
  },

  async createAdminNavItem(payload: CreateNavItemPayload): Promise<ApiResponse<NavigationItem>> {
    try {
      const authToken = await getAuthToken();
      const result = await createAdminNavItemServerFn({ data: { payload, authToken } });
      return { success: true, data: result.navItem };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to create menu item");
      return { success: false, error: message };
    }
  },

  async updateAdminNavItem(id: string, payload: UpdateNavItemPayload): Promise<ApiResponse<NavigationItem>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminNavItemServerFn({ data: { id, payload, authToken } });
      return { success: true, data: result.navItem };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update menu item");
      return { success: false, error: message };
    }
  },

  async deleteAdminNavItem(id: string): Promise<ApiResponse<{ deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminNavItemServerFn({ data: { id, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete menu item");
      return { success: false, error: message };
    }
  },

  async reorderAdminNavItems(orderedIds: string[]): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await reorderAdminNavItemsServerFn({ data: { orderedIds, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to reorder menu items");
      return { success: false, error: message };
    }
  },

  async createAdminFooterSection(payload: CreateFooterSectionPayload): Promise<ApiResponse<FooterSectionWithLinks>> {
    try {
      const authToken = await getAuthToken();
      const result = await createAdminFooterSectionServerFn({ data: { payload, authToken } });
      return { success: true, data: result.section };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to create footer section");
      return { success: false, error: message };
    }
  },

  async updateAdminFooterSection(id: string, payload: UpdateFooterSectionPayload): Promise<ApiResponse<FooterSectionWithLinks>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminFooterSectionServerFn({ data: { id, payload, authToken } });
      return { success: true, data: result.section };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update footer section");
      return { success: false, error: message };
    }
  },

  async deleteAdminFooterSection(id: string): Promise<ApiResponse<{ deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminFooterSectionServerFn({ data: { id, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete footer section");
      return { success: false, error: message };
    }
  },

  async reorderAdminFooterSections(orderedIds: string[]): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await reorderAdminFooterSectionsServerFn({ data: { orderedIds, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to reorder footer sections");
      return { success: false, error: message };
    }
  },

  async createAdminSocialLink(payload: CreateSocialLinkPayload): Promise<ApiResponse<GlobalSocialLink>> {
    try {
      const authToken = await getAuthToken();
      const result = await createAdminSocialLinkServerFn({ data: { payload, authToken } });
      return { success: true, data: result.socialLink };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to create social link");
      return { success: false, error: message };
    }
  },

  async updateAdminSocialLink(id: string, payload: UpdateSocialLinkPayload): Promise<ApiResponse<GlobalSocialLink>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminSocialLinkServerFn({ data: { id, payload, authToken } });
      return { success: true, data: result.socialLink };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update social link");
      return { success: false, error: message };
    }
  },

  async deleteAdminSocialLink(id: string): Promise<ApiResponse<{ deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminSocialLinkServerFn({ data: { id, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete social link");
      return { success: false, error: message };
    }
  },

  async reorderAdminSocialLinks(orderedIds: string[]): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await reorderAdminSocialLinksServerFn({ data: { orderedIds, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to reorder social links");
      return { success: false, error: message };
    }
  },

  async getPublicNavigationAndFooter(): Promise<ApiResponse<{
    navItems: NavigationItem[];
    footerSections: FooterSectionWithLinks[];
    socialLinks: GlobalSocialLink[];
  }>> {
    try {
      const result = await getPublicNavigationAndFooterServerFn();
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load public navigation";
      return { success: false, error: message };
    }
  },

  // =========================================================================
  // CONTACT MODULE METHODS
  // =========================================================================

  async getAdminContactConfig(): Promise<ApiResponse<any>> {
    try {
      const authToken = await getAuthToken();
      const result = await getAdminContactConfigServerFn({ data: { authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load contact configuration");
      return { success: false, error: message };
    }
  },

  async updateAdminContactConfig(payload: UpdateContactConfigPayload): Promise<ApiResponse<any>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminContactConfigServerFn({ data: { payload, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update contact configuration");
      return { success: false, error: message };
    }
  },

  async listAdminContactHighlights(): Promise<ApiResponse<any[]>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminContactHighlightsServerFn({ data: { authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load highlights");
      return { success: false, error: message };
    }
  },

  async createAdminContactHighlight(payload: CreateHighlightPayload): Promise<ApiResponse<any>> {
    try {
      const authToken = await getAuthToken();
      const result = await createAdminContactHighlightServerFn({ data: { payload, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to create highlight");
      return { success: false, error: message };
    }
  },

  async updateAdminContactHighlight(id: string, payload: UpdateHighlightPayload): Promise<ApiResponse<any>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminContactHighlightServerFn({ data: { id, payload, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update highlight");
      return { success: false, error: message };
    }
  },

  async deleteAdminContactHighlight(id: string): Promise<ApiResponse<{ success: boolean; deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminContactHighlightServerFn({ data: { id, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete highlight");
      return { success: false, error: message };
    }
  },

  async reorderAdminContactHighlights(items: { id: string; displayOrder: number }[]): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await reorderAdminContactHighlightsServerFn({ data: { items, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to reorder highlights");
      return { success: false, error: message };
    }
  },

  async listAdminContactFaqs(): Promise<ApiResponse<any[]>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminContactFaqsServerFn({ data: { authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load FAQs");
      return { success: false, error: message };
    }
  },

  async createAdminContactFaq(payload: CreateFaqPayload): Promise<ApiResponse<any>> {
    try {
      const authToken = await getAuthToken();
      const result = await createAdminContactFaqServerFn({ data: { payload, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to create FAQ");
      return { success: false, error: message };
    }
  },

  async updateAdminContactFaq(id: string, payload: UpdateFaqPayload): Promise<ApiResponse<any>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminContactFaqServerFn({ data: { id, payload, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update FAQ");
      return { success: false, error: message };
    }
  },

  async deleteAdminContactFaq(id: string): Promise<ApiResponse<{ success: boolean; deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminContactFaqServerFn({ data: { id, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete FAQ");
      return { success: false, error: message };
    }
  },

  async reorderAdminContactFaqs(items: { id: string; displayOrder: number }[]): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await reorderAdminContactFaqsServerFn({ data: { items, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to reorder FAQs");
      return { success: false, error: message };
    }
  },

  async listAdminContactSocialLinks(): Promise<ApiResponse<any[]>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminContactSocialLinksServerFn({ data: { authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load contact social links");
      return { success: false, error: message };
    }
  },

  async createAdminContactSocialLink(payload: CreateContactSocialLinkPayload): Promise<ApiResponse<any>> {
    try {
      const authToken = await getAuthToken();
      const result = await createAdminContactSocialLinkServerFn({ data: { payload, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to create contact social link");
      return { success: false, error: message };
    }
  },

  async updateAdminContactSocialLink(id: string, payload: UpdateContactSocialLinkPayload): Promise<ApiResponse<any>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminContactSocialLinkServerFn({ data: { id, payload, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update contact social link");
      return { success: false, error: message };
    }
  },

  async deleteAdminContactSocialLink(id: string): Promise<ApiResponse<{ success: boolean; deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminContactSocialLinkServerFn({ data: { id, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete contact social link");
      return { success: false, error: message };
    }
  },

  async reorderAdminContactSocialLinks(items: { id: string; displayOrder: number }[]): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await reorderAdminContactSocialLinksServerFn({ data: { items, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to reorder contact social links");
      return { success: false, error: message };
    }
  },

  async listAdminContactMessages(filter?: ListMessagesFilter): Promise<ApiResponse<{
    messages: ContactMessage[];
    totalCount: number;
    unreadCount: number;
    counts?: {
      all: number;
      new: number;
      read: number;
      replied: number;
      archived: number;
    };
    limit: number;
    offset: number;
  }>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminContactMessagesServerFn({ data: { filter, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load messages");
      return { success: false, error: message };
    }
  },

  async getAdminContactMessageDetail(messageId: string, markAsRead?: boolean): Promise<ApiResponse<ContactMessage>> {
    try {
      const authToken = await getAuthToken();
      const result = await getAdminContactMessageDetailServerFn({ data: { messageId, markAsRead, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load message details");
      return { success: false, error: message };
    }
  },

  async updateAdminContactMessageStatus(messageId: string, status: string, adminNotes?: string | null): Promise<ApiResponse<ContactMessage>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAdminContactMessageStatusServerFn({ data: { messageId, status, adminNotes, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update message status");
      return { success: false, error: message };
    }
  },

  async deleteAdminContactMessage(messageId: string): Promise<ApiResponse<{ success: boolean; deletedId: string }>> {
    try {
      const authToken = await getAuthToken();
      const result = await deleteAdminContactMessageServerFn({ data: { messageId, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete message");
      return { success: false, error: message };
    }
  },

  async bulkDeleteAdminContactMessages(messageIds: string[]): Promise<ApiResponse<{ success: boolean; deletedCount: number }>> {
    try {
      const authToken = await getAuthToken();
      const result = await bulkDeleteAdminContactMessagesServerFn({ data: { messageIds, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to delete messages");
      return { success: false, error: message };
    }
  },

  async bulkUpdateAdminContactMessagesStatus(messageIds: string[], status: string): Promise<ApiResponse<{ success: boolean; updatedCount: number }>> {
    try {
      const authToken = await getAuthToken();
      const result = await bulkUpdateAdminContactMessageStatusServerFn({ data: { payload: { messageIds, status: status as any }, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update messages status");
      return { success: false, error: message };
    }
  },

  async sendAdminContactMessageReply(payload: {
    messageId: string;
    subject: string;
    body: string;
    idempotencyKey?: string;
  }): Promise<ApiResponse<{ success: boolean; reply: any; message: any; isDuplicate?: boolean }>> {
    try {
      const authToken = await getAuthToken();
      const result = await sendAdminContactMessageReplyServerFn({ data: { payload, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to send email reply");
      return { success: false, error: message };
    }
  },

  async listAdminContactMessageReplies(messageId: string): Promise<ApiResponse<any[]>> {
    try {
      const authToken = await getAuthToken();
      const result = await listAdminContactMessageRepliesServerFn({ data: { messageId, authToken } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to fetch message replies");
      return { success: false, error: message };
    }
  },

  async getPublicContactConfig(): Promise<ApiResponse<any>> {
    try {
      const result = await getPublicContactConfigServerFn();
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load public contact config";
      return { success: false, error: message };
    }
  },

  async submitPublicContactMessage(payload: SubmitContactMessagePayload): Promise<ApiResponse<{ success: boolean; id: string }>> {
    try {
      const result = await submitPublicContactMessageServerFn({ data: { payload } });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit message";
      return { success: false, error: message };
    }
  },

  /**
   * Loads real aggregated dashboard statistics, recent activity, showcase items,
   * and media telemetry from PostgreSQL.
   */
  async getDashboardData(): Promise<ApiResponse<DashboardDataResult>> {
    try {
      const authToken = await getAuthToken();
      const result = await getDashboardDataServerFn({
        data: {
          authToken,
        },
      });
      return { success: true, data: result.dashboard };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load dashboard data");
      return { success: false, error: message };
    }
  },

  /**
   * Reads safe server-side environment variable configuration status for external integrations.
   * Never exposes secret keys or tokens.
   */
  async getSettingsEnvironmentStatus(): Promise<ApiResponse<SettingsEnvironmentStatus>> {
    try {
      const authToken = await getAuthToken();
      const result = await getSettingsEnvironmentStatusServerFn({
        data: { authToken },
      });
      return { success: true, data: result.status };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load environment status");
      return { success: false, error: message };
    }
  },

  /**
   * Reads public site settings metadata from PostgreSQL.
   * Unauthenticated and safe for public website consumption.
   * Gracefully returns safe defaults if the query fails.
   */
  async getPublicSiteSettings(): Promise<ApiResponse<PublicSiteSettings>> {
    try {
      const result = await getPublicSiteSettingsServerFn();
      return { success: true, data: result.settings };
    } catch {
      return { success: true, data: DEFAULT_PUBLIC_SITE_SETTINGS };
    }
  },

  /**
   * Reads public appearance configuration from PostgreSQL.
   * Unauthenticated and safe for public website consumption.
   * Gracefully returns safe defaults if the query fails.
   */
  async getPublicAppearanceConfig(): Promise<ApiResponse<PublicAppearanceConfig>> {
    try {
      const result = await getPublicAppearanceConfigServerFn();
      return { success: true, data: result.appearance };
    } catch {
      return { success: true, data: DEFAULT_PUBLIC_APPEARANCE_CONFIG };
    }
  },

  /**
   * Reads global site settings configuration from PostgreSQL.
   * Requires SETTINGS_READ (SUPER_ADMIN, ADMIN, EDITOR).
   */
  async getSiteSettings(): Promise<ApiResponse<SiteSettings | null>> {
    try {
      const authToken = await getAuthToken();
      const result = await getGlobalSettingsServerFn({
        data: { authToken },
      });
      return { success: true, data: result.settings };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load site settings");
      return { success: false, error: message };
    }
  },

  /**
   * Updates global site settings configuration in PostgreSQL.
   * Requires SETTINGS_UPDATE (SUPER_ADMIN only).
   */
  async updateSiteSettings(
    settings: UpdateSiteSettingsInput
  ): Promise<ApiResponse<SiteSettings>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateGlobalSettingsServerFn({
        data: { settings, authToken },
      });
      return { success: true, data: result.settings };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update site settings");
      return { success: false, error: message };
    }
  },

  /**
   * Reads global appearance configuration from PostgreSQL.
   * Requires APPEARANCE_READ (SUPER_ADMIN, ADMIN, EDITOR).
   */
  async getAppearanceConfig(): Promise<ApiResponse<AppearanceConfig | null>> {
    try {
      const authToken = await getAuthToken();
      const result = await getAppearanceConfigServerFn({
        data: { authToken },
      });
      return { success: true, data: result.appearance };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to load appearance config");
      return { success: false, error: message };
    }
  },

  /**
   * Updates global appearance configuration in PostgreSQL.
   * Requires APPEARANCE_UPDATE (SUPER_ADMIN and ADMIN only).
   */
  async updateAppearanceConfig(
    appearance: UpdateAppearanceConfigInput
  ): Promise<ApiResponse<AppearanceConfig>> {
    try {
      const authToken = await getAuthToken();
      const result = await updateAppearanceConfigServerFn({
        data: { appearance, authToken },
      });
      return { success: true, data: result.appearance };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to update appearance config");
      return { success: false, error: message };
    }
  },

  /**
   * Performs cross-module authenticated search across CMS content and settings.
   */
  async globalSearch(query: string): Promise<ApiResponse<GlobalSearchResponse>> {
    try {
      const authToken = await getAuthToken();
      const result = await searchGlobalAdminServerFn({
        data: {
          query,
          authToken,
        },
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = formatClientErrorMessage(err, "Failed to perform global search");
      return { success: false, error: message };
    }
  },
};



