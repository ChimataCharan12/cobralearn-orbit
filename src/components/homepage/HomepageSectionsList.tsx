import {
  GripVertical,
  Home,
  LayoutGrid,
  BarChart3,
  Star,
  MessageSquare,
  Megaphone,
  Box,
  Bell,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { type HomepageSection } from "@/lib/homepage-data";
import { type HomepageSectionWithMedia } from "@/lib/server/homepage-operations";

interface HomepageSectionsListProps {
  sections: Array<HomepageSection | HomepageSectionWithMedia>;
  activeId: string;
  onSelectSection: (id: string) => void;
  onToggleEnabled: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onDeleteSection?: (id: string) => void;
}

const ICON_MAP: Record<string, any> = {
  Home,
  LayoutGrid,
  BarChart3,
  Star,
  MessageSquare,
  Megaphone,
  Box,
  Bell,
};

const CORE_SECTION_IDS = new Set(["sec-hero", "sec-featured", "sec-projects", "sec-cta"]);

export function HomepageSectionsList({
  sections,
  activeId,
  onSelectSection,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
  onDeleteSection,
}: HomepageSectionsListProps) {
  return (
    <div className="flex flex-col rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="mb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Homepage Sections</h3>
        <p className="text-[12px] text-muted-foreground">Order and toggle sections displayed on your public homepage</p>
      </div>

      <div className="space-y-2">
        {sections.map((section, idx) => {
          const Icon = ICON_MAP[section.iconName] || Home;
          const isActive = section.id === activeId;
          const isCore = CORE_SECTION_IDS.has(section.id);

          return (
            <div
              key={section.id}
              onClick={() => onSelectSection(section.id)}
              className={`card-interactive group flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer ${
                isActive
                  ? "border-brand-bright bg-brand/15 shadow-[0_0_14px_rgba(0,255,170,0.22)]"
                  : "border-brand/15 bg-background/50 hover:bg-background/80"
              }`}
            >
              {/* Top highlight streak */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              {/* Left drag handle + order buttons + number + icon + label */}
              <div className="flex items-center gap-2 min-w-0">
                {/* Reorder Up/Down Controls */}
                <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMoveUp?.(section.id)}
                    aria-label={`Move ${section.name} Up`}
                    className="p-0.5 text-muted-foreground hover:text-brand-bright disabled:opacity-20 disabled:hover:text-muted-foreground transition"
                  >
                    <ChevronUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === sections.length - 1}
                    onClick={() => onMoveDown?.(section.id)}
                    aria-label={`Move ${section.name} Down`}
                    className="p-0.5 text-muted-foreground hover:text-brand-bright disabled:opacity-20 disabled:hover:text-muted-foreground transition"
                  >
                    <ChevronDown className="size-3" />
                  </button>
                </div>

                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-brand/15 text-[11px] font-bold text-brand-bright">
                  {idx + 1}
                </span>
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand-bright">
                  <Icon className="size-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`truncate text-[13px] font-medium ${isActive ? "text-foreground font-semibold" : "text-foreground/85"}`}>
                    {section.name}
                  </span>
                  <span className="truncate text-[10.5px] text-muted-foreground">
                    {section.title}
                  </span>
                </div>
              </div>

              {/* Right Toggle Switch + Delete + Chevron */}
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {!isCore && onDeleteSection && (
                  <button
                    type="button"
                    onClick={() => onDeleteSection(section.id)}
                    aria-label={`Delete ${section.name}`}
                    className="flex size-6 items-center justify-center rounded-md border border-red-500/25 text-red-400 hover:bg-red-950/30 transition"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}

                {/* Switch */}
                <button
                  type="button"
                  onClick={() => onToggleEnabled(section.id)}
                  aria-label={`Toggle ${section.name}`}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    section.enabled ? "bg-brand-bright" : "bg-muted-foreground/40"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                      section.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <ChevronRight className={`size-4 ${isActive ? "text-brand-bright" : "text-muted-foreground/60"}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
