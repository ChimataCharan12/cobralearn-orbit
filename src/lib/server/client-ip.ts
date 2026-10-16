import { createHmac } from "node:crypto";
import { isIP } from "node:net";

/**
 * Validates whether a string is a well-formed IPv4 address using Node standard library.
 */
export function isValidIPv4(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  return isIP(ip.trim()) === 4;
}

/**
 * Validates whether a string is a well-formed IPv6 address using Node standard library.
 */
export function isValidIPv6(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  return isIP(ip.trim()) === 6;
}

/**
 * Validates whether an IP string is a valid IPv4 or IPv6 address.
 */
export function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  return isIP(ip.trim()) !== 0;
}

/**
 * Masks an IP address for privacy-safe audit logging.
 * - IPv4: 198.51.100.42 -> 198.51.100.***
 * - IPv6: 2001:db8:85a3::8a2e:370:7334 -> 2001:db8:****:****
 * - Malformed / Unknown: "unknown"
 */
export function maskIpAddress(ip: string | null | undefined): string {
  if (!ip || typeof ip !== "string") return "unknown";
  const clean = ip.trim();

  if (isValidIPv4(clean)) {
    const parts = clean.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  }

  if (isValidIPv6(clean)) {
    const parts = clean.split(":");
    const prefix = parts.slice(0, Math.min(2, parts.length)).join(":");
    return `${prefix}:****:****`;
  }

  return "unknown";
}

/**
 * Resolves trusted client IP from HTTP headers.
 * 
 * Trust Hierarchy:
 * 1. Edge-validated provider header: `cf-connecting-ip` (Cloudflare edge) or `true-client-ip`.
 * 2. Reverse proxy header: `x-real-ip`.
 * 3. Forwarded chain: `x-forwarded-for`. To prevent client spoofing where attackers prepend
 *    arbitrary IPs (e.g. `X-Forwarded-For: 1.1.1.1, 2.2.2.2`), reverse proxies append client IPs.
 *    Therefore, we parse the chain from the rightmost (closest trusted proxy hop) and validate.
 * 4. Fallback: "127.0.0.1" for development or "unknown".
 */
export function extractTrustedClientIp(headers: Headers | Record<string, string | null | undefined>): string {
  const getHeader = (name: string): string | null => {
    if (typeof (headers as any)?.get === "function") {
      return (headers as Headers).get(name);
    }
    const lower = name.toLowerCase();
    const map = headers as Record<string, string | null | undefined>;
    return map[lower] || map[name] || null;
  };

  // 1. Edge-injected headers
  const cfIp = getHeader("cf-connecting-ip")?.trim();
  if (cfIp && isValidIP(cfIp)) {
    return cfIp;
  }

  const trueClientIp = getHeader("true-client-ip")?.trim();
  if (trueClientIp && isValidIP(trueClientIp)) {
    return trueClientIp;
  }

  // 2. Direct reverse proxy header
  const realIp = getHeader("x-real-ip")?.trim();
  if (realIp && isValidIP(realIp)) {
    return realIp;
  }

  // 3. X-Forwarded-For chain: validate from the rightmost entry (immediate hop)
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    // Scan backwards from right to left for first syntactically valid IP
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = parts[i];
      if (candidate && isValidIP(candidate)) {
        return candidate;
      }
    }
  }

  // 4. Safe fallback
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return "127.0.0.1";
  }

  return "unknown";
}

/**
 * Returns a keyed HMAC secret used to hash sensitive identifiers (emails, IPs)
 * before using them in rate-limit keys or security logs.
 */
function getRateLimitSecret(): string {
  return (
    process.env["RATE_LIMIT_SECRET"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    "orbit-rate-limit-default-salt-v1"
  );
}

/**
 * Computes a privacy-preserving keyed HMAC of a normalized email address.
 * Never stores or exposes raw email addresses in rate-limiting keys or storage.
 */
export function hashAccountIdentifier(email: string): string {
  const normalized = email.trim().toLowerCase();
  const secret = getRateLimitSecret();
  return createHmac("sha256", secret).update(`account:${normalized}`).digest("hex");
}

/**
 * Computes a privacy-preserving keyed HMAC of a client IP address.
 */
export function hashIpIdentifier(ip: string): string {
  const secret = getRateLimitSecret();
  return createHmac("sha256", secret).update(`ip:${ip.trim()}`).digest("hex").slice(0, 32);
}
