import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set');
  }
  // Key should be 32 bytes (256 bits) for AES-256
  // If provided as hex string (64 chars), convert to buffer
  // If provided as base64, decode it
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  } else if (key.length === 44) {
    return Buffer.from(key, 'base64');
  } else {
    // Use SHA-256 hash of the key to ensure correct length
    return crypto.createHash('sha256').update(key).digest();
  }
}

/**
 * Encrypts a string using AES-256-GCM
 * Returns: iv:authTag:ciphertext (all base64 encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts a string encrypted with encrypt()
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a secure random encryption key (32 bytes = 256 bits)
 * Returns as hex string (64 characters)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Encrypts OAuth state parameter with CSRF protection
 * Includes timestamp for expiration checking
 */
export function encryptOAuthState(data: { cid?: string; accountId?: string; csrf: string }): string {
  const stateData = {
    ...data,
    timestamp: Date.now(),
  };
  return encrypt(JSON.stringify(stateData));
}

/**
 * Decrypts and validates OAuth state parameter
 * Throws if expired (> 10 minutes old) or invalid
 */
export function decryptOAuthState(encryptedState: string): { cid?: string; accountId?: string; csrf: string; timestamp: number } {
  const decrypted = decrypt(encryptedState);
  const data = JSON.parse(decrypted);

  // Check expiration (10 minutes)
  const maxAge = 10 * 60 * 1000; // 10 minutes in ms
  if (Date.now() - data.timestamp > maxAge) {
    throw new Error('OAuth state has expired');
  }

  return data;
}
