import {
  ChevronDown,
  ChevronUp,
  Copy,
  Edit2,
  Eye,
  Trash2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { AdvertisementItem, AdStatus } from "@/lib/advertisements-data";

interface AdvertisementGridProps {
  advertisements: AdvertisementItem[];
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
}

function StatusBadge({ status }: { status: AdStatus }) {
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

export function AdvertisementGrid({
  advertisements,
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
}: AdvertisementGridProps) {
  const canMoveUpFn = canMoveUp ?? (() => true);
  const canMoveDownFn = canMoveDown ?? (() => true);
  const getMoveUpTitleFn = getMoveUpTitle ?? (() => "Move up");
  const getMoveDownTitleFn = getMoveDownTitle ?? (() => "Move down");

  const actionBtnBase =
    "grid size-7.5 place-items-center rounded-md border border-brand/20 bg-panel text-muted-foreground/80 transition hover:border-brand-bright hover:text-brand-bright hover:shadow-[0_0_8px_color-mix(in_oklab,var(--brand-bright)_25%,transparent)]";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {advertisements.map((ad) => (
        <div
          key={ad.id}
          className="dash-panel group relative flex flex-col justify-between overflow-hidden rounded-xl border border-brand/25 transition-all duration-200 hover:border-brand-bright/60 hover:shadow-[0_0_20px_color-mix(in_oklab,var(--brand)_18%,transparent)]"
        >
          {/* Top image banner */}
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/40">
            <img
              src={ad.image}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80" />
            <div className="absolute top-2.5 left-2.5">
              <span className="inline-block rounded-md border border-brand/40 bg-background/85 px-2 py-0.5 text-[10.5px] font-semibold text-brand-cyan backdrop-blur-md">
                {ad.campaign}
              </span>
            </div>
            <div className="absolute top-2.5 right-2.5">
              <StatusBadge status={ad.status} />
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col justify-between p-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="line-clamp-1 font-semibold text-foreground text-[14.5px]">
                  {ad.name}
                </h3>
              </div>
              {ad.brand && (
                <p className="mt-0.5 text-[11.5px] font-medium text-brand-bright/80">
                  {ad.brand}
                </p>
              )}
              <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-foreground/65">
                {ad.description}
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
                  disabled={!canMoveUpFn(ad.id)}
                  onClick={() => onMoveUp(ad.id)}
                  title={getMoveUpTitleFn(ad.id)}
                  className="text-muted-foreground/60 transition hover:text-brand-bright disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronUp className="size-3" />
                </button>
                <span className="min-w-[12px] text-center font-mono text-[11px] font-semibold text-foreground/80">
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
                  <ChevronDown className="size-3" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onView(ad)}
                  className={actionBtnBase}
                  title="View Details"
                >
                  <Eye className="size-3.5" />
                </button>

                <Link
                  to="/admin/advertisements/edit"
                  onClick={() => onEdit?.(ad)}
                  className={actionBtnBase}
                  title="Edit Advertisement"
                >
                  <Edit2 className="size-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={() => onDuplicate(ad)}
                  className={actionBtnBase}
                  title="Duplicate Advertisement"
                >
                  <Copy className="size-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(ad)}
                  className={`${actionBtnBase} hover:border-red-500/60 hover:text-red-400`}
                  title="Delete Advertisement"
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
