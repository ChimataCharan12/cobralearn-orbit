import { type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

interface ConfirmationDialogProps {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
}

export function ConfirmationDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
}: ConfirmationDialogProps) {
  const isDanger = variant === "danger";

  const dialogContent = (
    <AlertDialogContent
      className={`max-w-[480px] border-[1.5px] bg-[#040906]/95 p-6 sm:p-7 text-center backdrop-blur-2xl rounded-[20px] overflow-hidden ${
        isDanger
          ? "border-[#ef4444]/60 shadow-[0_0_35px_rgba(239,68,68,0.3),0_0_70px_rgba(239,68,68,0.15),0_30px_80px_rgba(0,0,0,0.9),inset_0_0_25px_rgba(239,68,68,0.05)]"
          : "border-[#f59e0b]/60 shadow-[0_0_35px_rgba(245,158,11,0.3),0_30px_80px_rgba(0,0,0,0.9)]"
      }`}
    >
      {/* Ambient Top Glow */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-10 size-32 rounded-full blur-2xl ${
          isDanger ? "bg-[#ef4444]/20" : "bg-[#f59e0b]/20"
        }`}
      />

      {/* Large Emblem */}
      <div
        className={`mx-auto flex size-16 items-center justify-center rounded-full border shadow-lg ${
          isDanger
            ? "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444] shadow-[0_0_25px_rgba(239,68,68,0.35)]"
            : "border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#fbbf24] shadow-[0_0_25px_rgba(245,158,11,0.35)]"
        }`}
      >
        {isDanger ? <Trash2 className="size-7 stroke-[2.2]" /> : <AlertTriangle className="size-7 stroke-[2.2]" />}
      </div>

      <AlertDialogHeader className="mt-2 text-center">
        <AlertDialogTitle className="text-center font-sans text-[20px] sm:text-[22px] font-bold tracking-tight text-white">
          {title}
        </AlertDialogTitle>
        <AlertDialogDescription className="mx-auto mt-1.5 max-w-[380px] text-center font-sans text-[12.5px] leading-relaxed text-[#94a3b8]">
          {description}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter className="mt-6 flex items-center justify-center gap-3 sm:gap-3">
        <AlertDialogCancel className="flex-1 h-[40px] rounded-[10px] border border-white/15 bg-white/5 text-[13px] font-medium text-white hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer">
          {cancelLabel}
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className={`flex-1 h-[40px] rounded-[10px] text-[13px] font-bold text-white shadow-lg active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 ${
            isDanger
              ? "bg-gradient-to-r from-[#ef4444] to-[#dc2626] shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] hover:brightness-110"
              : "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-black shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:brightness-110"
          }`}
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );

  if (open !== undefined && onOpenChange !== undefined) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
        {dialogContent}
      </AlertDialog>
    );
  }

  return (
    <AlertDialog>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      {dialogContent}
    </AlertDialog>
  );
}

