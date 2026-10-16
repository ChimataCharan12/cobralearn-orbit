import {
  ChevronDown,
  ChevronUp,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  Trash2,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { WebsiteItem, WebsiteStatus } from "@/lib/websites-data";

interface WebsiteGridProps {
  websites: WebsiteItem[];
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
}

function StatusBadge({ status }: { status: WebsiteStatus }) {
  if (status === "Published") {
    return (
      <span className="status-published inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold">
        <span className="size-1.5 rounded-full bg-brand-bright shadow-[0_0_5px_var(--brand-bright)]" />
        Published
      </span>
    );
  }
  if (status === "Draft") {
    return (
      <span className="status-draft inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold">
        <span className="size-1.5 rounded-full bg-brand-gold shadow-[0_0_5px_var(--brand-gold)]" />
        Draft
      </span>
    );
  }
  return (
    <span className="status-archived inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold">
      <span className="size-1.5 rounded-full bg-muted-foreground/60" />
      Archived
    </span>
  );
}

export function WebsiteGrid({
  websites,
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
}: WebsiteGridProps) {
  const navigate = useNavigate();

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
    "grid size-7.5 place-items-center rounded-md border border-brand/20 bg-panel text-muted-foreground/80 transition hover:border-brand-bright hover:text-brand-bright";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {websites.map((website) => (
        <article
          key={website.id}
          className="dash-panel group relative flex flex-col overflow-hidden rounded-xl border border-brand/25 p-4 transition-all duration-200 hover:border-brand-bright/50 hover:shadow-[0_0_20px_color-mix(in_oklab,var(--brand)_18%,transparent)] hover:translate-y-[-2px]"
        >
          {/* Subtle top edge glow */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-bright)_40%,transparent)] to-transparent" />

          {/* Screenshot Cover */}
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-brand/20">
            <img
              src={website.image}
              alt={website.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute right-2 top-2">
              <StatusBadge status={website.status} />
            </div>
            {website.order && (
              <span className="absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-bright border border-brand/30">
                #{website.order}
              </span>
            )}
          </div>

          {/* Header Title + Category */}
          <div className="mt-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-[14px] text-foreground group-hover:text-brand-bright transition-colors line-clamp-1">
                {website.name}
              </h3>
              {website.category && (
                <p className="text-[11px] text-brand-cyan/80 truncate mt-0.5">{website.category}</p>
              )}
            </div>
            {website.url && (
              <a
                href={website.url}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 text-muted-foreground/60 hover:text-brand-bright transition"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>

          {/* Description */}
          <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-foreground/65 flex-1">
            {website.description}
          </p>

          {/* Tech pills */}
          <div className="mt-3 flex flex-wrap gap-1">
            {website.technologies.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded border border-brand/18 bg-brand/6 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80"
              >
                {t}
              </span>
            ))}
            {website.technologies.length > 3 && (
              <span className="rounded border border-border/25 bg-muted/20 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                +{website.technologies.length - 3}
              </span>
            )}
          </div>

          {/* Bottom order & actions bar */}
          <div className="mt-4 flex items-center justify-between border-t border-brand/12 pt-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Move up"
                disabled={!canMoveUpFn(website.id)}
                onClick={() => onMoveUp(website.id)}
                title={getMoveUpTitleFn(website.id)}
                className="text-muted-foreground/60 hover:text-brand-bright transition disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={!canMoveDownFn(website.id)}
                onClick={() => onMoveDown(website.id)}
                title={getMoveDownTitleFn(website.id)}
                className="text-muted-foreground/60 hover:text-brand-bright transition disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onView(website)}
                className={actionBtnBase}
                title="View Details"
              >
                <Eye className="size-3.5" />
              </button>
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
              <button
                type="button"
                onClick={() => onDuplicate(website)}
                className={actionBtnBase}
                title="Duplicate Website"
              >
                <Copy className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(website)}
                className={`${actionBtnBase} hover:border-red-500/50 hover:text-red-400`}
                title="Delete Website"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
