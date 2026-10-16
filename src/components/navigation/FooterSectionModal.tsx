import { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, Link2 } from "lucide-react";
import { type FooterSectionWithLinks } from "@/lib/server/navigation-operations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface FooterSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: FooterSectionWithLinks | null;
  onSave: (payload: {
    id?: string;
    title: string;
    iconName?: string | null;
    isVisible?: boolean;
    links: Array<{ label: string; url: string; openInNewTab?: boolean }>;
  }) => void;
}

export function FooterSectionModal({
  open,
  onOpenChange,
  section,
  onSave,
}: FooterSectionModalProps) {
  const [title, setTitle] = useState("");
  const [iconName, setIconName] = useState("Info");
  const [isVisible, setIsVisible] = useState(true);
  const [links, setLinks] = useState<Array<{ label: string; url: string; openInNewTab?: boolean }>>([]);

  useEffect(() => {
    if (section) {
      setTitle(section.title);
      setIconName(section.iconName || "Info");
      setIsVisible(section.isVisible !== undefined ? section.isVisible : true);
      setLinks(
        (section.links || []).map((l) => ({
          label: l.label,
          url: l.url,
          openInNewTab: Boolean(l.openInNewTab),
        }))
      );
    } else {
      setTitle("");
      setIconName("Info");
      setIsVisible(true);
      setLinks([
        { label: "New Link 1", url: "#", openInNewTab: false },
        { label: "New Link 2", url: "#", openInNewTab: false },
      ]);
    }
  }, [section, open]);

  const handleAddLink = () => {
    setLinks((prev) => [
      ...prev,
      { label: `Link ${prev.length + 1}`, url: "#", openInNewTab: false },
    ]);
  };

  const handleRemoveLink = (idx: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMoveLink = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= links.length) return;
    setLinks((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item!);
      return copy;
    });
  };

  const handleLinkChange = (idx: number, field: "label" | "url", value: string) => {
    setLinks((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Footer section title cannot be empty");
      return;
    }
    for (const l of links) {
      if (!l.label.trim()) {
        toast.error("All links must have a non-empty label");
        return;
      }
      if (!l.url.trim()) {
        toast.error("All links must have a non-empty URL");
        return;
      }
    }

    onSave({
      ...(section?.id ? { id: section.id } : {}),
      title: title.trim(),
      iconName,
      isVisible,
      links,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-brand/30 bg-panel/95 backdrop-blur-xl text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-[17px] font-bold text-glow">
            {section ? `Edit Footer Section: ${section.title}` : "Add Footer Section"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title & Icon */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[12px] font-medium text-foreground/80">Section Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Resources"
                className="mt-1 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-foreground/80">Icon</label>
              <select
                value={iconName}
                onChange={(e) => setIconName(e.target.value)}
                className="mt-1 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
              >
                <option value="Box">📦 Box (Showcase)</option>
                <option value="Info">ℹ️ Info (Company)</option>
                <option value="BookOpen">📖 BookOpen (Legal)</option>
                <option value="Mail">✉️ Mail (Contact)</option>
                <option value="Share2">🔗 Share2 (Social)</option>
                <option value="Link">🔗 Link (General)</option>
              </select>
            </div>
          </div>

          {/* Visibility switch */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsVisible(!isVisible)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                isVisible ? "bg-brand-bright" : "bg-muted-foreground/40"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow transition duration-200 ease-in-out ${
                  isVisible ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-[12px] text-foreground/85">Visible on public footer</span>
          </div>

          {/* Child Links Manager */}
          <div className="space-y-2 border-t border-brand/15 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-foreground/90 flex items-center gap-1.5">
                <Link2 className="size-3.5 text-brand-bright" />
                <span>Links ({links.length})</span>
              </label>
              <button
                type="button"
                onClick={handleAddLink}
                className="flex items-center gap-1 text-[11.5px] font-semibold text-brand-bright hover:underline"
              >
                <Plus className="size-3" /> Add Link
              </button>
            </div>

            <div className="max-h-[190px] overflow-y-auto space-y-2 pr-1">
              {links.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border border-brand/20 bg-background/50 p-2">
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveLink(idx, "up")}
                      aria-label="Move Up"
                      className="text-[10px] text-muted-foreground hover:text-brand-bright disabled:opacity-20 transition"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === links.length - 1}
                      onClick={() => handleMoveLink(idx, "down")}
                      aria-label="Move Down"
                      className="text-[10px] text-muted-foreground hover:text-brand-bright disabled:opacity-20 transition"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Label"
                      value={link.label}
                      onChange={(e) => handleLinkChange(idx, "label", e.target.value)}
                      className="h-7 rounded border border-brand/20 bg-background/60 px-2 text-[11.5px] text-foreground focus:border-brand-bright focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="URL (e.g. /contact or #)"
                      value={link.url}
                      onChange={(e) => handleLinkChange(idx, "url", e.target.value)}
                      className="h-7 rounded border border-brand/20 bg-background/60 px-2 font-mono text-[11px] text-foreground focus:border-brand-bright focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(idx)}
                    className="p-1 text-red-400 hover:text-red-300 transition"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {links.length === 0 && (
                <p className="text-[11.5px] text-muted-foreground italic text-center py-2">
                  No links added yet. Click &quot;Add Link&quot; above.
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 border-t border-brand/15 pt-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-brand/10 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-gradient-to-r from-brand to-brand-bright px-3.5 py-1.5 text-[12px] font-bold text-background shadow-[0_0_12px_rgba(0,255,170,0.3)] transition hover:brightness-110"
            >
              <Save className="size-3.5" />
              <span>Save Section</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
