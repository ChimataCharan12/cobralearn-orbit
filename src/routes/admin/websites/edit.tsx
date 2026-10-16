import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Eye, Trash2, Loader2 } from "lucide-react";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { WebsitesBanner } from "@/components/websites/WebsitesBanner";
import { WebsiteForm, type WebsiteFormData } from "@/components/websites/WebsiteForm";
import { WebsiteDeleteDialog, WebsiteViewModal } from "@/components/websites/WebsiteModals";
import { WebsitesEmptyState } from "@/components/websites/WebsitesEmptyState";
import { UnsavedChangesModal } from "@/components/modals/UnsavedChangesModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { websiteToItem, statusToPrisma, type WebsiteItem, type WebsiteStatus } from "@/lib/websites-data";
import { adminClient } from "@/lib/api/admin-client";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

interface EditSearch {
  id?: string | undefined;
  slug?: string | undefined;
}

export function isSafeHttpUrl(urlString?: string | null): boolean {
  if (!urlString || !urlString.trim()) return false;
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/admin/websites/edit")({
  validateSearch: (search: Record<string, unknown>): EditSearch => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
    slug: typeof search["slug"] === "string" ? search["slug"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Edit Website — CobraLearn Admin" },
      { name: "description", content: "Update website showcase details and settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditWebsitePage,
});

function EditWebsitePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/admin/websites/edit" });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [formData, setFormData] = useState<WebsiteFormData | null>(null);

  const [currentWebsite, setCurrentWebsite] = useState<WebsiteItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useAuthGuard();

  useEffect(() => {
    let isMounted = true;
    async function loadWebsite() {
      setIsLoading(true);
      const targetId = search.id || search.slug;
      if (targetId) {
        const res = await adminClient.getAdminWebsite(targetId);
        if (isMounted) {
          if (res.success && res.data) {
            setCurrentWebsite(websiteToItem(res.data));
          } else {
            toast.error(res.error || `Unable to load website "${targetId}"`);
            setCurrentWebsite(null);
          }
          setIsLoading(false);
        }
      } else {
        // Fallback: load the first website from list if no ID was provided
        const listRes = await adminClient.listAdminWebsites();
        if (isMounted) {
          if (listRes.success && listRes.data && listRes.data.length > 0) {
            setCurrentWebsite(websiteToItem(listRes.data[0]!));
          } else {
            setCurrentWebsite(null);
          }
          setIsLoading(false);
        }
      }
    }

    loadWebsite();

    return () => {
      isMounted = false;
    };
  }, [search.id, search.slug]);

  const handleSave = async (
    data: WebsiteFormData,
    status: WebsiteStatus,
    options: { navigateOnSuccess?: boolean } = { navigateOnSuccess: true }
  ): Promise<boolean> => {
    if (!currentWebsite) return false;

    setIsSaving(true);
    const res = await adminClient.updateAdminWebsite(currentWebsite.id, {
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
      setCurrentWebsite(websiteToItem(res.data));
      toast.success(`Website "${res.data.name}" updated successfully!`);
      markClean();
      if (options.navigateOnSuccess) {
        navigate({ to: "/admin/websites" });
      }
      return true;
    } else {
      toast.error(res.error || "Failed to update website");
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

  const handleDelete = () => {
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!currentWebsite) return;
    const res = await adminClient.deleteAdminWebsite(currentWebsite.id);
    if (res.success) {
      toast.success(`Website "${currentWebsite.name}" deleted successfully.`);
      setDeleteOpen(false);
      navigate({ to: "/admin/websites" });
    } else {
      toast.error(res.error || "Failed to delete website. CMS_DELETE permission required.");
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
        <AdminHeader onMenu={() => setMobileMenuOpen(true)} searchPlaceholder="Search websites..." />

        {/* Loading State */}
        {isLoading ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
            <Loader2 className="size-8 animate-spin text-brand-bright" />
            <p className="text-[13px] font-medium text-muted-foreground">Loading website data...</p>
          </div>
        ) : !currentWebsite ? (
          /* Empty / Not Found State */
          <div className="space-y-4">
            <WebsitesBanner
              pageTitle="Edit Website"
              subtitle="Update live endpoints, cover screenshot, technical stack and showcase status."
              isActionPage={true}
              actionTitle="Edit Website"
            />
            <WebsitesEmptyState onAddWebsite={() => navigate({ to: "/admin/websites/create" })} />
          </div>
        ) : (
          /* Populated Edit View */
          <>
            {/* Edit Website Banner */}
            <WebsitesBanner
              pageTitle={`Edit Website: ${currentWebsite.name}`}
              subtitle="Update live endpoints, cover screenshot, technical stack and showcase status."
              isActionPage={true}
              actionTitle="Edit Website"
              actionButtons={
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-brand/35 bg-panel/80 px-3 py-1.5 text-[12.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground cursor-pointer"
                  >
                    <Eye className="size-3.5 text-brand-bright" />
                    <span>Quick Preview</span>
                  </button>

                  {currentWebsite.status === "Published" && Boolean(currentWebsite.slug?.trim()) ? (
                    <a
                      href={`/websites/${encodeURIComponent(currentWebsite.slug.trim())}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-brand/35 bg-panel/80 px-3 py-1.5 text-[12.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground cursor-pointer"
                      title="View public showcase detail page"
                    >
                      <ExternalLink className="size-3.5 text-brand-cyan" />
                      <span>View on Website</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="flex items-center gap-1.5 rounded-lg border border-brand/15 bg-panel/40 px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground/50 cursor-not-allowed opacity-60"
                      title={!currentWebsite.slug?.trim() ? "Website slug not set" : "Only published websites are visible on the public showcase"}
                    >
                      <ExternalLink className="size-3.5 text-muted-foreground/50" />
                      <span>View on Website</span>
                    </button>
                  )}

                  {isSafeHttpUrl(currentWebsite.url) && (
                    <a
                      href={currentWebsite.url!.trim()}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-brand/35 bg-panel/80 px-3 py-1.5 text-[12.5px] font-semibold text-foreground/85 transition hover:border-brand-bright hover:text-foreground cursor-pointer"
                    >
                      <ExternalLink className="size-3.5 text-brand-bright" />
                      <span>Live Site</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-950/25 px-3 py-1.5 text-[12.5px] font-semibold text-red-400 transition hover:border-red-500/60 hover:bg-red-950/45 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              }
            />

            {/* Website Form */}
            <WebsiteForm
              key={currentWebsite.id}
              website={currentWebsite}
              isEdit={true}
              isSaving={isSaving}
              onSave={handleSave}
              onCancel={() => requestNavigation(() => navigate({ to: "/admin/websites" }))}
              onDelete={handleDelete}
              onViewLive={() => {
                if (currentWebsite.url) window.open(currentWebsite.url, "_blank");
              }}
              onPreview={() => setPreviewOpen(true)}
              onDirtyChange={(dirty, form) => {
                setIsDirty(dirty);
                setFormData(form);
              }}
            />
          </>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <WebsiteDeleteDialog
        website={currentWebsite}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
      />

      {/* View/Preview Modal */}
      <WebsiteViewModal
        website={currentWebsite}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

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
