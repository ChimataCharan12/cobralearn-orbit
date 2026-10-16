import { useState, useEffect } from "react";
import { X, Briefcase, Users, Clock, HelpCircle, Sparkles, Check } from "lucide-react";
import { type ContactFaq } from "@/lib/contact-data";
import { toast } from "sonner";

interface FaqModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<ContactFaq, "id" | "order">) => void;
  initialData?: ContactFaq | null;
}

const FAQ_ICONS = [
  { name: "Briefcase", icon: Briefcase },
  { name: "Users", icon: Users },
  { name: "Clock", icon: Clock },
  { name: "HelpCircle", icon: HelpCircle },
  { name: "Sparkles", icon: Sparkles },
];

export function FaqModal({
  open,
  onClose,
  onSave,
  initialData,
}: FaqModalProps) {
  const [question, setQuestion] = useState(initialData?.question || "");
  const [answer, setAnswer] = useState(initialData?.answer || "");
  const [icon, setIcon] = useState(initialData?.icon || "Briefcase");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  useEffect(() => {
    if (initialData) {
      setQuestion(initialData.question);
      setAnswer(initialData.answer);
      setIcon(initialData.icon);
      setIsActive(initialData.isActive);
    } else {
      setQuestion("");
      setAnswer("");
      setIcon("Briefcase");
      setIsActive(true);
    }
  }, [initialData, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) {
      toast.error("Please enter a question.");
      return;
    }

    if (!answer.trim()) {
      toast.error("Please enter an answer.");
      return;
    }

    onSave({
      question: question.trim(),
      answer: answer.trim(),
      icon,
      isActive,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-brand/35 bg-[#080d0a] shadow-[0_0_40px_rgba(0,0,0,0.8),0_0_20px_color-mix(in_oklab,var(--brand)_15%,transparent)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand/20 bg-[#0b120e] px-6 py-4">
          <div>
            <h2 className="font-display text-[17px] font-bold text-foreground text-glow">
              {initialData ? "Edit FAQ" : "Add FAQ Item"}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Configure frequently asked questions and expandable answers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-brand/15 hover:text-foreground cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Question */}
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
              Question <span className="text-brand-bright">*</span>
            </label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Do you take freelance or custom projects?"
              className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>

          {/* Answer */}
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
              Answer Copy <span className="text-brand-bright">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Enter detailed response copy..."
              className="w-full rounded-lg border border-brand/25 bg-background/70 p-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1.5">
              FAQ Icon
            </label>
            <div className="flex items-center gap-2">
              {FAQ_ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = icon === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setIcon(item.name)}
                    className={`flex size-10 items-center justify-center rounded-xl border transition ${
                      isSelected
                        ? "border-amber-400/80 bg-amber-950/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                        : "border-brand/20 bg-background/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <IconComponent className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-brand/20 bg-background/50 p-3 pt-2">
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">Active on Contact Page</p>
              <p className="text-[11px] text-muted-foreground">Show or hide this question accordion.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                isActive ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ${
                  isActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-brand/15">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-brand/25 bg-panel px-4 py-2 text-[12.5px] font-semibold text-foreground/80 hover:bg-panel-strong cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-brand-bright px-5 py-2 text-[12.5px] font-bold text-black shadow-[0_0_12px_var(--brand-bright)] hover:bg-brand-bright/90 cursor-pointer"
            >
              <Check className="size-4 stroke-[2.5]" />
              <span>{initialData ? "Update FAQ" : "Add FAQ"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
