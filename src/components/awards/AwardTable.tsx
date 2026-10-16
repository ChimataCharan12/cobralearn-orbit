import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Edit2,
  Eye,
  Trash2,
  Award,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { AwardItem, AwardStatus } from "@/lib/awards-data";

interface AwardTableProps {
  awards: AwardItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  canMoveUpFn?: ((id: string) => boolean) | undefined;
  canMoveDownFn?: ((id: string) => boolean) | undefined;
  getMoveUpTitleFn?: ((id: string) => string) | undefined;
  getMoveDownTitleFn?: ((id: string) => string) | undefined;
  onView: (award: AwardItem) => void;
  onEdit?: (award: AwardItem) => void;
  onDuplicate: (award: AwardItem) => void;
  onDelete: (award: AwardItem) => void;
  onBulkAction: (action: "publish" | "draft" | "delete") => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalCount: number;
}

import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

function StatusBadge({ status }: { status: AwardStatus }) {
  const { t } = useAdminAppearance();

  if (status === "Published") {
    return (
      <span className="status-published inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide">
        <span className="size-1.5 rounded-full bg-brand-bright shadow-[0_0_5px_var(--brand-bright)]" />
        {t("common.published")}
      </span>
    );
  }
  if (status === "Draft") {
    return (
      <span className="status-draft inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide">
        <span className="size-1.5 rounded-full bg-brand-gold shadow-[0_0_5px_var(--brand-gold)]" />
        {t("common.draft")}
      </span>
    );
  }
  return (
    <span className="status-archived inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide">
      <span className="size-1.5 rounded-full bg-muted-foreground/60" />
      {t("common.archived")}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  let styleCls = "border-blue-500/30 bg-blue-500/10 text-blue-400";
  if (category === "Community") {
    styleCls = "border-purple-500/30 bg-purple-500/10 text-purple-300";
  } else if (category === "Technical") {
    styleCls = "border-brand-bright/35 bg-brand/12 text-brand-bright";
  } else if (category === "Competition") {
    styleCls = "border-amber-500/30 bg-amber-500/10 text-amber-300";
  } else if (category === "Certification") {
    styleCls = "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
  }

  return (
    <span
      className={`inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${styleCls}`}
    >
      {category}
    </span>
  );
}

export function AwardTable({
  awards,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onMoveUp,
  onMoveDown,
  canMoveUpFn = () => true,
  canMoveDownFn = () => true,
  getMoveUpTitleFn = () => "Move up",
  getMoveDownTitleFn = () => "Move down",
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
}: AwardTableProps) {
  const { t } = useAdminAppearance();
  const allSelected =
    awards.length > 0 && awards.every((a) => selectedIds.includes(a.id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const actionBtnBase =
    "grid size-7.5 place-items-center rounded-md border border-brand/20 bg-panel text-muted-foreground/80 transition hover:border-brand-bright hover:text-brand-bright hover:shadow-[0_0_8px_color-mix(in_oklab,var(--brand-bright)_25%,transparent)]";

  return (
    <div className="space-y-3">
      {/* ── TABLE CONTAINER ── */}
      <div className="dash-panel overflow-hidden rounded-xl border border-brand/25">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-brand/20 bg-panel-strong text-[11.5px] font-semibold tracking-wider text-muted-foreground/90 uppercase">
                <th className="w-10 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={onToggleSelectAll}
                    aria-label="Select all awards"
                    className="size-4 rounded border-brand/35 bg-panel text-brand-bright accent-brand-bright focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="w-12 px-2 py-3 text-center">#</th>
                <th className="min-w-[220px] px-4 py-3">{t("table.award")}</th>
                <th className="min-w-[150px] px-4 py-3">Organization</th>
                <th className="min-w-[130px] px-4 py-3">{t("common.category")}</th>
                <th className="w-28 px-4 py-3">{t("table.date")}</th>
                <th className="w-28 px-4 py-3">{t("common.status")}</th>
                <th className="w-24 px-4 py-3 text-center">{t("common.order")}</th>
                <th className="w-36 px-4 py-3 text-center">{t("common.actions")}</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-brand/12">
              {awards.map((award, index) => {
                const isSelected = selectedIds.includes(award.id);

                return (
                  <tr
                    key={award.id}
                    className={`project-table-row transition-colors ${
                      isSelected ? "bg-brand/10" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(award.id)}
                        aria-label={`Select ${award.name}`}
                        className="size-4 rounded border-brand/35 bg-panel text-brand-bright accent-brand-bright focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Number */}
                    <td className="px-2 py-3 text-center font-mono text-[12px] text-muted-foreground/75">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>

                    {/* Image + Title */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md border border-brand/25 bg-black/40 shadow-[0_0_8px_color-mix(in_oklab,var(--brand)_15%,transparent)] flex items-center justify-center">
                          {award.image ? (
                            <img
                              src={award.image}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Award className="size-5 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground text-[13.5px]">
                            {award.name}
                          </p>
                          {award.context && (
                            <p className="text-[11.5px] text-muted-foreground/70 truncate">
                              {award.context}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Organization */}
                    <td className="px-4 py-3 text-[13px] text-foreground/85">
                      {award.organization}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <CategoryBadge category={award.category} />
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-[12px] text-foreground/75">
                      {award.date}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={award.status} />
                    </td>

                    {/* Display Order */}
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
                          disabled={!canMoveUpFn(award.id)}
                          onClick={() => onMoveUp(award.id)}
                          title={getMoveUpTitleFn(award.id)}
                          className="text-muted-foreground/60 transition hover:text-brand-bright disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <span className="min-w-[14px] text-center font-mono text-[11.5px] font-semibold text-foreground/80">
                          {award.order}
                        </span>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={!canMoveDownFn(award.id)}
                          onClick={() => onMoveDown(award.id)}
                          title={getMoveDownTitleFn(award.id)}
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
                          aria-label="View award"
                          onClick={() => onView(award)}
                          className={actionBtnBase}
                          title="View Details"
                        >
                          <Eye className="size-3.5" />
                        </button>

                        {/* Edit */}
                        <Link
                          to="/admin/awards/edit"
                          search={{ id: award.id }}
                          aria-label="Edit award"
                          onClick={() => onEdit?.(award)}
                          className={actionBtnBase}
                          title="Edit Award"
                        >
                          <Edit2 className="size-3.5" />
                        </Link>

                        {/* Duplicate */}
                        <button
                          type="button"
                          aria-label="Duplicate award"
                          onClick={() => onDuplicate(award)}
                          className={actionBtnBase}
                          title="Duplicate as Draft"
                        >
                          <Copy className="size-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          aria-label="Delete award"
                          onClick={() => onDelete(award)}
                          className={`${actionBtnBase} hover:border-red-500/60 hover:text-red-400 hover:shadow-[0_0_8px_rgba(239,68,68,0.25)]`}
                          title="Delete Award"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bulk Action Bar (when rows are selected) */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand/20 bg-panel-strong px-4 py-2.5">
            <span className="text-[12.5px] font-semibold text-foreground/80">
              {selectedIds.length} award{selectedIds.length > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onBulkAction("publish")}
                className="rounded-md border border-brand/35 bg-panel px-3 py-1 text-[12px] font-semibold text-brand-bright transition hover:bg-brand/12"
              >
                Publish Selected
              </button>
              <button
                type="button"
                onClick={() => onBulkAction("draft")}
                className="rounded-md border border-brand/25 bg-panel px-3 py-1 text-[12px] font-semibold text-foreground/80 transition hover:bg-brand/10"
              >
                Set to Draft
              </button>
              <button
                type="button"
                onClick={() => onBulkAction("delete")}
                className="rounded-md border border-red-500/40 bg-red-950/20 px-3 py-1 text-[12px] font-semibold text-red-400 transition hover:bg-red-900/30"
              >
                Delete Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── PAGINATION BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[12.5px] text-muted-foreground/80">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded border border-brand/20 bg-panel px-2 py-1 text-foreground/90 outline-none focus:border-brand-bright cursor-pointer"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>per page • Total {totalCount} awards</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Previous page"
            className="grid size-8 place-items-center rounded border border-brand/20 bg-panel text-muted-foreground transition hover:border-brand-bright hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-2 font-mono text-[12px] text-foreground/90">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Next page"
            className="grid size-8 place-items-center rounded border border-brand/20 bg-panel text-muted-foreground transition hover:border-brand-bright hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
