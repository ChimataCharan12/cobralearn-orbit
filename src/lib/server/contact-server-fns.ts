import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  getAdminContactConfigOperation,
  updateAdminContactConfigOperation,
  getPublicContactConfigOperation,
  listAdminContactHighlightsOperation,
  createAdminContactHighlightOperation,
  updateAdminContactHighlightOperation,
  deleteAdminContactHighlightOperation,
  reorderAdminContactHighlightsOperation,
  listAdminContactFaqsOperation,
  createAdminContactFaqOperation,
  updateAdminContactFaqOperation,
  deleteAdminContactFaqOperation,
  reorderAdminContactFaqsOperation,
  listAdminContactSocialLinksOperation,
  createAdminContactSocialLinkOperation,
  updateAdminContactSocialLinkOperation,
  deleteAdminContactSocialLinkOperation,
  reorderAdminContactSocialLinksOperation,
  listAdminContactMessagesOperation,
  getAdminContactMessageDetailOperation,
  updateAdminContactMessageStatusOperation,
  deleteAdminContactMessageOperation,
  bulkDeleteAdminContactMessagesOperation,
  bulkUpdateAdminContactMessageStatusOperation,
  submitPublicContactMessageOperation,
  sendAdminContactMessageReplyOperation,
  listAdminContactMessageRepliesOperation,
  type UpdateContactConfigPayload,
  type CreateHighlightPayload,
  type UpdateHighlightPayload,
  type CreateFaqPayload,
  type UpdateFaqPayload,
  type CreateSocialLinkPayload,
  type UpdateSocialLinkPayload,
  type SubmitContactMessagePayload,
  type BulkUpdateContactMessagesPayload,
  type ListMessagesFilter,
  type SendAdminReplyPayload,
} from "@/lib/server/contact-operations";
import type { ContactMessageStatus } from "@prisma/client";

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

function extractClientInfo(): { clientIp?: string | null; userAgent?: string | null } {
  try {
    const req = getRequest();
    if (!req) return {};
    // Hardened IP extraction:
    // 1. Edge-validated proxy headers that cannot be spoofed by downstream clients (e.g., Cloudflare cf-connecting-ip).
    // 2. Direct edge-injected x-real-ip set by the immediate reverse proxy.
    // 3. For x-forwarded-for, reverse proxies append client IPs to the chain.
    //    Taking the leftmost element allows attackers to spoof their IP by sending custom X-Forwarded-For headers.
    //    We prioritize provider headers, and fallback to the immediate hop (last entry) of x-forwarded-for.
    const cfIp = req.headers.get("cf-connecting-ip")?.trim();
    const realIp = req.headers.get("x-real-ip")?.trim();
    const forwarded = req.headers.get("x-forwarded-for");

    let clientIp: string | null = null;
    if (cfIp) {
      clientIp = cfIp;
    } else if (realIp) {
      clientIp = realIp;
    } else if (forwarded) {
      const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
      clientIp = parts[parts.length - 1] || null;
    }

    const userAgent = req.headers.get("user-agent") || null;
    return { clientIp, userAgent };
  } catch {
    return {};
  }
}

// =========================================================================
// 1. ADMIN CONFIGURATION SERVER FUNCTIONS
// =========================================================================

