import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";

import { NotFoundPage } from "@/components/system/NotFoundPage";
import { ContactFloatingButton } from "@/components/public/ContactFloatingButton";
import { AuthProvider } from "@/lib/auth/use-auth";
import { AdminAppearanceProvider } from "@/lib/theme/admin-appearance-context";
import { AdminRouteTransitionIndicator } from "@/components/system/AdminRouteTransitionIndicator";
import { DEFAULT_OG_IMAGE } from "@/lib/public-metadata";
import { getPublicAppearanceConfigServerFn } from "@/lib/server/settings-server-fns";
import {
  DEFAULT_PUBLIC_APPEARANCE_CONFIG,
  type PublicAppearanceConfig,
} from "@/lib/public-appearance";
import { PublicAppearanceProvider } from "@/lib/theme/public-appearance-context";
import { registerServiceWorker } from "@/lib/pwa/register-sw";
import { AppSplashOrchestrator } from "@/components/splash/AppSplashOrchestrator";
import { AdminPortalBoundary } from "@/components/auth/AdminPortalBoundary";
import { setAuthNavigationHandler } from "@/lib/auth/auth-error-handling";

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => {
    try {
      const res = await getPublicAppearanceConfigServerFn();
      return { publicAppearance: res.appearance };
    } catch {
      return { publicAppearance: DEFAULT_PUBLIC_APPEARANCE_CONFIG };
    }
  },
  head: ({ loaderData, matches }: any) => {
    const isAdminRoute =
      Array.isArray(matches) &&
      matches.some(
        (m: any) =>
          (typeof m?.routeId === "string" && m.routeId.startsWith("/admin")) ||
          (typeof m?.pathname === "string" && m.pathname.startsWith("/admin")),
      );
    const manifestHref = isAdminRoute ? "/manifest-admin.webmanifest" : "/manifest.webmanifest";
    const themeColor = isAdminRoute ? "#020604" : "#020806";
    const faviconHref = loaderData?.publicAppearance?.faviconUrl || "/favicon.png";
    const rootTitle = isAdminRoute
      ? "CobraLearn Innotechcore Admin"
      : "CobraLearn Innotechcore — Learn, Build, Grow";
    const rootDescription = isAdminRoute
      ? "Private administration portal for the CobraLearn showcase."
      : "CobraLearn Innotechcore showcase platform.";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: themeColor },
        { title: rootTitle },
        { name: "description", content: rootDescription },
        { name: "author", content: "CobraLearn Innotechcore" },
        { property: "og:type", content: "website" },
        { property: "og:image", content: DEFAULT_OG_IMAGE },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Orbitron:wght@500;600;700&family=Oxanium:wght@400;500;600;700&family=Rajdhani:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
        },
        { rel: "icon", href: faviconHref, type: "image/png" },
        { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
        { rel: "manifest", href: manifestHref, id: "app-manifest" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorComponent,
});

if (typeof window !== "undefined") {
  const w = window as any;
  w.process = w.process || { env: {} };
  w.process.env = w.process.env || {};
  if (!w.process.env.TSS_SERVER_FN_BASE) {
    w.process.env.TSS_SERVER_FN_BASE = "/_serverFn/";
  }
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.process = window.process || { env: {} }; window.process.env = window.process.env || {}; window.process.env.TSS_SERVER_FN_BASE = window.process.env.TSS_SERVER_FN_BASE || "/_serverFn/";`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  const router = useRouter();

  useEffect(() => {
    registerServiceWorker();
    setAuthNavigationHandler((to) => {
      router.navigate({ to: to as any });
    });
    return () => {
      setAuthNavigationHandler(null);
    };
  }, [router]);

  let publicAppearance: PublicAppearanceConfig = DEFAULT_PUBLIC_APPEARANCE_CONFIG;
  try {
    const loaderData = Route.useLoaderData();
    if (loaderData?.publicAppearance) {
      publicAppearance = loaderData.publicAppearance;
    }
  } catch {
    // Graceful fallback for non-routed or test environments
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AdminAppearanceProvider>
          <PublicAppearanceProvider appearance={publicAppearance}>
            {/* Cinematic PWA Splash Screen (CobraLearn Nexus for public, CobraLearn Orbit for admin) */}
            <AppSplashOrchestrator />
            {/* Branded transition indicator for genuine route transitions */}
            <AdminRouteTransitionIndicator />
            {/* Required: nested routes render here. Protected portal routes are guarded against content flash. */}
            <AdminPortalBoundary>
              <Outlet />
            </AdminPortalBoundary>
            {/* Persistent floating Contact CTA across all public pages */}
            <ContactFloatingButton />
          </PublicAppearanceProvider>
        </AdminAppearanceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

