import { useState, useEffect } from "react";
import { X, Briefcase, Sparkles, ShieldCheck, Zap, Layers, Check } from "lucide-react";
import { type ContactHighlight, type HighlightAccent } from "@/lib/contact-data";
import { toast } from "sonner";

interface HighlightModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<ContactHighlight, "id" | "order">) => void;
  initialData?: ContactHighlight | null;
}

const ICONS = [
  { name: "Briefcase", icon: Briefcase },
  { name: "Sparkles", icon: Sparkles },
  { name: "ShieldCheck", icon: ShieldCheck },
  { name: "Zap", icon: Zap },
  { name: "Layers", icon: Layers },
];

export function HighlightModal({
  open,
  onClose,
  onSave,
  initialData,
}: HighlightModalProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [icon, setIcon] = useState(initialData?.icon || "Briefcase");
  const [accent, setAccent] = useState<HighlightAccent>(initialData?.accent || "emerald");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description);
      setIcon(initialData.icon);
      setAccent(initialData.accent);
      setIsActive(initialData.isActive);
    } else {
      setTitle("");
      setDescription("");
      setIcon("Briefcase");
      setAccent("emerald");
      setIsActive(true);
    }
  }, [initialData, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a title.");
      return;
    }

    if (!description.trim()) {
      toast.error("Please enter a description.");
      return;
    }

    onSave({
      title: title.trim(),
      description: description.trim(),
      icon,
      accent,
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
              {initialData ? "Edit Highlight" : "Add Collaboration Highlight"}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Configure highlight card displayed below the hero section.
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
          {/* Title */}
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
              Highlight Title <span className="text-brand-bright">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Strategic Partnerships"
              className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
              Short Description <span className="text-brand-bright">*</span>
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Building a better digital future"
              className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1.5">
              Highlight Icon
            </label>
            <div className="flex items-center gap-2">
              {ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = icon === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setIcon(item.name)}
                    className={`flex size-10 items-center justify-center rounded-xl border transition ${
                      isSelected
                        ? "border-brand-bright bg-brand/25 text-brand-bright shadow-[0_0_10px_var(--brand-bright)]"
                        : "border-brand/20 bg-background/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <IconComponent className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Selection */}
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground/80 mb-1.5">
              Accent Border & Glow Tone
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: "emerald" as const, label: "Emerald Green", color: "#00ff87" },
                { id: "amber" as const, label: "Amber Orange", color: "#f59e0b" },
                { id: "cyan" as const, label: "Cyan Blue", color: "#00d2ff" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAccent(c.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition ${
                    accent === c.id
                      ? "border-brand-bright bg-background/80 text-foreground"
                      : "border-brand/20 bg-background/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-brand/20 bg-background/50 p-3 pt-2">
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">Active in Showcase</p>
              <p className="text-[11px] text-muted-foreground">Show this highlight card on `/contact`.</p>
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
              <span>{initialData ? "Update Highlight" : "Add Highlight"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