export const getAdminContactConfigServerFn = createServerFn({ method: "GET" })
  .validator((data?: { authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/config", data?.authToken, "GET");
      return await getAdminContactConfigOperation(req);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const updateAdminContactConfigServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: UpdateContactConfigPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/config", data.authToken, "POST", data.payload);
      return await updateAdminContactConfigOperation(req, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 2. ADMIN HIGHLIGHTS SERVER FUNCTIONS
// =========================================================================

export const listAdminContactHighlightsServerFn = createServerFn({ method: "GET" })
  .validator((data?: { authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/highlights", data?.authToken, "GET");
      return await listAdminContactHighlightsOperation(req);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const createAdminContactHighlightServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: CreateHighlightPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/highlights", data.authToken, "POST", data.payload);
      return await createAdminContactHighlightOperation(req, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const updateAdminContactHighlightServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateHighlightPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest(`https://api.internal/admin/contact/highlights/${data.id}`, data.authToken, "POST", data.payload);
      return await updateAdminContactHighlightOperation(req, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const deleteAdminContactHighlightServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest(`https://api.internal/admin/contact/highlights/${data.id}`, data.authToken, "DELETE");
      return await deleteAdminContactHighlightOperation(req, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const reorderAdminContactHighlightsServerFn = createServerFn({ method: "POST" })
  .validator((data: { items: { id: string; displayOrder: number }[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/highlights/reorder", data.authToken, "POST", data.items);
      return await reorderAdminContactHighlightsOperation(req, data.items);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 3. ADMIN FAQS SERVER FUNCTIONS
// =========================================================================

export const listAdminContactFaqsServerFn = createServerFn({ method: "GET" })
  .validator((data?: { authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/faqs", data?.authToken, "GET");
      return await listAdminContactFaqsOperation(req);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const createAdminContactFaqServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: CreateFaqPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/faqs", data.authToken, "POST", data.payload);
      return await createAdminContactFaqOperation(req, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const updateAdminContactFaqServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateFaqPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest(`https://api.internal/admin/contact/faqs/${data.id}`, data.authToken, "POST", data.payload);
      return await updateAdminContactFaqOperation(req, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const deleteAdminContactFaqServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest(`https://api.internal/admin/contact/faqs/${data.id}`, data.authToken, "DELETE");
      return await deleteAdminContactFaqOperation(req, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const reorderAdminContactFaqsServerFn = createServerFn({ method: "POST" })
  .validator((data: { items: { id: string; displayOrder: number }[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/faqs/reorder", data.authToken, "POST", data.items);
      return await reorderAdminContactFaqsOperation(req, data.items);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 4. ADMIN SOCIAL LINKS SERVER FUNCTIONS
// =========================================================================

export const listAdminContactSocialLinksServerFn = createServerFn({ method: "GET" })
  .validator((data?: { authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/social-links", data?.authToken, "GET");
      return await listAdminContactSocialLinksOperation(req);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const createAdminContactSocialLinkServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: CreateSocialLinkPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/social-links", data.authToken, "POST", data.payload);
      return await createAdminContactSocialLinkOperation(req, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const updateAdminContactSocialLinkServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; payload: UpdateSocialLinkPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest(`https://api.internal/admin/contact/social-links/${data.id}`, data.authToken, "POST", data.payload);
      return await updateAdminContactSocialLinkOperation(req, data.id, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const deleteAdminContactSocialLinkServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest(`https://api.internal/admin/contact/social-links/${data.id}`, data.authToken, "DELETE");
      return await deleteAdminContactSocialLinkOperation(req, data.id);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const reorderAdminContactSocialLinksServerFn = createServerFn({ method: "POST" })
  .validator((data: { items: { id: string; displayOrder: number }[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/social-links/reorder", data.authToken, "POST", data.items);
      return await reorderAdminContactSocialLinksOperation(req, data.items);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 5. ADMIN MESSAGES SERVER FUNCTIONS
// =========================================================================

export const listAdminContactMessagesServerFn = createServerFn({ method: "GET" })
  .validator((data?: { filter?: ListMessagesFilter | undefined; authToken?: string | undefined } | undefined) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/messages", data?.authToken, "GET");
      return await listAdminContactMessagesOperation(req, data?.filter);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const getAdminContactMessageDetailServerFn = createServerFn({ method: "GET" })
  .validator((data: { messageId: string; markAsRead?: boolean | undefined; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest(`https://api.internal/admin/contact/messages/${data.messageId}`, data.authToken, "GET");
      return await getAdminContactMessageDetailOperation(req, data.messageId, { markAsRead: data.markAsRead });
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const updateAdminContactMessageStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: { messageId: string; status: ContactMessageStatus | string; adminNotes?: string | null | undefined; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest(`https://api.internal/admin/contact/messages/${data.messageId}/status`, data.authToken, "POST", data);
      return await updateAdminContactMessageStatusOperation(req, {
        messageId: data.messageId,
        status: data.status as any,
        adminNotes: data.adminNotes,
      });
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const deleteAdminContactMessageServerFn = createServerFn({ method: "POST" })
  .validator((data: { messageId: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest(`https://api.internal/admin/contact/messages/${data.messageId}`, data.authToken, "DELETE");
      return await deleteAdminContactMessageOperation(req, data.messageId);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const bulkUpdateAdminContactMessageStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: BulkUpdateContactMessagesPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/messages/bulk-status", data.authToken, "POST", data.payload);
      return await bulkUpdateAdminContactMessageStatusOperation(req, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const bulkDeleteAdminContactMessagesServerFn = createServerFn({ method: "POST" })
  .validator((data: { messageIds: string[]; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest("https://api.internal/admin/contact/messages/bulk-delete", data.authToken, "POST", data.messageIds);
      return await bulkDeleteAdminContactMessagesOperation(req, data.messageIds);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const sendAdminContactMessageReplyServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: SendAdminReplyPayload; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest(
        `https://api.internal/admin/contact/messages/${data.payload.messageId}/reply`,
        data.authToken,
        "POST",
        data.payload
      );
      return await sendAdminContactMessageReplyOperation(req, data.payload);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

export const listAdminContactMessageRepliesServerFn = createServerFn({ method: "GET" })
  .validator((data: { messageId: string; authToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      const req = createServerOpRequest(
        `https://api.internal/admin/contact/messages/${data.messageId}/replies`,
        data.authToken,
        "GET"
      );
      return await listAdminContactMessageRepliesOperation(req, data.messageId);
    } catch (err) {
      normalizeAuthError(err);
    }
  });

// =========================================================================
// 6. PUBLIC SERVER FUNCTIONS
// =========================================================================

export const getPublicContactConfigServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    return await getPublicContactConfigOperation();
  });

export const submitPublicContactMessageServerFn = createServerFn({ method: "POST" })
  .validator((data: { payload: SubmitContactMessagePayload }) => data)
  .handler(async ({ data }) => {
    const clientInfo = extractClientInfo();
    return await submitPublicContactMessageOperation(data.payload, clientInfo);
  });
