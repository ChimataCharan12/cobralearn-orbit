import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  Trash2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ProjectItem, ProjectStatus } from "@/lib/projects-data";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

interface ProjectTableProps {
  projects: ProjectItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  canMoveUp?: (id: string) => boolean;
  canMoveDown?: (id: string) => boolean;
  getMoveUpTitle?: (id: string) => string;
  getMoveDownTitle?: (id: string) => string;
  onView: (project: ProjectItem) => void;
  onEdit?: (project: ProjectItem) => void;
  onDuplicate: (project: ProjectItem) => void;
  onDelete: (project: ProjectItem) => void;
  onBulkAction: (action: "publish" | "draft" | "delete") => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalCount: number;
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useAdminAppearance();

  if (status === "Published") {
    return (
      <span className="status-published inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
        <span className="size-1.5 rounded-full bg-brand-bright shadow-[0_0_5px_var(--brand-bright)]" />
        {t("common.published")}
      </span>
    );
  }
  if (status === "Draft") {
    return (
      <span className="status-draft inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
        <span className="size-1.5 rounded-full bg-brand-gold shadow-[0_0_5px_var(--brand-gold)]" />
        {t("common.draft")}
      </span>
    );
  }
  return (
    <span className="status-archived inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
      <span className="size-1.5 rounded-full bg-muted-foreground/60" />
      {t("common.archived")}
    </span>
  );
}

const actionBtnBase =
  "grid size-8 place-items-center rounded-md border border-brand/20 bg-panel-strong text-foreground/50 transition-all duration-150 hover:border-brand-bright/70 hover:text-brand-bright hover:shadow-[0_0_8px_color-mix(in_oklab,var(--brand-bright)_18%,transparent)]";

