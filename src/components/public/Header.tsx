import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { NavigationItem } from "@prisma/client";
import { BrandMark } from "./BrandMark";
import { Button } from "@/components/ui/button";
import { isSectionAnchor, resolveNavigationHref } from "@/lib/navigation-utils";

const defaultLinks = [
  { label: "HOME", to: "/", hash: "home" },
  { label: "PROJECTS", to: "/", hash: "projects" },
  { label: "WEBSITES", to: "/", hash: "websites" },
  { label: "ADVERTISEMENTS", to: "/", hash: "advertisements" },
  { label: "AWARDS", to: "/", hash: "awards" },
  { label: "CONTACT", to: "/contact", hash: undefined },
];

interface HeaderProps {
  navItems?: NavigationItem[];
}

export function Header({ navItems }: HeaderProps = {}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isDbConfigured = navItems !== undefined;
  const activeNavItems = (navItems || []).filter((item) => item.status === "ACTIVE");

  return (
    <header className={scrolled ? "site-header is-scrolled" : "site-header"}>
      <BrandMark />
      <nav className={open ? "site-nav is-open" : "site-nav"} aria-label="Primary navigation">
        {isDbConfigured ? (
          activeNavItems.map((item) => {
            const resolvedHref = resolveNavigationHref(item.link, pathname);
            const isContact = resolvedHref === "/contact";
            const labelText = item.label.toUpperCase();
            const isButton = item.type === "BUTTON";
            const isAnchor = isSectionAnchor(resolvedHref) || isSectionAnchor(item.link);
            const target = !isAnchor && item.openInNewTab ? "_blank" : undefined;
            const rel = !isAnchor && item.openInNewTab ? "noreferrer" : undefined;

            if (isContact) {
              const isActive = pathname === "/contact" || pathname === "/contact/";
              return (
                <Link
                  key={item.id}
                  to="/contact"
                  target={target}
                  rel={rel}
                  className={isButton ? "nav-button-pill" : (isActive ? "is-active" : "")}
                  onClick={() => setOpen(false)}
                >
                  {labelText}
                </Link>
              );
            }

            return (
              <a
                key={item.id}
                href={resolvedHref}
                target={target}
                rel={rel}
                className={isButton ? "nav-button-pill" : ""}
                onClick={() => setOpen(false)}
              >
                {labelText}
              </a>
            );
          })
        ) : (
          defaultLinks.map(({ label, to, hash }) => {
            const isContact = to === "/contact";
            const isActive = isContact && (pathname === "/contact" || pathname === "/contact/");

            if (isContact) {
              return (
                <Link
                  key={label}
                  to="/contact"
                  className={isActive ? "is-active" : ""}
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              );
            }

            // If on home page, scroll directly, else navigate to /#hash
            return (
              <a
                key={label}
                href={pathname === "/" ? `#${hash}` : `/#${hash}`}
                onClick={() => setOpen(false)}
              >
                {label}
              </a>
            );
          })
        )}
      </nav>
      <Button
        variant="ghost"
        size="icon"
        className="menu-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <X /> : <Menu />}
      </Button>
    </header>
  );
}
