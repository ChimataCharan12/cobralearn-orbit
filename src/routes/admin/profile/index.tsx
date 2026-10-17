import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { ProfileBanner } from "@/components/profile/ProfileBanner";
import { ProfileTabs, type ProfileTabId } from "@/components/profile/ProfileTabs";
import { ProfileInfoCard, type ProfileFormData } from "@/components/profile/ProfileInfoCard";
import { NotificationPreferencesCard } from "@/components/profile/NotificationPreferencesCard";
import { AccountOverviewCard } from "@/components/profile/AccountOverviewCard";
import { AccountActionsCard } from "@/components/profile/AccountActionsCard";
import { DangerZoneCard } from "@/components/profile/DangerZoneCard";
import { SecurityTab } from "@/components/profile/SecurityTab";
import { PreferencesTab } from "@/components/profile/PreferencesTab";
import { ActivitySessionsTab } from "@/components/profile/ActivitySessionsTab";
import { LoginHistoryTab } from "@/components/profile/LoginHistoryTab";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";

import {
  type AdminPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  mergeWithDefaultPreferences,
} from "@/lib/preferences";

export interface ProfilePageFormData extends ProfileFormData {
  notifications: {
    emailNotifications: boolean;
    contentUpdates: boolean;
    securityAlerts: boolean;
    systemAnnouncements: boolean;
  };
}

export const Route = createFileRoute("/admin/profile/")({
  head: () => ({
    meta: [
      { title: "Admin Profile — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content: "View and manage your admin account details, preferences and security settings.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminProfilePage,
});

function AdminProfilePage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ProfileTabId>("profile-info");

  // Authentication Guard (strictly disallows quarantined admins; redirects to /admin/mfa-recovery)
  useAuthGuard("/admin", false);

  // Load real PostgreSQL AdminProfile
  const { profile, isLoading, isSaving, error, reloadProfile, updateProfile, uploadAvatar } = useAdminProfile();

  // Local form buffer state
  const [formData, setFormData] = useState<ProfilePageFormData>({
    fullName: "",
    phone: "",
    designation: "",
    bio: "",
    avatarUrl: null,
    notifications: {
      emailNotifications: DEFAULT_NOTIFICATION_PREFERENCES.emailNotifications,
      contentUpdates: DEFAULT_NOTIFICATION_PREFERENCES.contentUpdates,
      securityAlerts: DEFAULT_NOTIFICATION_PREFERENCES.securityAlerts,
      systemAnnouncements: DEFAULT_NOTIFICATION_PREFERENCES.systemAnnouncements,
    },
  });

  // Populate form with real database values once loaded
  useEffect(() => {
    if (profile) {
      const prefs = mergeWithDefaultPreferences(profile.preferences);
      setFormData({
        fullName: profile.fullName || "",
        phone: profile.phone || "",
        designation: profile.designation || "",
        bio: profile.bio || "",
        avatarUrl: profile.avatarUrl || null,
        notifications: {
          emailNotifications: prefs.notifications.emailNotifications,
          contentUpdates: prefs.notifications.contentUpdates,
          securityAlerts: prefs.notifications.securityAlerts,
          systemAnnouncements: prefs.notifications.systemAnnouncements,
        },
      });
    }
  }, [profile]);

  const handleFormChange = (updates: Partial<ProfileFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    if (!formData.fullName.trim()) {
      toast.error("Full Name cannot be empty.");
      return;
    }

    await updateProfile({
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim() || null,
      designation: formData.designation.trim() || null,
      bio: formData.bio.trim() || null,
      avatarUrl: formData.avatarUrl,
      preferences: {
        notifications: formData.notifications,
      },
    });
  };

  const handleDiscard = () => {
    if (profile) {
      const prefs = mergeWithDefaultPreferences(profile.preferences);
      setFormData({
        fullName: profile.fullName || "",
        phone: profile.phone || "",
        designation: profile.designation || "",
        bio: profile.bio || "",
        avatarUrl: profile.avatarUrl || null,
        notifications: {
          emailNotifications: prefs.notifications.emailNotifications,
          contentUpdates: prefs.notifications.contentUpdates,
          securityAlerts: prefs.notifications.securityAlerts,
          systemAnnouncements: prefs.notifications.systemAnnouncements,
        },
      });
    }
    toast.info("Changes discarded. Restored saved profile values.");
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
          searchPlaceholder="Search settings, profile, account, security..."
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Profile Banner */}
        <ProfileBanner />

        {/* Profile Tabs Bar */}
        <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* TAB 1: Profile Information (2-Column Grid) */}
        {activeTab === "profile-info" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
            {/* Left Column: Form & Preferences */}
            <div className="space-y-4">
              <ProfileInfoCard
                profile={profile}
                isLoading={isLoading}
                error={error}
                onRetry={reloadProfile}
                formData={formData}
                onChange={handleFormChange}
                onUploadAvatar={uploadAvatar}
                onRemoveAvatar={() => updateProfile({ avatarUrl: null })}
              />
              <NotificationPreferencesCard
                values={formData.notifications}
                onChange={(updates) => {
                  setFormData((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, ...updates },
                  }));
                }}
                disabled={isSaving || isLoading}
              />

              {/* Bottom Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSaving || isLoading}
                  onClick={handleDiscard}
                  className="rounded-lg border border-brand/25 bg-background/60 px-4 py-2 text-[13px] font-medium text-foreground/80 transition hover:border-brand-bright/50 hover:text-foreground hover:bg-background/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Discard Changes
                </button>

                <button
                  type="button"
                  disabled={isSaving || isLoading}
                  onClick={handleSave}
                  className="flex items-center gap-1.5 rounded-lg border border-brand-bright/80 bg-gradient-to-r from-brand to-brand-bright px-5 py-2 text-[13px] font-bold text-background shadow-[0_0_18px_rgba(0,255,170,0.35)] transition-all hover:brightness-110 hover:shadow-[0_0_24px_rgba(0,255,170,0.5)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Account Overview, Actions, Danger Zone */}
            <div className="space-y-4">
              <AccountOverviewCard profile={profile} />
              <AccountActionsCard onTabChange={setActiveTab} />
              <DangerZoneCard />
            </div>
          </div>
        )}

        {/* TAB 2: Security */}
        {activeTab === "security" && <SecurityTab />}

        {/* TAB 3: Preferences */}
        {activeTab === "preferences" && <PreferencesTab />}

        {/* TAB 4: Activity & Sessions */}
        {activeTab === "activity-sessions" && <ActivitySessionsTab currentProfileId={profile?.id} />}

        {/* TAB 5: Login History */}
        {activeTab === "login-history" && <LoginHistoryTab currentProfileId={profile?.id} />}
      </main>

      <Toaster />
    </div>
  );
}
