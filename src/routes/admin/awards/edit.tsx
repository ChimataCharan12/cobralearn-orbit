import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { AwardsBanner } from "@/components/awards/AwardsBanner";
import {
  AwardForm,
  type AwardFormData,
} from "@/components/awards/AwardForm";
import { AwardDeleteDialog } from "@/components/awards/AwardModals";
import { AwardsEmptyState } from "@/components/awards/AwardsEmptyState";
import { UnsavedChangesModal } from "@/components/modals/UnsavedChangesModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import {
  awardToItem,
  statusToPrisma,
  type AwardItem,
  type AwardStatus,
} from "@/lib/awards-data";
import { adminClient } from "@/lib/api/admin-client";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

interface EditSearch {
  id?: string | undefined;
  slug?: string | undefined;
}

export const Route = createFileRoute("/admin/awards/edit")({
  validateSearch: (search: Record<string, unknown>): EditSearch => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
    slug: typeof search["slug"] === "string" ? search["slug"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Edit Award — CobraLearn Admin" },
      {
        name: "description",
        content: "Update award details, certificate images and settings.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditAwardPage,
});

function EditAwardPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/admin/awards/edit" });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formData, setFormData] = useState<AwardFormData | null>(null);

  const [currentAward, setCurrentAward] = useState<AwardItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useAuthGuard();

  useEffect(() => {
    let isMounted = true;
    async function loadAward() {
      setIsLoading(true);
      const targetId = search.id || search.slug;
      if (targetId) {
        const res = await adminClient.getAdminAward(targetId);
        if (isMounted) {
          if (res.success && res.data) {
            setCurrentAward(awardToItem(res.data));
          } else {
            toast.error(res.error || `Unable to load award "${targetId}"`);
            setCurrentAward(null);
          }
          setIsLoading(false);
        }
      } else {
        const listRes = await adminClient.listAdminAwards();
        if (isMounted) {
          if (listRes.success && listRes.data && listRes.data.length > 0) {
            setCurrentAward(awardToItem(listRes.data[0]!));
          } else {
            setCurrentAward(null);
          }
          setIsLoading(false);
        }
      }
    }

    loadAward();

    return () => {
      isMounted = false;
    };
  }, [search.id, search.slug]);

  const handleSave = async (
    data: AwardFormData,
    status: AwardStatus,
    options: { navigateOnSuccess?: boolean } = { navigateOnSuccess: true }
  ): Promise<boolean> => {
    if (!currentAward) return false;

    setIsSaving(true);
    const res = await adminClient.updateAdminAward(currentAward.id, {
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
          ? `Award "${res.data.name}" updated and published successfully!`
          : `Award "${res.data.name}" updated as Draft.`
      );
      markClean();
      if (options.navigateOnSuccess) {
        navigate({ to: "/admin/awards" });
      } else {
        setCurrentAward(awardToItem(res.data));
      }
      return true;
    } else {
      toast.error(res.error || "Failed to update award");
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
    if (!currentAward) return;
    const res = await adminClient.deleteAdminAward(currentAward.id);
    if (res.success) {
      toast.success(`Award "${currentAward.name}" deleted successfully.`);
      markClean();
      setDeleteOpen(false);
      navigate({ to: "/admin/awards" });
    } else {
      toast.error(res.error || "Failed to delete award. CMS_DELETE permission required.");
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
          searchPlaceholder="Search awards..."
        />

        {/* Hero Banner */}
        <AwardsBanner
          pageTitle="Edit Award"
          subtitle="Update award details, certificate images and settings."
          isActionPage={true}
          actionTitle="Edit Award"
        />

        {/* Loading Spinner, Award Form or Empty State */}
        {isLoading ? (
          <div className="flex h-[400px] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-brand-bright" />
            <p className="text-[13.5px]">Loading award details from database...</p>
          </div>
        ) : currentAward ? (
          <AwardForm
            key={currentAward.id}
            award={currentAward}
            isEdit={true}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={() => requestNavigation(() => navigate({ to: "/admin/awards" }))}
            onDelete={handleDelete}
            onDirtyChange={(dirty, form) => {
              setIsDirty(dirty);
              setFormData(form);
            }}
          />
        ) : (
          <AwardsEmptyState onAddAward={() => navigate({ to: "/admin/awards/create" })} />
        )}
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

      {/* Delete Dialog */}
      {currentAward && (
        <AwardDeleteDialog
          award={currentAward}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirm={confirmDelete}
        />
      )}

      <Toaster />
    </div>
  );
}
