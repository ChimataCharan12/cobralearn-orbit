import { Search, RotateCcw } from "lucide-react";
import { type MessageStatus } from "@/lib/contact-data";

interface MessagesToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  counts: {
    all: number;
    new: number;
    read: number;
    replied: number;
    archived: number;
  };
  onRefresh: () => void;
}

export function MessagesToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  counts,
  onRefresh,
}: MessagesToolbarProps) {
  const tabs = [
    { id: "ALL", label: "All", count: counts.all },
    { id: "new", label: "New", count: counts.new },
    { id: "read", label: "Read", count: counts.read },
    { id: "replied", label: "Replied", count: counts.replied },
    { id: "archived", label: "Archived", count: counts.archived },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand/20 bg-panel/85 p-3 sm:p-4 backdrop-blur-md">
      {/* Top row: Status filter tabs */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 shrink-0">
          {tabs.map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusFilterChange(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition cursor-pointer ${
                  isSelected
                    ? "border border-brand-bright/70 bg-brand/25 text-brand-bright shadow-[0_0_10px_var(--brand-bright)]"
                    : "border border-transparent text-muted-foreground hover:bg-background/40 hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10.5px] font-mono font-bold ${
                    isSelected
                      ? "bg-brand-bright text-black"
                      : "bg-background/60 text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/50 px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground hover:border-brand-bright/40 hover:text-foreground transition cursor-pointer shrink-0"
        >
          <RotateCcw className="size-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Bottom row: Search & Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-brand/10">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by sender name, email, subject, or message content..."
            className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 pl-9 pr-3 text-[12.5px] text-foreground placeholder:text-muted-foreground/50 focus:border-brand-bright focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="text-[11.5px] text-muted-foreground">Sort By:</label>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="h-9 rounded-lg border border-brand/25 bg-background/70 px-3 text-[12px] text-foreground focus:border-brand-bright focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="sender">Sender (A-Z)</option>
            <option value="subject">Subject (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
