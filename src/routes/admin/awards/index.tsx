import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { AwardsBanner } from "@/components/awards/AwardsBanner";
import { AwardStats } from "@/components/awards/AwardStats";
import { AwardToolbar } from "@/components/awards/AwardToolbar";
import { AwardTable } from "@/components/awards/AwardTable";
import { AwardGrid } from "@/components/awards/AwardGrid";
import { AwardsLoadingState } from "@/components/awards/AwardsLoadingState";
import { AwardsEmptyState } from "@/components/awards/AwardsEmptyState";
import { AwardsErrorState } from "@/components/awards/AwardsErrorState";
import {
  AwardDeleteDialog,
  AwardViewModal,
} from "@/components/awards/AwardModals";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import {
  type AwardItem,
  type AwardStatus,
} from "@/lib/awards-data";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { useAwards } from "@/lib/awards/use-awards";
import { adminClient } from "@/lib/api/admin-client";

export const Route = createFileRoute("/admin/awards/")({
  head: () => ({
    meta: [
      { title: "Awards & Achievements — CobraLearn Admin" },
      {
        name: "description",
        content: "Manage and showcase awards, recognitions and achievements on your platform.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AwardsPage,
});

function AwardsPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useAuthGuard();

  const {
    awards: rawAwards,
    isLoading: isQueryLoading,
    error: queryError,
    refetch,
    createAward,
    deleteAward,
    reorderAwards,
    updateAward,
  } = useAwards();

  const [simulatedState, setSimulatedState] = useState<"loading" | "empty" | "error" | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("order");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [viewModalAward, setViewModalAward] = useState<AwardItem | null>(null);
  const [deleteDialogAward, setDeleteDialogAward] = useState<AwardItem | null>(null);
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

  const awardsList = useMemo(() => {
    if (simulatedState === "empty") return [];
    return rawAwards;
  }, [simulatedState, rawAwards]);

  const isLoading = simulatedState === "loading" || isQueryLoading;
  const error = simulatedState === "error" ? "Simulated network connection failed." : queryError;

  // Available categories list
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    awardsList.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set).sort();
  }, [awardsList]);

  // Statistics calculation
  const totalCount = awardsList.length;
  const publishedCount = awardsList.filter((a) => a.status === "Published").length;
  const draftCount = awardsList.filter((a) => a.status === "Draft").length;
  const archivedCount = awardsList.filter((a) => a.status === "Archived").length;

  // Filtered awards
  const filteredAwards = useMemo(() => {
    let result = [...awardsList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.organization.toLowerCase().includes(q) ||
          a.context.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "ALL") {
      result = result.filter((a) => a.status === statusFilter);
    }

    if (categoryFilter !== "ALL") {
      result = result.filter((a) => a.category === categoryFilter);
    }

    if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "date") {
      result.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    } else {
      result.sort((a, b) => a.order - b.order);
    }

    return result;
  }, [awardsList, searchQuery, statusFilter, categoryFilter, sortBy]);

  // Paginated awards
  const totalPages = Math.ceil(filteredAwards.length / pageSize) || 1;
  const paginatedAwards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAwards.slice(start, start + pageSize);
  }, [filteredAwards, currentPage, pageSize]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, categoryFilter, sortBy]);

  // Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const ids = paginatedAwards.map((a) => a.id);
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
      categoryFilter === "ALL" &&
      sortBy === "order"
    );
  }, [searchQuery, statusFilter, categoryFilter, sortBy]);

  const canMoveUp = useCallback(
    (id: string) => {
      if (!isReorderingEnabled || isReordering) return false;
      const index = awardsList.findIndex((a) => a.id === id);
      return index > 0;
    },
    [isReorderingEnabled, isReordering, awardsList]
  );

  const canMoveDown = useCallback(
    (id: string) => {
      if (!isReorderingEnabled || isReordering) return false;
      const index = awardsList.findIndex((a) => a.id === id);
      return index >= 0 && index < awardsList.length - 1;
    },
    [isReorderingEnabled, isReordering, awardsList]
  );

  const getMoveUpTitle = useCallback(
    (id: string) => {
      if (!isReorderingEnabled) {
        return "Reordering is disabled while search or filters are active. Clear filters to reorder.";
      }
      if (isReordering) {
        return "Updating award order...";
      }
      const index = awardsList.findIndex((a) => a.id === id);
      if (index <= 0) {
        return "Already first in display order";
      }
      return "Move up";
    },
    [isReorderingEnabled, isReordering, awardsList]
  );

  const getMoveDownTitle = useCallback(
    (id: string) => {
      if (!isReorderingEnabled) {
        return "Reordering is disabled while search or filters are active. Clear filters to reorder.";
      }
      if (isReordering) {
        return "Updating award order...";
      }
      const index = awardsList.findIndex((a) => a.id === id);
      if (index >= awardsList.length - 1) {
        return "Already last in display order";
      }
      return "Move down";
    },
    [isReorderingEnabled, isReordering, awardsList]
  );

  const handleMoveUp = async (id: string) => {
    if (!isReorderingEnabled || isReordering) return;
    const index = awardsList.findIndex((a) => a.id === id);
    if (index <= 0) return;

    setIsReordering(true);
    try {
      const reordered = [...awardsList];
      const item = reordered.splice(index, 1)[0]!;
      reordered.splice(index - 1, 0, item);
      const orderedIds = reordered.map((a) => a.id);
      await reorderAwards(orderedIds);
    } finally {
      setIsReordering(false);
    }
  };

  const handleMoveDown = async (id: string) => {
    if (!isReorderingEnabled || isReordering) return;
    const index = awardsList.findIndex((a) => a.id === id);
    if (index < 0 || index >= awardsList.length - 1) return;

    setIsReordering(true);
    try {
      const reordered = [...awardsList];
      const item = reordered.splice(index, 1)[0]!;
      reordered.splice(index + 1, 0, item);
      const orderedIds = reordered.map((a) => a.id);
      await reorderAwards(orderedIds);
    } finally {
      setIsReordering(false);
    }
  };

  const handleDuplicate = async (award: AwardItem) => {
    const copyName = `${award.name} (Copy)`;
    const copySlug = `${award.slug}-copy-${Date.now()}`;
    const payload = {
      name: copyName,
      slug: copySlug,
      context: award.context,
      organization: award.organization,
      category: award.category,
      date: award.date,
      description: award.description,
      fullDescription: award.fullDescription || award.description,
      credentialUrl: award.credentialUrl,
      status: "DRAFT" as const,
      showOnHomepage: award.showOnHomepage ?? true,
      displayOrder: awardsList.length + 1,
      thumbnailId: award.thumbnailId || null,
    };

    const res = await createAward(payload);
    if (res) {
      toast.success(`Duplicated "${award.name}" as Draft.`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialogAward) return;
    const success = await deleteAward(deleteDialogAward.id);
    if (success) {
      setSelectedIds((prev) => prev.filter((id) => id !== deleteDialogAward.id));
      setDeleteDialogAward(null);
    }
  };

  const handleConfirmBulkDelete = async () => {
    let successCount = 0;
    for (const id of selectedIds) {
      const ok = await deleteAward(id);
      if (ok) successCount++;
    }
    toast.success(`Deleted ${successCount} award(s).`);
    setSelectedIds([]);
    setBulkDeleteOpen(false);
  };

  const handleBulkAction = async (action: "publish" | "draft" | "delete") => {
    if (action === "publish" || action === "draft") {
      const newStatus = action === "publish" ? "PUBLISHED" : "DRAFT";
      let updatedCount = 0;
      for (const id of selectedIds) {
        const res = await updateAward(id, { status: newStatus as any });
        if (res) updatedCount++;
      }
      toast.success(`Updated ${updatedCount} award(s) to ${action === "publish" ? "Published" : "Draft"}.`);
      setSelectedIds([]);
    } else if (action === "delete") {
      if (selectedIds.length > 0) {
        setBulkDeleteOpen(true);
      }
    }
  };

  const handleRefresh = async () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setSortBy("order");
    setSelectedIds([]);
    setSimulatedState(null);
    await refetch();
    toast.info("Awards list refreshed.");
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

      <main className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-6">
        <AdminHeader
          onMenu={() => setMobileMenuOpen(true)}
          searchPlaceholder="Search awards..."
        />

        {/* Hero Banner */}
        <AwardsBanner
          pageTitle="Awards & Achievements"
          subtitle="Manage your platform's certificates, competition accolades, and public honors."
        />

        {/* Metrics Cards */}
        <AwardStats
          total={totalCount}
          published={publishedCount}
          draft={draftCount}
          archived={archivedCount}
        />

        {/* Action Toolbar */}
        <AwardToolbar
          search={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          availableCategories={availableCategories}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={handleRefresh}
        />

        {/* Main Content Area */}
        {isLoading ? (
          <AwardsLoadingState />
        ) : error ? (
          <AwardsErrorState
            onRetry={handleRetry}
            onGoBack={() => navigate({ to: "/admin/dashboard" })}
          />
        ) : filteredAwards.length === 0 ? (
          <AwardsEmptyState onAddAward={() => navigate({ to: "/admin/awards/create" })} />
        ) : viewMode === "list" ? (
          <AwardTable
            awards={paginatedAwards}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            canMoveUpFn={canMoveUp}
            canMoveDownFn={canMoveDown}
            getMoveUpTitleFn={getMoveUpTitle}
            getMoveDownTitleFn={getMoveDownTitle}
            onView={(aw) => setViewModalAward(aw)}
            onDuplicate={handleDuplicate}
            onDelete={(aw) => setDeleteDialogAward(aw)}
            onBulkAction={handleBulkAction}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            totalCount={filteredAwards.length}
          />
        ) : (
          <AwardGrid
            awards={paginatedAwards}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            canMoveUpFn={canMoveUp}
            canMoveDownFn={canMoveDown}
            getMoveUpTitleFn={getMoveUpTitle}
            getMoveDownTitleFn={getMoveDownTitle}
            onView={(aw) => setViewModalAward(aw)}
            onDuplicate={handleDuplicate}
            onDelete={(aw) => setDeleteDialogAward(aw)}
          />
        )}
      </main>

      {/* View Modal */}
      <AwardViewModal
        award={viewModalAward}
        open={!!viewModalAward}
        onOpenChange={(open) => !open && setViewModalAward(null)}
      />

      {/* Single Delete Dialog */}
      <AwardDeleteDialog
        award={deleteDialogAward}
        open={!!deleteDialogAward}
        onOpenChange={(open) => !open && setDeleteDialogAward(null)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Bulk Delete Modal */}
      <DeleteConfirmationModal
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleConfirmBulkDelete}
        itemType="Awards"
        itemName={`${selectedIds.length} selected items`}
      />

      <Toaster />
    </div>
  );
}
