import { Info, Link as LinkIcon, BookOpen, Mail, Share2, Plus, Pencil, Trash2, Box } from "lucide-react";
import { type FooterSectionItem } from "@/lib/navigation-data";
import { type FooterSectionWithLinks } from "@/lib/server/navigation-operations";

interface FooterSectionsManagerProps {
  sections: Array<FooterSectionItem | FooterSectionWithLinks | any>;
  onAddSection: () => void;
  onEditSection: (section: any) => void;
  onDeleteSection: (id: string) => void;
  onMoveSection?: (id: string, direction: "up" | "down") => void;
}

const FOOTER_ICON_MAP: Record<string, any> = {
  Box,
  Info,
  Link: LinkIcon,
  BookOpen,
  Mail,
  Share2,
};

export function FooterSectionsManager({
  sections,
  onAddSection,
  onEditSection,
  onDeleteSection,
  onMoveSection,
}: FooterSectionsManagerProps) {
  return (
    <div className="flex flex-col rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand/15 pb-3 mb-3.5">
        <div>
          <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Footer Content</h3>
          <p className="text-[12px] text-muted-foreground">Manage footer sections, links, and settings.</p>
        </div>

        <button
          type="button"
          onClick={onAddSection}
          className="flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-gradient-to-r from-brand to-brand-bright px-3.5 py-1.5 text-[12px] font-bold text-background shadow-[0_0_12px_rgba(0,255,170,0.3)] transition hover:brightness-110"
        >
          <Plus className="size-3.5" />
          <span>Add Footer Section</span>
        </button>
      </div>

      {/* Section Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sections.map((section, idx) => {
          const Icon = FOOTER_ICON_MAP[section.iconName] || Info;
          const linksCount = section.links?.length ?? section.linksCount ?? 0;
          const isVisible = section.isVisible ?? true;

          return (
            <div
              key={section.id}
              className={`card-interactive group flex flex-col justify-between rounded-xl border bg-background/60 p-3 transition ${
                isVisible ? "border-brand/25" : "border-muted-foreground/30 opacity-70"
              }`}
            >
              {/* Top highlight streak */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/35 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div>
                <div className="flex items-center gap-2">
                  {/* Reorder Buttons */}
                  {onMoveSection && (
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => onMoveSection(section.id, "up")}
                        aria-label="Move Section Up"
                        className="text-[10px] text-muted-foreground hover:text-brand-bright disabled:opacity-20 transition"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={idx === sections.length - 1}
                        onClick={() => onMoveSection(section.id, "down")}
                        aria-label="Move Section Down"
                        className="text-[10px] text-muted-foreground hover:text-brand-bright disabled:opacity-20 transition"
                      >
                        ▼
                      </button>
                    </div>
                  )}

                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-brand/35 bg-brand/15 text-brand-bright">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-display text-[13px] font-bold text-foreground">
                      {section.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">{linksCount} links</p>
                  </div>
                </div>

                {!isVisible && (
                  <span className="mt-1.5 inline-block text-[10px] font-medium text-amber-400 bg-amber-950/30 border border-amber-500/30 px-1.5 py-0.5 rounded">
                    Hidden on public site
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-3.5 flex items-center gap-2 pt-2 border-t border-brand/10">
                <button
                  type="button"
                  onClick={() => onEditSection(section)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-md border border-brand/25 py-1 text-[11px] font-medium text-muted-foreground hover:border-brand-bright/50 hover:text-brand-bright transition"
                >
                  <Pencil className="size-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSection(section.id)}
                  aria-label="Delete"
                  className="flex size-6 items-center justify-center rounded-md border border-red-500/25 text-red-400 hover:bg-red-950/30 transition"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
