import { User, Shield, Sliders, Clock, History } from "lucide-react";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";
import type { TranslationKey } from "@/lib/i18n/translations";

export type ProfileTabId = "profile-info" | "security" | "preferences" | "activity-sessions" | "login-history";

interface ProfileTabsProps {
  activeTab: ProfileTabId;
  onTabChange: (tab: ProfileTabId) => void;
}

const TABS: { id: ProfileTabId; labelKey: TranslationKey; icon: any }[] = [
  { id: "profile-info", labelKey: "profile.tab.info", icon: User },
  { id: "security", labelKey: "profile.tab.security", icon: Shield },
  { id: "preferences", labelKey: "profile.tab.preferences", icon: Sliders },
  { id: "activity-sessions", labelKey: "profile.tab.activity", icon: Clock },
  { id: "login-history", labelKey: "profile.tab.loginHistory", icon: History },
];

export function ProfileTabs({ activeTab, onTabChange }: ProfileTabsProps) {
  const { t } = useAdminAppearance();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-brand/15 pb-2 text-[13px] font-medium scrollbar-none">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;
        const label = t(tab.labelKey);

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
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
