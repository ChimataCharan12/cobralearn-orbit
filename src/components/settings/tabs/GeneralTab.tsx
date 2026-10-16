import { useState } from "react";
import {
  Globe,
  Mail,
  Phone,
  MapPin,
  Clock,
  Linkedin,
  Twitter,
  Instagram,
  Youtube,
  Github,
  Facebook,
  ExternalLink,
  Plus,
  Trash2,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { SettingRow } from "@/components/common/settings/SettingRow";
import logoImg from "@/assets/settings-logo-preview.png";
import favImg from "@/assets/settings-fav-preview.png";
import { useSiteSettings } from "@/lib/site-settings-context";

interface SocialLinkItem {
  id: string;
  platform: string;
  url: string;
  icon: any;
  color: string;
}

export function GeneralTab() {
  const {
    draft,
    updateDraft,
    isSaving,
    canUpdateSettings,
  } = useSiteSettings();

  // Social Links (Managed by Navigation module; preserved as local preview in this tab)
  const [socialLinks, setSocialLinks] = useState<SocialLinkItem[]>([
    { id: "li", platform: "LinkedIn", url: "https://www.linkedin.com/company/cobralearn", icon: Linkedin, color: "#0077b5" },
    { id: "x", platform: "X (Twitter)", url: "https://twitter.com/cobralearn", icon: Twitter, color: "#ffffff" },
    { id: "ig", platform: "Instagram", url: "https://instagram.com/cobralearn", icon: Instagram, color: "#E1306C" },
    { id: "yt", platform: "YouTube", url: "https://youtube.com/@cobralearn", icon: Youtube, color: "#FF0000" },
    { id: "gh", platform: "GitHub", url: "https://github.com/cobralearn", icon: Github, color: "#f0f6fc" },
    { id: "fb", platform: "Facebook", url: "https://facebook.com/cobralearn", icon: Facebook, color: "#1877f2" },
  ]);

  // Country (local UI display preference)
  const [country, setCountry] = useState("India");

  const handleUpdateSocial = (id: string, url: string) => {
    setSocialLinks((prev) => prev.map((s) => (s.id === id ? { ...s, url } : s)));
  };

  const handleRemoveSocial = (id: string) => {
    setSocialLinks((prev) => prev.filter((s) => s.id !== id));
    toast.info("Removed local preview link. Centralized social sync is scheduled for Version 2.");
  };

  const handleAddSocial = () => {
    const platform = prompt("Enter social platform name (e.g. Discord, TikTok, Dribbble):");
    if (!platform) return;
    const url = prompt("Enter profile URL:") || "https://";
    const newId = `social_${Date.now()}`;
    setSocialLinks((prev) => [
      ...prev,
      { id: newId, platform, url, icon: Globe, color: "#00f5a7" },
    ]);
    toast.info(`Added local preview for ${platform}. Centralized social sync is scheduled for Version 2.`);
  };

  return (
    <div className="space-y-4">
      {/* Tab Header */}
      <div className="rounded-xl border border-brand/20 bg-panel/80 p-4">
        <h2 className="font-display text-[17px] font-bold text-foreground text-glow flex items-center gap-2">
          <Globe className="size-4 text-brand-bright" />
          General Site Information & Contact
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          Basic website identity, contact channels, public social networks, and regional localization.
        </p>
      </div>

      {/* 1. Site Information */}
      <SettingsCard
        title="Site Information"
        description="Public site identifiers, branding assets, and official URL."
        badge="Identity"
      >
        <SettingRow
          label="Site Name"
          description="The primary name of your website displayed in titles and navigation."
          required
        >
          <input
            type="text"
            value={draft.siteName}
            disabled={!canUpdateSettings || isSaving}
            onChange={(e) => updateDraft("siteName", e.target.value)}
            className="w-full sm:w-96 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
          />
        </SettingRow>

        <SettingRow
          label="Site Tagline"
          description="A short memorable motto summarizing your value proposition."
        >
          <input
            type="text"
            value={draft.tagline}
            disabled={!canUpdateSettings || isSaving}
            onChange={(e) => updateDraft("tagline", e.target.value)}
            className="w-full sm:w-96 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
          />
        </SettingRow>

        <SettingRow
          label="Site Description"
          description="Comprehensive description used by search engines and page footers."
        >
          <div className="w-full">
            <textarea
              rows={3}
              value={draft.siteDescription}
              disabled={!canUpdateSettings || isSaving}
              onChange={(e) => updateDraft("siteDescription", e.target.value)}
              className="w-full rounded-lg border border-brand/20 bg-background/70 p-3 text-[12px] text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
            />
            <span className="text-[10px] text-muted-foreground mt-0.5 block text-right font-mono">
              {draft.siteDescription.length}/1000 chars
            </span>
          </div>
        </SettingRow>

        <SettingRow
          label="Canonical Website URL"
          description="The primary production domain protocol and host name."
          required
        >
          <input
            type="text"
            value={draft.siteUrl}
            disabled={!canUpdateSettings || isSaving}
            onChange={(e) => updateDraft("siteUrl", e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
          />
        </SettingRow>

        {/* Site Logo & Favicon Assets */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-brand/10">
          <div className="rounded-xl border border-brand/20 bg-background/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-foreground">Official Site Logo</span>
              <span className="rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 text-[9.5px] font-medium text-brand-bright">
                Coming Soon — Version 2
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex h-16 w-32 items-center justify-center rounded-lg border border-brand/25 bg-background/70 p-1.5">
                <img src={logoImg} alt="Site Logo" className="max-h-full max-w-full object-contain" />
              </div>
              <button
                type="button"
                onClick={() => toast.info("Site logo upload will connect to Media Library in Version 2.")}
                className="flex items-center gap-1.5 rounded-md border border-brand/35 bg-brand/15 px-3 py-1.5 text-[11px] font-medium text-brand-bright hover:bg-brand/25"
              >
                <ImageIcon className="size-3.5" />
                Change Logo
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-brand/20 bg-background/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-foreground">Site Favicon</span>
              <span className="rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 text-[9.5px] font-medium text-brand-bright">
                Coming Soon — Version 2
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex size-12 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-background/70 p-1">
                <img src={favImg} alt="Site Favicon" className="size-6 object-contain" />
              </div>
              <button
                type="button"
                onClick={() => toast.info("Favicon upload will connect to Media Library in Version 2.")}
                className="flex items-center gap-1.5 rounded-md border border-brand/35 bg-brand/15 px-3 py-1.5 text-[11px] font-medium text-brand-bright hover:bg-brand/25"
              >
                <ImageIcon className="size-3.5" />
                Change Favicon
              </button>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 2. Contact Information */}
      <SettingsCard
        title="Contact Information"
        description="Public customer support email, phone numbers, and office addresses."
        badge="Contact"
      >
        <SettingRow
          label="Primary Support Email"
          description="Recipients of user inquiries submitted via the public contact form."
          required
        >
          <div className="flex items-center gap-2 w-full sm:w-80">
            <Mail className="size-4 text-brand-bright shrink-0" />
            <input
              type="email"
              value={draft.contactEmail}
              disabled={!canUpdateSettings || isSaving}
              onChange={(e) => updateDraft("contactEmail", e.target.value)}
              className="flex-1 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Direct Contact Phone"
          description="Inbound phone number displayed on invoice receipts and contact sections."
        >
          <div className="flex items-center gap-2 w-full sm:w-80">
            <Phone className="size-4 text-brand-bright shrink-0" />
            <input
              type="text"
              value={draft.contactPhone}
              disabled={!canUpdateSettings || isSaving}
              onChange={(e) => updateDraft("contactPhone", e.target.value)}
              className="flex-1 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Physical Headquarters Address"
          description="Official registered business address for legal compliance and map pins."
        >
          <div className="flex items-center gap-2 w-full sm:w-96">
            <MapPin className="size-4 text-brand-bright shrink-0" />
            <input
              type="text"
              value={draft.contactAddress}
              disabled={!canUpdateSettings || isSaving}
              onChange={(e) => updateDraft("contactAddress", e.target.value)}
              className="flex-1 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Business Operating Hours"
          description="Official operating hours displayed for customer inquiries and support availability."
        >
          <div className="flex items-center gap-2 w-full sm:w-96">
            <Clock className="size-4 text-brand-bright shrink-0" />
            <input
              type="text"
              value={draft.businessHours}
              disabled={!canUpdateSettings || isSaving}
              onChange={(e) => updateDraft("businessHours", e.target.value)}
              className="flex-1 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
            />
          </div>
        </SettingRow>
      </SettingsCard>

      {/* 3. Social Media Links */}
      <SettingsCard
        title="Social Media Links"
        description="Social profiles linked across the website footer, header shortcuts, and author bios."
        badge="Coming Soon — Version 2"
        action={
          <button
            type="button"
            onClick={handleAddSocial}
            className="flex items-center gap-1.5 rounded-lg border border-brand-bright/40 bg-brand/15 px-2.5 py-1 text-[11.5px] font-semibold text-brand-bright transition hover:bg-brand/25"
          >
            <Plus className="size-3.5" />
            <span>Add Link</span>
          </button>
        }
      >
        <div className="space-y-2.5">
          {socialLinks.map((social) => {
            const Icon = social.icon;
            return (
              <div
                key={social.id}
                className="flex items-center gap-2.5 rounded-lg border border-brand/20 bg-background/60 p-2"
              >
                <div
                  className="flex size-7 items-center justify-center rounded-md border border-brand/20 bg-background/80"
                  style={{ color: social.color }}
                >
                  <Icon className="size-4" />
                </div>
                <span className="w-28 text-[12px] font-semibold text-foreground/90 shrink-0">
                  {social.platform}
                </span>
                <input
                  type="text"
                  value={social.url}
                  onChange={(e) => handleUpdateSocial(social.id, e.target.value)}
                  className="flex-1 rounded-md border border-brand/15 bg-background/80 px-2.5 py-1 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none"
                />
                <a
                  href={social.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-muted-foreground transition hover:text-brand-bright"
                  title="Open link"
                >
                  <ExternalLink className="size-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => handleRemoveSocial(social.id)}
                  className="p-1 text-muted-foreground transition hover:text-red-400"
                  title="Remove link"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </SettingsCard>

      {/* 4. Localization & Regional Preferences */}
      <SettingsCard
        title="Localization & Regional Settings"
        description="Configure default language, timezone calculations, and date conventions."
        badge="Localization"
      >
        <SettingRow
          label="Default System Language"
          description="Primary UI language for public visitors without explicit browser headers."
        >
          <select
            value={draft.defaultLanguage}
            disabled={!canUpdateSettings || isSaving}
            onChange={(e) => updateDraft("defaultLanguage", e.target.value)}
            className="w-full sm:w-64 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
          >
            <option value="en">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="hi">Hindi</option>
            <option value="te">Telugu</option>
            <option value="es">Spanish</option>
            <option value="de">German</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Default Country / Region"
          description="Sets localized legal terms, telephone prefix, and pricing currencies."
        >
          <div className="space-y-1">
            <select
              value={country}
              disabled={!canUpdateSettings || isSaving}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full sm:w-64 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
            >
              <option value="India">India</option>
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Canada">Canada</option>
              <option value="Germany">Germany</option>
              <option value="Singapore">Singapore</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              Note: Country selection is preview-only in the portal and is not persisted.
            </p>
          </div>
        </SettingRow>

        <SettingRow
          label="Server Timezone"
          description="Used for scheduled content releases, audit timestamps, and logging."
        >
          <select
            value={draft.timezone}
            disabled={!canUpdateSettings || isSaving}
            onChange={(e) => updateDraft("timezone", e.target.value)}
            className="w-full sm:w-72 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-60"
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
            <option value="America/New_York">America/New_York (EST -5:00)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST -8:00)</option>
            <option value="Europe/London">Europe/London (GMT +0:00)</option>
            <option value="UTC">UTC (Universal Time)</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Date & Time Formats"
          description="How dates and timestamps are rendered in tables, cards, and blog posts."
        >
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={draft.dateFormat}
              disabled={!canUpdateSettings || isSaving}
              onChange={(e) => updateDraft("dateFormat", e.target.value)}
              className="rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none font-mono disabled:opacity-60"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (24/10/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (10/24/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-10-24)</option>
              <option value="MMM D, YYYY">MMM D, YYYY (Oct 24, 2026)</option>
            </select>

            <select
              value={draft.timeFormat}
              disabled={!canUpdateSettings || isSaving}
              onChange={(e) => updateDraft("timeFormat", e.target.value)}
              className="rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none font-mono disabled:opacity-60"
            >
              <option value="12-hour">12-hour (02:30 PM)</option>
              <option value="24-hour">24-hour (14:30)</option>
            </select>
          </div>
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
