import { Search, LayoutGrid, List, RotateCw } from "lucide-react";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

interface MediaToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  typeFilter: string;
  onTypeFilterChange: (val: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (val: string) => void;
  sortBy: string;
  onSortByChange: (val: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onRefresh: () => void;
}

export function MediaToolbar({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  onRefresh,
}: MediaToolbarProps) {
  const { t } = useAdminAppearance();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-panel/75 p-2.5">
      {/* Search Input */}
      <div className="relative min-w-[240px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("toolbar.searchMedia")}
          className="h-9 w-full rounded-lg border border-brand/25 bg-background/60 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-brand-bright/70 focus:outline-none focus:ring-1 focus:ring-brand-bright/50"
        />
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Filter by Type */}
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          aria-label={t("toolbar.filterType")}
          className="h-9 rounded-lg border border-brand/25 bg-background/60 px-3 text-[12.5px] font-medium text-foreground/85 focus:border-brand-bright/70 focus:outline-none"
        >
          <option value="ALL">{t("toolbar.allTypes")}</option>
          <option value="Image">Images</option>
          <option value="Video">Videos</option>
          <option value="Document">Documents</option>
          <option value="Others">Others</option>
        </select>

        {/* Filter by Category */}
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          aria-label={t("toolbar.filterCategory")}
          className="h-9 rounded-lg border border-brand/25 bg-background/60 px-3 text-[12.5px] font-medium text-foreground/85 focus:border-brand-bright/70 focus:outline-none"
        >
          <option value="ALL">{t("toolbar.allCategories")}</option>
          <option value="Advertisements">{t("nav.advertisements")}</option>
          <option value="Websites">{t("nav.websites")}</option>
          <option value="Awards">{t("nav.awards")}</option>
          <option value="Projects">{t("nav.projects")}</option>
          <option value="General">General</option>
        </select>

        {/* Sort by */}
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          aria-label={t("toolbar.sortBy")}
          className="h-9 rounded-lg border border-brand/25 bg-background/60 px-3 text-[12.5px] font-medium text-foreground/85 focus:border-brand-bright/70 focus:outline-none"
        >
          <option value="date-desc">{t("common.lastUpdated")}</option>
          <option value="date-asc">Date (Oldest)</option>
          <option value="name-asc">{t("toolbar.nameAsc")}</option>
          <option value="size-desc">Size (Largest)</option>
        </select>

        {/* View Mode Toggle */}
        <div className="flex items-center rounded-lg border border-brand/25 bg-background/60 p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            aria-label={t("toolbar.gridView")}
            className={`flex size-8 items-center justify-center rounded-md transition ${
              viewMode === "grid"
                ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.3)]"
                : "text-muted-foreground/70 hover:text-foreground"
            }`}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            aria-label={t("toolbar.listView")}
            className={`flex size-8 items-center justify-center rounded-md transition ${
              viewMode === "list"
                ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.3)]"
                : "text-muted-foreground/70 hover:text-foreground"
            }`}
          >
            <List className="size-4" />
          </button>
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={onRefresh}
          aria-label={t("toolbar.refreshList")}
          className="flex size-9 items-center justify-center rounded-lg border border-brand/25 bg-background/60 text-muted-foreground/75 transition hover:border-brand-bright/50 hover:text-brand-bright"
        >
          <RotateCw className="size-4" />
        </button>
      </div>
    </div>
  );
}
