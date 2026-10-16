import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Box,
  ChevronRight,
  Home,
  Image as ImageIcon,
  LayoutTemplate,
  LogOut,
  Megaphone as MegaphoneIcon,
  Menu,
  MessageSquareText,
  Monitor,
  Settings,
  Sparkles,
  Trophy,
  User,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { toast } from "sonner";

import { authService } from "@/lib/auth/auth-service";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";
import { useAdminNotifications } from "@/lib/notifications/use-admin-notifications";
import { SignOutModal } from "@/components/modals/SignOutModal";
import emblem from "@/assets/cobralearn-emblem.png";
import env from "@/assets/cobralearn-admin-environment.jpg";

type Item = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  chevron?: boolean;
  to?: string;
  action?: () => void;
  badge?: number;
};

export function AdminSidebar({
  onNavigate,
  onLogoutClick,
}: {
  onNavigate?: (() => void) | undefined;
  onLogoutClick?: (() => void) | undefined;
}) {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [internalSignOutOpen, setInternalSignOutOpen] = useState(false);
  const { sidebarCollapse, t } = useAdminAppearance();
  const { unreadCount } = useAdminNotifications({ pollIntervalMs: 30000 });

  // Mobile drawer (when onNavigate is passed) never collapses
  const isMobile = Boolean(onNavigate);
  const isCollapsed = !isMobile && sidebarCollapse;

  const isDashboardActive = currentPath === "/admin/dashboard" || currentPath === "/admin/dashboard/" || currentPath === "/admin";
  const isProjectsActive = currentPath.startsWith("/admin/projects");
  const isWebsitesActive = currentPath.startsWith("/admin/websites");
  const isAdvertisementsActive = currentPath.startsWith("/admin/advertisements");
  const isAwardsActive = currentPath.startsWith("/admin/awards");
  const isNotificationsActive = currentPath.startsWith("/admin/notifications");
  const isMediaLibraryActive = currentPath.startsWith("/admin/media");
  const isHomepageActive = currentPath.startsWith("/admin/homepage");
  const isNavigationFooterActive = currentPath.startsWith("/admin/navigation");
  const isContactActive = currentPath.startsWith("/admin/contact");
  const isAppearanceActive = currentPath.startsWith("/admin/appearance");
  const isSettingsActive = currentPath.startsWith("/admin/settings");
  const isAdminProfileActive = currentPath.startsWith("/admin/profile");

  const handleConfirmSignOut = async () => {
    await authService.signOut();
    setInternalSignOutOpen(false);
    if (onNavigate) onNavigate();
    navigate({ to: "/admin" });
  };

  const contentItems: Item[] = [
    { label: t("nav.projects"), icon: Box, chevron: true, to: "/admin/projects" },
    { label: t("nav.websites"), icon: Monitor, chevron: true, to: "/admin/websites" },
    { label: t("nav.advertisements"), icon: MegaphoneIcon, chevron: true, to: "/admin/advertisements" },
    { label: t("nav.awards"), icon: Trophy, chevron: true, to: "/admin/awards" },
  ];

  const managementItems: Item[] = [
    { label: t("nav.notifications"), icon: Bell, chevron: true, to: "/admin/notifications", badge: unreadCount },
    { label: t("nav.mediaLibrary"), icon: ImageIcon, chevron: true, to: "/admin/media" },
    { label: t("nav.homepage"), icon: LayoutTemplate, chevron: true, to: "/admin/homepage" },
    { label: t("nav.navigationFooter"), icon: Menu, chevron: true, to: "/admin/navigation" },
    { label: t("nav.contact"), icon: MessageSquareText, chevron: true, to: "/admin/contact" },
  ];

  const customizationItems: Item[] = [
    { label: t("nav.appearanceAnimation"), icon: Sparkles, to: "/admin/appearance" },
    { label: t("nav.siteSettings"), icon: Settings, to: "/admin/settings" },
  ];

  const navBase = isCollapsed
    ? "flex w-full items-center justify-center rounded-lg p-2.5 text-center text-[14px] font-medium text-foreground/85 transition-all duration-200 hover:bg-brand/12 hover:text-brand-bright"
    : "flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium text-foreground/85 transition-all duration-200 hover:bg-brand/12 hover:text-brand-bright";

  const navActive = isCollapsed
    ? "nav-active-item flex items-center justify-center rounded-lg p-2.5 text-[14px] font-semibold text-foreground cursor-default"
    : "nav-active-item flex items-center gap-3.5 rounded-lg px-3 py-2.5 text-[14px] font-semibold text-foreground cursor-default";

  return (
    <aside
      className={`relative flex h-full ${
        isCollapsed ? "w-[68px] px-1.5" : "w-[220px] px-2.5"
      } flex-col overflow-hidden border-r border-brand/20 bg-panel-strong pb-5 pt-3.5 transition-all duration-200`}
    >
      {/* Background rocky artwork — environmental atmospheric light */}
      <img
        src={env}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-[230px] w-full object-cover object-left-bottom opacity-40 [mask-image:linear-gradient(to_top,black_30%,transparent)]"
      />
      {/* Atmospheric glow at bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-[160px] w-full bg-gradient-to-t from-brand/12 to-transparent" />

      {/* Brand Header */}
      <div
        className={`relative flex items-center ${
          isCollapsed ? "justify-center" : "gap-2"
        } px-1.5 pb-3 border-b border-brand/15`}
      >
        <img src={emblem} alt="CobraLearn" className="size-11 object-contain brand-glow shrink-0" />
        {!isCollapsed && (
          <div>
            <p className="font-display text-[17px] font-semibold leading-none text-brand text-glow">CobraLearn</p>
            <p className="mt-0.5 text-[10.5px] font-semibold tracking-[0.22em] text-brand-cyan">innotechcore</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="relative mt-3 flex-1 overflow-y-auto pr-0.5">
        {/* Dashboard Link */}
        {isDashboardActive ? (
          <div className={navActive} title={t("nav.dashboard")}>
            <Home className="size-5 text-brand-bright drop-shadow-[0_0_6px_var(--brand-bright)] shrink-0" />
            {!isCollapsed && <span className="flex-1">{t("nav.dashboard")}</span>}
            {!isCollapsed && <ChevronRight className="size-4 text-brand-bright" />}
          </div>
        ) : (
          <Link
            to="/admin/dashboard"
            onClick={onNavigate}
            className={navBase}
            title={t("nav.dashboard")}
          >
            <Home className="size-5 text-foreground/70 shrink-0" />
            {!isCollapsed && <span className="flex-1">{t("nav.dashboard")}</span>}
          </Link>
        )}

        {/* Content Group */}
        <div className="mt-4">
          {!isCollapsed ? (
            <p className="mb-1.5 px-3 font-display text-[9.5px] font-semibold tracking-[0.32em] text-brand/90">
              {t("nav.group.content")}
            </p>
          ) : (
            <div className="my-2 border-t border-brand/12" />
          )}
          <div className="space-y-0.5">
            {contentItems.map((item) => {
              const Icon = item.icon;
              const isItemActive =
                (item.to === "/admin/projects" && isProjectsActive) ||
                (item.to === "/admin/websites" && isWebsitesActive) ||
                (item.to === "/admin/advertisements" && isAdvertisementsActive) ||
                (item.to === "/admin/awards" && isAwardsActive);

              if (isItemActive) {
                return (
                  <div
                    key={item.label}
                    className={navActive}
                    title={item.label}
                  >
                    <Icon className="size-5 text-brand-bright drop-shadow-[0_0_6px_var(--brand-bright)] shrink-0" />
                    {!isCollapsed && <span className="flex-1">{item.label}</span>}
                    {!isCollapsed && <ChevronRight className="size-4 text-brand-bright" />}
                  </div>
                );
              }

              if (item.to) {
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={onNavigate}
                    className={navBase}
                    title={item.label}
                  >
                    <Icon className="size-5 shrink-0 text-foreground/70" />
                    {!isCollapsed && <span className="flex-1">{item.label}</span>}
                    {!isCollapsed && item.chevron && <ChevronRight className="size-4 text-muted-foreground/70" />}
                  </Link>
                );
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={navBase}
                  title={item.label}
                >
                  <Icon className="size-5 shrink-0 text-foreground/70" />
                  {!isCollapsed && <span className="flex-1">{item.label}</span>}
                  {!isCollapsed && item.chevron && <ChevronRight className="size-4 text-muted-foreground/70" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Management Group */}
        <div className="mt-4">
          {!isCollapsed ? (
            <p className="mb-1.5 px-3 font-display text-[9.5px] font-semibold tracking-[0.32em] text-brand/90">
              {t("nav.group.management")}
            </p>
          ) : (
            <div className="my-2 border-t border-brand/12" />
          )}
          <div className="space-y-0.5">
            {managementItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                (item.to === "/admin/notifications" && isNotificationsActive) ||
                (item.to === "/admin/media" && isMediaLibraryActive) ||
                (item.to === "/admin/homepage" && isHomepageActive) ||
                (item.to === "/admin/navigation" && isNavigationFooterActive) ||
                (item.to === "/admin/contact" && isContactActive);

              if (item.to) {
                if (isActive) {
                  return (
                    <div
                      key={item.label}
                      className={navActive}
                      title={item.label}
                    >
                      <span className="relative inline-flex items-center justify-center shrink-0">
                        <Icon className="size-5 text-brand-bright drop-shadow-[0_0_6px_var(--brand-bright)]" />
                        {isCollapsed && item.badge && item.badge > 0 ? (
                          <span className="absolute -top-1 -right-1 size-2 rounded-full bg-destructive shadow-[0_0_6px_var(--color-destructive)]" />
                        ) : null}
                      </span>
                      {!isCollapsed && <span className="flex-1">{item.label}</span>}
                      {!isCollapsed && item.badge && item.badge > 0 ? (
                        <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      ) : null}
                      {!isCollapsed && item.chevron && <ChevronRight className="size-4 text-brand-bright" />}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={onNavigate}
                    className={navBase}
                    title={item.label}
                  >
                    <span className="relative inline-flex items-center justify-center shrink-0">
                      <Icon className="size-5 text-foreground/70" />
                      {isCollapsed && item.badge && item.badge > 0 ? (
                        <span className="absolute -top-1 -right-1 size-2 rounded-full bg-destructive shadow-[0_0_6px_var(--color-destructive)]" />
                      ) : null}
                    </span>
                    {!isCollapsed && <span className="flex-1">{item.label}</span>}
                    {!isCollapsed && item.badge && item.badge > 0 ? (
                      <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                    {!isCollapsed && item.chevron && <ChevronRight className="size-4 text-muted-foreground/70" />}
                  </Link>
                );
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={navBase}
                  title={item.label}
                >
                  <Icon className="size-5 shrink-0 text-foreground/70" />
                  {!isCollapsed && <span className="flex-1">{item.label}</span>}
                  {!isCollapsed && item.chevron && <ChevronRight className="size-4 text-muted-foreground/70" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Customization Group */}
        <div className="mt-4">
          {!isCollapsed ? (
            <p className="mb-1.5 px-3 font-display text-[9.5px] font-semibold tracking-[0.32em] text-brand/90">
              {t("nav.group.customization")}
            </p>
          ) : (
            <div className="my-2 border-t border-brand/12" />
          )}
          <div className="space-y-0.5">
            {customizationItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                (item.to === "/admin/appearance" && isAppearanceActive) ||
                (item.to === "/admin/settings" && isSettingsActive);

              if (item.to) {
                if (isActive) {
                  return (
                    <div
                      key={item.label}
                      className={navActive}
                      title={item.label}
                    >
                      <Icon className="size-5 shrink-0 text-brand-bright drop-shadow-[0_0_6px_var(--brand-bright)]" />
                      {!isCollapsed && <span className="flex-1">{item.label}</span>}
                      {!isCollapsed && <ChevronRight className="size-4 text-brand-bright" />}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={onNavigate}
                    className={navBase}
                    title={item.label}
                  >
                    <Icon className="size-5 shrink-0 text-foreground/70" />
                    {!isCollapsed && <span className="flex-1">{item.label}</span>}
                  </Link>
                );
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={navBase}
                  title={item.label}
                >
                  <Icon className="size-5 shrink-0 text-foreground/70" />
                  {!isCollapsed && <span className="flex-1">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* User / Profile & Logout */}
        <div className="mt-4 border-t border-brand/12 pt-2">
          {isAdminProfileActive ? (
            <div className={navActive} title={t("nav.adminProfile")}>
              <User className="size-5 shrink-0 text-brand-bright drop-shadow-[0_0_6px_var(--brand-bright)]" />
              {!isCollapsed && <span className="flex-1">{t("nav.adminProfile")}</span>}
            </div>
          ) : (
            <Link
              to="/admin/profile"
              onClick={onNavigate}
              className={navBase}
              title={t("nav.adminProfile")}
            >
              <User className="size-5 text-foreground/70 shrink-0" />
              {!isCollapsed && <span className="flex-1">{t("nav.adminProfile")}</span>}
            </Link>
          )}
          <button
            type="button"
            title={t("nav.logout")}
            onClick={() => {
              if (onLogoutClick) {
                onLogoutClick();
              } else {
                setInternalSignOutOpen(true);
              }
            }}
            className={
              isCollapsed
                ? "flex w-full items-center justify-center rounded-lg p-2.5 text-center text-[14px] font-medium text-foreground/85 transition-all duration-200 hover:bg-destructive/12 hover:text-red-400 cursor-pointer"
                : "flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium text-foreground/85 transition-all duration-200 hover:bg-destructive/12 hover:text-red-400 cursor-pointer"
            }
          >
            <LogOut className="size-5 text-foreground/70 shrink-0" />
            {!isCollapsed && <span className="flex-1">{t("nav.logout")}</span>}
          </button>
        </div>
      </nav>

      {/* Sign Out Confirmation Modal when not controlled by parent */}
      {!onLogoutClick && (
        <SignOutModal
          open={internalSignOutOpen}
          onOpenChange={setInternalSignOutOpen}
          onConfirm={handleConfirmSignOut}
          onCancel={() => setInternalSignOutOpen(false)}
        />
      )}

      {/* Footer Branding Slogan */}
      {!isCollapsed ? (
        <div className="relative mt-2 px-3 text-[11.5px] leading-snug text-foreground/70">
          <p>Innovate</p>
          <p>Learn</p>
          <p>Achieve</p>
          <div className="mt-2 h-0.5 w-8 rounded-full bg-brand-bright shadow-[0_0_10px_var(--brand-bright)]" />
        </div>
      ) : (
        <div className="relative mt-2 flex justify-center">
          <div className="h-0.5 w-4 rounded-full bg-brand-bright shadow-[0_0_10px_var(--brand-bright)]" />
        </div>
      )}
    </aside>
  );
}

function MegaphoneIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}
