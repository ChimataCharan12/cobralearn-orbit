/**
 * Client-safe utilities for recovery code formatting, validation, and normalization.
 * Free of Node.js dependencies (e.g. node:crypto) so it can be safely used in browser components.
 */

export const RECOVERY_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Normalizes a recovery code candidate by stripping whitespace, hyphens, and converting to uppercase.
 */
export function normalizeRecoveryCode(rawCode: string): string {
  if (!rawCode || typeof rawCode !== "string") return "";
  return rawCode.replace(/[\s\-]/g, "").toUpperCase();
}

/**
 * Validates whether a candidate recovery code matches the 12-character Crockford Base32 format.
 */
export function isValidRecoveryCodeFormat(rawCode: string): boolean {
  if (!rawCode || typeof rawCode !== "string") return false;
  const clean = normalizeRecoveryCode(rawCode);
  if (clean.length !== 12) return false;
  const validRegex = /^[2-9A-HJ-NP-Z]{12}$/;
  return validRegex.test(clean);
}

/**
 * Formats a raw or partial string into the user-facing XXXX-XXXX-XXXX display format.
 * Strips invalid characters (0, 1, I, O, L and punctuation) and inserts hyphens every 4 chars.
 */
export function formatRecoveryCodeInput(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  const clean = raw
    .toUpperCase()
    .split("")
    .filter((ch) => RECOVERY_CODE_ALPHABET.includes(ch))
    .join("")
    .slice(0, 12);
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    chunks.push(clean.slice(i, i + 4));
  }
  return chunks.join("-");
}
