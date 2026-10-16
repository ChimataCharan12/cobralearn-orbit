import { ExternalLink, Github, Globe, X } from "lucide-react";
import type { WebsiteItem } from "@/lib/websites-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WebsiteViewModalProps {
  website: WebsiteItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WebsiteViewModal({ website, open, onOpenChange }: WebsiteViewModalProps) {
  if (!website) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dash-panel max-w-2xl border-brand/35 p-6 text-foreground">
        <DialogHeader className="border-b border-brand/15 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[18px] font-bold text-foreground">
              {website.name}
            </DialogTitle>
          </div>
          <DialogDescription className="text-[12.5px] text-brand-cyan">
            {website.category || "Showcase Website"}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 space-y-4">
          {/* Screenshot preview */}
          <div className="relative overflow-hidden rounded-lg border border-brand/30 shadow-[0_0_16px_color-mix(in_oklab,var(--brand)_15%,transparent)]">
            <img src={website.image} alt={website.name} className="aspect-[16/9] w-full object-cover" />
          </div>

          {/* Description */}
          <div>
            <h4 className="text-[12.5px] font-semibold text-foreground/80">Description</h4>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground/70">
              {website.description}
            </p>
          </div>

          {/* Technologies */}
          <div>
            <h4 className="text-[12.5px] font-semibold text-foreground/80">Technologies</h4>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {website.technologies.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-brand/25 bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center gap-3 border-t border-brand/15 pt-3">
            {website.url && (
              <a
                href={website.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-brand-bright px-4 py-2 text-[12.5px] font-bold text-black transition hover:bg-brand-bright/85"
              >
                <Globe className="size-4" /> Visit Live Site <ExternalLink className="size-3" />
              </a>
            )}
            {website.githubUrl && (
              <a
                href={website.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-brand/35 bg-panel px-4 py-2 text-[12.5px] font-semibold text-foreground transition hover:border-brand-bright"
              >
                <Github className="size-4" /> GitHub Repo
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";

interface WebsiteDeleteDialogProps {
  website: WebsiteItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function WebsiteDeleteDialog({
  website,
  open,
  onOpenChange,
  onConfirm,
}: WebsiteDeleteDialogProps) {
  if (!website) return null;

  return (
    <DeleteConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      itemType="Website"
      itemName={website.name}
      itemDescription={website.description}
      itemImage={website.image}
      itemStatus={website.status}
    />
  );
}

