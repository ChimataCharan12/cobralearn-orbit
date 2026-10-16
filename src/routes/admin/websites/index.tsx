import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { WebsitesBanner } from "@/components/websites/WebsitesBanner";
import { WebsiteStats } from "@/components/websites/WebsiteStats";
import { WebsiteToolbar } from "@/components/websites/WebsiteToolbar";
import { WebsiteTable } from "@/components/websites/WebsiteTable";
import { WebsiteGrid } from "@/components/websites/WebsiteGrid";
import { WebsitesLoadingState } from "@/components/websites/WebsitesLoadingState";
import { WebsitesEmptyState } from "@/components/websites/WebsitesEmptyState";
import { WebsitesErrorState } from "@/components/websites/WebsitesErrorState";
import { WebsiteDeleteDialog, WebsiteViewModal } from "@/components/websites/WebsiteModals";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { websiteToItem, type WebsiteItem, type WebsiteStatus } from "@/lib/websites-data";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { useWebsites } from "@/lib/websites/use-websites";

export const Route = createFileRoute("/admin/websites/")({
  head: () => ({
    meta: [
      { title: "Websites — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content: "Manage and monitor CobraLearn showcase websites and deployments.",
      },
      { property: "og:title", content: "Websites — CobraLearn Innotechcore Admin" },
      { property: "og:description", content: "CobraLearn website showcase management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WebsitesPage,
});

function WebsitesPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication Guard
  useAuthGuard();

  // Load real PostgreSQL Websites via useWebsites hook
  const {
    websites: rawWebsites,
    isLoading,
    error,
    refreshWebsites,
    createWebsite,
    updateWebsite,
    deleteWebsite,
    reorderWebsites,
  } = useWebsites();

  // Map to UI-compatible WebsiteItem records
  const websitesList = useMemo(() => {
    return rawWebsites.map(websiteToItem);
  }, [rawWebsites]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtering & Sorting & View State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("order");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal States
  const [viewModalWebsite, setViewModalWebsite] = useState<WebsiteItem | null>(null);
  const [deleteDialogWebsite, setDeleteDialogWebsite] = useState<WebsiteItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Categories derived from data
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    websitesList.forEach((w) => {
      if (w.category) set.add(w.category);
    });
    return Array.from(set).sort();
  }, [websitesList]);

  // Statistics calculation
  const totalCount = websitesList.length;
  const publishedCount = websitesList.filter((w) => w.status === "Published").length;
  const draftCount = websitesList.filter((w) => w.status === "Draft").length;
  const archivedCount = websitesList.filter((w) => w.status === "Archived").length;

  // Filtered & Sorted Websites
  const filteredWebsites = useMemo(() => {
    let result = [...websitesList];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.url.toLowerCase().includes(q) ||
          w.technologies.some((t) => t.toLowerCase().includes(q)) ||
          (w.category && w.category.toLowerCase().includes(q))
      );
    }

    // Status Filter
    if (statusFilter !== "ALL") {
      result = result.filter((w) => w.status === statusFilter);
    }

    // Category Filter
    if (categoryFilter !== "ALL") {
      result = result.filter((w) => w.category === categoryFilter);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "newest") {
        return b.id.localeCompare(a.id);
      }
      if (sortBy === "status") {
        const statusDiff = a.status.localeCompare(b.status);
        return statusDiff !== 0 ? statusDiff : a.order - b.order;
      }
      return a.order - b.order;
    });

    return result;
  }, [websitesList, searchQuery, statusFilter, categoryFilter, sortBy]);

  // Paginated Websites
  const totalPages = Math.ceil(filteredWebsites.length / pageSize) || 1;
  const paginatedWebsites = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWebsites.slice(start, start + pageSize);
  }, [filteredWebsites, currentPage, pageSize]);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, categoryFilter, sortBy]);

  // Clamp current page
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const currentIds = paginatedWebsites.map((w) => w.id);
    const allSelected = currentIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  // Guard manual reordering: only allow when viewing the full, unfiltered list sorted by Display Order
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
      const index = websitesList.findIndex((w) => w.id === id);
      return index > 0;
    },
    [isReorderingEnabled, isReordering, websitesList]
  );

  const canMoveDown = useCallback(
    (id: string) => {
      if (!isReorderingEnabled || isReordering) return false;
      const index = websitesList.findIndex((w) => w.id === id);
      return index >= 0 && index < websitesList.length - 1;
    },
    [isReorderingEnabled, isReordering, websitesList]
  );

  const getMoveUpTitle = useCallback(
    (id: string) => {
      if (!isReorderingEnabled) {
        return "Reordering is disabled while search, filters, or alternative sorting are active. Clear filters and sort by Display Order to reorder.";
      }
      if (isReordering) {
        return "Updating website order...";
      }
      const index = websitesList.findIndex((w) => w.id === id);
      if (index <= 0) {
        return "Already first in display order";
      }
      return "Move up";
    },
    [isReorderingEnabled, isReordering, websitesList]
  );

  const getMoveDownTitle = useCallback(
    (id: string) => {
      if (!isReorderingEnabled) {
        return "Reordering is disabled while search, filters, or alternative sorting are active. Clear filters and sort by Display Order to reorder.";
      }
      if (isReordering) {
        return "Updating website order...";
      }
      const index = websitesList.findIndex((w) => w.id === id);
      if (index >= websitesList.length - 1) {
        return "Already last in display order";
      }
      return "Move down";
    },
    [isReorderingEnabled, isReordering, websitesList]
  );

  const handleMoveUp = async (id: string) => {
    if (!isReorderingEnabled || isReordering) return;
    const index = websitesList.findIndex((w) => w.id === id);
    if (index <= 0) return;

    setIsReordering(true);
    try {
      const reordered = [...websitesList];
      const item = reordered.splice(index, 1)[0];
      if (item) {
        reordered.splice(index - 1, 0, item);
        const orderedIds = reordered.map((w) => w.id);
        await reorderWebsites(orderedIds);
      }
    } finally {
      setIsReordering(false);
    }
  };

  const handleMoveDown = async (id: string) => {
    if (!isReorderingEnabled || isReordering) return;
    const index = websitesList.findIndex((w) => w.id === id);
    if (index < 0 || index >= websitesList.length - 1) return;

    setIsReordering(true);
    try {
      const reordered = [...websitesList];
      const item = reordered.splice(index, 1)[0];
      if (item) {
        reordered.splice(index + 1, 0, item);
        const orderedIds = reordered.map((w) => w.id);
        await reorderWebsites(orderedIds);
      }
    } finally {
      setIsReordering(false);
    }
  };

  const handleDuplicate = async (website: WebsiteItem) => {
    await createWebsite({
      name: `${website.name} (Copy)`,
      url: website.url,
      description: website.description,
      fullDescription: website.fullDescription,
      category: website.category,
      status: "DRAFT",
      featured: website.featured,
      displayOrder: websitesList.length + 1,
      launchDate: website.launchDate,
      teamSize: website.teamSize,
      technologies: website.technologies,
      tags: website.tags,
      githubUrl: website.githubUrl,
      videoUrl: website.videoUrl,
      thumbnailId: website.thumbnailId,
      galleryMediaIds: website.gallery ? website.gallery.map((g) => g.mediaId) : [],
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialogWebsite) return;
    const success = await deleteWebsite(deleteDialogWebsite.id);
    if (success) {
      setSelectedIds((prev) => prev.filter((id) => id !== deleteDialogWebsite.id));
      setDeleteDialogWebsite(null);
    }
  };

  const handleConfirmBulkDelete = async () => {
    for (const id of selectedIds) {
      await deleteWebsite(id);
    }
    setSelectedIds([]);
    setBulkDeleteOpen(false);
  };

  const handleBulkAction = async (action: "publish" | "draft" | "delete") => {
    if (action === "publish" || action === "draft") {
      const newStatus = action === "publish" ? "PUBLISHED" : "DRAFT";
      for (const id of selectedIds) {
        await updateWebsite(id, { status: newStatus });
      }
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
    await refreshWebsites();
    toast.info("Websites list refreshed from database.");
  };

  const handleRetry = async () => {
    await refreshWebsites();
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
        <AdminHeader
          onMenu={() => setMobileMenuOpen(true)}
          searchPlaceholder="Search websites, technologies, categories..."
        />

        {/* View States */}
        {isLoading ? (
          <div className="space-y-4">
            <WebsitesBanner />
            <WebsitesLoadingState />
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 py-1">
              <div>
                <h1 className="font-sans text-[24px] sm:text-[28px] font-bold text-white tracking-tight">
                  Websites
                </h1>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#94a3b8]">
                  Manage and monitor CobraLearn showcase websites and deployments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/admin/websites/create" })}
                className="flex items-center gap-1.5 rounded-[9px] border border-[#00ff87]/50 bg-[#00ff87]/15 px-3.5 py-2 text-[12.5px] font-semibold text-[#00ff87] shadow-[0_0_14px_rgba(0,255,135,0.25)] hover:bg-[#00ff87]/25 hover:shadow-[0_0_20px_rgba(0,255,135,0.4)] transition-all cursor-pointer"
              >
                <Plus className="size-3.5 stroke-[3]" />
                <span>Add Website</span>
              </button>
            </div>
            <WebsitesErrorState
              onRetry={handleRetry}
              onGoBack={() => navigate({ to: "/admin/dashboard" })}
            />
          </div>
        ) : websitesList.length === 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 py-1">
              <div>
                <h1 className="font-sans text-[24px] sm:text-[28px] font-bold text-white tracking-tight">
                  Websites
                </h1>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#94a3b8]">
                  Manage and monitor CobraLearn showcase websites and deployments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/admin/websites/create" })}
                className="flex items-center gap-1.5 rounded-[9px] border border-[#00ff87]/50 bg-[#00ff87]/15 px-3.5 py-2 text-[12.5px] font-semibold text-[#00ff87] shadow-[0_0_14px_rgba(0,255,135,0.25)] hover:bg-[#00ff87]/25 hover:shadow-[0_0_20px_rgba(0,255,135,0.4)] transition-all cursor-pointer"
              >
                <Plus className="size-3.5 stroke-[3]" />
                <span>Add Website</span>
              </button>
            </div>
            <WebsitesEmptyState onAddWebsite={() => navigate({ to: "/admin/websites/create" })} />
          </div>
        ) : (
          /* Populated State */
          <>
            {/* Websites Banner */}
            <WebsitesBanner />

            {/* Website Stats Cards + Add Website Button */}
            <WebsiteStats
              total={totalCount}
              published={publishedCount}
              draft={draftCount}
              archived={archivedCount}
            />

            {/* Search, Filter & Toolbar */}
            <WebsiteToolbar
              search={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onRefresh={handleRefresh}
              availableCategories={availableCategories}
            />

            {/* Websites Table / Grid */}
            {viewMode === "list" ? (
              <WebsiteTable
                websites={paginatedWebsites}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                getMoveUpTitle={getMoveUpTitle}
                getMoveDownTitle={getMoveDownTitle}
                onView={setViewModalWebsite}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteDialogWebsite}
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
              <WebsiteGrid
                websites={paginatedWebsites}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                getMoveUpTitle={getMoveUpTitle}
                getMoveDownTitle={getMoveDownTitle}
                onView={setViewModalWebsite}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteDialogWebsite}
              />
            )}
          </>
        )}
      </main>

      {/* Modals & Dialogs */}
      <WebsiteViewModal
        website={viewModalWebsite}
        open={!!viewModalWebsite}
        onOpenChange={(open) => !open && setViewModalWebsite(null)}
      />

      <WebsiteDeleteDialog
        website={deleteDialogWebsite}
        open={!!deleteDialogWebsite}
        onOpenChange={(open) => !open && setDeleteDialogWebsite(null)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Global Delete Confirmation Modal for Bulk Selected Websites */}
      <DeleteConfirmationModal
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleConfirmBulkDelete}
        itemType="Selected Websites"
        title={
          <>
            <span className="text-[#ef4444] drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">Delete</span>{" "}
            {selectedIds.length} Websites?
          </>
        }
        description={`This action cannot be undone. This will permanently delete ${selectedIds.length} selected websites and remove them from the showcase.`}
        confirmLabel={`Delete ${selectedIds.length} Websites`}
      />

      <Toaster />
    </div>
  );
}
