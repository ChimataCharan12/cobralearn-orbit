import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { ProjectForm, type ProjectFormData } from "@/components/projects/ProjectForm";
import { UnsavedChangesModal } from "@/components/modals/UnsavedChangesModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { statusToPrisma, type ProjectStatus } from "@/lib/projects-data";
import { ProjectsBanner } from "@/components/projects/ProjectsBanner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { adminClient } from "@/lib/api/admin-client";

export const Route = createFileRoute("/admin/projects/create")({
  head: () => ({
    meta: [
      { title: "Create Project — CobraLearn Admin" },
      { name: "description", content: "Add a new project to the CobraLearn showcase." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateProjectPage,
});

function CreateProjectPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData | null>(null);

  useAuthGuard();

  const handleSave = async (
    data: ProjectFormData,
    status: ProjectStatus,
    options: { navigateOnSuccess?: boolean } = { navigateOnSuccess: true }
  ): Promise<boolean> => {
    setIsSaving(true);
    const res = await adminClient.createAdminProject({
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
      thumbnailId: data.thumbnailId || null,
      galleryMediaIds: data.galleryMediaIds || [],
    });

    setIsSaving(false);

    if (res.success && res.data) {
      toast.success(
        status === "Published"
          ? `Project "${res.data.name}" published successfully!`
          : `Project "${res.data.name}" saved as Draft.`
      );
      markClean();
      if (options.navigateOnSuccess) {
        navigate({ to: "/admin/projects" });
      }
      return true;
    } else {
      toast.error(res.error || "Failed to create project");
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
        return await handleSave(formData, formData.status || "Draft", { navigateOnSuccess: false });
      }
      return false;
    },
  });

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

        {/* Projects Banner */}
        <ProjectsBanner
          pageTitle="Create Project"
          subtitle="Add a new project to showcase on your website."
          isActionPage={true}
          actionTitle="Create Project"
        />

        {/* Form */}
        <ProjectForm
          isEdit={false}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={() => requestNavigation(() => navigate({ to: "/admin/projects" }))}
          onDirtyChange={(dirty, form) => {
            setIsDirty(dirty);
            setFormData(form);
          }}
        />
      </main>

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        open={showModal}
        onOpenChange={(open) => {
          if (!open) onModalCancel();
        }}
        onSave={onModalSave}
        onDiscard={onModalDiscard}
        onCancel={onModalCancel}
      />

      <Toaster />
    </div>
  );
}
