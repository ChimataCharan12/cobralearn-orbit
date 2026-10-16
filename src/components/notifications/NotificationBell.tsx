import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Layers,
  Mail,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAdminNotifications } from "@/lib/notifications/use-admin-notifications";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";
import type { AdminNotification } from "@prisma/client";

function getCategoryMeta(category: string, t: (k: any) => string) {
  switch (category) {
    case "CONTACT_INQUIRY":
      return {
        label: t("notif.category.contactInquiry"),
        icon: Mail,
        colorClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
      };
    case "CONTENT_UPDATE":
      return {
        label: t("notif.category.contentUpdate"),
        icon: Layers,
        colorClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      };
    case "SECURITY_ALERT":
      return {
        label: t("notif.category.securityAlert"),
        icon: ShieldAlert,
        colorClass: "bg-red-500/15 text-red-400 border-red-500/30",
      };
    case "ADMIN_ACTIVITY":
      return {
        label: t("notif.category.adminActivity"),
        icon: UserCheck,
        colorClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
      };
    case "SYSTEM_ANNOUNCEMENT":
    default:
      return {
        label: t("notif.category.announcement"),
        icon: Megaphone,
        colorClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      };
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch,
    markAsRead,
    markAllAsRead,
  } = useAdminNotifications({ pollIntervalMs: 30000 });
  const { t, formatRelativeTime } = useAdminAppearance();

  const handleNotificationClick = async (notif: AdminNotification) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    if (notif.link) {
      setOpen(false);
      navigate({ to: notif.link });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("header.notifications")}
          className="dash-panel relative grid size-10 place-items-center rounded-full border border-brand/25 transition hover:border-brand-bright cursor-pointer"
        >
          <Bell className="size-4.5 text-foreground/80" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-[0_0_8px_var(--color-destructive)]"
              aria-label={`${unreadCount} ${t("header.unreadAlerts")}`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="z-50 w-[360px] sm:w-[420px] rounded-xl border border-brand/25 bg-panel/95 p-0 text-foreground backdrop-blur-xl shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand/15 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] font-semibold text-foreground">
              {t("notif.title")}
            </span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[11px] font-semibold text-brand-bright border border-brand/30">
                {unreadCount} {t("notif.unreadBadge")}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllAsRead()}
              className="flex items-center gap-1.5 text-[11.5px] font-medium text-brand-bright hover:underline transition cursor-pointer"
            >
              <CheckCheck className="size-3.5" />
              <span>{t("notif.markAllRead")}</span>
            </button>
          )}
        </div>

        {/* Content list */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-brand/10">
          {isLoading && notifications.length === 0 ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="size-8 rounded-full bg-brand/10 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-1/3 rounded bg-brand/15" />
                    <div className="h-2.5 w-full rounded bg-brand/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center space-y-2">
              <p className="text-xs text-destructive">{error}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 text-xs text-brand-bright hover:underline cursor-pointer"
              >
                <RefreshCw className="size-3" /> {t("notif.retry")}
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand/10 text-brand-bright border border-brand/20 shadow-[0_0_12px_rgba(0,255,170,0.1)]">
                <Bell className="size-5" />
              </div>
              <p className="font-display text-sm font-semibold text-foreground">
                {t("notif.emptyTitle")}
              </p>
              <p className="text-xs text-muted-foreground max-w-[260px] mx-auto">
                {t("notif.emptyDesc")}
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const meta = getCategoryMeta(n.category, t);
              const CategoryIcon = meta.icon;

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`group relative flex items-start gap-3 p-3.5 transition-colors cursor-pointer hover:bg-brand/8 ${
                    !n.isRead ? "bg-brand/4" : "opacity-80"
                  }`}
                >
                  {/* Category icon */}
                  <div
                    className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border text-xs ${meta.colorClass}`}
                  >
                    <CategoryIcon className="size-4" />
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.2 rounded border bg-panel text-muted-foreground">
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>

                    <p className={`text-xs font-semibold leading-snug text-foreground ${!n.isRead ? "text-glow" : ""}`}>
                      {n.title}
                    </p>
                    <p className="text-[11.5px] leading-relaxed text-muted-foreground line-clamp-2">
                      {n.message}
                    </p>

                    {n.link && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] text-brand-bright font-medium mt-1">
                        {t("notif.viewDetails")} <ExternalLink className="size-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Unread indicator / mark read */}
                  {!n.isRead ? (
                    <button
                      type="button"
                      title={t("notif.markAsRead")}
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(n.id);
                      }}
                      className="mt-1 size-2 rounded-full bg-brand-bright shadow-[0_0_6px_var(--brand-bright)] shrink-0 transition group-hover:scale-125"
                    />
                  ) : (
                    <div className="mt-1 size-2 rounded-full bg-transparent shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Link to Dedicated Page */}
        <div className="border-t border-brand/15 p-2.5 text-center bg-panel-strong/60">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/admin/notifications" });
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-brand-bright hover:bg-brand/10 transition cursor-pointer"
          >
            <span>{t("notif.viewAll")}</span>
            <ExternalLink className="size-3" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
