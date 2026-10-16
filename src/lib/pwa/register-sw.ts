/**
 * Service Worker Client Registration & Recovery Utility
 * Browser-only execution with resilience against hydration mismatches and unhandled errors.
 */

let isRegistered = false;

export interface RegisterSwOptions {
  scope?: string;
  forceInDev?: boolean;
}

/**
 * Registers the route-aware Service Worker safely in the browser.
 */
export async function registerServiceWorker(options: RegisterSwOptions = {}): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  // Avoid multiple registration calls within the same client session
  if (isRegistered) {
    return null;
  }

  const isProduction = process.env.NODE_ENV === "production" || import.meta.env?.PROD;
  const shouldRegister = isProduction || options.forceInDev;

  if (!shouldRegister) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: options.scope || "/",
    });

    isRegistered = true;

    // Listen for update events safely
    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version installed but waiting; can notify or update on navigation
          }
        });
      }
    });

    return registration;
  } catch (error) {
    // Fail gracefully without crashing the application shell or exposing credentials
    console.warn("Service worker registration failed (app will continue normally):", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

/**
 * Emergency recovery utility: unregisters the service worker and purges only
 * caches owned by this application.
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (registration.scope.includes(window.location.origin)) {
        await registration.unregister();
      }
    }

    const cacheStorage = typeof caches !== "undefined" ? caches : (typeof window !== "undefined" && "caches" in window ? (window as any).caches : null);
    if (cacheStorage) {
      const keys = await cacheStorage.keys();
      for (const key of keys) {
        if (key.startsWith("cobralearn-")) {
          await cacheStorage.delete(key);
        }
      }
    }

    isRegistered = false;
    return true;
  } catch (error) {
    console.error("Failed to unregister service worker:", error);
    return false;
  }
}

/**
 * Resets internal registration flag for isolated unit testing.
 */
export function _resetRegistrationStateForTesting() {
  isRegistered = false;
}
