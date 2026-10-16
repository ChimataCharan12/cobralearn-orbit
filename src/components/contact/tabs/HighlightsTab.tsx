import { useState } from "react";
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Briefcase,
  Sparkles,
  ShieldCheck,
  Zap,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useContactConfig } from "@/lib/contact-store";
import { type ContactHighlight } from "@/lib/contact-data";
import { HighlightModal } from "@/components/contact/modals/HighlightModal";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";

interface HighlightsTabProps {
  onMarkDirty?: () => void;
}

export function HighlightsTab({ onMarkDirty }: HighlightsTabProps) {
  const {
    config,
    addHighlight,
    updateHighlight,
    deleteHighlight,
    reorderHighlights,
    resetConfigToDefault,
  } = useContactConfig();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState<ContactHighlight | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactHighlight | null>(null);

  const highlights = config.highlights;

  const handleToggleActive = (id: string, current: boolean) => {
    updateHighlight(id, { isActive: !current });
    toast.info(`Highlight ${!current ? "activated" : "deactivated"}.`);
    onMarkDirty?.();
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const copy = [...highlights];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= copy.length) return;
    const [moved] = copy.splice(index, 1);
    if (!moved) return;
    copy.splice(targetIndex, 0, moved);
    reorderHighlights(copy);
    onMarkDirty?.();
  };

  const handleSaveModal = (data: Omit<ContactHighlight, "id" | "order">) => {
    if (editingHighlight) {
      updateHighlight(editingHighlight.id, data);
      toast.success(`Updated "${data.title}".`);
    } else {
      addHighlight(data);
      toast.success(`Added highlight "${data.title}".`);
    }
    setEditingHighlight(null);
    onMarkDirty?.();
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteHighlight(deleteTarget.id);
    toast.success(`Deleted highlight "${deleteTarget.title}".`);
    setDeleteTarget(null);
    onMarkDirty?.();
  };

  const handleReset = () => {
    resetConfigToDefault();
    toast.info("Collaboration highlights reset to defaults.");
    onMarkDirty?.();
  };

  const renderIcon = (iconName: string, accent: string) => {
    let colorClass = "text-[#00ff87]";
    if (accent === "amber") colorClass = "text-[#f59e0b]";
    if (accent === "cyan") colorClass = "text-[#00d2ff]";

    switch (iconName) {
      case "Sparkles":
        return <Sparkles className={`size-4 ${colorClass}`} />;
      case "ShieldCheck":
        return <ShieldCheck className={`size-4 ${colorClass}`} />;
      case "Zap":
        return <Zap className={`size-4 ${colorClass}`} />;
      case "Layers":
        return <Layers className={`size-4 ${colorClass}`} />;
      default:
        return <Briefcase className={`size-4 ${colorClass}`} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand/25 bg-panel/85 p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-brand/15">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-brand/35 bg-brand/10 text-brand-bright">
              <Layers className="size-4" />
            </div>
            <div>
              <h3 className="font-display text-[15px] font-bold text-foreground text-glow">
                Collaboration Highlights
              </h3>
              <p className="text-[12px] text-muted-foreground">
                Manage the highlight cards displayed beneath the hero description.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/50 px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground transition hover:border-brand-bright/40 hover:text-foreground cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingHighlight(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brand-bright px-3.5 py-1.5 text-[12px] font-bold text-black shadow-[0_0_12px_var(--brand-bright)] hover:bg-brand-bright/90 cursor-pointer"
            >
              <Plus className="size-3.5 stroke-[3]" />
              <span>Add Highlight</span>
            </button>
          </div>
        </div>

        {/* Highlights List */}
        {highlights.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Layers className="mx-auto size-8 text-brand/40 mb-2" />
            <p className="text-[13px] font-semibold text-foreground">No highlights configured</p>
            <p className="text-[11.5px] text-muted-foreground">Click "Add Highlight" to create one.</p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {highlights.map((hl, index) => {
              let borderAccentClass = "border-[#00ff87]/25 bg-[#02140a]/70";
              if (hl.accent === "amber") borderAccentClass = "border-[#f59e0b]/25 bg-[#140e02]/70";
              if (hl.accent === "cyan") borderAccentClass = "border-[#00d2ff]/25 bg-[#021014]/70";

              return (
                <div
                  key={hl.id}
                  className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                    hl.isActive
                      ? borderAccentClass
                      : "border-white/10 bg-background/20 opacity-50"
                  }`}
                >
                  {/* Left: Reorder + Icon + Title & Desc */}
                  <div className="flex items-center gap-3.5 min-w-[240px]">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMove(index, "up")}
                        className="text-[10px] text-muted-foreground hover:text-white disabled:opacity-20 cursor-pointer"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={index === highlights.length - 1}
                        onClick={() => handleMove(index, "down")}
                        className="text-[10px] text-muted-foreground hover:text-white disabled:opacity-20 cursor-pointer"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="size-9 rounded-lg border border-brand/35 bg-background/80 flex items-center justify-center shrink-0 shadow-sm">
                      {renderIcon(hl.icon, hl.accent)}
                    </div>

                    <div>
                      <p className="font-display text-[13.5px] font-bold text-white leading-tight">
                        {hl.title}
                      </p>
                      <p className="text-[11.5px] text-[#94a3b8] mt-0.5 line-clamp-1">
                        {hl.description}
                      </p>
                    </div>
                  </div>

                  {/* Accent tag */}
                  <div className="hidden sm:block text-[11px] font-mono text-muted-foreground uppercase">
                    Accent: <span className="text-foreground font-semibold">{hl.accent}</span>
                  </div>

                  {/* Right: Toggle + Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(hl.id, hl.isActive)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        hl.isActive ? "bg-brand-bright" : "bg-muted-foreground/30"
                      }`}
                      title={hl.isActive ? "Active" : "Inactive"}
                    >
                      <span
                        className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ${
                          hl.isActive ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingHighlight(hl);
                        setModalOpen(true);
                      }}
                      className="grid size-8 place-items-center rounded-lg border border-brand/20 bg-background/50 text-muted-foreground hover:border-brand-bright/40 hover:text-foreground cursor-pointer transition"
                      title="Edit highlight"
                    >
                      <Edit2 className="size-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(hl)}
                      className="grid size-8 place-items-center rounded-lg border border-red-500/20 bg-background/50 text-muted-foreground hover:border-red-500/40 hover:text-red-400 cursor-pointer transition"
                      title="Delete highlight"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      <HighlightModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingHighlight(null);
        }}
        onSave={handleSaveModal}
        initialData={editingHighlight}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmationModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        itemType="Highlight"
        itemName={deleteTarget?.title}
        itemDescription={deleteTarget?.description}
      />
    </div>
  );
}
