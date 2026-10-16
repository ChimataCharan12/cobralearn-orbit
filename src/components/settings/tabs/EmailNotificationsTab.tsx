import { useState } from "react";
import {
  Mail,
  Bell,
  Users,
  FileText,
  Send,
  Plus,
  X,
  Code,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { SettingRow } from "@/components/common/settings/SettingRow";
import { SettingToggle } from "@/components/common/settings/SettingToggle";
import { useSiteSettings } from "@/lib/site-settings-context";

type EmailTemplateKey = "contact_received" | "submission_confirmation" | "admin_alert" | "password_reset";

interface TemplateConfig {
  subject: string;
  preheader: string;
  body: string;
  variables: string[];
}

const DEFAULT_TEMPLATES: Record<EmailTemplateKey, TemplateConfig> = {
  contact_received: {
    subject: "We received your message — {{site_name}}",
    preheader: "Thank you for contacting our team. We will review your message shortly.",
    body: `Hi {{user_name}},\n\nThank you for reaching out to {{site_name}}. We have received your inquiry regarding "{{subject}}".\n\nOur engineering and support team will review your message and reply within 24 business hours.\n\nBest regards,\nThe {{site_name}} Team`,
    variables: ["{{user_name}}", "{{site_name}}", "{{subject}}", "{{date}}"],
  },
  submission_confirmation: {
    subject: "Project Submission Confirmed: {{project_title}}",
    preheader: "Your application has been received and queued for review.",
    body: `Hello {{user_name}},\n\nYour project submission for "{{project_title}}" has been successfully registered on {{site_name}}.\n\nYou can track the status of your review from your personal dashboard at any time.\n\nVerification Code: {{verification_code}}`,
    variables: ["{{user_name}}", "{{project_title}}", "{{site_name}}", "{{verification_code}}"],
  },
  admin_alert: {
    subject: "[ADMIN ALERT] High Priority System Event on {{site_name}}",
    preheader: "A critical event requires administrator attention.",
    body: `Attention Admin,\n\nA new high-priority notification was generated on {{site_name}}:\n\nEvent Type: {{event_type}}\nActor: {{user_email}}\nIP Address: {{ip_address}}\nTimestamp: {{timestamp}}\n\nPlease review your security logs immediately.`,
    variables: ["{{site_name}}", "{{event_type}}", "{{user_email}}", "{{ip_address}}", "{{timestamp}}"],
  },
  password_reset: {
    subject: "Reset your {{site_name}} password",
    preheader: "Use the secure link below to reset your portal password.",
    body: `Hi {{user_name}},\n\nWe received a request to reset your password for your {{site_name}} admin account.\n\nClick the link below to choose a new password:\n{{reset_link}}\n\nThis link will expire in 60 minutes. If you did not make this request, please disregard this email.`,
    variables: ["{{user_name}}", "{{site_name}}", "{{reset_link}}", "{{expiry_time}}"],
  },
};

export function EmailNotificationsTab() {
  const {
    draft,
    updateDraft,
    isSaving,
    canUpdateSettings,
  } = useSiteSettings();

  // Sender Config (informational preview in UI)
  const [senderName, setSenderName] = useState("CobraLearn Innotechcore");
  const [senderEmail, setSenderEmail] = useState("notifications@cobralearn.com");
  const [replyTo, setReplyTo] = useState("support@cobralearn.com");

  // Local Event Notification Toggles (Informational preview)
  const [adminAlertsNotify, setAdminAlertsNotify] = useState(true);
  const [publishingNotify, setPublishingNotify] = useState(true);
  const [systemNotify, setSystemNotify] = useState(false);

  // Additional Recipients (Informational preview)
  const [additionalRecipients, setAdditionalRecipients] = useState<string[]>([
    "lead-alerts@cobralearn.com",
    "security-team@cobralearn.com",
  ]);

  // Email Templates
  const [activeTemplate, setActiveTemplate] = useState<EmailTemplateKey>("contact_received");
  const [templates, setTemplates] = useState<Record<EmailTemplateKey, TemplateConfig>>(DEFAULT_TEMPLATES);

  const currentTemplate = templates[activeTemplate];

  const handleUpdateTemplate = (field: keyof TemplateConfig, value: string) => {
    setTemplates((prev) => ({
      ...prev,
      [activeTemplate]: {
        ...prev[activeTemplate],
        [field]: value,
      },
    }));
  };

  const handleAddRecipient = () => {
    const email = prompt("Enter additional notification email address:");
    if (email && email.includes("@") && !additionalRecipients.includes(email.trim())) {
      setAdditionalRecipients((prev) => [...prev, email.trim()]);
      toast.info(`Added local preview for ${email.trim()}. Multi-recipient routing is scheduled for Version 2.`);
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setAdditionalRecipients((prev) => prev.filter((e) => e !== email));
    toast.info("Removed local recipient preview.");
  };

  const handleSendTest = () => {
    toast.info(`Transactional test email dispatch for "${activeTemplate}" is scheduled for Version 2. Direct email dispatch requires configured server-side mail transport.`);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="rounded-xl border border-brand/20 bg-panel/80 p-4">
        <h2 className="font-display text-[17px] font-bold text-foreground text-glow flex items-center gap-2">
          <Mail className="size-4 text-brand-bright" />
          Email Transmission & Notification Workflows
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          Configure sender identity, administrative alert routing, automated triggers, and email templates.
        </p>
      </div>

      {/* 1. Email Sender Configuration */}
      <SettingsCard
        title="Sender Identity Configuration"
        description="Public From header and reply addresses appearing in user mail inboxes."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Sender Display Name"
          description="Name visible as the sender before the email address."
          required
        >
          <input
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>

        <SettingRow
          label="From Email Address"
          description="Must be authenticated against your sending domain SPF/DKIM."
          required
        >
          <input
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] font-mono text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>

        <SettingRow
          label="Reply-To Address"
          description="Inboxes that receive customer direct replies."
        >
          <input
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] font-mono text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>
      </SettingsCard>

      {/* 2. Automated Event Notifications */}
      <SettingsCard
        title="Event Notification Triggers"
        description="Choose which system events trigger email dispatches."
        badge="Triggers"
      >
        <SettingRow
          label="Contact Form Inbound Submissions"
          description="Dispatch an instant alert when a visitor submits a contact or inquiry request."
        >
          <SettingToggle
            checked={draft.notifyOnNewMessage}
            onChange={(checked) => updateDraft("notifyOnNewMessage", checked)}
            label="Contact Alerts"
            disabled={!canUpdateSettings || isSaving}
          />
        </SettingRow>

        <SettingRow
          label="Security & Admin Alerts"
          description="Critical notifications for brute force detection, new admin logins, and API threshold warnings."
        >
          <SettingToggle
            checked={adminAlertsNotify}
            onChange={setAdminAlertsNotify}
            label="Admin Alerts"
          />
        </SettingRow>

        <SettingRow
          label="Content Publishing Status"
          description="Confirm when scheduled projects, websites, or advertisement banners go live."
        >
          <SettingToggle
            checked={publishingNotify}
            onChange={setPublishingNotify}
            label="Publishing Alerts"
          />
        </SettingRow>

        <SettingRow
          label="System Maintenance & Health Digests"
          description="Weekly summary digests covering uptime, storage capacity, and error rates."
        >
          <SettingToggle
            checked={systemNotify}
            onChange={setSystemNotify}
            label="System Digests"
          />
        </SettingRow>
      </SettingsCard>

      {/* 3. Notification Recipients Routing */}
      <SettingsCard
        title="Notification Recipients"
        description="Manage the primary administrative mailbox and CC team recipients."
        badge="Recipients"
      >
        <SettingRow
          label="Primary Administrator Email"
          description="The main inbox for high-priority operational notices."
          required
        >
          <input
            type="email"
            value={draft.notificationEmail || ""}
            onChange={(e) => updateDraft("notificationEmail", e.target.value.trim() ? e.target.value.trim() : null)}
            disabled={!canUpdateSettings || isSaving}
            className="w-full sm:w-80 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] font-mono text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </SettingRow>

        <SettingRow
          label="Additional CC Recipients"
          description="Departmental distribution groups receiving copies of inbound alerts."
        >
          <div className="flex flex-wrap items-center gap-2">
            {additionalRecipients.map((email) => (
              <span
                key={email}
                className="flex items-center gap-1.5 rounded-md border border-brand-bright/40 bg-brand/20 px-2.5 py-1 text-[11px] font-mono text-brand-bright"
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(email)}
                  className="hover:text-red-400"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={handleAddRecipient}
              className="flex items-center gap-1 rounded-md border border-dashed border-brand/35 bg-background/50 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-brand-bright"
            >
              <Plus className="size-3 text-brand-bright" />
              <span>Add Recipient</span>
            </button>
          </div>
        </SettingRow>
      </SettingsCard>

      {/* 4. Email Templates Editor */}
      <SettingsCard
        title="Transactional Email Templates"
        description="Customize the typography, subject lines, and copy for automated system emails."
        badge="Coming Soon — Version 2"
        action={
          <button
            type="button"
            onClick={handleSendTest}
            className="flex items-center gap-1.5 rounded-lg border border-brand-bright/40 bg-brand/15 px-3 py-1 text-[11.5px] font-semibold text-brand-bright hover:bg-brand/25"
          >
            <Send className="size-3" />
            Send Test Email
          </button>
        }
      >
        <div className="space-y-4">
          {/* Template Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-brand/15 pb-2.5">
            {[
              { key: "contact_received" as const, label: "Contact Received" },
              { key: "submission_confirmation" as const, label: "Submission Confirmation" },
              { key: "admin_alert" as const, label: "Admin Notification" },
              { key: "password_reset" as const, label: "Password Reset" },
            ].map((tmpl) => (
              <button
                key={tmpl.key}
                type="button"
                onClick={() => setActiveTemplate(tmpl.key)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                  activeTemplate === tmpl.key
                    ? "border border-brand-bright/60 bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.2)] font-semibold"
                    : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                {tmpl.label}
              </button>
            ))}
          </div>

          {/* Template Fields */}
          <div className="space-y-3">
            <div>
              <label className="text-[11.5px] font-medium text-foreground/80">Subject Line</label>
              <input
                type="text"
                value={currentTemplate.subject}
                onChange={(e) => handleUpdateTemplate("subject", e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11.5px] font-medium text-foreground/80">Preheader Summary Text</label>
              <input
                type="text"
                value={currentTemplate.preheader}
                onChange={(e) => handleUpdateTemplate("preheader", e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] text-muted-foreground focus:border-brand-bright focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11.5px] font-medium text-foreground/80">Email Body (Markdown / Plain Text)</label>
                <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                  <Code className="size-3 text-brand-bright" />
                  <span>Available Variables:</span>
                </div>
              </div>
              <div className="my-1.5 flex flex-wrap gap-1">
                {currentTemplate.variables.map((variable) => (
                  <span
                    key={variable}
                    className="rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[10px] font-mono text-brand-bright"
                  >
                    {variable}
                  </span>
                ))}
              </div>
              <textarea
                rows={7}
                value={currentTemplate.body}
                onChange={(e) => handleUpdateTemplate("body", e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand/20 bg-background/80 p-3 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none leading-relaxed"
              />
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
