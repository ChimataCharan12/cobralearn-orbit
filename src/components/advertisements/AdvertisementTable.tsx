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
import type { AdvertisementItem, AdStatus } from "@/lib/advertisements-data";

interface AdvertisementTableProps {
  advertisements: AdvertisementItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  canMoveUp?: (id: string) => boolean;
  canMoveDown?: (id: string) => boolean;
  getMoveUpTitle?: (id: string) => string;
  getMoveDownTitle?: (id: string) => string;
  onView: (ad: AdvertisementItem) => void;
  onEdit?: (ad: AdvertisementItem) => void;
  onDuplicate: (ad: AdvertisementItem) => void;
  onDelete: (ad: AdvertisementItem) => void;
  onBulkAction: (action: "publish" | "draft" | "delete") => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalCount: number;
}

import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

function StatusBadge({ status }: { status: AdStatus }) {
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

export function AdvertisementTable({
  advertisements,
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
}: AdvertisementTableProps) {
  const { t } = useAdminAppearance();
  const canMoveUpFn = canMoveUp ?? (() => true);
  const canMoveDownFn = canMoveDown ?? (() => true);
  const getMoveUpTitleFn = getMoveUpTitle ?? (() => "Move up");
  const getMoveDownTitleFn = getMoveDownTitle ?? (() => "Move down");

  const allSelected =
    advertisements.length > 0 && advertisements.every((a) => selectedIds.includes(a.id));
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
                    aria-label="Select all advertisements"
                    className="size-4 rounded border-brand/35 bg-panel text-brand-bright accent-brand-bright focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="w-12 px-2 py-3 text-center">#</th>
                <th className="min-w-[200px] px-4 py-3">{t("table.advertisement")}</th>
                <th className="min-w-[170px] px-4 py-3">Campaign</th>
                <th className="min-w-[260px] px-4 py-3">{t("table.description")}</th>
                <th className="w-28 px-4 py-3">{t("common.status")}</th>
                <th className="w-28 px-4 py-3">{t("table.date")}</th>
                <th className="w-24 px-4 py-3 text-center">{t("common.order")}</th>
                <th className="w-36 px-4 py-3 text-center">{t("common.actions")}</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-brand/12">
              {advertisements.map((ad, index) => {
                const isSelected = selectedIds.includes(ad.id);

                return (
                  <tr
                    key={ad.id}
                    className={`project-table-row transition-colors ${
                      isSelected ? "bg-brand/10" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(ad.id)}
                        aria-label={`Select ${ad.name}`}
                        className="size-4 rounded border-brand/35 bg-panel text-brand-bright accent-brand-bright focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Number */}
                    <td className="px-2 py-3 text-center font-mono text-[12px] text-muted-foreground/75">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>

                    {/* Thumbnail + Title */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-18 shrink-0 overflow-hidden rounded-md border border-brand/25 shadow-[0_0_8px_color-mix(in_oklab,var(--brand)_15%,transparent)]">
                          <img
                            src={ad.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground text-[13.5px]">
                            {ad.name}
                          </p>
                          {ad.brand && (
                            <p className="text-[11px] text-muted-foreground/70 truncate">
                              {ad.brand}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Campaign Badge */}
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md border border-brand/25 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand-cyan">
                        {ad.campaign}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3">
                      <p className="line-clamp-2 text-[12px] leading-relaxed text-foreground/65">
                        {ad.description}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={ad.status} />
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-[12px] text-foreground/75">
                      {ad.date}
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
                          disabled={!canMoveUpFn(ad.id)}
                          onClick={() => onMoveUp(ad.id)}
                          title={getMoveUpTitleFn(ad.id)}
                          className="text-muted-foreground/60 transition hover:text-brand-bright disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <span className="min-w-[14px] text-center font-mono text-[11.5px] font-semibold text-foreground/80">
                          {ad.order}
                        </span>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={!canMoveDownFn(ad.id)}
                          onClick={() => onMoveDown(ad.id)}
                          title={getMoveDownTitleFn(ad.id)}
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
                          aria-label="View advertisement"
                          onClick={() => onView(ad)}
                          className={actionBtnBase}
                          title="View Details"
                        >
                          <Eye className="size-3.5" />
                        </button>

                        {/* Edit */}
                        <Link
                          to="/admin/advertisements/edit"
                          aria-label="Edit advertisement"
                          onClick={() => onEdit?.(ad)}
                          className={actionBtnBase}
                          title="Edit Advertisement"
                        >
                          <Edit2 className="size-3.5" />
                        </Link>

                        {/* Duplicate */}
                        <button
                          type="button"
                          aria-label="Duplicate advertisement"
                          onClick={() => onDuplicate(ad)}
                          className={actionBtnBase}
                          title="Duplicate Advertisement"
                        >
                          <Copy className="size-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          aria-label="Delete advertisement"
                          onClick={() => onDelete(ad)}
                          className={`${actionBtnBase} hover:border-red-500/60 hover:text-red-400 hover:shadow-[0_0_8px_rgba(239,68,68,0.25)]`}
                          title="Delete Advertisement"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {advertisements.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground/60">
                    No advertisements found matching your search and filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION BAR ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand/15 bg-panel-strong px-4 py-3 text-[12.5px] text-muted-foreground/80">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="rounded border border-brand/25 bg-panel px-2 py-1 text-[12px] text-foreground outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
            <span className="ml-2">
              Showing {advertisements.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{" "}
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount} advertisements
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="grid size-8 place-items-center rounded border border-brand/20 bg-panel text-muted-foreground transition hover:border-brand-bright hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 font-mono text-[12px] font-semibold text-foreground">
              {currentPage} / {totalPages || 1}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="grid size-8 place-items-center rounded border border-brand/20 bg-panel text-muted-foreground transition hover:border-brand-bright hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── BULK ACTION BAR ── */}
      {selectedIds.length > 0 && (
        <div className="accent-green accent-card flex items-center justify-between rounded-xl px-5 py-3">
          <span className="text-[13px] font-semibold text-foreground">
            {selectedIds.length} advertisement{selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onBulkAction("publish")}
              className="rounded-lg border border-brand-bright/70 bg-brand/15 px-3 py-1.5 text-[12px] font-semibold text-brand-bright transition hover:bg-brand/25 hover:shadow-[0_0_10px_color-mix(in_oklab,var(--brand-bright)_25%,transparent)]"
            >
              Publish Selected
            </button>
            <button
              type="button"
              onClick={() => onBulkAction("draft")}
              className="rounded-lg border border-brand-gold/70 bg-brand-gold/15 px-3 py-1.5 text-[12px] font-semibold text-brand-gold transition hover:bg-brand-gold/25"
            >
              Set to Draft
            </button>
            <button
              type="button"
              onClick={() => onBulkAction("delete")}
              className="rounded-lg border border-red-500/60 bg-red-950/20 px-3 py-1.5 text-[12px] font-semibold text-red-400 transition hover:bg-red-900/30 hover:border-red-400"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
