import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { HomepageBanner } from "@/components/homepage/HomepageBanner";
import { HomepageStats } from "@/components/homepage/HomepageStats";
import { HomepageSectionsList } from "@/components/homepage/HomepageSectionsList";
import { HomepagePreview } from "@/components/homepage/HomepagePreview";
import { HomepageEditor } from "@/components/homepage/HomepageEditor";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { adminClient } from "@/lib/api/admin-client";
import { type HomepageSectionWithMedia } from "@/lib/server/homepage-operations";
import { useAuthGuard } from "@/lib/auth/use-auth";

export const Route = createFileRoute("/admin/homepage")({
  staleTime: 0,
  shouldReload: true,
  loader: async () => {
    const res = await adminClient.listAdminHomepageSections();
    return {
      initialSections: res.success && res.data ? res.data : [],
    };
  },
  head: () => ({
    meta: [
      { title: "Homepage Manager — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content: "Manage and customize your website homepage content, sections and settings.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomepageManagerPage,
});

function HomepageManagerPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { initialSections } = Route.useLoaderData();

  // Authentication Guard
  useAuthGuard();

  // Sections state initialized from database
  const [sections, setSections] = useState<HomepageSectionWithMedia[]>(initialSections);
  const [activeId, setActiveId] = useState<string>(
    initialSections[0]?.id || "sec-hero"
  );
  const [draftState, setDraftState] = useState<{
    id: string;
    draft: Partial<HomepageSectionWithMedia> & { mediaPreviewUrl?: string | null };
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTargetSection, setDeleteTargetSection] = useState<HomepageSectionWithMedia | null>(null);

  useEffect(() => {
    if (initialSections) {
      setSections(initialSections);
      if (initialSections.length > 0 && !initialSections.some((s) => s.id === activeId)) {
        setActiveId(initialSections[0]!.id);
      }
    }
  }, [initialSections]);

  const activeSection = sections.find((s) => s.id === activeId) || sections[0] || {
    id: "sec-hero",
    name: "Hero Banner",
    iconName: "Home",
    enabled: true,
    displayOrder: 1,
    title: "CobraLearn Innotechcore",
    subtitle: "Your trusted partner in digital innovation.",
    badge: "LEARN • BUILD • GROW",
    primaryButtonLabel: "Scroll Down",
    primaryButtonLink: "#projects",
    secondaryButtonLabel: null,
    secondaryButtonLink: null,
    mediaAssetId: null,
    updatedAt: new Date(),
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.subtitle.toLowerCase().includes(q)
    );
  }, [sections, searchQuery]);

  const publishedStatus = sections.every((s) => s.enabled)
    ? "All Live"
    : `${sections.filter((s) => s.enabled).length}/${sections.length} Live`;

  const lastUpdated = "Today";

  const handleToggleEnabled = async (id: string) => {
    const current = sections.find((s) => s.id === id);
    if (!current) return;

    const newEnabled = !current.enabled;
    const previous = [...sections];
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: newEnabled } : s))
    );

    const res = await adminClient.updateAdminHomepageSection(id, {
      enabled: newEnabled,
    });

    if (res.success && res.data) {
      toast.success(
        `Section "${current.name}" is now ${newEnabled ? "enabled" : "disabled"}.`
      );
      await router.invalidate();
    } else {
      setSections(previous);
      toast.error(res.error || "Failed to update section visibility");
    }
  };

  const handleUpdateSection = async (updated: HomepageSectionWithMedia) => {
    const previous = [...sections];
    setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setDraftState(null);

    const res = await adminClient.updateAdminHomepageSection(updated.id, {
      title: updated.title,
      subtitle: updated.subtitle,
      badge: updated.badge || undefined,
      primaryButtonLabel: updated.primaryButtonLabel || undefined,
      primaryButtonLink: updated.primaryButtonLink || undefined,
      secondaryButtonLabel: updated.secondaryButtonLabel || undefined,
      secondaryButtonLink: updated.secondaryButtonLink || undefined,
      mediaAssetId: updated.mediaAssetId || null,
    });

    if (res.success && res.data) {
      setSections((prev) =>
        prev.map((s) => (s.id === updated.id ? res.data! : s))
      );
      toast.success(`Saved changes for "${updated.name}".`);
      await router.invalidate();
    } else {
      setSections(previous);
      toast.error(res.error || "Failed to save section changes");
    }
  };

  const handleAddSection = async () => {
    const defaultName = `Custom Section ${sections.length + 1}`;
    const res = await adminClient.createAdminHomepageSection({
      name: defaultName,
      title: "New Headline",
      subtitle: "Add engaging details about this section.",
      iconName: "Sparkles",
      enabled: true,
      badge: "FEATURED",
      primaryButtonLabel: "Learn More",
      primaryButtonLink: "#",
    });

    if (res.success && res.data) {
      setSections((prev) => [...prev, res.data!]);
      setActiveId(res.data.id);
      toast.success(`Created section "${defaultName}".`);
      await router.invalidate();
    } else {
      toast.error(res.error || "Failed to create section");
    }
  };

  const handleMove = async (id: string, direction: "up" | "down") => {
    const index = sections.findIndex((s) => s.id === id);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved!);

    setSections(reordered);
    const orderedIds = reordered.map((s) => s.id);
    const res = await adminClient.reorderAdminHomepageSections(orderedIds);
    if (res.success) {
      toast.success("Section reordered.");
      await router.invalidate();
    } else {
      toast.error(res.error || "Failed to persist ordering");
    }
  };

  const handleDeleteSection = (id: string) => {
    const target = sections.find((s) => s.id === id);
    if (target) {
      setDeleteTargetSection(target);
    }
  };

  const handleConfirmDeleteSection = async () => {
    if (!deleteTargetSection) return;
    const id = deleteTargetSection.id;
    const previous = [...sections];

    setSections((prev) => prev.filter((s) => s.id !== id));
    const res = await adminClient.deleteAdminHomepageSection(id);
    if (res.success) {
      if (activeId === id) {
        const remaining = sections.filter((s) => s.id !== id);
        setActiveId(remaining[0]?.id || "");
      }
      toast.success(`Deleted section "${deleteTargetSection.name}"`);
      await router.invalidate();
    } else {
      setSections(previous);
      toast.error(res.error || "Failed to delete section");
    }
    setDeleteTargetSection(null);
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
          searchPlaceholder="Search pages, sections, content..."
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Homepage Banner */}
        <HomepageBanner />

        {/* Statistics Cards */}
        <HomepageStats
          totalSections={sections.length}
          status={publishedStatus}
          lastUpdated={lastUpdated}
          onAddSection={handleAddSection}
        />

        {/* Main Vertical Single-Column Flow */}
        <div className="space-y-4">
          {/* 3. Homepage Sections */}
          <HomepageSectionsList
            sections={filteredSections}
            activeId={activeId}
            onSelectSection={(id) => {
              setActiveId(id);
              setDraftState(null);
            }}
            onToggleEnabled={handleToggleEnabled}
            onMoveUp={(id) => handleMove(id, "up")}
            onMoveDown={(id) => handleMove(id, "down")}
            onDeleteSection={handleDeleteSection}
          />

          {/* 4. Homepage Preview */}
          <HomepagePreview
            sections={sections.map((s) => (draftState && draftState.id === s.id ? { ...s, ...draftState.draft } : s))}
            activeSectionId={activeSection.id}
            isDraft={Boolean(draftState && draftState.id === activeSection.id)}
          />

          {/* 5. Edit Section */}
          <HomepageEditor
            key={activeSection.id}
            section={activeSection}
            onDraftChange={(draft) => setDraftState({ id: activeSection.id, draft })}
            onUpdateSection={handleUpdateSection}
            onReset={() => setDraftState(null)}
          />
        </div>
      </main>

      {/* Delete Confirmation Modal for Custom Homepage Section */}
      <DeleteConfirmationModal
        open={Boolean(deleteTargetSection)}
        onOpenChange={(open) => !open && setDeleteTargetSection(null)}
        onConfirm={handleConfirmDeleteSection}
        itemType="Homepage Section"
        itemName={deleteTargetSection?.name}
        itemDescription={`Title: "${deleteTargetSection?.title || ""}"`}
        itemStatus={deleteTargetSection?.enabled ? "Active" : "Inactive"}
      />

      <Toaster />
    </div>
  );
}
