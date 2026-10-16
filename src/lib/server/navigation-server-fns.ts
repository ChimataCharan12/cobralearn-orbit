import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  listAdminNavigationOperation,
  createAdminNavItemOperation,
  updateAdminNavItemOperation,
  deleteAdminNavItemOperation,
  reorderAdminNavItemsOperation,
  createAdminFooterSectionOperation,
  updateAdminFooterSectionOperation,
  deleteAdminFooterSectionOperation,
  reorderAdminFooterSectionsOperation,
  createAdminSocialLinkOperation,
  updateAdminSocialLinkOperation,
  deleteAdminSocialLinkOperation,
  reorderAdminSocialLinksOperation,
  getPublicNavigationAndFooterOperation,
  type FooterSectionWithLinks,
  type CreateNavItemPayload,
  type UpdateNavItemPayload,
  type CreateFooterSectionPayload,
  type UpdateFooterSectionPayload,
  type CreateSocialLinkPayload,
  type UpdateSocialLinkPayload,
} from "@/lib/server/navigation-operations";
import type { NavigationItem, GlobalSocialLink } from "@prisma/client";

function normalizeAuthError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("No cookie header provided") ||
    msg.includes("No valid Supabase session") ||
    msg.startsWith("Unauthorized")
  ) {
    throw new Error("Unauthorized: Valid administrative session required");
  }
  throw err;
}

function createServerOpRequest(url: string, authToken?: string, method: string = "GET", body?: unknown): Request {
  const headers = new Headers();

  try {
    const incomingReq = getRequest();
    if (incomingReq) {
      const incomingCookie = incomingReq.headers.get("cookie");
      if (incomingCookie) headers.set("Cookie", incomingCookie);
      const incomingAuth = incomingReq.headers.get("authorization");
      if (incomingAuth) headers.set("Authorization", incomingAuth);
    }
  } catch {
    // Non-HTTP context fallback
  }

  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  return new Request(url, init);
}

// =========================================================================
// 1. ADMIN SERVER FUNCTIONS
// =========================================================================

export const listAdminNavigationServerFn = createServerFn({ method: "GET" })
  .validator((data?: { authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }): Promise<{
    navItems: NavigationItem[];
    footerSections: FooterSectionWithLinks[];
    socialLinks: GlobalSocialLink[];
  }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/navigation", data?.authToken, "GET");
      return await listAdminNavigationOperation(request);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const createAdminNavItemServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: CreateNavItemPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ navItem: NavigationItem }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/navigation/items", data.authToken, "POST", data.payload);
      return await createAdminNavItemOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const updateAdminNavItemServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateNavItemPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ navItem: NavigationItem }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/navigation/items/${data.id}`, data.authToken, "POST", data.payload);
      return await updateAdminNavItemOperation(request, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const deleteAdminNavItemServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ deletedId: string }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/navigation/items/${data.id}/delete`, data.authToken, "POST");
      return await deleteAdminNavItemOperation(request, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const reorderAdminNavItemsServerFn = createServerFn({ method: "POST" })
  .validator((data: { orderedIds: string[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/navigation/items/reorder", data.authToken, "POST", { orderedIds: data.orderedIds });
      return await reorderAdminNavItemsOperation(request, data.orderedIds);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const createAdminFooterSectionServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: CreateFooterSectionPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ section: FooterSectionWithLinks }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/footer/sections", data.authToken, "POST", data.payload);
      return await createAdminFooterSectionOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const updateAdminFooterSectionServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateFooterSectionPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ section: FooterSectionWithLinks }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/footer/sections/${data.id}`, data.authToken, "POST", data.payload);
      return await updateAdminFooterSectionOperation(request, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const deleteAdminFooterSectionServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ deletedId: string }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/footer/sections/${data.id}/delete`, data.authToken, "POST");
      return await deleteAdminFooterSectionOperation(request, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const reorderAdminFooterSectionsServerFn = createServerFn({ method: "POST" })
  .validator((data: { orderedIds: string[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/footer/sections/reorder", data.authToken, "POST", { orderedIds: data.orderedIds });
      return await reorderAdminFooterSectionsOperation(request, data.orderedIds);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const createAdminSocialLinkServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: CreateSocialLinkPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ socialLink: GlobalSocialLink }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/social-links", data.authToken, "POST", data.payload);
      return await createAdminSocialLinkOperation(request, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const updateAdminSocialLinkServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateSocialLinkPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ socialLink: GlobalSocialLink }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/social-links/${data.id}`, data.authToken, "POST", data.payload);
      return await updateAdminSocialLinkOperation(request, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const deleteAdminSocialLinkServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ deletedId: string }> => {
    try {
      const request = createServerOpRequest(`https://api.internal/admin/social-links/${data.id}/delete`, data.authToken, "POST");
      return await deleteAdminSocialLinkOperation(request, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const reorderAdminSocialLinksServerFn = createServerFn({ method: "POST" })
  .validator((data: { orderedIds: string[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      const request = createServerOpRequest("https://api.internal/admin/social-links/reorder", data.authToken, "POST", { orderedIds: data.orderedIds });
      return await reorderAdminSocialLinksOperation(request, data.orderedIds);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 2. PUBLIC SERVER FUNCTION
// =========================================================================

export const getPublicNavigationAndFooterServerFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<{
    navItems: NavigationItem[];
    footerSections: FooterSectionWithLinks[];
    socialLinks: GlobalSocialLink[];
  }> => {
    return await getPublicNavigationAndFooterOperation();
  });
