import {
  Palette,
  Type,
  Box,
  Sparkles,
  Wand2,
  LayoutTemplate,
  Compass,
} from "lucide-react";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";
import type { TranslationKey } from "@/lib/i18n/translations";

export type AppearanceTabId =
  | "theme-colors"
  | "typography"
  | "components"
  | "animations"
  | "backgrounds-effects"
  | "layout-responsive"
  | "branding";

interface AppearanceTabsProps {
  activeTab: AppearanceTabId;
  onTabChange: (tab: AppearanceTabId) => void;
}

const TABS: { id: AppearanceTabId; label: string; translationKey: TranslationKey; icon: any }[] = [
  { id: "theme-colors", label: "Theme & Colors", translationKey: "appearance.tab.themeColors", icon: Palette },
  { id: "typography", label: "Typography", translationKey: "appearance.tab.typography", icon: Type },
  { id: "components", label: "Components", translationKey: "appearance.tab.components", icon: Box },
  { id: "animations", label: "Animations", translationKey: "appearance.tab.animations", icon: Sparkles },
  { id: "backgrounds-effects", label: "Backgrounds & Effects", translationKey: "appearance.tab.backgroundsEffects", icon: Wand2 },
  { id: "layout-responsive", label: "Layout & Responsive", translationKey: "appearance.tab.layoutResponsive", icon: LayoutTemplate },
  { id: "branding", label: "Branding", translationKey: "appearance.tab.branding", icon: Compass },
];

export function AppearanceTabs({ activeTab, onTabChange }: AppearanceTabsProps) {
  const { t } = useAdminAppearance();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-brand/15 pb-2 text-[13px] font-medium scrollbar-none">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all duration-200 cursor-pointer whitespace-nowrap ${
              isActive
                ? "border border-brand-bright/70 bg-gradient-to-r from-brand/25 to-brand-bright/15 text-brand-bright shadow-[0_0_14px_rgba(0,255,170,0.22)] font-semibold"
                : "border border-transparent text-muted-foreground hover:border-brand/30 hover:bg-brand/10 hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span>{t(tab.translationKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
