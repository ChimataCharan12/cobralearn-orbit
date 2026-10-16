import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Filter,
  Layers,
  Mail,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { useAdminNotifications } from "@/lib/notifications/use-admin-notifications";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";
import type { AdminNotification } from "@prisma/client";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content: "View and manage in-app notifications, contact inquiries, and security alerts.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

type FilterCategory = "ALL" | "UNREAD" | "CONTACT_INQUIRY" | "CONTENT_UPDATE" | "SECURITY_ALERT" | "ADMIN_ACTIVITY" | "SYSTEM_ANNOUNCEMENT";

function getCategoryMeta(category: string, t: (k: any) => string) {
  switch (category) {
    case "CONTACT_INQUIRY":
      return {
        label: t("notif.category.contactInquiry"),
        icon: Mail,
        colorClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
      };
    case "CONTENT_UPDATE":
      return {
        label: t("notif.category.contentUpdate"),
        icon: Layers,
        colorClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      };
    case "SECURITY_ALERT":
      return {
        label: t("notif.category.securityAlert"),
        icon: ShieldAlert,
        colorClass: "bg-red-500/15 text-red-400 border-red-500/30",
      };
    case "ADMIN_ACTIVITY":
      return {
        label: t("notif.category.adminActivity"),
        icon: UserCheck,
        colorClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
      };
    case "SYSTEM_ANNOUNCEMENT":
    default:
      return {
        label: t("notif.category.announcement"),
        icon: Megaphone,
        colorClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      };
  }
}

function NotificationsPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useAuthGuard();

  const isServerCategory =
    selectedFilter !== "ALL" && selectedFilter !== "UNREAD";

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch,
    markAsRead,
    markAllAsRead,
  } = useAdminNotifications({
    category: isServerCategory ? selectedFilter : undefined,
    pollIntervalMs: 30000,
  });

  const { t, formatRelativeTime } = useAdminAppearance();

  // Client-side filtering for UNREAD or search query
  const displayedNotifications = notifications.filter((notif) => {
    if (selectedFilter === "UNREAD" && notif.isRead) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = notif.title.toLowerCase().includes(q);
      const matchMsg = notif.message.toLowerCase().includes(q);
      const matchCat = notif.category.toLowerCase().includes(q);
      return matchTitle || matchMsg || matchCat;
    }
    return true;
  });

  const handleNotificationClick = async (notif: AdminNotification) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    if (notif.link) {
      navigate({ to: notif.link });
    }
  };

  const filterTabs: { id: FilterCategory; label: string; icon?: any }[] = [
    { id: "ALL", label: t("notif.filterAll") },
    { id: "UNREAD", label: t("notif.filterUnread") },
    { id: "CONTACT_INQUIRY", label: t("notif.category.contactInquiry"), icon: Mail },
    { id: "CONTENT_UPDATE", label: t("notif.category.contentUpdate"), icon: Layers },
    { id: "SECURITY_ALERT", label: t("notif.category.securityAlert"), icon: ShieldAlert },
    { id: "ADMIN_ACTIVITY", label: t("notif.category.adminActivity"), icon: UserCheck },
  ];

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
          searchPlaceholder={t("header.searchPlaceholder")}
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Page Banner / Header Card */}
        <div className="card-interactive relative overflow-hidden rounded-xl border border-brand/25 bg-panel-strong/80 p-6 backdrop-blur-xl shadow-xl">
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="grid size-12 place-items-center rounded-xl bg-brand/12 border border-brand/30 text-brand-bright shadow-[0_0_15px_rgba(0,255,170,0.2)]">
                <Bell className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-display text-xl font-bold tracking-tight text-foreground text-glow">
                    {t("notif.pageTitle")}
                  </h1>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground shadow-[0_0_8px_var(--color-destructive)]">
                      {unreadCount} {t("notif.unreadBadge")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                  {t("notif.pageDesc")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-background/60 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-brand/10 transition cursor-pointer"
                title={t("common.refresh")}
              >
                <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{t("common.refresh")}</span>
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-gradient-to-r from-brand/20 to-brand-bright/10 px-4 py-2 text-xs font-semibold text-brand-bright hover:brightness-110 shadow-[0_0_12px_rgba(0,255,170,0.15)] transition cursor-pointer"
                >
                  <CheckCheck className="size-4" />
                  <span>{t("notif.markAllRead")}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-brand/15 pb-2 text-xs font-medium scrollbar-none">
          {filterTabs.map((tab) => {
            const isActive = selectedFilter === tab.id;
            const TabIcon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border border-brand-bright/70 bg-gradient-to-r from-brand/25 to-brand-bright/15 text-brand-bright shadow-[0_0_12px_rgba(0,255,170,0.2)] font-semibold"
                    : "border border-transparent text-muted-foreground hover:border-brand/30 hover:bg-brand/10 hover:text-foreground"
                }`}
              >
                {TabIcon && <TabIcon className="size-3.5 shrink-0" />}
                <span>{tab.label}</span>
                {tab.id === "UNREAD" && unreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-destructive/80 px-1.5 py-0.2 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notifications List Card */}
        <div className="rounded-xl border border-brand/20 bg-panel/90 shadow-xl backdrop-blur-md overflow-hidden">
          {isLoading && notifications.length === 0 ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="size-10 rounded-xl bg-brand/10 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-1/4 rounded bg-brand/15" />
                    <div className="h-3 w-3/4 rounded bg-brand/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 px-4 py-2 text-xs font-semibold text-brand-bright hover:bg-brand/10 cursor-pointer"
              >
                <RefreshCw className="size-3.5" /> {t("notif.retry")}
              </button>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="p-14 text-center space-y-3">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand/10 text-brand-bright border border-brand/20 shadow-[0_0_16px_rgba(0,255,170,0.12)]">
                <Bell className="size-6" />
              </div>
              <p className="font-display text-base font-semibold text-foreground">
                {selectedFilter !== "ALL" ? t("notif.emptyFilterTitle") : t("notif.emptyTitle")}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {selectedFilter !== "ALL" ? t("notif.emptyFilterDesc") : t("notif.emptyDesc")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-brand/10">
              {displayedNotifications.map((notif) => {
                const meta = getCategoryMeta(notif.category, t);
                const CategoryIcon = meta.icon;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`group relative flex items-start gap-4 p-4 transition-colors cursor-pointer hover:bg-brand/8 ${
                      !notif.isRead ? "bg-brand/4" : "opacity-85"
                    }`}
                  >
                    {/* Category Icon */}
                    <div
                      className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border text-sm ${meta.colorClass}`}
                    >
                      <CategoryIcon className="size-5" />
                    </div>

                    {/* Notification Content */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border bg-panel text-muted-foreground">
                          {meta.label}
                        </span>
                        {!notif.isRead && (
                          <span className="rounded-full bg-brand/20 px-2 py-0.2 text-[10.5px] font-semibold text-brand-bright border border-brand/30">
                            {t("notif.unreadBadge")}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      <h3
                        className={`text-sm font-semibold leading-snug text-foreground ${
                          !notif.isRead ? "text-glow" : ""
                        }`}
                      >
                        {notif.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {notif.message}
                      </p>

                      {notif.link && (
                        <div className="pt-1">
                          <span className="inline-flex items-center gap-1 text-xs text-brand-bright font-medium hover:underline">
                            {t("notif.viewDetails")} <ExternalLink className="size-3" />
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Unread Action */}
                    {!notif.isRead ? (
                      <button
                        type="button"
                        title={t("notif.markAsRead")}
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notif.id);
                        }}
                        className="mt-1 flex items-center justify-center size-7 rounded-lg border border-brand/20 text-muted-foreground hover:border-brand-bright hover:text-brand-bright hover:bg-brand/10 transition cursor-pointer shrink-0"
                      >
                        <Check className="size-3.5" />
                      </button>
                    ) : (
                      <div className="mt-1 size-7 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Toaster position="bottom-right" richColors />
    </div>
  );
}
