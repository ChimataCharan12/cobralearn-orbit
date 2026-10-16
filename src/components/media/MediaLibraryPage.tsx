import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { MediaLibraryBanner } from "@/components/media/MediaLibraryBanner";
import { MediaStats } from "@/components/media/MediaStats";
import { MediaToolbar } from "@/components/media/MediaToolbar";
import { MediaCard } from "@/components/media/MediaCard";
import { MediaLoadingState } from "@/components/media/MediaLoadingState";
import { MediaEmptyState } from "@/components/media/MediaEmptyState";
import { MediaErrorState } from "@/components/media/MediaErrorState";
import { UploadMediaModal } from "@/components/media/UploadMediaModal";
import { MediaDetailModal } from "@/components/media/MediaDetailModal";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { type MediaItem, prismaAssetToMediaItem, formatBytes } from "@/lib/media-data";
import { adminClient } from "@/lib/api/admin-client";
import { useAuthGuard } from "@/lib/auth/use-auth";

export function MediaLibraryPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication Guard
  useAuthGuard();

  // Central Media state populated by adminClient.listAdminMedia()
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Load persistent media from server
  const loadMedia = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminClient.listAdminMedia();
      if (!res.success || !res.data) {
        setError(res.error ?? "Failed to load media assets");
        setIsLoading(false);
        return false;
      }
      const mapped = res.data.assets.map((asset) => prismaAssetToMediaItem(asset));
      setMediaItems(mapped);
      setIsLoading(false);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load media assets";
      setError(msg);
      setIsLoading(false);
      return false;
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  // Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date-desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modals
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null);
  const [deleteTargetItem, setDeleteTargetItem] = useState<MediaItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Filter & Sort Logic
  const filteredItems = useMemo(() => {
    let result = [...mediaItems];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.type.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          (m.tags && m.tags.some((t) => t.toLowerCase().includes(q))) ||
          (m.altText && m.altText.toLowerCase().includes(q))
      );
    }

    if (typeFilter !== "ALL") {
      result = result.filter((m) => m.type === typeFilter);
    }

    if (categoryFilter !== "ALL") {
      result = result.filter((m) => m.category === categoryFilter);
    }

    result.sort((a, b) => {
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "date-desc") {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === "date-asc") {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      }
      if (sortBy === "size-desc") {
        return (b.rawSize || 0) - (a.rawSize || 0);
      }
      return 0;
    });

    return result;
  }, [mediaItems, searchQuery, typeFilter, categoryFilter, sortBy]);

  // Derived Pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));

  // Reset page to 1 when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, categoryFilter, sortBy]);

  // Clamp current page if total pages decreases (e.g. after deletions)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [totalPages, currentPage]);

  const startIndex = filteredItems.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, filteredItems.length);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredItems.map((m) => m.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Trigger delete modal for single item
  const handleDeleteItem = (item: MediaItem) => {
    if (isDeletingSingle || isDeletingBulk) return;
    setDeleteTargetItem(item);
  };

  // Confirm delete for single item via server API
  const handleConfirmDeleteItem = async () => {
    if (!deleteTargetItem || isDeletingSingle) return;
    setIsDeletingSingle(true);
    const target = deleteTargetItem;

    try {
      const res = await adminClient.deleteAdminMedia(target.id);
      if (!res.success) {
        toast.error(res.error || `Failed to delete asset "${target.name}".`);
        setDeleteTargetItem(null);
        return;
      }

      setMediaItems((prev) => prev.filter((item) => item.id !== target.id));
      setSelectedIds((prev) => prev.filter((id) => id !== target.id));
      if (res.data?.storageWarning) {
        toast.warning(
          `Deleted asset "${target.name}" from database, but physical file cleanup failed: ${res.data.storageWarning}`
        );
      } else {
        toast.success(`Deleted asset "${target.name}".`);
      }
      setDeleteTargetItem(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to delete asset "${target.name}".`;
      toast.error(msg);
      setDeleteTargetItem(null);
    } finally {
      setIsDeletingSingle(false);
    }
  };

  const handleUpdateMedia = (updatedItem: MediaItem) => {
    setMediaItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
    setDetailItem(updatedItem);
  };

  const handleBulkAction = (action: string) => {
    if (selectedIds.length === 0 || isDeletingBulk || isDeletingSingle) return;
    if (action === "delete") {
      setBulkDeleteOpen(true);
    }
  };

  // Confirm bulk delete via server API
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0 || isDeletingBulk) return;
    setIsDeletingBulk(true);

    const idsToDelete = [...selectedIds];
    const successfulIds: string[] = [];
    const warningItems: Array<{ id: string; name?: string | undefined; warning: string }> = [];
    const failedItems: Array<{ id: string; name?: string | undefined; error: string }> = [];

    try {
      const results = await Promise.allSettled(
        idsToDelete.map(async (id) => {
          const item = mediaItems.find((m) => m.id === id);
          const res = await adminClient.deleteAdminMedia(id);
          return { id, name: item?.name, res };
        })
      );

      results.forEach((result, idx) => {
        const id = idsToDelete[idx];
        if (!id) return;
        const item = mediaItems.find((m) => m.id === id);
        const name = item?.name;

        if (result.status === "fulfilled") {
          const { res } = result.value;
          if (res.success) {
            successfulIds.push(id);
            if (res.data?.storageWarning) {
              warningItems.push({
                id,
                name,
                warning: res.data.storageWarning,
              });
            }
          } else {
            failedItems.push({
              id,
              name,
              error: res.error || "Deletion failed",
            });
          }
        } else {
          const reason = result.reason instanceof Error ? result.reason.message : "Deletion failed";
          failedItems.push({
            id,
            name,
            error: reason,
          });
        }
      });

      // Remove only successfully deleted assets from state and selection
      if (successfulIds.length > 0) {
        setMediaItems((prev) => prev.filter((item) => !successfulIds.includes(item.id)));
        setSelectedIds((prev) => prev.filter((id) => !successfulIds.includes(id)));
      }

      // Provide accurate, non-blanket feedback
      if (failedItems.length === 0) {
        if (warningItems.length > 0) {
          toast.warning(
            `Deleted ${successfulIds.length} assets from database, but ${warningItems.length} had storage cleanup warnings.`
          );
        } else {
          toast.success(`Deleted ${successfulIds.length} assets.`);
        }
      } else if (successfulIds.length === 0) {
        const firstError = failedItems[0]?.error;
        toast.error(
          failedItems.length === 1
            ? `Failed to delete asset: ${firstError}`
            : `Failed to delete all ${failedItems.length} selected assets: ${firstError}`
        );
      } else {
        if (warningItems.length > 0) {
          toast.warning(
            `Deleted ${successfulIds.length} of ${idsToDelete.length} assets (${warningItems.length} had storage cleanup warnings).`
          );
        } else {
          toast.success(`Deleted ${successfulIds.length} of ${idsToDelete.length} assets.`);
        }
        const firstError = failedItems[0]?.error;
        toast.error(
          `${failedItems.length} asset(s) could not be deleted: ${firstError}`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred during bulk deletion.";
      toast.error(msg);
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteOpen(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setTypeFilter("ALL");
    setCategoryFilter("ALL");
    setSortBy("date-desc");
    setCurrentPage(1);
  };

  const handleRefresh = async () => {
    handleClearFilters();
    setSelectedIds([]);
    const success = await loadMedia();
    if (success) {
      toast.success("Media library refreshed.");
    }
  };

  return (
    <div className="dash-bg flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <div data-sidebar-wrapper className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <AdminSidebar />
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[268px] border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AdminSidebar onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-6">
        {/* Top Header */}
        <AdminHeader
          onMenu={() => setMobileMenuOpen(true)}
          searchPlaceholder="Search media files, images, videos, documents..."
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Media Library Banner */}
        <MediaLibraryBanner />

        {/* Statistics Cards + Upload Button */}
        <MediaStats
          imageCount={mediaItems.filter((m) => m.type === "Image").length}
          imageSize={formatBytes(mediaItems.filter((m) => m.type === "Image").reduce((sum, m) => sum + (m.rawSize || 0), 0))}
          videoCount={mediaItems.filter((m) => m.type === "Video").length}
          videoSize={formatBytes(mediaItems.filter((m) => m.type === "Video").reduce((sum, m) => sum + (m.rawSize || 0), 0))}
          documentCount={mediaItems.filter((m) => m.type === "Document").length}
          documentSize={formatBytes(mediaItems.filter((m) => m.type === "Document").reduce((sum, m) => sum + (m.rawSize || 0), 0))}
          otherCount={mediaItems.filter((m) => m.type === "Others").length}
          otherSize={formatBytes(mediaItems.filter((m) => m.type === "Others").reduce((sum, m) => sum + (m.rawSize || 0), 0))}
          onUploadClick={() => setUploadOpen(true)}
        />

        {/* Media Toolbar */}
        <MediaToolbar
          search={searchQuery}
          onSearchChange={setSearchQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={handleRefresh}
        />

        {/* Media Grid / List */}
        {isLoading ? (
          <MediaLoadingState viewMode={viewMode} />
        ) : error ? (
          <MediaErrorState
            error={error}
            onRetry={loadMedia}
          />
        ) : filteredItems.length === 0 ? (
          <MediaEmptyState
            hasFilters={Boolean(searchQuery.trim() || typeFilter !== "ALL" || categoryFilter !== "ALL")}
            onClearFilters={handleClearFilters}
            onUploadClick={() => setUploadOpen(true)}
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {paginatedItems.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                isSelected={selectedIds.includes(item.id)}
                onToggleSelect={handleToggleSelect}
                onPreview={(m) => setDetailItem(m)}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        ) : (
          /* List View Table */
          <div className="overflow-hidden rounded-xl border border-brand/20 bg-panel/85">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-brand/15 bg-background/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="size-3.5 accent-[#00e599]"
                    />
                  </th>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand/10">
                {paginatedItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setDetailItem(item)}
                    className="hover:bg-brand/10 transition cursor-pointer"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                        className="size-3.5 accent-[#00e599]"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-brand-bright">{item.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.size}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.date}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Pagination & Bulk Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand/20 bg-panel/75 px-4 py-3">
          {/* Left: Bulk Selection */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12.5px] font-medium text-foreground/80 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="size-3.5 accent-[#00e599]"
              />
              <span>{selectedIds.length} selected</span>
            </label>

            {selectedIds.length > 0 && (
              <select
                onChange={(e) => {
                  handleBulkAction(e.target.value);
                  e.target.value = "";
                }}
                defaultValue=""
                className="h-8 rounded-lg border border-brand/35 bg-background/80 px-2.5 text-[12px] font-medium text-foreground focus:border-brand-bright"
              >
                <option value="" disabled>Bulk Actions</option>
                <option value="delete">Delete Selected</option>
              </select>
            )}
          </div>

          {/* Right: Pagination Controls */}
          <div className="flex items-center gap-3 text-[12.5px] text-muted-foreground">
            <span>
              Showing {filteredItems.length === 0 ? "0" : `${startIndex}–${endIndex}`} of {filteredItems.length}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className="flex size-7 items-center justify-center rounded border border-brand/25 bg-background/60 hover:border-brand-bright/50 hover:text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              {pageNumbers.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`flex size-7 items-center justify-center rounded text-[12px] font-medium transition cursor-pointer ${
                    currentPage === page
                      ? "border border-brand-bright bg-brand/20 font-bold text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.3)]"
                      : "border border-brand/20 bg-background/50 hover:border-brand-bright/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="flex size-7 items-center justify-center rounded border border-brand/25 bg-background/60 hover:border-brand-bright/50 hover:text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>

            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-7 rounded border border-brand/25 bg-background/60 px-2 text-[11.5px] text-foreground/80 focus:border-brand-bright cursor-pointer"
            >
              <option value="15">15 / page</option>
              <option value="30">30 / page</option>
              <option value="50">50 / page</option>
            </select>
          </div>
        </div>
      </main>

      {/* Upload Media Modal */}
      <UploadMediaModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onAddMedia={(newMedia) => {
          setMediaItems((prev) => {
            const exists = prev.some((item) => item.id === newMedia.id);
            if (exists) return prev;
            return [newMedia, ...prev];
          });
        }}
      />

      {/* Media Detail Modal */}
      <MediaDetailModal
        item={detailItem}
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        onDelete={handleDeleteItem}
        onUpdate={handleUpdateMedia}
      />

      {/* Global Delete Confirmation Modal for Single Media Asset */}
      <DeleteConfirmationModal
        open={Boolean(deleteTargetItem)}
        onOpenChange={(open) => {
          if (!open && !isDeletingSingle) {
            setDeleteTargetItem(null);
          }
        }}
        onConfirm={handleConfirmDeleteItem}
        onCancel={() => {
          if (!isDeletingSingle) {
            setDeleteTargetItem(null);
          }
        }}
        isLoading={isDeletingSingle}
        itemType="Media Asset"
        itemName={deleteTargetItem?.name}
        itemDescription={`${deleteTargetItem?.type || "File"} • ${deleteTargetItem?.dimensions || ""} • ${deleteTargetItem?.size || ""}`.trim()}
        itemImage={deleteTargetItem?.thumbnail || deleteTargetItem?.url}
        itemStatus={deleteTargetItem?.type}
        itemBadgeVariant="cyan"
      />

      {/* Global Delete Confirmation Modal for Bulk Selected Assets */}
      <DeleteConfirmationModal
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open && !isDeletingBulk) {
            setBulkDeleteOpen(false);
          }
        }}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => {
          if (!isDeletingBulk) {
            setBulkDeleteOpen(false);
          }
        }}
        isLoading={isDeletingBulk}
        itemType="Selected Assets"
        title={
          <>
            <span className="text-[#ef4444] drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">Delete</span>{" "}
            {selectedIds.length} Assets?
          </>
        }
        description={`This action cannot be undone. This will permanently delete ${selectedIds.length} selected assets and remove them from the media library.`}
        confirmLabel={`Delete ${selectedIds.length} Assets`}
      />

      <Toaster />
    </div>
  );
}
