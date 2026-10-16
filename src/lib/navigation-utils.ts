/**
 * Navigation and URL resolution utilities for CobraLearn.
 *
 * Ensures route-aware navigation:
 * - Links to `#contact` or `/#contact` navigate to `/contact`.
 * - Same-page anchor links (e.g. `#projects`) on `/` scroll in-page.
 * - Same-page anchor links on other routes (e.g. `/contact`) navigate to `/#projects`.
 * - Absolute paths and external URLs are safely preserved.
 */

export function resolveNavigationHref(
  href: string | undefined | null,
  currentPath: string = "/"
): string {
  if (!href) return "#";
  const trimmed = href.trim();
  if (!trimmed) return "#";

  // Prevent dangerous protocol schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return "#";
  }

  // External, protocol-relative, mailto, and tel links (case-insensitive check)
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("//")
  ) {
    return trimmed;
  }

  // Normalize current path (e.g. "/contact/" -> "/contact")
  const normCurrent = currentPath === "/" ? "/" : currentPath.replace(/\/+$/, "");

  // If the target is the contact section or contact page
  if (
    trimmed === "#contact" ||
    trimmed === "/#contact" ||
    trimmed === "contact" ||
    trimmed === "/contact"
  ) {
    return "/contact";
  }

  if (trimmed.startsWith("/contact#")) {
    return trimmed;
  }

  // Hash link (e.g. "#projects", "#websites", "#advertisements", "#awards", "#home")
  if (trimmed.startsWith("#")) {
    if (normCurrent === "/") {
      return trimmed;
    }
    return `/${trimmed}`;
  }

  // Root-relative hash link (e.g. "/#projects")
  if (trimmed.startsWith("/#")) {
    if (normCurrent === "/") {
      return trimmed.slice(1);
    }
    return trimmed;
  }

  // Already an absolute path (e.g. "/admin/projects", "/terms")
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  // Relative path fallback (e.g. "projects" -> "/projects")
  return `/${trimmed}`;
}

