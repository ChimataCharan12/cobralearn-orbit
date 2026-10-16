import { useState, useEffect } from "react";
import {
  Layers,
  BarChart2,
  Mail,
  MapPin,
  Shield,
  Cloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { SettingRow } from "@/components/common/settings/SettingRow";
import { SettingToggle } from "@/components/common/settings/SettingToggle";
import { adminClient, type SettingsEnvironmentStatus } from "@/lib/api/admin-client";

export function IntegrationsTab() {
  const [envStatus, setEnvStatus] = useState<SettingsEnvironmentStatus | null>(null);

  useEffect(() => {
    let isMounted = true;
    adminClient.getSettingsEnvironmentStatus().then((res) => {
      if (isMounted && res.success && res.data) {
        setEnvStatus(res.data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Google Analytics
  const [gaEnabled, setGaEnabled] = useState(false);
  const [gaId, setGaId] = useState("");
  const [gaAnonymize, setGaAnonymize] = useState(true);

  // Google Tag Manager
  const [gtmEnabled, setGtmEnabled] = useState(false);
  const [gtmId, setGtmId] = useState("");

  // Email Provider
  const [emailProvider, setEmailProvider] = useState("Resend");
  const [emailDomain, setEmailDomain] = useState("mail.cobralearn.in");

  // Contact Form Service
  const [formService, setFormService] = useState("Native Innotechcore API");
  const [webhookUrl, setWebhookUrl] = useState("");

  // Maps Provider
  const [mapProvider, setMapProvider] = useState("Mapbox GL");
  const [mapApiKey, setMapApiKey] = useState("");
  const [mapStyle, setMapStyle] = useState("Dark Futuristic Neon");

  // Bot Protection (reCAPTCHA / Turnstile)
  const [captchaProvider, setCaptchaProvider] = useState("Cloudflare Turnstile");
  const [captchaSiteKey, setCaptchaSiteKey] = useState("");

  // CDN & Caching
  const [cdnProvider, setCdnProvider] = useState("Cloudflare Edge Network");

  const handleTestConnection = (serviceName: string) => {
    toast.info(`Integration diagnostic tests for ${serviceName} will be available in Version 2; diagnostic tests require server-side healthcheck endpoint.`);
  };

  const handlePurgeCdn = () => {
    toast.info("Edge CDN cache purging will be available in Version 2 when CDN API credentials are configured.");
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="rounded-xl border border-brand/20 bg-panel/80 p-4">
        <h2 className="font-display text-[17px] font-bold text-foreground text-glow flex items-center gap-2">
          <Layers className="size-4 text-brand-bright" />
          External Services & Third-Party Integrations
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          Connect analytics trackers, transactional email APIs, interactive map tiles, and edge CDN networks.
        </p>
      </div>

      {/* 1. Analytics Integrations */}
      <SettingsCard
        title="Web Analytics & Telemetry"
        description="Track visitor traffic, session durations, and conversion funnels."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Google Analytics 4 (GA4)"
          description="Client-side tracking script injected asynchronously into the public document head."
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <SettingToggle
              checked={gaEnabled}
              onChange={setGaEnabled}
              label="Enable GA4"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={gaId}
                onChange={(e) => setGaId(e.target.value)}
                placeholder="G-XXXXXXXXXX"
                disabled={!gaEnabled}
                className="w-44 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-40"
              />
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <CheckCircle2 className="size-3" />
                Active
              </span>
            </div>
          </div>
        </SettingRow>

        <SettingRow
          label="Google Tag Manager (GTM)"
          description="Container snippet for advanced marketing tags and consent banners."
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <SettingToggle
              checked={gtmEnabled}
              onChange={setGtmEnabled}
              label="Enable GTM"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={gtmId}
                onChange={(e) => setGtmId(e.target.value)}
                placeholder="GTM-XXXXXXX"
                disabled={!gtmEnabled}
                className="w-44 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none disabled:opacity-40"
              />
              <span className="flex items-center gap-1 rounded-full border border-muted-foreground/30 bg-background/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Disabled
              </span>
            </div>
          </div>
        </SettingRow>
      </SettingsCard>

      {/* 2. Communication & Email Providers */}
      <SettingsCard
        title="Communication & Email Services"
        description="Transactional email delivery for user accounts, verification, and alert dispatches."
        badge="Email"
      >
        <SettingRow
          label="Email Gateway Provider"
          description="Select which SMTP or REST mail service dispatches notifications."
        >
          <div className="flex flex-wrap items-center gap-2">
            {["Resend", "SendGrid", "Amazon SES", "Postmark"].map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => setEmailProvider(provider)}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                  emailProvider === provider
                    ? "border-brand-bright bg-brand/20 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.2)]"
                    : "border-brand/20 bg-background/50 text-foreground/80 hover:border-brand/40"
                }`}
              >
                {provider}
              </button>
            ))}
          </div>
        </SettingRow>

        <SettingRow
          label="Server-Side API Credentials"
          description="External provider secrets are managed securely on the server via environment variables."
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-muted-foreground">
              <span>RESEND_API_KEY:</span>
              {envStatus?.resendConfigured ? (
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  Configured in Server Env
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  <AlertCircle className="size-3" />
                  Managed via .env (Server)
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleTestConnection(emailProvider)}
              className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-background/60 px-2.5 py-1.5 text-[11px] font-semibold text-foreground/80 hover:border-brand-bright/50 hover:text-foreground"
            >
              <Send className="size-3" />
              Diagnostics
            </button>
          </div>
        </SettingRow>

        <SettingRow
          label="Verified Sending Domain"
          description="DKIM and SPF verified domain matching the From header."
        >
          <input
            type="text"
            value={emailDomain}
            onChange={(e) => setEmailDomain(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>

        <SettingRow
          label="Contact Form Inbound Webhook"
          description="Endpoint receiving JSON payload whenever a visitor submits an inquiry."
        >
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full sm:w-96 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>
      </SettingsCard>

      {/* 3. Maps & Geographic Providers */}
      <SettingsCard
        title="Map Providers & Geolocation"
        description="Display interactive venue maps and location pins."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Map Rendering Engine"
          description="Vector tile mapping provider."
        >
          <select
            value={mapProvider}
            onChange={(e) => setMapProvider(e.target.value)}
            className="w-full sm:w-64 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="Mapbox GL">Mapbox GL (Vector Tiles)</option>
            <option value="Google Maps JavaScript API">Google Maps JavaScript API</option>
            <option value="OpenStreetMap Leaflet">OpenStreetMap / Leaflet (Open Source)</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Map Access Token / API Key"
          description="Public client-side key for vector map tile requests."
        >
          <input
            type="text"
            value={mapApiKey}
            onChange={(e) => setMapApiKey(e.target.value)}
            className="w-full sm:w-96 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>

        <SettingRow
          label="Map Theme Style"
          description="Customized dark futuristic vector style sheet."
        >
          <input
            type="text"
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value)}
            className="w-full sm:w-96 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>
      </SettingsCard>

      {/* 4. Bot Protection & Cloudflare Edge CDN */}
      <SettingsCard
        title="Bot Protection & Edge CDN"
        description="Prevent automated spam, mitigate DDoS threats, and accelerate global media delivery."
        badge="Coming Soon — Version 2"
      >
        <SettingRow
          label="Anti-Bot CAPTCHA Service"
          description="Frictionless verification protects registration, login, and contact forms."
        >
          <div className="flex flex-wrap items-center gap-2">
            {["Cloudflare Turnstile", "Google reCAPTCHA v3", "hCaptcha"].map((bot) => (
              <button
                key={bot}
                type="button"
                onClick={() => setCaptchaProvider(bot)}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                  captchaProvider === bot
                    ? "border-brand-bright bg-brand/20 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.2)]"
                    : "border-brand/20 bg-background/50 text-foreground/80 hover:border-brand/40"
                }`}
              >
                {bot}
              </button>
            ))}
          </div>
        </SettingRow>

        <SettingRow
          label="Public Site Key"
          description="Client-side identifier embedded in HTML forms."
        >
          <input
            type="text"
            value={captchaSiteKey}
            onChange={(e) => setCaptchaSiteKey(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5 text-[12px] font-mono text-foreground focus:border-brand-bright focus:outline-none"
          />
        </SettingRow>

        <SettingRow
          label="Content Delivery Network (CDN)"
          description="Edge caching layer routing static assets through points of presence worldwide."
        >
          <div className="flex items-center justify-between w-full sm:w-96">
            <span className="text-[12.5px] font-semibold text-foreground">{cdnProvider}</span>
            <button
              type="button"
              onClick={handlePurgeCdn}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand/35 bg-background/60 px-3 py-1.5 text-[11.5px] font-medium text-brand-bright hover:border-brand-bright hover:bg-brand/10"
            >
              <RefreshCw className="size-3.5" />
              Purge CDN Cache
            </button>
          </div>
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
