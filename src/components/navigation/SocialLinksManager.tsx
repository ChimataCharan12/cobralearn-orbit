import { useState } from "react";
import { Plus, Pencil, Trash2, Globe, Linkedin, Github, Youtube, Twitter, Instagram, ExternalLink } from "lucide-react";
import type { GlobalSocialLink } from "@prisma/client";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface SocialLinksManagerProps {
  links: GlobalSocialLink[];
  onAdd: (payload: { platform: string; url: string; iconName?: string; handle?: string; isEnabled?: boolean }) => Promise<void>;
  onUpdate: (id: string, payload: { platform?: string; url?: string; iconName?: string; handle?: string; isEnabled?: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
}

function getPlatformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("linkedin")) return Linkedin;
  if (p.includes("github")) return Github;
  if (p.includes("youtube")) return Youtube;
  if (p.includes("twitter") || p.includes("x")) return Twitter;
  if (p.includes("instagram")) return Instagram;
  return Globe;
}

export function SocialLinksManager({
  links,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: SocialLinksManagerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<GlobalSocialLink | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GlobalSocialLink | null>(null);

  const [platform, setPlatform] = useState("");
  const [url, setUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [iconName, setIconName] = useState("Globe");
  const [isEnabled, setIsEnabled] = useState(true);

  const handleOpenAdd = () => {
    setEditingLink(null);
    setPlatform("");
    setUrl("");
    setHandle("");
    setIconName("Globe");
    setIsEnabled(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (link: GlobalSocialLink) => {
    setEditingLink(link);
    setPlatform(link.platform);
    setUrl(link.url);
    setHandle(link.handle || "");
    setIconName(link.iconName || "Globe");
    setIsEnabled(link.isEnabled);
    setModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform.trim()) {
      toast.error("Platform name is required.");
      return;
    }
    if (!url.trim()) {
      toast.error("URL is required.");
      return;
    }

    try {
      if (editingLink) {
        await onUpdate(editingLink.id, {
          platform: platform.trim(),
          url: url.trim(),
          handle: handle.trim() || undefined,
          iconName: iconName.trim() || undefined,
          isEnabled,
        });
      } else {
        await onAdd({
          platform: platform.trim(),
          url: url.trim(),
          handle: handle.trim() || undefined,
          iconName: iconName.trim() || undefined,
          isEnabled,
        });
      }
      setModalOpen(false);
    } catch {
      // Keep modal open so user can correct input without losing state
    }
  };

  const handleMove = async (id: string, direction: "up" | "down") => {
    const idx = links.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= links.length) return;

    const copy = [...links];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved!);
    await onReorder(copy.map((l) => l.id));
  };

  const handleToggleEnabled = async (link: GlobalSocialLink) => {
    await onUpdate(link.id, { isEnabled: !link.isEnabled });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await onDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand/15 pb-3 mb-3.5">
        <div>
          <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Global Social Links</h3>
          <p className="text-[12px] text-muted-foreground">Manage social media accounts shown in the site footer.</p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-gradient-to-r from-brand to-brand-bright px-3.5 py-1.5 text-[12px] font-bold text-background shadow-[0_0_12px_rgba(0,255,170,0.3)] transition hover:brightness-110"
        >
          <Plus className="size-3.5" />
          <span>Add Social Link</span>
        </button>
      </div>

      {/* Grid of Social Links */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link, idx) => {
          const Icon = getPlatformIcon(link.platform);
          return (
            <div
              key={link.id}
              className={`flex items-center justify-between gap-2.5 rounded-lg border p-2.5 transition ${
                link.isEnabled ? "border-brand/20 bg-background/60" : "border-muted-foreground/25 bg-background/30 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Reorder Buttons */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(link.id, "up")}
                    aria-label="Move Up"
                    className="text-[10px] text-muted-foreground hover:text-brand-bright disabled:opacity-20 transition"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={idx === links.length - 1}
                    onClick={() => handleMove(link.id, "down")}
                    aria-label="Move Down"
                    className="text-[10px] text-muted-foreground hover:text-brand-bright disabled:opacity-20 transition"
                  >
                    ▼
                  </button>
                </div>

                <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand-bright">
                  <Icon className="size-3.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="truncate block text-[12.5px] font-semibold text-foreground">
                    {link.platform}
                  </span>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate block font-mono text-[10.5px] text-muted-foreground hover:text-brand-bright flex items-center gap-1"
                  >
                    <span className="truncate">{link.url}</span>
                    <ExternalLink className="size-2.5 shrink-0" />
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Active switch */}
                <button
                  type="button"
                  onClick={() => handleToggleEnabled(link)}
                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    link.isEnabled ? "bg-brand-bright" : "bg-muted-foreground/40"
                  }`}
                  aria-label={`Toggle ${link.platform}`}
                >
                  <span
                    className={`pointer-events-none inline-block size-3 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                      link.isEnabled ? "translate-x-3" : "translate-x-0"
                    }`}
                  />
                </button>

                {/* Edit */}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(link)}
                  className="rounded p-1 text-muted-foreground hover:text-brand-bright transition"
                  aria-label="Edit"
                >
                  <Pencil className="size-3" />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => setDeleteTarget(link)}
                  className="rounded p-1 text-red-400 hover:text-red-300 transition"
                  aria-label="Delete"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          );
        })}

        {links.length === 0 && (
          <p className="col-span-full py-4 text-center text-[12px] italic text-muted-foreground">
            No social links configured. Click &quot;Add Social Link&quot; above to create one.
          </p>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md border-brand/30 bg-panel/95 backdrop-blur-xl text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-[16px] font-bold text-glow">
              {editingLink ? `Edit Social Link: ${editingLink.platform}` : "Add Social Link"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveModal} className="space-y-3.5 pt-2">
            <div>
              <label className="text-[12px] font-medium text-foreground/80">Platform Name *</label>
              <input
                type="text"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="e.g. LinkedIn, GitHub, YouTube, X, Instagram"
                className="mt-1 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-foreground/80">URL *</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="mt-1 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2.5 font-mono text-[12px] text-foreground focus:border-brand-bright focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-foreground/80">Handle / Display Text (Optional)</label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@cobralearn"
                className="mt-1 h-8 w-full rounded-md border border-brand/25 bg-background/60 px-2.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEnabled(!isEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  isEnabled ? "bg-brand-bright" : "bg-muted-foreground/40"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow transition duration-200 ease-in-out ${
                    isEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-[12px] text-foreground/85">Show in public footer</span>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-brand/15 pt-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-brand/10 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg border border-brand-bright/70 bg-gradient-to-r from-brand to-brand-bright px-4 py-1.5 text-[12px] font-bold text-background shadow-[0_0_12px_rgba(0,255,170,0.3)] transition hover:brightness-110"
              >
                Save Social Link
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        itemType="Social Link"
        itemName={deleteTarget?.platform}
        itemDescription={`URL: ${deleteTarget?.url || ""}`}
        itemStatus={deleteTarget?.isEnabled ? "Active" : "Inactive"}
      />
    </div>
  );
}
