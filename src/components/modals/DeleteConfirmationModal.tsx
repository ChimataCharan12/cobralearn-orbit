import React from "react";
import { Trash2, X, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

export interface DeleteConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  onCancel?: (() => void) | undefined;
  itemType?: string | undefined;
  itemName?: string | undefined;
  itemDescription?: string | undefined;
  itemImage?: string | null | undefined;
  itemIcon?: React.ComponentType<{ className?: string }> | React.ReactNode | undefined;
  itemStatus?: string | null | undefined;
  itemBadgeVariant?: ("green" | "amber" | "cyan" | "red" | "default") | undefined;
  itemDetails?: Array<{ label: string; value: string }> | undefined;
  title?: React.ReactNode | undefined;
  description?: string | undefined;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  isLoading?: boolean | undefined;
}

export function DeleteConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  itemType = "Item",
  itemName,
  itemDescription,
  itemImage,
  itemIcon: ItemIconComponent,
  itemStatus,
  itemBadgeVariant,
  itemDetails,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isLoading = false,
}: DeleteConfirmationModalProps) {
  const { t } = useAdminAppearance();
  const resolvedCancelLabel = cancelLabel ?? t("modal.cancel");
  const resolvedConfirmLabel = confirmLabel ?? `${t("modal.deleteConfirm")} ${itemType}`;
  const resolvedDescription = description ?? t("modal.deleteWarning");
  const handleCancel = () => {
    if (isLoading) return;
    if (onCancel) {
      onCancel();
    } else {
      onOpenChange(false);
    }
  };

  const handleConfirm = async () => {
    if (isLoading) return;
    await onConfirm();
  };

  // Determine badge color styling based on status string or explicit variant
  const getBadgeClass = (status?: string | null, variant?: string) => {
    if (variant === "green" || status === "Published" || status === "Active" || status === "Enabled") {
      return "border-[#00ff87]/40 bg-[#00ff87]/10 text-[#00ff87]";
    }
    if (variant === "amber" || status === "Draft" || status === "Archived" || status === "Pending") {
      return "border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#fbbf24]";
    }
    if (variant === "cyan" || status === "Internal" || status === "Image" || status === "Video") {
      return "border-[#00d2ff]/40 bg-[#00d2ff]/10 text-[#00d2ff]";
    }
    if (variant === "red") {
      return "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444]";
    }
    return "border-white/20 bg-white/10 text-white/80";
  };

  // Has preview card content
  const hasPreviewCard = Boolean(itemName || itemDescription || itemImage || ItemIconComponent || itemStatus || (itemDetails && itemDetails.length > 0));

  return (
    <Dialog open={open} onOpenChange={(val) => !isLoading && onOpenChange(val)}>
      <DialogContent
        className="max-w-[480px] border-[1.5px] border-[#ef4444]/60 bg-[#040906]/95 p-6 sm:p-7 text-center backdrop-blur-2xl shadow-[0_0_35px_rgba(239,68,68,0.3),0_0_70px_rgba(239,68,68,0.15),0_30px_80px_rgba(0,0,0,0.9),inset_0_0_25px_rgba(239,68,68,0.05)] rounded-[20px] overflow-hidden"
      >
        {/* Ambient Top Red Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[#ef4444]/20 blur-2xl"
        />

        {/* Large Red Trash Circle */}
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#ef4444]/10 shadow-[0_0_25px_rgba(239,68,68,0.35)]">
          <Trash2 className="size-7 text-[#ef4444] stroke-[2.2]" />
        </div>

        {/* Dialog Title */}
        <DialogTitle className="mt-3 text-center font-sans text-[22px] sm:text-[24px] font-bold tracking-tight text-white">
          {title ? (
            title
          ) : (
            <>
              <span className="text-[#ef4444] drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">{t("modal.deleteTitle")}</span>{" "}
              {itemType}?
            </>
          )}
        </DialogTitle>

        {/* Warning Description */}
        <DialogDescription className="mx-auto mt-1.5 max-w-[380px] text-center font-sans text-[12.5px] leading-relaxed text-[#94a3b8]">
          {resolvedDescription}
        </DialogDescription>

        {/* Selected Item Preview Card */}
        {hasPreviewCard && (
          <div className="mt-4 rounded-[12px] border border-[#ef4444]/25 bg-[#020704]/80 p-3 flex items-center gap-3.5 text-left shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
            {itemImage ? (
              <img
                src={itemImage}
                alt={itemName || itemType}
                className="size-14 sm:size-16 rounded-[8px] object-cover border border-white/10 shrink-0 bg-black/40"
              />
            ) : ItemIconComponent ? (
              <div className="size-14 sm:size-16 rounded-[8px] border border-[#ef4444]/30 bg-[#ef4444]/10 flex items-center justify-center text-[#ef4444] shrink-0">
                {React.isValidElement(ItemIconComponent) ? (
                  ItemIconComponent
                ) : typeof ItemIconComponent === "function" ? (
                  React.createElement(ItemIconComponent, { className: "size-6 stroke-[2]" })
                ) : null}
              </div>
            ) : null}

            <div className="min-w-0 flex-1">
              {itemName && (
                <h4 className="font-sans text-[13.5px] font-bold text-white truncate">
                  {itemName}
                </h4>
              )}
              {itemDescription && (
                <p className="mt-0.5 font-sans text-[11.5px] text-[#94a3b8] line-clamp-1">
                  {itemDescription}
                </p>
              )}
              {itemStatus && (
                <div className="mt-1">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getBadgeClass(
                      itemStatus,
                      itemBadgeVariant
                    )}`}
                  >
                    {itemStatus}
                  </span>
                </div>
              )}
              {itemDetails && itemDetails.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2 text-[10.5px] text-muted-foreground">
                  {itemDetails.map((d, i) => (
                    <span key={i}>
                      <span className="text-white/60">{d.label}:</span>{" "}
                      <span className="text-white/90 font-medium">{d.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleCancel}
            className="flex-1 h-[40px] rounded-[10px] border border-white/15 bg-white/5 text-[13px] font-medium text-white hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleConfirm}
            className="flex-1 h-[40px] rounded-[10px] bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-[13px] font-bold text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="size-4 stroke-[2.2]" />
            )}
            <span>{resolvedConfirmLabel}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
