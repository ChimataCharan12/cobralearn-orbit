import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import type { AwardItem } from "@/lib/awards-data";

interface AwardViewModalProps {
  award: AwardItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AwardViewModal({
  award,
  open,
  onOpenChange,
}: AwardViewModalProps) {
  if (!award) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border border-brand/35 bg-panel-strong text-foreground p-0 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)]">
        {/* Certificate / Award Image */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/60">
          <img src={award.image} alt={award.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4">
            <span className="inline-block rounded-md border border-brand/35 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-brand-cyan backdrop-blur-md">
              {award.category}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <DialogTitle className="text-[20px] font-bold text-foreground">
              {award.name}
            </DialogTitle>
            <p className="text-[12.5px] font-medium text-brand-bright/90 mt-0.5">
              {award.organization} {award.context && `• ${award.context}`}
            </p>
          </div>

          <DialogDescription className="text-[13px] leading-relaxed text-foreground/80">
            {award.fullDescription || award.description}
          </DialogDescription>

          <div className="grid grid-cols-2 gap-3 pt-2 text-[12px] border-t border-brand/15">
            <div>
              <span className="text-muted-foreground">Category:</span>{" "}
              <span className="font-semibold text-foreground">{award.category}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>{" "}
              <span className="font-semibold text-foreground">{award.date}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              <span className="font-semibold text-foreground">{award.status}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Display Order:</span>{" "}
              <span className="font-semibold text-foreground">{award.order}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";

interface AwardDeleteDialogProps {
  award: AwardItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function AwardDeleteDialog({
  award,
  open,
  onOpenChange,
  onConfirm,
}: AwardDeleteDialogProps) {
  if (!award) return null;

  return (
    <DeleteConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      itemType="Award"
      itemName={award.name}
      itemDescription={award.description || award.organization}
      itemImage={award.image}
      itemStatus={award.status || award.date}
    />
  );
}

