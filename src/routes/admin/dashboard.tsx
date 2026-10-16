import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { DashboardWelcome } from "@/components/dashboard/DashboardWelcome";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity, RecentAdvertisements, RecentAwards, RecentProjects } from "@/components/dashboard/RecentSections";
import { StatCard } from "@/components/dashboard/StatCard";
import { WebsiteStatus } from "@/components/dashboard/WebsiteStatus";
import { SignOutModal } from "@/components/modals/SignOutModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { authService } from "@/lib/auth/auth-service";
import { useDashboardData } from "@/lib/dashboard/use-dashboard-data";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CobraLearn Innotechcore Admin" },
      { name: "description", content: "Overview of CobraLearn showcase projects, websites, advertisements and awards." },
      { property: "og:title", content: "Dashboard — CobraLearn Innotechcore Admin" },
      { property: "og:description", content: "Manage CobraLearn showcase content from one dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const guardResult = useAuthGuard();
  const authLoading = guardResult?.isLoading ?? false;
  const isEligibleAdmin = guardResult ? guardResult.isEligibleAdmin : true;

  const { t } = useAdminAppearance();
  const { data: dashboardData, isLoading, error, refetch } = useDashboardData();

  if (authLoading || !isEligibleAdmin) {
    return (
      <div className="dash-bg flex min-h-screen w-full items-center justify-center">
        <div className="flex items-center gap-2.5 rounded-xl border border-brand/25 bg-panel/60 px-4 py-2.5 text-xs text-brand-bright">
          <span className="size-2 animate-ping rounded-full bg-brand-bright" />
          <span>Verifying administrator authorization...</span>
        </div>
      </div>
    );
  }

  const handleSignOutConfirm = async () => {
    await authService.signOut();
    setSignOutOpen(false);
    navigate({ to: "/admin" });
  };

  const statCards = [
    {
      key: "projects" as const,
      title: t("nav.projects"),
      value: dashboardData?.stats.projects.total ?? 0,
      delta: dashboardData?.stats.projects.delta ?? 0,
      published: dashboardData?.stats.projects.published ?? 0,
      draft: dashboardData?.stats.projects.draft ?? 0,
      comparisonText: dashboardData?.stats.projects.comparisonText,
      accent: "amber" as const,
    },
    {
      key: "websites" as const,
      title: t("nav.websites"),
      value: dashboardData?.stats.websites.total ?? 0,
      delta: dashboardData?.stats.websites.delta ?? 0,
      published: dashboardData?.stats.websites.published ?? 0,
      draft: dashboardData?.stats.websites.draft ?? 0,
      comparisonText: dashboardData?.stats.websites.comparisonText,
      accent: "green" as const,
    },
    {
      key: "ads" as const,
      title: t("nav.advertisements"),
      value: dashboardData?.stats.advertisements.total ?? 0,
      delta: dashboardData?.stats.advertisements.delta ?? 0,
      published: dashboardData?.stats.advertisements.published ?? 0,
      draft: dashboardData?.stats.advertisements.draft ?? 0,
      comparisonText: dashboardData?.stats.advertisements.comparisonText,
      accent: "red" as const,
    },
    {
      key: "awards" as const,
      title: t("nav.awards"),
      value: dashboardData?.stats.awards.total ?? 0,
      delta: dashboardData?.stats.awards.delta ?? 0,
      published: dashboardData?.stats.awards.published ?? 0,
      draft: dashboardData?.stats.awards.draft ?? 0,
      comparisonText: dashboardData?.stats.awards.comparisonText,
      accent: "gold" as const,
    },
  ];

  return (
    <div className="dash-bg flex min-h-screen w-full">
      <div data-sidebar-wrapper className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <AdminSidebar onLogoutClick={() => setSignOutOpen(true)} />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[268px] border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AdminSidebar
            onNavigate={() => setOpen(false)}
            onLogoutClick={() => {
              setOpen(false);
              setSignOutOpen(true);
            }}
          />
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-6">
        <AdminHeader onMenu={() => setOpen(true)} />
        <DashboardWelcome />

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-destructive/35 bg-destructive/15 px-4 py-3 text-sm text-destructive">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/20 px-3 py-1 text-xs font-semibold text-destructive transition hover:bg-destructive/30"
            >
              <RefreshCw className="size-3" /> {t("common.retryConnection")}
            </button>
          </div>
        )}

        {isLoading && !dashboardData && (
          <div className="flex items-center gap-2.5 rounded-xl border border-brand/25 bg-panel/60 px-4 py-2.5 text-xs text-brand-bright">
            <span className="size-2 animate-ping rounded-full bg-brand-bright" />
            {t("common.loadingLiveMetrics")}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((s) => (
            <StatCard
              key={s.key}
              k={s.key}
              title={s.title}
              value={s.value}
              delta={s.delta}
              published={s.published}
              draft={s.draft}
              comparisonText={s.comparisonText}
              accent={s.accent}
            />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
          <WebsiteStatus
            siteUrl={dashboardData?.websiteStatus.siteUrl}
            statusLabel={dashboardData?.websiteStatus.statusLabel}
            statusSubtext={dashboardData?.websiteStatus.statusSubtext}
            lastUpdatedText={dashboardData?.websiteStatus.lastUpdatedText}
            mediaSummaryText={dashboardData?.mediaStats.formattedText}
            isLoading={isLoading && !dashboardData}
            isError={Boolean(error && !dashboardData)}
          />
          <QuickActions />
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.58fr_1.2fr]">
          <RecentActivity items={dashboardData?.recentActivity} />
          <div className="space-y-4">
            <RecentProjects items={dashboardData?.recentProjects} />
            <div className="grid gap-4 md:grid-cols-2">
              <RecentAdvertisements items={dashboardData?.recentAdvertisements} />
              <RecentAwards items={dashboardData?.recentAwards} />
            </div>
          </div>
        </div>
      </main>
      <SignOutModal
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        onConfirm={handleSignOutConfirm}
        onCancel={() => setSignOutOpen(false)}
      />
      <Toaster />
    </div>
  );
}

