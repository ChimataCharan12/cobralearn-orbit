import { LogOut, Power } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export interface SignOutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SignOutModal({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: SignOutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] border-[1.5px] border-[#ef4444]/60 bg-[#040906]/95 p-6 sm:p-7 text-center backdrop-blur-2xl shadow-[0_0_35px_rgba(239,68,68,0.3),0_0_70px_rgba(239,68,68,0.12),0_30px_80px_rgba(0,0,0,0.9),inset_0_0_25px_rgba(239,68,68,0.05)] rounded-[20px] overflow-hidden">
        {/* Ambient Top Red Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[#ef4444]/20 blur-2xl"
        />

        {/* Large Circular Red Power Emblem */}
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#ef4444]/10 shadow-[0_0_25px_rgba(239,68,68,0.35)]">
          <Power className="size-7 text-[#ef4444] stroke-[2.5]" />
        </div>

        {/* Title */}
        <DialogTitle className="mt-3 text-center font-sans text-[22px] sm:text-[24px] font-bold tracking-tight text-white">
          Sign Out?
        </DialogTitle>

        {/* Description */}
        <DialogDescription className="mx-auto mt-1.5 max-w-[340px] text-center font-sans text-[12.5px] sm:text-[13px] leading-relaxed text-[#94a3b8]">
          Are you sure you want to end your admin session?
          <br />
          You'll need to sign in again to continue.
        </DialogDescription>

        {/* Action Buttons in a Row */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-[40px] rounded-[10px] border border-white/15 bg-white/5 text-[13px] font-medium text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-[40px] rounded-[10px] bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-[13px] font-bold text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="size-4 stroke-[2.2]" />
            <span>Sign Out</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
