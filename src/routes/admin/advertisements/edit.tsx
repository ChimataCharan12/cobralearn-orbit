import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { AdvertisementsBanner } from "@/components/advertisements/AdvertisementsBanner";
import {
  AdvertisementForm,
  type AdvertisementFormData,
} from "@/components/advertisements/AdvertisementForm";
import { AdvertisementDeleteDialog } from "@/components/advertisements/AdvertisementModals";
import { AdvertisementsEmptyState } from "@/components/advertisements/AdvertisementsEmptyState";
import { UnsavedChangesModal } from "@/components/modals/UnsavedChangesModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import {
  advertisementToItem,
  statusToPrisma,
  type AdvertisementItem,
  type AdStatus,
} from "@/lib/advertisements-data";
import { adminClient } from "@/lib/api/admin-client";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

interface EditSearch {
  id?: string | undefined;
  slug?: string | undefined;
}

export const Route = createFileRoute("/admin/advertisements/edit")({
  validateSearch: (search: Record<string, unknown>): EditSearch => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
    slug: typeof search["slug"] === "string" ? search["slug"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Edit Advertisement — CobraLearn Admin" },
      {
        name: "description",
        content: "Update advertisement details, images and settings.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditAdvertisementPage,
});

function EditAdvertisementPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/admin/advertisements/edit" });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formData, setFormData] = useState<AdvertisementFormData | null>(null);

  const [currentAd, setCurrentAd] = useState<AdvertisementItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useAuthGuard();

  useEffect(() => {
    let isMounted = true;
    async function loadAdvertisement() {
      setIsLoading(true);
      const targetId = search.id || search.slug;
      if (targetId) {
        const res = await adminClient.getAdminAdvertisement(targetId);
        if (isMounted) {
          if (res.success && res.data) {
            setCurrentAd(advertisementToItem(res.data));
          } else {
            toast.error(res.error || `Unable to load advertisement "${targetId}"`);
            setCurrentAd(null);
          }
          setIsLoading(false);
        }
      } else {
        const listRes = await adminClient.listAdminAdvertisements();
        if (isMounted) {
          if (listRes.success && listRes.data && listRes.data.length > 0) {
            setCurrentAd(advertisementToItem(listRes.data[0]!));
          } else {
            setCurrentAd(null);
          }
          setIsLoading(false);
        }
      }
    }

    loadAdvertisement();

    return () => {
      isMounted = false;
    };
  }, [search.id, search.slug]);

  const handleSave = async (
    data: AdvertisementFormData,
    status: AdStatus,
    options: { navigateOnSuccess?: boolean } = { navigateOnSuccess: true }
  ): Promise<boolean> => {
    if (!currentAd) return false;

    setIsSaving(true);
    const res = await adminClient.updateAdminAdvertisement(currentAd.id, {
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
      date: data.startDate || currentAd.date,
    });

    setIsSaving(false);

    if (res.success && res.data) {
      setCurrentAd(advertisementToItem(res.data));
      toast.success(`Advertisement "${res.data.name}" updated successfully!`);
      markClean();
      if (options.navigateOnSuccess) {
        navigate({ to: "/admin/advertisements" });
      }
      return true;
    } else {
      toast.error(res.error || "Failed to update advertisement");
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

  const handleDelete = () => {
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!currentAd) return;
    const res = await adminClient.deleteAdminAdvertisement(currentAd.id);
    if (res.success) {
      toast.success(`Advertisement "${currentAd.name}" deleted.`);
      setDeleteOpen(false);
      markClean();
      navigate({ to: "/admin/advertisements" });
    } else {
      toast.error(res.error || "Failed to delete advertisement");
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
        <AdminHeader
          onMenu={() => setMobileMenuOpen(true)}
          searchPlaceholder="Search advertisements..."
        />

        {/* Hero Banner */}
        <AdvertisementsBanner
          pageTitle="Edit Advertisement"
          subtitle="Update advertisement details, images and settings."
          isActionPage={true}
          actionTitle="Edit Advertisement"
        />

        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <Loader2 className="size-8 animate-spin text-brand-bright" />
            <p className="text-[13px] text-muted-foreground">Loading advertisement details...</p>
          </div>
        ) : currentAd ? (
          /* Advertisement Form */
          <AdvertisementForm
            key={currentAd.id}
            ad={currentAd}
            isEdit={true}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={() => requestNavigation(() => navigate({ to: "/admin/advertisements" }))}
            onDelete={handleDelete}
            onDirtyChange={(dirty, currentForm) => {
              setIsDirty(dirty);
              setFormData(currentForm);
            }}
          />
        ) : (
          <div className="py-12">
            <AdvertisementsEmptyState onAddAd={() => navigate({ to: "/admin/advertisements/create" })} />
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <AdvertisementDeleteDialog
        ad={currentAd}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
      />

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
