import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import type { NavigationItem, GlobalSocialLink } from "@prisma/client";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { NavigationBanner } from "@/components/navigation/NavigationBanner";
import { NavigationStats } from "@/components/navigation/NavigationStats";
import { NavigationMenuTable } from "@/components/navigation/NavigationMenuTable";
import { NavigationPreview } from "@/components/navigation/NavigationPreview";
import { MenuItemEditor } from "@/components/navigation/MenuItemEditor";
import { FooterSectionsManager } from "@/components/navigation/FooterSectionsManager";
import { FooterSectionModal } from "@/components/navigation/FooterSectionModal";
import { SocialLinksManager } from "@/components/navigation/SocialLinksManager";
import { FooterPreview } from "@/components/navigation/FooterPreview";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import {
  type NavigationMenuItem,
  type FooterSectionItem,
} from "@/lib/navigation-data";
import { adminClient } from "@/lib/api/admin-client";
import { type FooterSectionWithLinks } from "@/lib/server/navigation-operations";
import { useAuthGuard } from "@/lib/auth/use-auth";

function mapDbToMenuItem(item: NavigationItem): NavigationMenuItem {
  return {
    id: item.id,
    order: item.displayOrder,
    label: item.label,
    link: item.link,
    type: item.type === "BUTTON" ? "Button" : item.type === "EXTERNAL" ? "External" : "Internal",
    status: item.status === "INACTIVE" ? "Inactive" : "Active",
    iconName: item.iconName || undefined,
    openInNewTab: item.openInNewTab,
    buttonStyle: (item.buttonStyle as any) || undefined,
  };
}

