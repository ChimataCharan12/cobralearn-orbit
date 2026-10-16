import { AlertCircle, Save, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export interface UnsavedChangesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({
  open,
  onOpenChange,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] border-[1.5px] border-[#f59e0b]/60 bg-[#040906]/95 p-6 sm:p-7 text-center backdrop-blur-2xl shadow-[0_0_35px_rgba(245,158,11,0.3),0_0_70px_rgba(245,158,11,0.12),0_30px_80px_rgba(0,0,0,0.9),inset_0_0_25px_rgba(245,158,11,0.05)] rounded-[20px] overflow-hidden">
        {/* Ambient Top Amber Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[#f59e0b]/20 blur-2xl"
        />

        {/* Large Amber Warning Emblem */}
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/10 shadow-[0_0_25px_rgba(245,158,11,0.35)]">
          <AlertCircle className="size-8 text-[#fbbf24] stroke-[2.5]" />
        </div>

        {/* Title */}
        <DialogTitle className="mt-3 text-center font-sans text-[22px] sm:text-[24px] font-bold tracking-tight text-[#fbbf24] drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]">
          Unsaved Changes
        </DialogTitle>

        {/* Description */}
        <DialogDescription className="mx-auto mt-1.5 max-w-[340px] text-center font-sans text-[12.5px] sm:text-[13px] leading-relaxed text-[#94a3b8]">
          You have changes that haven't been saved.
          <br />
          What would you like to do?
        </DialogDescription>

        {/* 3 Vertically Stacked Action Buttons */}
        <div className="mt-5 flex flex-col gap-2.5">
          {/* 1. Save Changes Button (Primary Amber/Gold) */}
          <button
            type="button"
            onClick={onSave}
            className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#f59e0b] via-[#fbbf24] to-[#d97706] text-[13.5px] font-bold text-[#02180c] shadow-[0_0_22px_rgba(245,158,11,0.5)] hover:shadow-[0_0_30px_rgba(245,158,11,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
          >
            <Save className="size-4 stroke-[2.5]" />
            <span>Save Changes</span>
          </button>

          {/* 2. Discard Changes Button (Dark Glass with Green Border) */}
          <button
            type="button"
            onClick={onDiscard}
            className="flex h-[38px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#00ff87]/30 bg-[#020905]/70 text-[12.5px] font-medium text-[#e2e8f0] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:border-[#00ff87]/55 hover:bg-[#00ff87]/10 transition-all cursor-pointer"
          >
            <Trash2 className="size-3.5 text-[#00ff87]" />
            <span>Discard Changes</span>
          </button>

          {/* 3. Cancel Button (Dark Transparent Glass) */}
          <button
            type="button"
            onClick={onCancel}
            className="flex h-[38px] w-full items-center justify-center rounded-[10px] border border-white/15 bg-white/5 text-[12.5px] font-medium text-[#cbd5e1] hover:bg-white/10 hover:text-white transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
