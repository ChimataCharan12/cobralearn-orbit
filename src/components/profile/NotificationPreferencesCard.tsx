import { useState } from "react";
import { Mail, Shield } from "lucide-react";

export interface NotificationPreferencesValues {
  emailNotifications: boolean;
  contentUpdates: boolean;
  securityAlerts: boolean;
  systemAnnouncements: boolean;
}

export interface NotificationPreferencesCardProps {
  values?: NotificationPreferencesValues;
  onChange?: (updates: Partial<NotificationPreferencesValues>) => void;
  disabled?: boolean;
}

export function NotificationPreferencesCard({
  values,
  onChange,
  disabled = false,
}: NotificationPreferencesCardProps = {}) {
  // Local fallback state if used uncontrolled
  const [localEmailNotifs, setLocalEmailNotifs] = useState(true);
  const [localContentUpdates, setLocalContentUpdates] = useState(true);
  const [localSecurityAlerts, setLocalSecurityAlerts] = useState(true);
  const [localSystemAnnouncements, setLocalSystemAnnouncements] = useState(true);

  const emailNotifs = values !== undefined ? values.emailNotifications : localEmailNotifs;
  const contentUpdates = values !== undefined ? values.contentUpdates : localContentUpdates;
  const securityAlerts = values !== undefined ? values.securityAlerts : localSecurityAlerts;
  const systemAnnouncements = values !== undefined ? values.systemAnnouncements : localSystemAnnouncements;

  const toggleEmail = () => {
    if (disabled) return;
    if (onChange && values !== undefined) {
      onChange({ emailNotifications: !values.emailNotifications });
    } else {
      setLocalEmailNotifs((prev) => !prev);
    }
  };

  const toggleContent = () => {
    if (disabled) return;
    if (onChange && values !== undefined) {
      onChange({ contentUpdates: !values.contentUpdates });
    } else {
      setLocalContentUpdates((prev) => !prev);
    }
  };

  const toggleSecurity = () => {
    if (disabled) return;
    if (onChange && values !== undefined) {
      onChange({ securityAlerts: !values.securityAlerts });
    } else {
      setLocalSecurityAlerts((prev) => !prev);
    }
  };

  const toggleAnnouncements = () => {
    if (disabled) return;
    if (onChange && values !== undefined) {
      onChange({ systemAnnouncements: !values.systemAnnouncements });
    } else {
      setLocalSystemAnnouncements((prev) => !prev);
    }
  };

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="pb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Notification Preferences</h3>
        <p className="text-[12px] text-muted-foreground">Configure email and in-app notifications.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
        {/* Email Notifications */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-brand/15 bg-background/50 p-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded bg-brand/10 text-brand-bright">
              <Mail className="size-4" />
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">Email Notifications</p>
              <p className="text-[11px] text-muted-foreground">Receive important updates via email</p>
            </div>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={toggleEmail}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${
              emailNotifs ? "bg-brand-bright" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                emailNotifs ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Content Updates */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-brand/15 bg-background/50 p-3">
          <div>
            <p className="text-[12.5px] font-semibold text-foreground">Content Updates</p>
            <p className="text-[11px] text-muted-foreground">Get notified when new content is published</p>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={toggleContent}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${
              contentUpdates ? "bg-brand-bright" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                contentUpdates ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Security Alerts */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-brand/15 bg-background/50 p-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded bg-brand/10 text-brand-bright">
              <Shield className="size-4" />
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">Security Alerts</p>
              <p className="text-[11px] text-muted-foreground">Receive security related notifications</p>
            </div>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={toggleSecurity}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${
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

        {/* System Announcements */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-brand/15 bg-background/50 p-3">
          <div>
            <p className="text-[12.5px] font-semibold text-foreground">System Announcements</p>
            <p className="text-[11px] text-muted-foreground">Get notified about system updates and maintenance</p>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={toggleAnnouncements}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${
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
      </div>
    </div>
  );
}
