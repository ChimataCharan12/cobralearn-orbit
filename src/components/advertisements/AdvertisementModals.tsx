import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, Trash2 } from "lucide-react";
import type { AdvertisementItem } from "@/lib/advertisements-data";

interface AdvertisementViewModalProps {
  ad: AdvertisementItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdvertisementViewModal({
  ad,
  open,
  onOpenChange,
}: AdvertisementViewModalProps) {
  if (!ad) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border border-brand/35 bg-panel-strong text-foreground p-0 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)]">
        {/* Banner Image */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
          <img src={ad.image} alt={ad.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4">
            <span className="inline-block rounded-md border border-brand/35 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-brand-cyan backdrop-blur-md">
              {ad.campaign}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <DialogTitle className="text-[20px] font-bold text-foreground">
              {ad.name}
            </DialogTitle>
            {ad.brand && (
              <p className="text-[12.5px] font-medium text-brand-bright/90 mt-0.5">
                {ad.brand}
              </p>
            )}
          </div>

          <DialogDescription className="text-[13px] leading-relaxed text-foreground/80">
            {ad.fullDescription || ad.description}
          </DialogDescription>

          <div className="grid grid-cols-2 gap-3 pt-2 text-[12px] border-t border-brand/15">
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              <span className="font-semibold text-foreground">{ad.status}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>{" "}
              <span className="font-semibold text-foreground">{ad.date}</span>
            </div>
            {ad.startDate && (
              <div>
                <span className="text-muted-foreground">Start Date:</span>{" "}
                <span className="font-semibold text-foreground">{ad.startDate}</span>
              </div>
            )}
            {ad.endDate && (
              <div>
                <span className="text-muted-foreground">End Date:</span>{" "}
                <span className="font-semibold text-foreground">{ad.endDate}</span>
              </div>
            )}
          </div>

          {ad.campaignUrl && (
            <div className="pt-2">
              <a
                href={ad.campaignUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-bright hover:underline"
              >
                <ExternalLink className="size-3.5" />
                Visit Campaign: {ad.campaignUrl}
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";

interface AdvertisementDeleteDialogProps {
  ad: AdvertisementItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function AdvertisementDeleteDialog({
  ad,
  open,
  onOpenChange,
  onConfirm,
}: AdvertisementDeleteDialogProps) {
  if (!ad) return null;

  return (
    <DeleteConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      itemType="Advertisement"
      itemName={ad.name}
      itemDescription={ad.description}
      itemImage={ad.image}
      itemStatus={ad.status}
    />
  );
}

