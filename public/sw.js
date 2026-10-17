/**
 * CobraLearn Route-Aware Service Worker
 * Enforces strict security boundaries between Public showcase and Admin portal.
 */

const CACHE_NAME_PREFIX = "cobralearn-";
const CACHE_VERSION = "v3";

const STATIC_CACHE = `${CACHE_NAME_PREFIX}static-${CACHE_VERSION}`;
const PAGES_CACHE = `${CACHE_NAME_PREFIX}pages-${CACHE_VERSION}`;
const OFFLINE_CACHE = `${CACHE_NAME_PREFIX}offline-${CACHE_VERSION}`;

const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/favicon.png",
  "/favicon.svg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// --- 1. INSTALL ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

// --- 2. ACTIVATE ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Delete only caches owned by this application that don't match the current version
          if (key.startsWith(CACHE_NAME_PREFIX) && !key.endsWith(`-${CACHE_VERSION}`)) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- 3. FETCH ---
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Rule 1: Only handle GET requests. Mutations (POST/PUT/PATCH/DELETE) are strictly network-only.
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Rule 2: Supabase authentication and API endpoints must NEVER touch Cache Storage
  if (url.hostname.includes("supabase.co") || url.pathname.includes("/auth/v1/")) {
    return;
  }

  // Rule 3: Cross-origin requests (except Google Fonts) are network-only
  if (url.origin !== self.location.origin) {
    if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
      event.respondWith(
        caches.open(STATIC_CACHE).then((cache) => {
          return cache.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
              if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            }).catch(() => cached);
            return cached || fetchPromise;
          });
        })
      );
    }
    return;
  }

  // Rule 4: TanStack Start Server Functions (RPC) must NEVER be stored in Cache Storage
  if (url.pathname.startsWith("/_server")) {
    event.respondWith(fetch(request));
    return;
  }

  // Rule 5: Authentication callbacks and logout paths are strictly network-only
  if (url.pathname.startsWith("/auth/callback") || url.pathname.startsWith("/admin/session-expired")) {
    event.respondWith(fetch(request));
    return;
  }

  // Rule 6: Admin routes are STRICTLY NETWORK-ONLY
  // Never cache authenticated admin documents, HTML, or JSON in Cache Storage.
  if (url.pathname.startsWith("/admin")) {
    if (request.mode === "navigate") {
      event.respondWith(
        fetch(request).catch(() => {
          // Never fall back to public offline page or cached public content
          return new Response(
            "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><title>Admin Offline — CobraLearn</title><meta name='viewport' content='width=device-width,initial-scale=1'><style>body{background:#020604;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;}.box{max-width:440px;padding:32px;border:1px solid rgba(0,255,135,0.2);border-radius:12px;background:#08140f;}h1{color:#00ff87;font-size:20px;margin-bottom:12px;}p{font-size:14px;color:#94a3b8;line-height:1.5;margin-bottom:20px;}button{background:#00ff87;color:#020604;border:none;padding:10px 20px;border-radius:6px;font-weight:600;cursor:pointer;}</style></head><body><div class='box'><h1>Admin Portal Offline</h1><p>An active, secure internet connection is required to access the CobraLearn Admin Portal. No administrative data is cached offline.</p><button onclick='window.location.reload()'>Retry Connection</button></div></body></html>",
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          );
        })
      );
    } else {
      event.respondWith(fetch(request));
    }
    return;
  }

  // Rule 7: Static Hashed Assets (JS, CSS, static images, icons) -> Cache-First
  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.png" ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/cobralearn-official-logo.png";

  if (isStaticAsset) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((networkResponse) => {
            if (networkResponse.ok && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Rule 8: Web Manifests -> Network-First with fallback to cache
  if (url.pathname.endsWith(".webmanifest")) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.open(STATIC_CACHE).then((cache) => {
            return cache.match(request);
          });
        })
    );
    return;
  }

  // Rule 9: Public HTML Navigations -> Network-First with safe offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(PAGES_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed; attempt to serve cached public page
          return caches.open(PAGES_CACHE).then((cache) => {
            return cache.match(request).then((cachedPage) => {
              if (cachedPage) return cachedPage;
              // If not cached, serve public offline fallback
              return caches.open(OFFLINE_CACHE).then((offCache) => {
                return offCache.match(OFFLINE_URL).then((fallback) => {
                  return fallback || new Response("You are offline", { status: 503, headers: { "Content-Type": "text/plain" } });
                });
              });
            });
          });
        })
    );
    return;
  }
});