export function ProjectTable({
  projects,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  getMoveUpTitle,
  getMoveDownTitle,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onBulkAction,
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalCount,
}: ProjectTableProps) {
  const { t } = useAdminAppearance();
  const visibleSelectedCount = projects.filter((p) => selectedIds.includes(p.id)).length;
  const isAllSelected = projects.length > 0 && visibleSelectedCount === projects.length;
  const isPartiallySelected = visibleSelectedCount > 0 && visibleSelectedCount < projects.length;

  const canMoveUpFn =
    canMoveUp ??
    ((id: string) => {
      const idx = projects.findIndex((p) => p.id === id);
      return idx > 0;
    });

  const canMoveDownFn =
    canMoveDown ??
    ((id: string) => {
      const idx = projects.findIndex((p) => p.id === id);
      return idx >= 0 && idx < projects.length - 1;
    });

  const getMoveUpTitleFn =
    getMoveUpTitle ??
    ((id: string) => (canMoveUpFn(id) ? "Move up" : "Cannot move up"));

  const getMoveDownTitleFn =
    getMoveDownTitle ??
    ((id: string) => (canMoveDownFn(id) ? "Move down" : "Cannot move down"));

  return (
    <div
      className="overflow-hidden rounded-xl border border-brand/22"
      style={{
        background: "linear-gradient(160deg, color-mix(in oklab, var(--panel-strong) 96%, transparent), color-mix(in oklab, var(--panel) 80%, transparent))",
        boxShadow: "0 0 0 1px color-mix(in oklab, var(--brand) 15%, transparent), 0 8px 40px color-mix(in oklab, var(--background) 60%, transparent), inset 0 1px 0 color-mix(in oklab, var(--brand-bright) 8%, transparent)",
        backdropFilter: "blur(14px)",
      }}
    >
      {/* Table responsive container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          {/* Table Header */}
          <thead>
            <tr
              className="border-b border-brand/15 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              style={{
                background: "linear-gradient(90deg, color-mix(in oklab, var(--panel-strong) 98%, transparent), color-mix(in oklab, var(--panel-strong) 95%, var(--brand) 5%))",
              }}
            >
              <th className="w-12 px-4 py-3.5 text-center">
                <Checkbox
                  checked={isAllSelected ? true : isPartiallySelected ? "indeterminate" : false}
                  onCheckedChange={onToggleSelectAll}
                  aria-label="Select all projects"
                  className="border-brand/40 data-[state=checked]:border-brand-bright data-[state=checked]:bg-brand-bright data-[state=checked]:text-black data-[state=indeterminate]:border-brand-bright/70 data-[state=indeterminate]:bg-brand-bright/30 data-[state=indeterminate]:text-brand-bright"
                />
              </th>
              <th className="w-10 px-3 py-3.5">#</th>
              <th className="min-w-[200px] px-4 py-3.5">{t("table.project")}</th>
              <th className="min-w-[260px] px-4 py-3.5">{t("table.description")}</th>
              <th className="min-w-[110px] px-4 py-3.5">{t("common.status")}</th>
              <th className="w-[88px] px-4 py-3.5 text-center">{t("common.order")}</th>
              <th className="w-[148px] px-4 py-3.5 text-center">{t("common.actions")}</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-brand/8">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-muted-foreground">
                  {t("projects.table.noMatch")}
                </td>
              </tr>
            ) : (
              projects.map((project, index) => {
                const isSelected = selectedIds.includes(project.id);
                return (
                  <tr
                    key={project.id}
                    className={`project-table-row ${isSelected ? "bg-brand/8" : ""}`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(project.id)}
                        aria-label={`Select ${project.name}`}
                        className="border-brand/40 data-[state=checked]:border-brand-bright data-[state=checked]:bg-brand-bright data-[state=checked]:text-black"
                      />
                    </td>

                    {/* Row Index */}
                    <td className="px-3 py-3 font-mono text-[11.5px] text-muted-foreground/70">
                      {project.order || index + 1}
                    </td>

                    {/* Project Name + Thumbnail */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-brand/22 shadow-[0_0_8px_color-mix(in_oklab,var(--brand)_12%,transparent)]">
                          <img
                            src={project.image}
                            alt={project.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-foreground text-[13.5px]">
                              {project.name}
                            </span>
                            {project.liveUrl && (
                              <a
                                href={project.liveUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 text-muted-foreground/60 transition hover:text-brand-bright"
                                title="Open Live Demo"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3">
                      <p className="line-clamp-2 text-[12px] leading-relaxed text-foreground/65">
                        {project.description}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={project.status} />
                    </td>

                    {/* Order Controls */}
                    <td className="px-4 py-3 text-center">
                      <div
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1"
                        style={{
                          background: "color-mix(in oklab, var(--panel-strong) 80%, transparent)",
                          border: "1px solid color-mix(in oklab, var(--brand) 20%, transparent)",
                        }}
                      >
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={!canMoveUpFn(project.id)}
                          onClick={() => onMoveUp(project.id)}
                          title={getMoveUpTitleFn(project.id)}
                          className="text-muted-foreground/60 transition hover:text-brand-bright disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <span className="min-w-[14px] text-center font-mono text-[11.5px] font-semibold text-foreground/80">
                          {project.order}
                        </span>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={!canMoveDownFn(project.id)}
                          onClick={() => onMoveDown(project.id)}
                          title={getMoveDownTitleFn(project.id)}
                          className="text-muted-foreground/60 transition hover:text-brand-bright disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* View */}
                        <button
                          type="button"
                          aria-label="View project"
                          onClick={() => onView(project)}
                          className={actionBtnBase}
                          title="View Details"
                        >
                          <Eye className="size-3.5" />
                        </button>

                        {/* Edit */}
                        <Link
                          to="/admin/projects/edit"
                          search={{ id: project.id }}
                          aria-label="Edit project"
                          onClick={() => onEdit?.(project)}
                          className={actionBtnBase}
                          title="Edit Project"
                        >
                          <Edit2 className="size-3.5" />
                        </Link>

                        {/* Duplicate */}
                        <button
                          type="button"
                          aria-label="Duplicate project"
                          onClick={() => onDuplicate(project)}
                          className={actionBtnBase}
                          title="Duplicate Project"
                        >
                          <Copy className="size-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          aria-label="Delete project"
                          onClick={() => onDelete(project)}
                          className="grid size-8 place-items-center rounded-md border border-destructive/35 bg-destructive/8 text-destructive/80 transition-all duration-150 hover:border-destructive hover:bg-destructive/18 hover:text-red-400 hover:shadow-[0_0_8px_color-mix(in_oklab,var(--destructive)_20%,transparent)]"
                          title="Delete Project"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 border-t border-brand/12 px-5 py-3 text-[12px] text-muted-foreground"
        style={{
          background: "linear-gradient(90deg, color-mix(in oklab, var(--panel-strong) 96%, transparent), color-mix(in oklab, var(--panel-strong) 94%, var(--brand) 6%))",
        }}
      >
        {/* Left: Bulk selection */}
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isAllSelected ? true : isPartiallySelected ? "indeterminate" : false}
            onCheckedChange={onToggleSelectAll}
            aria-label="Select all"
            className="border-brand/40 data-[state=checked]:border-brand-bright data-[state=checked]:bg-brand-bright data-[state=checked]:text-black data-[state=indeterminate]:border-brand-bright/70 data-[state=indeterminate]:bg-brand-bright/30 data-[state=indeterminate]:text-brand-bright"
          />
          <span>{selectedIds.length} selected</span>

          {selectedIds.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-md border border-brand/28 bg-panel px-2.5 py-1 text-[11.5px] font-medium text-foreground/80 transition hover:border-brand-bright hover:text-brand-bright"
                >
                  Bulk Actions <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="border-brand/30 bg-panel-strong text-foreground backdrop-blur-xl">
                <DropdownMenuItem onClick={() => onBulkAction("publish")}>
                  Set as Published
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkAction("draft")}>
                  Set as Draft
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onBulkAction("delete")}
                  className="text-destructive focus:bg-destructive/15 focus:text-destructive"
                >
                  Delete Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Right: Pagination */}
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
          </span>

          {/* Page buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="grid size-7 place-items-center rounded-md border border-brand/20 text-muted-foreground/70 transition hover:border-brand-bright hover:text-foreground disabled:opacity-35"
            >
              <ChevronLeft className="size-3.5" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`grid size-7 place-items-center rounded-md text-[11.5px] font-semibold transition ${
                  currentPage === pageNum
                    ? "border border-brand-bright/80 bg-brand/20 text-brand-bright shadow-[0_0_10px_color-mix(in_oklab,var(--brand-bright)_25%,transparent)]"
                    : "border border-brand/18 text-muted-foreground/70 hover:border-brand-bright hover:text-foreground"
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="grid size-7 place-items-center rounded-md border border-brand/20 text-muted-foreground/70 transition hover:border-brand-bright hover:text-foreground disabled:opacity-35"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          {/* Items per page */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md border border-brand/20 bg-panel px-2.5 py-1 text-[11.5px] font-medium text-foreground/70 transition hover:border-brand-bright"
              >
                {pageSize} / page <ChevronDown className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="border-brand/30 bg-panel-strong text-foreground backdrop-blur-xl">
              {[8, 10, 20, 50].map((size) => (
                <DropdownMenuItem key={size} onClick={() => onPageSizeChange(size)}>
                  {size} / page
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
