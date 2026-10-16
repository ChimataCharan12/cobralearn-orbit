import { ExternalLink } from "lucide-react";
import type { ProjectItem } from "@/lib/projects-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";

/* =========================================================================
   VIEW MODAL
   ========================================================================= */
export function ProjectViewModal({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-brand/30 bg-panel-strong text-foreground backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-xl font-bold">
            <span>{project.name}</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                project.status === "Published"
                  ? "border-brand-bright/70 bg-brand/15 text-brand-bright"
                  : "border-brand-gold/70 bg-brand-gold/10 text-brand-gold"
              }`}
            >
              {project.status}
            </span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Project display order #{project.order}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="overflow-hidden rounded-lg border border-border/40">
            <img
              src={project.image}
              alt={project.name}
              className="aspect-video w-full object-cover"
            />
          </div>

          <div>
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </h4>
            <p className="mt-1 text-[13.5px] leading-relaxed text-foreground/90">
              {project.description}
            </p>
          </div>

          <div>
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Technologies
            </h4>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {project.technologies.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[12px] font-medium text-brand-bright"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {project.liveUrl && (
            <div>
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Live URL
              </h4>
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand-cyan hover:underline"
              >
                {project.liveUrl} <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="portalOutline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



/* =========================================================================
   DELETE CONFIRMATION MODAL
   ========================================================================= */
export function ProjectDeleteDialog({
  project,
  open,
  onOpenChange,
  onConfirm,
}: {
  project: ProjectItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  if (!project) return null;

  return (
    <DeleteConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      itemType="Project"
      itemName={project.name}
      itemDescription={project.description}
      itemImage={project.image || ""}
      itemStatus={project.status}
    />
  );
}

