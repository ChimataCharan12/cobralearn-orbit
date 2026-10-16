import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import {
  type ThemeOption,
  type AccentOption,
  type LanguageOption,
  type TimezoneOption,
  DEFAULT_PORTAL_PREFERENCES,
} from "@/lib/preferences";
import { translate, type TranslationKey } from "@/lib/i18n/translations";
import { formatAdminDateTime, formatAdminRelativeTime } from "@/lib/timezone";

export interface AdminAppearanceContextValue {
  theme: ThemeOption;
  effectiveTheme: "light" | "dark";
  selectedAccent: AccentOption;
  sidebarCollapse: boolean;
  language: LanguageOption;
  timezone: TimezoneOption;
  t: (key: TranslationKey) => string;
  formatDate: (date: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (date: Date | string | number | null | undefined) => string;
}

export const AdminAppearanceContext = createContext<AdminAppearanceContextValue | null>(null);

export function AdminAppearanceProvider({ children }: { children: ReactNode }) {
  const { preferences } = useAdminProfile();
  const portalPrefs = preferences.portal;

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const isAdminRoute = currentPath.startsWith("/admin");

  // Listen for OS dark-mode changes in real-time
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const theme: ThemeOption = "dark";
  const effectiveTheme: "dark" = "dark";

  const selectedAccent = portalPrefs.selectedAccent ?? DEFAULT_PORTAL_PREFERENCES.selectedAccent;
  const sidebarCollapse = Boolean(portalPrefs.sidebarCollapse);
  const language = portalPrefs.language ?? DEFAULT_PORTAL_PREFERENCES.language;
  const timezone = portalPrefs.timezone ?? DEFAULT_PORTAL_PREFERENCES.timezone;

  // Apply theme and accent attributes to document root only on admin routes to keep public site unaffected
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isAdminRoute) {
      document.documentElement.setAttribute("data-admin-theme", "dark");
      document.documentElement.setAttribute("data-admin-accent", selectedAccent);
      if (sidebarCollapse) {
        document.documentElement.setAttribute("data-admin-collapsed", "true");
      } else {
        document.documentElement.removeAttribute("data-admin-collapsed");
      }
      document.documentElement.classList.remove("admin-theme-light");
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.removeAttribute("data-admin-theme");
      document.documentElement.removeAttribute("data-admin-accent");
      document.documentElement.removeAttribute("data-admin-collapsed");
      document.documentElement.classList.remove("admin-theme-light");
    }

    return () => {
      // Cleanup if unmounted
      if (typeof document !== "undefined") {
        document.documentElement.removeAttribute("data-admin-theme");
        document.documentElement.removeAttribute("data-admin-accent");
        document.documentElement.classList.remove("admin-theme-light");
      }
    };
  }, [isAdminRoute, effectiveTheme, selectedAccent, sidebarCollapse]);

  const value: AdminAppearanceContextValue = useMemo(() => {
    return {
      theme,
      effectiveTheme,
      selectedAccent,
      sidebarCollapse,
      language,
      timezone,
      t: (key: TranslationKey) => translate(key, language),
      formatDate: (date, options) => formatAdminDateTime(date, timezone, options),
      formatRelativeTime: (date) => formatAdminRelativeTime(date, timezone),
    };
  }, [theme, effectiveTheme, selectedAccent, sidebarCollapse, language, timezone]);

  return (
    <AdminAppearanceContext.Provider value={value}>
      {children}
    </AdminAppearanceContext.Provider>
  );
}

export function useAdminAppearance(): AdminAppearanceContextValue {
  const ctx = useContext(AdminAppearanceContext);
  if (!ctx) {
    // Graceful fallback for components rendered outside AdminAppearanceProvider (e.g. isolated tests)
    return {
      theme: DEFAULT_PORTAL_PREFERENCES.theme,
      effectiveTheme: "dark",
      selectedAccent: DEFAULT_PORTAL_PREFERENCES.selectedAccent,
      sidebarCollapse: DEFAULT_PORTAL_PREFERENCES.sidebarCollapse,
      language: DEFAULT_PORTAL_PREFERENCES.language,
      timezone: DEFAULT_PORTAL_PREFERENCES.timezone,
      t: (key: TranslationKey) => translate(key, DEFAULT_PORTAL_PREFERENCES.language),
      formatDate: (date, options) => formatAdminDateTime(date, DEFAULT_PORTAL_PREFERENCES.timezone, options),
      formatRelativeTime: (date) => formatAdminRelativeTime(date, DEFAULT_PORTAL_PREFERENCES.timezone),
    };
  }
  return ctx;
}
