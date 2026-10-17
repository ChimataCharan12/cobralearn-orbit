import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Total number of single-use recovery codes generated per administrator set.
 */
export const RECOVERY_CODE_COUNT = 8;

/**
 * Cryptographically safe Crockford Base32-inspired alphabet.
 * Excludes easily confusable characters (0, O, 1, I, L) to eliminate transcription errors.
 * 32 characters = exactly 5 bits of entropy per character.
 */
export const RECOVERY_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Standard scrypt hashing configuration (OWASP & RFC 7914 recommended).
 * - N = 16384 (CPU/memory cost parameter)
 * - r = 8 (block size parameter)
 * - p = 1 (parallelization parameter)
 * - keylen = 64 (derived key length in bytes)
 */
export const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
  keylen: 64,
} as const;

/**
 * Salt length in bytes for each individual recovery code.
 */
export const SALT_BYTE_LENGTH = 16;

/**
 * Normalizes a user-submitted recovery code by removing hyphens and spaces
 * and converting to uppercase.
 */
export function normalizeRecoveryCode(rawInput: string): string {
  if (typeof rawInput !== "string") return "";
  return rawInput.replace(/[\s-]+/g, "").toUpperCase();
}

/**
 * Validates whether an input matches the 12-character recovery code alphabet and length.
 */
export function isValidRecoveryCodeFormat(rawInput: string): boolean {
  const normalized = normalizeRecoveryCode(rawInput);
  if (normalized.length !== 12) return false;
  const validPattern = /^[2-9A-HJ-NP-Z]{12}$/;
  return validPattern.test(normalized);
}

/**
 * Formats a 12-character normalized recovery code into the standard XXXX-XXXX-XXXX display format.
 */
export function formatRecoveryCode(normalized: string): string {
  const clean = normalizeRecoveryCode(normalized);
  if (clean.length !== 12) {
    throw new Error("Invalid recovery code length: must be exactly 12 normalized characters.");
  }
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

/**
 * Generates a single cryptographically secure random recovery code formatted as XXXX-XXXX-XXXX.
 */
export function generateSingleRecoveryCode(): string {
  const charCount = 12;
  const bytes = randomBytes(charCount);
  let code = "";

  for (let i = 0; i < charCount; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    const index = byte % RECOVERY_CODE_ALPHABET.length;
    code += RECOVERY_CODE_ALPHABET[index];
  }

  return formatRecoveryCode(code);
}

/**
 * Generates a set of 8 unique, high-entropy recovery codes.
 */
export function generateRecoveryCodeSet(): string[] {
  const uniqueCodes = new Set<string>();

  while (uniqueCodes.size < RECOVERY_CODE_COUNT) {
    uniqueCodes.add(generateSingleRecoveryCode());
  }

  return Array.from(uniqueCodes);
}

/**
 * Generates a cryptographically secure random per-code salt.
 */
export function generateSaltHex(): string {
  return randomBytes(SALT_BYTE_LENGTH).toString("hex");
}

/**
 * Derives a one-way scrypt hash from a normalized recovery code and per-code salt.
 * Asynchronous execution ensures the Node.js event loop is not blocked.
 */
export async function hashRecoveryCode(normalizedCode: string, saltHex: string): Promise<string> {
  const code = normalizeRecoveryCode(normalizedCode);
  if (!code) {
    throw new Error("Cannot hash an empty recovery code.");
  }
  if (!saltHex || typeof saltHex !== "string") {
    throw new Error("Salt must be provided for recovery code hashing.");
  }

  const saltBuffer = Buffer.from(saltHex, "hex");
  const derivedKey = (await scryptAsync(code, saltBuffer, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_PARAMS.maxmem,
  })) as Buffer;

  return derivedKey.toString("hex");
}

/**
 * Verifies a candidate recovery code against a stored scrypt hash and salt in constant time.
 */
export async function verifyRecoveryCodeHash(
  candidateCode: string,
  saltHex: string,
  expectedHashHex: string
): Promise<boolean> {
  try {
    const normalized = normalizeRecoveryCode(candidateCode);
    if (!normalized || !saltHex || !expectedHashHex) {
      return false;
    }

    const saltBuffer = Buffer.from(saltHex, "hex");
    const candidateKey = (await scryptAsync(normalized, saltBuffer, SCRYPT_PARAMS.keylen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
      maxmem: SCRYPT_PARAMS.maxmem,
    })) as Buffer;

    const expectedBuffer = Buffer.from(expectedHashHex, "hex");

    if (candidateKey.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(candidateKey, expectedBuffer);
  } catch {
    return false;
  }
}
