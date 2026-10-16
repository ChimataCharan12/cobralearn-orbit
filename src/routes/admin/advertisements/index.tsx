import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { AdvertisementsBanner } from "@/components/advertisements/AdvertisementsBanner";
import { AdvertisementStats } from "@/components/advertisements/AdvertisementStats";
import { AdvertisementToolbar } from "@/components/advertisements/AdvertisementToolbar";
import { AdvertisementTable } from "@/components/advertisements/AdvertisementTable";
import { AdvertisementGrid } from "@/components/advertisements/AdvertisementGrid";
import { AdvertisementsLoadingState } from "@/components/advertisements/AdvertisementsLoadingState";
import { AdvertisementsEmptyState } from "@/components/advertisements/AdvertisementsEmptyState";
import { AdvertisementsErrorState } from "@/components/advertisements/AdvertisementsErrorState";
import {
  AdvertisementDeleteDialog,
  AdvertisementViewModal,
} from "@/components/advertisements/AdvertisementModals";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import {
  type AdvertisementItem,
  type AdStatus,
} from "@/lib/advertisements-data";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { useAdvertisements } from "@/lib/advertisements/use-advertisements";
import { adminClient } from "@/lib/api/admin-client";

export const Route = createFileRoute("/admin/advertisements/")({
  head: () => ({
    meta: [
      { title: "Advertisements — CobraLearn Admin" },
      {
        name: "description",
        content: "Manage and showcase advertisement campaigns on your platform.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdvertisementsPage,
});

function AdvertisementsPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useAuthGuard();

  const {
    advertisements: rawAds,
    isLoading: isQueryLoading,
    error: queryError,
    refetch,
    deleteAdvertisement,
    reorderAdvertisements,
  } = useAdvertisements();

  const [simulatedState, setSimulatedState] = useState<"loading" | "empty" | "error" | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [campaignFilter, setCampaignFilter] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [viewModalAd, setViewModalAd] = useState<AdvertisementItem | null>(null);
  const [deleteDialogAd, setDeleteDialogAd] = useState<AdvertisementItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Support explicit state preview in testing URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const stateParam = params.get("state");
      if (stateParam === "loading" || stateParam === "empty" || stateParam === "error") {
        setSimulatedState(stateParam);
      }
    }
  }, []);

  const adsList = useMemo(() => {
    if (simulatedState === "empty") return [];
    return rawAds;
  }, [simulatedState, rawAds]);

  const isLoading = simulatedState === "loading" || isQueryLoading;
  const error = simulatedState === "error" ? "Simulated network connection failed." : queryError;

  // Available campaigns list
  const availableCampaigns = useMemo(() => {
    const set = new Set<string>();
    adsList.forEach((a) => {
      if (a.campaign) set.add(a.campaign);
    });
    return Array.from(set).sort();
  }, [adsList]);

  // Statistics calculation
  const totalCount = adsList.length;
  const publishedCount = adsList.filter((a) => a.status === "Published").length;
  const draftCount = adsList.filter((a) => a.status === "Draft").length;
  const archivedCount = adsList.filter((a) => a.status === "Archived").length;

  // Filtered advertisements
  const filteredAds = useMemo(() => {
    let result = [...adsList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.campaign.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (a.brand && a.brand.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "ALL") {
      result = result.filter((a) => a.status === statusFilter);
    }

    if (campaignFilter !== "ALL") {
      result = result.filter((a) => a.campaign === campaignFilter);
    }

    result.sort((a, b) => a.order - b.order);
    return result;
  }, [adsList, searchQuery, statusFilter, campaignFilter]);

  // Paginated advertisements
  const totalPages = Math.ceil(filteredAds.length / pageSize) || 1;
  const paginatedAds = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAds.slice(start, start + pageSize);
  }, [filteredAds, currentPage, pageSize]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, campaignFilter]);

  // Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const ids = paginatedAds.map((a) => a.id);
    const allSelected = ids.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  // Reordering boundaries
  const [isReordering, setIsReordering] = useState(false);

  const isReorderingEnabled = useMemo(() => {
    return (
      !searchQuery.trim() &&
      statusFilter === "ALL" &&
      campaignFilter === "ALL"
    );
  }, [searchQuery, statusFilter, campaignFilter]);

  const canMoveUp = useCallback(
    (id: string) => {
      if (!isReorderingEnabled || isReordering) return false;
      const index = adsList.findIndex((a) => a.id === id);
      return index > 0;
    },
    [isReorderingEnabled, isReordering, adsList]
  );

  const canMoveDown = useCallback(
    (id: string) => {
      if (!isReorderingEnabled || isReordering) return false;
      const index = adsList.findIndex((a) => a.id === id);
      return index >= 0 && index < adsList.length - 1;
    },
    [isReorderingEnabled, isReordering, adsList]
  );

  const getMoveUpTitle = useCallback(
    (id: string) => {
      if (!isReorderingEnabled) {
        return "Reordering is disabled while search or filters are active. Clear filters to reorder.";
      }
      if (isReordering) {
        return "Updating advertisement order...";
      }
      const index = adsList.findIndex((a) => a.id === id);
      if (index <= 0) {
        return "Already first in display order";
      }
      return "Move up";
    },
    [isReorderingEnabled, isReordering, adsList]
  );

  const getMoveDownTitle = useCallback(
    (id: string) => {
      if (!isReorderingEnabled) {
        return "Reordering is disabled while search or filters are active. Clear filters to reorder.";
      }
      if (isReordering) {
        return "Updating advertisement order...";
      }
      const index = adsList.findIndex((a) => a.id === id);
      if (index >= adsList.length - 1) {
        return "Already last in display order";
      }
      return "Move down";
    },
    [isReorderingEnabled, isReordering, adsList]
  );

  const handleMoveUp = async (id: string) => {
    if (!isReorderingEnabled || isReordering) return;
    const index = adsList.findIndex((a) => a.id === id);
    if (index <= 0) return;

    setIsReordering(true);
    try {
      const reordered = [...adsList];
      const item = reordered.splice(index, 1)[0];
      if (item) {
        reordered.splice(index - 1, 0, item);
        const orderedIds = reordered.map((a) => a.id);
        await reorderAdvertisements(orderedIds);
      }
    } finally {
      setIsReordering(false);
    }
  };

  const handleMoveDown = async (id: string) => {
    if (!isReorderingEnabled || isReordering) return;
    const index = adsList.findIndex((a) => a.id === id);
    if (index < 0 || index >= adsList.length - 1) return;

    setIsReordering(true);
    try {
      const reordered = [...adsList];
      const item = reordered.splice(index, 1)[0];
      if (item) {
        reordered.splice(index + 1, 0, item);
        const orderedIds = reordered.map((a) => a.id);
        await reorderAdvertisements(orderedIds);
      }
    } finally {
      setIsReordering(false);
    }
  };

  const handleDuplicate = async (ad: AdvertisementItem) => {
    const copyName = `${ad.name} (Copy)`;
    const copySlug = `${ad.slug}-copy-${Date.now().toString(36)}`;
    const res = await adminClient.createAdminAdvertisement({
      slug: copySlug,
      name: copyName,
      campaign: ad.campaign,
      brand: ad.brand,
      campaignType: ad.campaignType || null,
      description: ad.description,
      fullDescription: ad.fullDescription || null,
      startDate: ad.startDate || null,
      endDate: ad.endDate || null,
      date: ad.date,
      campaignUrl: ad.campaignUrl || null,
      status: "DRAFT",
      featured: false,
      showOnHomepage: false,
      displayOrder: adsList.length + 1,
      thumbnailId: ad.thumbnailId || null,
    });
    if (res.success) {
      toast.success(`Duplicated "${ad.name}" as Draft.`);
      await refetch();
    } else {
      toast.error(res.error || "Failed to duplicate advertisement");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialogAd) return;
    const ok = await deleteAdvertisement(deleteDialogAd.id);
    if (ok) {
      setSelectedIds((prev) => prev.filter((id) => id !== deleteDialogAd.id));
      setDeleteDialogAd(null);
    }
  };

  const handleConfirmBulkDelete = async () => {
    let deletedCount = 0;
    for (const id of selectedIds) {
      const res = await adminClient.deleteAdminAdvertisement(id);
      if (res.success) {
        deletedCount++;
      }
    }
    toast.success(`Deleted ${deletedCount} advertisements.`);
    setSelectedIds([]);
    setBulkDeleteOpen(false);
    await refetch();
  };

  const handleBulkAction = async (action: "publish" | "draft" | "delete") => {
    if (action === "publish" || action === "draft") {
      const targetStatus = action === "publish" ? "PUBLISHED" : "DRAFT";
      let updatedCount = 0;
      for (const id of selectedIds) {
        const res = await adminClient.updateAdminAdvertisement(id, { status: targetStatus });
        if (res.success) {
          updatedCount++;
        }
      }
      toast.success(`Updated ${updatedCount} advertisement(s).`);
      await refetch();
    } else if (action === "delete") {
      if (selectedIds.length > 0) {
        setBulkDeleteOpen(true);
      }
    }
  };

  const handleRefresh = async () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setCampaignFilter("ALL");
    setTagFilter("ALL");
    setSelectedIds([]);
    setSimulatedState(null);
    await refetch();
    toast.info("Advertisement list refreshed.");
  };

  const handleRetry = async () => {
    setSimulatedState(null);
    await refetch();
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

      {/* Main Content */}
      <main className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-6">
        <AdminHeader
          onMenu={() => setMobileMenuOpen(true)}
          searchPlaceholder="Search advertisements, campaigns, or keywords..."
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Dynamic Advertisement States */}
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 py-1">
              <div>
                <h1 className="font-sans text-[24px] sm:text-[28px] font-bold text-white tracking-tight">
                  Advertisements
                </h1>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#94a3b8]">
                  Manage and showcase advertisement campaigns on your platform.
                </p>
              </div>
            </div>
            <AdvertisementsLoadingState />
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 py-1">
              <div>
                <h1 className="font-sans text-[24px] sm:text-[28px] font-bold text-white tracking-tight">
                  Advertisements
                </h1>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#94a3b8]">
                  Manage and showcase advertisement campaigns on your platform.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/admin/advertisements/create" })}
                className="flex items-center gap-1.5 rounded-[9px] border border-[#00ff87]/50 bg-[#00ff87]/15 px-3.5 py-2 text-[12.5px] font-semibold text-[#00ff87] shadow-[0_0_14px_rgba(0,255,135,0.25)] hover:bg-[#00ff87]/25 hover:shadow-[0_0_20px_rgba(0,255,135,0.4)] transition-all cursor-pointer"
              >
                <Plus className="size-3.5 stroke-[3]" />
                <span>Add Advertisement</span>
              </button>
            </div>
            <AdvertisementsErrorState
              onRetry={handleRetry}
              onGoBack={() => navigate({ to: "/admin/dashboard" })}
            />
          </div>
        ) : adsList.length === 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 py-1">
              <div>
                <h1 className="font-sans text-[24px] sm:text-[28px] font-bold text-white tracking-tight">
                  Advertisements
                </h1>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#94a3b8]">
                  Manage and showcase advertisement campaigns on your platform.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/admin/advertisements/create" })}
                className="flex items-center gap-1.5 rounded-[9px] border border-[#00ff87]/50 bg-[#00ff87]/15 px-3.5 py-2 text-[12.5px] font-semibold text-[#00ff87] shadow-[0_0_14px_rgba(0,255,135,0.25)] hover:bg-[#00ff87]/25 hover:shadow-[0_0_20px_rgba(0,255,135,0.4)] transition-all cursor-pointer"
              >
                <Plus className="size-3.5 stroke-[3]" />
                <span>Add Advertisement</span>
              </button>
            </div>
            <AdvertisementsEmptyState onAddAd={() => navigate({ to: "/admin/advertisements/create" })} />
          </div>
        ) : (
          /* Populated State */
          <>
            {/* Hero Banner */}
            <AdvertisementsBanner />

            {/* Stats + Add Button */}
            <AdvertisementStats
              total={totalCount}
              published={publishedCount}
              draft={draftCount}
              archived={archivedCount}
            />

            {/* Toolbar */}
            <AdvertisementToolbar
              search={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              campaignFilter={campaignFilter}
              onCampaignFilterChange={setCampaignFilter}
              tagFilter={tagFilter}
              onTagFilterChange={setTagFilter}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onRefresh={handleRefresh}
              availableCampaigns={availableCampaigns}
            />

            {/* Table or Grid */}
            {viewMode === "list" ? (
              <AdvertisementTable
                advertisements={paginatedAds}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                getMoveUpTitle={getMoveUpTitle}
                getMoveDownTitle={getMoveDownTitle}
                onView={setViewModalAd}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteDialogAd}
                onBulkAction={handleBulkAction}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                totalCount={totalCount}
              />
            ) : (
              <AdvertisementGrid
                advertisements={paginatedAds}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                getMoveUpTitle={getMoveUpTitle}
                getMoveDownTitle={getMoveDownTitle}
                onView={setViewModalAd}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteDialogAd}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <AdvertisementViewModal
        ad={viewModalAd}
        open={!!viewModalAd}
        onOpenChange={(open) => !open && setViewModalAd(null)}
      />

      <AdvertisementDeleteDialog
        ad={deleteDialogAd}
        open={!!deleteDialogAd}
        onOpenChange={(open) => !open && setDeleteDialogAd(null)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Global Delete Confirmation Modal for Bulk Selected Advertisements */}
      <DeleteConfirmationModal
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleConfirmBulkDelete}
        itemType="Selected Advertisements"
        title={
          <>
            <span className="text-[#ef4444] drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">Delete</span>{" "}
            {selectedIds.length} Advertisements?
          </>
        }
        description={`This action cannot be undone. This will permanently delete ${selectedIds.length} selected advertisements and remove them from your campaigns.`}
        confirmLabel={`Delete ${selectedIds.length} Advertisements`}
      />

      <Toaster />
    </div>
  );
}
