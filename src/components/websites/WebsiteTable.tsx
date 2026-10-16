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
import { Link, useNavigate } from "@tanstack/react-router";
import type { WebsiteItem, WebsiteStatus } from "@/lib/websites-data";

interface WebsiteTableProps {
  websites: WebsiteItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  canMoveUp?: (id: string) => boolean;
  canMoveDown?: (id: string) => boolean;
  getMoveUpTitle?: (id: string) => string;
  getMoveDownTitle?: (id: string) => string;
  onView: (website: WebsiteItem) => void;
  onEdit?: (website: WebsiteItem) => void;
  onDuplicate: (website: WebsiteItem) => void;
  onDelete: (website: WebsiteItem) => void;
  onBulkAction: (action: "publish" | "draft" | "delete") => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalCount: number;
}

import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

function StatusBadge({ status }: { status: WebsiteStatus }) {
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

export function WebsiteTable({
  websites,
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
}: WebsiteTableProps) {
  const { t } = useAdminAppearance();
  const navigate = useNavigate();
  const allSelected = websites.length > 0 && websites.every((w) => selectedIds.includes(w.id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const canMoveUpFn =
    canMoveUp ??
    ((id: string) => {
      const idx = websites.findIndex((w) => w.id === id);
      return idx > 0;
    });

  const canMoveDownFn =
    canMoveDown ??
    ((id: string) => {
      const idx = websites.findIndex((w) => w.id === id);
      return idx >= 0 && idx < websites.length - 1;
    });

  const getMoveUpTitleFn =
    getMoveUpTitle ??
    ((id: string) => (canMoveUpFn(id) ? "Move up" : "Already first in display order"));

  const getMoveDownTitleFn =
    getMoveDownTitle ??
    ((id: string) => (canMoveDownFn(id) ? "Move down" : "Already last in display order"));

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
                {/* Checkbox */}
                <th className="w-10 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={onToggleSelectAll}
                    aria-label="Select all websites"
                    className="size-4 rounded border-brand/35 bg-panel text-brand-bright accent-brand-bright focus:ring-0 cursor-pointer"
                  />
                </th>

                {/* Number */}
                <th className="w-12 px-2 py-3 text-center">#</th>

                {/* Website Info */}
                <th className="min-w-[240px] px-4 py-3">{t("table.website")}</th>

                {/* Description */}
                <th className="min-w-[320px] px-4 py-3">{t("table.description")}</th>

                {/* Status */}
                <th className="w-28 px-4 py-3">{t("common.status")}</th>

                {/* Order Controls */}
                <th className="w-24 px-4 py-3 text-center">{t("common.order")}</th>

                {/* Actions */}
                <th className="w-36 px-4 py-3 text-center">{t("common.actions")}</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-brand/12">
              {websites.map((website, index) => {
                const isSelected = selectedIds.includes(website.id);

                return (
                  <tr
                    key={website.id}
                    className={`project-table-row transition-colors ${
                      isSelected ? "bg-brand/10" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(website.id)}
                        aria-label={`Select ${website.name}`}
                        className="size-4 rounded border-brand/35 bg-panel text-brand-bright accent-brand-bright focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Number */}
                    <td className="px-2 py-3 text-center font-mono text-[12px] text-muted-foreground/75">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>

                    {/* Website Thumbnail + Title + Live link */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        <div className="relative h-11 w-18 shrink-0 overflow-hidden rounded-md border border-brand/25 shadow-[0_0_8px_color-mix(in_oklab,var(--brand)_15%,transparent)]">
                          <img
                            src={website.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>

                        {/* Name + Live Link */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-foreground text-[13.5px]">
                              {website.name}
                            </span>
                            {website.url && (
                              <a
                                href={website.url}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 text-muted-foreground/60 transition hover:text-brand-bright"
                                title="Open Live Site"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                          {website.category && (
                            <p className="text-[11px] text-brand-cyan/80 truncate">
                              {website.category}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3">
                      <p className="line-clamp-2 text-[12px] leading-relaxed text-foreground/65">
                        {website.description}
                      </p>
                    </td>



                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={website.status} />
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
                          disabled={!canMoveUpFn(website.id)}
                          onClick={() => onMoveUp(website.id)}
                          title={getMoveUpTitleFn(website.id)}
                          className="text-muted-foreground/60 transition hover:text-brand-bright disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <span className="min-w-[14px] text-center font-mono text-[11.5px] font-semibold text-foreground/80">
                          {website.order}
                        </span>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={!canMoveDownFn(website.id)}
                          onClick={() => onMoveDown(website.id)}
                          title={getMoveDownTitleFn(website.id)}
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
                          aria-label="View website"
                          onClick={() => onView(website)}
                          className={actionBtnBase}
                          title="View Details"
                        >
                          <Eye className="size-3.5" />
                        </button>

                        {/* Edit */}
                        <Link
                          to="/admin/websites/edit"
                          search={{ id: website.id }}
                          aria-label="Edit website"
                          onClick={() => onEdit?.(website)}
                          className={actionBtnBase}
                          title="Edit Website"
                        >
                          <Edit2 className="size-3.5" />
                        </Link>

                        {/* Duplicate */}
                        <button
                          type="button"
                          aria-label="Duplicate website"
                          onClick={() => onDuplicate(website)}
                          className={actionBtnBase}
                          title="Duplicate Website"
                        >
                          <Copy className="size-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          aria-label="Delete website"
                          onClick={() => onDelete(website)}
                          className={`${actionBtnBase} hover:border-red-500/60 hover:text-red-400 hover:shadow-[0_0_8px_rgba(239,68,68,0.25)]`}
                          title="Delete Website"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {websites.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground/60">
                    No websites found matching your search and filter criteria.
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
              Showing {websites.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{" "}
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount} websites
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
            {selectedIds.length} website{selectedIds.length > 1 ? "s" : ""} selected
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
