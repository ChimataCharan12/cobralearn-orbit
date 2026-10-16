import { useState, useEffect } from "react";
import { ChevronDown, LogOut, Menu, Search, User } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authService } from "@/lib/auth/auth-service";
import { useAdminProfile } from "@/lib/auth/use-admin-profile";
import { useAdminAppearance } from "@/lib/theme/admin-appearance-context";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SignOutModal } from "@/components/modals/SignOutModal";
import { GlobalSearchModal } from "@/components/search/GlobalSearchModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdminHeaderProps {
  onMenu: () => void;
  searchPlaceholder?: string;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  onLogoutClick?: () => void;
}

export function AdminHeader({
  onMenu,
  searchPlaceholder = "Search anything...",
  searchTerm,
  onSearchChange,
  onLogoutClick,
}: AdminHeaderProps) {
  const navigate = useNavigate();
  const { profile } = useAdminProfile();
  const { t } = useAdminAppearance();
  const [internalSearch, setInternalSearch] = useState("");
  const [signOutOpen, setSignOutOpen] = useState(false);

  const displayName = profile?.fullName?.trim() || (profile?.email ? profile.email.split("@")[0] : "Admin") || "Admin";
  const avatarLetter = (displayName.charAt(0) || "A").toUpperCase();
  const avatarUrl = profile?.avatarUrl;
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const roleLabel =
    profile?.role === "SUPER_ADMIN"
      ? t("header.role.superAdmin")
      : profile?.role === "EDITOR"
      ? t("header.role.editor")
      : t("header.role.admin");

  const searchValue = searchTerm !== undefined ? searchTerm : internalSearch;
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setInternalSearch(val);
    }
  };

  const handleConfirmSignOut = async () => {
    await authService.signOut();
    setSignOutOpen(false);
    navigate({ to: "/admin" });
  };

  return (
    <header className="flex items-center gap-3 py-1">
      {/* Mobile Hamburger */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="dash-panel grid size-10 shrink-0 place-items-center rounded-full lg:hidden"
      >
        <Menu className="size-5 text-brand-bright" />
      </button>

      {/* Global Search Bar */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!onSearchChange) {
            setSearchModalOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (!onSearchChange && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setSearchModalOpen(true);
          }
        }}
        aria-label="Search admin portal"
        className="dash-panel flex h-10 w-full max-w-[420px] items-center gap-2.5 rounded-full border border-brand/25 bg-panel px-4 cursor-pointer hover:border-brand/40 transition"
      >
        <Search className="size-4 shrink-0 text-foreground/55" />
        {onSearchChange ? (
          <input
            value={searchValue}
            onChange={handleSearch}
            placeholder={searchPlaceholder || t("header.searchPlaceholder")}
            className="w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="w-full text-[13.5px] text-muted-foreground select-none truncate">
            {searchPlaceholder || t("header.searchPlaceholder")}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSearchModalOpen(true);
          }}
          aria-label="Open global search (Ctrl+K)"
          className="hidden shrink-0 items-center gap-1 sm:flex hover:opacity-80 transition cursor-pointer"
        >
          <kbd className="rounded border border-brand/25 bg-brand/8 px-1.5 py-0.5 text-[10.5px] font-medium text-brand/80">
            Ctrl
          </kbd>
          <kbd className="rounded border border-brand/25 bg-brand/8 px-1.5 py-0.5 text-[10.5px] font-medium text-brand/80">
            K
          </kbd>
        </button>
      </div>

      {/* Right Actions */}
      <div className="ml-auto flex items-center gap-3">
        {/* Notification Bell */}
        <NotificationBell />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-full p-0.5 transition hover:opacity-90 outline-none"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="size-9 rounded-full object-cover border border-brand-bright/75"
                  style={{
                    boxShadow: "0 0 12px color-mix(in oklab, var(--brand-bright) 28%, transparent)",
                  }}
                />
              ) : (
                <span
                  className="grid size-9 place-items-center rounded-full border border-brand-bright/75 text-[16px] font-bold text-brand-bright"
                  style={{
                    background: "radial-gradient(circle at 40% 35%, color-mix(in oklab, var(--brand) 25%, transparent), color-mix(in oklab, var(--background) 70%, transparent))",
                    boxShadow: "0 0 12px color-mix(in oklab, var(--brand-bright) 28%, transparent), inset 0 0 10px color-mix(in oklab, var(--brand) 20%, transparent)",
                  }}
                >
                  {avatarLetter}
                </span>
              )}
              <span className="hidden text-left sm:block">
                <span className="block text-[13.5px] font-semibold leading-tight text-foreground truncate max-w-[140px]">{displayName}</span>
                <span className="block text-[10.5px] text-muted-foreground">{roleLabel}</span>
              </span>
              <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 border-brand/30 bg-panel-strong backdrop-blur-xl">
            <DropdownMenuLabel className="font-display text-[11px] tracking-widest text-brand">ADMIN ACCOUNT</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/30" />
            <DropdownMenuItem
              onClick={() => navigate({ to: "/admin/profile" })}
              className="cursor-pointer gap-2 text-[13px] text-foreground/90 focus:bg-brand/15 focus:text-brand-bright"
            >
              <User className="size-4" /> Profile Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/30" />
            <DropdownMenuItem
              onClick={() => {
                if (onLogoutClick) {
                  onLogoutClick();
                } else {
                  setSignOutOpen(true);
                }
              }}
              className="cursor-pointer gap-2 text-[13px] text-destructive focus:bg-destructive/15 focus:text-destructive"
            >
              <LogOut className="size-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!onLogoutClick && (
        <SignOutModal
          open={signOutOpen}
          onOpenChange={setSignOutOpen}
          onConfirm={handleConfirmSignOut}
          onCancel={() => setSignOutOpen(false)}
        />
      )}

      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </header>
  );
}
