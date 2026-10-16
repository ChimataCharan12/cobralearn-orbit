import { useState } from "react";
import { FileText, Plus, X, Edit2, RotateCcw, Check, Send } from "lucide-react";
import { toast } from "sonner";
import { useContactConfig } from "@/lib/contact-store";

interface FormSettingsTabProps {
  onMarkDirty?: () => void;
}

export function FormSettingsTab({ onMarkDirty }: FormSettingsTabProps) {
  const {
    config,
    updateConfig,
    addSubjectOption,
    updateSubjectOption,
    deleteSubjectOption,
    reorderSubjectOptions,
    resetConfigToDefault,
  } = useContactConfig();

  const [newOptionInput, setNewOptionInput] = useState("");
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const form = config.formSettings;

  const handleFieldChange = (field: string, value: string) => {
    updateConfig((prev) => ({
      ...prev,
      formSettings: {
        ...prev.formSettings,
        [field]: value,
      },
    }));
    onMarkDirty?.();
  };

  const handleAddOption = () => {
    if (!newOptionInput.trim()) return;
    addSubjectOption(newOptionInput.trim());
    setNewOptionInput("");
    setIsAddingOption(false);
    toast.success("Subject option added.");
    onMarkDirty?.();
  };

  const handleStartEdit = (index: number, currentVal: string) => {
    setEditingIndex(index);
    setEditingValue(currentVal);
  };

  const handleSaveEdit = (index: number) => {
    if (!editingValue.trim()) return;
    updateSubjectOption(index, editingValue.trim());
    setEditingIndex(null);
    toast.success("Subject option updated.");
    onMarkDirty?.();
  };

  const handleDeleteOption = (index: number) => {
    deleteSubjectOption(index);
    toast.info("Subject option removed.");
    onMarkDirty?.();
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const copy = [...form.subjectOptions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= copy.length) return;
    const [moved] = copy.splice(index, 1);
    if (!moved) return;
    copy.splice(targetIndex, 0, moved);
    reorderSubjectOptions(copy);
    onMarkDirty?.();
  };

  const handleReset = () => {
    resetConfigToDefault();
    toast.info("Form settings reset to defaults.");
    onMarkDirty?.();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-6 items-start">
        {/* Left Column: Form Controls */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-brand/25 bg-panel/85 p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-brand/15">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg border border-brand/35 bg-brand/10 text-brand-bright">
                  <FileText className="size-4" />
                </div>
                <div>
                  <h3 className="font-display text-[15px] font-bold text-foreground text-glow">
                    Contact Form Content & Subjects
                  </h3>
                  <p className="text-[12px] text-muted-foreground">
                    Configure headings, selectable subject inquiry categories, and user-facing messages.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/50 px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground transition hover:border-brand-bright/40 hover:text-foreground cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset to Default</span>
              </button>
            </div>

            {/* Form Heading & Subtitle */}
            <div className="space-y-4">
              <div>
                <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                  Form Heading
                </label>
                <input
                  type="text"
                  value={form.heading}
                  onChange={(e) => handleFieldChange("heading", e.target.value)}
                  placeholder="SEND US A MESSAGE"
                  className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] font-bold text-white focus:border-brand-bright focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                  Form Introductory Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  placeholder="Fill out the form below and we'll get back to you as soon as possible."
                  className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                />
              </div>

              {/* Subject Options */}
              <div className="pt-2 border-t border-brand/15">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                    <span>Selectable Subject Options</span>
                    <span className="text-[10.5px] font-normal text-muted-foreground">
                      ({form.subjectOptions.length} categories)
                    </span>
                  </label>
                  {!isAddingOption && (
                    <button
                      type="button"
                      onClick={() => setIsAddingOption(true)}
                      className="flex items-center gap-1 text-[11.5px] font-semibold text-brand-bright hover:underline cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Add Subject</span>
                    </button>
                  )}
                </div>

                {isAddingOption && (
                  <div className="flex items-center gap-2 mb-3 p-2 rounded-lg border border-brand/35 bg-background/80">
                    <input
                      type="text"
                      autoFocus
                      value={newOptionInput}
                      onChange={(e) => setNewOptionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                      placeholder="e.g. Technical Consultation"
                      className="flex-1 h-8 rounded border border-brand/20 bg-background/90 px-2.5 text-[12px] text-white outline-none focus:border-brand-bright"
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="h-8 rounded bg-brand-bright px-3 text-[11.5px] font-bold text-black hover:bg-brand-bright/90 cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingOption(false);
                        setNewOptionInput("");
                      }}
                      className="h-8 rounded border border-brand/20 px-2.5 text-[11.5px] text-muted-foreground hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  {form.subjectOptions.map((opt, index) => {
                    const isEditing = editingIndex === index;

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg border border-brand/20 bg-background/60 px-3 py-1.5"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <input
                              type="text"
                              autoFocus
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveEdit(index);
                                }
                              }}
                              className="h-7 w-full rounded border border-brand-bright/50 bg-background px-2 text-[12px] text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(index)}
                              className="grid size-7 place-items-center rounded bg-brand-bright text-black hover:bg-brand-bright/90 cursor-pointer shrink-0"
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingIndex(null)}
                              className="grid size-7 place-items-center rounded border border-white/20 text-muted-foreground hover:text-white cursor-pointer shrink-0"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-[11px] font-mono text-muted-foreground w-4 shrink-0">
                              {index + 1}.
                            </span>
                            <span className="text-[12.5px] font-medium text-foreground truncate">
                              {opt}
                            </span>
                          </div>
                        )}

                        {!isEditing && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMove(index, "up")}
                              className="px-1 text-[11px] text-muted-foreground hover:text-white disabled:opacity-30 cursor-pointer"
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === form.subjectOptions.length - 1}
                              onClick={() => handleMove(index, "down")}
                              className="px-1 text-[11px] text-muted-foreground hover:text-white disabled:opacity-30 cursor-pointer"
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(index, opt)}
                              className="p-1 text-muted-foreground hover:text-brand-bright transition cursor-pointer"
                              title="Edit option"
                            >
                              <Edit2 className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOption(index)}
                              className="p-1 text-muted-foreground hover:text-red-400 transition cursor-pointer"
                              title="Remove option"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button & Feedback Messages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-brand/15">
                <div>
                  <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                    Submit Button Label
                  </label>
                  <input
                    type="text"
                    value={form.submitButtonText}
                    onChange={(e) => handleFieldChange("submitButtonText", e.target.value)}
                    placeholder="Send Message"
                    className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                    Success Notification Message
                  </label>
                  <input
                    type="text"
                    value={form.successMessage}
                    onChange={(e) => handleFieldChange("successMessage", e.target.value)}
                    placeholder="Thank you! Your message has been received."
                    className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                    Error Notification Message
                  </label>
                  <input
                    type="text"
                    value={form.errorMessage || ""}
                    onChange={(e) => handleFieldChange("errorMessage", e.target.value)}
                    placeholder="Please check the required fields and try again."
                    className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                  />
                </div>
              </div>

              {/* Section Visibility Controls */}
              <div className="pt-2 border-t border-brand/15 space-y-3">
                <label className="text-[12px] font-semibold text-foreground block">
                  Public Section Visibility
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-brand/20 bg-background/50 cursor-pointer hover:border-brand/40">
                    <input
                      type="checkbox"
                      checked={form.enableHighlights ?? true}
                      onChange={(e) => {
                        updateConfig((prev) => ({
                          ...prev,
                          formSettings: {
                            ...prev.formSettings,
                            enableHighlights: e.target.checked,
                          },
                        }));
                        onMarkDirty?.();
                      }}
                      className="size-4 rounded border-brand/30 text-brand-bright focus:ring-brand-bright cursor-pointer"
                    />
                    <div>
                      <p className="text-[12px] font-medium text-foreground">Highlights Cards</p>
                      <p className="text-[10.5px] text-muted-foreground">Display highlight badges in hero</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-brand/20 bg-background/50 cursor-pointer hover:border-brand/40">
                    <input
                      type="checkbox"
                      checked={form.enableFaqSection ?? true}
                      onChange={(e) => {
                        updateConfig((prev) => ({
                          ...prev,
                          formSettings: {
                            ...prev.formSettings,
                            enableFaqSection: e.target.checked,
                          },
                        }));
                        onMarkDirty?.();
                      }}
                      className="size-4 rounded border-brand/30 text-brand-bright focus:ring-brand-bright cursor-pointer"
                    />
                    <div>
                      <p className="text-[12px] font-medium text-foreground">FAQ Section</p>
                      <p className="text-[10.5px] text-muted-foreground">Display FAQ accordion on public page</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Form Preview */}
        <div className="sticky top-4 rounded-2xl border border-brand/30 bg-panel-strong/90 p-5 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-brand/15">
            <span className="size-2 rounded-full bg-brand-bright animate-pulse" />
            <h3 className="font-display text-[14.5px] font-bold text-white tracking-wide">
              Form Preview
            </h3>
          </div>

          <p className="text-[11.5px] text-muted-foreground">
            Preview of form styling and subject options.
          </p>

          {/* Mini Form Card */}
          <div className="rounded-xl border border-brand/35 bg-[#040e08] p-4 text-left shadow-inner space-y-3">
            <h4 className="font-display text-[15px] font-bold text-white uppercase">
              {form.heading}
            </h4>
            <div className="h-[2px] w-10 bg-gradient-to-r from-brand-bright to-transparent rounded-full" />
            <p className="text-[11px] text-[#94a3b8] leading-tight">
              {form.description}
            </p>

            <div className="space-y-2 pt-1 text-[11.5px]">
              <div className="h-7 w-full rounded-lg border border-brand/20 bg-[#020b06] px-2.5 flex items-center text-[#64748b]">
                Full Name *
              </div>
              <div className="h-7 w-full rounded-lg border border-brand/20 bg-[#020b06] px-2.5 flex items-center text-[#64748b]">
                Email Address *
              </div>
              <div className="h-7 w-full rounded-lg border border-brand/25 bg-[#020b06] px-2.5 flex items-center justify-between text-[#00ff87]">
                <span>Select subject ({form.subjectOptions.length} available)</span>
                <span>▼</span>
              </div>
              <div className="h-14 w-full rounded-lg border border-brand/20 bg-[#020b06] p-2 text-[#64748b]">
                Message (0/1000)...
              </div>

              <div className="pt-1">
                <div className="h-8 w-36 rounded-lg bg-gradient-to-r from-[#f59e0b] via-[#38ef7d] to-[#00ff87] text-[#02180c] font-display text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm">
                  <Send className="size-3" />
                  <span>{form.submitButtonText}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