export const Route = createFileRoute("/admin/navigation")({
  staleTime: 0,
  shouldReload: true,
  loader: async () => {
    const res = await adminClient.listAdminNavigation();
    return {
      initialNavItems: res.success && res.data ? res.data.navItems : [],
      initialFooterSections: res.success && res.data ? res.data.footerSections : [],
      initialSocialLinks: res.success && res.data ? res.data.socialLinks : [],
    };
  },
  head: () => ({
    meta: [
      { title: "Navigation & Footer — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content: "Manage the main navigation menu and footer content for your website.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NavigationFooterPage,
});

function NavigationFooterPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { initialNavItems, initialFooterSections, initialSocialLinks } = Route.useLoaderData();

  // Authentication Guard
  useAuthGuard();

  // Navigation Items State
  const [navItems, setNavItems] = useState<NavigationMenuItem[]>(() =>
    initialNavItems.map(mapDbToMenuItem)
  );
  const [selectedNavId, setSelectedNavId] = useState<string>(
    initialNavItems[0]?.id || "nav-1"
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Footer Sections State
  const [footerSections, setFooterSections] = useState<FooterSectionWithLinks[]>(initialFooterSections);
  const [socialLinks, setSocialLinks] = useState<GlobalSocialLink[]>(initialSocialLinks);

  // Footer Modal State
  const [footerModalOpen, setFooterModalOpen] = useState(false);
  const [editingFooterSection, setEditingFooterSection] = useState<FooterSectionWithLinks | null>(null);

  // Deletion States
  const [deleteTargetNavItem, setDeleteTargetNavItem] = useState<NavigationMenuItem | null>(null);
  const [deleteTargetFooterSection, setDeleteTargetFooterSection] = useState<FooterSectionWithLinks | null>(null);

  useEffect(() => {
    if (initialNavItems) {
      setNavItems(initialNavItems.map(mapDbToMenuItem));
      if (initialNavItems.length > 0 && !initialNavItems.some((i) => i.id === selectedNavId)) {
        setSelectedNavId(initialNavItems[0]!.id);
      }
    }
  }, [initialNavItems]);

  useEffect(() => {
    if (initialFooterSections) {
      setFooterSections(initialFooterSections);
    }
  }, [initialFooterSections]);

  useEffect(() => {
    if (initialSocialLinks) {
      setSocialLinks(initialSocialLinks);
    }
  }, [initialSocialLinks]);

  // Search filtering
  const filteredNavItems = useMemo(() => {
    if (!searchQuery.trim()) return navItems;
    const q = searchQuery.toLowerCase();
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.link.toLowerCase().includes(q)
    );
  }, [navItems, searchQuery]);

  const filteredFooterSections = useMemo(() => {
    if (!searchQuery.trim()) return footerSections;
    const q = searchQuery.toLowerCase();
    return footerSections.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.links?.some(
          (l) =>
            l.label.toLowerCase().includes(q) || l.url.toLowerCase().includes(q)
        )
    );
  }, [footerSections, searchQuery]);

  const filteredSocialLinks = useMemo(() => {
    if (!searchQuery.trim()) return socialLinks;
    const q = searchQuery.toLowerCase();
    return socialLinks.filter(
      (l) =>
        l.platform.toLowerCase().includes(q) || l.url.toLowerCase().includes(q)
    );
  }, [socialLinks, searchQuery]);

  const selectedNavItem =
    navItems.find((item) => item.id === selectedNavId) || navItems[0];

  const totalFooterLinks = footerSections.reduce(
    (acc, sec) => acc + (sec.links?.length || 0),
    0
  );

  // Reorder Navigation Items
  const handleMoveNav = async (id: string, direction: "up" | "down") => {
    const currentIndex = navItems.findIndex((item) => item.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= navItems.length) return;

    const previousItems = [...navItems];
    const newItems = [...navItems];
    const [moved] = newItems.splice(currentIndex, 1);
    newItems.splice(targetIndex, 0, moved!);

    // Optimistically update
    setNavItems(newItems);

    const orderedIds = newItems.map((i) => i.id);
    const res = await adminClient.reorderAdminNavItems(orderedIds);
    if (!res.success) {
      setNavItems(previousItems);
      toast.error(res.error || "Failed to reorder navigation items");
    } else {
      toast.success("Navigation order updated");
      await router.invalidate();
    }
  };

  const handleSaveNavItem = async (updated: NavigationMenuItem) => {
    const previousItems = [...navItems];
    setNavItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

    const res = await adminClient.updateAdminNavItem(updated.id, {
      label: updated.label,
      link: updated.link,
      type: updated.type,
      status: updated.status,
      iconName: updated.iconName || null,
      openInNewTab: Boolean(updated.openInNewTab),
      buttonStyle: updated.buttonStyle || null,
    });

    if (!res.success) {
      setNavItems(previousItems);
      toast.error(res.error || "Failed to save navigation item");
    } else {
      toast.success(`Saved menu item "${updated.label}"`);
      await router.invalidate();
    }
  };

  const handleAddNavItem = async () => {
    const defaultLabel = `New Item ${navItems.length + 1}`;
    const res = await adminClient.createAdminNavItem({
      label: defaultLabel,
      link: "/new-page",
      type: "Internal",
      status: "Active",
      iconName: "Home",
      openInNewTab: false,
    });

    if (!res.success || !res.data) {
      toast.error(res.error || "Failed to add navigation item");
      return;
    }

    const newItem = mapDbToMenuItem(res.data);
    setNavItems((prev) => [...prev, newItem]);
    setSelectedNavId(newItem.id);
    toast.success(`Added navigation item "${newItem.label}"`);
    await router.invalidate();
  };

  const handleDeleteNavItem = (id: string) => {
    const target = navItems.find((item) => item.id === id);
    if (target) {
      setDeleteTargetNavItem(target);
    }
  };

  const handleConfirmDeleteNavItem = async () => {
    if (!deleteTargetNavItem) return;
    const targetId = deleteTargetNavItem.id;
    const previousItems = [...navItems];

    setNavItems((prev) => prev.filter((item) => item.id !== targetId));

    const res = await adminClient.deleteAdminNavItem(targetId);
    if (!res.success) {
      setNavItems(previousItems);
      toast.error(res.error || "Failed to delete navigation item");
    } else {
      toast.success(`Deleted navigation item "${deleteTargetNavItem.label}"`);
      await router.invalidate();
    }
    setDeleteTargetNavItem(null);
  };

  // Footer Sections Actions
  const handleOpenAddFooterSection = () => {
    setEditingFooterSection(null);
    setFooterModalOpen(true);
  };

  const handleOpenEditFooterSection = (section: FooterSectionWithLinks) => {
    setEditingFooterSection(section);
    setFooterModalOpen(true);
  };

  const handleMoveFooterSection = async (id: string, direction: "up" | "down") => {
    const currentIndex = footerSections.findIndex((s) => s.id === id);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= footerSections.length) return;

    const previous = [...footerSections];
    const updated = [...footerSections];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved!);

    setFooterSections(updated);
    const res = await adminClient.reorderAdminFooterSections(updated.map((s) => s.id));
    if (!res.success) {
      setFooterSections(previous);
      toast.error(res.error || "Failed to reorder footer sections");
    } else {
      toast.success("Footer sections order updated");
      await router.invalidate();
    }
  };

  const handleSaveFooterSection = async (payload: {
    id?: string;
    title: string;
    iconName?: string | null;
    isVisible?: boolean;
    links: Array<{ label: string; url: string; openInNewTab?: boolean }>;
  }) => {
    if (payload.id) {
      // Update existing
      const res = await adminClient.updateAdminFooterSection(payload.id, {
        title: payload.title,
        iconName: payload.iconName,
        isVisible: payload.isVisible,
        links: payload.links,
      });

      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to update footer section");
        return;
      }

      setFooterSections((prev) =>
        prev.map((s) => (s.id === payload.id ? res.data! : s))
      );
      toast.success(`Updated footer section "${payload.title}"`);
      await router.invalidate();
    } else {
      // Create new
      const res = await adminClient.createAdminFooterSection({
        title: payload.title,
        iconName: payload.iconName,
        isVisible: payload.isVisible,
        links: payload.links,
      });

      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to create footer section");
        return;
      }

      setFooterSections((prev) => [...prev, res.data!]);
      toast.success(`Created footer section "${payload.title}"`);
      await router.invalidate();
    }
    setFooterModalOpen(false);
    setEditingFooterSection(null);
  };

  const handleDeleteFooterSection = (id: string) => {
    const section = footerSections.find((s) => s.id === id);
    if (section) {
      setDeleteTargetFooterSection(section);
    }
  };

  const handleConfirmDeleteFooterSection = async () => {
    if (!deleteTargetFooterSection) return;
    const targetId = deleteTargetFooterSection.id;
    const previous = [...footerSections];

    setFooterSections((prev) => prev.filter((s) => s.id !== targetId));

    const res = await adminClient.deleteAdminFooterSection(targetId);
    if (!res.success) {
      setFooterSections(previous);
      toast.error(res.error || "Failed to delete footer section");
    } else {
      toast.success(`Removed footer section "${deleteTargetFooterSection.title}"`);
      await router.invalidate();
    }
    setDeleteTargetFooterSection(null);
  };

  // Social Links Handlers
  const handleAddSocialLink = async (payload: {
    platform: string;
    url: string;
    iconName?: string;
    handle?: string;
    isEnabled?: boolean;
  }) => {
    const res = await adminClient.createAdminSocialLink(payload);
    if (!res.success || !res.data) {
      toast.error(res.error || "Failed to add social link");
      throw new Error(res.error || "Failed to add social link");
    }
    setSocialLinks((prev) => [...prev, res.data!]);
    toast.success(`Added social link "${payload.platform}"`);
    await router.invalidate();
  };

  const handleUpdateSocialLink = async (
    id: string,
    payload: {
      platform?: string;
      url?: string;
      iconName?: string;
      handle?: string;
      isEnabled?: boolean;
    }
  ) => {
    const previous = [...socialLinks];
    setSocialLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...payload } : l))
    );
    const res = await adminClient.updateAdminSocialLink(id, payload);
    if (!res.success || !res.data) {
      setSocialLinks(previous);
      toast.error(res.error || "Failed to update social link");
      throw new Error(res.error || "Failed to update social link");
    }
    setSocialLinks((prev) => prev.map((l) => (l.id === id ? res.data! : l)));
    toast.success(`Updated social link "${res.data.platform}"`);
    await router.invalidate();
  };

  const handleDeleteSocialLink = async (id: string) => {
    const previous = [...socialLinks];
    setSocialLinks((prev) => prev.filter((l) => l.id !== id));
    const res = await adminClient.deleteAdminSocialLink(id);
    if (!res.success) {
      setSocialLinks(previous);
      toast.error(res.error || "Failed to delete social link");
    } else {
      toast.success("Social link deleted");
      await router.invalidate();
    }
  };

  const handleReorderSocialLinks = async (orderedIds: string[]) => {
    const previous = [...socialLinks];
    const reordered = orderedIds
      .map((id) => socialLinks.find((l) => l.id === id)!)
      .filter(Boolean);
    setSocialLinks(reordered);
    const res = await adminClient.reorderAdminSocialLinks(orderedIds);
    if (!res.success) {
      setSocialLinks(previous);
      toast.error(res.error || "Failed to reorder social links");
    } else {
      toast.success("Social links order updated");
      await router.invalidate();
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
          searchPlaceholder="Search navigation items, footer links, sections..."
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Navigation & Footer Banner */}
        <NavigationBanner />

        {/* Statistics Cards */}
        <NavigationStats
          navLinksCount={navItems.length}
          footerSectionsCount={footerSections.length}
          footerLinksCount={totalFooterLinks}
          status="Published"
        />

        {/* Main Vertical Single-Column Flow */}
        <div className="space-y-4">
          {/* 1. Navigation Menu */}
          <NavigationMenuTable
            items={filteredNavItems}
            selectedId={selectedNavId}
            onSelectItem={(item) => setSelectedNavId(item.id)}
            onAddItem={handleAddNavItem}
            onDeleteItem={handleDeleteNavItem}
            onMoveUp={(id) => handleMoveNav(id, "up")}
            onMoveDown={(id) => handleMoveNav(id, "down")}
          />

          {/* 2. Menu Item Editor */}
          {selectedNavItem && (
            <MenuItemEditor
              key={selectedNavItem.id}
              item={selectedNavItem}
              onSave={handleSaveNavItem}
              onCancel={() => {}}
            />
          )}

          {/* 3. Navigation Preview */}
          <NavigationPreview items={navItems} />

          {/* 4. Footer Content */}
          <FooterSectionsManager
            sections={filteredFooterSections}
            onAddSection={handleOpenAddFooterSection}
            onEditSection={handleOpenEditFooterSection}
            onDeleteSection={handleDeleteFooterSection}
            onMoveSection={handleMoveFooterSection}
          />

          {/* 5. Global Social Links */}
          <SocialLinksManager
            links={filteredSocialLinks}
            onAdd={handleAddSocialLink}
            onUpdate={handleUpdateSocialLink}
            onDelete={handleDeleteSocialLink}
            onReorder={handleReorderSocialLinks}
          />

          {/* 6. Footer Preview */}
          <FooterPreview sections={footerSections} socialLinks={socialLinks} />
        </div>
      </main>

      {/* Footer Section Edit/Add Modal */}
      <FooterSectionModal
        open={footerModalOpen}
        onOpenChange={setFooterModalOpen}
        section={editingFooterSection}
        onSave={handleSaveFooterSection}
      />

      {/* Delete Confirmation Modal for Navigation Item */}
      <DeleteConfirmationModal
        open={Boolean(deleteTargetNavItem)}
        onOpenChange={(open) => !open && setDeleteTargetNavItem(null)}
        onConfirm={handleConfirmDeleteNavItem}
        itemType="Navigation Item"
        itemName={deleteTargetNavItem?.label}
        itemDescription={`Route link: ${deleteTargetNavItem?.link || ""} (${deleteTargetNavItem?.type || "Internal"})`}
        itemStatus={deleteTargetNavItem?.status}
      />

      {/* Delete Confirmation Modal for Footer Section */}
      <DeleteConfirmationModal
        open={Boolean(deleteTargetFooterSection)}
        onOpenChange={(open) => !open && setDeleteTargetFooterSection(null)}
        onConfirm={handleConfirmDeleteFooterSection}
        itemType="Footer Section"
        itemName={deleteTargetFooterSection?.title}
        itemDescription={`Contains ${deleteTargetFooterSection?.links?.length || 0} footer links`}
        itemStatus={`${deleteTargetFooterSection?.links?.length || 0} Links`}
        itemBadgeVariant="cyan"
      />

      <Toaster />
    </div>
  );
}
