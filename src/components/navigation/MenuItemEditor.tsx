import { useState, useEffect } from "react";
import { Save, X, Zap, Home, BookOpen, Award, Box, FileText, Info, Mail } from "lucide-react";
import { type NavigationMenuItem, type NavItemType, type NavItemStatus } from "@/lib/navigation-data";
import { toast } from "sonner";

interface MenuItemEditorProps {
  item: NavigationMenuItem;
  onSave: (updated: NavigationMenuItem) => void;
  onCancel: () => void;
}

export function MenuItemEditor({ item, onSave, onCancel }: MenuItemEditorProps) {
  const [label, setLabel] = useState(item.label);
  const [link, setLink] = useState(item.link);
  const [type, setType] = useState<NavItemType>(item.type);
  const [status, setStatus] = useState<NavItemStatus>(item.status);
  const [iconName, setIconName] = useState(item.iconName || "Home");
  const [openInNewTab, setOpenInNewTab] = useState(item.openInNewTab || false);
  const [buttonStyle, setButtonStyle] = useState(item.buttonStyle || "Primary (Filled)");

  useEffect(() => {
    setLabel(item.label);
    setLink(item.link);
    setType(item.type);
    setStatus(item.status);
    setIconName(item.iconName || "Home");
    setOpenInNewTab(item.openInNewTab || false);
    setButtonStyle(item.buttonStyle || "Primary (Filled)");
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Label cannot be empty.");
      return;
    }

    onSave({
      ...item,
      label: label.trim(),
      link: link.trim(),
      type,
      status,
      iconName,
      openInNewTab,
      buttonStyle,
    });
  };

  return (
    <div className="flex flex-col rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="mb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Menu Item Editor</h3>
        <p className="text-[12px] text-muted-foreground">Add or update a navigation menu item.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Row 1: Label, Link/URL, Type */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Label *</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Link / URL *</label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as NavItemType)}
              className="mt-1 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="Internal">Internal</option>
              <option value="External">External</option>
              <option value="Button">Button</option>
            </select>
          </div>
        </div>

        {/* Row 2: Icon, Status */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Icon (Optional)</label>
            <select
              value={iconName}
              onChange={(e) => setIconName(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="Home">🏠 Home</option>
              <option value="Box">📦 Box (Projects)</option>
              <option value="LayoutGrid">🌐 LayoutGrid (Websites)</option>
              <option value="Megaphone">📢 Megaphone (Advertisements)</option>
              <option value="Award">🏆 Award (Awards & Achievements)</option>
              <option value="Info">ℹ️ Info (About)</option>
              <option value="Mail">✉️ Mail (Contact)</option>
              <option value="Zap">⚡ Zap (Explore Showcase CTA)</option>
            </select>
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as NavItemStatus)}
              className="mt-1 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2 text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="Active">● Active</option>
              <option value="Inactive">○ Inactive</option>
            </select>
          </div>
        </div>

        {/* Row 3: Open in New Tab + Button Style */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-center">
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setOpenInNewTab(!openInNewTab)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                openInNewTab ? "bg-brand-bright" : "bg-muted-foreground/40"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow transition duration-200 ease-in-out ${
                  openInNewTab ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-[12px] text-foreground/85">Open in New Tab</span>
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Button Style (for button type)</label>
            <select
              disabled={type !== "Button"}
              value={buttonStyle}
              onChange={(e) => setButtonStyle(e.target.value as any)}
              className="mt-1 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2 text-[12px] text-foreground disabled:opacity-50 focus:border-brand-bright focus:outline-none"
            >
              <option value="Primary (Filled)">Primary (Filled)</option>
              <option value="Outline">Outline</option>
              <option value="Ghost">Ghost</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex items-center justify-end gap-2.5 border-t border-brand/15 pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-brand/10 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-gradient-to-r from-brand to-brand-bright px-3.5 py-1.5 text-[12px] font-bold text-background shadow-[0_0_12px_rgba(0,255,170,0.3)] transition hover:brightness-110"
          >
            <Save className="size-3.5" />
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
}
