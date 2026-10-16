import { useState } from "react";
import {
  BarChart2,
  TrendingUp,
  Users,
  Eye,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Monitor,
  Compass,
  Link,
  Layers,
  Award,
  Sparkles,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/common/settings/SettingsCard";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

type DateRange = "today" | "7d" | "30d" | "90d" | "custom";

export function AnalyticsTab() {
  const { t } = useAdminAppearance();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [activeContentTab, setActiveContentTab] = useState<"projects" | "websites" | "ads" | "awards">("projects");

  const getMultiplier = () => {
    switch (dateRange) {
      case "today":
        return 0.04;
      case "7d":
        return 0.28;
      case "90d":
        return 2.85;
      case "custom":
        return 1.45;
      default:
        return 1.0;
    }
  };

  const m = getMultiplier();

  const overviewStats = [
    {
      title: "Unique Visitors",
      value: Math.round(48250 * m).toLocaleString(),
      change: "+14.2%",
      positive: true,
      sub: "vs previous period",
      icon: Users,
    },
    {
      title: "Page Views",
      value: Math.round(194820 * m).toLocaleString(),
      change: "+8.7%",
      positive: true,
      sub: "4.04 views / visitor",
      icon: Eye,
    },
    {
      title: "Total Sessions",
      value: Math.round(62400 * m).toLocaleString(),
      change: "+11.5%",
      positive: true,
      sub: "1.29 sessions / visitor",
      icon: BarChart2,
    },
    {
      title: "Bounce Rate",
      value: "28.4%",
      change: "-3.1%",
      positive: true,
      sub: "Lower is better",
      icon: TrendingUp,
    },
    {
      title: "Avg Session Duration",
      value: "3m 42s",
      change: "+18s",
      positive: true,
      sub: "High engagement",
      icon: Clock,
    },
  ];

  const topProjects = [
    { id: 1, name: "Neural Interface 3D Canvas", views: Math.round(24800 * m), ctr: "8.4%", category: "Web3D / AI" },
    { id: 2, name: "Cyberpunk Admin Design System", views: Math.round(19450 * m), ctr: "7.1%", category: "Design System" },
    { id: 3, name: "Quantum Computing Simulator", views: Math.round(14200 * m), ctr: "6.8%", category: "Simulation" },
    { id: 4, name: "Autonomous Agent Workflow Engine", views: Math.round(11850 * m), ctr: "5.9%", category: "Agentic AI" },
  ];

  const topWebsites = [
    { id: 1, name: "innotechcore.io Showcase", visits: Math.round(78400 * m), bounce: "22.1%", avgTime: "4m 12s" },
    { id: 2, name: "cobralearn.in Portal", visits: Math.round(54200 * m), bounce: "18.4%", avgTime: "6m 45s" },
    { id: 3, name: "docs.cobralearn.in Showcase Docs", visits: Math.round(29100 * m), bounce: "31.0%", avgTime: "2m 55s" },
  ];

  const topAds = [
    { id: 1, name: "Digital Innovation Showcase Launch Campaign", impressions: Math.round(89000 * m), clicks: Math.round(4120 * m), ctr: "4.63%" },
    { id: 2, name: "Enterprise Web Systems Showcase Banner", impressions: Math.round(45200 * m), clicks: Math.round(2310 * m), ctr: "5.11%" },
    { id: 3, name: "Interactive 3D Experience Spot", impressions: Math.round(38100 * m), clicks: Math.round(1680 * m), ctr: "4.41%" },
  ];

  const topAwards = [
    { id: 1, name: "Excellence in Digital Innovation Award 2026", views: Math.round(16800 * m), shares: 420 },
    { id: 2, name: "Awwwards Site of the Day Honors", views: Math.round(12400 * m), shares: 310 },
    { id: 3, name: "Global Interactive Design Trophy", views: Math.round(9800 * m), shares: 195 },
  ];

  const topCountries = [
    { country: "United States", pct: 38, count: Math.round(18335 * m) },
    { country: "India", pct: 26, count: Math.round(12545 * m) },
    { country: "Germany", pct: 12, count: Math.round(5790 * m) },
    { country: "United Kingdom", pct: 9, count: Math.round(4342 * m) },
    { country: "Canada", pct: 7, count: Math.round(3377 * m) },
  ];

  const topReferrers = [
    { source: "Google Organic Search", pct: 42, count: Math.round(20265 * m) },
    { source: "Direct Navigation", pct: 26, count: Math.round(12545 * m) },
    { source: "GitHub Repositories", pct: 18, count: Math.round(8685 * m) },
    { source: "X / Twitter Links", pct: 9, count: Math.round(4342 * m) },
    { source: "LinkedIn Network", pct: 5, count: Math.round(2412 * m) },
  ];

  return (
    <div className="space-y-4">
      {/* Header Bar with Date Range Filter */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-brand/20 bg-panel/80 p-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[17px] font-bold text-foreground text-glow flex items-center gap-2">
              <BarChart2 className="size-4 text-brand-bright" />
              Website Traffic & Audience Analytics
            </h2>
            <span className="flex items-center gap-1 rounded-full border border-brand-bright/30 bg-brand/10 px-2.5 py-0.5 text-[10.5px] font-medium text-brand-bright">
              <span>{t("settings.analytics.comingSoonV2")}</span>
            </span>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Illustrative sample telemetry. Live analytics provider telemetry integration is scheduled for Version 2.
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="inline-flex rounded-lg border border-brand/20 bg-background/60 p-1">
          {[
            { id: "today" as const, label: "Today" },
            { id: "7d" as const, label: "7 Days" },
            { id: "30d" as const, label: "30 Days" },
            { id: "90d" as const, label: "90 Days" },
            { id: "custom" as const, label: "Custom" },
          ].map((range) => (
            <button
              key={range.id}
              type="button"
              onClick={() => setDateRange(range.id)}
              className={`rounded-md px-3 py-1.5 text-[11.5px] font-medium transition ${
                dateRange === range.id
                  ? "bg-brand/25 text-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.2)] font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Overview Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {overviewStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-3.5 shadow-lg space-y-1.5"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium truncate">{stat.title}</span>
                <Icon className="size-3.5 text-brand-bright/70" />
              </div>
              <p className="font-display text-xl font-bold text-foreground text-glow">{stat.value}</p>
              <div className="flex items-center gap-1 text-[10.5px]">
                <span className="flex items-center font-semibold text-emerald-400">
                  <ArrowUpRight className="size-3" />
                  {stat.change}
                </span>
                <span className="text-muted-foreground truncate">{stat.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Content Performance Breakdown */}
      <SettingsCard
        title="Content Performance Rankings"
        description="Top viewed projects, sites, campaign banners, and global awards."
        badge="Content"
        action={
          <div className="inline-flex rounded-lg border border-brand/20 bg-background/50 p-0.5">
            {[
              { id: "projects" as const, label: "Projects" },
              { id: "websites" as const, label: "Websites" },
              { id: "ads" as const, label: "Ads" },
              { id: "awards" as const, label: "Awards" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveContentTab(tab.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  activeContentTab === tab.id
                    ? "bg-brand/20 text-brand-bright shadow-[0_0_6px_rgba(0,255,170,0.2)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      >
        {activeContentTab === "projects" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-brand/15 text-[11px] font-mono text-muted-foreground">
                  <th className="pb-2">Rank</th>
                  <th className="pb-2">Project Name</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Total Views</th>
                  <th className="pb-2 text-right">Click-Through Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand/10">
                {topProjects.map((p, idx) => (
                  <tr key={p.id} className="text-foreground/90">
                    <td className="py-2.5 font-mono text-[11px] text-brand-bright font-bold">#{idx + 1}</td>
                    <td className="py-2.5 font-semibold text-foreground">{p.name}</td>
                    <td className="py-2.5 text-muted-foreground">{p.category}</td>
                    <td className="py-2.5 font-mono text-[11.5px] text-brand-bright">{p.views.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-emerald-400">{p.ctr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeContentTab === "websites" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-brand/15 text-[11px] font-mono text-muted-foreground">
                  <th className="pb-2">Rank</th>
                  <th className="pb-2">Website Domain</th>
                  <th className="pb-2">Total Visits</th>
                  <th className="pb-2">Bounce Rate</th>
                  <th className="pb-2 text-right">Avg Time on Site</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand/10">
                {topWebsites.map((w, idx) => (
                  <tr key={w.id} className="text-foreground/90">
                    <td className="py-2.5 font-mono text-[11px] text-brand-bright font-bold">#{idx + 1}</td>
                    <td className="py-2.5 font-semibold text-foreground font-mono">{w.name}</td>
                    <td className="py-2.5 font-mono text-[11.5px] text-brand-bright">{w.visits.toLocaleString()}</td>
                    <td className="py-2.5 text-muted-foreground font-mono">{w.bounce}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-emerald-400">{w.avgTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeContentTab === "ads" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-brand/15 text-[11px] font-mono text-muted-foreground">
                  <th className="pb-2">Rank</th>
                  <th className="pb-2">Advertisement Campaign</th>
                  <th className="pb-2">Impressions</th>
                  <th className="pb-2">Total Clicks</th>
                  <th className="pb-2 text-right">Conversion CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand/10">
                {topAds.map((ad, idx) => (
                  <tr key={ad.id} className="text-foreground/90">
                    <td className="py-2.5 font-mono text-[11px] text-brand-bright font-bold">#{idx + 1}</td>
                    <td className="py-2.5 font-semibold text-foreground">{ad.name}</td>
                    <td className="py-2.5 font-mono text-[11.5px] text-muted-foreground">{ad.impressions.toLocaleString()}</td>
                    <td className="py-2.5 font-mono text-[11.5px] text-brand-bright">{ad.clicks.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-emerald-400">{ad.ctr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeContentTab === "awards" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-brand/15 text-[11px] font-mono text-muted-foreground">
                  <th className="pb-2">Rank</th>
                  <th className="pb-2">Award Distinction</th>
                  <th className="pb-2">Total Reads</th>
                  <th className="pb-2 text-right">Social Shares</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand/10">
                {topAwards.map((aw, idx) => (
                  <tr key={aw.id} className="text-foreground/90">
                    <td className="py-2.5 font-mono text-[11px] text-brand-bright font-bold">#{idx + 1}</td>
                    <td className="py-2.5 font-semibold text-foreground">{aw.name}</td>
                    <td className="py-2.5 font-mono text-[11.5px] text-brand-bright">{aw.views.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-emerald-400">{aw.shares}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsCard>

      {/* 3. Traffic Channels, Geographic & Device Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Geographic Countries */}
        <SettingsCard
          title="Top Visitor Locations"
          description="Geographic audience distribution by country."
          badge="Countries"
        >
          <div className="space-y-3">
            {topCountries.map((c) => (
              <div key={c.country} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-foreground">{c.country}</span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-muted-foreground">{c.count.toLocaleString()}</span>
                    <span className="text-brand-bright font-bold">{c.pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-background/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.5)]"
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>

        {/* Traffic Referrers */}
        <SettingsCard
          title="Top Acquisition Channels"
          description="Inbound referral origins driving user sessions."
          badge="Referrers"
        >
          <div className="space-y-3">
            {topReferrers.map((r) => (
              <div key={r.source} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-foreground">{r.source}</span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-muted-foreground">{r.count.toLocaleString()}</span>
                    <span className="text-brand-bright font-bold">{r.pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-background/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-brand-bright shadow-[0_0_8px_rgba(0,255,170,0.4)]"
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
      </div>

      {/* 4. Devices & Browsers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SettingsCard
          title="Hardware Devices"
          description="Form factor breakdown across visitors."
          badge="Hardware"
        >
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="rounded-lg border border-brand/20 bg-background/50 p-3">
              <Monitor className="size-5 mx-auto text-brand-bright mb-1" />
              <p className="text-[11px] text-muted-foreground">Desktop</p>
              <p className="font-display text-lg font-bold text-foreground">64%</p>
            </div>
            <div className="rounded-lg border border-brand/20 bg-background/50 p-3">
              <Compass className="size-5 mx-auto text-brand-bright mb-1" />
              <p className="text-[11px] text-muted-foreground">Mobile</p>
              <p className="font-display text-lg font-bold text-foreground">31%</p>
            </div>
            <div className="rounded-lg border border-brand/20 bg-background/50 p-3">
              <Layers className="size-5 mx-auto text-brand-bright mb-1" />
              <p className="text-[11px] text-muted-foreground">Tablet</p>
              <p className="font-display text-lg font-bold text-foreground">5%</p>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Web Browsers"
          description="Rendering engines used to access your applications."
          badge="Browsers"
        >
          <div className="grid grid-cols-4 gap-2 text-center pt-1">
            <div className="rounded-lg border border-brand/20 bg-background/50 p-2.5">
              <p className="text-[11px] text-muted-foreground">Chrome</p>
              <p className="font-display text-base font-bold text-foreground">68%</p>
            </div>
            <div className="rounded-lg border border-brand/20 bg-background/50 p-2.5">
              <p className="text-[11px] text-muted-foreground">Safari</p>
              <p className="font-display text-base font-bold text-foreground">18%</p>
            </div>
            <div className="rounded-lg border border-brand/20 bg-background/50 p-2.5">
              <p className="text-[11px] text-muted-foreground">Edge</p>
              <p className="font-display text-base font-bold text-foreground">9%</p>
            </div>
            <div className="rounded-lg border border-brand/20 bg-background/50 p-2.5">
              <p className="text-[11px] text-muted-foreground">Firefox</p>
              <p className="font-display text-base font-bold text-foreground">5%</p>
            </div>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
