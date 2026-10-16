import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { SettingsBanner } from "@/components/settings/SettingsBanner";
import { SettingsTabs, type SettingsTabId } from "@/components/settings/SettingsTabs";
import { GeneralTab } from "@/components/settings/tabs/GeneralTab";
import { SeoMetaTab } from "@/components/settings/tabs/SeoMetaTab";
import { IntegrationsTab } from "@/components/settings/tabs/IntegrationsTab";
import { EmailNotificationsTab } from "@/components/settings/tabs/EmailNotificationsTab";
import { SecurityTab } from "@/components/settings/tabs/SecurityTab";
import { AnalyticsTab } from "@/components/settings/tabs/AnalyticsTab";
import { MaintenanceTab } from "@/components/settings/tabs/MaintenanceTab";
import { AdvancedTab } from "@/components/settings/tabs/AdvancedTab";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import { SiteSettingsProvider, useSiteSettings } from "@/lib/site-settings-context";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Site Settings — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content: "Configure your website's general settings, integrations and preferences.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SiteSettingsPage,
});

export function SiteSettingsPage() {
  return (
    <SiteSettingsProvider>
      <SiteSettingsContent />
    </SiteSettingsProvider>
  );
}

function SiteSettingsContent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");

  // Authentication & RBAC Governance
  useAuthGuard();
  const { profile } = useAdminProfile();
  const {
    isLoading,
    loadError,
    retryLoad,
    isSaving,
    canUpdateSettings,
    saveSettings,
    resetSettings,
    hasUnsavedChanges,
  } = useSiteSettings();

  const handleSave = async () => {
    if (!canUpdateSettings) {
      toast.error("Forbidden: Modifying site configuration requires SUPER_ADMIN permissions.");
      return;
    }
    await saveSettings();
  };

  const handleReset = () => {
    resetSettings();
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
          searchPlaceholder="Search site settings, configuration, integrations..."
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Site Settings Banner */}
        <SettingsBanner />

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2.5 rounded-xl border border-brand/20 bg-brand/5 px-4 py-2.5 text-[12px] text-brand-bright">
            <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-brand-bright border-t-transparent" />
            <span>Loading persisted site settings...</span>
          </div>
        )}

        {/* Load Error Banner with Retry */}
        {loadError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[12.5px] text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>Failed to load persisted settings: {loadError}</span>
            </div>
            <button
              type="button"
              onClick={retryLoad}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/20 px-3 py-1 text-[11.5px] font-medium text-destructive-foreground hover:bg-destructive/30"
            >
              <RefreshCw className="size-3" />
              Retry
            </button>
          </div>
        )}

        {/* RBAC Read-Only Notice for non-SUPER_ADMIN */}
        {profile && !canUpdateSettings && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-[12.5px] text-amber-300">
            <span className="font-semibold uppercase tracking-wider text-[11px] rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">
              Read-Only
            </span>
            <span>
              Your role (<strong>{profile.role}</strong>) has read-only access. Modifying site configuration requires <strong>SUPER_ADMIN</strong> permissions.
            </span>
          </div>
        )}

        {/* Settings Tabs */}
        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Single-Column Tab Content Area */}
        <div className="pt-1">
          {activeTab === "general" && <GeneralTab />}
          {activeTab === "seo" && <SeoMetaTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "email" && <EmailNotificationsTab />}
          {activeTab === "security" && <SecurityTab />}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "maintenance" && <MaintenanceTab />}
          {activeTab === "advanced" && <AdvancedTab />}
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving || !canUpdateSettings || !hasUnsavedChanges}
            className="rounded-lg border border-brand/25 bg-background/60 px-4 py-2 text-[13px] font-medium text-foreground/80 transition hover:border-brand-bright/50 hover:text-foreground hover:bg-background/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset Changes
          </button>

          <button
            type="button"
            disabled={isSaving || !canUpdateSettings}
            title={!canUpdateSettings ? "Requires SUPER_ADMIN permissions" : undefined}
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg border border-brand-bright/80 bg-gradient-to-r from-brand to-brand-bright px-5 py-2 text-[13px] font-bold text-background shadow-[0_0_18px_rgba(0,255,170,0.35)] transition-all hover:brightness-110 hover:shadow-[0_0_24px_rgba(0,255,170,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isSaving ? "Saving..." : !canUpdateSettings ? "Read-Only (SUPER_ADMIN Only)" : "Save Changes"}</span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      </main>

      <Toaster />
    </div>
  );
}
