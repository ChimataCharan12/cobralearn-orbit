import { useState } from "react";
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Download,
  Calendar,
  Clock,
  Radio,
  FileCheck,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { SettingRow } from "@/components/common/settings/SettingRow";
import { SettingToggle } from "@/components/common/settings/SettingToggle";
import { ConfirmationDialog } from "@/components/common/settings/ConfirmationDialog";

export function MaintenanceTab() {
  // Website Status
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [_pendingMode, setPendingMode] = useState(false);

  // Maintenance Page Details
  const [maintenanceTitle, setMaintenanceTitle] = useState("Under Scheduled Core Upgrade");
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "CobraLearn Innotechcore systems are currently undergoing planned cybernetic infrastructure enhancements. All user data is secure. Normal service will resume shortly."
  );
  const [maintenanceBackground, setMaintenanceBackground] = useState("Obsidian Glow Matrix");
  const [estimatedReturn, setEstimatedReturn] = useState("Today, 04:00 AM UTC (approx. 45 mins)");

  // Publishing
  const [autoPublish, setAutoPublish] = useState(true);
  const [draftBehavior, setDraftBehavior] = useState("preview_token");

  // Cache Dialog
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);

  // Backups
  const [backups] = useState<Array<{ id: string; name: string; timestamp: string; size: string }>>([]);

  const handleToggleModeClick = (next: boolean) => {
    if (next) {
      setPendingMode(true);
      setMaintenanceDialogOpen(true);
    } else {
      setMaintenanceMode(false);
      toast.info("Maintenance mode holding state cleared in preview.");
    }
  };

  const confirmMaintenanceMode = () => {
    setMaintenanceMode(true);
    toast.info("Maintenance holding screen enabled in preview. Public traffic routing is not currently gated; edge traffic redirection is scheduled for Version 2.");
  };

  const handleClearCacheConfirm = () => {
    toast.info("Server cache purging hooks are scheduled for Version 2.");
  };

  const handleRefreshContent = () => {
    toast.info("Search indices update automatically on content publish. Static content indexing is handled automatically. Manual reindex tool scheduled for Version 2.");
  };

  const handleExportSettings = () => {
    toast.info("Configuration archive export is scheduled for Version 2. Configuration export is managed via database backups.");
  };

  const handleCreateBackup = () => {
    toast.info("Configuration snapshot archiving is scheduled for Version 2.");
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="rounded-xl border border-brand/20 bg-panel/80 p-4">
        <h2 className="font-display text-[17px] font-bold text-foreground text-glow flex items-center gap-2">
          <Wrench className="size-4 text-brand-bright" />
          Website Maintenance & System Operations
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          Manage live public accessibility, maintenance holding pages, automated publishing, and configuration backups.
        </p>
      </div>

      {/* 1. Website Status */}
      <SettingsCard
        title="Public Website Status"
        description="Toggle between active online traffic and holding maintenance mode."
        badge="Coming Soon — Version 2"
        className={maintenanceMode ? "border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]" : ""}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-brand/20 bg-background/40 p-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                maintenanceMode
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              }`}
            >
              {maintenanceMode ? <AlertTriangle className="size-5" /> : <Radio className="size-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-[14px] font-bold text-foreground">
                  Current Status: {maintenanceMode ? "Maintenance Mode Active" : "Website Is Live"}
                </h4>
                <span
                  className={`size-2.5 rounded-full ${
                    maintenanceMode ? "bg-amber-400 animate-pulse" : "bg-emerald-400 shadow-[0_0_8px_#00f5a7]"
                  }`}
                />
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {maintenanceMode
                  ? "All public visitors are redirected to the custom maintenance holding page with HTTP 503 status."
                  : "All pages, interactive modules, and APIs are publicly accessible."}
              </p>
            </div>
          </div>

          <div className="self-end sm:self-center">
            <SettingToggle
              checked={maintenanceMode}
              onChange={handleToggleModeClick}
              label={maintenanceMode ? "Disable Maintenance" : "Enable Maintenance"}
            />
          </div>
        </div>
      </SettingsCard>      {/* 2. Maintenance Page Customization */}
      <SettingsCard
        title="Maintenance Page Presentation"
        description="Holding page displayed to visitors while maintenance mode is active."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Headline Title"
          description="Main headline displayed to visitors."
        >
          <input
            type="text"
            value={maintenanceTitle}
            onChange={(e) => setMaintenanceTitle(e.target.value)}
            className="w-full sm:w-96 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>

        <SettingRow
          label="Status Message Body"
          description="Explanatory message explaining the maintenance activity."
        >
          <textarea
            rows={3}
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            className="w-full rounded-lg border border-brand/20 bg-background/70 p-2.5 text-[12px] text-foreground focus:border-brand-bright focus:outline-none leading-relaxed"
          />
        </SettingRow>

        <SettingRow
          label="Backdrop Theme"
          description="Visual background artwork displayed on the holding screen."
        >
          <select
            value={maintenanceBackground}
            onChange={(e) => setMaintenanceBackground(e.target.value)}
            className="w-full sm:w-64 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="Obsidian Glow Matrix">Obsidian Glow Matrix</option>
            <option value="Emerald Cyber Grid">Emerald Cyber Grid</option>
            <option value="Minimal Dark Void">Minimal Dark Void</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Estimated Return Time"
          description="Human-readable return estimate displayed to prevent customer frustration."
        >
          <div className="flex items-center gap-2 w-full sm:w-96">
            <Clock className="size-4 text-brand-bright shrink-0" />
            <input
              type="text"
              value={estimatedReturn}
              onChange={(e) => setEstimatedReturn(e.target.value)}
              className="flex-1 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>
        </SettingRow>
      </SettingsCard>

      {/* 3. Content Publishing Rules */}
      <SettingsCard
        title="Content Publishing & Draft Controls"
        description="Automated release mechanisms and draft security."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Auto-Publish Scheduled Content"
          description="Automatically transition drafts to published status at their scheduled release date."
        >
          <SettingToggle
            checked={autoPublish}
            onChange={setAutoPublish}
            label="Auto Publish"
          />
        </SettingRow>

        <SettingRow
          label="Draft Content Access Behavior"
          description="How unpublished draft pages are treated by the server."
        >
          <select
            value={draftBehavior}
            onChange={(e) => setDraftBehavior(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="preview_token">Require Signed Admin Preview Token</option>
            <option value="authenticated_admin">Visible to Logged-in Admins Only</option>
            <option value="strict_404">Hard 404 Not Found to All Non-Admins</option>
          </select>
        </SettingRow>
      </SettingsCard>

      {/* 4. Cache & Content Invalidation */}
      <SettingsCard
        title="Cache Management & Invalidation"
        description="Purge application memory, HTML edge fragments, and recompile static assets."
        badge="Coming Soon — Version 2"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand/20 bg-background/40 p-3.5">
          <div>
            <h4 className="text-[13px] font-semibold text-foreground">Clear Website & Edge Cache</h4>
            <p className="text-[11.5px] text-muted-foreground">
              Forces all client browsers and CDN nodes to fetch fresh HTML, CSS, and database queries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setClearCacheDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-[12px] font-semibold text-amber-400 hover:bg-amber-500/20 self-start sm:self-center"
          >
            <Trash2 className="size-3.5" />
            Clear Cache
          </button>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand/20 bg-background/40 p-3.5">
          <div>
            <h4 className="text-[13px] font-semibold text-foreground">Refresh Search & Content Indices</h4>
            <p className="text-[11.5px] text-muted-foreground">
              Re-crawls active projects, websites, and articles to update local quick-search tables.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefreshContent}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand/35 bg-background/60 px-3.5 py-1.5 text-[12px] font-medium text-brand-bright hover:border-brand-bright hover:bg-brand/10 self-start sm:self-center"
          >
            <RefreshCw className="size-3.5" />
            Refresh Indices
          </button>
        </div>
      </SettingsCard>

      {/* 5. Configuration Snapshots & Backups */}
      <SettingsCard
        title="Configuration Backups & Snapshots"
        description="Preserve timestamped archives of your site configuration and appearance rules."
        badge="Coming Soon — Version 2"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportSettings}
              className="inline-flex items-center gap-1 rounded-lg border border-brand/25 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-foreground/80 hover:text-foreground hover:border-brand-bright"
            >
              <Download className="size-3" />
              Export JSON
            </button>
            <button
              type="button"
              onClick={handleCreateBackup}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-bright/40 bg-brand/15 px-2.5 py-1 text-[11px] font-semibold text-brand-bright hover:bg-brand/25"
            >
              <Archive className="size-3" />
              Create Snapshot
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          {backups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-brand/20 bg-background/30 p-4 text-center">
              <p className="text-[12px] text-muted-foreground">No configuration snapshots saved yet.</p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">Click "Create Snapshot" or "Export JSON" to preserve current settings.</p>
            </div>
          ) : (
            backups.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-brand/20 bg-background/50 p-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck className="size-4 text-brand-bright" />
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">{b.name}</p>
                    <p className="text-[10.5px] text-muted-foreground font-mono">
                      {b.timestamp} • {b.size}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toast.info(`Restoring database snapshots requires Supabase CLI or PITR. Snapshot "${b.name}" not applied.`)}
                  className="rounded-md border border-brand/20 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-brand-bright hover:border-brand-bright hover:bg-brand/15"
                >
                  Restore
                </button>
              </div>
            ))
          )}
        </div>
      </SettingsCard>

      {/* Confirmation Dialog for Maintenance Mode */}
      <ConfirmationDialog
        open={maintenanceDialogOpen}
        onOpenChange={setMaintenanceDialogOpen}
        title="Enable Website Maintenance Mode?"
        description="This will take the public website offline and immediately show the holding page to all visitors. Administrators will remain able to access this admin portal."
        confirmLabel="Enable Maintenance Mode"
        cancelLabel="Keep Website Live"
        variant="warning"
        onConfirm={confirmMaintenanceMode}
      />

      {/* Confirmation Dialog for Cache Clear */}
      <ConfirmationDialog
        open={clearCacheDialogOpen}
        onOpenChange={setClearCacheDialogOpen}
        title="Clear All Cached Website Data?"
        description="This will invalidate server response caches, image optimization caches, and CDN edge memory. Initial page loads may experience a brief 1-2 second latency spike while caches rebuild."
        confirmLabel="Purge All Caches"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleClearCacheConfirm}
      />
    </div>
  );
}
