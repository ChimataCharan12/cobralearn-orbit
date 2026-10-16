import { Inbox, RefreshCw } from "lucide-react";

interface MessagesEmptyStateProps {
  isFiltered?: boolean;
  onClearFilter?: () => void;
}

export function MessagesEmptyState({
  isFiltered = false,
  onClearFilter,
}: MessagesEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-brand/20 bg-panel/60 p-12 text-center backdrop-blur-xl">
      <div className="grid size-16 place-items-center rounded-2xl border border-brand/35 bg-brand/10 text-brand-bright shadow-[0_0_25px_rgba(0,255,170,0.15)]">
        <Inbox className="size-8 stroke-[1.7]" />
      </div>

      <h3 className="mt-4 font-display text-[16px] font-bold text-white uppercase tracking-wide">
        {isFiltered ? "No Matching Messages Found" : "No Contact Messages Yet"}
      </h3>

      <p className="mt-1 max-w-md text-[12.5px] text-[#94a3b8] leading-relaxed">
        {isFiltered
          ? "No messages match your active status or search query. Try clearing your search filter."
          : "Inbound messages and collaboration requests submitted through the public /contact form will appear here in real-time."}
      </p>

      {isFiltered && onClearFilter && (
        <button
          type="button"
          onClick={onClearFilter}
          className="mt-4 flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-4 py-2 text-[12.5px] font-semibold text-brand-bright hover:bg-brand/20 transition cursor-pointer"
        >
          <RefreshCw className="size-3.5" />
          <span>Clear Filters</span>
        </button>
      )}
    </div>
  );
}
