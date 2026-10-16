import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { WebsitesBanner } from "@/components/websites/WebsitesBanner";
import { WebsiteForm, type WebsiteFormData } from "@/components/websites/WebsiteForm";
import { UnsavedChangesModal } from "@/components/modals/UnsavedChangesModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { statusToPrisma, type WebsiteStatus } from "@/lib/websites-data";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { adminClient } from "@/lib/api/admin-client";

export const Route = createFileRoute("/admin/websites/create")({
  head: () => ({
    meta: [
      { title: "Create Website — CobraLearn Admin" },
      { name: "description", content: "Add a new showcase website to CobraLearn." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateWebsitePage,
});

function CreateWebsitePage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState<WebsiteFormData | null>(null);

  useAuthGuard();

  const handleSave = async (
    data: WebsiteFormData,
    status: WebsiteStatus,
    options: { navigateOnSuccess?: boolean } = { navigateOnSuccess: true }
  ): Promise<boolean> => {
    setIsSaving(true);
    const res = await adminClient.createAdminWebsite({
      name: data.name,
      url: data.url,
      description: data.description,
      fullDescription: data.fullDescription || null,
      category: data.category,
      status: statusToPrisma(status),
      featured: Boolean(data.featured),
      displayOrder: data.order || 0,
      launchDate: data.launchDate || null,
      teamSize: data.teamSize || null,
      technologies: data.technologies || [],
      tags: data.tags || [],
      githubUrl: data.githubUrl || null,
      videoUrl: data.videoUrl || null,
      thumbnailId: data.thumbnailId || null,
      galleryMediaIds: data.galleryMediaIds || [],
    });

    setIsSaving(false);

    if (res.success && res.data) {
      toast.success(
        status === "Published"
          ? `Website "${res.data.name}" published successfully!`
          : `Website "${res.data.name}" saved as Draft.`
      );
      markClean();
      if (options.navigateOnSuccess) {
        navigate({ to: "/admin/websites" });
      }
      return true;
    } else {
      toast.error(res.error || "Failed to create website");
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
        <AdminHeader onMenu={() => setMobileMenuOpen(true)} searchPlaceholder="Search websites..." />

        {/* Websites Banner */}
        <WebsitesBanner
          pageTitle="Create Website"
          subtitle="Register a new showcase website, deployment URL and technology profile."
          isActionPage={true}
          actionTitle="Create Website"
        />

        {/* Website Form */}
        <WebsiteForm
          isEdit={false}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={() => requestNavigation(() => navigate({ to: "/admin/websites" }))}
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
        onDiscard={onModalDiscard}
        onSave={onModalSave}
      />

      <Toaster />
    </div>
  );
}
