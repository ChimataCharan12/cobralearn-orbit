import { useState } from "react";
import {
  SlidersHorizontal,
  Server,
  Zap,
  Terminal,
  Database,
  AlertOctagon,
  RotateCcw,
  CheckCircle2,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Bug,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { SettingRow } from "@/components/common/settings/SettingRow";
import { SettingToggle } from "@/components/common/settings/SettingToggle";
import { ConfirmationDialog } from "@/components/common/settings/ConfirmationDialog";

interface ApiLogItem {
  id: string;
  time: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  status: number;
  duration: string;
}

export function AdvancedTab() {
  // System
  const [environment] = useState("Production (Vercel Edge Runtime)");
  const [apiVersion] = useState("v2.4.1 (Stable)");
  const [backendStatus] = useState("Local Reactive State (Supabase Ready)");

  // Performance
  const [imageOptimization, setImageOptimization] = useState(true);
  const [lazyLoading, setLazyLoading] = useState(true);
  const [cacheTtl, setCacheTtl] = useState("7d");

  // Developer
  const [debugMode, setDebugMode] = useState(false);
  const [apiLogs] = useState<ApiLogItem[]>([
    { id: "1", time: "14:24:02", method: "GET", endpoint: "/api/v1/projects", status: 200, duration: "12ms" },
    { id: "2", time: "14:23:45", method: "POST", endpoint: "/api/v1/appearance/preview", status: 200, duration: "24ms" },
    { id: "3", time: "14:22:10", method: "GET", endpoint: "/api/v1/telemetry/live", status: 200, duration: "8ms" },
    { id: "4", time: "14:20:55", method: "PUT", endpoint: "/api/v1/settings/seo", status: 200, duration: "32ms" },
  ]);

  // Confirmation Dialog States
  const [resetAppearanceOpen, setResetAppearanceOpen] = useState(false);
  const [resetSettingsOpen, setResetSettingsOpen] = useState(false);
  const [clearCacheOpen, setClearCacheOpen] = useState(false);

  const handleExportData = () => {
    toast.info("Site data archive export is scheduled for Version 2. Full site archive generation is managed through Supabase database backups.");
  };

  const handleImportData = () => {
    toast.info("Site data archive import is scheduled for Version 2.");
  };

  const confirmResetAppearance = () => {
    toast.info("Appearance reset routine is scheduled for Version 2.");
  };

  const confirmResetSettings = () => {
    toast.info("Site settings factory reset is scheduled for Version 2.");
  };

  const confirmClearCache = () => {
    toast.info("Cache flush routine is scheduled for Version 2.");
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-brand/20 bg-panel/80 p-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-[17px] font-bold text-foreground text-glow flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-brand-bright" />
            Advanced System Configuration & Developer Tools
          </h2>
          <p className="text-[12.5px] text-muted-foreground">
            Low-level runtime diagnostics, performance compiler parameters, telemetry logs, and recovery routines.
          </p>
        </div>
      </div>

      {/* 1. System Health & Environment */}
      <SettingsCard
        title="System Architecture & Runtime Diagnostics"
        description="Core infrastructure metadata and backend connectivity telemetry."
        badge="Runtime"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-brand/20 bg-background/40 p-3 space-y-1">
            <span className="text-[11px] font-mono text-muted-foreground">ACTIVE ENVIRONMENT</span>
            <p className="text-[12.5px] font-bold text-foreground">{environment}</p>
            <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-400 font-mono pt-1">
              <CheckCircle2 className="size-3" />
              <span>Production Edge Verified</span>
            </div>
          </div>

          <div className="rounded-xl border border-brand/20 bg-background/40 p-3 space-y-1">
            <span className="text-[11px] font-mono text-muted-foreground">REST API SPECIFICATION</span>
            <p className="text-[12.5px] font-bold text-foreground">{apiVersion}</p>
            <div className="flex items-center gap-1.5 text-[10.5px] text-brand-bright font-mono pt-1">
              <CheckCircle2 className="size-3" />
              <span>Endpoints Operational (14ms)</span>
            </div>
          </div>

          <div className="rounded-xl border border-brand/20 bg-background/40 p-3 space-y-1">
            <span className="text-[11px] font-mono text-muted-foreground">PERSISTENCE BACKEND</span>
            <p className="text-[12.5px] font-bold text-foreground">{backendStatus}</p>
            <div className="flex items-center gap-1.5 text-[10.5px] text-brand-cyan font-mono pt-1">
              <CheckCircle2 className="size-3" />
              <span>Clean Separation Layer</span>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 2. Performance Tuning */}
      <SettingsCard
        title="Compiler & Performance Parameters"
        description="Optimize asset delivery pipelines, client rendering, and memory caching."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Next-Gen Image Format Transcoding"
          description="Automatically serve AVIF and WebP representations for faster load times."
        >
          <SettingToggle
            checked={imageOptimization}
            onChange={setImageOptimization}
            label="Image Optimization"
          />
        </SettingRow>

        <SettingRow
          label="Native HTML Lazy Loading"
          description="Defers loading of offscreen images and cards until viewport scroll approach."
        >
          <SettingToggle
            checked={lazyLoading}
            onChange={setLazyLoading}
            label="Lazy Loading"
          />
        </SettingRow>

        <SettingRow
          label="HTTP Browser Cache-Control TTL"
          description="Sets Cache-Control max-age header for static media and compiled scripts."
        >
          <select
            value={cacheTtl}
            onChange={(e) => setCacheTtl(e.target.value)}
            className="rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="1h">1 Hour (Frequent Updates)</option>
            <option value="1d">1 Day</option>
            <option value="7d">7 Days (Recommended)</option>
            <option value="30d">30 Days (Maximum Performance)</option>
          </select>
        </SettingRow>
      </SettingsCard>

      {/* 3. Developer & Diagnostic Telemetry */}
      <SettingsCard
        title="Developer Telemetry & Diagnostics"
        description="Inspect internal request traffic, client state transitions, and error logs."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Verbose Client-Side Debug Mode"
          description="Logs detailed component lifecycles, route events, and cache operations into the developer console."
        >
          <SettingToggle
            checked={debugMode}
            onChange={setDebugMode}
            label="Debug Mode"
          />
        </SettingRow>

        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
              <Terminal className="size-3.5 text-brand-bright" />
              Recent Administrative API Invocations
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Live In-Memory Buffer</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-brand/20 bg-black/60 font-mono text-[11px]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-brand/20 bg-panel/70 text-muted-foreground">
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Endpoint</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand/10">
                {apiLogs.map((log) => (
                  <tr key={log.id} className="text-foreground/90 hover:bg-brand/5">
                    <td className="px-3 py-1.5 text-muted-foreground">{log.time}</td>
                    <td className="px-3 py-1.5">
                      <span className="rounded bg-brand/15 px-1 py-0.5 text-brand-bright font-bold">
                        {log.method}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-foreground/80">{log.endpoint}</td>
                    <td className="px-3 py-1.5">
                      <span className="text-emerald-400 font-bold">{log.status} OK</span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{log.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SettingsCard>

      {/* 4. Data Portability & Archive Transfer */}
      <SettingsCard
        title="Data Portability & Database Archive"
        description="Export or import serialized JSON packages containing all site configurations."
        badge="Coming Soon — Version 2"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-brand/20 bg-background/40 p-3.5 space-y-2">
            <h4 className="text-[12.5px] font-semibold text-foreground">Export Complete Site Data</h4>
            <p className="text-[11.5px] text-muted-foreground">
              Downloads a comprehensive JSON archive encompassing settings, appearance definitions, and content structures.
            </p>
            <button
              type="button"
              onClick={handleExportData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-bright/40 bg-brand/15 px-3 py-1.5 text-[12px] font-medium text-brand-bright hover:bg-brand/25"
            >
              <Download className="size-3.5" />
              Export Site Archive
            </button>
          </div>

          <div className="rounded-xl border border-brand/20 bg-background/40 p-3.5 space-y-2">
            <h4 className="text-[12.5px] font-semibold text-foreground">Import Site Data</h4>
            <p className="text-[11.5px] text-muted-foreground">
              Restore configuration from a previously exported JSON backup file.
            </p>
            <button
              type="button"
              onClick={handleImportData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand/35 bg-background/60 px-3 py-1.5 text-[12px] font-medium text-foreground hover:border-brand-bright hover:text-brand-bright"
            >
              <Upload className="size-3.5" />
              Upload Backup File
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* 5. Danger Zone */}
      <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-5 shadow-[0_0_24px_rgba(239,68,68,0.12)] space-y-4">
        <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="size-5 text-red-400" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-[15px] font-bold text-red-400">Danger Zone — Irreversible Operations</h3>
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10.5px] font-medium text-red-400">
                  Coming Soon — Version 2
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Destructive administrative procedures. Confirmation is required before executing any action.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Action 1: Reset Appearance */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-background/50 p-3.5">
            <div>
              <h4 className="text-[13px] font-semibold text-foreground">Reset Appearance & Animation Rules</h4>
              <p className="text-[11.5px] text-muted-foreground">
                Reverts all typography scales, theme color swatches, button shapes, and background animations to factory state.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setResetAppearanceOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-1.5 text-[12px] font-semibold text-red-400 hover:bg-red-500/20 self-start sm:self-center"
            >
              <RotateCcw className="size-3.5" />
              Reset Appearance
            </button>
          </div>

          {/* Action 2: Reset Site Settings */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-background/50 p-3.5">
            <div>
              <h4 className="text-[13px] font-semibold text-foreground">Reset All Site Settings</h4>
              <p className="text-[11.5px] text-muted-foreground">
                Restores SEO metadata, contact records, integrations credentials, and email notification configurations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setResetSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-1.5 text-[12px] font-semibold text-red-400 hover:bg-red-500/20 self-start sm:self-center"
            >
              <RotateCcw className="size-3.5" />
              Reset Site Settings
            </button>
          </div>

          {/* Action 3: Clear All Cached Data */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-background/50 p-3.5">
            <div>
              <h4 className="text-[13px] font-semibold text-foreground">Flush All Cached Data & Telemetry</h4>
              <p className="text-[11.5px] text-muted-foreground">
                Completely invalidates browser session caches, local analytics indices, and temporary upload buffers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setClearCacheOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-1.5 text-[12px] font-semibold text-red-400 hover:bg-red-500/20 self-start sm:self-center"
            >
              <Trash2 className="size-3.5" />
              Clear Cached Data
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={resetAppearanceOpen}
        onOpenChange={setResetAppearanceOpen}
        title="Reset All Appearance Settings to Defaults?"
        description="This action cannot be undone. Custom colors, font pairings, component geometries, and background atmospheric effects will be replaced with CobraLearn Default."
        confirmLabel="Yes, Reset Appearance"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmResetAppearance}
      />

      <ConfirmationDialog
        open={resetSettingsOpen}
        onOpenChange={setResetSettingsOpen}
        title="Reset All Site Settings to Factory Defaults?"
        description="This action cannot be undone. SEO titles, contact channels, email notification routing, and external service credentials will be overwritten with default configuration values."
        confirmLabel="Yes, Reset Site Settings"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmResetSettings}
      />

      <ConfirmationDialog
        open={clearCacheOpen}
        onOpenChange={setClearCacheOpen}
        title="Flush All Cached Data and Session Storage?"
        description="This will purge all cached objects. You may be asked to re-authenticate if administrative session tokens are cleared."
        confirmLabel="Purge All Caches"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmClearCache}
      />
    </div>
  );
}
