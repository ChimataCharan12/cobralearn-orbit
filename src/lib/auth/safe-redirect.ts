/**
 * Safe redirect validator to prevent Open Redirect vulnerabilities.
 * Ensures the target destination is a valid internal relative path.
 */
export function safeRedirect(target?: string | null, fallback = "/admin/dashboard"): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();

  // Reject empty string
  if (!trimmed) {
    return fallback;
  }

  // Reject protocol-relative URLs (e.g. "//evil.com")
  if (trimmed.startsWith("//") || trimmed.startsWith("\\\\")) {
    return fallback;
  }

  // Must start with single slash "/"
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // Reject dangerous URI schemes embedded in paths
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("javascript:") ||
    lower.includes("data:") ||
    lower.includes("vbscript:") ||
    lower.startsWith("/\\") ||
    lower.includes("\r") ||
    lower.includes("\n")
  ) {
    return fallback;
  }

  // Validate that it does not contain external domain constructs
  try {
    const url = new URL(trimmed, "http://localhost");
    // Ensure origin is local and pathname matches trimmed relative path
    if (url.origin !== "http://localhost") {
      return fallback;
    }
    return trimmed;
  } catch {
    return fallback;
  }
}
