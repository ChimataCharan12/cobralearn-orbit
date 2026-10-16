import {
  ChevronDown,
  ChevronUp,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  Trash2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ProjectItem, ProjectStatus } from "@/lib/projects-data";

interface ProjectGridProps {
  projects: ProjectItem[];
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
}

function StatusBadge({ status }: { status: ProjectStatus }) {
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

export function ProjectGrid({
  projects,
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
}: ProjectGridProps) {
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {projects.map((project) => (
        <div
          key={project.id}
          className="accent-green project-grid-card group relative flex flex-col overflow-hidden rounded-xl p-0 transition-all duration-200"
        >
          {/* Top highlight streak */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/15 to-transparent group-hover:via-brand-bright/35 transition-all duration-200" />

          {/* Card Image */}
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-xl border-b border-brand/15">
            <img
              src={project.image}
              alt={project.name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
            {/* Image overlay on hover */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-60" />
            <div className="absolute right-2 top-2">
              <StatusBadge status={project.status} />
            </div>
            <div
              className="absolute left-2 top-2 rounded px-2 py-0.5 font-mono text-[10.5px] font-semibold text-brand-bright"
              style={{ background: "color-mix(in oklab, var(--background) 75%, transparent)", backdropFilter: "blur(8px)", border: "1px solid color-mix(in oklab, var(--brand-bright) 30%, transparent)" }}
            >
              #{project.order}
            </div>
          </div>

          {/* Card Body */}
          <div className="flex flex-1 flex-col gap-2 p-3.5">
            {/* Title & Link */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[14px] font-bold leading-tight text-foreground transition-colors group-hover:text-brand-bright">
                {project.name}
              </h3>
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 shrink-0 text-muted-foreground/60 transition hover:text-brand-bright"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>

            {/* Description */}
            <p className="line-clamp-2 text-[12px] leading-relaxed text-foreground/65">
              {project.description}
            </p>

            {/* Technologies */}
            <div className="flex flex-wrap gap-1">
              {project.technologies.map((t) => (
                <span
                  key={t}
                  className="rounded border border-brand/18 bg-brand/6 px-1.5 py-px text-[10px] font-medium text-foreground/75"
                >
                  {t}
                </span>
              ))}
              {project.extraTechCount ? (
                <span className="rounded border border-border/25 bg-muted/20 px-1.5 py-px text-[10px] text-muted-foreground">
                  +{project.extraTechCount}
                </span>
              ) : null}
            </div>

            {/* Divider */}
            <div className="mt-auto h-px w-full bg-gradient-to-r from-transparent via-brand/15 to-transparent" />

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1">
              {/* Reorder */}
              <div
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5"
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

              {/* CRUD */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onView(project)}
                  className="grid size-7 place-items-center rounded-md border border-brand/18 bg-panel-strong/80 text-muted-foreground/60 transition hover:border-brand-bright hover:text-brand-bright"
                  title="View"
                >
                  <Eye className="size-3" />
                </button>
                <Link
                  to="/admin/projects/edit"
                  search={{ id: project.id }}
                  onClick={() => onEdit?.(project)}
                  className="grid size-7 place-items-center rounded-md border border-brand/18 bg-panel-strong/80 text-muted-foreground/60 transition hover:border-brand-bright hover:text-brand-bright"
                  title="Edit"
                >
                  <Edit2 className="size-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => onDuplicate(project)}
                  className="grid size-7 place-items-center rounded-md border border-brand/18 bg-panel-strong/80 text-muted-foreground/60 transition hover:border-brand-bright hover:text-brand-bright"
                  title="Duplicate"
                >
                  <Copy className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(project)}
                  className="grid size-7 place-items-center rounded-md border border-destructive/30 bg-destructive/8 text-destructive/70 transition hover:border-destructive hover:bg-destructive/18"
                  title="Delete"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
