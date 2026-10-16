import { useState, useEffect, useRef } from "react";
import {
  Bell,
  Terminal,
  Shield,
  UserCheck,
  Mail,
  Tag,
  Sliders,
  Monitor,
  Sun,
  Moon,
  Globe,
  Save,
  RotateCcw,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";
import { adminClient } from "@/lib/api/admin-client";
import {
  type ThemeOption,
  type AccentOption,
  type LanguageOption,
  type TimezoneOption,
  SUPPORTED_THEMES,
  SUPPORTED_ACCENTS,
  SUPPORTED_LANGUAGES,
  SUPPORTED_TIMEZONES,
  DEFAULT_ADMIN_PREFERENCES,
  mergeWithDefaultPreferences,
} from "@/lib/preferences";

export { type ThemeOption };

export interface AccentColor {
  id: string;
  name: string;
  hex: string;
}

const ACCENT_COLORS: AccentColor[] = [
  { id: "emerald", name: "Neon Emerald", hex: "#00FF87" },
  { id: "cyan", name: "Cyber Cyan", hex: "#00E5FF" },
  { id: "purple", name: "Electric Purple", hex: "#A855F7" },
  { id: "orange", name: "Solar Orange", hex: "#F97316" },
  { id: "red", name: "Crimson Red", hex: "#EF4444" },
  { id: "blue", name: "Cobalt Blue", hex: "#3B82F6" },
];

export function PreferencesTab() {
  const { profile } = useAdminProfile();
  const { t } = useAdminAppearance();
  const isInitializedRef = useRef(false);

  // Notification Preferences State (5 toggles)
  const [systemAnnouncements, setSystemAnnouncements] = useState<boolean>(
    DEFAULT_ADMIN_PREFERENCES.notifications.systemAnnouncements
  );
  const [securityAlerts, setSecurityAlerts] = useState<boolean>(
    DEFAULT_ADMIN_PREFERENCES.notifications.securityAlerts
  );
  const [adminActivities, setAdminActivities] = useState<boolean>(
    DEFAULT_ADMIN_PREFERENCES.notifications.adminActivities
  );
  const [contactInquiries, setContactInquiries] = useState<boolean>(
    DEFAULT_ADMIN_PREFERENCES.notifications.contactInquiries
  );
  const [marketingUpdates, setMarketingUpdates] = useState<boolean>(
    DEFAULT_ADMIN_PREFERENCES.notifications.marketingUpdates
  );

  // Appearance Preferences State
  const [theme, setTheme] = useState<ThemeOption>(DEFAULT_ADMIN_PREFERENCES.portal.theme);
  const [selectedAccent, setSelectedAccent] = useState<string>(
    DEFAULT_ADMIN_PREFERENCES.portal.selectedAccent
  );
  const [sidebarCollapse, setSidebarCollapse] = useState<boolean>(
    DEFAULT_ADMIN_PREFERENCES.portal.sidebarCollapse
  );

  // Language & Region State
  const [language, setLanguage] = useState<string>(DEFAULT_ADMIN_PREFERENCES.portal.language);
  const [timezone, setTimezone] = useState<string>(DEFAULT_ADMIN_PREFERENCES.portal.timezone);

  const [isSaving, setIsSaving] = useState(false);

  // Load preferences from PostgreSQL or safely migrate legacy localStorage on first visit
  useEffect(() => {
    // 1. If DB profile preferences exist, DB is authoritative!
    if (profile?.preferences) {
      const prefs = mergeWithDefaultPreferences(profile.preferences);
      setSystemAnnouncements(prefs.notifications.systemAnnouncements);
      setSecurityAlerts(prefs.notifications.securityAlerts);
      setAdminActivities(prefs.notifications.adminActivities);
      setContactInquiries(prefs.notifications.contactInquiries);
      setMarketingUpdates(prefs.notifications.marketingUpdates);

      setTheme(prefs.portal.theme);
      setSelectedAccent(prefs.portal.selectedAccent);
      setSidebarCollapse(prefs.portal.sidebarCollapse);
      setLanguage(prefs.portal.language);
      setTimezone(prefs.portal.timezone);

      // Remove un-scoped legacy key to prevent leaks between admins
      try {
        localStorage.removeItem("cobralearn_admin_preferences");
      } catch {}
      isInitializedRef.current = true;
      return;
    }

    // 2. If DB has no preferences yet, check for legacy localStorage to migrate
    if (!isInitializedRef.current && (profile || typeof window !== "undefined")) {
      try {
        const legacySaved = localStorage.getItem("cobralearn_admin_preferences");
        if (legacySaved) {
          const parsed = JSON.parse(legacySaved);
          const migrated = mergeWithDefaultPreferences(parsed);
          setSystemAnnouncements(migrated.notifications.systemAnnouncements);
          setSecurityAlerts(migrated.notifications.securityAlerts);
          setAdminActivities(migrated.notifications.adminActivities);
          setContactInquiries(migrated.notifications.contactInquiries);
          setMarketingUpdates(migrated.notifications.marketingUpdates);

          setTheme(migrated.portal.theme);
          setSelectedAccent(migrated.portal.selectedAccent);
          setSidebarCollapse(migrated.portal.sidebarCollapse);
          setLanguage(migrated.portal.language);
          setTimezone(migrated.portal.timezone);
        }
      } catch {}
      if (profile) {
        isInitializedRef.current = true;
      }
    }
  }, [profile]);

  const handleSave = async () => {
    setIsSaving(true);
    const payload = {
      notifications: {
        systemAnnouncements,
        securityAlerts,
        adminActivities,
        contactInquiries,
        marketingUpdates,
      },
      portal: {
        theme: theme as ThemeOption,
        selectedAccent: selectedAccent as AccentOption,
        sidebarCollapse,
        language: language as LanguageOption,
        timezone: timezone as TimezoneOption,
      },
    };

    try {
      const res = await adminClient.updateSelfPreferences(payload);
      if (res.success && res.data) {
        // Remove legacy un-scoped key upon successful DB sync
        try {
          localStorage.removeItem("cobralearn_admin_preferences");
        } catch {}

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("admin-profile-updated", { detail: res.data.profile })
          );
        }
        toast.success("Preferences saved successfully.");
      } else {
        toast.error(res.error || "Failed to save preferences.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save preferences.";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setSystemAnnouncements(DEFAULT_ADMIN_PREFERENCES.notifications.systemAnnouncements);
    setSecurityAlerts(DEFAULT_ADMIN_PREFERENCES.notifications.securityAlerts);
    setAdminActivities(DEFAULT_ADMIN_PREFERENCES.notifications.adminActivities);
    setContactInquiries(DEFAULT_ADMIN_PREFERENCES.notifications.contactInquiries);
    setMarketingUpdates(DEFAULT_ADMIN_PREFERENCES.notifications.marketingUpdates);

    setTheme(DEFAULT_ADMIN_PREFERENCES.portal.theme);
    setSelectedAccent(DEFAULT_ADMIN_PREFERENCES.portal.selectedAccent);
    setSidebarCollapse(DEFAULT_ADMIN_PREFERENCES.portal.sidebarCollapse);
    setLanguage(DEFAULT_ADMIN_PREFERENCES.portal.language);
    setTimezone(DEFAULT_ADMIN_PREFERENCES.portal.timezone);

    try {
      localStorage.removeItem("cobralearn_admin_preferences");
    } catch {}

    setIsSaving(true);
    try {
      const res = await adminClient.updateSelfPreferences(DEFAULT_ADMIN_PREFERENCES);
      if (res.success && res.data) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("admin-profile-updated", { detail: res.data.profile })
          );
        }
        toast.info("Preferences restored to default.");
      } else {
        toast.error(res.error || "Failed to reset preferences in database.");
      }
    } catch {
      toast.info("Preferences restored to default locally.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 pt-1">
      {/* 1. NOTIFICATION PREFERENCES CARD */}
      <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
            <Bell className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-foreground text-glow">{t("pref.notificationSettings")}</h3>
            <p className="text-[12px] text-muted-foreground">Choose what notifications you want to receive.</p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-brand/10 text-[12.5px]">
          {/* Row 1: System Announcements */}
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-bright">
                <Terminal className="size-4" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{t("pref.systemAnnouncements")}</p>
                <p className="text-[11.5px] text-muted-foreground">Important updates about the platform</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSystemAnnouncements(!systemAnnouncements)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                systemAnnouncements ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  systemAnnouncements ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Row 2: Security Alerts */}
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-bright">
                <Shield className="size-4" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{t("pref.securityAlerts")}</p>
                <p className="text-[11.5px] text-muted-foreground">Login attempts, password changes, security updates</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSecurityAlerts(!securityAlerts)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                securityAlerts ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  securityAlerts ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Row 3: Admin Activities */}
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-bright">
                <UserCheck className="size-4" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{t("pref.adminActivities")}</p>
                <p className="text-[11.5px] text-muted-foreground">Updates about content changes, new registrations</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAdminActivities(!adminActivities)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                adminActivities ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  adminActivities ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Row 4: Contact Inquiries */}
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-bright">
                <Mail className="size-4" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{t("pref.contactInquiries")}</p>
                <p className="text-[11.5px] text-muted-foreground">New contact form submissions</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setContactInquiries(!contactInquiries)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                contactInquiries ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  contactInquiries ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Row 5: Marketing & Product Updates */}
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-bright">
                <Tag className="size-4" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{t("pref.marketingUpdates")}</p>
                <p className="text-[11.5px] text-muted-foreground">New features, webinars, and platform news</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMarketingUpdates(!marketingUpdates)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                marketingUpdates ? "bg-brand-bright" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  marketingUpdates ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 2. APPEARANCE PREFERENCES CARD */}
      <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
            <Sliders className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-foreground text-glow">{t("pref.appearanceSettings")}</h3>
            <p className="text-[12px] text-muted-foreground">Customize the appearance of your admin portal.</p>
          </div>
        </div>

        {/* Sub-section: Theme */}
        <div className="mt-5 space-y-2">
          <label className="text-[12px] font-semibold text-foreground">{t("pref.theme")}</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Dark */}
            <div
              className="flex items-start justify-between rounded-xl border p-3.5 border-brand-bright bg-brand/10 shadow-[0_0_15px_rgba(0,255,170,0.18)]"
            >
              <div className="flex items-start gap-2.5">
                <Moon className="size-4.5 mt-0.5 text-brand-bright" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-foreground">Dark</p>
                    <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-semibold text-brand-bright border border-brand/30">
                      Standard
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Branded dark theme optimized for CobraLearn</p>
                </div>
              </div>
              <div
                className="size-3 rounded-full border border-brand-bright bg-brand-bright"
              />
            </div>
          </div>
        </div>

        {/* Sub-section: Accent Color */}
        <div className="mt-5 space-y-2">
          <label className="text-[12px] font-semibold text-foreground">{t("pref.accent")}</label>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {ACCENT_COLORS.map((col) => {
              const isSelected = selectedAccent === col.id;

              return (
                <button
                  key={col.id}
                  type="button"
                  title={col.name}
                  onClick={() => setSelectedAccent(col.id)}
                  style={{ backgroundColor: col.hex }}
                  className={`size-7 rounded-full transition-transform hover:scale-110 cursor-pointer flex items-center justify-center ${
                    isSelected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "opacity-80"
                  }`}
                >
                  {isSelected && <Check className="size-3.5 text-black stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-section: Sidebar Collapse */}
        <div className="mt-5 flex items-center justify-between border-t border-brand/10 pt-4">
          <div>
            <p className="text-[13px] font-bold text-foreground">{t("pref.sidebar")}</p>
            <p className="text-[11.5px] text-muted-foreground">Keep sidebar collapsed by default</p>
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapse(!sidebarCollapse)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              sidebarCollapse ? "bg-brand-bright" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                sidebarCollapse ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 3. LANGUAGE & REGION CARD */}
      <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
            <Globe className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-foreground text-glow">{t("pref.regionSettings")}</h3>
            <p className="text-[12px] text-muted-foreground">Configure your language and regional settings.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Language Dropdown */}
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">{t("pref.language")}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/80 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none cursor-pointer"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi (हिन्दी)</option>
              <option value="Spanish">Spanish (Español)</option>
              <option value="French">French (Français)</option>
              <option value="German">German (Deutsch)</option>
            </select>
          </div>

          {/* Timezone Dropdown */}
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">{t("pref.timezone")}</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/80 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none cursor-pointer"
            >
              <option value="(GMT+5:30) Asia/Kolkata">(GMT+5:30) Asia/Kolkata</option>
              <option value="(GMT+0:00) UTC">(GMT+0:00) UTC</option>
              <option value="(GMT-5:00) America/New_York">(GMT-5:00) America/New_York</option>
              <option value="(GMT-8:00) America/Los_Angeles">(GMT-8:00) America/Los_Angeles</option>
              <option value="(GMT+0:00) Europe/London">(GMT+0:00) Europe/London</option>
              <option value="(GMT+8:00) Asia/Singapore">(GMT+8:00) Asia/Singapore</option>
              <option value="(GMT+9:00) Asia/Tokyo">(GMT+9:00) Asia/Tokyo</option>
            </select>
          </div>
        </div>

        <p className="mt-3 text-[11.5px] text-muted-foreground">
          These settings affect the display language and time-related information in the admin portal.
        </p>
      </div>

      {/* Bottom Actions Bar */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-brand/25 bg-background/60 px-4 py-2 text-[13px] font-medium text-foreground/80 transition hover:border-brand-bright/50 hover:text-foreground hover:bg-background/90 cursor-pointer flex items-center gap-1.5"
        >
          <RotateCcw className="size-3.5" />
          <span>{t("pref.resetBtn")}</span>
        </button>

        <button
          type="button"
          disabled={isSaving}
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
              <span>{t("pref.saveBtn")}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
