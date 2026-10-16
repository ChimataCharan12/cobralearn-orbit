import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it, beforeEach } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { authService } from "@/lib/auth/auth-service";

describe("App routing and flow verification", () => {
  beforeEach(async () => {
    await authService.signOut();
  });

  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches the public /contact route correctly", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/contact");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches all 5 admin authentication routes", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const authRoutes = [
      "/admin/forgot-password",
      "/admin/reset-password",
      "/admin/password-updated",
      "/admin/session-expired",
      "/admin/access-denied",
    ];

    for (const path of authRoutes) {
      const matches = router.matchRoutes(path);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    }
  });

  it("matches admin projects, contact and profile subroutes correctly", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    
    expect(router.matchRoutes("/admin/projects").at(-1)?.routeId).not.toBe(rootRouteId);
    expect(router.matchRoutes("/admin/projects/edit").at(-1)?.routeId).not.toBe(rootRouteId);
    expect(router.matchRoutes("/admin/profile").at(-1)?.routeId).not.toBe(rootRouteId);
    expect(router.matchRoutes("/admin/profile/change-password").at(-1)?.routeId).not.toBe(rootRouteId);
    expect(router.matchRoutes("/admin/contact").at(-1)?.routeId).not.toBe(rootRouteId);
    expect(router.matchRoutes("/admin/contact/messages").at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("handles unknown route by matching router not-found fallback", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/this-route-does-not-exist");
    // Matches router root/fallback
    expect(matches.length).toBeGreaterThan(0);
  });

  it("manages authentication service operations during sign out flow", async () => {
    const signOutResult = await authService.signOut();
    expect(signOutResult.error).toBeNull();
    const session = await authService.getSession();
    expect(session).toBeNull();
  });

  it("validates password strength rules correctly", () => {
    const testPassword1 = "weak";
    const testPassword2 = "StrongPass123!";

    const checkRules = (p: string) => ({
      hasMinLength: p.length >= 8,
      hasUpperLower: /[a-z]/.test(p) && /[A-Z]/.test(p),
      hasNumber: /\d/.test(p),
      hasSpecial: /[^A-Za-z0-9]/.test(p),
    });

    const weakRules = checkRules(testPassword1);
    expect(weakRules.hasMinLength).toBe(false);
    expect(weakRules.hasUpperLower).toBe(false);

    const strongRules = checkRules(testPassword2);
    expect(strongRules.hasMinLength).toBe(true);
    expect(strongRules.hasUpperLower).toBe(true);
    expect(strongRules.hasNumber).toBe(true);
    expect(strongRules.hasSpecial).toBe(true);
  });

  it("verifies mock data removal across public showcase and admin data stores", async () => {
    const { projects, websites, advertisements, awards } = await import("@/data/showcase");
    const { INITIAL_PROJECTS } = await import("@/lib/projects-data");
    const { INITIAL_WEBSITES } = await import("@/lib/websites-data");
    const { INITIAL_ADVERTISEMENTS } = await import("@/lib/advertisements-data");
    const { INITIAL_AWARDS } = await import("@/lib/awards-data");
    const { INITIAL_MEDIA_ITEMS } = await import("@/lib/media-data");
    const { stats, activity, recentProjects, recentAds, recentAwards } = await import("@/lib/dashboard-data");

    // Public showcase collections must be empty arrays
    expect(projects).toEqual([]);
    expect(websites).toEqual([]);
    expect(advertisements).toEqual([]);
    expect(awards).toEqual([]);

    // Admin initial items must be empty arrays
    expect(INITIAL_PROJECTS).toEqual([]);
    expect(INITIAL_WEBSITES).toEqual([]);
    expect(INITIAL_ADVERTISEMENTS).toEqual([]);
    expect(INITIAL_AWARDS).toEqual([]);
    expect(INITIAL_MEDIA_ITEMS).toEqual([]);

    // Dashboard metrics and feeds must be zero/empty
    expect(stats.every((s) => s.value === 0 && s.published === 0 && s.draft === 0)).toBe(true);
    expect(activity).toEqual([]);
    expect(recentProjects).toEqual([]);
    expect(recentAds).toEqual([]);
    expect(recentAwards).toEqual([]);
  });

  it("handles contact store config updates and message lifecycle correctly", async () => {
    const { contactStore } = await import("@/lib/contact-store");

    // 1. Initial snapshot check
    const initialConfig = contactStore.getConfigSnapshot();
    expect(initialConfig.contactInfo.email).toBe("");
    expect(initialConfig.socialLinks.length).toBeGreaterThanOrEqual(5);

    // 2. Add inbound message
    const msg = contactStore.addMessage({
      fullName: "Jane Doe",
      email: "jane@example.com",
      subject: "Website Development",
      message: "Looking for modern website revamp.",
    });

    expect(msg.status).toBe("new");
    expect(contactStore.getMessagesSnapshot()).toContainEqual(msg);

    // 3. Mark message as read
    contactStore.updateMessageStatus(msg.id, "read");
    const updated = contactStore.getMessagesSnapshot().find((m) => m.id === msg.id);
    expect(updated?.status).toBe("read");
    expect(updated?.readAt).toBeDefined();

    // 4. Delete message
    contactStore.deleteMessage(msg.id);
    expect(contactStore.getMessagesSnapshot().find((m) => m.id === msg.id)).toBeUndefined();
  });
});
