import { Grid, LayoutList, RotateCw, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

interface ProjectToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  sortBy: string;
  onSortByChange: (val: string) => void;
  tagFilter: string;
  onTagFilterChange: (val: string) => void;
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
  onRefresh: () => void;
  availableTags: string[];
}

export function ProjectToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  tagFilter,
  onTagFilterChange,
  viewMode,
  onViewModeChange,
  onRefresh,
  availableTags,
}: ProjectToolbarProps) {
  const { t } = useAdminAppearance();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Input */}
      <div className="dash-panel flex h-11 min-w-[220px] flex-1 items-center gap-3 rounded-lg border border-brand/30 bg-panel px-4 shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("toolbar.searchProjects")}
          className="w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Filter by Status */}
      <div className="w-[160px]">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="h-11 border-brand/30 bg-panel text-[13px] text-foreground hover:border-brand-bright">
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-muted-foreground">{t("toolbar.filterStatus")}</span>
              <SelectValue placeholder={t("toolbar.allStatus")} />
            </div>
          </SelectTrigger>
          <SelectContent className="border-brand/30 bg-panel-strong text-foreground backdrop-blur-xl">
            <SelectItem value="ALL">{t("toolbar.allStatus")}</SelectItem>
            <SelectItem value="Published">{t("common.published")}</SelectItem>
            <SelectItem value="Draft">{t("common.draft")}</SelectItem>
            <SelectItem value="Archived">{t("common.archived")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort by */}
      <div className="w-[160px]">
        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger className="h-11 border-brand/30 bg-panel text-[13px] text-foreground hover:border-brand-bright">
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-muted-foreground">{t("toolbar.sortBy")}</span>
              <SelectValue placeholder={t("toolbar.displayOrder")} />
            </div>
          </SelectTrigger>
          <SelectContent className="border-brand/30 bg-panel-strong text-foreground backdrop-blur-xl">
            <SelectItem value="order">{t("toolbar.displayOrder")}</SelectItem>
            <SelectItem value="name_asc">{t("toolbar.nameAsc")}</SelectItem>
            <SelectItem value="name_desc">{t("toolbar.nameDesc")}</SelectItem>
            <SelectItem value="status">{t("common.status")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filter by Tag */}
      <div className="w-[150px]">
        <Select value={tagFilter} onValueChange={onTagFilterChange}>
          <SelectTrigger className="h-11 border-brand/30 bg-panel text-[13px] text-foreground hover:border-brand-bright">
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-muted-foreground">{t("toolbar.filterTag")}</span>
              <SelectValue placeholder={t("toolbar.allTags")} />
            </div>
          </SelectTrigger>
          <SelectContent className="border-brand/30 bg-panel-strong text-foreground backdrop-blur-xl">
            <SelectItem value="ALL">{t("toolbar.allTags")}</SelectItem>
            {availableTags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* View Mode Controls and Refresh */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-brand/30 bg-panel p-0.5">
          <button
            type="button"
            aria-label={t("toolbar.gridView")}
            onClick={() => onViewModeChange("grid")}
            className={`grid size-9 place-items-center rounded-md transition ${
              viewMode === "grid"
                ? "border border-brand-bright/80 bg-brand/20 text-brand-bright shadow-[0_0_10px_rgba(0,255,180,0.25)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t("toolbar.listView")}
            onClick={() => onViewModeChange("list")}
            className={`grid size-9 place-items-center rounded-md transition ${
              viewMode === "list"
                ? "border border-brand-bright/80 bg-brand/20 text-brand-bright shadow-[0_0_10px_rgba(0,255,180,0.25)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutList className="size-4" />
          </button>
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          aria-label={t("toolbar.refreshList")}
          onClick={onRefresh}
          className="dash-panel grid size-11 place-items-center rounded-lg border border-brand/30 transition hover:border-brand-bright hover:text-brand-bright"
        >
          <RotateCw className="size-4 text-foreground/80" />
        </button>
      </div>
    </div>
  );
}
