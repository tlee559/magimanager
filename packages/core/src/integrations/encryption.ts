// ============================================================================
// ENCRYPTION - Utilities for encrypting/decrypting sensitive data
// ============================================================================

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment or generate from secret
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET environment variable is required");
  }

  // Derive a consistent 32-byte key from the secret
  return crypto.pbkdf2Sync(
    secret,
    "magimanager-salt", // Static salt for consistent key derivation
    ITERATIONS,
    KEY_LENGTH,
    "sha512"
  );
}

/**
 * Encrypt a string value
 * @param text - The plaintext to encrypt
 * @returns The encrypted value as a base64 string with format: salt:iv:tag:ciphertext
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Combine all parts: salt:iv:tag:ciphertext
  return [
    salt.toString("base64"),
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt an encrypted string
 * @param encryptedText - The encrypted value in format: salt:iv:tag:ciphertext
 * @returns The decrypted plaintext
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();

  const parts = encryptedText.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted text format");
  }

  const [_salt, ivBase64, tagBase64, ciphertextBase64] = parts;

  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Check if a string appears to be encrypted
 * @param text - The text to check
 * @returns True if the text appears to be in encrypted format
 */
export function isEncrypted(text: string): boolean {
  const parts = text.split(":");
  if (parts.length !== 4) return false;

  // Check that each part is valid base64
  try {
    parts.forEach((part) => {
      Buffer.from(part, "base64");
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Hash a value for comparison (one-way)
 * @param text - The text to hash
 * @returns The hashed value
 */
export function hash(text: string): string {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}

/**
 * Generate a secure random string
 * @param length - The length of the string to generate
 * @returns A random alphanumeric string
 */
export function generateSecureRandom(length: number = 32): string {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}
