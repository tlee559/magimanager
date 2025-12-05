// ============================================================================
// OAUTH SERVICE - Token management for Google Ads OAuth
// Centralized token refresh with retry logic and activity logging
// ============================================================================

import { prisma } from '@magimanager/database';

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ============================================================================
// TYPES
// ============================================================================

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

export interface TokenRefreshError {
  isRecoverable: boolean;
  errorCode: string;
  message: string;
}

export interface RefreshResult {
  success: boolean;
  accessToken?: string;
  expiresAt?: Date;
  newRefreshToken?: string;
  error?: TokenRefreshError;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TOKEN EXCHANGE
// ============================================================================

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; idToken?: string }> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json() as TokenResponse;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token!,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    idToken: data.id_token,
  };
}

// ============================================================================
// TOKEN REFRESH
// ============================================================================

/**
 * Refresh an expired access token
 * Note: Google may return a new refresh token (token rotation) - callers should store it
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date; newRefreshToken?: string }> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json() as TokenResponse;

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    newRefreshToken: data.refresh_token, // May be undefined - Google rotates tokens sometimes
  };
}

/**
 * Classify a token refresh error as recoverable or permanent
 *
 * Non-recoverable errors (require user re-consent):
 * - invalid_grant: Token revoked or expired refresh token
 * - unauthorized_client: OAuth app configuration changed
 * - access_denied: User revoked access
 * - invalid_client: Client credentials invalid
 *
 * Recoverable errors (transient, worth retrying):
 * - Network errors, timeouts
 * - 5xx server errors
 * - Rate limiting (429)
 */
export function classifyTokenError(error: unknown): TokenRefreshError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Check for known non-recoverable OAuth errors
  const nonRecoverablePatterns = [
    { pattern: 'invalid_grant', code: 'invalid_grant' },
    { pattern: 'unauthorized_client', code: 'unauthorized_client' },
    { pattern: 'access_denied', code: 'access_denied' },
    { pattern: 'invalid_client', code: 'invalid_client' },
    { pattern: 'token has been expired or revoked', code: 'token_revoked' },
    { pattern: 'token has been revoked', code: 'token_revoked' },
  ];

  for (const { pattern, code } of nonRecoverablePatterns) {
    if (lowerMessage.includes(pattern)) {
      return {
        isRecoverable: false,
        errorCode: code,
        message: `Token permanently invalid: ${code}`,
      };
    }
  }

  // All other errors are potentially recoverable (network issues, rate limits, server errors)
  return {
    isRecoverable: true,
    errorCode: 'transient',
    message,
  };
}

/**
 * Attempt to refresh an access token with retry logic for transient errors
 *
 * - Retries up to 3 times with exponential backoff for transient errors
 * - Fails immediately for non-recoverable errors (invalid_grant, revoked, etc.)
 * - Logs all attempts to OAuthActivityLog for debugging
 */
export async function refreshAccessTokenWithRetry(
  refreshToken: string,
  connectionId?: string,
  sourceApp: string = 'abra',
  maxRetries: number = 3
): Promise<RefreshResult> {
  let lastError: TokenRefreshError | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await refreshAccessToken(refreshToken);

      // Log successful refresh
      if (connectionId) {
        await logOAuthActivity(connectionId, 'token_refresh', sourceApp, {
          attempt: attempt + 1,
          success: true,
        });
      }

      return {
        success: true,
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
        newRefreshToken: result.newRefreshToken,
      };
    } catch (error) {
      lastError = classifyTokenError(error);

      // Log the failed attempt
      if (connectionId) {
        await logOAuthActivity(connectionId, 'token_refresh_failed', sourceApp, {
          attempt: attempt + 1,
          errorCode: lastError.errorCode,
          isRecoverable: lastError.isRecoverable,
          message: lastError.message,
        }, lastError.errorCode, lastError.isRecoverable);
      }

      // Don't retry non-recoverable errors
      if (!lastError.isRecoverable) {
        console.log(`[OAuth Service] Non-recoverable error: ${lastError.errorCode}`);
        return {
          success: false,
          error: lastError,
        };
      }

      // For recoverable errors, retry with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
        console.log(`[OAuth Service] Transient error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted for recoverable error
  return {
    success: false,
    error: lastError || { isRecoverable: true, errorCode: 'unknown', message: 'Unknown error' },
  };
}

// ============================================================================
// USER INFO
// ============================================================================

/**
 * Get user info from Google (email, id)
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return response.json() as Promise<GoogleUserInfo>;
}

// ============================================================================
// OAUTH URL BUILDER
// ============================================================================

/**
 * Build the Google OAuth authorization URL
 */
export function buildOAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_ADS_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/adwords openid email profile',
    access_type: 'offline',
    prompt: 'consent', // Force consent to always get refresh token
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ============================================================================
// ACTIVITY LOGGING
// ============================================================================

/**
 * Log OAuth activity for debugging
 */
export async function logOAuthActivity(
  connectionId: string,
  action: string,
  sourceApp: string,
  details?: Record<string, unknown>,
  errorCode?: string,
  isRecoverable?: boolean
): Promise<void> {
  try {
    await prisma.oAuthActivityLog.create({
      data: {
        connectionId,
        action,
        sourceApp,
        details: details ? JSON.stringify(details) : null,
        errorCode: errorCode || null,
        isRecoverable: isRecoverable ?? null,
      },
    });
  } catch (error) {
    // Don't let logging failures break the main flow
    console.error('[OAuth Service] Failed to log activity:', error);
  }
}

/**
 * Get recent OAuth activity for a connection
 */
export async function getOAuthActivityHistory(
  connectionId: string,
  limit: number = 10
): Promise<Array<{
  id: string;
  action: string;
  details: string | null;
  errorCode: string | null;
  isRecoverable: boolean | null;
  sourceApp: string;
  createdAt: Date;
}>> {
  return prisma.oAuthActivityLog.findMany({
    where: { connectionId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      details: true,
      errorCode: true,
      isRecoverable: true,
      sourceApp: true,
      createdAt: true,
    },
  });
}

// ============================================================================
// ENCRYPTION (for OAuth tokens)
// Uses TOKEN_ENCRYPTION_KEY for compatibility with existing tokens
// ============================================================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getTokenEncryptionKey(): Buffer {
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
 * Encrypts a token using AES-256-GCM
 * Returns: iv:authTag:ciphertext (all base64 encoded)
 * Compatible with existing ABRA encryption format
 */
export function encryptToken(plaintext: string): string {
  const key = getTokenEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts a token encrypted with encryptToken()
 */
export function decryptToken(encryptedData: string): string {
  const key = getTokenEncryptionKey();

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
 * Encrypts OAuth state parameter with CSRF protection
 * Includes timestamp for expiration checking
 */
export function encryptOAuthState(data: { cid?: string; accountId?: string; csrf: string; mode?: string; returnUrl?: string }): string {
  const stateData = {
    ...data,
    timestamp: Date.now(),
  };
  return encryptToken(JSON.stringify(stateData));
}

/**
 * Decrypts and validates OAuth state parameter
 * Throws if expired (> 10 minutes old) or invalid
 */
export function decryptOAuthState(encryptedState: string): {
  cid?: string;
  accountId?: string;
  csrf: string;
  timestamp: number;
  mode?: string;
  returnUrl?: string;
} {
  const decrypted = decryptToken(encryptedState);
  const data = JSON.parse(decrypted);

  // Check expiration (10 minutes)
  const maxAge = 10 * 60 * 1000; // 10 minutes in ms
  if (Date.now() - data.timestamp > maxAge) {
    throw new Error('OAuth state has expired');
  }

  return data;
}
