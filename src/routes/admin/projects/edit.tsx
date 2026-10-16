import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Eye, Trash2, Loader2 } from "lucide-react";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { ProjectsBanner } from "@/components/projects/ProjectsBanner";
import { ProjectForm, type ProjectFormData } from "@/components/projects/ProjectForm";
import { ProjectDeleteDialog, ProjectViewModal } from "@/components/projects/ProjectModals";
import { ProjectsEmptyState } from "@/components/projects/ProjectsEmptyState";
import { UnsavedChangesModal } from "@/components/modals/UnsavedChangesModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { projectToItem, statusToPrisma, type ProjectItem, type ProjectStatus } from "@/lib/projects-data";
import { adminClient } from "@/lib/api/admin-client";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

interface EditSearch {
  id?: string | undefined;
  slug?: string | undefined;
}

export const Route = createFileRoute("/admin/projects/edit")({
  validateSearch: (search: Record<string, unknown>): EditSearch => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
    slug: typeof search["slug"] === "string" ? search["slug"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Edit Project — CobraLearn Admin" },
      { name: "description", content: "Update project details and settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditProjectPage,
});

function EditProjectPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/admin/projects/edit" });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData | null>(null);

  const [currentProject, setCurrentProject] = useState<ProjectItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useAuthGuard();

  useEffect(() => {
    let isMounted = true;
    async function loadProject() {
      setIsLoading(true);
      const targetId = search.id || search.slug;
      if (targetId) {
        const res = await adminClient.getAdminProject(targetId);
        if (isMounted) {
          if (res.success && res.data) {
            setCurrentProject(projectToItem(res.data));
          } else {
            setCurrentProject(null);
          }
        }
      } else {
        if (isMounted) {
          setCurrentProject(null);
        }
      }
      if (isMounted) setIsLoading(false);
    }

    loadProject();
    return () => {
      isMounted = false;
    };
  }, [search.id, search.slug]);

  const handleSave = async (
    data: ProjectFormData,
    status: ProjectStatus,
    options: { navigateOnSuccess?: boolean } = { navigateOnSuccess: true }
  ): Promise<boolean> => {
    if (!currentProject) return false;

    setIsSaving(true);
    const res = await adminClient.updateAdminProject(currentProject.id, {
      name: data.name,
      description: data.description,
      fullDescription: data.fullDescription || null,
      category: data.category,
      status: statusToPrisma(status),
      featured: Boolean(data.featured),
      displayOrder: data.order || 0,
      projectDuration: data.projectDuration || null,
      teamSize: data.teamSize || null,
      technologies: data.technologies || [],
      tags: data.tags || [],
      liveUrl: data.liveUrl || null,
      githubUrl: data.githubUrl || null,
      videoUrl: data.videoUrl || null,
      thumbnailId: data.thumbnailId !== undefined ? data.thumbnailId : null,
      galleryMediaIds: data.galleryMediaIds !== undefined ? data.galleryMediaIds : [],
    });

    setIsSaving(false);

    if (res.success && res.data) {
      toast.success(
        status === "Published"
          ? `Project "${res.data.name}" updated successfully!`
          : `Project "${res.data.name}" saved as Draft.`
      );
      markClean();
      if (options.navigateOnSuccess) {
        navigate({ to: "/admin/projects" });
      }
      return true;
    } else {
      toast.error(res.error || "Failed to update project");
      return false;
    }
  };

  const {
    setIsDirty,
    markClean,
    isSaving,
    setIsSaving,
    showModal,
    onModalCancel,
    onModalDiscard,
    onModalSave,
    requestNavigation,
  } = useUnsavedChanges({
    onSave: async () => {
      if (formData) {
        return await handleSave(
          formData,
          formData.status || currentProject?.status || "Draft",
          { navigateOnSuccess: false }
        );
      }
      return false;
    },
  });

  const handleDelete = () => {
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!currentProject) return;
    const res = await adminClient.deleteAdminProject(currentProject.id);
    if (res.success) {
      toast.success(`Project "${currentProject.name}" deleted.`);
      setDeleteOpen(false);
      navigate({ to: "/admin/projects" });
    } else {
      toast.error(res.error || "Failed to delete project. CMS_DELETE permission required.");
    }
  };

  return (
    <div className="dash-bg flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <div data-sidebar-wrapper className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <AdminSidebar />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[268px] border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AdminSidebar onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-6">
        {/* Header */}
        <AdminHeader onMenu={() => setMobileMenuOpen(true)} searchPlaceholder="Search projects..." />

        {/* Edit Project Banner */}
        <ProjectsBanner
          pageTitle="Edit Project"
          subtitle="Update the details, media and settings for your project."
          isActionPage={true}
          actionTitle="Edit Project"
          actionButtons={
            currentProject ? (
              <>
                {currentProject.liveUrl ? (
                  <a
                    href={currentProject.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-brand/15 px-3 py-1.5 text-[12px] font-semibold text-brand-bright shadow-[0_0_12px_color-mix(in_oklab,var(--brand-bright)_25%,transparent)] transition hover:bg-brand/25 hover:shadow-[0_0_18px_color-mix(in_oklab,var(--brand-bright)_40%,transparent)]"
                  >
                    <ExternalLink className="size-3.5" />
                    View on Website
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-brand/35 bg-panel px-3 py-1.5 text-[12px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground cursor-pointer"
                >
                  <Eye className="size-3.5" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-950/20 px-3 py-1.5 text-[12px] font-semibold text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)] transition hover:bg-red-900/30 hover:border-red-400 hover:text-red-300 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  Delete Project
                </button>
              </>
            ) : null
          }
        />

        {/* Project Form or Empty / Loading State */}
        {isLoading ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-brand/20 bg-panel/85 p-8">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-brand-bright" />
              <span>Loading project details from database...</span>
            </div>
          </div>
        ) : currentProject ? (
          <ProjectForm
            project={currentProject}
            isEdit={true}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={() => requestNavigation(() => navigate({ to: "/admin/projects" }))}
            onDelete={handleDelete}
            onViewOnWebsite={() => currentProject.liveUrl && window.open(currentProject.liveUrl, "_blank")}
            onPreview={() => setPreviewOpen(true)}
            onDirtyChange={(dirty, form) => {
              setIsDirty(dirty);
              setFormData(form);
            }}
          />
        ) : (
          <ProjectsEmptyState onAddProject={() => navigate({ to: "/admin/projects/create" })} />
        )}
      </main>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesModal
        open={showModal}
        onOpenChange={(open) => {
          if (!open) onModalCancel();
        }}
        onSave={onModalSave}
        onDiscard={onModalDiscard}
        onCancel={onModalCancel}
      />

      {/* Delete Dialog */}
      {currentProject && (
        <ProjectDeleteDialog
          project={currentProject}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirm={confirmDelete}
        />
      )}

      {/* Preview Modal */}
      {currentProject && (
        <ProjectViewModal
          project={currentProject}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}

      <Toaster />
    </div>
  );
}
