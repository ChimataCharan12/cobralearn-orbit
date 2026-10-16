import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { AwardsBanner } from "@/components/awards/AwardsBanner";
import {
  AwardForm,
  type AwardFormData,
} from "@/components/awards/AwardForm";
import { UnsavedChangesModal } from "@/components/modals/UnsavedChangesModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { statusToPrisma, type AwardStatus } from "@/lib/awards-data";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { adminClient } from "@/lib/api/admin-client";

export const Route = createFileRoute("/admin/awards/create")({
  head: () => ({
    meta: [
      { title: "Create Award — CobraLearn Admin" },
      {
        name: "description",
        content: "Add a new award or achievement to showcase on your platform.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateAwardPage,
});

function CreateAwardPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState<AwardFormData | null>(null);

  useAuthGuard();

  const handleSave = async (
    data: AwardFormData,
    status: AwardStatus,
    options: { navigateOnSuccess?: boolean } = { navigateOnSuccess: true }
  ): Promise<boolean> => {
    setIsSaving(true);
    const res = await adminClient.createAdminAward({
      name: data.name,
      context: data.context,
      organization: data.organization,
      category: data.category,
      description: data.description,
      fullDescription: data.fullDescription || null,
      credentialUrl: data.credentialUrl || null,
      status: statusToPrisma(status),
      showOnHomepage: Boolean(data.showOnHomepage),
      displayOrder: data.order || 1,
      thumbnailId: data.thumbnailId || null,
      galleryMediaIds: data.galleryMediaIds || [],
      date: data.date || "Oct 2026",
    });

    setIsSaving(false);

    if (res.success && res.data) {
      toast.success(
        status === "Published"
          ? `Award "${res.data.name}" published successfully!`
          : `Award "${res.data.name}" saved as Draft.`
      );
      markClean();
      if (options.navigateOnSuccess) {
        navigate({ to: "/admin/awards" });
      }
      return true;
    } else {
      toast.error(res.error || "Failed to create award");
      return false;
    }
  };

  const {
    isDirty,
    setIsDirty,
    isSaving,
    setIsSaving,
    showModal,
    markClean,
    onModalCancel,
    onModalDiscard,
    onModalSave,
    requestNavigation,
  } = useUnsavedChanges({
    onSave: async () => {
      if (formData) {
        return handleSave(formData, "Published", { navigateOnSuccess: false });
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
        <AdminHeader
          onMenu={() => setMobileMenuOpen(true)}
          searchPlaceholder="Search awards..."
        />

        {/* Hero Banner */}
        <AwardsBanner
          pageTitle="Create Award"
          subtitle="Add a new award, recognition or achievement to showcase on your platform."
          isActionPage={true}
          actionTitle="Create Award"
        />

        {/* Award Form */}
        <AwardForm
          isEdit={false}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={() => requestNavigation(() => navigate({ to: "/admin/awards" }))}
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
