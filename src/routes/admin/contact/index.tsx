import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { ContactBanner } from "@/components/contact/ContactBanner";
import { ContactTabs, type ContactTabId } from "@/components/contact/ContactTabs";
import { GeneralHeroTab } from "@/components/contact/tabs/GeneralHeroTab";
import { ContactInfoTab } from "@/components/contact/tabs/ContactInfoTab";
import { SocialLinksTab } from "@/components/contact/tabs/SocialLinksTab";
import { HighlightsTab } from "@/components/contact/tabs/HighlightsTab";
import { FaqsTab } from "@/components/contact/tabs/FaqsTab";
import { FormSettingsTab } from "@/components/contact/tabs/FormSettingsTab";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { adminClient } from "@/lib/api/admin-client";
import { AlertTriangle } from "lucide-react";
import { useContactConfig } from "@/lib/contact-store";
import type { UpdateContactConfigPayload } from "@/lib/server/contact-operations";

export const Route = createFileRoute("/admin/contact/")({
  staleTime: 0,
  shouldReload: true,
  loader: async () => {
    const res = await adminClient.getAdminContactConfig();
    return {
      initialContactData: res.success && res.data ? res.data : null,
      loadError: res.success ? null : (res.error || "Failed to load contact configuration from server"),
    };
  },
  head: () => ({
    meta: [
      { title: "Contact Page Management — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content:
          "Manage public contact page content, contact information, social links, FAQs, and form settings.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContactManagementPage,
});

function ContactManagementPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { initialContactData, loadError } = Route.useLoaderData();
  const { config, initializeFromServer, resetConfigToDefault } = useContactConfig();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ContactTabId>("general");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Authentication Guard
  useAuthGuard();

  // Load server state on initial load
  useEffect(() => {
    if (initialContactData) {
      initializeFromServer(initialContactData);
    }
  }, [initialContactData]);

  const handleSaveAll = async () => {
    if (loadError) {
      toast.error("Saving is disabled: failed to load server configuration. Please retry connection to avoid overwriting saved data.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: UpdateContactConfigPayload = {
        hero: {
          heroSectionNumber: config.hero.sectionNumber,
          heroSectionLabel: config.hero.sectionLabel,
          heroTitle: config.hero.mainHeading,
          heroHighlightHeading: config.hero.highlightHeading,
          heroDescription: config.hero.description,
          heroKeywords: config.hero.keywords.map((k) => k.text),
          heroBackgroundAssetId: config.hero.backgroundImageId || null,
        },
        seo: {
          seoPageTitle: config.seo.pageTitle,
          seoMetaDescription: config.seo.metaDescription,
        },
        contactInfo: {
          email: config.contactInfo.email,
          emailDescription: config.contactInfo.emailDescription,
          phone: config.contactInfo.phone,
          businessHours: config.contactInfo.businessHours,
          location: config.contactInfo.location,
          locationDescription: config.contactInfo.locationDescription,
        },
        formSettings: {
          formTitle: config.formSettings.heading,
          formSubtitle: config.formSettings.description,
          subjectOptions: config.formSettings.subjectOptions,
          formSubmitButtonText: config.formSettings.submitButtonText,
          formSuccessMessage: config.formSettings.successMessage,
          formErrorMessage: config.formSettings.errorMessage,
          enableFaqSection: config.formSettings.enableFaqSection ?? true,
          enableHighlights: config.formSettings.enableHighlights ?? true,
        },
        highlights: config.highlights.map((h, idx) => ({
          id: h.id,
          title: h.title,
          description: h.description,
          iconName: h.icon,
          accentColor: (h.accent?.toUpperCase() as any) || "EMERALD",
          displayOrder: idx,
          isEnabled: h.isActive,
        })),
        faqs: config.faqs.map((f, idx) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          iconName: f.icon,
          displayOrder: idx,
          isEnabled: f.isActive,
        })),
        socialLinks: config.socialLinks.map((s, idx) => ({
          id: s.id,
          platform: s.platform,
          label: s.label,
          url: s.url,
          iconName: s.icon,
          displayOrder: idx,
          isEnabled: s.enabled,
        })),
      };

      const res = await adminClient.updateAdminContactConfig(payload);
      if (res.success && res.data) {
        initializeFromServer(res.data);
        setHasUnsavedChanges(false);
        toast.success("Contact page content & configuration saved successfully.");
        await router.invalidate();
      } else {
        toast.error(res.error || "Failed to save contact configuration.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save contact configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (loadError) {
      toast.error("Cannot reset: server data is currently unavailable. Please retry connection.");
      return;
    }
    if (initialContactData) {
      initializeFromServer(initialContactData);
      setHasUnsavedChanges(false);
      toast.info("Restored saved database configuration.");
    } else {
      resetConfigToDefault();
      setHasUnsavedChanges(true);
      toast.info("Restored default configuration.");
    }
  };

  const handleMarkDirty = () => {
    setHasUnsavedChanges(true);
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
          searchPlaceholder="Search contact settings, hero content, FAQs, social channels..."
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Error Alert Banner when Server Load Fails */}
        {loadError && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-red-500/40 bg-red-950/40 text-red-200 text-[13px] backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="size-5 text-red-400 shrink-0" />
              <div>
                <p className="font-semibold text-red-300">Server Data Read Failure</p>
                <p className="text-[12px] text-red-400/90">{loadError}. Editing and saving are disabled to prevent overwriting existing data.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.invalidate()}
              className="px-3.5 py-1.5 rounded-lg border border-red-400/40 bg-red-900/60 hover:bg-red-900/90 text-[12px] font-semibold text-white cursor-pointer self-start sm:self-auto transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Contact Banner */}
        <ContactBanner
          onSave={handleSaveAll}
          onReset={handleReset}
          isSaving={isSaving || !!loadError}
          hasUnsavedChanges={hasUnsavedChanges && !loadError}
        />

        {/* Section Navigation Tabs */}
        <ContactTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content Area */}
        <div className="pt-1">
          {activeTab === "general" && <GeneralHeroTab onMarkDirty={handleMarkDirty} />}
          {activeTab === "info" && <ContactInfoTab onMarkDirty={handleMarkDirty} />}
          {activeTab === "social" && <SocialLinksTab onMarkDirty={handleMarkDirty} />}
          {activeTab === "highlights" && <HighlightsTab onMarkDirty={handleMarkDirty} />}
          {activeTab === "faqs" && <FaqsTab onMarkDirty={handleMarkDirty} />}
          {activeTab === "form" && <FormSettingsTab onMarkDirty={handleMarkDirty} />}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
