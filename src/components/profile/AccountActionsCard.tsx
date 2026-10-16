import { useState } from "react";
import { Download, History, Laptop, Trash2, ChevronRight, FileArchive, Info } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfileTabId } from "./ProfileTabs";

interface AccountActionsCardProps {
  onTabChange?: (tab: ProfileTabId) => void;
}

export function AccountActionsCard({ onTabChange }: AccountActionsCardProps) {
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const actions = [
    {
      icon: Download,
      label: "Export My Data",
      onClick: () => setExportModalOpen(true),
    },
    {
      icon: History,
      label: "View Login History",
      onClick: () => {
        if (onTabChange) {
          onTabChange("login-history");
        } else {
          toast.info("Opening login history log...");
        }
      },
    },
    {
      icon: Laptop,
      label: "Manage Active Sessions",
      onClick: () => {
        if (onTabChange) {
          onTabChange("activity-sessions");
        } else {
          toast.info("Showing active browser sessions.");
        }
      },
    },
    {
      icon: Trash2,
      label: "Delete Account",
      isDanger: true,
      onClick: () => toast.error("Account deletion requires super admin confirmation."),
    },
  ];

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="pb-3 border-b border-brand/10">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Account Actions</h3>
        <p className="text-[12px] text-muted-foreground">Manage your account settings and data.</p>
      </div>

      <div className="divide-y divide-brand/10 pt-1">
        {actions.map((act) => {
          const Icon = act.icon;

          return (
            <button
              key={act.label}
              type="button"
              onClick={act.onClick}
              className={`flex w-full items-center justify-between py-2.5 text-left text-[12.5px] transition cursor-pointer ${
                act.isDanger
                  ? "text-red-400 hover:text-red-300"
                  : "text-foreground/85 hover:text-brand-bright"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`size-4 ${act.isDanger ? "text-red-400" : "text-muted-foreground"}`} />
                <span className="font-medium">{act.label}</span>
              </div>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {/* Honest Data Export Information Dialog */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="border border-brand/30 bg-[#040e08]/95 p-6 backdrop-blur-2xl text-foreground max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display text-[18px] font-bold text-foreground text-glow flex items-center gap-2">
              <FileArchive className="size-5 text-brand-bright" />
              Account Data Export
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-muted-foreground pt-1">
              Administrative account data archive status and availability.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3 text-[12.5px]">
            <div className="rounded-lg border border-brand/20 bg-background/60 p-3.5">
              <p className="font-semibold text-foreground">Export Availability</p>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                Self-service account data archiving is currently not available in this portal version (V1). No file or archive has been generated or downloaded.
              </p>
            </div>

            <div className="rounded-lg border border-brand/20 bg-background/60 p-3.5">
              <p className="font-semibold text-foreground">Compliance Records</p>
              <div className="mt-1 flex items-start gap-2 text-muted-foreground text-[11.5px]">
                <Info className="size-4 shrink-0 text-brand-bright mt-0.5" />
                <span>
                  Administrative audit trails and profile records remain persistently logged in PostgreSQL. To request an official compliance data export, please contact your organization Super Administrator.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="rounded-lg border border-brand/25 bg-background/60 px-4 py-2 text-[12.5px] font-medium text-foreground transition hover:bg-background/90 cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
