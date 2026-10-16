import {
  ChevronDown,
  ChevronUp,
  Copy,
  Edit2,
  Eye,
  Trash2,
  Award,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { AwardItem, AwardStatus } from "@/lib/awards-data";

interface AwardGridProps {
  awards: AwardItem[];
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
}

function StatusBadge({ status }: { status: AwardStatus }) {
  if (status === "Published") {
    return (
      <span className="status-published inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
        <span className="size-1.5 rounded-full bg-brand-bright shadow-[0_0_5px_var(--brand-bright)]" />
        Published
      </span>
    );
  }
  if (status === "Draft") {
    return (
      <span className="status-draft inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
        <span className="size-1.5 rounded-full bg-brand-gold shadow-[0_0_5px_var(--brand-gold)]" />
        Draft
      </span>
    );
  }
  return (
    <span className="status-archived inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
      <span className="size-1.5 rounded-full bg-muted-foreground/60" />
      Archived
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
      className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${styleCls}`}
    >
      {category}
    </span>
  );
}

export function AwardGrid({
  awards,
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
}: AwardGridProps) {
  const actionBtnBase =
    "grid size-7.5 place-items-center rounded-md border border-brand/20 bg-panel text-muted-foreground/80 transition hover:border-brand-bright hover:text-brand-bright hover:shadow-[0_0_8px_color-mix(in_oklab,var(--brand-bright)_25%,transparent)]";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {awards.map((award) => (
        <div
          key={award.id}
          className="dash-panel group relative flex flex-col justify-between overflow-hidden rounded-xl border border-brand/25 transition-all duration-200 hover:border-brand-bright/60 hover:shadow-[0_0_20px_color-mix(in_oklab,var(--brand)_18%,transparent)]"
        >
          {/* Top image */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40 flex items-center justify-center">
            {award.image ? (
              <img
                src={award.image}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <Award className="size-8 text-muted-foreground/40" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80" />
            <div className="absolute top-2.5 left-2.5">
              <CategoryBadge category={award.category} />
            </div>
            <div className="absolute top-2.5 right-2.5">
              <StatusBadge status={award.status} />
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col justify-between p-4">
            <div>
              <h3 className="line-clamp-1 font-semibold text-foreground text-[14.5px]">
                {award.name}
              </h3>
              <p className="mt-0.5 text-[11.5px] font-medium text-brand-bright/80 truncate">
                {award.organization} {award.context && `• ${award.context}`}
              </p>
              <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-foreground/65">
                {award.description}
              </p>
            </div>

            {/* Bottom Row */}
            <div className="mt-4 pt-3 border-t border-brand/15 flex items-center justify-between">
              {/* Order Controls */}
              <div
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5"
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
                  <ChevronUp className="size-3" />
                </button>
                <span className="min-w-[12px] text-center font-mono text-[11px] font-semibold text-foreground/80">
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
                  <ChevronDown className="size-3" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="View award"
                  onClick={() => onView(award)}
                  className={actionBtnBase}
                  title="View Details"
                >
                  <Eye className="size-3.5" />
                </button>

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

                <button
                  type="button"
                  aria-label="Duplicate award"
                  onClick={() => onDuplicate(award)}
                  className={actionBtnBase}
                  title="Duplicate as Draft"
                >
                  <Copy className="size-3.5" />
                </button>

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
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
