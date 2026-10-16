import {
  type TimezoneOption,
  SUPPORTED_TIMEZONES,
  DEFAULT_PORTAL_PREFERENCES,
} from "./preferences";

/**
 * Maps the human-readable timezone options to IANA timezone identifiers.
 */
export const TIMEZONE_IANA_MAP: Record<TimezoneOption, string> = {
  "(GMT+5:30) Asia/Kolkata": "Asia/Kolkata",
  "(GMT+0:00) UTC": "UTC",
  "(GMT-5:00) America/New_York": "America/New_York",
  "(GMT-8:00) America/Los_Angeles": "America/Los_Angeles",
  "(GMT+0:00) Europe/London": "Europe/London",
  "(GMT+8:00) Asia/Singapore": "Asia/Singapore",
  "(GMT+9:00) Asia/Tokyo": "Asia/Tokyo",
};

/**
 * Resolves a TimezoneOption or fallback string to a valid IANA timezone string.
 */
export function resolveIanaTimezone(timezoneOption?: string | null): string {
  if (timezoneOption && timezoneOption in TIMEZONE_IANA_MAP) {
    return TIMEZONE_IANA_MAP[timezoneOption as TimezoneOption];
  }
  return TIMEZONE_IANA_MAP[DEFAULT_PORTAL_PREFERENCES.timezone];
}

/**
 * Formats a Date using the administrator's chosen timezone and standard locale.
 */
export function formatAdminDateTime(
  date: Date | string | number | null | undefined,
  timezoneOption?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "";
  const d = typeof date === "object" && date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  const timeZone = resolveIanaTimezone(timezoneOption);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  try {
    return new Intl.DateTimeFormat("en-US", { ...defaultOptions, ...options }).format(d);
  } catch {
    return d.toLocaleString("en-US");
  }
}

/**
 * Formats a relative timestamp (e.g. "Just now", "5m ago", "2h ago") with a timezone-aware fallback.
 */
export function formatAdminRelativeTime(
  date: Date | string | number | null | undefined,
  timezoneOption?: string | null
): string {
  if (!date) return "";
  const d = typeof date === "object" && date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) {
    return "Just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return formatAdminDateTime(d, timezoneOption, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
