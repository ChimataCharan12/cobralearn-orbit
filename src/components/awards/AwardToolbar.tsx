import { LayoutGrid, List, RotateCcw, Search } from "lucide-react";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

interface AwardToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (val: string) => void;
  sortBy: string;
  onSortByChange: (val: string) => void;
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
  onRefresh: () => void;
  availableCategories: string[];
}

export function AwardToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  onRefresh,
  availableCategories,
}: AwardToolbarProps) {
  const { t } = useAdminAppearance();
  const selectCls =
    "h-9 rounded-lg border border-brand/25 bg-panel px-3 text-[12.5px] font-medium text-foreground/85 outline-none transition hover:border-brand-bright/50 focus:border-brand-bright/70";

  return (
    <div className="dash-panel flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/25 p-3.5">
      {/* Left controls: Search + Filters */}
      <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-[280px]">
        {/* Search input */}
        <div className="relative min-w-[200px] flex-1 max-w-[340px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("toolbar.searchAwards")}
            className="h-9 w-full rounded-lg border border-brand/25 bg-panel pl-9 pr-3 text-[12.5px] text-foreground placeholder:text-muted-foreground/50 outline-none transition hover:border-brand-bright/50 focus:border-brand-bright/70 focus:shadow-[0_0_0_2px_color-mix(in_oklab,var(--brand)_15%,transparent)]"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label={t("toolbar.filterStatus")}
          className={selectCls}
        >
          <option value="ALL">{t("toolbar.allStatus")}</option>
          <option value="Published">{t("common.published")}</option>
          <option value="Draft">{t("common.draft")}</option>
          <option value="Archived">{t("common.archived")}</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          aria-label={t("toolbar.filterCategory")}
          className={selectCls}
        >
          <option value="ALL">{t("toolbar.allCategories")}</option>
          {availableCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Sort by */}
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          aria-label={t("toolbar.sortBy")}
          className={selectCls}
        >
          <option value="order">{t("toolbar.displayOrder")}</option>
          <option value="newest">{t("common.lastUpdated")}</option>
          <option value="name">{t("common.title")}</option>
        </select>
      </div>

      {/* Right controls: View Toggle + Refresh */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-brand/25 bg-panel p-0.5">
          <button
            type="button"
            aria-label={t("toolbar.listView")}
            onClick={() => onViewModeChange("list")}
            className={`grid size-7.5 place-items-center rounded-md text-[13px] transition ${
              viewMode === "list"
                ? "bg-brand/20 text-brand-bright shadow-[0_0_8px_color-mix(in_oklab,var(--brand-bright)_20%,transparent)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t("toolbar.gridView")}
            onClick={() => onViewModeChange("grid")}
            className={`grid size-7.5 place-items-center rounded-md text-[13px] transition ${
              viewMode === "grid"
                ? "bg-brand/20 text-brand-bright shadow-[0_0_8px_color-mix(in_oklab,var(--brand-bright)_20%,transparent)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          aria-label={t("toolbar.refreshList")}
          title={t("toolbar.refreshList")}
          className="grid size-9 place-items-center rounded-lg border border-brand/25 bg-panel text-muted-foreground transition hover:border-brand-bright/60 hover:text-brand-bright hover:shadow-[0_0_10px_color-mix(in_oklab,var(--brand)_15%,transparent)]"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>
    </div>
  );
}
