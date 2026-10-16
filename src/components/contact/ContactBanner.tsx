import { Link } from "@tanstack/react-router";
import { ExternalLink, Inbox, Save, ChevronRight, RotateCcw } from "lucide-react";
import { useContactMessages } from "@/lib/contact-store";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";

interface ContactBannerProps {
  onSave?: () => void;
  onReset?: () => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
}

export function ContactBanner({
  onSave,
  onReset,
  isSaving = false,
  hasUnsavedChanges = false,
}: ContactBannerProps) {
  const { t } = useAdminAppearance();
  const { messages } = useContactMessages();
  const unreadCount = messages.filter((m) => m.status === "new").length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-r from-panel via-panel-strong to-panel p-5 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.4),0_0_20px_color-mix(in_oklab,var(--brand)_10%,transparent)]">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand/10 blur-3xl" />

      {/* Top Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
        <Link to="/admin/dashboard" className="transition hover:text-brand-bright hover:underline text-brand-bright">
          {t("nav.dashboard")}
        </Link>
        <ChevronRight className="size-3 text-muted-foreground/60" />
        <span className="text-foreground">{t("nav.contactPage")}</span>
        <ChevronRight className="size-3 text-muted-foreground/60" />
        <span className="text-muted-foreground">{t("nav.management")}</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Title & Description */}
        <div>
          <h1 className="font-display text-[22px] sm:text-[26px] font-bold tracking-tight text-white flex items-center gap-2">
            <span>{t("banner.contact.title")}</span>
          </h1>
          <p className="mt-1 text-[12.5px] sm:text-[13px] text-[#94a3b8] max-w-2xl leading-relaxed">
            {t("banner.contact.subtitle")}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Inbox shortcut button */}
          <Link
            to="/admin/contact/messages"
            className="flex items-center gap-2 rounded-xl border border-brand/35 bg-background/60 px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition-all hover:border-brand-bright/60 hover:bg-brand/10 hover:text-brand-bright cursor-pointer"
          >
            <Inbox className="size-4 text-brand-bright" />
            <span>{t("common.messages")}</span>
            {unreadCount > 0 && (
              <span className="flex items-center justify-center size-5 rounded-full bg-brand-bright text-[11px] font-bold text-black shadow-[0_0_8px_var(--brand-bright)]">
                {unreadCount}
              </span>
            )}
          </Link>

          {/* View Live Page */}
          <Link
            to="/contact"
            target="_blank"
            className="flex items-center gap-1.5 rounded-xl border border-brand/35 bg-background/60 px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition-all hover:border-brand-bright/60 hover:bg-brand/10 hover:text-brand-bright cursor-pointer"
          >
            <ExternalLink className="size-4 text-brand-bright" />
            <span>{t("common.viewWebsite")}</span>
          </Link>

          {/* Reset All Changes */}
          {onReset && hasUnsavedChanges && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-xl border border-brand/25 bg-background/60 px-3 py-2 text-[12.5px] font-semibold text-muted-foreground transition-all hover:border-brand-bright/40 hover:text-white cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>{t("common.reset")}</span>
            </button>
          )}

          {/* Save All Changes */}
          {onSave && (
            <button
              type="button"
              disabled={isSaving}
              onClick={onSave}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-[12.5px] font-bold text-black shadow-[0_0_20px_color-mix(in_oklab,var(--brand-bright)_40%,transparent)] transition-all cursor-pointer ${
                hasUnsavedChanges
                  ? "bg-gradient-to-r from-[#f59e0b] via-[#38ef7d] to-[#00ff87] hover:brightness-110 shadow-[0_0_25px_rgba(0,255,135,0.5)]"
                  : "bg-brand-bright hover:bg-brand-bright/90"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="size-4 stroke-[2.5]" />
              <span>{isSaving ? t("common.saving") : t("common.save")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
