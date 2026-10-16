import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { AdvertisementsBanner } from "@/components/advertisements/AdvertisementsBanner";
import {
  AdvertisementForm,
  type AdvertisementFormData,
} from "@/components/advertisements/AdvertisementForm";
import { UnsavedChangesModal } from "@/components/modals/UnsavedChangesModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { statusToPrisma, type AdStatus } from "@/lib/advertisements-data";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { adminClient } from "@/lib/api/admin-client";

export const Route = createFileRoute("/admin/advertisements/create")({
  head: () => ({
    meta: [
      { title: "Create Advertisement — CobraLearn Admin" },
      {
        name: "description",
        content: "Add a new advertisement campaign to showcase on your platform.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateAdvertisementPage,
});

function CreateAdvertisementPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState<AdvertisementFormData | null>(null);

  useAuthGuard();

  const handleSave = async (
    data: AdvertisementFormData,
    status: AdStatus,
    options: { navigateOnSuccess?: boolean } = { navigateOnSuccess: true }
  ): Promise<boolean> => {
    setIsSaving(true);
    const res = await adminClient.createAdminAdvertisement({
      name: data.name,
      campaign: data.campaign,
      brand: data.brand,
      description: data.description,
      fullDescription: data.fullDescription || null,
      campaignType: data.campaignType || null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      campaignUrl: data.campaignUrl || null,
      status: statusToPrisma(status),
      featured: false,
      showOnHomepage: Boolean(data.showOnHomepage),
      displayOrder: data.order || 1,
      thumbnailId: data.thumbnailId || null,
      galleryMediaIds: data.galleryMediaIds || [],
      date: data.startDate || "Oct 2026",
    });

    setIsSaving(false);

    if (res.success && res.data) {
      toast.success(
        status === "Published"
          ? `Advertisement "${res.data.name}" published successfully!`
          : `Advertisement "${res.data.name}" saved as Draft.`
      );
      markClean();
      if (options.navigateOnSuccess) {
        navigate({ to: "/admin/advertisements" });
      }
      return true;
    } else {
      toast.error(res.error || "Failed to create advertisement");
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
          searchPlaceholder="Search advertisements..."
        />

        {/* Hero Banner */}
        <AdvertisementsBanner
          pageTitle="Create Advertisement"
          subtitle="Add a new advertisement campaign to showcase on your platform."
          isActionPage={true}
          actionTitle="Create Advertisement"
        />

        {/* Advertisement Form */}
        <AdvertisementForm
          isEdit={false}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={() => requestNavigation(() => navigate({ to: "/admin/advertisements" }))}
          onDirtyChange={(dirty, currentForm) => {
            setIsDirty(dirty);
            setFormData(currentForm);
          }}
        />
      </main>

      <UnsavedChangesModal
        open={showModal}
        onOpenChange={(open) => {
          if (!open) onModalCancel();
        }}
        onDiscard={onModalDiscard}
        onSave={onModalSave}
        onCancel={onModalCancel}
      />

      <Toaster />
    </div>
  );
}
