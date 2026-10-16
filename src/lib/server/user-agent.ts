/**
 * Lightweight, safe User-Agent parser for Admin Login History.
 * Bounded to 500 characters max, avoids catastrophic backtracking,
 * and extracts standard categorical browser, OS, and device types.
 */

export interface ParsedUserAgent {
  browser: string;
  os: string;
  deviceType: "Desktop" | "Mobile" | "Tablet" | "Unknown";
}

export function parseUserAgent(uaString: string | null | undefined): ParsedUserAgent {
  if (!uaString) {
    return { browser: "Unknown", os: "Unknown", deviceType: "Unknown" };
  }

  // Bound string length strictly to prevent regex/string DoS
  const ua = uaString.trim().slice(0, 500);
  if (!ua) {
    return { browser: "Unknown", os: "Unknown", deviceType: "Unknown" };
  }

  // 1. Detect Operating System
  let os = "Unknown";
  if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/windows nt 10/i.test(ua)) os = "Windows 10/11";
  else if (/windows nt 6\.3/i.test(ua)) os = "Windows 8.1";
  else if (/windows nt 6\.2/i.test(ua)) os = "Windows 8";
  else if (/windows nt 6\.1/i.test(ua)) os = "Windows 7";
  else if (/windows nt/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/cros/i.test(ua)) os = "ChromeOS";
  else if (/linux/i.test(ua)) os = "Linux";

  // 2. Detect Device Type
  let deviceType: ParsedUserAgent["deviceType"] = "Unknown";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    deviceType = "Tablet";
  } else if (/mobile|iphone|ipod|android.*mobile|blackberry|windows phone/i.test(ua)) {
    deviceType = "Mobile";
  } else if (/windows|macintosh|mac os x|linux|cros|x11/i.test(ua) || os !== "Unknown") {
    deviceType = "Desktop";
  }

  // 3. Detect Browser (Order matters for Chromium-based and multi-token browsers)
  let browser = "Unknown";
  if (/(?:edg|edge|edgios|edga)\//i.test(ua)) browser = "Microsoft Edge";
  else if (/(?:opr|opera|opios)\//i.test(ua)) browser = "Opera";
  else if (/samsungbrowser\//i.test(ua)) browser = "Samsung Internet";
  else if (/(?:chrome|crios)\//i.test(ua) || /chromium/i.test(ua)) browser = "Google Chrome";
  else if (/(?:firefox|fxios)\//i.test(ua)) browser = "Mozilla Firefox";
  else if (/safari/i.test(ua) && !/(?:chrome|crios|android|samsungbrowser|opr|opera|edg)/i.test(ua)) browser = "Apple Safari";
  else if (/msie|trident/i.test(ua)) browser = "Internet Explorer";

  return { browser, os, deviceType };
}
