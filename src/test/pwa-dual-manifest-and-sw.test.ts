import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

import { Route as RootRoute } from "@/routes/__root";
import { Route as AdminIndexRoute } from "@/routes/admin/index";
import { registerServiceWorker, unregisterServiceWorker, _resetRegistrationStateForTesting } from "@/lib/pwa/register-sw";

describe("CobraLearn Dual PWA — Architecture & Security Verification", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const publicDir = path.join(rootDir, "public");
  const publicManifestPath = path.join(publicDir, "manifest.webmanifest");
  const adminManifestPath = path.join(publicDir, "manifest-admin.webmanifest");
  const swPath = path.join(publicDir, "sw.js");
  const offlinePath = path.join(publicDir, "offline.html");

  describe("1. Manifests & App Identity Validation", () => {
    it("verifies both manifests exist and are valid JSON", () => {
      expect(fs.existsSync(publicManifestPath)).toBe(true);
      expect(fs.existsSync(adminManifestPath)).toBe(true);

      const publicJson = JSON.parse(fs.readFileSync(publicManifestPath, "utf-8"));
      const adminJson = JSON.parse(fs.readFileSync(adminManifestPath, "utf-8"));

      expect(publicJson).toBeTypeOf("object");
      expect(adminJson).toBeTypeOf("object");
    });

    it("verifies app names, short names, and stable IDs are distinct", () => {
      const publicJson = JSON.parse(fs.readFileSync(publicManifestPath, "utf-8"));
      const adminJson = JSON.parse(fs.readFileSync(adminManifestPath, "utf-8"));

      expect(publicJson.name).toBe("CobraLearn Nexus");
      expect(publicJson.short_name).toBe("Nexus");
      expect(publicJson.id).toBe("/");

      expect(adminJson.name).toBe("CobraLearn Orbit");
      expect(adminJson.short_name).toBe("Orbit");
      expect(adminJson.id).toBe("/admin");

      expect(publicJson.id).not.toBe(adminJson.id);
      expect(publicJson.name).not.toBe(adminJson.name);
    });

    it("verifies start URLs and scopes are compatible and inside declared bounds", () => {
      const publicJson = JSON.parse(fs.readFileSync(publicManifestPath, "utf-8"));
      const adminJson = JSON.parse(fs.readFileSync(adminManifestPath, "utf-8"));

      // Public: scope="/" and start_url="/"
      expect(publicJson.scope).toBe("/");
      expect(publicJson.start_url).toBe("/");
      expect(publicJson.start_url.startsWith(publicJson.scope)).toBe(true);

      // Admin: scope="/admin/" and start_url="/admin/"
      expect(adminJson.scope).toBe("/admin/");
      expect(adminJson.start_url).toBe("/admin/");
      expect(adminJson.start_url.startsWith(adminJson.scope)).toBe(true);

      // Both must be standalone
      expect(publicJson.display).toBe("standalone");
      expect(adminJson.display).toBe("standalone");
    });

    it("verifies all declared icons exist on disk with valid PNG format and dimensions", () => {
      const publicJson = JSON.parse(fs.readFileSync(publicManifestPath, "utf-8"));
      const adminJson = JSON.parse(fs.readFileSync(adminManifestPath, "utf-8"));

      const allIcons = [...publicJson.icons, ...adminJson.icons];
      expect(allIcons.length).toBeGreaterThan(0);

      for (const icon of allIcons) {
        const fullPath = path.join(publicDir, icon.src);
        expect(fs.existsSync(fullPath)).toBe(true);

        const buf = fs.readFileSync(fullPath);
        // PNG magic signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
        expect(buf[0]).toBe(0x89);
        expect(buf[1]).toBe(0x50);
        expect(buf[2]).toBe(0x4e);
        expect(buf[3]).toBe(0x47);

        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        const expectedDimensions = icon.sizes.split("x").map(Number);

        expect(width).toBe(expectedDimensions[0]);
        expect(height).toBe(expectedDimensions[1]);
      }
    });

    it("verifies maskable icon has required purpose tag and apple-touch-icon exists", () => {
      const publicJson = JSON.parse(fs.readFileSync(publicManifestPath, "utf-8"));
      const maskableIcon = publicJson.icons.find((i: any) => i.purpose === "maskable");
      expect(maskableIcon).toBeDefined();
      expect(maskableIcon.sizes).toBe("512x512");

      const appleTouchPath = path.join(publicDir, "icons", "apple-touch-icon.png");
      expect(fs.existsSync(appleTouchPath)).toBe(true);
      const buf = fs.readFileSync(appleTouchPath);
      expect(buf.readUInt32BE(16)).toBe(180);
      expect(buf.readUInt32BE(20)).toBe(180);
    });
  });

  describe("2. Route-Aware Document Head Integration", () => {
    it("emits public manifest and public theme-color when matching public routes", () => {
      const headResult = (RootRoute.options as any).head({
        loaderData: {},
        matches: [
          { routeId: "__root__", pathname: "/" },
          { routeId: "/", pathname: "/" },
        ],
      });

      const manifestLink = headResult.links.find((l: any) => l.rel === "manifest");
      const themeMeta = headResult.meta.find((m: any) => m.name === "theme-color");
      const appleTouchLink = headResult.links.find((l: any) => l.rel === "apple-touch-icon");

      expect(manifestLink).toBeDefined();
      expect(manifestLink?.href).toBe("/manifest.webmanifest");

      expect(themeMeta).toBeDefined();
      expect(themeMeta?.content).toBe("#020806");

      expect(appleTouchLink).toBeDefined();
      expect(appleTouchLink?.href).toBe("/icons/apple-touch-icon.png");
    });

    it("emits admin manifest and admin theme-color when matching admin routes", () => {
      const headResult = (RootRoute.options as any).head({
        loaderData: {},
        matches: [
          { routeId: "__root__", pathname: "/admin" },
          { routeId: "/admin/", pathname: "/admin/" },
        ],
      });

      const manifestLink = headResult.links.find((l: any) => l.rel === "manifest");
      const themeMeta = headResult.meta.find((m: any) => m.name === "theme-color");

      expect(manifestLink).toBeDefined();
      expect(manifestLink?.href).toBe("/manifest-admin.webmanifest");

      expect(themeMeta).toBeDefined();
      expect(themeMeta?.content).toBe("#020604");
    });

    it("emits admin manifest when matching deep admin dashboard subroutes", () => {
      const headResult = (RootRoute.options as any).head({
        loaderData: {},
        matches: [
          { routeId: "__root__", pathname: "/admin/dashboard" },
          { routeId: "/admin/dashboard", pathname: "/admin/dashboard" },
        ],
      });

      const manifestLink = headResult.links.find((l: any) => l.rel === "manifest");
      expect(manifestLink?.href).toBe("/manifest-admin.webmanifest");
    });

    it("verifies AdminIndexRoute relies on __root for manifest and does not emit redundant manifest links", () => {
      const adminHead = (AdminIndexRoute.options as any).head();
      const manifestLink = adminHead.links?.find((l: any) => l.rel === "manifest");
      expect(manifestLink).toBeUndefined();
    });
  });

  describe("3. Service Worker Security & Caching Policy", () => {
    it("verifies public/sw.js exists and implements required security checks", () => {
      expect(fs.existsSync(swPath)).toBe(true);
      const swCode = fs.readFileSync(swPath, "utf-8");

      // Verify strict security guards in SW code
      expect(swCode).toContain('request.method !== "GET"');
      expect(swCode).toContain('hostname.includes("supabase.co")');
      expect(swCode).toContain('pathname.startsWith("/_server")');
      expect(swCode).toContain('pathname.startsWith("/admin")');
      expect(swCode).toContain('pathname.startsWith("/auth/callback")');
      expect(swCode).toContain('cobralearn-');
    });

    it("verifies public/offline.html exists and does not contain private user or admin data", () => {
      expect(fs.existsSync(offlinePath)).toBe(true);
      const offlineHtml = fs.readFileSync(offlinePath, "utf-8");

      expect(offlineHtml).toContain("You're Offline");
      expect(offlineHtml).not.toContain("password");
      expect(offlineHtml).not.toContain("token");
      expect(offlineHtml).not.toContain("admin");
      expect(offlineHtml).not.toContain("session");
    });
  });

  describe("4. Service Worker Client Registration & Recovery", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
      _resetRegistrationStateForTesting();
    });

    it("returns null during server-side execution without crashing", async () => {
      const origWindow = globalThis.window;
      // Simulate SSR environment where window is undefined
      // @ts-ignore
      delete globalThis.window;

      const result = await registerServiceWorker();
      expect(result).toBeNull();

      globalThis.window = origWindow;
    });

    it("registers service worker with default scope / when in supported browser environment", async () => {
      const mockRegister = vi.fn().mockResolvedValue({
        scope: "/",
        addEventListener: vi.fn(),
      });

      const mockNavigator = {
        serviceWorker: {
          register: mockRegister,
          addEventListener: vi.fn(),
        },
      };

      vi.stubGlobal("window", {});
      vi.stubGlobal("navigator", mockNavigator);

      const result = await registerServiceWorker({ forceInDev: true });
      expect(mockRegister).toHaveBeenCalledWith("/sw.js", { scope: "/" });
      expect(result).not.toBeNull();
    });

    it("fails gracefully without crashing when registration throws an error", async () => {
      const mockRegister = vi.fn().mockRejectedValue(new Error("SecurityError: Access denied"));

      vi.stubGlobal("window", {});
      vi.stubGlobal("navigator", {
        serviceWorker: {
          register: mockRegister,
        },
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = await registerServiceWorker({ forceInDev: true });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("recovery utility unregisters service workers and purges only cobralearn- caches", async () => {
      const mockUnregister = vi.fn().mockResolvedValue(true);
      const mockGetRegistrations = vi.fn().mockResolvedValue([
        { scope: "http://localhost:3000/", unregister: mockUnregister },
      ]);

      const mockDelete = vi.fn().mockResolvedValue(true);
      const mockKeys = vi.fn().mockResolvedValue([
        "cobralearn-static-v1",
        "cobralearn-pages-v1",
        "unrelated-app-cache",
      ]);

      vi.stubGlobal("window", {
        location: { origin: "http://localhost:3000" },
      });
      vi.stubGlobal("navigator", {
        serviceWorker: {
          getRegistrations: mockGetRegistrations,
        },
      });
      vi.stubGlobal("caches", {
        keys: mockKeys,
        delete: mockDelete,
      });

      const success = await unregisterServiceWorker();
      expect(success).toBe(true);
      expect(mockUnregister).toHaveBeenCalled();

      // Ensure it deleted only cobralearn- caches, and did not delete unrelated caches
      expect(mockDelete).toHaveBeenCalledWith("cobralearn-static-v1");
      expect(mockDelete).toHaveBeenCalledWith("cobralearn-pages-v1");
      expect(mockDelete).not.toHaveBeenCalledWith("unrelated-app-cache");
    });
  });
});
