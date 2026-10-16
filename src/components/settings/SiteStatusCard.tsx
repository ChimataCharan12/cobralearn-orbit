import { useState } from "react";
import { toast } from "sonner";

export function SiteStatusCard() {
  const [isLive, setIsLive] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="pb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Site Status</h3>
        <p className="text-[12px] text-muted-foreground">Control the visibility and access to your website.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 pt-1 sm:grid-cols-2">
        {/* Website Status Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const next = !isLive;
              setIsLive(next);
              toast.info(`Website status changed to ${next ? "Live (Published)" : "Offline (Draft)"}.`);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              isLive ? "bg-brand-bright" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`pointer-events-none inline-block size-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                isLive ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>

          <div>
            <p className="text-[13px] font-bold text-foreground">
              {isLive ? "Live (Published)" : "Offline (Draft)"}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {isLive ? "Your website is publicly accessible." : "Website is currently hidden from public."}
            </p>
          </div>
        </div>

        {/* Maintenance Mode Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const next = !maintenanceMode;
              setMaintenanceMode(next);
              toast.info(`Maintenance mode is now ${next ? "Enabled" : "Disabled"}.`);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              maintenanceMode ? "bg-brand-bright" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`pointer-events-none inline-block size-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                maintenanceMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>

          <div>
            <p className="text-[13px] font-bold text-foreground">
              {maintenanceMode ? "Enabled" : "Disabled"}
            </p>
            <p className="text-[11.5px] text-muted-foreground">Shows maintenance page to visitors.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
