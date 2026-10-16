import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  translate,
  TRANSLATIONS,
  type TranslationKey,
} from "@/lib/i18n/translations";
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_PORTAL_PREFERENCES,
  type LanguageOption,
} from "@/lib/preferences";
import {
  AdminAppearanceContext,
  useAdminAppearance,
  type AdminAppearanceContextValue,
} from "@/lib/theme/admin-appearance-context";

// Mock TanStack Router Link and useRouterState so Link can render in isolated test environment
vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<any>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({ children, to, onClick, className, id, ...props }: any) => (
      <a href={to} onClick={onClick} className={className} id={id} {...props}>
        {children}
      </a>
    ),
    useRouterState: () => ({ location: { pathname: "/admin/projects" } }),
  };
});

// Components to verify
import { ProjectsBanner } from "@/components/projects/ProjectsBanner";
import { WebsitesBanner } from "@/components/websites/WebsitesBanner";
import { AdvertisementsBanner } from "@/components/advertisements/AdvertisementsBanner";
import { AwardsBanner } from "@/components/awards/AwardsBanner";
import { WebsiteStats } from "@/components/websites/WebsiteStats";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { AppearanceTabs } from "@/components/appearance/AppearanceTabs";
import { ContactTabs } from "@/components/contact/ContactTabs";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";

