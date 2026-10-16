import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { ProjectsBanner } from "@/components/projects/ProjectsBanner";
import { ProjectStats } from "@/components/projects/ProjectStats";
import { ProjectToolbar } from "@/components/projects/ProjectToolbar";
import { ProjectTable } from "@/components/projects/ProjectTable";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { ProjectsLoadingState } from "@/components/projects/ProjectsLoadingState";
import { ProjectsEmptyState } from "@/components/projects/ProjectsEmptyState";
import { ProjectsErrorState } from "@/components/projects/ProjectsErrorState";
import {
  ProjectDeleteDialog,
  ProjectViewModal,
} from "@/components/projects/ProjectModals";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { projectToItem, statusToPrisma, type ProjectItem, type ProjectStatus } from "@/lib/projects-data";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { useProjects } from "@/lib/projects/use-projects";

export const Route = createFileRoute("/admin/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content: "Manage and showcase CobraLearn innovative projects with role-based visibility and reordering.",
      },
      { property: "og:title", content: "Projects — CobraLearn Innotechcore Admin" },
      { property: "og:description", content: "CobraLearn project showcase management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication Guard
  useAuthGuard();

  // Load real PostgreSQL Projects via useProjects hook
  const {
    projects: rawProjects,
    isLoading,
    error,
    refreshProjects,
    createProject,
    updateProject,
    deleteProject,
    reorderProjects,
  } = useProjects();

  // Map to UI-compatible ProjectItem records
  const projectsList = useMemo(() => {
    return rawProjects.map(projectToItem);
  }, [rawProjects]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtering & Sorting & View State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("order");
  const [tagFilter, setTagFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal States
  const [viewModalProject, setViewModalProject] = useState<ProjectItem | null>(null);
  const [deleteDialogProject, setDeleteDialogProject] = useState<ProjectItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Derive unique tags from projects
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    projectsList.forEach((p) => {
      p.technologies.forEach((t) => set.add(t));
      if (p.tags) p.tags.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [projectsList]);

  // Real Database Statistics calculation
  const totalCount = projectsList.length;
  const publishedCount = projectsList.filter((p) => p.status === "Published").length;
  const draftCount = projectsList.filter((p) => p.status === "Draft").length;
  const archivedCount = projectsList.filter((p) => p.status === "Archived").length;

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    let result = [...projectsList];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.technologies.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Status Filter
    if (statusFilter !== "ALL") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Tag Filter
    if (tagFilter !== "ALL") {
      result = result.filter(
        (p) => p.technologies.includes(tagFilter) || p.tags?.includes(tagFilter)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "name_asc") {
        const nameDiff = a.name.localeCompare(b.name);
        return nameDiff !== 0 ? nameDiff : a.order - b.order;
      }
      if (sortBy === "name_desc") {
        const nameDiff = b.name.localeCompare(a.name);
        return nameDiff !== 0 ? nameDiff : a.order - b.order;
      }
      if (sortBy === "status") {
        const statusDiff = a.status.localeCompare(b.status);
        return statusDiff !== 0 ? statusDiff : a.order - b.order;
      }
      return a.order - b.order;
    });

    return result;
  }, [projectsList, searchQuery, statusFilter, tagFilter, sortBy]);

  // Paginated Projects
  const totalPages = Math.ceil(filteredProjects.length / pageSize) || 1;
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  // Reset pagination to page 1 whenever filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, tagFilter, sortBy]);

  // Clamp current page to valid page range when deletions or filtering reduce total pages
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
    const currentIds = paginatedProjects.map((p) => p.id);
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
      tagFilter === "ALL" &&
      sortBy === "order"
    );
  }, [searchQuery, statusFilter, tagFilter, sortBy]);

  const canMoveUp = useCallback(
    (id: string) => {
      if (!isReorderingEnabled || isReordering) return false;
      const index = projectsList.findIndex((p) => p.id === id);
      return index > 0;
    },
    [isReorderingEnabled, isReordering, projectsList]
  );

  const canMoveDown = useCallback(
    (id: string) => {
      if (!isReorderingEnabled || isReordering) return false;
      const index = projectsList.findIndex((p) => p.id === id);
      return index >= 0 && index < projectsList.length - 1;
    },
    [isReorderingEnabled, isReordering, projectsList]
  );

  const getMoveUpTitle = useCallback(
    (id: string) => {
      if (!isReorderingEnabled) {
        return "Reordering is disabled while search, filters, or alternative sorting are active. Clear filters and sort by Display Order to reorder.";
      }
      if (isReordering) {
        return "Updating project order...";
      }
      const index = projectsList.findIndex((p) => p.id === id);
      if (index <= 0) {
        return "Already first in display order";
      }
      return "Move up";
    },
    [isReorderingEnabled, isReordering, projectsList]
  );

  const getMoveDownTitle = useCallback(
    (id: string) => {
      if (!isReorderingEnabled) {
        return "Reordering is disabled while search, filters, or alternative sorting are active. Clear filters and sort by Display Order to reorder.";
      }
      if (isReordering) {
        return "Updating project order...";
      }
      const index = projectsList.findIndex((p) => p.id === id);
      if (index >= projectsList.length - 1) {
        return "Already last in display order";
      }
      return "Move down";
    },
    [isReorderingEnabled, isReordering, projectsList]
  );

  const handleMoveUp = async (id: string) => {
    if (!isReorderingEnabled || isReordering) return;
    const index = projectsList.findIndex((p) => p.id === id);
    if (index <= 0) return;

    setIsReordering(true);
    try {
      const reordered = [...projectsList];
      const item = reordered.splice(index, 1)[0];
      if (item) {
        reordered.splice(index - 1, 0, item);
        const orderedIds = reordered.map((p) => p.id);
        await reorderProjects(orderedIds);
      }
    } finally {
      setIsReordering(false);
    }
  };

  const handleMoveDown = async (id: string) => {
    if (!isReorderingEnabled || isReordering) return;
    const index = projectsList.findIndex((p) => p.id === id);
    if (index < 0 || index >= projectsList.length - 1) return;

    setIsReordering(true);
    try {
      const reordered = [...projectsList];
      const item = reordered.splice(index, 1)[0];
      if (item) {
        reordered.splice(index + 1, 0, item);
        const orderedIds = reordered.map((p) => p.id);
        await reorderProjects(orderedIds);
      }
    } finally {
      setIsReordering(false);
    }
  };

  const handleDuplicate = async (project: ProjectItem) => {
    await createProject({
      name: `${project.name} (Copy)`,
      description: project.description,
      fullDescription: project.fullDescription,
      category: project.category,
      status: "DRAFT",
      featured: project.featured,
      displayOrder: projectsList.length + 1,
      projectDuration: project.projectDuration,
      teamSize: project.teamSize,
      technologies: project.technologies,
      tags: project.tags,
      liveUrl: project.liveUrl,
      githubUrl: project.githubUrl,
      videoUrl: project.videoUrl,
      thumbnailId: project.thumbnailId,
      galleryMediaIds: project.galleryMediaIds ? [...project.galleryMediaIds] : [],
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialogProject) return;
    const success = await deleteProject(deleteDialogProject.id);
    if (success) {
      setSelectedIds((prev) => prev.filter((id) => id !== deleteDialogProject.id));
      setDeleteDialogProject(null);
    }
  };

  const handleConfirmBulkDelete = async () => {
    for (const id of selectedIds) {
      await deleteProject(id);
    }
    setSelectedIds([]);
    setBulkDeleteOpen(false);
  };

  const handleBulkAction = async (action: "publish" | "draft" | "delete") => {
    if (action === "publish" || action === "draft") {
      const newStatus = action === "publish" ? "PUBLISHED" : "DRAFT";
      for (const id of selectedIds) {
        await updateProject(id, { status: newStatus });
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
    setTagFilter("ALL");
    setSortBy("order");
    setSelectedIds([]);
    await refreshProjects();
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
          searchPlaceholder="Search projects, tags, or keywords..."
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Dynamic Project States */}
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 py-1">
              <div>
                <h1 className="font-sans text-[24px] sm:text-[28px] font-bold text-white tracking-tight">
                  Projects
                </h1>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#94a3b8]">
                  Manage and showcase your innovative projects.
                </p>
              </div>
            </div>
            <ProjectsLoadingState />
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 py-1">
              <div>
                <h1 className="font-sans text-[24px] sm:text-[28px] font-bold text-white tracking-tight">
                  Projects
                </h1>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#94a3b8]">
                  Manage and showcase your innovative projects.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/admin/projects/create" })}
                className="flex items-center gap-1.5 rounded-[9px] border border-[#00ff87]/50 bg-[#00ff87]/15 px-3.5 py-2 text-[12.5px] font-semibold text-[#00ff87] shadow-[0_0_14px_rgba(0,255,135,0.25)] hover:bg-[#00ff87]/25 hover:shadow-[0_0_20px_rgba(0,255,135,0.4)] transition-all cursor-pointer"
              >
                <Plus className="size-3.5 stroke-[3]" />
                <span>Add Project</span>
              </button>
            </div>
            <ProjectsErrorState
              onRetry={handleRefresh}
              onGoBack={() => navigate({ to: "/admin/dashboard" })}
              errorMessage={error}
            />
          </div>
        ) : projectsList.length === 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 py-1">
              <div>
                <h1 className="font-sans text-[24px] sm:text-[28px] font-bold text-white tracking-tight">
                  Projects
                </h1>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#94a3b8]">
                  Manage and showcase your innovative projects.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/admin/projects/create" })}
                className="flex items-center gap-1.5 rounded-[9px] border border-[#00ff87]/50 bg-[#00ff87]/15 px-3.5 py-2 text-[12.5px] font-semibold text-[#00ff87] shadow-[0_0_14px_rgba(0,255,135,0.25)] hover:bg-[#00ff87]/25 hover:shadow-[0_0_20px_rgba(0,255,135,0.4)] transition-all cursor-pointer"
              >
                <Plus className="size-3.5 stroke-[3]" />
                <span>Add Project</span>
              </button>
            </div>
            <ProjectsEmptyState onAddProject={() => navigate({ to: "/admin/projects/create" })} />
          </div>
        ) : (
          /* Populated State */
          <>
            {/* Projects Banner */}
            <ProjectsBanner />

            {/* Project Stats Cards + Add Project Button */}
            <ProjectStats
              total={totalCount}
              published={publishedCount}
              draft={draftCount}
              archived={archivedCount}
            />

            {/* Search, Filter & Toolbar */}
            <ProjectToolbar
              search={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              tagFilter={tagFilter}
              onTagFilterChange={setTagFilter}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onRefresh={handleRefresh}
              availableTags={availableTags}
            />

            {/* Projects Table / Grid */}
            {viewMode === "list" ? (
              <ProjectTable
                projects={paginatedProjects}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                getMoveUpTitle={getMoveUpTitle}
                getMoveDownTitle={getMoveDownTitle}
                onView={setViewModalProject}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteDialogProject}
                onBulkAction={handleBulkAction}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                totalCount={filteredProjects.length}
              />
            ) : (
              <ProjectGrid
                projects={paginatedProjects}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                getMoveUpTitle={getMoveUpTitle}
                getMoveDownTitle={getMoveDownTitle}
                onView={setViewModalProject}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteDialogProject}
              />
            )}
          </>
        )}
      </main>

      {/* Modals & Dialogs */}
      <ProjectViewModal
        project={viewModalProject}
        open={!!viewModalProject}
        onOpenChange={(open) => !open && setViewModalProject(null)}
      />

      <ProjectDeleteDialog
        project={deleteDialogProject}
        open={!!deleteDialogProject}
        onOpenChange={(open) => !open && setDeleteDialogProject(null)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Global Delete Confirmation Modal for Bulk Selected Projects */}
      <DeleteConfirmationModal
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleConfirmBulkDelete}
        itemType="Selected Projects"
        title={
          <>
            <span className="text-[#ef4444] drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">Delete</span>{" "}
            {selectedIds.length} Projects?
          </>
        }
        description={`This action cannot be undone. This will permanently delete ${selectedIds.length} selected projects and remove them from the showcase.`}
        confirmLabel={`Delete ${selectedIds.length} Projects`}
      />

      <Toaster />
    </div>
  );
}
