import { useState } from "react";
import {
  HelpCircle,
  Plus,
  Edit2,
  Trash2,
  Briefcase,
  Users,
  Clock,
  Sparkles,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useContactConfig } from "@/lib/contact-store";
import { type ContactFaq } from "@/lib/contact-data";
import { FaqModal } from "@/components/contact/modals/FaqModal";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";

interface FaqsTabProps {
  onMarkDirty?: () => void;
}

export function FaqsTab({ onMarkDirty }: FaqsTabProps) {
  const {
    config,
    addFaq,
    updateFaq,
    deleteFaq,
    reorderFaqs,
    resetConfigToDefault,
  } = useContactConfig();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<ContactFaq | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactFaq | null>(null);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  const faqs = config.faqs;

  const handleToggleActive = (id: string, current: boolean) => {
    updateFaq(id, { isActive: !current });
    toast.info(`FAQ ${!current ? "activated" : "deactivated"}.`);
    onMarkDirty?.();
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const copy = [...faqs];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= copy.length) return;
    const [moved] = copy.splice(index, 1);
    if (!moved) return;
    copy.splice(targetIndex, 0, moved);
    reorderFaqs(copy);
    onMarkDirty?.();
  };

  const handleSaveModal = (data: Omit<ContactFaq, "id" | "order">) => {
    if (editingFaq) {
      updateFaq(editingFaq.id, data);
      toast.success(`Updated FAQ.`);
    } else {
      addFaq(data);
      toast.success(`Added new FAQ.`);
    }
    setEditingFaq(null);
    onMarkDirty?.();
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteFaq(deleteTarget.id);
    toast.success(`Deleted FAQ item.`);
    setDeleteTarget(null);
    onMarkDirty?.();
  };

  const handleReset = () => {
    resetConfigToDefault();
    toast.info("FAQs reset to defaults.");
    onMarkDirty?.();
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "Users":
        return <Users className="size-4 text-[#f59e0b]" />;
      case "Clock":
        return <Clock className="size-4 text-[#f59e0b]" />;
      case "Sparkles":
        return <Sparkles className="size-4 text-[#f59e0b]" />;
      case "Briefcase":
        return <Briefcase className="size-4 text-[#f59e0b]" />;
      default:
        return <HelpCircle className="size-4 text-[#f59e0b]" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand/25 bg-panel/85 p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-brand/15">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-brand/35 bg-brand/10 text-brand-bright">
              <HelpCircle className="size-4" />
            </div>
            <div>
              <h3 className="font-display text-[15px] font-bold text-foreground text-glow">
                Frequently Asked Questions
              </h3>
              <p className="text-[12px] text-muted-foreground">
                Manage questions and answers displayed in the public accordion grid.
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
                setEditingFaq(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brand-bright px-3.5 py-1.5 text-[12px] font-bold text-black shadow-[0_0_12px_var(--brand-bright)] hover:bg-brand-bright/90 cursor-pointer"
            >
              <Plus className="size-3.5 stroke-[3]" />
              <span>Add FAQ</span>
            </button>
          </div>
        </div>

        {/* FAQs List */}
        {faqs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <HelpCircle className="mx-auto size-8 text-brand/40 mb-2" />
            <p className="text-[13px] font-semibold text-foreground">No FAQs configured</p>
            <p className="text-[11.5px] text-muted-foreground">Click "Add FAQ" to create your first query.</p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {faqs.map((faq, index) => {
              const isExpanded = expandedFaqId === faq.id;

              return (
                <div
                  key={faq.id}
                  className={`rounded-xl border transition-all ${
                    faq.isActive
                      ? "border-brand/25 bg-background/60 hover:border-brand/40"
                      : "border-white/10 bg-background/20 opacity-50"
                  }`}
                >
                  {/* Top Summary Row */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3.5">
                    {/* Left: Reorder + Icon + Question */}
                    <div className="flex items-center gap-3.5 min-w-[240px] flex-1">
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
                          disabled={index === faqs.length - 1}
                          onClick={() => handleMove(index, "down")}
                          className="text-[10px] text-muted-foreground hover:text-white disabled:opacity-20 cursor-pointer"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>

                      <div className="size-9 rounded-xl border border-[#f59e0b]/40 bg-[#201502] flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                        {renderIcon(faq.icon)}
                      </div>

                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                          className="text-left font-display text-[13.5px] font-bold text-white hover:text-brand-bright transition cursor-pointer flex items-center gap-2"
                        >
                          <span>{faq.question}</span>
                          <ChevronDown
                            className={`size-3.5 text-muted-foreground transition-transform ${
                              isExpanded ? "rotate-180 text-brand-bright" : ""
                            }`}
                          />
                        </button>
                        <p className="text-[10.5px] text-muted-foreground">Order: #{index + 1}</p>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(faq.id, faq.isActive)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                          faq.isActive ? "bg-brand-bright" : "bg-muted-foreground/30"
                        }`}
                        title={faq.isActive ? "Active" : "Inactive"}
                      >
                        <span
                          className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ${
                            faq.isActive ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingFaq(faq);
                          setModalOpen(true);
                        }}
                        className="grid size-8 place-items-center rounded-lg border border-brand/20 bg-background/50 text-muted-foreground hover:border-brand-bright/40 hover:text-foreground cursor-pointer transition"
                        title="Edit FAQ"
                      >
                        <Edit2 className="size-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(faq)}
                        className="grid size-8 place-items-center rounded-lg border border-red-500/20 bg-background/50 text-muted-foreground hover:border-red-500/40 hover:text-red-400 cursor-pointer transition"
                        title="Delete FAQ"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Answer Content */}
                  {isExpanded && (
                    <div className="px-4 pb-3.5 pt-1 border-t border-brand/10 text-[12px] text-[#cbd5e1] leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      <FaqModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingFaq(null);
        }}
        onSave={handleSaveModal}
        initialData={editingFaq}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmationModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        itemType="FAQ"
        itemName={deleteTarget?.question}
        itemDescription={deleteTarget?.answer}
      />
    </div>
  );
}
