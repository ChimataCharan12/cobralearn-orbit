import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { AppearanceBanner } from "@/components/appearance/AppearanceBanner";
import { AppearanceTabs, type AppearanceTabId } from "@/components/appearance/AppearanceTabs";
import { ThemeColorsTab } from "@/components/appearance/tabs/ThemeColorsTab";
import { TypographyTab } from "@/components/appearance/tabs/TypographyTab";
import { ComponentsTab } from "@/components/appearance/tabs/ComponentsTab";
import { AnimationsTab } from "@/components/appearance/tabs/AnimationsTab";
import { BackgroundsEffectsTab } from "@/components/appearance/tabs/BackgroundsEffectsTab";
import { LayoutResponsiveTab } from "@/components/appearance/tabs/LayoutResponsiveTab";
import { BrandingTab } from "@/components/appearance/tabs/BrandingTab";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import { canPerform, AdminPermissions } from "@/lib/auth/rbac";
import { AppearanceProvider, useAppearance } from "@/lib/theme/appearance-context";
import { Loader2, AlertCircle, RefreshCw, Check, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/admin/appearance")({
  head: () => ({
    meta: [
      { title: "Appearance & Animation — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content: "Customize the look, feel and animations of your CobraLearn website.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppearancePageWrapper,
});

function AppearancePageWrapper() {
  return (
    <AppearanceProvider>
      <AppearancePage />
    </AppearanceProvider>
  );
}

function AppearancePage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<AppearanceTabId>("theme-colors");

  // Authentication & RBAC Governance
  useAuthGuard();
  const { profile } = useAdminProfile();
  const canUpdateAppearance = profile?.role
    ? canPerform(profile.role, AdminPermissions.APPEARANCE_UPDATE)
    : false;

  const {
    isLoading,
    loadError,
    reload,
    hasUnsavedChanges,
    isSaving,
    saveChanges,
    resetToSaved,
  } = useAppearance();

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
          searchPlaceholder="Search appearance settings, themes, animations..."
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Appearance Banner */}
        <AppearanceBanner />

        {/* Global Loading / Error / Unsaved Bar */}
        {isLoading ? (
          <div className="flex items-center gap-3 rounded-xl border border-brand/20 bg-panel/80 p-4 text-[13px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-brand-bright" />
            <span>Loading persistent appearance configuration from database...</span>
          </div>
        ) : loadError ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-[13px] text-red-300">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="size-4 text-red-400 shrink-0" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => reload()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1 text-[12px] font-medium text-red-200 transition hover:bg-red-500/20"
            >
              <RefreshCw className="size-3" />
              Retry
            </button>
          </div>
        ) : null}

        {/* Persistent Changes Action Floating / Sticky Banner */}
        {hasUnsavedChanges && !isLoading && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-bright/40 bg-panel-strong/95 p-3.5 shadow-[0_0_16px_rgba(0,255,170,0.18)]">
            <div className="flex items-center gap-2 text-[12.5px] text-foreground">
              <span className="size-2 rounded-full bg-brand-bright animate-pulse" />
              <span>You have unsaved appearance edits. Changes are preserved across tabs until saved.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetToSaved}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-background/60 px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:border-brand-bright hover:text-brand-bright disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" />
                Discard Edits
              </button>
              {canUpdateAppearance ? (
                <button
                  type="button"
                  onClick={() => saveChanges()}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-bright/50 bg-brand-bright/20 px-4 py-1.5 text-[12px] font-semibold text-brand-bright shadow-[0_0_12px_rgba(0,255,170,0.25)] transition hover:bg-brand-bright/30 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      Save All Changes
                    </>
                  )}
                </button>
              ) : (
                <span className="text-[11.5px] text-amber-400 font-medium px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
                  Read-Only Role
                </span>
              )}
            </div>
          </div>
        )}

        {/* RBAC Read-Only Notice for non-authorized roles (EDITOR) */}
        {profile && !canUpdateAppearance && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-[12.5px] text-amber-300">
            <span className="font-semibold uppercase tracking-wider text-[11px] rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">
              Read-Only
            </span>
            <span>
              Your role (<strong>{profile.role}</strong>) has read-only access. Modifying appearance settings requires <strong>ADMIN</strong> or <strong>SUPER_ADMIN</strong> permissions.
            </span>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <AppearanceTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Single-Column Spacious Tab Content */}
        <div className="pt-1">
          {activeTab === "theme-colors" && <ThemeColorsTab />}
          {activeTab === "typography" && <TypographyTab />}
          {activeTab === "components" && <ComponentsTab />}
          {activeTab === "animations" && <AnimationsTab />}
          {activeTab === "backgrounds-effects" && <BackgroundsEffectsTab />}
          {activeTab === "layout-responsive" && <LayoutResponsiveTab />}
          {activeTab === "branding" && <BrandingTab />}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
