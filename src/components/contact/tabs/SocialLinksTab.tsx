import { useState } from "react";
import {
  Share2,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Linkedin,
  Instagram,
  Youtube,
  Github,
  Globe,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useContactConfig } from "@/lib/contact-store";
import { type ContactSocialLink } from "@/lib/contact-data";
import { SocialLinkModal } from "@/components/contact/modals/SocialLinkModal";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";

interface SocialLinksTabProps {
  onMarkDirty?: () => void;
}

export function SocialLinksTab({ onMarkDirty }: SocialLinksTabProps) {
  const {
    config,
    addSocialLink,
    updateSocialLink,
    deleteSocialLink,
    reorderSocialLinks,
    resetConfigToDefault,
  } = useContactConfig();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ContactSocialLink | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactSocialLink | null>(null);

  const socialLinks = config.socialLinks;

  const handleToggleEnabled = (id: string, current: boolean) => {
    updateSocialLink(id, { enabled: !current });
    toast.info(`Social link ${!current ? "enabled" : "disabled"}.`);
    onMarkDirty?.();
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const copy = [...socialLinks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= copy.length) return;
    const [moved] = copy.splice(index, 1);
    if (!moved) return;
    copy.splice(targetIndex, 0, moved);
    reorderSocialLinks(copy);
    onMarkDirty?.();
  };

  const handleSaveModal = (data: Omit<ContactSocialLink, "id" | "order">) => {
    if (editingLink) {
      updateSocialLink(editingLink.id, data);
      toast.success(`Updated ${data.platform} profile.`);
    } else {
      addSocialLink(data);
      toast.success(`Added ${data.platform} link.`);
    }
    setEditingLink(null);
    onMarkDirty?.();
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteSocialLink(deleteTarget.id);
    toast.success(`Removed ${deleteTarget.platform} link.`);
    setDeleteTarget(null);
    onMarkDirty?.();
  };

  const handleReset = () => {
    resetConfigToDefault();
    toast.info("Social links reset to default.");
    onMarkDirty?.();
  };

  const getSocialIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case "linkedin":
        return <Linkedin className="size-4 text-[#0077b5]" />;
      case "instagram":
        return <Instagram className="size-4 text-[#e1306c]" />;
      case "youtube":
        return <Youtube className="size-4 text-[#ff0000]" />;
      case "github":
        return <Github className="size-4 text-white" />;
      case "x":
        return <span className="font-display font-bold text-white text-[12px]">𝕏</span>;
      default:
        return <Globe className="size-4 text-brand-bright" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand/25 bg-panel/85 p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-brand/15">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-brand/35 bg-brand/10 text-brand-bright">
              <Share2 className="size-4" />
            </div>
            <div>
              <h3 className="font-display text-[15px] font-bold text-foreground text-glow">
                Public Social Channels
              </h3>
              <p className="text-[12px] text-muted-foreground">
                Manage social profiles displayed in the "Follow Our Journey" contact section.
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
                setEditingLink(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brand-bright px-3.5 py-1.5 text-[12px] font-bold text-black shadow-[0_0_12px_var(--brand-bright)] hover:bg-brand-bright/90 cursor-pointer"
            >
              <Plus className="size-3.5 stroke-[3]" />
              <span>Add Social Link</span>
            </button>
          </div>
        </div>

        {/* Social Links List */}
        {socialLinks.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Share2 className="mx-auto size-8 text-brand/40 mb-2" />
            <p className="text-[13px] font-semibold text-foreground">No social links configured</p>
            <p className="text-[11.5px] text-muted-foreground">Click "Add Social Link" to add your first channel.</p>
          </div>
        ) : (
          <div className="space-y-2.5 pt-2">
            {socialLinks.map((link, index) => (
              <div
                key={link.id}
                className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                  link.enabled
                    ? "border-brand/25 bg-background/60 hover:border-brand/40"
                    : "border-white/10 bg-background/25 opacity-60"
                }`}
              >
                {/* Left: Reorder + Icon + Platform */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  {/* Move Up/Down */}
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
                      disabled={index === socialLinks.length - 1}
                      onClick={() => handleMove(index, "down")}
                      className="text-[10px] text-muted-foreground hover:text-white disabled:opacity-20 cursor-pointer"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Icon Box */}
                  <div className="size-8 rounded-lg border border-brand/30 bg-[#02140a] flex items-center justify-center shrink-0">
                    {getSocialIcon(link.icon || link.platform)}
                  </div>

                  <div>
                    <p className="font-display text-[13px] font-bold text-white leading-tight">
                      {link.platform}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground">
                      Order: #{index + 1}
                    </p>
                  </div>
                </div>

                {/* Middle: URL preview */}
                <div className="flex-1 min-w-[200px] px-2 truncate">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[12px] text-brand-bright/80 hover:text-brand-bright hover:underline truncate"
                  >
                    <span>{link.url}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </div>

                {/* Right: Toggle + Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Active Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(link.id, link.enabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      link.enabled ? "bg-brand-bright" : "bg-muted-foreground/30"
                    }`}
                    title={link.enabled ? "Enabled" : "Disabled"}
                  >
                    <span
                      className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ${
                        link.enabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLink(link);
                      setModalOpen(true);
                    }}
                    className="grid size-8 place-items-center rounded-lg border border-brand/20 bg-background/50 text-muted-foreground hover:border-brand-bright/40 hover:text-foreground cursor-pointer transition"
                    title="Edit link"
                  >
                    <Edit2 className="size-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(link)}
                    className="grid size-8 place-items-center rounded-lg border border-red-500/20 bg-background/50 text-muted-foreground hover:border-red-500/40 hover:text-red-400 cursor-pointer transition"
                    title="Delete link"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      <SocialLinkModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingLink(null);
        }}
        onSave={handleSaveModal}
        initialData={editingLink}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        itemType="Social Link"
        itemName={deleteTarget?.platform}
        itemDescription={`URL: ${deleteTarget?.url}`}
      />
    </div>
  );
}
