import {
  Settings,
  Search,
  Layers,
  Mail,
  Shield,
  BarChart2,
  Wrench,
  SlidersHorizontal,
} from "lucide-react";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";
import type { TranslationKey } from "@/lib/i18n/translations";

export type SettingsTabId =
  | "general"
  | "seo"
  | "integrations"
  | "email"
  | "security"
  | "analytics"
  | "maintenance"
  | "advanced";

interface SettingsTabsProps {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
}

const TABS: { id: SettingsTabId; label: string; translationKey: TranslationKey; icon: any }[] = [
  { id: "general", label: "General", translationKey: "settings.tab.general", icon: Settings },
  { id: "seo", label: "SEO & Meta", translationKey: "settings.tab.seo", icon: Search },
  { id: "integrations", label: "Integrations", translationKey: "settings.tab.integrations", icon: Layers },
  { id: "email", label: "Email & Notifications", translationKey: "settings.tab.email", icon: Mail },
  { id: "security", label: "Security", translationKey: "settings.tab.security", icon: Shield },
  { id: "analytics", label: "Analytics", translationKey: "settings.tab.analytics", icon: BarChart2 },
  { id: "maintenance", label: "Maintenance", translationKey: "settings.tab.maintenance", icon: Wrench },
  { id: "advanced", label: "Advanced", translationKey: "settings.tab.advanced", icon: SlidersHorizontal },
];

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
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
