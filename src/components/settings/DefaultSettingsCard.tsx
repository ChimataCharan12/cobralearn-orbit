import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import metaImg from "@/assets/settings-meta-preview.png";

export function DefaultSettingsCard() {
  const [itemsPerPage, setItemsPerPage] = useState("12");

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="pb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Default Settings</h3>
        <p className="text-[12px] text-muted-foreground">Default configurations for content and users.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-[1fr_160px]">
        {/* Default Meta Image */}
        <div>
          <label className="text-[11.5px] font-medium text-foreground/80">Default Meta Image</label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="h-10 w-[130px] overflow-hidden rounded-lg border border-brand/30 bg-background/60 shadow">
              <img src={metaImg} alt="Meta Preview" className="h-full w-full object-cover" />
            </div>

            <button
              type="button"
              onClick={() => toast.info("Select new default meta image (1200x630).")}
              className="flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/15 px-2.5 py-1 text-[11px] font-medium text-brand-bright hover:bg-brand/25"
            >
              <ImageIcon className="size-3" />
              <span>Change Image</span>
            </button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">PNG, JPG (Recommended: 1200x630)</p>
        </div>

        {/* Items Per Page */}
        <div>
          <label className="text-[11.5px] font-medium text-foreground/80">Items Per Page</label>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="36">36</option>
            <option value="48">48</option>
          </select>
        </div>
      </div>
    </div>
  );
}