describe("Admin Portal Complete Localization Verification Suite", () => {
  describe("Phase 1 & 2: Route Inventory & Translation Parity", () => {
    const AUDITED_MODULES = [
      "Dashboard",
      "Projects",
      "Websites",
      "Advertisements",
      "Awards",
      "Media Library",
      "Homepage",
      "Navigation & Footer",
      "Contact",
      "Notifications",
      "Appearance & Animation",
      "Site Settings",
      "Admin Profile",
    ];

    it("verifies all core admin modules are represented in translation keys", () => {
      expect(AUDITED_MODULES.length).toBe(13);
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(TRANSLATIONS[lang]["nav.dashboard"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.projects"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.websites"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.advertisements"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.awards"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.mediaLibrary"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.homepage"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.navigationFooter"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.contact"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.notifications"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.appearanceAnimation"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.siteSettings"]).toBeTruthy();
        expect(TRANSLATIONS[lang]["nav.adminProfile"]).toBeTruthy();
      }
    });

    it("ensures zero missing or empty translation keys across all 5 languages", () => {
      const englishKeys = Object.keys(TRANSLATIONS.English) as TranslationKey[];
      expect(englishKeys.length).toBeGreaterThan(80);

      for (const lang of SUPPORTED_LANGUAGES) {
        const dict = TRANSLATIONS[lang];
        for (const key of englishKeys) {
          const val = dict[key];
          expect(val, `Missing key "${key}" in language "${lang}"`).toBeDefined();
          expect(val.trim().length, `Empty string for key "${key}" in language "${lang}"`).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Phase 3: Component Rendering Across Languages", () => {
    function createMockAppearanceContext(language: LanguageOption): AdminAppearanceContextValue {
      return {
        theme: "dark",
        effectiveTheme: "dark",
        selectedAccent: DEFAULT_PORTAL_PREFERENCES.selectedAccent,
        sidebarCollapse: DEFAULT_PORTAL_PREFERENCES.sidebarCollapse,
        language,
        timezone: DEFAULT_PORTAL_PREFERENCES.timezone,
        t: (key: TranslationKey) => translate(key, language),
        formatDate: (d) => String(d),
        formatRelativeTime: () => "just now",
      };
    }

    function renderWithLanguage(ui: React.ReactElement, language: LanguageOption) {
      const value = createMockAppearanceContext(language);
      return render(
        <AdminAppearanceContext.Provider value={value}>
          {ui}
        </AdminAppearanceContext.Provider>
      );
    }

    it("renders ProjectsBanner in Hindi with localized title and subtitle", () => {
      renderWithLanguage(<ProjectsBanner totalProjects={12} publishedCount={8} />, "Hindi");
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(translate("banner.projects.title", "Hindi"));
      expect(screen.getByText(translate("banner.projects.subtitle", "Hindi"))).toBeDefined();
    });

    it("renders WebsitesBanner in Spanish with localized title and subtitle", () => {
      renderWithLanguage(<WebsitesBanner totalWebsites={5} publishedCount={3} />, "Spanish");
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(translate("banner.websites.title", "Spanish"));
      expect(screen.getByText(translate("banner.websites.subtitle", "Spanish"))).toBeDefined();
    });

    it("renders AdvertisementsBanner in French with localized title and subtitle", () => {
      renderWithLanguage(<AdvertisementsBanner totalAds={4} publishedCount={2} />, "French");
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(translate("banner.advertisements.title", "French"));
      expect(screen.getByText(translate("banner.advertisements.subtitle", "French"))).toBeDefined();
    });

    it("renders AwardsBanner in German with localized title and subtitle", () => {
      renderWithLanguage(<AwardsBanner totalAwards={7} publishedCount={5} />, "German");
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(translate("banner.awards.title", "German"));
      expect(screen.getByText(translate("banner.awards.subtitle", "German"))).toBeDefined();
    });

    it("renders WebsiteStats in Spanish with localized cards and buttons", () => {
      renderWithLanguage(
        <WebsiteStats total={10} published={6} draft={3} archived={1} />,
        "Spanish"
      );
      expect(screen.getByText("Sitios web totales")).toBeDefined();
      expect(screen.getByText("Publicado")).toBeDefined();
      expect(screen.getByText("Borrador")).toBeDefined();
      expect(screen.getByText("Archivado")).toBeDefined();
      expect(screen.getByText("Añadir sitio web")).toBeDefined();
    });

    it("renders SettingsTabs in German with all tab labels localized", () => {
      renderWithLanguage(<SettingsTabs activeTab="general" onTabChange={() => {}} />, "German");
      expect(screen.getByText("Allgemein")).toBeDefined();
      expect(screen.getByText("Sicherheit")).toBeDefined();
      expect(screen.getByText("Wartung")).toBeDefined();
      expect(screen.getByText("Erweitert")).toBeDefined();
    });

    it("renders AppearanceTabs in French with tab labels localized", () => {
      renderWithLanguage(<AppearanceTabs activeTab="theme-colors" onTabChange={() => {}} />, "French");
      expect(screen.getByText("Thème et couleurs")).toBeDefined();
      expect(screen.getByText("Animations")).toBeDefined();
      expect(screen.getByText("Disposition et réactivité")).toBeDefined();
    });

    it("renders ContactTabs in Hindi with tab labels localized", () => {
      renderWithLanguage(<ContactTabs activeTab="general" onTabChange={() => {}} />, "Hindi");
      expect(screen.getByText("सामान्य और हीरो")).toBeDefined();
      expect(screen.getByText("संपर्क जानकारी")).toBeDefined();
      expect(screen.getByText("सोशल लिंक")).toBeDefined();
    });

    it("renders DeleteConfirmationModal in French with localized default labels", () => {
      renderWithLanguage(
        <DeleteConfirmationModal
          open={true}
          onOpenChange={() => {}}
          onConfirm={() => {}}
          itemType="Project"
        />,
        "French"
      );
      expect(screen.getByText("Supprimer Project")).toBeDefined();
      expect(screen.getByText("Annuler")).toBeDefined();
    });
  });

  describe("Phase 4: Dynamic Messages and Validation States", () => {
    it("translates error states and retry messages correctly across all 5 languages", () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        const errorTitle = translate("error.somethingWentWrong", lang);
        const retryBtn = translate("error.tryAgain", lang);
        const goBackBtn = translate("error.goBack", lang);

        expect(errorTitle.length).toBeGreaterThan(0);
        expect(retryBtn.length).toBeGreaterThan(0);
        expect(goBackBtn.length).toBeGreaterThan(0);
      }
    });

    it("translates notification categories dynamically for alert dispatches", () => {
      const categories: TranslationKey[] = [
        "notif.category.contactInquiry",
        "notif.category.contentUpdate",
        "notif.category.securityAlert",
        "notif.category.adminActivity",
        "notif.category.announcement",
      ];

      for (const cat of categories) {
        expect(translate(cat, "Hindi")).not.toBe(translate(cat, "English"));
        expect(translate(cat, "Spanish")).not.toBe(translate(cat, "German"));
      }
    });
  });

  describe("Phase 5: Immediate Shared Context Reactivity", () => {
    it("reflects language switch dynamically across consumer components", () => {
      function LanguageConsumer() {
        const { t, language } = useAdminAppearance();
        return (
          <div>
            <span data-testid="lang-display">{language}</span>
            <span data-testid="title-display">{t("banner.projects.title")}</span>
          </div>
        );
      }

      function SwitcherWrapper({ currentLang }: { currentLang: LanguageOption }) {
        const value: AdminAppearanceContextValue = {
          theme: "dark",
          effectiveTheme: "dark",
          selectedAccent: DEFAULT_PORTAL_PREFERENCES.selectedAccent,
          sidebarCollapse: false,
          language: currentLang,
          timezone: DEFAULT_PORTAL_PREFERENCES.timezone,
          t: (key) => translate(key, currentLang),
          formatDate: (d) => String(d),
          formatRelativeTime: () => "just now",
        };

        return (
          <AdminAppearanceContext.Provider value={value}>
            <LanguageConsumer />
          </AdminAppearanceContext.Provider>
        );
      }

      // Render English
      const { rerender } = render(<SwitcherWrapper currentLang="English" />);
      expect(screen.getByTestId("lang-display").textContent).toBe("English");
      expect(screen.getByTestId("title-display").textContent).toBe("Projects");

      // Rerender as Hindi without reload
      rerender(<SwitcherWrapper currentLang="Hindi" />);
      expect(screen.getByTestId("lang-display").textContent).toBe("Hindi");
      expect(screen.getByTestId("title-display").textContent).toBe("प्रोजेक्ट");

      // Rerender as German without reload
      rerender(<SwitcherWrapper currentLang="German" />);
      expect(screen.getByTestId("lang-display").textContent).toBe("German");
      expect(screen.getByTestId("title-display").textContent).toBe("Projekte");
    });
  });
});
