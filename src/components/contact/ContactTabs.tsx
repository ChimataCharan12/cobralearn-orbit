import {
  Sparkles,
  Phone,
  Share2,
  Layers,
  HelpCircle,
  FileText,
} from "lucide-react";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";
import type { TranslationKey } from "@/lib/i18n/translations";

export type ContactTabId =
  | "general"
  | "info"
  | "social"
  | "highlights"
  | "faqs"
  | "form";

interface ContactTabsProps {
  activeTab: ContactTabId;
  onTabChange: (tab: ContactTabId) => void;
}

const TABS: Array<{
  id: ContactTabId;
  label: string;
  translationKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "general", label: "General & Hero", translationKey: "contact.tab.generalHero", icon: Sparkles },
  { id: "info", label: "Contact Information", translationKey: "contact.tab.contactInfo", icon: Phone },
  { id: "social", label: "Social Links", translationKey: "contact.tab.socialLinks", icon: Share2 },
  { id: "highlights", label: "Highlights", translationKey: "contact.tab.highlights", icon: Layers },
  { id: "faqs", label: "FAQs", translationKey: "contact.tab.faqs", icon: HelpCircle },
  { id: "form", label: "Form Settings", translationKey: "contact.tab.formSettings", icon: FileText },
];

export function ContactTabs({ activeTab, onTabChange }: ContactTabsProps) {
  const { t } = useAdminAppearance();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-brand/20 bg-panel/85 p-1.5 backdrop-blur-md">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition-all duration-200 shrink-0 cursor-pointer ${
              isActive
                ? "border border-brand-bright/70 bg-brand/25 text-brand-bright shadow-[0_0_14px_color-mix(in_oklab,var(--brand)_25%,transparent)]"
                : "border border-transparent text-muted-foreground hover:bg-background/40 hover:text-foreground"
            }`}
          >
            <Icon className={`size-4 ${isActive ? "text-brand-bright" : "text-muted-foreground"}`} />
            <span>{t(tab.translationKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
