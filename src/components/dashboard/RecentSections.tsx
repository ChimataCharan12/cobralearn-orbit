import { ArrowRight, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  activity,
  recentAds,
  recentAwards,
  recentProjects,
  type Status,
} from "@/lib/dashboard-data";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

function Panel({
  title,
  children,
  className = "",
  onViewAll,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  onViewAll?: () => void;
}) {
  const { t } = useAdminAppearance();
  return (
    <section className={`dash-panel rounded-xl border border-brand/28 p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15.5px] font-semibold text-foreground">{title}</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/8 px-3 py-1 text-[11.5px] font-semibold text-brand-bright transition hover:border-brand-bright hover:bg-brand/15 hover:shadow-[0_0_10px_color-mix(in_oklab,var(--brand-bright)_20%,transparent)]"
        >
          {t("common.viewAll")} <ArrowRight className="size-3" />
        </button>
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const { t } = useAdminAppearance();
  if (status === "Published") {
    return (
      <span className="status-published inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide">
        <span className="size-1.5 rounded-full bg-brand-bright shadow-[0_0_5px_var(--brand-bright)]" />
        {t("common.published")}
      </span>
    );
  }
  return (
    <span className="status-draft inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide">
      <span className="size-1.5 rounded-full bg-brand-gold shadow-[0_0_5px_var(--brand-gold)]" />
      {t("common.draft")}
    </span>
  );
}

const dots = {
  green: "bg-brand-bright shadow-[0_0_6px_var(--brand-bright)]",
  red: "bg-destructive shadow-[0_0_6px_var(--color-destructive)]",
  muted: "bg-muted-foreground/40",
} as const;

export function RecentActivity({ items }: { items?: ActivityItem[] } = {}) {
  const navigate = useNavigate();
  const { t } = useAdminAppearance();
  const list = items !== undefined ? items : activity;

  return (
    <Panel
      title={t("dashboard.recentActivity")}
      className="h-full"
      onViewAll={() => navigate({ to: "/admin/profile" })}
    >
      {list.length > 0 ? (
        <ul className="divide-y divide-brand/10">
          {list.map((a, idx) => (
            <li key={a.title + a.item + idx} className="flex items-center gap-3.5 py-2.5">
              {a.img ? (
                <img
                  src={a.img}
                  alt=""
                  loading="lazy"
                  className="h-10 w-[64px] shrink-0 rounded-md border border-brand/20 object-cover"
                />
              ) : (
                <span className="grid h-10 w-[64px] shrink-0 place-items-center rounded-md border border-brand/15 bg-muted/30 text-muted-foreground">
                  <X className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1 text-[12.5px]">
                <p className="font-semibold text-foreground">{a.title}</p>
                <p className="truncate text-foreground/60 mt-0.5">{a.item}</p>
              </div>
              <span className="shrink-0 text-[11px] text-foreground/50">{a.time}</span>
              <span className={`size-1.5 shrink-0 rounded-full ${dots[a.dot]}`} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex min-h-[140px] flex-col items-center justify-center text-center">
          <p className="text-[13px] font-medium text-foreground/65">{t("common.noActivity")}</p>
          <p className="mt-1 text-[11.5px] text-foreground/45">{t("common.noActivityDesc")}</p>
        </div>
      )}
    </Panel>
  );
}

export function RecentProjects({ items }: { items?: RecentProjectItem[] } = {}) {
  const navigate = useNavigate();
  const { t } = useAdminAppearance();
  const list = items !== undefined ? items : recentProjects;

  return (
    <Panel
      title={t("dashboard.recentProjects")}
      onViewAll={() => navigate({ to: "/admin/projects" })}
    >
      {list.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {list.map((p) => (
            <article
              key={p.name}
              onClick={() => navigate({ to: "/admin/projects" })}
              className="group cursor-pointer rounded-lg border border-brand/20 bg-panel/60 p-2 transition-all duration-200 hover:border-brand-bright/50 hover:shadow-[0_0_18px_color-mix(in_oklab,var(--brand)_15%,transparent)] hover:translate-y-[-1px]"
            >
              <div className="overflow-hidden rounded-md border border-brand/15">
                <img
                  src={p.img}
                  alt={p.name}
                  loading="lazy"
                  className="aspect-[2.7/1] w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <p className="mt-2 truncate text-[12.5px] font-semibold text-foreground group-hover:text-brand-bright transition-colors">
                {p.name}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {p.tags.slice(0, 2).map((tTag) => (
                  <span
                    key={tTag}
                    className="rounded bg-brand/8 border border-brand/20 px-1.5 py-px text-[10px] font-medium text-foreground/75"
                  >
                    {tTag}
                  </span>
                ))}
                <span className="ml-auto">
                  <StatusBadge status={p.status} />
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[100px] flex-col items-center justify-center text-center">
          <p className="text-[13px] font-medium text-foreground/65">{t("common.noProjectsYet")}</p>
          <p className="mt-1 text-[11.5px] text-foreground/45">{t("common.noProjectsDesc")}</p>
        </div>
      )}
    </Panel>
  );
}

function MiniGrid({
  items,
  emptyMessage,
  onItemClick,
}: {
  items: { name: string; status: Status; img: string }[];
  emptyMessage?: string;
  onItemClick?: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[90px] flex-col items-center justify-center text-center">
        <p className="text-[12px] font-medium text-foreground/60">{emptyMessage || "No items yet"}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map((i) => (
        <article
          key={i.name}
          onClick={onItemClick}
          className="flex flex-col cursor-pointer rounded-lg border border-brand/18 bg-panel/50 p-1.5 transition-all duration-200 hover:border-brand/40 hover:translate-y-[-1px]"
        >
          <img
            src={i.img}
            alt={i.name}
            loading="lazy"
            className="aspect-[1.65/1] w-full rounded-md border border-brand/15 object-cover"
          />
          <p className="mt-1.5 flex-1 truncate text-[10.5px] font-semibold leading-tight text-foreground">
            {i.name}
          </p>
          <span className="mt-1.5">
            <StatusBadge status={i.status} />
          </span>
        </article>
      ))}
    </div>
  );
}

export function RecentAdvertisements({ items }: { items?: RecentCardItem[] } = {}) {
  const navigate = useNavigate();
  const { t } = useAdminAppearance();
  const list = items !== undefined ? items : recentAds;

  return (
    <Panel
      title={t("dashboard.recentAds")}
      onViewAll={() => navigate({ to: "/admin/advertisements" })}
    >
      <MiniGrid
        items={list}
        emptyMessage={t("common.noAdsYet")}
        onItemClick={() => navigate({ to: "/admin/advertisements" })}
      />
    </Panel>
  );
}

export function RecentAwards({ items }: { items?: RecentCardItem[] } = {}) {
  const navigate = useNavigate();
  const { t } = useAdminAppearance();
  const list = items !== undefined ? items : recentAwards;

  return (
    <Panel
      title={t("dashboard.recentAwards")}
      onViewAll={() => navigate({ to: "/admin/awards" })}
    >
      <MiniGrid
        items={list}
        emptyMessage={t("common.noAwardsYet")}
        onItemClick={() => navigate({ to: "/admin/awards" })}
      />
    </Panel>
  );
}
