import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DangerZoneCard() {
  const handleDelete = () => {
    toast.error("Please contact super admin to delete this root administrator account.");
  };

  return (
    <div className="card-interactive rounded-xl border border-red-500/30 bg-red-950/10 p-4 shadow-lg">
      <div className="pb-3">
        <h3 className="font-display text-[15px] font-bold text-red-400">Danger Zone</h3>
        <p className="text-[12px] text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
      </div>

      <button
        type="button"
        onClick={handleDelete}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-950/20 py-2.5 text-[12.5px] font-semibold text-red-400 transition hover:bg-red-950/40 hover:border-red-500/70"
      >
        <Trash2 className="size-4" />
        <span>Delete My Account</span>
      </button>
    </div>
  );
}
